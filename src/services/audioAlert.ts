// Native Web Audio API Industrial Safety Chime / Alert Synthesizer
class SoundAlertService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private alarmInterval: any = null;
  private isContinuousAlarmRunning: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopContinuousAlarm();
    }
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  // Dual tone industrial safety alert (880Hz / 440Hz pulse)
  public playCriticalAlert(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      // Alarm frequency modulation
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.2);
      osc.frequency.setValueAtTime(850, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.45);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Continuous pulsating siren for manual or critical alarm
  public startContinuousAlarm(): void {
    if (this.isContinuousAlarmRunning) return;
    this.isContinuousAlarmRunning = true;
    this.playCriticalAlert();
    this.alarmInterval = setInterval(() => {
      if (this.isContinuousAlarmRunning && !this.isMuted) {
        this.playCriticalAlert();
      }
    }, 700);
  }

  public stopContinuousAlarm(): void {
    this.isContinuousAlarmRunning = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  public isAlarmPlaying(): boolean {
    return this.isContinuousAlarmRunning;
  }

  // Soft technological ping for acknowledgment or status change
  public playFeedbackBeep(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignore audio policy restriction
    }
  }
}

export const soundAlert = new SoundAlertService();
