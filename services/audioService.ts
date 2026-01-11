// Simple Web Audio API Synthesizer for 8-bit effects and music

export class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  // Choir System (Free Lemmings)
  private choirGain: GainNode | null = null;
  private choirFilter: BiquadFilterNode | null = null;
  private choirVoices: OscillatorNode[] = [];
  private choirVoiceGains: GainNode[] = [];

  // Trapped Choir System (Caged Lemmings)
  private trappedGain: GainNode | null = null;
  private trappedFilter: BiquadFilterNode | null = null;
  private trappedVoices: OscillatorNode[] = [];
  private trappedVoiceGains: GainNode[] = [];
  private vibratoLfo: OscillatorNode | null = null;
  private vibratoGain: GainNode | null = null;

  private shockEndTime: number = 0; // Timestamp when shock ends

  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicTimeout: number | null = null;
  private nextNoteTime: number = 0;
  
  // Volume levels (0.0 - 1.0)
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;

  // Music State
  private tick: number = 0; // Global 16th note counter
  private baseTempo: number = 130; // BPM (Polka speed)
  private currentTempo: number = 130;
  private lemmingIntensity: number = 0; // 0 to 1
  private lemmingCount: number = 0;
  private trappedCount: number = 0;

  // --- Musical Definitions (A Harmonic Minor) ---
  // A, B, C, D, E, F, G# (Harmonic Minor gives that "Tetris/Russian" feel)
  private scaleNotes = [
      220.00, // A3
      246.94, // B3
      261.63, // C4
      293.66, // D4
      329.63, // E4
      349.23, // F4
      415.30, // G#4
      440.00, // A4
      493.88, // B4
      523.25, // C5
      587.33, // D5
      659.25, // E5
      698.46, // F5
      830.61, // G#5
      880.00  // A5
  ];

  // Chord Progressions (Indices in A Harmonic Minor: 0=Am, 3=Dm, 4=E major)
  // 1 = Am, 4 = Dm, 5 = E (Dominant)
  // We use a 16-bar folk structure
  private progression = [
      0, 0, 4, 4, // Am, Am, E, E
      0, 0, 4, 0, // Am, Am, E, Am
      3, 3, 0, 0, // Dm, Dm, Am, Am
      4, 4, 0, 0  // E, E, Am, Am
  ];

  // For melody generation walker
  private lastNoteIndex: number = 7; // Start at middle A

  constructor() {
    // Context is initialized on first user interaction
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

      // --- Main Choir ---
      this.choirGain = this.ctx.createGain();
      this.choirGain.gain.value = 0;
      this.choirFilter = this.ctx.createBiquadFilter();
      this.choirFilter.type = 'lowpass';
      this.choirFilter.frequency.value = 600; 
      this.choirFilter.Q.value = 1.0; 
      this.choirGain.connect(this.choirFilter);
      this.choirFilter.connect(this.masterGain);

      // --- Trapped Choir ---
      this.trappedGain = this.ctx.createGain();
      this.trappedGain.gain.value = 0;
      this.trappedFilter = this.ctx.createBiquadFilter();
      this.trappedFilter.type = 'bandpass';
      this.trappedFilter.frequency.value = 1000; 
      this.trappedFilter.Q.value = 1.5; 
      this.trappedGain.connect(this.trappedFilter);
      this.trappedFilter.connect(this.masterGain);

      this.vibratoLfo = this.ctx.createOscillator();
      this.vibratoLfo.frequency.value = 6.0; 
      this.vibratoGain = this.ctx.createGain();
      this.vibratoGain.gain.value = 10.0; 
      this.vibratoLfo.connect(this.vibratoGain);
      this.vibratoLfo.start();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) this.masterGain.gain.value = this.isMuted ? 0 : 1.0;
    return this.isMuted;
  }

  public setMusicVolume(val: number) {
      this.musicVolume = Math.max(0, Math.min(1, val));
      if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
      
      if (this.choirGain) {
          this.choirGain.gain.cancelScheduledValues(0);
          this.choirGain.gain.value = this.musicVolume * 0.6; 
      }
      if (this.trappedGain) {
          this.trappedGain.gain.cancelScheduledValues(0);
          this.trappedGain.gain.value = this.musicVolume * 0.5; 
      }
  }

  public setSfxVolume(val: number) {
      this.sfxVolume = Math.max(0, Math.min(1, val));
      if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  // --- Sound Effects (Unchanged) ---
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
    this.triggerChoirShock();
  }

  private triggerChoirShock() {
    if (!this.ctx || !this.choirGain) return;
    this.shockEndTime = this.ctx.currentTime + 1.5;
    if (this.choirGain) { this.choirGain.gain.cancelScheduledValues(this.ctx.currentTime); this.choirGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
    if (this.trappedGain) { this.trappedGain.gain.cancelScheduledValues(this.ctx.currentTime); this.trappedGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); }
  }

  public playLineClear(isTetris: boolean = false) {
    if (isTetris) { this.playTone(523.25, 'square', 0.1, 0); this.playTone(659.25, 'square', 0.1, 0.1); this.playTone(783.99, 'square', 0.1, 0.2); this.playTone(1046.50, 'square', 0.4, 0.3); } 
    else { this.playTone(523.25, 'square', 0.1, 0); this.playTone(783.99, 'square', 0.2, 0.1); }
  }
  public playQuestComplete() {
    const start = 0; this.playTone(440, 'triangle', 0.1, start); this.playTone(554, 'triangle', 0.1, start + 0.1); this.playTone(659, 'triangle', 0.1, start + 0.2); this.playTone(880, 'square', 0.4, start + 0.3, 0.6);
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

  public updateMusicState(walkingCount: number, trappedCount: number, dropSpeedMs: number) {
    this.lemmingCount = walkingCount;
    this.trappedCount = trappedCount;
    const totalLemmings = walkingCount + trappedCount;
    this.lemmingIntensity = Math.min(totalLemmings / 15, 1);
    const speedFactor = Math.max(0, (800 - dropSpeedMs) / 700);
    this.currentTempo = this.baseTempo + (speedFactor * 60);
    
    if (this.ctx && this.ctx.currentTime < this.shockEndTime) {
        if (this.choirGain) this.choirGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        if (this.trappedGain) this.trappedGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        return;
    }

    if (this.choirGain && this.ctx) {
        const volumeScale = Math.min(1, walkingCount / 4); 
        const targetVol = volumeScale * (this.musicVolume * 0.4);
        this.choirGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.5);
    }
    if (this.trappedGain && this.ctx) {
        const volumeScale = Math.min(1, trappedCount / 2); 
        const targetVol = volumeScale * (this.musicVolume * 0.35);
        this.trappedGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.5);
    }
  }

  public startMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.tick = 0;
    this.nextNoteTime = this.ctx?.currentTime || 0;
    this.startChoir();
    this.scheduleNextNote();
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimeout) window.clearTimeout(this.musicTimeout);
    this.stopChoir();
  }

  // --- Choir Logic ---
  private startChoir() {
      if (!this.ctx || !this.choirGain) return;
      this.stopChoir();

      // Free Voices (Triangle, Warm)
      for (let i = 0; i < 3; i++) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle'; gain.gain.value = 0; 
          osc.connect(gain); gain.connect(this.choirGain);
          osc.start();
          this.choirVoices.push(osc); this.choirVoiceGains.push(gain);
      }

      // Trapped Voices (Sine, Nervous)
      if (this.trappedGain && this.vibratoGain) {
          for (let i = 0; i < 2; i++) {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              osc.type = 'sine'; gain.gain.value = 0;
              this.vibratoGain.connect(osc.frequency);
              osc.connect(gain); gain.connect(this.trappedGain);
              osc.start();
              this.trappedVoices.push(osc); this.trappedVoiceGains.push(gain);
          }
      }
  }

  private stopChoir() {
      const stopAll = (voices: OscillatorNode[], gains: GainNode[]) => {
          voices.forEach(v => { try { v.stop(); } catch(e) {} v.disconnect(); });
          gains.forEach(g => g.disconnect());
      };
      stopAll(this.choirVoices, this.choirVoiceGains);
      stopAll(this.trappedVoices, this.trappedVoiceGains);
      this.choirVoices = []; this.choirVoiceGains = [];
      this.trappedVoices = []; this.trappedVoiceGains = [];
  }

  private updateChoirMelody(chordRootIndex: number, measureInBar: number) {
      if (!this.ctx || this.choirVoices.length < 3) return;
      if (this.ctx.currentTime < this.shockEndTime) return;

      const time = this.ctx.currentTime;
      // Get base note frequency from scale index
      // 0=Am(220), 3=Dm(293), 4=E(329)
      const rootFreq = this.scaleNotes[chordRootIndex];
      
      // Construct triad: Root, Third (+2 indices approx), Fifth (+4 indices approx)
      // Note: A Harmonic Minor intervals are tricky, we approximate for procedural chord building
      const chordNotes = [
          rootFreq, // Root
          this.scaleNotes[(chordRootIndex + 2) % 7] || rootFreq * 1.2, // Third (Approx)
          this.scaleNotes[(chordRootIndex + 4) % 7] || rootFreq * 1.5  // Fifth (Approx)
      ];

      // Fix E Major chord (G# is crucial)
      if (chordRootIndex === 4) { // E
          chordNotes[1] = 415.30; // G# (Major third of E)
      }

      // Free Voices - Follow Harmony
      this.choirVoices.forEach((osc, i) => {
          // Change notes mainly on beat 1, sometimes on beat 3
          const isBeatOne = this.tick % 16 === 0;
          if (isBeatOne || Math.random() < 0.05) {
             const targetFreq = chordNotes[i % 3] * (i === 2 ? 0.5 : 1); // Bassier 3rd voice
             osc.frequency.setTargetAtTime(targetFreq, time, 0.1);
          }
      });
      
      const v1Target = this.lemmingCount > 0 ? 0.3 : 0;
      const v2Target = this.lemmingCount > 3 ? 0.25 : 0;
      const v3Target = this.lemmingCount > 6 ? 0.2 : 0;
      this.choirVoiceGains.forEach((g, i) => g.gain.setTargetAtTime([v1Target, v2Target, v3Target][i], time, 0.2));

      // Trapped Voices - High Pitch Drone
      if (this.trappedVoices.length > 0) {
          const droneNote = chordNotes[2] * 2; // High Fifth
          this.trappedVoices.forEach((osc) => {
             osc.frequency.setTargetAtTime(droneNote, time, 0.2);
          });
          const tTarget = this.trappedCount > 0 ? 0.3 : 0;
          this.trappedVoiceGains.forEach(g => g.gain.setTargetAtTime(tTarget, time, 0.2));
      }
  }

  private scheduleNextNote() {
    if (!this.isMusicPlaying || !this.ctx || !this.musicGain) return;

    const secondsPer16th = (60.0 / this.currentTempo) / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playMusicStep(this.nextNoteTime);
      this.nextNoteTime += secondsPer16th; 
      this.tick++;
    }
    this.musicTimeout = window.setTimeout(() => this.scheduleNextNote(), 25);
  }

  private playMusicStep(time: number) {
    if (!this.ctx || this.isMuted || !this.musicGain) return;

    // --- Rhythm Logic (Polka/Tetris Style) ---
    // 1 Bar = 16 ticks (16th notes)
    // Beat 1 = 0, Beat 2 = 4, Beat 3 = 8, Beat 4 = 12
    const bar = Math.floor(this.tick / 16);
    const stepInBar = this.tick % 16;
    
    // Determine Current Chord from Progression
    const progressionIndex = bar % this.progression.length;
    const chordRootIdx = this.progression[progressionIndex];
    
    // Update Choir on Beat 1
    if (stepInBar === 0) {
        this.updateChoirMelody(chordRootIdx, stepInBar);
    }

    // --- BASSLINE: "Oom-Pah" ---
    // Beat 1 (0): Root
    // Beat 2 (4): Fifth (High) or Chord
    // Beat 3 (8): Root (or alternate Root)
    // Beat 4 (12): Fifth (Low)
    
    if (stepInBar % 4 === 0) {
        const beat = stepInBar / 4; // 0, 1, 2, 3
        let bassNoteIdx = chordRootIdx; // Root by default
        
        if (beat === 1 || beat === 3) { 
            // The "Pah" - play the Fifth
            bassNoteIdx = (chordRootIdx + 4) % 7; 
        }

        let freq = this.scaleNotes[bassNoteIdx];
        if (beat === 1 || beat === 3) freq *= 0.5; // Lower octave for the "Pah" usually, or swap
        else freq *= 0.5; // Bass plays in range A2-A3 usually

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle'; // Plucky bass
        osc.frequency.value = freq;
        
        osc.connect(gain);
        gain.connect(this.musicGain);

        // Short envelope for polka feel
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        osc.start(time);
        osc.stop(time + 0.15);
    }

    // --- MELODY: "Random Walker" on Harmonic Minor ---
    // Play mostly on 8th notes (0, 2, 4, 6...)
    if (stepInBar % 2 === 0) {
        // Density controlled by intensity. Always play on strong beats (0, 4, 8, 12)
        const isStrongBeat = stepInBar % 4 === 0;
        const playChance = isStrongBeat ? 0.9 : (0.4 + this.lemmingIntensity * 0.4);
        
        if (Math.random() < playChance) {
            // Walker Logic: Move stepwise from last note
            const direction = Math.random() > 0.5 ? 1 : -1;
            const jump = Math.random() > 0.8 ? 2 : 1; // Occasional skip
            
            let nextIdx = this.lastNoteIndex + (direction * jump);
            
            // Constrain to reasonable range (indices 5 to 14 in scaleNotes)
            if (nextIdx < 5) nextIdx = 5 + Math.floor(Math.random() * 2);
            if (nextIdx > 14) nextIdx = 14 - Math.floor(Math.random() * 2);
            
            // Bias towards chord tones on strong beats
            if (isStrongBeat && Math.random() > 0.3) {
                // Simplified: Just push slightly towards root or fifth of current chord
                // Not strict, keeps it "folky" and wandering
            }

            this.lastNoteIndex = nextIdx;
            const freq = this.scaleNotes[nextIdx];

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square'; // 8-bit lead
            osc.frequency.value = freq;

            osc.connect(gain);
            gain.connect(this.musicGain);

            // Staccato articulation
            const duration = 0.1;
            gain.gain.setValueAtTime(0.08, time); // Lower volume for square wave
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

            osc.start(time);
            osc.stop(time + duration);
        }
    }
  }
}

export const audioController = new AudioController();