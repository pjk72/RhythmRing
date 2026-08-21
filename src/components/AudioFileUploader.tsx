import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Music,
  FileAudio,
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { Track } from '../types';
import { createTrackFromAudioFile, formatBytes } from '../utils/audioUtils';

interface AudioFileUploaderProps {
  onTrackUploaded: (track: Track) => void;
  compact?: boolean;
  className?: string;
}

export const AudioFileUploader: React.FC<AudioFileUploaderProps> = ({
  onTrackUploaded,
  compact = false,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTimeSec, setRecordingTimeSec] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag counter to prevent flickering on child elements
  const dragCounterRef = useRef<number>(0);

  const handleProcessFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingStatus(`Decoding "${file.name}" (${formatBytes(file.size)})...`);

        // Check if file is audio or has common audio extension
        const isAudio =
          file.type.startsWith('audio/') ||
          file.type.includes('audio') ||
          /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus|wma|aiff|alac|caf|m4r|mid|midi|mp4)$/i.test(file.name);

        if (!isAudio) {
          throw new Error(
            `The file "${file.name}" is not a supported audio file. Please select MP3, WAV, M4A, AAC, OGG, or FLAC files.`
          );
        }

        const newTrack = await createTrackFromAudioFile(file);
        onTrackUploaded(newTrack);
      }
    } catch (err: any) {
      console.error('Audio upload error:', err);
      setErrorMsg(err.message || 'Error uploading and decoding audio file.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessFiles(e.target.files);
    }
  };

  // Start Voice / Mic Recording
  const startRecording = async () => {
    setErrorMsg(null);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setErrorMsg(
        'Your browser does not support direct audio recording. Try Chrome, Safari, or Edge, or upload an audio file.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Pick best supported mimeType across Chrome, Safari, Firefox, iOS
      let options: MediaRecorderOptions = {};
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg',
        'audio/wav',
      ];

      for (const type of supportedTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
          options = { mimeType: type };
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const chosenMime = mediaRecorder.mimeType || options.mimeType || 'audio/webm';
        const ext = chosenMime.includes('mp4') || chosenMime.includes('aac') ? 'm4a' : 'webm';
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: chosenMime,
        });

        const recordedFile = new File(
          [audioBlob],
          `Voice Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${ext}`,
          { type: audioBlob.type }
        );
        await handleProcessFiles([recordedFile]);
      };

      mediaRecorder.start(250); // Collect data chunks every 250ms
      setIsRecording(true);
      setRecordingTimeSec(0);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTimeSec((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied or error:', err);
      const name = err.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
        setErrorMsg(
          'Microphone permission denied. Please click the lock icon 🔒 in your browser address bar to allow Microphone access.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorMsg('No microphone detected. Please ensure a microphone is connected to your device.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setErrorMsg('The microphone is currently in use by another application.');
      } else {
        setErrorMsg(
          `Unable to access microphone (${err.message || 'Check browser permissions'}). You can still upload audio files using the Browse Files button.`
        );
      }
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus,.aiff"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-pink-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          title="Upload an audio file from your computer or smartphone"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Decoding...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-white" />
              <span>Upload Audio File</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.opus,.aiff,.alac,.caf,.m4r,.mp4"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && !isRecording && fileInputRef.current?.click()}
        className={`relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed p-4 sm:p-6 transition-all group ${isDragging
            ? 'border-pink-500 bg-pink-950/40 scale-[1.01] shadow-2xl shadow-pink-500/20'
            : 'border-slate-700/80 hover:border-pink-500/60 bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-indigo-950/40 hover:bg-slate-900/95 shadow-xl'
          }`}
      >
        {/* Subtle Background Glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-pink-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-pink-600/20 transition-all" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-600/20 transition-all" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-105 shrink-0 ${isDragging
                  ? 'bg-gradient-to-tr from-pink-500 to-rose-400 animate-bounce'
                  : 'bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 shadow-pink-500/20'
                }`}
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
              ) : isDragging ? (
                <FolderOpen className="w-6 h-6 sm:w-7 sm:h-7" />
              ) : (
                <FileAudio className="w-6 h-6 sm:w-7 sm:h-7" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h3 className="text-white font-bold text-sm sm:text-base">
                  {isDragging ? 'Drop audio file here!' : 'Upload a Track from PC or Phone'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-extrabold border border-pink-500/30 uppercase tracking-wider">
                  Drag & Drop
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {isProcessing
                  ? processingStatus || 'Processing audio...'
                  : 'Supports MP3, WAV, M4A, AAC, OGG, FLAC, WebM, and voice recordings'}
              </p>
            </div>
          </div>

          {/* Action buttons on the right */}
          <div
            className="flex items-center gap-2 w-full sm:w-auto justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Choose file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-pink-600/25 active:scale-95 transition-all disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Browse Files</span>
            </button>

            {/* Microphone live recorder */}
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold animate-pulse shadow-md shadow-rose-600/30 active:scale-95 transition-all"
              >
                <MicOff className="w-4 h-4" />
                <span>Stop ({recordingTimeSec}s)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                title="Record a voice note with microphone"
              >
                <Mic className="w-4 h-4 text-rose-400" />
                <span className="hidden md:inline">Record Voice</span>
              </button>
            )}
          </div>
        </div>

        {/* Device Badges footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5 text-indigo-400" />
              PC & Mac
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-pink-400" />
              Android & iPhone
            </span>
          </div>
          <span className="text-slate-400 font-mono">
            Full duration with no size limits
          </span>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMsg && (
        <div className="bg-rose-950/70 border border-rose-600/50 rounded-xl p-3 flex items-start gap-2.5 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};
