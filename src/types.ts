export interface Track {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  artworkUrl600: string;
  releaseDate: string;
  releaseYear: number;
  previewUrl: string;
  trackTimeMillis: number;
  primaryGenreName: string;
  trackViewUrl?: string;
  fileBlob?: Blob;
  audioBuffer?: AudioBuffer;
  isLocalFile?: boolean;
  fileSizeFormatted?: string;
  fileType?: string;
}


export interface RhythmAnalysis {
  bpm: number;
  tempoName: string; // e.g. "Allegro (128 BPM)", "Moderato (105 BPM)"
  timeSignature: string; // "4/4"
  energyLevel: 'Low' | 'Medium' | 'High' | 'Very High' | 'Bassa' | 'Media' | 'Alta' | 'Molto Alta';
  rhythmGraph: { timeSec: number; energy: number; beatPulse: number }[];
}

export interface KeyAnalysis {
  key: string; // e.g. "A Minor", "C Major"
  camelotKey: string; // e.g. "8A", "8B"
  mode: 'Major' | 'Minor' | 'Maggiore' | 'Minore';
  chromaGraph: { note: string; intensity: number; isDominant: boolean }[];
  harmonicProfile: string;
}

export interface SavedRingtone {
  id: string;
  trackId: number;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  startTime: number;
  endTime: number;
  durationSec: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  createdAt: string;
  audioBlobUrl?: string;
  bpm: number;
  keyNote: string;
  previewUrl?: string;
}

export interface AudioSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  fadeInSec: number;
  fadeOutSec: number;
  color: string;
  gain: number;
  isMuted?: boolean;
}

export interface AudioMarker {
  id: string;
  timeSec: number;
  label: string;
  color: string;
}

export interface MontageSettings {
  crossfadeSec: number;
  gapSilenceSec: number;
  normalizeVolume: boolean;
}

