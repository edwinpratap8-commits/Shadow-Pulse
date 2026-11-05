/**
 * Web Audio API procedural sound synthesizer and haptic vibration manager.
 * No external audio files needed; guarantees instant response and zero network load.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on first user gesture
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shadowpulse_sound');
      if (stored !== null) {
        this.soundEnabled = stored === 'true';
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('shadowpulse_sound', enabled ? 'true' : 'false');
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Subtle radar blip sound for safe cycle sweep
   */
  public playRadarBlip() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Urgent warning beep (for 30s countdown)
   */
  public playWarningBeep(pitch: number = 700) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.2, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore audio error
    }
  }

  /**
   * High-priority tactical reveal alarm (when 10-second live flash begins)
   */
  public playRevealAlarm() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two-tone piercing ping
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.35); // E6

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(523.25, now);
      osc2.frequency.linearRampToValueAtTime(659.25, now + 0.35);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } catch {
      // Ignore audio error
    }
  }

  /**
   * Sound when a player is marked as Found
   */
  public playFoundChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore audio error
    }
  }

  /**
   * Fanfare on game victory
   */
  public playVictoryFanfare() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const startTime = ctx.currentTime + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {
      // Ignore audio error
    }
  }

  /**
   * Haptic vibration trigger
   */
  public triggerVibration(pattern: number[] = [200, 100, 200]) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration restrictions
      }
    }
  }
}

export const soundManager = new SoundManager();
