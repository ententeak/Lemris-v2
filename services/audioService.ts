import { GameMode } from '../types';

// --- Configuration ---
const ASSET_PATH = '/assets/audio/'; // Assume assets are here
const THEME_FILES = {
    [GameMode.SAVE]: 'mode_save_theme.mp3',
    [GameMode.KILL]: 'mode_kill_theme.mp3',
    [GameMode.CAGE]: 'mode_cage_theme.mp3'
};
const CHOIR_FILES = {
    1: 'choir_1.mp3',
    5: 'choir_5.mp3',
    10: 'choir_10.mp3',
    15: 'choir_15.mp3',
    20: 'choir_20.mp3'
};
const SFX_FILES = {
    SPAWN: ['sfx_fall_1.mp3', 'sfx_fall_2.mp3', 'sfx_fall_3.mp3'],
    DEATH: ['sfx_die_1.mp3', 'sfx_die_2.mp3', 'sfx_die_3.mp3']
};

export class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Buffers
  private buffers: Map<string, AudioBuffer> = new Map();
  private failedLoads: Set<string> = new Set();
  
  // Active Sources
  private currentThemeSource: AudioBufferSourceNode | null = null;
  private currentChoirSource: AudioBufferSourceNode | null = null;
  private currentChoirLevel: number = 0;

  // State
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;
  
  // Game State Sync
  private currentGameMode: GameMode = GameMode.KILL;
  private currentSpeedRatio: number = 1.0;
  
  // Legacy Synth (Fallback)
  private useSynthFallback: boolean = false;
  private synthTick: number = 0;
  private synthTimeout: number | null = null;
  private nextNoteTime: number = 0;
  private scaleNotes = [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 415.30, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 830.61, 880.00];

  constructor() {
    // Context init on user interaction
  }

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
      
      this.preloadAssets();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private async preloadAssets() {
      if (!this.ctx) return;
      
      const filesToLoad = [
          ...Object.values(THEME_FILES),
          ...Object.values(CHOIR_FILES),
          ...SFX_FILES.SPAWN,
          ...SFX_FILES.DEATH
      ];

      for (const file of filesToLoad) {
          try {
              const response = await fetch(`${ASSET_PATH}${file}`);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
              this.buffers.set(file, audioBuffer);
          } catch (e) {
              console.warn(`Audio file missing or failed: ${file}. Using fallback.`);
              this.failedLoads.add(file);
          }
      }
      
      // Check if critical themes are missing, if so, enable synth globally or partially
      if (Object.values(THEME_FILES).every(f => this.failedLoads.has(f))) {
          this.useSynthFallback = true;
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

  public updateMusicState(walkingCount: number, trappedCount: number, dropSpeedMs: number) {
      // Calculate Speed Ratio (Standard speed approx 500ms, faster game = higher ratio)
      // If dropSpeedMs is 500 -> 1.0, if 250 -> 2.0
      // Clamped between 0.5 and 2.5 for sanity
      this.currentSpeedRatio = Math.max(0.5, Math.min(2.5, 500 / Math.max(100, dropSpeedMs)));
      
      if (this.useSynthFallback) {
          // Fallback logic for speed (for synth)
          // Handled inside scheduleNextNote
      } else {
          // Dynamic playback rate
          if (this.currentThemeSource) {
              this.currentThemeSource.playbackRate.setTargetAtTime(this.currentSpeedRatio, this.ctx!.currentTime, 0.5);
          }
          if (this.currentChoirSource) {
              this.currentChoirSource.playbackRate.setTargetAtTime(this.currentSpeedRatio, this.ctx!.currentTime, 0.5);
          }
      }

      // Choir Level Logic
      const totalLemmings = walkingCount + trappedCount;
      let targetChoirLevel = 0;
      if (totalLemmings >= 20) targetChoirLevel = 20;
      else if (totalLemmings >= 15) targetChoirLevel = 15;
      else if (totalLemmings >= 10) targetChoirLevel = 10;
      else if (totalLemmings >= 5) targetChoirLevel = 5;
      else if (totalLemmings >= 1) targetChoirLevel = 1;

      if (targetChoirLevel !== this.currentChoirLevel && this.isMusicPlaying) {
          this.switchChoir(targetChoirLevel);
      }
  }

  public startMusic(mode: GameMode = GameMode.KILL) {
      this.currentGameMode = mode;
      this.isMusicPlaying = true;
      
      if (this.useSynthFallback) {
          this.startSynth();
      } else {
          this.playTheme(mode);
          this.switchChoir(0); // Start check
      }
  }

  public stopMusic() {
      this.isMusicPlaying = false;
      
      // Stop Samples
      if (this.currentThemeSource) {
          try { this.currentThemeSource.stop(); } catch(e){}
          this.currentThemeSource = null;
      }
      if (this.currentChoirSource) {
          try { this.currentChoirSource.stop(); } catch(e){}
          this.currentChoirSource = null;
      }
      this.currentChoirLevel = 0;

      // Stop Synth
      if (this.synthTimeout) clearTimeout(this.synthTimeout);
  }

  private playTheme(mode: GameMode) {
      if (!this.ctx || !this.musicGain) return;
      
      const file = THEME_FILES[mode];
      const buffer = this.buffers.get(file);

      if (!buffer) {
          // If specific theme missing, try synth
          this.useSynthFallback = true;
          this.startSynth();
          return;
      }

      if (this.currentThemeSource) { try { this.currentThemeSource.stop(); } catch(e){} }

      this.currentThemeSource = this.ctx.createBufferSource();
      this.currentThemeSource.buffer = buffer;
      this.currentThemeSource.loop = true;
      this.currentThemeSource.playbackRate.value = this.currentSpeedRatio;
      this.currentThemeSource.connect(this.musicGain);
      this.currentThemeSource.start();
  }

  private switchChoir(level: number) {
      if (!this.ctx || !this.musicGain || this.useSynthFallback) return;
      if (level === this.currentChoirLevel) return;
      
      // Fade out old
      if (this.currentChoirSource) {
          const oldSource = this.currentChoirSource;
          // Create a dedicated fade-out gain for the old source
          const fadeGain = this.ctx.createGain();
          fadeGain.gain.value = 1.0;
          oldSource.disconnect();
          oldSource.connect(fadeGain);
          fadeGain.connect(this.musicGain);
          fadeGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
          setTimeout(() => { try{ oldSource.stop(); }catch(e){} }, 550);
      }

      this.currentChoirLevel = level;
      if (level === 0) {
          this.currentChoirSource = null;
          return;
      }

      // @ts-ignore
      const file = CHOIR_FILES[level];
      const buffer = this.buffers.get(file);

      if (buffer) {
          const newSource = this.ctx.createBufferSource();
          newSource.buffer = buffer;
          newSource.loop = true;
          newSource.playbackRate.value = this.currentSpeedRatio;
          
          // Fade in
          const fadeGain = this.ctx.createGain();
          fadeGain.gain.value = 0;
          newSource.connect(fadeGain);
          fadeGain.connect(this.musicGain);
          fadeGain.gain.linearRampToValueAtTime(1.0, this.ctx.currentTime + 0.5);
          
          newSource.start();
          this.currentChoirSource = newSource;
          
          // Reconnect to main chain after fade (optimization)
          setTimeout(() => {
             if (this.currentChoirSource === newSource && this.musicGain) {
                 fadeGain.disconnect();
                 newSource.disconnect();
                 newSource.connect(this.musicGain);
             }
          }, 600);
      }
  }

  // --- SFX ---
  
  public playRandomSfx(type: 'SPAWN' | 'DEATH') {
      if (!this.ctx || this.isMuted || !this.sfxGain) return;
      
      const list = SFX_FILES[type];
      const file = list[Math.floor(Math.random() * list.length)];
      const buffer = this.buffers.get(file);

      if (buffer) {
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          // Randomize pitch slightly
          source.playbackRate.value = 0.9 + Math.random() * 0.2; 
          source.connect(this.sfxGain);
          source.start();
      } else {
          // Fallback
          if (type === 'SPAWN') this.playSynthSpawn();
          else this.playSynthSquish();
      }
  }

  // Wrappers
  public playDrop() { this.playTone(150, 'triangle', 0.1); }
  public playMove() { this.playTone(400, 'square', 0.05, 0, 0.3); }
  public playRotate() { this.playTone(600, 'square', 0.05, 0, 0.3); }
  public playLand() { this.playTone(100, 'sawtooth', 0.15, 0, 0.8); }
  public playLemmingSpawn() { this.playRandomSfx('SPAWN'); }
  public playSquish() { this.playRandomSfx('DEATH'); }
  
  public playLineClear(isTetris: boolean = false) {
    if (isTetris) { this.playTone(523.25, 'square', 0.1, 0); this.playTone(659.25, 'square', 0.1, 0.1); this.playTone(783.99, 'square', 0.1, 0.2); this.playTone(1046.50, 'square', 0.4, 0.3); } 
    else { this.playTone(523.25, 'square', 0.1, 0); this.playTone(783.99, 'square', 0.2, 0.1); }
  }
  public playQuestComplete() {
    const start = 0; this.playTone(440, 'triangle', 0.1, start); this.playTone(554, 'triangle', 0.1, start + 0.1); this.playTone(659, 'triangle', 0.1, start + 0.2); this.playTone(880, 'square', 0.4, start + 0.3, 0.6);
  }
  public playGameOver() {
    this.stopMusic();
    if (!this.ctx || this.isMuted || !this.sfxGain) return;
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

  // --- Synth Fallback Logic (Legacy) ---

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

  private playSynthSpawn() {
    if (!this.ctx || this.isMuted || !this.sfxGain) return;
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

  private playSynthSquish() {
    if (!this.ctx || this.isMuted || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
    this.playTone(80, 'sawtooth', 0.2);
  }

  private startSynth() {
    this.synthTick = 0;
    this.nextNoteTime = this.ctx?.currentTime || 0;
    this.scheduleNextNote();
  }

  private scheduleNextNote() {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;
    // Base tempo ~130, multiplied by speed ratio
    const tempo = 130 * this.currentSpeedRatio;
    const secondsPer16th = (60.0 / tempo) / 4;
    
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playSynthStep(this.nextNoteTime);
      this.nextNoteTime += secondsPer16th; 
      this.synthTick++;
    }
    this.synthTimeout = window.setTimeout(() => this.scheduleNextNote(), 25);
  }

  private playSynthStep(time: number) {
      // Simplified melodic walker from previous version
      if (!this.ctx || this.isMuted || !this.musicGain) return;
      
      // Bass on beats
      const step = this.synthTick % 16;
      if (step % 4 === 0) {
          const freq = (step === 4 || step === 12) ? 329.63 : 220.00; // E or A
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle'; osc.frequency.value = freq / 2;
          osc.connect(gain); gain.connect(this.musicGain);
          gain.gain.setValueAtTime(0.2, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          osc.start(time); osc.stop(time + 0.2);
      }
      
      // Melody walker
      if (step % 2 === 0 && Math.random() > 0.4) {
          const note = this.scaleNotes[Math.floor(Math.random() * this.scaleNotes.length)];
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square'; osc.frequency.value = note;
          osc.connect(gain); gain.connect(this.musicGain);
          gain.gain.setValueAtTime(0.05, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
          osc.start(time); osc.stop(time + 0.1);
      }
  }
}

export const audioController = new AudioController();