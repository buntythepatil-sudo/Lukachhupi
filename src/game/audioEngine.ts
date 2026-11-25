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

  constructor(onSettingsChanged?: (settings: AudioSettings) => void) {
    this.onSettingsChanged = onSettingsChanged;
    this.bindUnlockListeners();
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
  ): void {
    if (this.disposed || !this.ctx || this.ctx.state !== 'running') return;

    this.updateBackgroundMusic(dt, phase);
    this.updateVillageAmbience(dt, listenerX, listenerZ);

    if (phase === 'playing') {
      this.updateFootsteps(dt, playerAnimState, playerMoveSpeed);
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
  // 2. Dynamic Footsteps (Walking vs Running vs Sneaking)
  // ---------------------------------------------------------------------------
  private updateFootsteps(
    dt: number,
    animState: CharacterAnimState,
    moveSpeed: number,
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
      this.playFootstep('run', this.stepToggle);
    } else if (animState === 'sneak') {
      this.footstepTimer = 0.54;
      this.playFootstep('sneak', this.stepToggle);
    } else {
      this.footstepTimer = 0.42;
      this.playFootstep('walk', this.stepToggle);
    }
  }

  private playFootstep(mode: 'walk' | 'run' | 'sneak', alt: boolean): void {
    if (!this.ctx || !this.sfxGain || !this.pinkNoise) return;
    const now = this.ctx.currentTime;
    const pitchJitter = alt ? 1.06 : 0.94;

    // 1. Dusty dirt scuff texture
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.pinkNoise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const nEnv = this.ctx.createGain();

    if (mode === 'run') {
      filter.frequency.setValueAtTime(1750 * pitchJitter, now);
      filter.Q.value = 1.2;
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
      filter.frequency.setValueAtTime(1250 * pitchJitter, now);
      filter.Q.value = 1.4;
      nEnv.gain.setValueAtTime(0.0001, now);
      nEnv.gain.linearRampToValueAtTime(0.17, now + 0.012);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.078);
    }

    noise.connect(filter);
    filter.connect(nEnv);
    nEnv.connect(this.sfxGain);
    noise.start(now, Math.random() * 1.5, 0.12);

    // 2. Ground heel thump body
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    const tEnv = this.ctx.createGain();
    if (mode === 'run') {
      thump.frequency.setValueAtTime(132 * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(52, now + 0.07);
      tEnv.gain.setValueAtTime(0.0001, now);
      tEnv.gain.linearRampToValueAtTime(0.22, now + 0.006);
      tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    } else if (mode === 'sneak') {
      thump.frequency.setValueAtTime(78 * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(48, now + 0.055);
      tEnv.gain.setValueAtTime(0.0001, now);
      tEnv.gain.linearRampToValueAtTime(0.055, now + 0.01);
      tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    } else {
      thump.frequency.setValueAtTime(102 * pitchJitter, now);
      thump.frequency.exponentialRampToValueAtTime(50, now + 0.06);
      tEnv.gain.setValueAtTime(0.0001, now);
      tEnv.gain.linearRampToValueAtTime(0.13, now + 0.008);
      tEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    }
    thump.connect(tEnv);
    tEnv.connect(this.sfxGain);
    thump.start(now);
    thump.stop(now + 0.09);
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
