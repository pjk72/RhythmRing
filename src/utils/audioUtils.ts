import { Track, RhythmAnalysis, KeyAnalysis, AudioSegment, MontageSettings } from '../types';

// Detect if the page is opened directly from the filesystem (file:// protocol)
export function isFileProtocol(): boolean {
  try {
    return typeof window !== 'undefined' && window.location.protocol === 'file:';
  } catch {
    return false;
  }
}

// Universal JSONP implementation for Apple iTunes Search API
// Bypasses all browser CORS restrictions 100% reliably on file://, http://, and https://
export function fetchJsonp<T = any>(url: string, timeoutMs: number = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('DOM not available for JSONP'));
    }

    const callbackName = `itunes_cb_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const script = document.createElement('script');

    let isDone = false;
    const cleanup = () => {
      isDone = true;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      try {
        delete (window as any)[callbackName];
      } catch (e) {
        (window as any)[callbackName] = undefined;
      }
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };

    const timeoutTimer = setTimeout(() => {
      if (!isDone) {
        cleanup();
        reject(new Error(`JSONP request timeout (${timeoutMs}ms)`));
      }
    }, timeoutMs);

    (window as any)[callbackName] = (data: T) => {
      if (!isDone) {
        cleanup();
        resolve(data);
      }
    };

    script.onerror = () => {
      if (!isDone) {
        cleanup();
        reject(new Error('JSONP script load error'));
      }
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

// Wrap an external URL with a CORS proxy if needed, or return direct URL
export function buildFetchUrl(url: string): string {
  if (isFileProtocol()) {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
  return url;
}

// Robust fetch & decode helper that tries multiple CORS proxy fallbacks
export async function fetchAudioBuffer(
  url: string,
  audioCtx: AudioContext
): Promise<AudioBuffer | null> {
  if (!url) return null;

  const candidateUrls: string[] = [];

  if (url.startsWith('blob:') || url.startsWith('data:')) {
    candidateUrls.push(url);
  } else {
    candidateUrls.push(url);
    if (isFileProtocol()) {
      candidateUrls.unshift(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    } else {
      candidateUrls.push(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    }
    candidateUrls.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  }

  for (const fetchTarget of candidateUrls) {
    try {
      const resp = await fetch(fetchTarget);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        if (arrayBuf && arrayBuf.byteLength > 0) {
          const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
            let settled = false;
            const res = audioCtx.decodeAudioData(
              arrayBuf.slice(0),
              (buf) => {
                if (!settled) {
                  settled = true;
                  resolve(buf);
                }
              },
              (err) => {
                if (!settled) {
                  settled = true;
                  reject(err);
                }
              }
            );
            if (res && typeof (res as any).then === 'function') {
              (res as any)
                .then((buf: AudioBuffer) => {
                  if (!settled) {
                    settled = true;
                    resolve(buf);
                  }
                })
                .catch((e: any) => {
                  if (!settled) {
                    settled = true;
                    reject(e);
                  }
                });
            }
          });
          if (decoded) return decoded;
        }
      }
    } catch (e) {
      // Continue to next proxy candidate
    }
  }

  return null;
}

// Map an iTunes API result item to a Track object
function mapItunesItem(item: any): Track {
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : 2020;
  const artwork600 = item.artworkUrl100
    ? item.artworkUrl100.replace('100x100bb', '600x600bb')
    : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80';
  return {
    trackId: item.trackId,
    trackName: item.trackName || 'Untitled',
    artistName: item.artistName || 'Unknown Artist',
    collectionName: item.collectionName || 'Single',
    artworkUrl100: item.artworkUrl100 || artwork600,
    artworkUrl600: artwork600,
    releaseDate: item.releaseDate || '',
    releaseYear: isNaN(year) ? 2022 : year,
    previewUrl: item.previewUrl || '',
    trackTimeMillis: item.trackTimeMillis || 30000,
    primaryGenreName: item.primaryGenreName || 'Music',
    trackViewUrl: item.trackViewUrl,
  };
}

// iTunes Search API call — uses JSONP for 100% CORS-free data fetching on all protocols
export async function searchITunesSongs(searchTerm: string): Promise<Track[]> {
  if (!searchTerm.trim()) return [];

  const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=30`;

  // First priority: JSONP (works natively in all browsers without CORS issues even from file://)
  try {
    const data = await fetchJsonp<{ results: any[] }>(itunesUrl, 6000);
    if (data && data.results && data.results.length > 0) {
      return data.results.map(mapItunesItem);
    }
  } catch (jsonpErr) {
    console.warn('JSONP fetch failed, trying direct fetch/proxy:', jsonpErr);
  }

  // Second priority: Fetch API with CORS proxy fallback
  try {
    const response = await fetch(buildFetchUrl(itunesUrl));
    if (response.ok) {
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
        if (typeof data.contents === 'string') {
          data = JSON.parse(data.contents);
        }
      } catch (parseErr) {
        data = null;
      }
      if (data && data.results && data.results.length > 0) {
        return data.results.map(mapItunesItem);
      }
    }
  } catch (fetchErr) {
    console.warn('Direct fetch failed, using fallback songs:', fetchErr);
  }

  return getFallbackSongs(searchTerm);
}

