import { Track, RhythmAnalysis, KeyAnalysis, AudioSegment, MontageSettings } from '../types';

// iTunes Search API call
export async function searchITunesSongs(searchTerm: string): Promise<Track[]> {
  if (!searchTerm.trim()) return [];

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm
      )}&entity=song&limit=30`
    );

    if (!response.ok) {
      throw new Error(`Errore nella ricerca: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.results.map((item: any) => {
      const year = item.releaseDate
        ? new Date(item.releaseDate).getFullYear()
        : 2020;
      
      const artwork600 = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80';

      return {
        trackId: item.trackId,
        trackName: item.trackName || 'Senza Titolo',
        artistName: item.artistName || 'Artista Sconosciuto',
        collectionName: item.collectionName || 'Album Singolo',
        artworkUrl100: item.artworkUrl100 || artwork600,
        artworkUrl600: artwork600,
        releaseDate: item.releaseDate || '',
        releaseYear: isNaN(year) ? 2022 : year,
        previewUrl: item.previewUrl || '',
        trackTimeMillis: item.trackTimeMillis || 30000,
        primaryGenreName: item.primaryGenreName || 'Musica',
        trackViewUrl: item.trackViewUrl,
      };
    });
  } catch (error) {
    console.warn('iTunes API fallita, utilizzo dataset di riserva:', error);
    return getFallbackSongs(searchTerm);
  }
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
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        searchTerm
      )}&entity=song&limit=50`
    );

    if (!response.ok) {
      throw new Error(`Errore HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return fallbackArtists;
    }

    const seenArtists = new Set<string>();
    const artists: DynamicChartArtist[] = [];

    for (const item of data.results) {
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
  } catch (err) {
    console.warn('Impossibile verificare la classifica dinamica via API, uso fallback:', err);
    return fallbackArtists;
  }
}

// Fallback curated dataset for instant testing reflecting current global charts
export function getFallbackSongs(query: string = ''): Track[] {
  const dataset: Track[] = [
    {
      trackId: 101,
      trackName: 'Espresso',
      artistName: 'Sabrina Carpenter',
      collectionName: 'Short n\' Sweet',
      artworkUrl100: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2024-04-11',
      releaseYear: 2024,
      previewUrl: '',
      trackTimeMillis: 175000,
      primaryGenreName: 'Pop',
    },
    {
      trackId: 102,
      trackName: 'BIRDS OF A FEATHER',
      artistName: 'Billie Eilish',
      collectionName: 'HIT ME HARD AND SOFT',
      artworkUrl100: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2024-05-17',
      releaseYear: 2024,
      previewUrl: '',
      trackTimeMillis: 194000,
      primaryGenreName: 'Alternative Pop',
    },
    {
      trackId: 103,
      trackName: 'Die With A Smile',
      artistName: 'Lady Gaga & Bruno Mars',
      collectionName: 'Die With A Smile - Single',
      artworkUrl100: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2024-08-16',
      releaseYear: 2024,
      previewUrl: '',
      trackTimeMillis: 251000,
      primaryGenreName: 'Pop / Soul',
    },
    {
      trackId: 104,
      trackName: 'Blinding Lights',
      artistName: 'The Weeknd',
      collectionName: 'After Hours',
      artworkUrl100: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2019-11-29',
      releaseYear: 2019,
      previewUrl: '',
      trackTimeMillis: 200000,
      primaryGenreName: 'Synthwave / Pop',
    },
    {
      trackId: 105,
      trackName: 'Cruel Summer',
      artistName: 'Taylor Swift',
      collectionName: 'Lover',
      artworkUrl100: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2019-08-23',
      releaseYear: 2019,
      previewUrl: '',
      trackTimeMillis: 178000,
      primaryGenreName: 'Pop',
    },
    {
      trackId: 106,
      trackName: 'Beggin\'',
      artistName: 'Måneskin',
      collectionName: 'Chosen',
      artworkUrl100: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2017-12-08',
      releaseYear: 2017,
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/bf/f4/3e/bff43e11-e41c-32e6-a249-f0270a3c9e68/mzaf_13506841314343160410.plus.aac.p.m4a',
      trackTimeMillis: 211000,
      primaryGenreName: 'Rock/Alternative',
    },
    {
      trackId: 107,
      trackName: 'Viva La Vida',
      artistName: 'Coldplay',
      collectionName: 'Viva La Vida or Death and All His Friends',
      artworkUrl100: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&q=80',
      artworkUrl600: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80',
      releaseDate: '2008-06-12',
      releaseYear: 2008,
      previewUrl: '',
      trackTimeMillis: 242000,
      primaryGenreName: 'Alternative Rock',
    }
  ];

  if (!query) return dataset;
  const q = query.toLowerCase();
  return dataset.filter(
    (s) =>
      s.artistName.toLowerCase().includes(q) ||
      s.trackName.toLowerCase().includes(q) ||
      s.collectionName.toLowerCase().includes(q)
  );
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

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let decodedBuffer: AudioBuffer;

  try {
    // Slice to avoid detached buffer issues in some browser engines
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (decodeErr) {
    console.warn('Errore decodeAudioData:', decodeErr);
    throw new Error(
      'Impossibile decodificare il file audio. Assicurati che sia un formato audio supportato (MP3, WAV, M4A, AAC, OGG, FLAC).'
    );
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


