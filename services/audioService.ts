
// Simple Web Audio API Synthesizer for 8-bit effects and music

export class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicTimeout: number | null = null;
  private nextNoteTime: number = 0;
  
  // Volume levels (0.0 - 1.0)
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;

  // Music State
  private noteIndex: number = 0;
  private baseTempo: number = 120; // BPM
  private currentTempo: number = 120;
  private lemmingIntensity: number = 0; // 0 to 1, affects filter/brightness
  
  // Scales (frequencies in Hz)
  private bassScale = [110, 110, 146.83, 130.81]; // A2, A2, D3, C3 loop
  private leadScale = [440, 523.25, 587.33, 659.25, 783.99, 880]; // A Minor Pentatonic

  constructor() {}

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      // Create separate channels
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMusicVolume(val: number) {
      this.musicVolume = Math.max(0, Math.min(1, val));
      if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
  }

  public setSfxVolume(val: number) {
      this.sfxVolume = Math.max(0, Math.min(1, val));
      if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, vol: number = 1) {
    if (!this.ctx || this.isMuted || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  private playNoise(duration: number) {
    if (!this.ctx || this.isMuted || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  public playDrop() { this.playTone(150, 'triangle', 0.1); }
  public playMove() { this.playTone(400, 'square', 0.05, 0, 0.3); }
  public playRotate() { this.playTone(600, 'square', 0.05, 0, 0.3); }
  public playLand() { this.playTone(100, 'sawtooth', 0.15, 0, 0.8); }
  public playLemmingSpawn() {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
  public playSquish() { this.playNoise(0.2); this.playTone(80, 'sawtooth', 0.2); }
  public playLineClear(isTetris: boolean = false) {
    if (isTetris) {
      this.playTone(523.25, 'square', 0.1, 0);
      this.playTone(659.25, 'square', 0.1, 0.1);
      this.playTone(783.99, 'square', 0.1, 0.2);
      this.playTone(1046.50, 'square', 0.4, 0.3);
    } else {
      this.playTone(523.25, 'square', 0.1, 0);
      this.playTone(783.99, 'square', 0.2, 0.1);
    }
  }
  public playQuestComplete() {
    this.playTone(440, 'triangle', 0.1, 0);
    this.playTone(554, 'triangle', 0.1, 0.1);
    this.playTone(659, 'triangle', 0.1, 0.2);
    this.playTone(880, 'square', 0.4, 0.3, 0.6);
  }
  public playGameOver() {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
  }

  public updateMusicState(lemmingCount: number, dropSpeedMs: number) {
    this.lemmingIntensity = Math.min(lemmingCount / 15, 1);
    const speedFactor = Math.max(0, (800 - dropSpeedMs) / 700);
    this.currentTempo = 100 + (speedFactor * 80);
  }

  public startMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.noteIndex = 0;
    this.nextNoteTime = this.ctx?.currentTime || 0;
    this.scheduleNextNote();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimeout) window.clearTimeout(this.musicTimeout);
  }

  public stopAll() {
    this.stopMusic();
    if (this.ctx) {
      // Create a small fade out to avoid clicks
      this.masterGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      setTimeout(() => {
        if (this.masterGain) this.masterGain.gain.value = 1.0;
      }, 100);
    }
  }

  private scheduleNextNote() {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;
    const secondsPerBeat = 60.0 / this.currentTempo;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playMusicStep(this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat / 4; 
      this.noteIndex++;
    }
    this.musicTimeout = window.setTimeout(() => this.scheduleNextNote(), 25);
  }

  private playMusicStep(time: number) {
    if (!this.ctx || this.isMuted || !this.musicGain) return;
    if (this.noteIndex % 4 === 0) {
      const bassNote = this.bassScale[Math.floor((this.noteIndex / 16) % this.bassScale.length)];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.value = bassNote;
      filter.type = 'lowpass';
      filter.frequency.value = 200 + (this.lemmingIntensity * 400);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      osc.start(time);
      osc.stop(time + 0.2);
    }
    const playProb = 0.3 + (this.lemmingIntensity * 0.5);
    if (Math.random() < playProb) {
       const note = this.leadScale[Math.floor(Math.random() * this.leadScale.length)];
       const osc = this.ctx.createOscillator();
       const gain = this.ctx.createGain();
       osc.type = 'triangle';
       osc.frequency.value = note * (Math.random() > 0.8 ? 2 : 1); 
       gain.gain.setValueAtTime(0.05, time);
       gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
       osc.connect(gain);
       gain.connect(this.musicGain);
       osc.start(time);
       osc.stop(time + 0.1);
    }
  }
}

export const audioController = new AudioController();