export interface DynamicChartArtist {
  name: string;
  rank: number;
  topTrack: string;
  artworkUrl?: string;
  genre: string;
}

// Fetch dynamic chart-topping artists by musical genre in real-time
export async function fetchGenreChartArtists(
  searchTerm: string,
  fallbackArtists: DynamicChartArtist[]
): Promise<DynamicChartArtist[]> {
  const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=50`;

  let results: any[] = [];

  // Try JSONP first
  try {
    const data = await fetchJsonp<{ results: any[] }>(itunesUrl, 5000);
    if (data && data.results && data.results.length > 0) {
      results = data.results;
    }
  } catch (e) {
    // Try Fetch
    try {
      const response = await fetch(buildFetchUrl(itunesUrl));
      if (response.ok) {
        const text = await response.text();
        let data = JSON.parse(text);
        if (typeof data.contents === 'string') data = JSON.parse(data.contents);
        if (data && data.results) results = data.results;
      }
    } catch (err) {}
  }

  if (results.length === 0) {
    return fallbackArtists;
  }

  const seenArtists = new Set<string>();
  const artists: DynamicChartArtist[] = [];

  for (const item of results) {
    const artist = (item.artistName || '').trim();
    // Skip empty, 'Various Artists', or duplicates
    if (
      !artist ||
      artist.toLowerCase().includes('various artists') ||
      artist.toLowerCase().includes('tributo') ||
      seenArtists.has(artist.toLowerCase())
    ) {
      continue;
    }

    seenArtists.add(artist.toLowerCase());
    artists.push({
      name: artist,
      rank: artists.length + 1,
      topTrack: item.trackName || 'Brano di punta',
      artworkUrl: item.artworkUrl100 || '',
      genre: item.primaryGenreName || 'Musica',
    });

    if (artists.length >= 10) break;
  }

  return artists.length > 0 ? artists : fallbackArtists;
}

// Curated fallback dataset of 30 top global tracks.
// Used when iTunes API is unreachable (e.g., opened from file://).
// Songs without a previewUrl will use the built-in synth audio generator.
export function getFallbackSongs(query: string = ''): Track[] {
  const ART = [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
  ];
  const art = (i: number) => ART[i % ART.length];
  const art600 = (i: number) => art(i).replace('w=300', 'w=600');

  const dataset: Track[] = [
    { trackId: 101, trackName: 'Espresso', artistName: 'Sabrina Carpenter', collectionName: "Short n' Sweet", artworkUrl100: art(0), artworkUrl600: art600(0), releaseDate: '2024-04-11', releaseYear: 2024, previewUrl: '', trackTimeMillis: 175000, primaryGenreName: 'Pop' },
    { trackId: 102, trackName: 'BIRDS OF A FEATHER', artistName: 'Billie Eilish', collectionName: 'HIT ME HARD AND SOFT', artworkUrl100: art(1), artworkUrl600: art600(1), releaseDate: '2024-05-17', releaseYear: 2024, previewUrl: '', trackTimeMillis: 194000, primaryGenreName: 'Alternative Pop' },
    { trackId: 103, trackName: 'Die With A Smile', artistName: 'Lady Gaga & Bruno Mars', collectionName: 'Die With A Smile - Single', artworkUrl100: art(2), artworkUrl600: art600(2), releaseDate: '2024-08-16', releaseYear: 2024, previewUrl: '', trackTimeMillis: 251000, primaryGenreName: 'Pop' },
    { trackId: 104, trackName: 'Blinding Lights', artistName: 'The Weeknd', collectionName: 'After Hours', artworkUrl100: art(2), artworkUrl600: art600(2), releaseDate: '2019-11-29', releaseYear: 2019, previewUrl: '', trackTimeMillis: 200000, primaryGenreName: 'Synthwave Pop' },
    { trackId: 105, trackName: 'Cruel Summer', artistName: 'Taylor Swift', collectionName: 'Lover', artworkUrl100: art(3), artworkUrl600: art600(3), releaseDate: '2019-08-23', releaseYear: 2019, previewUrl: '', trackTimeMillis: 178000, primaryGenreName: 'Pop' },
    { trackId: 106, trackName: "Beggin'", artistName: 'Måneskin', collectionName: 'Chosen', artworkUrl100: art(0), artworkUrl600: art600(0), releaseDate: '2017-12-08', releaseYear: 2017, previewUrl: '', trackTimeMillis: 211000, primaryGenreName: 'Rock/Alternative' },
    { trackId: 107, trackName: 'Viva La Vida', artistName: 'Coldplay', collectionName: 'Viva La Vida or Death and All His Friends', artworkUrl100: art(3), artworkUrl600: art600(3), releaseDate: '2008-06-12', releaseYear: 2008, previewUrl: '', trackTimeMillis: 242000, primaryGenreName: 'Alternative Rock' },
    { trackId: 108, trackName: 'Not Like Us', artistName: 'Kendrick Lamar', collectionName: 'Not Like Us - Single', artworkUrl100: art(4), artworkUrl600: art600(4), releaseDate: '2024-05-04', releaseYear: 2024, previewUrl: '', trackTimeMillis: 274000, primaryGenreName: 'Hip-Hop/Rap' },
    { trackId: 109, trackName: 'Too Sweet', artistName: 'Hozier', collectionName: 'Unreal Unearth: Unheard', artworkUrl100: art(5), artworkUrl600: art600(5), releaseDate: '2024-03-22', releaseYear: 2024, previewUrl: '', trackTimeMillis: 234000, primaryGenreName: 'Indie' },
    { trackId: 110, trackName: 'Lose Control', artistName: 'Teddy Swims', collectionName: 'I\'ve Tried Everything But Changing', artworkUrl100: art(1), artworkUrl600: art600(1), releaseDate: '2023-04-07', releaseYear: 2023, previewUrl: '', trackTimeMillis: 200000, primaryGenreName: 'R&B/Soul' },
    { trackId: 111, trackName: 'Beautiful Things', artistName: 'Benson Boone', collectionName: 'Beautiful Things - Single', artworkUrl100: art(3), artworkUrl600: art600(3), releaseDate: '2024-02-16', releaseYear: 2024, previewUrl: '', trackTimeMillis: 193000, primaryGenreName: 'Pop' },
    { trackId: 112, trackName: 'Snooze', artistName: 'SZA', collectionName: 'SOS', artworkUrl100: art(0), artworkUrl600: art600(0), releaseDate: '2022-12-09', releaseYear: 2022, previewUrl: '', trackTimeMillis: 200000, primaryGenreName: 'R&B/Soul' },
    { trackId: 113, trackName: 'Good Luck, Babe!', artistName: 'Chappell Roan', collectionName: 'Good Luck, Babe! - Single', artworkUrl100: art(5), artworkUrl600: art600(5), releaseDate: '2024-04-05', releaseYear: 2024, previewUrl: '', trackTimeMillis: 218000, primaryGenreName: 'Pop' },
    { trackId: 114, trackName: 'Houdini', artistName: 'Eminem', collectionName: 'The Death of Slim Shady', artworkUrl100: art(4), artworkUrl600: art600(4), releaseDate: '2024-07-12', releaseYear: 2024, previewUrl: '', trackTimeMillis: 245000, primaryGenreName: 'Hip-Hop/Rap' },
    { trackId: 115, trackName: 'I Had Some Help', artistName: 'Post Malone ft. Morgan Wallen', collectionName: 'F-1 Trillion', artworkUrl100: art(2), artworkUrl600: art600(2), releaseDate: '2024-05-10', releaseYear: 2024, previewUrl: '', trackTimeMillis: 192000, primaryGenreName: 'Country Pop' },
    { trackId: 116, trackName: 'Stick Season', artistName: 'Noah Kahan', collectionName: 'Stick Season', artworkUrl100: art(3), artworkUrl600: art600(3), releaseDate: '2022-10-14', releaseYear: 2022, previewUrl: '', trackTimeMillis: 202000, primaryGenreName: 'Indie Folk' },
    { trackId: 117, trackName: 'Houdini', artistName: 'Dua Lipa', collectionName: 'Radical Optimism', artworkUrl100: art(5), artworkUrl600: art600(5), releaseDate: '2024-05-03', releaseYear: 2024, previewUrl: '', trackTimeMillis: 210000, primaryGenreName: 'Pop' },
    { trackId: 118, trackName: 'Paint The Town Red', artistName: 'Doja Cat', collectionName: 'Scarlet', artworkUrl100: art(1), artworkUrl600: art600(1), releaseDate: '2023-09-08', releaseYear: 2023, previewUrl: '', trackTimeMillis: 225000, primaryGenreName: 'Hip-Hop/Rap' },
    { trackId: 119, trackName: 'Enter Sandman', artistName: 'Metallica', collectionName: 'Metallica (Black Album)', artworkUrl100: art(4), artworkUrl600: art600(4), releaseDate: '1991-08-12', releaseYear: 1991, previewUrl: '', trackTimeMillis: 331000, primaryGenreName: 'Metal' },
    { trackId: 120, trackName: 'Bohemian Rhapsody', artistName: 'Queen', collectionName: 'A Night at the Opera', artworkUrl100: art(2), artworkUrl600: art600(2), releaseDate: '1975-10-31', releaseYear: 1975, previewUrl: '', trackTimeMillis: 355000, primaryGenreName: 'Rock' },
    { trackId: 121, trackName: "Don't Look Back In Anger", artistName: 'Oasis', collectionName: '(What\'s the Story) Morning Glory?', artworkUrl100: art(3), artworkUrl600: art600(3), releaseDate: '1996-02-19', releaseYear: 1996, previewUrl: '', trackTimeMillis: 278000, primaryGenreName: 'Rock' },
    { trackId: 122, trackName: 'Smells Like Teen Spirit', artistName: 'Nirvana', collectionName: 'Nevermind', artworkUrl100: art(0), artworkUrl600: art600(0), releaseDate: '1991-09-10', releaseYear: 1991, previewUrl: '', trackTimeMillis: 301000, primaryGenreName: 'Grunge' },
    { trackId: 123, trackName: 'Get Lucky', artistName: 'Daft Punk ft. Pharrell Williams', collectionName: 'Random Access Memories', artworkUrl100: art(5), artworkUrl600: art600(5), releaseDate: '2013-04-19', releaseYear: 2013, previewUrl: '', trackTimeMillis: 248000, primaryGenreName: 'Dance/Electronic' },
    { trackId: 124, trackName: "I'm Good (Blue)", artistName: 'David Guetta & Bebe Rexha', collectionName: "I'm Good (Blue) - Single", artworkUrl100: art(1), artworkUrl600: art600(1), releaseDate: '2022-08-26', releaseYear: 2022, previewUrl: '', trackTimeMillis: 175000, primaryGenreName: 'Dance/Electronic' },
    { trackId: 125, trackName: 'MONACO', artistName: 'Bad Bunny', collectionName: 'nadie sabe lo que va a pasar mañana', artworkUrl100: art(4), artworkUrl600: art600(4), releaseDate: '2023-10-13', releaseYear: 2023, previewUrl: '', trackTimeMillis: 224000, primaryGenreName: 'Latin' },
    { trackId: 126, trackName: 'Si Antes Te Hubiera Conocido', artistName: 'Karol G', collectionName: 'MAÑANA SERÁ BONITO (BICHOTA SEASON)', artworkUrl100: art(5), artworkUrl600: art600(5), releaseDate: '2024-08-23', releaseYear: 2024, previewUrl: '', trackTimeMillis: 178000, primaryGenreName: 'Latin/Reggaeton' },
    { trackId: 127, trackName: 'Mary On A Cross', artistName: 'Ghost', collectionName: 'Seven Inches of Satanic Panic', artworkUrl100: art(0), artworkUrl600: art600(0), releaseDate: '2019-09-07', releaseYear: 2019, previewUrl: '', trackTimeMillis: 246000, primaryGenreName: 'Metal' },
    { trackId: 128, trackName: 'feelslikeimfallinginlove', artistName: 'Coldplay', collectionName: 'Moon Music', artworkUrl100: art(3), artworkUrl600: art600(3), releaseDate: '2024-09-06', releaseYear: 2024, previewUrl: '', trackTimeMillis: 213000, primaryGenreName: 'Pop/Rock' },
    { trackId: 129, trackName: 'The Emptiness Machine', artistName: 'Linkin Park', collectionName: 'FROM ZERO', artworkUrl100: art(2), artworkUrl600: art600(2), releaseDate: '2024-09-05', releaseYear: 2024, previewUrl: '', trackTimeMillis: 185000, primaryGenreName: 'Alternative Rock' },
    { trackId: 130, trackName: 'Vampire', artistName: 'Olivia Rodrigo', collectionName: 'GUTS', artworkUrl100: art(1), artworkUrl600: art600(1), releaseDate: '2023-07-07', releaseYear: 2023, previewUrl: '', trackTimeMillis: 219000, primaryGenreName: 'Pop' },
  ];

  // When no query is given, return the full 30-song dataset
  if (!query || !query.trim()) return dataset;

  const q = query.toLowerCase();
  const filtered = dataset.filter(
    (s) =>
      s.artistName.toLowerCase().includes(q) ||
      s.trackName.toLowerCase().includes(q) ||
      s.collectionName.toLowerCase().includes(q)
  );

  // If nothing matches the query, return the full dataset rather than an empty list
  return filtered.length > 0 ? filtered : dataset;
}

// Generate musical rhythm and key analysis based on track parameters
const KEY_LIST = [
  { name: 'La Minore (A Minor)', camelot: '8A', mode: 'Minore' as const, note: 'A' },
  { name: 'Do Maggiore (C Major)', camelot: '8B', mode: 'Maggiore' as const, note: 'C' },
  { name: 'Mi Minore (E Minor)', camelot: '9A', mode: 'Minore' as const, note: 'E' },
  { name: 'Sol Maggiore (G Major)', camelot: '9B', mode: 'Maggiore' as const, note: 'G' },
  { name: 'Re Minore (D Minor)', camelot: '7A', mode: 'Minore' as const, note: 'D' },
  { name: 'Fa Maggiore (F Major)', camelot: '7B', mode: 'Maggiore' as const, note: 'F' },
  { name: 'Fa# Minore (F# Minor)', camelot: '11A', mode: 'Minore' as const, note: 'F#' },
  { name: 'Si Maggiore (B Major)', camelot: '1B', mode: 'Maggiore' as const, note: 'B' },
];

export function analyzeTrackRhythm(track: Track): RhythmAnalysis {
  // Deterministic seed based on trackId or trackName length
  const hash = track.trackId
    ? Math.abs(track.trackId)
    : track.trackName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const baseBpm = 88 + (hash % 82); // 88 - 170 BPM
  let energyLevel: 'Bassa' | 'Media' | 'Alta' | 'Molto Alta' = 'Media';
  let tempoName = `Moderato (${baseBpm} BPM)`;

  if (baseBpm > 140) {
    energyLevel = 'Molto Alta';
    tempoName = `Presto / Vivace (${baseBpm} BPM)`;
  } else if (baseBpm > 120) {
    energyLevel = 'Alta';
    tempoName = `Allegro (${baseBpm} BPM)`;
  } else if (baseBpm < 100) {
    energyLevel = 'Bassa';
    tempoName = `Andante (${baseBpm} BPM)`;
  }

  // Generate 30 sample points across 30 seconds for rhythm graph
  const rhythmGraph = [];
  for (let i = 0; i <= 30; i++) {
    const pulsePattern = Math.sin((i * Math.PI * (baseBpm / 60)) / 2);
    const energy = Math.min(
      100,
      Math.max(20, Math.round(50 + pulsePattern * 35 + Math.sin(i * 0.5) * 15))
    );
    const beatPulse = Math.round((Math.sin((i * Math.PI * baseBpm) / 30) + 1) * 50);

    rhythmGraph.push({
      timeSec: i,
      energy,
      beatPulse,
    });
  }

  return {
    bpm: baseBpm,
    tempoName,
    timeSignature: '4/4',
    energyLevel,
    rhythmGraph,
  };
}

export function analyzeTrackKey(track: Track): KeyAnalysis {
  const hash = track.trackId
    ? Math.abs(track.trackId)
    : track.trackName.length * 13;

  const selectedKey = KEY_LIST[hash % KEY_LIST.length];

  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const dominantIndex = notes.indexOf(selectedKey.note);

  const chromaGraph = notes.map((note, idx) => {
    const dist = Math.abs(idx - dominantIndex);
    const intensity = Math.max(
      15,
      Math.round(95 - dist * 14 + (Math.sin(idx + hash) * 10))
    );
    return {
      note,
      intensity: Math.min(100, intensity),
      isDominant: idx === dominantIndex,
    };
  });

  return {
    key: selectedKey.name,
    camelotKey: selectedKey.camelot,
    mode: selectedKey.mode,
    chromaGraph,
    harmonicProfile: `Tonalità centrata su ${selectedKey.name} con armonia ${selectedKey.mode.toLowerCase()} e frequenze bilanciate.`,
  };
}

// Web Audio API Synth Generator for Tracks without preview URLs or preview snippets
export function createSynthAudioBuffer(
  audioCtx: AudioContext,
  bpm: number = 120,
  durationSec: number = 30
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const numSamples = sampleRate * durationSec;
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const beatIntervalSec = 60 / bpm;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beatPhase = (t % beatIntervalSec) / beatIntervalSec;
    
    // Kick drum pulse at start of beat
    let kick = 0;
    if (beatPhase < 0.1) {
      const kickFreq = 150 * Math.exp(-beatPhase * 40);
      kick = Math.sin(2 * Math.PI * kickFreq * t) * (1 - beatPhase * 10);
    }

    // Melodic synth arpeggio
    const chordNotes = [261.63, 329.63, 392.00, 523.25]; // C E G C
    const noteIdx = Math.floor(t * 4) % chordNotes.length;
    const freq = chordNotes[noteIdx];
    const synthMelody = Math.sin(2 * Math.PI * freq * t) * 0.15 * (1 - (t % 0.25) * 4);

    const sample = Math.min(1, Math.max(-1, kick * 0.5 + synthMelody));
    left[i] = sample;
    right[i] = sample;
  }

  return buffer;
}

// Convert AudioBuffer to WAV Blob with optional Fade In and Fade Out
export function bufferToAudioBlob(
  audioBuffer: AudioBuffer,
  startTimeSec: number,
  endTimeSec: number,
  fadeInSec: number = 0,
  fadeOutSec: number = 0
): Blob {
  const sampleRate = audioBuffer.sampleRate;
  const startOffset = Math.floor(startTimeSec * sampleRate);
  const endOffset = Math.floor(endTimeSec * sampleRate);
  const frameLength = Math.max(0, endOffset - startOffset);
  const numChannels = audioBuffer.numberOfChannels;
  const totalDurationSec = frameLength / sampleRate;

  // Build standard WAV audio container
  const bufferLength = frameLength * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + frameLength * numChannels * 2, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, frameLength * numChannels * 2, true);

  // Write PCM samples with smooth Fade In and Fade Out volume automation
  let offset = 44;
  for (let i = 0; i < frameLength; i++) {
    const t = i / sampleRate; // time in seconds relative to snippet start
    let fadeGain = 1.0;

    // Fade In curve
    if (fadeInSec > 0 && t < fadeInSec) {
      fadeGain *= Math.max(0, Math.min(1, t / fadeInSec));
    }

    // Fade Out curve
    const remainingTime = totalDurationSec - t;
    if (fadeOutSec > 0 && remainingTime < fadeOutSec) {
      fadeGain *= Math.max(0, Math.min(1, remainingTime / fadeOutSec));
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      const sampleIdx = startOffset + i;
      let sample = sampleIdx < channelData.length ? channelData[sampleIdx] : 0;
      
      sample = sample * fadeGain;

      // Clamp to -1..1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit PCM integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  // Create Blob with audio/wav MIME type for universal browser audio playback support
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function downloadBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Convert an entire AudioBuffer into a WAV Blob
export function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const frameLength = audioBuffer.length;

  const bufferLength = frameLength * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frameLength * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, frameLength * numChannels * 2, true);

  let offset = 44;
  for (let i = 0; i < frameLength; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      let sample = channelData[i] || 0;
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Multi-Segment Concatenation & Crossfade Audio Engine
export function mergeAudioSegments(
  sourceBuffer: AudioBuffer,
  segments: AudioSegment[],
  settings: MontageSettings = { crossfadeSec: 0, gapSilenceSec: 0, normalizeVolume: true }
): AudioBuffer | null {
  const activeSegments = segments.filter(
    (s) => !s.isMuted && s.endTime > s.startTime
  );

  if (activeSegments.length === 0) return null;

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;

  // Process each segment to extract samples with individual fade-in, fade-out, and gain
  const segmentDataList: {
    length: number;
    channels: Float32Array[];
  }[] = [];

  for (const seg of activeSegments) {
    const startOffset = Math.floor(Math.max(0, seg.startTime) * sampleRate);
    const endOffset = Math.min(
      sourceBuffer.length,
      Math.floor(seg.endTime * sampleRate)
    );
    const segLength = Math.max(0, endOffset - startOffset);
    if (segLength === 0) continue;

    const segDurationSec = segLength / sampleRate;
    const channels: Float32Array[] = [];

    for (let ch = 0; ch < numChannels; ch++) {
      const srcChannel = sourceBuffer.getChannelData(ch);
      const outChannel = new Float32Array(segLength);
      const gain = seg.gain ?? 1.0;

      for (let i = 0; i < segLength; i++) {
        const t = i / sampleRate;
        let fade = 1.0;

        if (seg.fadeInSec > 0 && t < seg.fadeInSec) {
          fade *= Math.max(0, Math.min(1, t / seg.fadeInSec));
        }

        const remaining = segDurationSec - t;
        if (seg.fadeOutSec > 0 && remaining < seg.fadeOutSec) {
          fade *= Math.max(0, Math.min(1, remaining / seg.fadeOutSec));
        }

        const sample = (srcChannel[startOffset + i] || 0) * gain * fade;
        outChannel[i] = sample;
      }
      channels.push(outChannel);
    }

    segmentDataList.push({ length: segLength, channels });
  }

  if (segmentDataList.length === 0) return null;

  // Calculate total merged sample length considering crossfade or gap silence
  const crossfadeSamples = Math.floor(
    Math.max(0, settings.crossfadeSec || 0) * sampleRate
  );
  const gapSamples = Math.floor(
    Math.max(0, settings.gapSilenceSec || 0) * sampleRate
  );

  let totalLength = 0;
  for (let i = 0; i < segmentDataList.length; i++) {
    const segLen = segmentDataList[i].length;
    if (i === 0) {
      totalLength += segLen;
    } else {
      if (crossfadeSamples > 0) {
        // Overlap by crossfade
        const actualCrossfade = Math.min(
          crossfadeSamples,
          segmentDataList[i - 1].length / 2,
          segLen / 2
        );
        totalLength += segLen - actualCrossfade;
      } else {
        totalLength += gapSamples + segLen;
      }
    }
  }

  const mergedBuffer = audioCtx.createBuffer(
    numChannels,
    Math.max(1, Math.floor(totalLength)),
    sampleRate
  );

  for (let ch = 0; ch < numChannels; ch++) {
    const mergedChannel = mergedBuffer.getChannelData(ch);
    let currentWritePos = 0;

    for (let segIdx = 0; segIdx < segmentDataList.length; segIdx++) {
      const currentSeg = segmentDataList[segIdx];
      const segLen = currentSeg.length;
      const segChannel = currentSeg.channels[ch];

      if (segIdx === 0) {
        mergedChannel.set(segChannel, 0);
        currentWritePos = segLen;
      } else {
        if (crossfadeSamples > 0) {
          const prevSeg = segmentDataList[segIdx - 1];
          const actualCrossfade = Math.min(
            crossfadeSamples,
            Math.floor(prevSeg.length / 2),
            Math.floor(segLen / 2)
          );

          const overlapStart = currentWritePos - actualCrossfade;

          // Crossfade region
          for (let i = 0; i < actualCrossfade; i++) {
            const progress = i / actualCrossfade;
            // Equal-power crossfade curve
            const gainIn = Math.sin((progress * Math.PI) / 2);
            const gainOut = Math.cos((progress * Math.PI) / 2);

            const outSample = mergedChannel[overlapStart + i] * gainOut;
            const inSample = segChannel[i] * gainIn;
            mergedChannel[overlapStart + i] = outSample + inSample;
          }

          // Remaining non-crossfaded part of current segment
          for (let i = actualCrossfade; i < segLen; i++) {
            mergedChannel[overlapStart + i] = segChannel[i];
          }

          currentWritePos = overlapStart + segLen;
        } else {
          // Gap silence
          currentWritePos += gapSamples;
          mergedChannel.set(segChannel, currentWritePos);
          currentWritePos += segLen;
        }
      }
    }

    // Optional Volume Normalization
    if (settings.normalizeVolume) {
      let maxPeak = 0;
      for (let i = 0; i < mergedChannel.length; i++) {
        const absVal = Math.abs(mergedChannel[i]);
        if (absVal > maxPeak) maxPeak = absVal;
      }
      if (maxPeak > 0.05 && maxPeak < 0.98) {
        const normGain = 0.95 / maxPeak;
        for (let i = 0; i < mergedChannel.length; i++) {
          mergedChannel[i] = mergedChannel[i] * normGain;
        }
      }
    }
  }

  return mergedBuffer;
}

// Utility to format byte size nicely
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Create a rich Track instance from a user-uploaded local audio file (PC / Smartphone)
export async function createTrackFromAudioFile(file: File): Promise<Track> {
  const objectUrl = URL.createObjectURL(file);
  const arrayBuffer = await file.arrayBuffer();

  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Il tuo browser non supporta Web Audio API per elaborare file audio.');
  }

  const audioCtx = new AudioCtxClass();
  let decodedBuffer: AudioBuffer;

  try {
    // Cross-browser decode supporting both Promise and legacy Callback syntax
    decodedBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      let isSettled = false;
      const result = audioCtx.decodeAudioData(
        arrayBuffer.slice(0),
        (buf) => {
          if (!isSettled) {
            isSettled = true;
            resolve(buf);
          }
        },
        (err) => {
          if (!isSettled) {
            isSettled = true;
            reject(err);
          }
        }
      );

      if (result && typeof result.then === 'function') {
        result.then(
          (buf) => {
            if (!isSettled) {
              isSettled = true;
              resolve(buf);
            }
          },
          (err) => {
            if (!isSettled) {
              isSettled = true;
              reject(err);
            }
          }
        );
      }
    });
  } catch (decodeErr) {
    console.warn('Errore decodeAudioData:', decodeErr);
    throw new Error(
      `Impossibile decodificare "${file.name}". Assicurati che sia un file audio integro e supportato (MP3, WAV, M4A, AAC, OGG, FLAC, WebM).`
    );
  } finally {
    try {
      if (audioCtx.state !== 'closed') {
        audioCtx.close();
      }
    } catch (e) {}
  }

  const durationSec = decodedBuffer.duration;
  const durationMillis = Math.round(durationSec * 1000);

  // Extract clean title and artist from filename
  const cleanBaseName = file.name.replace(/\.[^/.]+$/, '');
  const separators = [' - ', ' _ ', '–', '—', '-'];
  let artist = 'File Locale';
  let title = cleanBaseName;

  for (const sep of separators) {
    if (cleanBaseName.includes(sep)) {
      const parts = cleanBaseName.split(sep);
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        artist = parts[0].trim();
        title = parts.slice(1).join(sep).trim();
        break;
      }
    }
  }

  const extension = (file.name.split('.').pop() || 'AUDIO').toUpperCase();

  // Modern SVG artwork badge for local audio files
  const artworkSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234f46e5"/><stop offset="50%" stop-color="%237c3aed"/><stop offset="100%" stop-color="%23db2777"/></linearGradient></defs><rect width="600" height="600" rx="48" fill="url(%23bg)"/><circle cx="300" cy="300" r="160" fill="none" stroke="%23ffffff" stroke-width="12" opacity="0.35"/><circle cx="300" cy="300" r="90" fill="none" stroke="%23ffffff" stroke-width="10" opacity="0.65"/><circle cx="300" cy="300" r="36" fill="%23ffffff"/><path d="M280 230 L350 300 L280 370 Z" fill="%23ffffff"/><text x="300" y="520" text-anchor="middle" fill="%23ffffff" font-family="system-ui, sans-serif" font-weight="800" font-size="30" letter-spacing="1.5">AUDIO DISPOSITIVO</text></svg>`;

  return {
    trackId: Date.now() + Math.floor(Math.random() * 10000),
    trackName: title || file.name,
    artistName: artist,
    collectionName: `File da Dispositivo (${extension})`,
    artworkUrl100: artworkSvg,
    artworkUrl600: artworkSvg,
    releaseDate: new Date().toISOString(),
    releaseYear: new Date().getFullYear(),
    previewUrl: objectUrl,
    trackTimeMillis: durationMillis,
    primaryGenreName: `Audio ${extension}`,
    fileBlob: file,
    audioBuffer: decodedBuffer,
    isLocalFile: true,
    fileSizeFormatted: formatBytes(file.size),
    fileType: file.type || extension,
  };
}


