// FastArt High-Performance Playhead Coordinator
// Provides sub-pixel, 60-120 FPS timeline playhead updates directly to DOM & native elements.
// Eliminates choppy 42ms stutter and big discrete jumps during timeline playback.

type PlayheadListener = (time: number) => void;

class PlayheadCoordinator {
  private listeners = new Set<PlayheadListener>();
  private currentTime = 0;

  public subscribe(fn: PlayheadListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  public notify(time: number): void {
    this.currentTime = time;
    this.listeners.forEach((fn) => {
      try {
        fn(time);
      } catch (err) {
        console.warn("[playheadCoordinator] Listener error:", err);
      }
    });
  }

  public getTime(): number {
    return this.currentTime;
  }
}

export const playheadCoordinator = new PlayheadCoordinator();
