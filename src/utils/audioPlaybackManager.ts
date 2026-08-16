type StopCallback = () => void;

class AudioPlaybackManager {
  private currentStopCallback: StopCallback | null = null;
  private currentSourceId: string | null = null;

  /**
   * Register and start a new audio playback, automatically stopping any other active playback.
   */
  play(sourceId: string, stopCallback: StopCallback) {
    // If something else was playing, stop it immediately
    if (this.currentSourceId !== sourceId && this.currentStopCallback) {
      try {
        this.currentStopCallback();
      } catch (e) {
        console.warn('Error stopping previous audio playback:', e);
      }
    }

    this.currentSourceId = sourceId;
    this.currentStopCallback = stopCallback;
  }

  /**
   * Stop playback for a specific source ID.
   */
  stop(sourceId?: string) {
    if (!sourceId || this.currentSourceId === sourceId) {
      this.currentStopCallback = null;
      this.currentSourceId = null;
    }
  }

  /**
   * Stop all active audios across the application.
   */
  stopAll() {
    if (this.currentStopCallback) {
      try {
        this.currentStopCallback();
      } catch (e) {
        console.warn('Error in stopAll audio:', e);
      }
      this.currentStopCallback = null;
    }
    this.currentSourceId = null;

    // Trigger custom window event for any HTMLAudioElements or detached sources
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('global-audio-stop'));
    }
  }
}

export const globalAudioManager = new AudioPlaybackManager();
