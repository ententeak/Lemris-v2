// Simple Web Audio API Synthesizer for 8-bit effects and music

export class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Choir System
  private choirGain: GainNode | null = null;
  private choirFilter: BiquadFilterNode | null = null;
  private choirVoices: OscillatorNode[] = [];
  private choirVoiceGains: GainNode[] = [];
  private shockEndTime: number = 0; // Timestamp when shock ends

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicTimeout: number | null = null;
  private nextNoteTime: number = 0;
  
  // Volume levels (0.0 - 1.0)
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;

  // Music State
  private noteIndex: number = 0;
  private baseTempo: number = 135; // BPM (Happy vibe)
  private currentTempo: number = 135;
  private lemmingIntensity: number = 0; // 0 to 1
  private lemmingCount: number = 0;
  
  // Scales (frequencies in Hz) - C Major / Happy upbeat
  // Bass Progression: C - G - A - F (I - V - vi - IV)
  private bassScale = [130.81, 98.00, 110.00, 87.31]; 
  // Lead: C Major Pentatonic (C5, D5, E5, G5, A5, C6)
  private leadScale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; 

  constructor() {
    // Context is initialized on first user interaction to comply with browser policies
  }

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

      // Choir Channel setup
      this.choirGain = this.ctx.createGain();
      this.choirGain.gain.value = 0; // Starts silent
      
      // Filter to make the choir sound like "humming" (Ooo/Aaa vowel)
      this.choirFilter = this.ctx.createBiquadFilter();
      this.choirFilter.type = 'lowpass';
      this.choirFilter.frequency.value = 600; 
      this.choirFilter.Q.value = 1.0; // Bit of resonance for vowel-like quality

      this.choirGain.connect(this.choirFilter);
      this.choirFilter.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 1.0;
    }
    return this.isMuted;
  }

  public setMusicVolume(val: number) {
      this.musicVolume = Math.max(0, Math.min(1, val));
      if (this.musicGain) {
          this.musicGain.gain.value = this.musicVolume;
      }
      // Choir volume is linked to music volume but slightly quieter
      if (this.choirGain) {
          this.choirGain.gain.cancelScheduledValues(0);
          this.choirGain.gain.value = this.musicVolume * 0.6; 
      }
  }

  public setSfxVolume(val: number) {
      this.sfxVolume = Math.max(0, Math.min(1, val));
      if (this.sfxGain) {
          this.sfxGain.gain.value = this.sfxVolume;
      }
  }

  public getMusicVolume() { return this.musicVolume; }
  public getSfxVolume() { return this.sfxVolume; }

  // --- Sound Effects ---

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, vol: number = 1) {
    if (!this.ctx || this.isMuted || !this.sfxGain) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
    
    gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);
    
    osc.connect(gain);
    gain.connect(this.sfxGain); // Connect to SFX channel
    
    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  private playNoise(duration: number) {
    if (!this.ctx || this.isMuted || !this.sfxGain) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(gain);
    gain.connect(this.sfxGain); // Connect to SFX channel
    noise.start();
  }

  // Public SFX Methods
  public playDrop() {
    this.playTone(150, 'triangle', 0.1);
  }

  public playMove() {
    this.playTone(400, 'square', 0.05, 0, 0.3);
  }

  public playRotate() {
    this.playTone(600, 'square', 0.05, 0, 0.3);
  }

  public playLand() {
    this.playTone(100, 'sawtooth', 0.15, 0, 0.8);
  }

  public playLemmingSpawn() {
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

  public playSquish() {
    this.playNoise(0.2);
    this.playTone(80, 'sawtooth', 0.2);
    // Trigger choir shock (silence)
    this.triggerChoirShock();
  }

  private triggerChoirShock() {
    if (!this.ctx || !this.choirGain) return;
    // Silence for 1.5 seconds
    this.shockEndTime = this.ctx.currentTime + 1.5;
    
    // Immediate silence
    this.choirGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.choirGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  public playLineClear(isTetris: boolean = false) {
    if (isTetris) {
      this.playTone(523.25, 'square', 0.1, 0); // C
      this.playTone(659.25, 'square', 0.1, 0.1); // E
      this.playTone(783.99, 'square', 0.1, 0.2); // G
      this.playTone(1046.50, 'square', 0.4, 0.3); // High C
    } else {
      this.playTone(523.25, 'square', 0.1, 0);
      this.playTone(783.99, 'square', 0.2, 0.1);
    }
  }

  public playQuestComplete() {
    const start = 0;
    this.playTone(440, 'triangle', 0.1, start);
    this.playTone(554, 'triangle', 0.1, start + 0.1);
    this.playTone(659, 'triangle', 0.1, start + 0.2);
    this.playTone(880, 'square', 0.4, start + 0.3, 0.6);
  }

  public playGameOver() {
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
    this.stopChoir();
  }

  // --- Procedural Music Engine ---

  public updateMusicState(lemmingCount: number, dropSpeedMs: number) {
    this.lemmingCount = lemmingCount;
    this.lemmingIntensity = Math.min(lemmingCount / 15, 1);
    const speedFactor = Math.max(0, (800 - dropSpeedMs) / 700);
    this.currentTempo = this.baseTempo + (speedFactor * 60);
    
    // Update Choir volume
    if (this.choirGain && this.ctx) {
        if (this.ctx.currentTime < this.shockEndTime) {
            // Still in shock - keep silent
            this.choirGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        } else {
            // Normal operation
            const volumeScale = Math.min(1, lemmingCount / 4); // Full choir at 4 lemmings
            const targetVol = volumeScale * (this.musicVolume * 0.4);
            this.choirGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.5);
        }
    }
  }

  public startMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.noteIndex = 0;
    this.nextNoteTime = this.ctx?.currentTime || 0;
    
    this.startChoir();
    this.scheduleNextNote();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimeout) {
      window.clearTimeout(this.musicTimeout);
    }
    this.stopChoir();
  }

  // --- Choir Logic ---
  private startChoir() {
      if (!this.ctx || !this.choirGain) return;
      this.stopChoir(); // Clear existing

      // Create 3 voices for harmony
      for (let i = 0; i < 3; i++) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'triangle'; // Soft hum
          gain.gain.value = 0; // Controlled dynamically

          osc.connect(gain);
          gain.connect(this.choirGain);
          osc.start();

          this.choirVoices.push(osc);
          this.choirVoiceGains.push(gain);
      }
  }

  private stopChoir() {
      this.choirVoices.forEach(v => {
          try { v.stop(); } catch(e) {}
          v.disconnect();
      });
      this.choirVoiceGains.forEach(g => g.disconnect());
      this.choirVoices = [];
      this.choirVoiceGains = [];
  }

  // Calculate allowable notes for the current chord
  private updateChoirMelody(bassFreq: number, chordIndex: number) {
      if (!this.ctx || this.choirVoices.length < 3) return;
      
      // If we are in shock, don't update notes, just wait
      if (this.ctx.currentTime < this.shockEndTime) return;

      const time = this.ctx.currentTime;
      const isMinor = chordIndex === 2; // A Minor
      
      const root = bassFreq * 2; // Octave up from bass
      const thirdRatio = isMinor ? 1.189 : 1.2599; 
      const fifthRatio = 1.498;
      const octaveRatio = 2.0;

      // Available notes for the current chord
      const allowedNotes = [
          root, 
          root * thirdRatio, 
          root * fifthRatio, 
          root * octaveRatio
      ];

      // Voice logic
      this.choirVoices.forEach((osc, i) => {
          // Probability to change note. Lower = more legato/stable.
          // Reduced from 0.3+ to 0.15 to avoid "meluzina" (wailing) effect
          const moveChance = 0.15 + (i * 0.05); 
          
          // Force note change on chord change (beat 0) if voice isn't matching harmony
          const isChordChange = this.noteIndex % 16 === 0;

          if (isChordChange || Math.random() < moveChance) {
             let noteIdx = 0;
             // Voices cover different ranges
             if (i === 0) noteIdx = Math.floor(Math.random() * 2); // Root, Third
             if (i === 1) noteIdx = Math.floor(Math.random() * 2) + 1; // Third, Fifth
             if (i === 2) noteIdx = Math.floor(Math.random() * 2) + 2; // Fifth, Octave
             
             noteIdx = Math.min(noteIdx, allowedNotes.length - 1);
             const targetFreq = allowedNotes[noteIdx];

             // Faster glide (0.05) to sound like a note change, not a siren
             osc.frequency.setTargetAtTime(targetFreq, time, 0.08);
          }
      });

      // Dynamic mixing based on Lemming Count
      const v1Target = this.lemmingCount > 0 ? 0.3 : 0;
      const v2Target = this.lemmingCount > 3 ? 0.25 : 0;
      const v3Target = this.lemmingCount > 6 ? 0.2 : 0;

      // Soft attack/release for voices
      this.choirVoiceGains[0].gain.setTargetAtTime(v1Target, time, 0.2);
      this.choirVoiceGains[1].gain.setTargetAtTime(v2Target, time, 0.2);
      this.choirVoiceGains[2].gain.setTargetAtTime(v3Target, time, 0.2);
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

    // Bass changes every 4 beats (16 sixteenth notes)
    const chordIndex = Math.floor((this.noteIndex / 16) % this.bassScale.length);
    const bassNote = this.bassScale[chordIndex];

    // Update Choir Melody every beat (every 4 sixteenth notes)
    if (this.noteIndex % 4 === 0) {
        this.updateChoirMelody(bassNote, chordIndex);
    }

    // Bass (Quarter notes)
    if (this.noteIndex % 4 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle'; 
      osc.frequency.value = bassNote;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300 + (this.lemmingIntensity * 500);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      gain.gain.setValueAtTime(0.25, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

      osc.start(time);
      osc.stop(time + 0.25);
    }

    // Lead
    const playProb = 0.4 + (this.lemmingIntensity * 0.4);
    if (Math.random() < playProb) {
       const note = this.leadScale[Math.floor(Math.random() * this.leadScale.length)];
       
       const osc = this.ctx.createOscillator();
       const gain = this.ctx.createGain();
       osc.type = 'square';
       osc.frequency.value = note * (Math.random() > 0.9 ? 2 : 1); 

       gain.gain.setValueAtTime(0.04, time);
       gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

       osc.connect(gain);
       gain.connect(this.musicGain);
       
       osc.start(time);
       osc.stop(time + 0.12);
    }
  }
}

export const audioController = new AudioController();