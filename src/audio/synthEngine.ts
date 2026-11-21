import { DEMO_TRACKS, type DemoTrack } from '../data/tracks';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface PlaybackSnapshot {
  trackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isRepeatOne: boolean;
  sfxEnabled: boolean;
}

type Listener = (snapshot: PlaybackSnapshot) => void;

class NeonSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private trackIndex = 0;
  private isPlaying = false;
  private currentTime = 0;
  private volume = 0.72;
  private isMuted = false;
  private isRepeatOne = false;
  private sfxEnabled = true;

  private stepIndex = 0;
  private nextStepTime = 0;
  private schedulerId: number | null = null;
  private progressRafId: number | null = null;
  private lastTickTimestamp = 0;

  private listeners = new Set<Listener>();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): PlaybackSnapshot {
    const track = DEMO_TRACKS[this.trackIndex];
    return {
      trackIndex: this.trackIndex,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: track.durationSec,
      volume: this.volume,
      isMuted: this.isMuted,
      isRepeatOne: this.isRepeatOne,
      sfxEnabled: this.sfxEnabled,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      this.analyser = analyser;

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.isMuted ? 0 : this.volume;
      this.masterGain = masterGain;

      const musicGain = ctx.createGain();
      musicGain.gain.value = 0.85;
      this.musicGain = musicGain;

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = this.sfxEnabled ? 0.65 : 0;
      this.sfxGain = sfxGain;

      // Subtle atmospheric stereo-style echo bus for arpeggios & leads
      const delayNode = ctx.createDelay(1.0);
      delayNode.delayTime.value = 0.28;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.28;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2200;

      delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayFilter.connect(musicGain);

      this.delayNode = delayNode;
      this.delayFeedback = delayFeedback;

      musicGain.connect(compressor);
      sfxGain.connect(compressor);
      compressor.connect(analyser);
      analyser.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Generate reusable white noise buffer for snare & hi-hat
      const bufferSize = Math.floor(ctx.sampleRate * 0.4);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyser || !this.isPlaying) {
      target.fill(0);
      return false;
    }
    this.analyser.getByteFrequencyData(target);
    return true;
  }

  public getBassEnergy(): number {
    if (!this.analyser || !this.isPlaying) return 0;
    const bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(bins);
    let sum = 0;
    const count = Math.min(6, bins.length);
    for (let i = 0; i < count; i++) {
      sum += bins[i];
    }
    return sum / (count * 255);
  }

  public play(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextStepTime = ctx.currentTime + 0.04;
    this.lastTickTimestamp = performance.now();

    const track = DEMO_TRACKS[this.trackIndex];
    if (this.delayNode) {
      const sixteenth = 60 / track.bpm / 4;
      this.delayNode.delayTime.setTargetAtTime(sixteenth * 3, ctx.currentTime, 0.05);
    }

    this.startScheduler();
    this.startProgressLoop();
    this.emit();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.stopLoops();
    this.emit();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public selectTrack(index: number, autoPlay = true): void {
    const normalized = ((index % DEMO_TRACKS.length) + DEMO_TRACKS.length) % DEMO_TRACKS.length;
    this.trackIndex = normalized;
    this.currentTime = 0;
    this.stepIndex = 0;

    if (this.ctx && this.delayNode) {
      const track = DEMO_TRACKS[this.trackIndex];
      const sixteenth = 60 / track.bpm / 4;
      this.delayNode.delayTime.setTargetAtTime(sixteenth * 3, this.ctx.currentTime, 0.05);
    }

    if (autoPlay) {
      if (!this.isPlaying) {
        this.play();
      } else if (this.ctx) {
        this.nextStepTime = this.ctx.currentTime + 0.05;
        this.lastTickTimestamp = performance.now();
        this.emit();
      }
    } else {
      this.emit();
    }
  }

  public nextTrack(autoPlay = this.isPlaying): void {
    this.selectTrack(this.trackIndex + 1, autoPlay);
  }

  public prevTrack(autoPlay = this.isPlaying): void {
    if (this.currentTime > 3.5) {
      this.seek(0);
      return;
    }
    this.selectTrack(this.trackIndex - 1, autoPlay);
  }

  public seek(seconds: number): void {
    const track = DEMO_TRACKS[this.trackIndex];
    const clamped = Math.max(0, Math.min(track.durationSec, seconds));
    this.currentTime = clamped;
    const sixteenthSec = 60 / track.bpm / 4;
    this.stepIndex = Math.floor(clamped / sixteenthSec) % 64;
    this.lastTickTimestamp = performance.now();
    this.emit();
  }

  public setVolume(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volume = clamped;
    if (clamped > 0 && this.isMuted) {
      this.isMuted = false;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  public toggleRepeatOne(): void {
    this.isRepeatOne = !this.isRepeatOne;
    this.emit();
  }

  public toggleSfx(): void {
    this.sfxEnabled = !this.sfxEnabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? 0.65 : 0, this.ctx.currentTime, 0.02);
    }
    this.emit();
  }

  private startScheduler(): void {
    if (this.schedulerId !== null) window.clearInterval(this.schedulerId);
    this.schedulerId = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const track = DEMO_TRACKS[this.trackIndex];
      const lookahead = 0.14;
      const stepDuration = 60 / track.bpm / 4;

      while (this.nextStepTime < this.ctx.currentTime + lookahead) {
        const swingOffset = this.stepIndex % 2 === 1 ? stepDuration * track.synth.swing : 0;
        this.scheduleStep(track, this.stepIndex, this.nextStepTime + swingOffset, stepDuration);
        this.nextStepTime += stepDuration;
        this.stepIndex = (this.stepIndex + 1) % 64;
      }
    }, 25);
  }

  private startProgressLoop(): void {
    if (this.progressRafId !== null) cancelAnimationFrame(this.progressRafId);
    const tick = (now: number) => {
      if (!this.isPlaying) return;
      const dt = Math.min(0.25, (now - this.lastTickTimestamp) / 1000);
      this.lastTickTimestamp = now;
      this.currentTime += dt;

      const track = DEMO_TRACKS[this.trackIndex];
      if (this.currentTime >= track.durationSec) {
        if (this.isRepeatOne) {
          this.currentTime = 0;
          this.stepIndex = 0;
        } else {
          this.trackIndex = (this.trackIndex + 1) % DEMO_TRACKS.length;
          this.currentTime = 0;
          this.stepIndex = 0;
          if (this.ctx && this.delayNode) {
            const nextTrack = DEMO_TRACKS[this.trackIndex];
            this.delayNode.delayTime.setTargetAtTime(
              (60 / nextTrack.bpm / 4) * 3,
              this.ctx.currentTime,
              0.05,
            );
          }
        }
      }

      this.emit();
      this.progressRafId = requestAnimationFrame(tick);
    };
    this.progressRafId = requestAnimationFrame(tick);
  }

  private stopLoops(): void {
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.progressRafId !== null) {
      cancelAnimationFrame(this.progressRafId);
      this.progressRafId = null;
    }
  }

  private scheduleStep(track: DemoTrack, step64: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const barIndex = Math.floor(step64 / 16) % track.synth.chords.length;
    const step16 = step64 % 16;
    const chord = track.synth.chords[barIndex];

    // 1. Lush pad chord on the downbeat of each bar
    if (step16 === 0) {
      this.triggerPad(chord, time, stepDur * 15.5, track.synth.padCutoff);
    }

    // 2. Bassline
    const bassOffset = track.synth.bassOffsets[step16];
    if (bassOffset !== null && bassOffset !== undefined) {
      const rootMidi = chord[0] - 12 + bassOffset;
      this.triggerBass(midiToFreq(rootMidi), time, stepDur * 0.9, track.synth.bassWave);
    }

    // 3. Arpeggiator
    const arp = track.synth.arpSteps[step16];
    if (arp) {
      const baseNote = chord[arp.index % chord.length];
      const midi = baseNote + (arp.octave ?? 0) * 12;
      this.triggerArp(midiToFreq(midi), time, stepDur * 1.1, track.synth.arpWave, track.synth.arpCutoff);
    }

    // 4. Melodic Lead
    const leadMidi = track.synth.leadNotes[step64];
    if (leadMidi !== null && leadMidi !== undefined) {
      this.triggerLead(midiToFreq(leadMidi), time, stepDur * 2.2, track.synth.leadWave);
    }

    // 5. Drums
    if (track.synth.kickSteps.includes(step16)) {
      this.triggerKick(time);
    }
    if (track.synth.snareSteps.includes(step16)) {
      this.triggerSnare(time);
    }
    if (track.synth.hatSteps.includes(step16)) {
      this.triggerHat(time, step16 % 4 === 2 ? 0.08 : 0.045);
    }
  }

  private triggerPad(chord: number[], time: number, duration: number, cutoff: number): void {
    if (!this.ctx || !this.musicGain) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 0.7, time);
    filter.frequency.linearRampToValueAtTime(cutoff * 1.15, time + duration * 0.5);
    filter.frequency.linearRampToValueAtTime(cutoff * 0.65, time + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.09, time + 0.35);
    env.gain.setValueAtTime(0.08, time + duration - 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    filter.connect(env);
    env.connect(this.musicGain);

    chord.forEach((midi, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(midi), time);
      osc.detune.setValueAtTime((idx - 1.5) * 5, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }

  private triggerBass(freq: number, time: number, duration: number, wave: OscillatorType): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + duration);
    filter.Q.value = 3;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(0.24, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  private triggerArp(
    freq: number,
    time: number,
    duration: number,
    wave: OscillatorType,
    cutoff: number,
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(420, time + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0008, time);
    env.gain.linearRampToValueAtTime(0.085, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0008, time + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);
    if (this.delayNode) {
      env.connect(this.delayNode);
    }

    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  private triggerLead(freq: number, time: number, duration: number, wave: OscillatorType): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, time);
    filter.frequency.exponentialRampToValueAtTime(900, time + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0008, time);
    env.gain.linearRampToValueAtTime(0.11, time + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0008, time + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);
    if (this.delayNode) {
      env.connect(this.delayNode);
    }

    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  private triggerKick(time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.45, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    osc.connect(env);
    env.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private triggerSnare(time: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, time);
    filter.Q.value = 0.8;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.17, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);
    noise.start(time);
    noise.stop(time + 0.15);
  }

  private triggerHat(time: number, gainAmt: number): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7200, time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gainAmt, time);
    env.gain.exponentialRampToValueAtTime(0.0008, time + 0.05);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);
    noise.start(time);
    noise.stop(time + 0.06);
  }

  // --- Snake Game Sound Effects ---

  public playEatSfx(combo = 1): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const baseMidi = 72 + Math.min(combo, 8) * 2;
    [baseMidi, baseMidi + 7].forEach((midi, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(midi), now + i * 0.045);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now + i * 0.045);
      env.gain.linearRampToValueAtTime(0.22, now + i * 0.045 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.15);

      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.17);
    });
  }

  public playBonusSfx(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    [76, 80, 83, 88].forEach((midi, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(midi), now + i * 0.04);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now + i * 0.04);
      env.gain.linearRampToValueAtTime(0.2, now + i * 0.04 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.22);

      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.24);
    });
  }

  public playStartSfx(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    [60, 67, 72].forEach((midi, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(midi), now + i * 0.055);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.001, now + i * 0.055);
      env.gain.linearRampToValueAtTime(0.18, now + i * 0.055 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.16);

      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.18);
    });
  }

  public playGameOverSfx(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.42);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.42);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.24, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }
}

export const synthEngine = new NeonSynthEngine();
