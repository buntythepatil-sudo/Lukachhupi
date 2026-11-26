import { AudioSettings, CharacterAnimState, GamePhase } from './types';

export function createDefaultAudioSettings(): AudioSettings {
  return {
    musicVolume: 0.45,
    sfxVolume: 0.78,
    muted: false,
  };
}

// Village landmark positions for authentic proximity-weighted village ambience
const TEMPLE_POS = { x: 24.5, z: -25.5 };
const FARM_POS = { x: -22.5, z: 29.5 };
const MARKET_POS = { x: 27.6, z: 4.5 };
const HAND_PUMPS = [
  { x: -5.8, z: 3.0 },
  { x: -16.2, z: -17.8 },
  { x: 19.2, z: 14.5 },
];
const BICYCLES = [
  { x: -7.0, z: -6.8 },
  { x: -17.4, z: -22.2 },
  { x: 24.4, z: -1.8 },
  { x: 16.8, z: 7.4 },
];

// Nostalgic Raag Bhupali / evening village pentatonic frequencies (D major pentatonic)
// D4, E4, F#4, A4, B4, D5, E5, F#5
const BHUPALI_SCALE = [
  293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99,
];

// Gentle nostalgic village bansuri phrases (scale indices, -1 = rest)
const BANSURI_PHRASES: number[][] = [
  [0, 1, 2, 3, -1, 4, 3, 2, 1, 0, -1, -1],
  [2, 3, 4, 5, -1, 4, 3, 2, 3, -1, 1, 0],
  [5, 4, 3, 2, -1, 1, 2, 3, 2, 1, 0, -1],
  [3, 4, 5, 6, 5, -1, 4, 3, 2, 1, 0, -1],
];

function nearestDist(
  px: number,
  pz: number,
  points: Array<{ x: number; z: number }>,
): number {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(px - points[i].x, pz - points[i].z);
    if (d < best) best = d;
  }
  return best;
}

function proximityGain(dist: number, nearDist: number, farDist: number): number {
  if (dist <= nearDist) return 1;
  if (dist >= farDist) return 0.22;
  const t = (dist - nearDist) / (farDist - nearDist);
  return 1 - t * 0.78;
}

/**
 * 100% procedural Web Audio API soundscape & SFX synthesizer for
 * Gully Chhupan Chhupai 1995 (zero external audio files / zero 404s).
 */
export class VillageAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  private whiteNoise: AudioBuffer | null = null;
  private pinkNoise: AudioBuffer | null = null;

  private droneNodes: Array<{ stop: () => void }> = [];
  private cricketBedNodes: Array<{ stop: () => void }> = [];

  private settings: AudioSettings = createDefaultAudioSettings();
  private onSettingsChanged?: (settings: AudioSettings) => void;
  private disposed = false;
  private unlocked = false;

  // Schedulers & timers
  private footstepTimer = 0;
  private stepToggle = false;
  private musicBeatTimer = 0.08;
  private musicPhraseIdx = 0;
  private musicNoteIdx = 0;
  private tablaStep = 0;

  private birdTimer = 1.6;
  private cricketChirpTimer = 2.4;
  private dogTimer = 9.5;
  private cowTimer = 14.0;
  private villagerTimer = 7.0;
  private bikeBellTimer = 11.0;
  private handPumpTimer = 13.5;
  private templeBellTimer = 8.5;
  private announcementTimer = 19.0;
  private activeLevelId = 1;
  private schoolBellTimer = 10.5;
  private schoolChatterTimer = 3.6;
  private marketChatterTimer = 2.6;
  private marketHawkerTimer = 5.4;
  private marketClinkTimer = 4.2;
  private haveliWindTimer = 2.8;
  private haveliDoorCreakTimer = 9.5;
  private haveliFloorCreakTimer = 7.2;
  private orchardWindTimer = 3.2;
  private orchardInsectTimer = 2.4;
  private orchardWaterTimer = 4.2;
  private trainWhistleTimer = 6.5;
  private trainRumbleTimer = 11.5;
  private stationChimeTimer = 14.0;
  private riverFlowTimer = 2.6;

  constructor(onSettingsChanged?: (settings: AudioSettings) => void) {
    this.onSettingsChanged = onSettingsChanged;
    this.bindUnlockListeners();
  }

  public setActiveLevel(levelId: number): void {
    this.activeLevelId = levelId;
    if (levelId === 2) {
      this.schoolBellTimer = 8.5 + Math.random() * 6.0;
      this.schoolChatterTimer = 2.4 + Math.random() * 2.5;
    } else if (levelId === 3) {
      this.birdTimer = 1.4 + Math.random() * 1.8;
      this.orchardWindTimer = 2.2 + Math.random() * 2.8;
      this.orchardInsectTimer = 1.8 + Math.random() * 2.6;
      this.orchardWaterTimer = 3.0 + Math.random() * 3.2;
    } else if (levelId === 4) {
      this.marketChatterTimer = 1.4 + Math.random() * 2.0;
      this.marketHawkerTimer = 3.2 + Math.random() * 3.5;
      this.marketClinkTimer = 2.8 + Math.random() * 3.5;
    } else if (levelId === 5) {
      this.trainWhistleTimer = 4.2 + Math.random() * 4.8;
      this.trainRumbleTimer = 9.5 + Math.random() * 7.5;
      this.stationChimeTimer = 12.0 + Math.random() * 8.0;
    } else if (levelId === 6) {
      this.haveliWindTimer = 1.6 + Math.random() * 2.4;
      this.haveliDoorCreakTimer = 6.5 + Math.random() * 6.0;
      this.haveliFloorCreakTimer = 5.0 + Math.random() * 6.0;
    } else if (levelId === 7 || levelId === 11 || levelId === 12 || levelId === 13) {
      this.riverFlowTimer = 1.2 + Math.random() * 1.6;
      this.orchardWindTimer = 3.4 + Math.random() * 3.2;
      this.birdTimer = 1.6 + Math.random() * 2.2;
    } else if (levelId === 9) {
      this.trainWhistleTimer = 5.5 + Math.random() * 5.0;
      this.orchardWindTimer = 2.6 + Math.random() * 2.8;
      this.birdTimer = 1.8 + Math.random() * 2.2;
    } else if (levelId === 10 || levelId === 14) {
      this.marketChatterTimer = 1.8 + Math.random() * 2.2;
      this.marketClinkTimer = 3.0 + Math.random() * 3.4;
    } else if (levelId === 15) {
      this.orchardWindTimer = 2.0 + Math.random() * 2.4;
      this.birdTimer = 3.2 + Math.random() * 3.5;
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>): void {
    let changed = false;
    if (typeof partial.musicVolume === 'number') {
      const next = Math.max(0, Math.min(1, Math.round(partial.musicVolume * 20) / 20));
      if (Math.abs(next - this.settings.musicVolume) > 1e-4) {
        this.settings.musicVolume = next;
        changed = true;
      }
    }
    if (typeof partial.sfxVolume === 'number') {
      const next = Math.max(0, Math.min(1, Math.round(partial.sfxVolume * 20) / 20));
      if (Math.abs(next - this.settings.sfxVolume) > 1e-4) {
        this.settings.sfxVolume = next;
        changed = true;
      }
    }
    if (typeof partial.muted === 'boolean') {
      if (partial.muted !== this.settings.muted) {
        this.settings.muted = partial.muted;
        changed = true;
      }
    }

    if (changed) {
      this.applyVolumes();
      this.onSettingsChanged?.(this.getSettings());
    }
  }

  public toggleMute(): void {
    this.ensureReady();
    this.updateSettings({ muted: !this.settings.muted });
  }

  public unlock(): void {
    this.ensureReady();
  }

  private handleFirstGesture = (): void => {
    this.ensureReady();
    if (this.unlocked) {
      this.unbindUnlockListeners();
    }
  };

  private bindUnlockListeners(): void {
    window.addEventListener('pointerdown', this.handleFirstGesture, {
      passive: true,
    });
    window.addEventListener('keydown', this.handleFirstGesture, {
      passive: true,
    });
    window.addEventListener('touchstart', this.handleFirstGesture, {
      passive: true,
    });
  }

  private unbindUnlockListeners(): void {
    window.removeEventListener('pointerdown', this.handleFirstGesture);
    window.removeEventListener('keydown', this.handleFirstGesture);
    window.removeEventListener('touchstart', this.handleFirstGesture);
  }

  private ensureReady(): boolean {
    if (this.disposed) return false;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return false;

      try {
        const ctx = new AudioCtx();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.008;
        compressor.release.value = 0.18;

        const masterGain = ctx.createGain();
        const musicGain = ctx.createGain();
        const sfxGain = ctx.createGain();
        const ambienceGain = ctx.createGain();

        // Warm village courtyard echo bus for flute, temple bell & distant megaphone
        const delayNode = ctx.createDelay(1.0);
        delayNode.delayTime.value = 0.27;
        const delayFilter = ctx.createBiquadFilter();
        delayFilter.type = 'lowpass';
        delayFilter.frequency.value = 2100;
        const delayFeedback = ctx.createGain();
        delayFeedback.gain.value = 0.26;
        const delayWet = ctx.createGain();
        delayWet.gain.value = 0.28;

        delayNode.connect(delayFilter);
        delayFilter.connect(delayFeedback);
        delayFeedback.connect(delayNode);
        delayFilter.connect(delayWet);
        delayWet.connect(masterGain);

        musicGain.connect(masterGain);
        sfxGain.connect(masterGain);
        ambienceGain.connect(sfxGain);
        masterGain.connect(compressor);
        compressor.connect(ctx.destination);

        this.ctx = ctx;
        this.masterGain = masterGain;
        this.musicGain = musicGain;
        this.sfxGain = sfxGain;
        this.ambienceGain = ambienceGain;
        this.delayNode = delayNode;
        this.delayFeedback = delayFeedback;

        this.buildNoiseBuffers(ctx);
        this.applyVolumes(true);
        this.startTanpuraDrone(ctx, musicGain);
        this.startEveningCricketBed(ctx, ambienceGain);
      } catch {
        return false;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().then(() => {
        this.unlocked = this.ctx?.state === 'running';
      });
    } else if (this.ctx.state === 'running') {
      this.unlocked = true;
    }

    return this.ctx.state === 'running';
  }

  private buildNoiseBuffers(ctx: AudioContext): void {
    const length = Math.floor(ctx.sampleRate * 2.5);

    const white = ctx.createBuffer(1, length, ctx.sampleRate);
    const wData = white.getChannelData(0);
    for (let i = 0; i < length; i++) {
      wData[i] = Math.random() * 2 - 1;
    }
    this.whiteNoise = white;

    // Paul Kellet pink-noise approximation for warm earthen footsteps & breath
    const pink = ctx.createBuffer(1, length, ctx.sampleRate);
    const pData = pink.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const wn = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + wn * 0.0555179;
      b1 = 0.99332 * b1 + wn * 0.0750759;
      b2 = 0.969 * b2 + wn * 0.153852;
      b3 = 0.8665 * b3 + wn * 0.3104856;
      b4 = 0.55 * b4 + wn * 0.5329522;
      b5 = -0.7616 * b5 - wn * 0.016898;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + wn * 0.5362) * 0.11;
      b6 = wn * 0.115926;
    }
    this.pinkNoise = pink;
  }

  private applyVolumes(immediate = false): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const masterTarget = this.settings.muted ? 0 : 0.92;
    const musicTarget = this.settings.musicVolume * 0.42;
    const sfxTarget = this.settings.sfxVolume * 0.9;

    if (immediate) {
      this.masterGain.gain.setValueAtTime(masterTarget, now);
      this.musicGain.gain.setValueAtTime(musicTarget, now);
      this.sfxGain.gain.setValueAtTime(sfxTarget, now);
    } else {
      this.masterGain.gain.setTargetAtTime(masterTarget, now, 0.035);
      this.musicGain.gain.setTargetAtTime(musicTarget, now, 0.035);
      this.sfxGain.gain.setTargetAtTime(sfxTarget, now, 0.035);
    }
  }

  // ---------------------------------------------------------------------------
  // Continuous Background Beds (Tanpura Drone + Gentle Late-Afternoon Crickets)
  // ---------------------------------------------------------------------------
  private startTanpuraDrone(ctx: AudioContext, dest: AudioNode): void {
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 460;
    droneFilter.Q.value = 1.1;

    droneFilter.connect(droneGain);
    droneGain.connect(dest);

    // Classic Indian Tanpura Sa - Pa - Sa (D2, A2, D3) with slow organic breathing LFO
    const freqs = [73.42, 110.0, 146.83];
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.value = freqs[i];

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = i === 0 ? 0.24 : i === 1 ? 0.2 : 0.18;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14 + i * 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = voiceGain.gain.value * 0.28;

      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);
      osc.connect(voiceGain);
      voiceGain.connect(droneFilter);

      osc.start();
      lfo.start();
      this.droneNodes.push(osc, lfo);
    }
  }

  private startEveningCricketBed(ctx: AudioContext, dest: AudioNode): void {
    if (!this.whiteNoise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    src.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4450;
    bp.Q.value = 12;

    const gain = ctx.createGain();
    gain.gain.value = 0.018;

    // Gentle rhythmic cricket shimmer pulse
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5.4;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.008;

    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);

    src.connect(bp);
    bp.connect(gain);
    gain.connect(dest);

    src.start();
    lfo.start();
    this.cricketBedNodes.push(src, lfo);
  }

  // ---------------------------------------------------------------------------
  // Per-frame Tick: Music Sequencer + Organic Village Ambience + Footsteps
  // ---------------------------------------------------------------------------
  public update(
    dt: number,
    phase: GamePhase,
    listenerX: number,
    listenerZ: number,
    playerAnimState: CharacterAnimState,
    playerMoveSpeed: number,
    listenerY = 0,
  ): void {
    if (this.disposed || !this.ctx || this.ctx.state !== 'running') return;

    this.updateBackgroundMusic(dt, phase);
    this.updateVillageAmbience(dt, listenerX, listenerZ);

    if (phase === 'playing') {
      this.updateFootsteps(dt, playerAnimState, playerMoveSpeed, listenerY);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Soft Nostalgic 1990s Indian Village Background Music
  // ---------------------------------------------------------------------------
  private updateBackgroundMusic(dt: number, phase: GamePhase): void {
    if (this.settings.musicVolume <= 0.001) return;

    this.musicBeatTimer -= dt;
    if (this.musicBeatTimer > 0) return;

    const beatLen = phase === 'playing' ? 0.54 : 0.68;
    this.musicBeatTimer = beatLen;

    const phrase = BANSURI_PHRASES[this.musicPhraseIdx];
    const noteIndex = phrase[this.musicNoteIdx];

    if (noteIndex >= 0) {
      const freq = BHUPALI_SCALE[noteIndex];
      const nextNote = phrase[(this.musicNoteIdx + 1) % phrase.length];
      const duration = nextNote === -1 ? beatLen * 1.85 : beatLen * 0.92;
      this.playBansuriNote(freq, duration, phase === 'playing' ? 0.22 : 0.17);
    }

    // Delicate plucked santoor harmonic accent every 3 beats
    if (this.tablaStep % 3 === 0) {
      const chordIdx = (this.musicPhraseIdx + this.tablaStep) % 5;
      this.playSantoorPluck(BHUPALI_SCALE[chordIdx] * 0.5, 0.085);
    }

    // Gentle mellow village tabla groove (very soft on menu, livelier during active play)
    const cycle = this.tablaStep % 8;
    if (phase === 'playing') {
      if (cycle === 0) {
        this.playSoftTabla(true, 0.16); // Dha (bayan)
      } else if (cycle === 2 || cycle === 6) {
        this.playSoftTabla(false, 0.08); // Tin (dayan)
      } else if (cycle === 4) {
        this.playSoftTabla(true, 0.11); // Soft low beat
      }
    } else if (phase === 'start') {
      if (cycle === 0) {
        this.playSoftTabla(true, 0.065);
      } else if (cycle === 4) {
        this.playSoftTabla(false, 0.04);
      }
    }

    this.tablaStep++;
    this.musicNoteIdx++;
    if (this.musicNoteIdx >= phrase.length) {
      this.musicNoteIdx = 0;
      this.musicPhraseIdx = (this.musicPhraseIdx + 1) % BANSURI_PHRASES.length;
    }
  }

  private playBansuriNote(freq: number, duration: number, volume: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    // Subtle Indian bansuri meend (pitch glide into the note)
    osc.frequency.setValueAtTime(freq * 0.975, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.09);

    // Gentle bamboo flute vibrato
    const vib = this.ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 5.1;
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(0, now);
    vibGain.gain.linearRampToValueAtTime(freq * 0.009, now + duration * 0.45);
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    // Soft 2nd harmonic for warm bamboo timbre
    const overtone = this.ctx.createOscillator();
    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2, now);
    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value = 0.08;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.09);
    env.gain.setValueAtTime(volume * 0.88, now + duration * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.12);

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    env.connect(this.musicGain);
    if (this.delayNode) {
      const send = this.ctx.createGain();
      send.gain.value = 0.35;
      env.connect(send);
      send.connect(this.delayNode);
    }

    // Subtle breath air puff
    if (this.pinkNoise) {
      const breath = this.ctx.createBufferSource();
      breath.buffer = this.pinkNoise;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq * 1.8;
      bp.Q.value = 3.5;
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.0001, now);
      bGain.gain.linearRampToValueAtTime(volume * 0.14, now + 0.06);
      bGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7);
      breath.connect(bp);
      bp.connect(bGain);
      bGain.connect(this.musicGain);
      breath.start(now);
      breath.stop(now + duration);
    }

    osc.start(now);
    overtone.start(now);
    vib.start(now);
    const stopAt = now + duration + 0.15;
    osc.stop(stopAt);
    overtone.stop(stopAt);
    vib.stop(stopAt);
  }

  private playSantoorPluck(freq: number, volume: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5.2, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.9);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  private playSoftTabla(isBayan: boolean, volume: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const env = this.ctx.createGain();

    if (isBayan) {
      osc.frequency.setValueAtTime(118, now);
      osc.frequency.exponentialRampToValueAtTime(73.42, now + 0.14);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(volume, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    } else {
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.05);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(volume, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }

    osc.connect(env);
    env.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // ---------------------------------------------------------------------------
  // 1 & 3. Organic 1990s Village Ambience & Landmark Sounds
  // ---------------------------------------------------------------------------
  private updateVillageAmbience(dt: number, lx: number, lz: number): void {
    if (this.settings.sfxVolume <= 0.001) return;

    // Level 6 (Haunted Haveli): Mysterious abandoned 1990s mansion evening soundscape
    // — gentle wind gusts, occasional creaking wooden doors & floorboards, soft night crickets.
    if (this.activeLevelId === 6) {
      this.haveliWindTimer -= dt;
      if (this.haveliWindTimer <= 0) {
        this.haveliWindTimer = 5.5 + Math.random() * 6.5;
        this.playHaveliWindGust(0.11 + Math.random() * 0.06);
      }

      this.haveliDoorCreakTimer -= dt;
      if (this.haveliDoorCreakTimer <= 0) {
        this.haveliDoorCreakTimer = 11.5 + Math.random() * 12.5;
        this.playHaveliDoorCreak(0.085 + Math.random() * 0.045);
      }

      this.haveliFloorCreakTimer -= dt;
      if (this.haveliFloorCreakTimer <= 0) {
        this.haveliFloorCreakTimer = 9.0 + Math.random() * 11.0;
        this.playHaveliWoodCreak(0.07 + Math.random() * 0.04);
      }

      this.cricketChirpTimer -= dt;
      if (this.cricketChirpTimer <= 0) {
        this.cricketChirpTimer = 2.4 + Math.random() * 3.8;
        this.playCricketTrill(0.032 + Math.random() * 0.02);
      }
      return;
    }

    // Level 3 (Mango Farm): Authentic 1990s Indian orchard soundscape
    // — lively songbirds & koels, mango-leaf breeze, buzzing orchard insects,
    //   gentle irrigation channel trickle, courtyard hand pump & farm animals.
    if (this.activeLevelId === 3) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 2.0 + Math.random() * 3.2;
        if (Math.random() < 0.36) {
          this.playKoelCall(0.12 + Math.random() * 0.06);
        } else {
          this.playBirdChirp(0.11 + Math.random() * 0.06);
        }
      }

      this.orchardWindTimer -= dt;
      if (this.orchardWindTimer <= 0) {
        this.orchardWindTimer = 5.4 + Math.random() * 6.2;
        this.playOrchardWindRustle(0.11 + Math.random() * 0.06);
      }

      this.orchardInsectTimer -= dt;
      if (this.orchardInsectTimer <= 0) {
        this.orchardInsectTimer = 2.6 + Math.random() * 3.6;
        if (Math.random() < 0.55) {
          this.playOrchardInsects(0.048 + Math.random() * 0.03);
        } else {
          this.playCricketTrill(0.036 + Math.random() * 0.024);
        }
      }

      this.orchardWaterTimer -= dt;
      if (this.orchardWaterTimer <= 0) {
        this.orchardWaterTimer = 4.6 + Math.random() * 4.8;
        const channelDist = Math.min(
          Math.abs(lz - 11.2),
          Math.abs(lz + 24.5),
          Math.abs(lx + 15.5),
          Math.abs(lx - 15.5),
          Math.hypot(lx + 11.5, lz - 7.5),
        );
        const waterGain = 0.13 * proximityGain(channelDist, 5, 28);
        this.playIrrigationTrickle(waterGain);
      }

      this.handPumpTimer -= dt;
      if (this.handPumpTimer <= 0) {
        this.handPumpTimer = 16.0 + Math.random() * 14.0;
        const pumpDist = Math.hypot(lx - 7.6, lz + 2.2);
        const gain = 0.2 * proximityGain(pumpDist, 7, 36);
        this.playHandPump(gain);
      }

      this.cowTimer -= dt;
      if (this.cowTimer <= 0) {
        this.cowTimer = 15.5 + Math.random() * 15.0;
        this.playCowMoo(0.11 + Math.random() * 0.05);
      }

      this.dogTimer -= dt;
      if (this.dogTimer <= 0) {
        this.dogTimer = 16.0 + Math.random() * 16.0;
        this.playDistantDogBark(0.085 + Math.random() * 0.045);
      }
      return;
    }

    // Level 5 (Railway Colony): Authentic 1990s Indian Railways residential colony ambience
    // — distant dual-tone train whistles, passing rail clatter, nostalgic station chimes,
    //   gentle afternoon birds & colony chatter (strictly atmospheric — no playable trains).
    if (this.activeLevelId === 5) {
      const stationDist = Math.hypot(lx, lz + 16.0);
      const trackProximity = proximityGain(Math.abs(lz + 30.0), 8, 52);
      const stationProximity = proximityGain(stationDist, 10, 48);

      this.trainWhistleTimer -= dt;
      if (this.trainWhistleTimer <= 0) {
        this.trainWhistleTimer = 12.5 + Math.random() * 14.5;
        this.playDistantTrainWhistle(0.14 * trackProximity);
      }

      this.trainRumbleTimer -= dt;
      if (this.trainRumbleTimer <= 0) {
        this.trainRumbleTimer = 18.0 + Math.random() * 16.0;
        this.playDistantTrainRumble(0.12 * trackProximity);
      }

      this.stationChimeTimer -= dt;
      if (this.stationChimeTimer <= 0) {
        this.stationChimeTimer = 21.0 + Math.random() * 17.0;
        this.playRailwayStationChime(0.15 * stationProximity);
      }

      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 3.2 + Math.random() * 4.5;
        if (Math.random() < 0.25) {
          this.playKoelCall(0.09 + Math.random() * 0.05);
        } else {
          this.playBirdChirp(0.08 + Math.random() * 0.05);
        }
      }

      this.villagerTimer -= dt;
      if (this.villagerTimer <= 0) {
        this.villagerTimer = 7.5 + Math.random() * 9.5;
        this.playDistantVillagersTalking(0.1 * stationProximity);
      }

      this.dogTimer -= dt;
      if (this.dogTimer <= 0) {
        this.dogTimer = 15.0 + Math.random() * 15.0;
        this.playDistantDogBark(0.08 + Math.random() * 0.045);
      }
      return;
    }

    // Level 7 (River Village): Natural 1990s riverside village soundscape
    // — flowing river water & lapping ghats, bamboo breeze, riverside birds & distant village life.
    if (this.activeLevelId === 7) {
      const riverDist = Math.max(0, Math.abs(lx) - 5.2);
      const riverPresence = proximityGain(riverDist, 4, 34);

      this.riverFlowTimer -= dt;
      if (this.riverFlowTimer <= 0) {
        this.riverFlowTimer = 3.0 + Math.random() * 2.6;
        this.playRiverFlow(0.16 * riverPresence);
      }

      this.orchardWindTimer -= dt;
      if (this.orchardWindTimer <= 0) {
        this.orchardWindTimer = 5.8 + Math.random() * 6.5;
        this.playOrchardWindRustle(0.1 + Math.random() * 0.05);
      }

      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = 2.2 + Math.random() * 3.4;
        if (Math.random() < 0.32) {
          this.playKoelCall(0.11 + Math.random() * 0.06);
        } else {
          this.playBirdChirp(0.1 + Math.random() * 0.06);
        }
      }

      this.villagerTimer -= dt;
      if (this.villagerTimer <= 0) {
        this.villagerTimer = 9.0 + Math.random() * 10.5;
        this.playDistantVillagersTalking(0.095);
      }

      this.handPumpTimer -= dt;
      if (this.handPumpTimer <= 0) {
        this.handPumpTimer = 16.5 + Math.random() * 14.0;
        const pumpDist = Math.min(
          Math.hypot(lx + 23.5, lz - 3.5),
          Math.hypot(lx - 23.5, lz + 3.5),
        );
        this.playHandPump(0.18 * proximityGain(pumpDist, 7, 36));
      }

      this.cowTimer -= dt;
      if (this.cowTimer <= 0) {
        this.cowTimer = 16.0 + Math.random() * 16.0;
        this.playCowMoo(0.1 + Math.random() * 0.05);
      }
      return;
    }

    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 2.6 + Math.random() * 4.2;
      if (Math.random() < 0.28) {
        this.playKoelCall(0.11 + Math.random() * 0.06);
      } else {
        this.playBirdChirp(0.09 + Math.random() * 0.06);
      }
    }

    this.cricketChirpTimer -= dt;
    if (this.cricketChirpTimer <= 0) {
      this.cricketChirpTimer = 1.8 + Math.random() * 3.1;
      this.playCricketTrill(0.04 + Math.random() * 0.03);
    }

    this.dogTimer -= dt;
    if (this.dogTimer <= 0) {
      this.dogTimer = 13.0 + Math.random() * 14.0;
      this.playDistantDogBark(0.11 + Math.random() * 0.06);
    }

    this.cowTimer -= dt;
    if (this.cowTimer <= 0) {
      this.cowTimer = 15.0 + Math.random() * 16.0;
      const farmDist = Math.hypot(lx - FARM_POS.x, lz - FARM_POS.z);
      const gain = 0.16 * proximityGain(farmDist, 10, 46);
      this.playCowMoo(gain);
    }

    this.villagerTimer -= dt;
    if (this.villagerTimer <= 0) {
      this.villagerTimer = 8.5 + Math.random() * 10.5;
      const marketDist = Math.hypot(lx - MARKET_POS.x, lz - MARKET_POS.z);
      const gain = 0.11 * proximityGain(marketDist, 9, 44);
      this.playDistantVillagersTalking(gain);
    }

    this.bikeBellTimer -= dt;
    if (this.bikeBellTimer <= 0) {
      this.bikeBellTimer = 12.5 + Math.random() * 13.0;
      const d = nearestDist(lx, lz, BICYCLES);
      const gain = 0.16 * proximityGain(d, 7, 38);
      this.playBicycleBell(gain);
    }

    this.handPumpTimer -= dt;
    if (this.handPumpTimer <= 0) {
      this.handPumpTimer = 14.5 + Math.random() * 14.0;
      const d = nearestDist(lx, lz, HAND_PUMPS);
      const gain = 0.2 * proximityGain(d, 7, 36);
      this.playHandPump(gain);
    }

    this.templeBellTimer -= dt;
    if (this.templeBellTimer <= 0) {
      this.templeBellTimer = 11.5 + Math.random() * 13.5;
      const d = Math.hypot(lx - TEMPLE_POS.x, lz - TEMPLE_POS.z);
      const gain = 0.24 * proximityGain(d, 10, 48);
      this.playTempleBell(gain);
    }

    this.announcementTimer -= dt;
    if (this.announcementTimer <= 0) {
      this.announcementTimer = 24.0 + Math.random() * 18.0;
      const d = Math.hypot(lx - MARKET_POS.x, lz - MARKET_POS.z);
      const gain = 0.12 * proximityGain(d, 12, 50);
      this.playVillageAnnouncement(gain);
    }

    // Gentle warm afternoon breeze rustling through the banyan tree & village fields on Level 1
    if (this.activeLevelId === 1) {
      this.orchardWindTimer -= dt;
      if (this.orchardWindTimer <= 0) {
        this.orchardWindTimer = 8.0 + Math.random() * 7.5;
        this.playOrchardWindRustle(0.075 + Math.random() * 0.04);
      }
    }

    // Nostalgic 1995 Village School Soundscape when on Level 2 (School Campus)
    if (this.activeLevelId === 2) {
      this.schoolBellTimer -= dt;
      if (this.schoolBellTimer <= 0) {
        this.schoolBellTimer = 18.0 + Math.random() * 16.0;
        const bellDist = Math.hypot(lx - 11.4, lz - -11.45);
        const gain = 0.22 * proximityGain(bellDist, 14, 52);
        this.playSchoolBell(gain);
      }

      this.schoolChatterTimer -= dt;
      if (this.schoolChatterTimer <= 0) {
        this.schoolChatterTimer = 5.2 + Math.random() * 5.8;
        const yardDist = Math.hypot(lx - 0, lz - -4);
        const gain = 0.14 * proximityGain(yardDist, 16, 48);
        this.playSchoolChildrenTalking(gain);
      }
    }

    // Lively 1990s Indian Village Bazaar Soundscape when on Level 4 (Old Market)
    if (this.activeLevelId === 4) {
      const bazaarDist = Math.hypot(lx, lz);
      const presence = proximityGain(bazaarDist, 22, 58);

      this.marketChatterTimer -= dt;
      if (this.marketChatterTimer <= 0) {
        this.marketChatterTimer = 3.2 + Math.random() * 3.8;
        this.playMarketChatter(0.14 * presence);
      }

      this.marketHawkerTimer -= dt;
      if (this.marketHawkerTimer <= 0) {
        this.marketHawkerTimer = 6.8 + Math.random() * 7.2;
        this.playMarketVendorCall(0.15 * presence);
      }

      this.marketClinkTimer -= dt;
      if (this.marketClinkTimer <= 0) {
        this.marketClinkTimer = 5.5 + Math.random() * 6.5;
        this.playBazaarClink(0.08 * presence);
      }
    }
  }

  /** Gentle warm afternoon wind rustling through mango tree leaves */
  private playOrchardWindRustle(volume: number): void {
    if (!this.ctx || !this.ambienceGain || !this.pinkNoise) return;
    const now = this.ctx.currentTime;
    const dur = 2.6 + Math.random() * 1.4;

    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoise;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.linearRampToValueAtTime(1180 + Math.random() * 280, now + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(480, now + dur);
    bp.Q.value = 1.4;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + dur * 0.36);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.ambienceGain);
    src.start(now, Math.random() * 0.9);
    src.stop(now + dur + 0.05);
  }

  /** Warm daytime orchard cicada / buzzing insect hum */
  private playOrchardInsects(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const dur = 1.15 + Math.random() * 0.75;
    const baseFreq = 5100 + Math.random() * 900;

    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(baseFreq, now);

    const mod = this.ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(24 + Math.random() * 14, now);
    const modGain = this.ctx.createGain();
    modGain.gain.value = volume * 0.45;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.2);
    env.gain.setValueAtTime(volume * 0.85, now + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    mod.connect(modGain);
    modGain.connect(env.gain);
    carrier.connect(env);
    env.connect(this.ambienceGain);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + dur + 0.04);
    mod.stop(now + dur + 0.04);
  }

  /** Soft trickling water running through earthen orchard irrigation channels */
  private playIrrigationTrickle(volume: number): void {
    if (!this.ctx || !this.ambienceGain || !this.whiteNoise) return;
    const now = this.ctx.currentTime;
    const dur = 1.8 + Math.random() * 0.9;

    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1450, now);
    bp.frequency.linearRampToValueAtTime(2200, now + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(1320, now + dur);
    bp.Q.value = 3.2;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume * 0.55, now + 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.ambienceGain);
    src.start(now, Math.random() * 0.8);
    src.stop(now + dur + 0.04);
  }

  /** Classic 1990s Indian Railways distant dual-tone locomotive horn/whistle */
  private playDistantTrainWhistle(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    // Iconic warm dual-tone railway horn chord (F#4 + A#4 / distant muted brassy timbre)
    const freqs = Math.random() < 0.5 ? [369.99, 466.16] : [329.63, 415.3];
    const blasts = Math.random() < 0.6 ? [0.0, 1.45] : [0.0];

    for (let b = 0; b < blasts.length; b++) {
      const start = now + blasts[b];
      const dur = b === 0 ? 1.15 : 1.55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(920, start);
      lp.frequency.exponentialRampToValueAtTime(640, start + dur);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(volume, start + 0.18);
      env.gain.setValueAtTime(volume * 0.9, start + dur * 0.68);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      lp.connect(env);
      env.connect(this.ambienceGain);
      if (this.delayNode) env.connect(this.delayNode);

      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f * 0.992, start);
        osc.frequency.linearRampToValueAtTime(f, start + 0.12);
        osc.frequency.linearRampToValueAtTime(f * 0.985, start + dur);
        osc.connect(lp);
        osc.start(start);
        osc.stop(start + dur + 0.05);
      }
    }
  }

  /** Soft rhythmic distant train clackety-clack & low passing track rumble */
  private playDistantTrainRumble(volume: number): void {
    if (!this.ctx || !this.ambienceGain || !this.pinkNoise) return;
    const now = this.ctx.currentTime;
    const dur = 4.2;

    // Warm distant low rumble bed
    const bed = this.ctx.createBufferSource();
    bed.buffer = this.pinkNoise;
    bed.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const bedEnv = this.ctx.createGain();
    bedEnv.gain.setValueAtTime(0.0001, now);
    bedEnv.gain.linearRampToValueAtTime(volume * 0.85, now + 1.4);
    bedEnv.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    bed.connect(lp);
    lp.connect(bedEnv);
    bedEnv.connect(this.ambienceGain);
    bed.start(now, Math.random() * 0.6);
    bed.stop(now + dur + 0.05);

    // Subtle "da-dum... da-dum..." rail joint clacks
    for (let i = 0; i < 6; i++) {
      const pairT = now + 0.45 + i * 0.56;
      const pairFade = Math.sin(((i + 0.5) / 6) * Math.PI);
      for (const dtClick of [0, 0.14]) {
        const t = pairT + dtClick;
        const click = this.ctx.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(165, t);
        click.frequency.exponentialRampToValueAtTime(72, t + 0.055);
        const cEnv = this.ctx.createGain();
        cEnv.gain.setValueAtTime(0.0001, t);
        cEnv.gain.linearRampToValueAtTime(volume * 0.48 * pairFade, t + 0.006);
        cEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
        click.connect(cEnv);
        cEnv.connect(this.ambienceGain);
        click.start(t);
        click.stop(t + 0.075);
      }
    }
  }

  /** Classic nostalgic 3-note Indian Railways Station Announcement Chime ("Ding-Dong-Ding") */
  private playRailwayStationChime(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 523.25, 783.99]; // E5 -> C5 -> G5 classic railway PA chime

    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.34;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t);

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 1.6;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume * 0.52, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.connect(bp);
      bp.connect(env);
      env.connect(this.ambienceGain);
      if (this.delayNode) env.connect(this.delayNode);

      osc.start(t);
      osc.stop(t + 0.7);
    }
  }

  /** Natural gently flowing river water & soft riverbank lapping */
  private playRiverFlow(volume: number): void {
    if (!this.ctx || !this.ambienceGain || !this.pinkNoise) return;
    const now = this.ctx.currentTime;
    const dur = 3.6 + Math.random() * 1.4;

    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoise;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(680, now);
    bp.frequency.linearRampToValueAtTime(1120 + Math.random() * 240, now + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(620, now + dur);
    bp.Q.value = 1.1;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.ambienceGain);
    src.start(now, Math.random() * 0.8);
    src.stop(now + dur + 0.05);
  }

  private playBirdChirp(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const chirps = 2 + Math.floor(Math.random() * 3);
    const baseFreq = 2500 + Math.random() * 1500;

    for (let i = 0; i < chirps; i++) {
      const t = now + i * (0.095 + Math.random() * 0.045);
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * (0.92 + Math.random() * 0.12), t);
      osc.frequency.exponentialRampToValueAtTime(
        baseFreq * (1.28 + Math.random() * 0.2),
        t + 0.035,
      );
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.96, t + 0.075);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(env);
      env.connect(this.ambienceGain);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  /** Classic nostalgic Indian summer/afternoon Koel bird "Ku-oo!" call */
  private playKoelCall(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.65;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const pitchShift = 1 + i * 0.06;
      osc.frequency.setValueAtTime(980 * pitchShift, t);
      osc.frequency.exponentialRampToValueAtTime(1260 * pitchShift, t + 0.16);
      osc.frequency.exponentialRampToValueAtTime(1420 * pitchShift, t + 0.34);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume, t + 0.05);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      osc.connect(env);
      env.connect(this.ambienceGain);
      if (this.delayNode) env.connect(this.delayNode);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  }

  private playCricketTrill(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const pulses = 3 + Math.floor(Math.random() * 3);
    const freq = 4200 + Math.random() * 650;

    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.062;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume, t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);

      osc.connect(env);
      env.connect(this.ambienceGain);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  private playDistantDogBark(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const barks = Math.random() < 0.65 ? 2 : 3;

    for (let i = 0; i < barks; i++) {
      const t = now + i * (0.28 + Math.random() * 0.08);
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const pitch = 215 + Math.random() * 45;
      osc.frequency.setValueAtTime(pitch * 1.25, t);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.62, t + 0.14);

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(680, t);
      formant.frequency.exponentialRampToValueAtTime(390, t + 0.14);
      formant.Q.value = 2.8;

      const distLp = this.ctx.createBiquadFilter();
      distLp.type = 'lowpass';
      distLp.frequency.value = 1150;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume, t + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(formant);
      formant.connect(distLp);
      distLp.connect(env);
      env.connect(this.ambienceGain);

      osc.start(t);
      osc.stop(t + 0.18);
    }
  }

  private playCowMoo(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const dur = 1.45;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(126, now);
    osc.frequency.linearRampToValueAtTime(162, now + 0.45);
    osc.frequency.exponentialRampToValueAtTime(114, now + dur);

    // Dual nasal vocal-tract formant filters for realistic warm village cow moo
    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(320, now);
    f1.frequency.linearRampToValueAtTime(430, now + 0.5);
    f1.frequency.linearRampToValueAtTime(280, now + dur);
    f1.Q.value = 3.2;

    const f2 = this.ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 790;
    f2.Q.value = 4.0;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.25);
    env.gain.setValueAtTime(volume * 0.85, now + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(env);
    f2.connect(env);
    env.connect(this.ambienceGain);

    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  private playDistantVillagersTalking(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const syllables = 5 + Math.floor(Math.random() * 4);
    const voicePitch = 148 + Math.random() * 68;

    let t = now;
    for (let i = 0; i < syllables; i++) {
      const sylDur = 0.09 + Math.random() * 0.09;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const p = voicePitch * (0.9 + Math.random() * 0.22);
      osc.frequency.setValueAtTime(p, t);
      osc.frequency.linearRampToValueAtTime(p * (0.95 + Math.random() * 0.14), t + sylDur);

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 540 + Math.random() * 380;
      bp.Q.value = 2.4;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume, t + sylDur * 0.25);
      env.gain.exponentialRampToValueAtTime(0.0001, t + sylDur);

      osc.connect(bp);
      bp.connect(env);
      env.connect(this.ambienceGain);

      osc.start(t);
      osc.stop(t + sylDur + 0.02);
      t += sylDur + 0.03 + Math.random() * 0.05;
    }
  }

  /** Classic 1990s Atlas/Hero brass bicycle bell ("Tring-Tring!") */
  public playBicycleBell(volume = 0.16): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const partials = [1840, 3690, 5480, 6210];

    for (let ring = 0; ring < 2; ring++) {
      const start = now + ring * 0.165;
      for (let i = 0; i < partials.length; i++) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(partials[i], start);

        const env = this.ctx.createGain();
        const partVol = volume * (i === 0 ? 0.55 : i === 1 ? 0.35 : 0.18);
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(partVol, start + 0.004);
        env.gain.exponentialRampToValueAtTime(
          0.0001,
          start + (ring === 1 ? 0.65 : 0.24),
        );

        osc.connect(env);
        env.connect(this.ambienceGain);
        osc.start(start);
        osc.stop(start + 0.7);
      }
    }
  }

  /** Classic Indian cast-iron Hand Pump (Chapakal): squeaky lever + clank + water splash */
  public playHandPump(volume = 0.2): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;

    for (let stroke = 0; stroke < 2; stroke++) {
      const t = now + stroke * 0.58;

      // 1. Iron lever squeak
      const squeak = this.ctx.createOscillator();
      squeak.type = 'triangle';
      squeak.frequency.setValueAtTime(610, t);
      squeak.frequency.exponentialRampToValueAtTime(920, t + 0.14);
      squeak.frequency.exponentialRampToValueAtTime(540, t + 0.24);
      const sFilter = this.ctx.createBiquadFilter();
      sFilter.type = 'bandpass';
      sFilter.frequency.value = 780;
      sFilter.Q.value = 6;
      const sEnv = this.ctx.createGain();
      sEnv.gain.setValueAtTime(0.0001, t);
      sEnv.gain.linearRampToValueAtTime(volume * 0.28, t + 0.04);
      sEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      squeak.connect(sFilter);
      sFilter.connect(sEnv);
      sEnv.connect(this.ambienceGain);
      squeak.start(t);
      squeak.stop(t + 0.26);

      // 2. Iron clank
      const clank = this.ctx.createOscillator();
      clank.type = 'sine';
      clank.frequency.setValueAtTime(240, t + 0.2);
      clank.frequency.exponentialRampToValueAtTime(125, t + 0.3);
      const cEnv = this.ctx.createGain();
      cEnv.gain.setValueAtTime(0.0001, t + 0.2);
      cEnv.gain.linearRampToValueAtTime(volume * 0.4, t + 0.21);
      cEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      clank.connect(cEnv);
      cEnv.connect(this.ambienceGain);
      clank.start(t + 0.2);
      clank.stop(t + 0.34);

      // 3. Water gush splash
      if (this.whiteNoise) {
        const splash = this.ctx.createBufferSource();
        splash.buffer = this.whiteNoise;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1100, t + 0.22);
        bp.frequency.exponentialRampToValueAtTime(2150, t + 0.42);
        bp.Q.value = 1.6;
        const wEnv = this.ctx.createGain();
        wEnv.gain.setValueAtTime(0.0001, t + 0.22);
        wEnv.gain.linearRampToValueAtTime(volume * 0.42, t + 0.28);
        wEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.56);
        splash.connect(bp);
        bp.connect(wEnv);
        wEnv.connect(this.ambienceGain);
        splash.start(t + 0.22);
        splash.stop(t + 0.58);
      }
    }
  }

  /** Resonant brass Village Temple Bell (Mandir Ghanta) */
  public playTempleBell(volume = 0.22): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const fundamental = 415; // Warm bronze temple bell pitch
    const ratios = [1.0, 2.0, 2.76, 4.07, 5.42];
    const decays = [3.2, 2.4, 1.8, 1.2, 0.8];

    for (let i = 0; i < ratios.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * ratios[i], now);

      const env = this.ctx.createGain();
      const gainLevel = volume * (i === 0 ? 0.55 : 0.36 / (i + 0.5));
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(gainLevel, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

      osc.connect(env);
      env.connect(this.ambienceGain);
      if (this.delayNode && i < 2) {
        env.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + decays[i] + 0.05);
    }
  }

  /**
   * Player-triggered loud, resonant brass Temple Bell (Mandir Ghanta) SFX
   * with metallic clapper strike transient and courtyard echo.
   */
  public playTempleBellRing(volume = 0.68): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const pitchJitter = 0.985 + Math.random() * 0.03;
    const fundamental = 412 * pitchJitter;

    // 1. Crisp metallic brass clapper impact strike
    const strikeOsc = this.ctx.createOscillator();
    strikeOsc.type = 'triangle';
    strikeOsc.frequency.setValueAtTime(1640 * pitchJitter, now);
    strikeOsc.frequency.exponentialRampToValueAtTime(760 * pitchJitter, now + 0.055);
    const strikeGain = this.ctx.createGain();
    strikeGain.gain.setValueAtTime(0.0001, now);
    strikeGain.gain.linearRampToValueAtTime(volume * 0.42, now + 0.004);
    strikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    strikeOsc.connect(strikeGain);
    strikeGain.connect(this.sfxGain);
    strikeOsc.start(now);
    strikeOsc.stop(now + 0.09);

    // 2. Rich bronze bell harmonic partials (authentic Mandir Ghanta shimmer)
    const ratios = [1.0, 2.0, 2.756, 4.07, 5.404, 6.72];
    const decays = [3.6, 2.7, 2.0, 1.35, 0.9, 0.55];

    for (let i = 0; i < ratios.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * ratios[i], now);

      const env = this.ctx.createGain();
      const gainLevel = volume * (i === 0 ? 0.58 : 0.36 / (i + 0.45));
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(gainLevel, now + 0.007);
      env.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

      osc.connect(env);
      env.connect(this.sfxGain);
      if (this.delayNode && i < 3) {
        const echoSend = this.ctx.createGain();
        echoSend.gain.value = 0.42;
        env.connect(echoSend);
        echoSend.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + decays[i] + 0.06);
    }
  }

  /**
   * Authentic 1995 Indian village school period bell (3 rhythmic metallic brass/iron strikes)
   */
  public playSchoolBell(volume = 0.2): void {
    if (!this.ctx || !this.ambienceGain || volume <= 0.005) return;
    const now = this.ctx.currentTime;
    const fundamental = 640; // Brighter village school ghanti pitch
    const ratios = [1.0, 2.02, 2.94, 4.18, 5.6];
    const decays = [1.65, 1.2, 0.85, 0.55, 0.35];

    for (let strike = 0; strike < 3; strike++) {
      const t0 = now + strike * 0.42;
      const strikeVol = volume * (strike === 2 ? 1.05 : 0.88);
      for (let i = 0; i < ratios.length; i++) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamental * ratios[i], t0);

        const env = this.ctx.createGain();
        const level = strikeVol * (i === 0 ? 0.5 : 0.32 / (i + 0.4));
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(level, t0 + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + decays[i]);

        osc.connect(env);
        env.connect(this.ambienceGain);
        if (this.delayNode && i < 2) env.connect(this.delayNode);
        osc.start(t0);
        osc.stop(t0 + decays[i] + 0.05);
      }
    }
  }

  /**
   * Player-triggered crisp double-clang School Bell SFX under the veranda corridor
   */
  public playSchoolBellRing(volume = 0.72): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const jitter = 0.985 + Math.random() * 0.03;
    const fundamental = 635 * jitter;
    const ratios = [1.0, 2.01, 2.93, 4.16, 5.58, 7.05];
    const decays = [2.4, 1.8, 1.25, 0.85, 0.55, 0.32];

    for (let strike = 0; strike < 2; strike++) {
      const t0 = now + strike * 0.28;
      const strikeOsc = this.ctx.createOscillator();
      strikeOsc.type = 'triangle';
      strikeOsc.frequency.setValueAtTime(2180 * jitter, t0);
      strikeOsc.frequency.exponentialRampToValueAtTime(980 * jitter, t0 + 0.045);
      const strikeGain = this.ctx.createGain();
      strikeGain.gain.setValueAtTime(0.0001, t0);
      strikeGain.gain.linearRampToValueAtTime(volume * 0.36, t0 + 0.003);
      strikeGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.065);
      strikeOsc.connect(strikeGain);
      strikeGain.connect(this.sfxGain);
      strikeOsc.start(t0);
      strikeOsc.stop(t0 + 0.08);

      for (let i = 0; i < ratios.length; i++) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(fundamental * ratios[i], t0);
        const env = this.ctx.createGain();
        const level = volume * (strike === 0 ? 1.0 : 0.78) * (i === 0 ? 0.54 : 0.34 / (i + 0.4));
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(level, t0 + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + decays[i]);

        osc.connect(env);
        env.connect(this.sfxGain);
        if (this.delayNode && i < 3) {
          const echoSend = this.ctx.createGain();
          echoSend.gain.value = 0.38;
          env.connect(echoSend);
          echoSend.connect(this.delayNode);
        }
        osc.start(t0);
        osc.stop(t0 + decays[i] + 0.06);
      }
    }
  }

  /**
   * Lively procedural schoolyard children talking, reciting, & recess chatter bursts
   */
  private playSchoolChildrenTalking(volume: number): void {
    if (!this.ctx || !this.ambienceGain || volume <= 0.004) return;
    const now = this.ctx.currentTime;
    const voiceCount = 3 + Math.floor(Math.random() * 3);

    for (let v = 0; v < voiceCount; v++) {
      const startOffset = v * (0.14 + Math.random() * 0.22);
      const syllables = 3 + Math.floor(Math.random() * 4);
      const childPitch = 285 + Math.random() * 145; // Bright children's vocal register

      for (let s = 0; s < syllables; s++) {
        const t = now + startOffset + s * (0.13 + Math.random() * 0.07);
        const dur = 0.085 + Math.random() * 0.065;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        const f0 = childPitch * (0.9 + Math.random() * 0.24);
        osc.frequency.setValueAtTime(f0, t);
        osc.frequency.exponentialRampToValueAtTime(
          f0 * (0.86 + Math.random() * 0.32),
          t + dur,
        );

        const formant = this.ctx.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = 950 + Math.random() * 820;
        formant.Q.value = 3.2;

        const env = this.ctx.createGain();
        const peak = volume * (0.28 + Math.random() * 0.24);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(peak, t + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(formant);
        formant.connect(env);
        env.connect(this.ambienceGain);
        osc.start(t);
        osc.stop(t + dur + 0.03);
      }
    }
  }

  /**
   * Nostalgic 1990s Indian Village Horn-Loudspeaker / Megaphone Announcement
   * (Panchayat / Bazaar PA chime + bandpass-filtered distant announcement cadence)
   */
  public playVillageAnnouncement(volume = 0.12): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;

    // Bandpass horn-loudspeaker tone shaper
    const hornBp = this.ctx.createBiquadFilter();
    hornBp.type = 'bandpass';
    hornBp.frequency.value = 1380;
    hornBp.Q.value = 2.1;

    const hornOut = this.ctx.createGain();
    hornOut.gain.value = volume;
    hornBp.connect(hornOut);
    hornOut.connect(this.ambienceGain);
    if (this.delayNode) {
      const echoSend = this.ctx.createGain();
      echoSend.gain.value = 0.55;
      hornOut.connect(echoSend);
      echoSend.connect(this.delayNode);
    }

    // 1. Brief nostalgic PA horn chime / attention tone ("Ding-dong!")
    const chimeNotes = [784, 988];
    for (let i = 0; i < chimeNotes.length; i++) {
      const t = now + i * 0.22;
      const chime = this.ctx.createOscillator();
      chime.type = 'triangle';
      chime.frequency.setValueAtTime(chimeNotes[i], t);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.55, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      chime.connect(env);
      env.connect(hornBp);
      chime.start(t);
      chime.stop(t + 0.3);
    }

    // 2. Subtle horn static hiss during announcement
    if (this.whiteNoise) {
      const staticSrc = this.ctx.createBufferSource();
      staticSrc.buffer = this.whiteNoise;
      const sEnv = this.ctx.createGain();
      sEnv.gain.setValueAtTime(0.0001, now + 0.45);
      sEnv.gain.linearRampToValueAtTime(0.11, now + 0.55);
      sEnv.gain.setValueAtTime(0.11, now + 2.35);
      sEnv.gain.exponentialRampToValueAtTime(0.0001, now + 2.55);
      staticSrc.connect(sEnv);
      sEnv.connect(hornBp);
      staticSrc.start(now + 0.45);
      staticSrc.stop(now + 2.58);
    }

    // 3. Muffled distant loudspeaker speech cadence (warm village PA rhythm)
    let t = now + 0.55;
    const phrasePitches = [185, 205, 195, 220, 190, 0, 200, 215, 180, 172];
    for (let i = 0; i < phrasePitches.length; i++) {
      const p = phrasePitches[i];
      if (p === 0) {
        t += 0.22;
        continue;
      }
      const dur = 0.14 + (i % 3) * 0.035;
      const voice = this.ctx.createOscillator();
      voice.type = 'sawtooth';
      voice.frequency.setValueAtTime(p, t);
      voice.frequency.linearRampToValueAtTime(p * 1.08, t + dur * 0.5);
      voice.frequency.linearRampToValueAtTime(p * 0.94, t + dur);

      const vEnv = this.ctx.createGain();
      vEnv.gain.setValueAtTime(0.0001, t);
      vEnv.gain.linearRampToValueAtTime(0.35, t + 0.025);
      vEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      voice.connect(vEnv);
      vEnv.connect(hornBp);
      voice.start(t);
      voice.stop(t + dur + 0.02);
      t += dur + 0.035;
    }
  }

  // ---------------------------------------------------------------------------
  // Level 4 Old Market Atmospheric Sounds (Bazaar Chatter & Vendor Calls)
  // ---------------------------------------------------------------------------
  private playMarketChatter(volume: number): void {
    if (!this.ctx || !this.ambienceGain || volume < 0.005) return;
    const now = this.ctx.currentTime;
    const voices = 2 + Math.floor(Math.random() * 2);

    for (let v = 0; v < voices; v++) {
      let t = now + v * (0.16 + Math.random() * 0.24);
      const basePitch = 140 + Math.random() * 145;
      const syllables = 4 + Math.floor(Math.random() * 4);

      for (let i = 0; i < syllables; i++) {
        const dur = 0.08 + Math.random() * 0.08;
        const osc = this.ctx.createOscillator();
        osc.type = v % 2 === 0 ? 'triangle' : 'sawtooth';
        const p = basePitch * (0.9 + Math.random() * 0.22);
        osc.frequency.setValueAtTime(p, t);
        osc.frequency.linearRampToValueAtTime(p * (0.96 + Math.random() * 0.12), t + dur);

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 540 + Math.random() * 480;
        bp.Q.value = 2.6;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(volume * 0.55, t + 0.018);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(bp);
        bp.connect(env);
        env.connect(this.ambienceGain);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        t += dur + 0.04 + Math.random() * 0.05;
      }
    }
  }

  /** Melodic 1990s Indian shopkeeper / sabzi-vendor call cadence to passing shoppers */
  private playMarketVendorCall(volume: number): void {
    if (!this.ctx || !this.ambienceGain || volume < 0.005) return;
    const now = this.ctx.currentTime;

    // Characteristic sing-song 4-syllable Indian market hawker contour (e.g. "Taaza sabzi le lo!")
    const base = 175 + Math.random() * 55;
    const ratios = Math.random() < 0.5 ? [1.0, 1.18, 1.32, 1.12] : [1.15, 1.34, 1.24, 0.96];
    const durs = [0.16, 0.14, 0.24, 0.34];
    let t = now;

    for (let i = 0; i < ratios.length; i++) {
      const dur = durs[i];
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const fStart = base * ratios[i];
      osc.frequency.setValueAtTime(fStart, t);
      osc.frequency.linearRampToValueAtTime(
        fStart * (i === ratios.length - 1 ? 0.88 : 1.07),
        t + dur,
      );

      const formant = this.ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(860 + i * 110, t);
      formant.Q.value = 3.2;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1750;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume * (i === 2 ? 1.1 : 0.85), t + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(formant);
      formant.connect(lp);
      lp.connect(env);
      env.connect(this.ambienceGain);
      if (this.delayNode) env.connect(this.delayNode);

      osc.start(t);
      osc.stop(t + dur + 0.04);
      t += dur + 0.055;
    }
  }

  /** Subtle brass weighing-scale pan / stainless-steel chai cup clink */
  private playBazaarClink(volume: number): void {
    if (!this.ctx || !this.ambienceGain || volume < 0.004) return;
    const now = this.ctx.currentTime;
    const strikes = Math.random() < 0.5 ? 2 : 3;

    for (let i = 0; i < strikes; i++) {
      const t = now + i * (0.11 + Math.random() * 0.06);
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2100 + Math.random() * 680, t);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(volume, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      osc.connect(env);
      env.connect(this.ambienceGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  }

  // ---------------------------------------------------------------------------
  // Level 6 Haunted Haveli Atmospheric Sounds (Wind, Creaking Doors & Wood Floors)
  // ---------------------------------------------------------------------------
  private playHaveliWindGust(volume: number): void {
    if (!this.ctx || !this.ambienceGain || !this.pinkNoise) return;
    const now = this.ctx.currentTime;
    const dur = 3.6 + Math.random() * 2.2;

    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoise;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const startFreq = 260 + Math.random() * 120;
    bp.frequency.setValueAtTime(startFreq, now);
    bp.frequency.exponentialRampToValueAtTime(startFreq * 1.95, now + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(startFreq * 0.85, now + dur);
    bp.Q.value = 3.2;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + dur * 0.38);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.ambienceGain);
    src.start(now, Math.random() * 1.5, dur + 0.08);
    src.stop(now + dur + 0.1);
  }

  private playHaveliDoorCreak(volume: number): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const dur = 0.85 + Math.random() * 0.55;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const base = 185 + Math.random() * 95;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + dur * 0.42);
    osc.frequency.exponentialRampToValueAtTime(base * 0.92, now + dur);

    // Subtle hinge stick-slip modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 18 + Math.random() * 10;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 14;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 720 + Math.random() * 260;
    bp.Q.value = 5.5;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.14);
    env.gain.linearRampToValueAtTime(volume * 0.65, now + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(bp);
    bp.connect(env);
    env.connect(this.ambienceGain);
    if (this.delayNode) env.connect(this.delayNode);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + dur + 0.05);
    lfo.stop(now + dur + 0.05);
  }

  private playHaveliWoodCreak(volume: number, dest?: AudioNode | null): void {
    if (!this.ctx) return;
    const out = dest ?? this.ambienceGain;
    if (!out) return;
    const now = this.ctx.currentTime;
    const dur = 0.24 + Math.random() * 0.18;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const p = 135 + Math.random() * 75;
    osc.frequency.setValueAtTime(p, now);
    osc.frequency.exponentialRampToValueAtTime(p * 1.32, now + dur * 0.5);
    osc.frequency.exponentialRampToValueAtTime(p * 0.78, now + dur);

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 460;
    bp.Q.value = 4.2;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(bp);
    bp.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.04);
  }

  /**
   * Spooky Skeleton Vampire apparition sound for Bhutiya Haveli (Level 6):
   * chilling spectral draft, hollow gothic resonance, and eerie echoing vampire laugh.
   */
  public playVampireAppearSound(distanceToCamera: number): void {
    if (
      !this.unlocked ||
      !this.ctx ||
      !this.ambienceGain ||
      this.settings.muted ||
      this.activeLevelId !== 6
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    const prox = Math.max(0.28, proximityGain(distanceToCamera, 9, 52));
    const baseVol = 0.22 * prox;

    // 1. Cold spectral mist whoosh as the vampire materializes
    if (this.pinkNoise) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.pinkNoise;
      noise.loop = true;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(220, now);
      bp.frequency.exponentialRampToValueAtTime(920, now + 0.75);
      bp.frequency.exponentialRampToValueAtTime(280, now + 2.1);
      bp.Q.value = 2.6;

      const nEnv = this.ctx.createGain();
      nEnv.gain.setValueAtTime(0.0001, now);
      nEnv.gain.linearRampToValueAtTime(baseVol * 0.75, now + 0.45);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

      noise.connect(bp);
      bp.connect(nEnv);
      nEnv.connect(this.ambienceGain);
      if (this.delayNode) nEnv.connect(this.delayNode);
      noise.start(now, Math.random() * 1.2, 2.3);
      noise.stop(now + 2.35);
    }

    // 2. Haunting gothic minor-second bowed chord swell (low eerie tension)
    for (const freq of [110, 116.54, 220]) {
      const drone = this.ctx.createOscillator();
      drone.type = 'triangle';
      drone.frequency.setValueAtTime(freq, now);
      drone.frequency.linearRampToValueAtTime(freq * 0.96, now + 2.2);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 540;

      const dEnv = this.ctx.createGain();
      dEnv.gain.setValueAtTime(0.0001, now);
      dEnv.gain.linearRampToValueAtTime(baseVol * 0.24, now + 0.55);
      dEnv.gain.exponentialRampToValueAtTime(0.0001, now + 2.3);

      drone.connect(lp);
      lp.connect(dEnv);
      dEnv.connect(this.ambienceGain);
      drone.start(now);
      drone.stop(now + 2.35);
    }

    // 3. Creepy hollow echoing skeleton vampire laugh ("Haa-ha-ha-ha-haa...")
    const laughSyllables = [
      { offset: 0.32, pitch: 238, dur: 0.28, amp: 0.85 },
      { offset: 0.64, pitch: 218, dur: 0.24, amp: 1.0 },
      { offset: 0.92, pitch: 196, dur: 0.22, amp: 0.95 },
      { offset: 1.18, pitch: 174, dur: 0.24, amp: 0.85 },
      { offset: 1.46, pitch: 148, dur: 0.42, amp: 0.72 },
    ];

    for (const syl of laughSyllables) {
      const t0 = now + syl.offset;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(syl.pitch * 1.06, t0);
      osc.frequency.exponentialRampToValueAtTime(syl.pitch * 0.84, t0 + syl.dur);

      // Sinister skeletal vocal tremble (LFO vibrato)
      const vib = this.ctx.createOscillator();
      vib.type = 'sine';
      vib.frequency.value = 11.5;
      const vibGain = this.ctx.createGain();
      vibGain.gain.value = 9.5;
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      // Dual formant bandpass filters for hollow raspy vampire voice timbre
      const f1 = this.ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 560;
      f1.Q.value = 4.6;

      const f2 = this.ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 1380;
      f2.Q.value = 5.2;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(baseVol * 0.65 * syl.amp, t0 + 0.045);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + syl.dur);

      osc.connect(f1);
      osc.connect(f2);
      f1.connect(env);
      f2.connect(env);
      env.connect(this.ambienceGain);
      if (this.delayNode) env.connect(this.delayNode);

      osc.start(t0);
      vib.start(t0);
      osc.stop(t0 + syl.dur + 0.05);
      vib.stop(t0 + syl.dur + 0.05);
    }
  }

  /** Mysterious smoky fade-out whoosh when the Skeleton Vampire disappears in Bhutiya Haveli */
  public playVampireDisappearSound(distanceToCamera: number): void {
    if (
      !this.unlocked ||
      !this.ctx ||
      !this.ambienceGain ||
      !this.pinkNoise ||
      this.settings.muted ||
      this.activeLevelId !== 6
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    const prox = Math.max(0.24, proximityGain(distanceToCamera, 9, 52));
    const vol = 0.16 * prox;

    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkNoise;
    src.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1180, now);
    bp.frequency.exponentialRampToValueAtTime(240, now + 1.35);
    bp.Q.value = 3.4;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.ambienceGain);
    if (this.delayNode) env.connect(this.delayNode);

    src.start(now, Math.random() * 1.4, 1.5);
    src.stop(now + 1.55);
  }

  // ---------------------------------------------------------------------------
  // 2. Dynamic Footsteps (Walking vs Running vs Sneaking)
  // ---------------------------------------------------------------------------
  private updateFootsteps(
    dt: number,
    animState: CharacterAnimState,
    moveSpeed: number,
    listenerY = 0,
  ): void {
    if (
      moveSpeed < 0.2 ||
      (animState !== 'walk' && animState !== 'run' && animState !== 'sneak')
    ) {
      this.footstepTimer = Math.min(this.footstepTimer, 0.08);
      return;
    }

    this.footstepTimer -= dt;
    if (this.footstepTimer > 0) return;

    this.stepToggle = !this.stepToggle;

    if (animState === 'run') {
      this.footstepTimer = 0.27;
      this.playFootstep('run', this.stepToggle, listenerY);
    } else if (animState === 'sneak') {
      this.footstepTimer = 0.54;
      this.playFootstep('sneak', this.stepToggle, listenerY);
    } else {
      this.footstepTimer = 0.42;
      this.playFootstep('walk', this.stepToggle, listenerY);
    }
  }

  private playFootstep(
    mode: 'walk' | 'run' | 'sneak',
    alt: boolean,
    listenerY = 0,
  ): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoise) return;
    const now = this.ctx.currentTime;
    const pitchJitter = alt ? 1.06 : 0.94;
    const inHaveli = this.activeLevelId === 6;
    const onWoodBalcony = inHaveli && listenerY >= 2.2 && listenerY < 5.4;

    // 1. Dusty dirt / hollow haveli stone or wood scuff texture
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.pinkNoise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const nEnv = this.ctx.createGain();

    if (mode === 'run') {
      filter.frequency.setValueAtTime((inHaveli ? 1480 : 1750) * pitchJitter, now);
      filter.Q.value = inHaveli ? 1.6 : 1.2;
      nEnv.gain.setValueAtTime(0.0001, now);
      nEnv.gain.linearRampToValueAtTime(0.28, now + 0.01);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    } else if (mode === 'sneak') {
      filter.frequency.setValueAtTime(680 * pitchJitter, now);
      filter.Q.value = 1.8;
      nEnv.gain.setValueAtTime(0.0001, now);
      nEnv.gain.linearRampToValueAtTime(0.075, now + 0.02);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    } else {
      filter.frequency.setValueAtTime((inHaveli ? 1080 : 1250) * pitchJitter, now);
      filter.Q.value = inHaveli ? 1.8 : 1.4;
      nEnv.gain.setValueAtTime(0.0001, now);
      nEnv.gain.linearRampToValueAtTime(0.17, now + 0.012);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.078);
    }

    noise.connect(filter);
    filter.connect(nEnv);
    nEnv.connect(this.sfxGain);
    if (inHaveli && this.delayNode && mode !== 'sneak') {
      nEnv.connect(this.delayNode);
    }
    noise.start(now, Math.random() * 1.5, 0.12);

    // 2. Ground heel thump body (deeper wooden resonance on upper Haveli balconies)
    const thump = this.ctx.createOscillator();
    thump.type = onWoodBalcony ? 'triangle' : 'sine';
    const tEnv = this.ctx.createGain();
    if (mode === 'run') {
      thump.frequency.setValueAtTime((onWoodBalcony ? 155 : 132) * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(52, now + 0.075);
      tEnv.gain.setValueAtTime(0.0001, now);
      tEnv.gain.linearRampToValueAtTime(0.22, now + 0.006);
      tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    } else if (mode === 'sneak') {
      thump.frequency.setValueAtTime(78 * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(48, now + 0.055);
      tEnv.gain.setValueAtTime(0.0001, now);
      tEnv.gain.linearRampToValueAtTime(0.055, now + 0.01);
      tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    } else {
      thump.frequency.setValueAtTime((onWoodBalcony ? 124 : 102) * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(50, now + 0.065);
      tEnv.gain.setValueAtTime(0.0001, now);
      tEnv.gain.linearRampToValueAtTime(0.13, now + 0.008);
      tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    }
    thump.connect(tEnv);
    tEnv.connect(this.sfxGain);
    thump.start(now);
    thump.stop(now + 0.095);

    // 3. Occasional subtle wooden floorboard creak when moving on Haveli wooden floors
    if (inHaveli && mode !== 'sneak') {
      const creakChance = onWoodBalcony ? 0.28 : 0.09;
      if (Math.random() < creakChance) {
        this.playHaveliWoodCreak(mode === 'run' ? 0.11 : 0.07, this.sfxGain);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Gameplay SFX: Hiding, Seeking, Tagging & Game Winning
  // ---------------------------------------------------------------------------
  public playHide(isHiding: boolean): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain || !this.pinkNoise) {
      return;
    }
    const now = this.ctx.currentTime;

    // Soft cotton cloth rustle
    const rustle = this.ctx.createBufferSource();
    rustle.buffer = this.pinkNoise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isHiding ? 1150 : 780, now);
    bp.frequency.exponentialRampToValueAtTime(isHiding ? 620 : 1450, now + 0.16);
    bp.Q.value = 1.6;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.24, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    rustle.connect(bp);
    bp.connect(env);
    env.connect(this.sfxGain);
    rustle.start(now, Math.random() * 1.2, 0.22);

    // Subtle tonal settle cue
    const cue = this.ctx.createOscillator();
    cue.type = 'sine';
    cue.frequency.setValueAtTime(isHiding ? 320 : 240, now);
    cue.frequency.exponentialRampToValueAtTime(isHiding ? 185 : 370, now + 0.13);
    const cEnv = this.ctx.createGain();
    cEnv.gain.setValueAtTime(0.0001, now);
    cEnv.gain.linearRampToValueAtTime(0.09, now + 0.015);
    cEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    cue.connect(cEnv);
    cEnv.connect(this.sfxGain);
    cue.start(now);
    cue.stop(now + 0.17);
  }

  public playCountdownTick(secondsLeft: number): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const base = secondsLeft <= 1 ? 520 : 390;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.78, now + 0.11);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.22, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Warm bamboo wood-tap sound for Main Menu navigation & unlocks Web Audio */
  public playUiClick(): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.055);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.14, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playSeekStart(): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [440, 587.33, 739.99];
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i], t);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.24, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    }
  }

  public playSeekerAlert(): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Dramatic quick village dhol-thump + rising alert string
    const notes = [293.66, 369.99];
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], t);
      osc.frequency.exponentialRampToValueAtTime(notes[i] * 1.07, t + 0.13);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.22, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.24);
    }
  }

  /** Playful "Dhappa!" hand-tag slap + funny cartoon caught boing & dizzy star chimes */
  public playTagCaught(): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 1. Crisp playful slap pop
    if (this.whiteNoise) {
      const slap = this.ctx.createBufferSource();
      slap.buffer = this.whiteNoise;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600;
      bp.Q.value = 1.4;
      const sEnv = this.ctx.createGain();
      sEnv.gain.setValueAtTime(0.0001, now);
      sEnv.gain.linearRampToValueAtTime(0.45, now + 0.006);
      sEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      slap.connect(bp);
      bp.connect(sEnv);
      sEnv.connect(this.sfxGain);
      slap.start(now, 0, 0.1);
    }

    // 2. Funny elastic boing-whistle matching the surprised jump & wobble animation
    const boing = this.ctx.createOscillator();
    boing.type = 'sine';
    boing.frequency.setValueAtTime(280, now + 0.03);
    boing.frequency.exponentialRampToValueAtTime(760, now + 0.16);
    boing.frequency.exponentialRampToValueAtTime(340, now + 0.34);
    boing.frequency.exponentialRampToValueAtTime(520, now + 0.48);

    const bEnv = this.ctx.createGain();
    bEnv.gain.setValueAtTime(0.0001, now + 0.03);
    bEnv.gain.linearRampToValueAtTime(0.32, now + 0.05);
    bEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.54);
    boing.connect(bEnv);
    bEnv.connect(this.sfxGain);
    boing.start(now + 0.03);
    boing.stop(now + 0.56);

    // 3. Orbiting dizzy-star sparkle notes
    const stars = [880, 1174.66, 987.77, 1318.51];
    for (let i = 0; i < stars.length; i++) {
      const t = now + 0.25 + i * 0.11;
      const star = this.ctx.createOscillator();
      star.type = 'triangle';
      star.frequency.setValueAtTime(stars[i], t);
      const stEnv = this.ctx.createGain();
      stEnv.gain.setValueAtTime(0.0001, t);
      stEnv.gain.linearRampToValueAtTime(0.14, t + 0.01);
      stEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      star.connect(stEnv);
      stEnv.connect(this.sfxGain);
      star.start(t);
      star.stop(t + 0.2);
    }
  }

  /** Playful comedic slap pop when one hider slaps another nearby hider */
  public playHiderSlap(): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 1. Crisp hand-clap / slap transient
    if (this.whiteNoise) {
      const slap = this.ctx.createBufferSource();
      slap.buffer = this.whiteNoise;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2100, now);
      bp.frequency.exponentialRampToValueAtTime(950, now + 0.085);
      bp.Q.value = 1.25;
      const sEnv = this.ctx.createGain();
      sEnv.gain.setValueAtTime(0.0001, now);
      sEnv.gain.linearRampToValueAtTime(0.52, now + 0.004);
      sEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      slap.connect(bp);
      bp.connect(sEnv);
      sEnv.connect(this.sfxGain);
      slap.start(now, Math.random() * 0.8, 0.11);
    }

    // 2. Quick playful "thwack-pop" pitch drop
    const pop = this.ctx.createOscillator();
    pop.type = 'triangle';
    pop.frequency.setValueAtTime(340, now);
    pop.frequency.exponentialRampToValueAtTime(145, now + 0.09);
    const pEnv = this.ctx.createGain();
    pEnv.gain.setValueAtTime(0.0001, now);
    pEnv.gain.linearRampToValueAtTime(0.28, now + 0.006);
    pEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    pop.connect(pEnv);
    pEnv.connect(this.sfxGain);
    pop.start(now);
    pop.stop(now + 0.12);
  }

  /** Celebratory 1990s Indian bansuri + brass chime victory fanfare (or gentle defeat cadence) */
  public playMatchEnd(playerWon: boolean): void {
    if (!this.ensureReady() || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    if (playerWon) {
      const melody = [293.66, 369.99, 440.0, 587.33, 659.25, 739.99, 880.0];
      const times = [0, 0.11, 0.22, 0.34, 0.48, 0.62, 0.78];
      for (let i = 0; i < melody.length; i++) {
        const t = now + times[i];
        const dur = i === melody.length - 1 ? 0.9 : 0.22;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(melody[i], t);

        const harm = this.ctx.createOscillator();
        harm.type = 'triangle';
        harm.frequency.setValueAtTime(melody[i] * 2, t);
        const hGain = this.ctx.createGain();
        hGain.gain.value = 0.16;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.28, t + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(env);
        harm.connect(hGain);
        hGain.connect(env);
        env.connect(this.sfxGain);
        if (this.delayNode) env.connect(this.delayNode);

        osc.start(t);
        harm.start(t);
        osc.stop(t + dur + 0.05);
        harm.stop(t + dur + 0.05);
      }

      // Celebratory temple bell shimmer on final victory note
      this.playTempleBell(0.2);
    } else {
      const melody = [493.88, 440.0, 369.99, 329.63, 293.66];
      for (let i = 0; i < melody.length; i++) {
        const t = now + i * 0.18;
        const dur = i === melody.length - 1 ? 0.75 : 0.26;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(melody[i], t);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.22, t + 0.025);
        env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(env);
        env.connect(this.sfxGain);
        if (this.delayNode) env.connect(this.delayNode);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.unbindUnlockListeners();

    for (const node of this.droneNodes) {
      try {
        node.stop();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.droneNodes = [];

    for (const node of this.cricketBedNodes) {
      try {
        node.stop();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.cricketBedNodes = [];

    if (this.delayFeedback) {
      this.delayFeedback.gain.value = 0;
    }

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
