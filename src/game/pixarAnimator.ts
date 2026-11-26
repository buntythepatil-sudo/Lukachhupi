import * as THREE from 'three';

/**
 * Reusable zero-GC Pixar-style 3D procedural animation system.
 * Drives squash-and-stretch, pendulum follow-through, orbital flyers,
 * mechanical carnival rides, fountains, steam/smoke puffs, waves, and snowfall
 * with smooth frame-rate-independent motion optimized for Android & desktop GPUs.
 */

export type PixarUpdateFn = (elapsed: number, dt: number) => void;

export class PixarAnimator {
  private readonly updaters: PixarUpdateFn[] = [];

  public add(fn: PixarUpdateFn): void {
    this.updaters.push(fn);
  }

  public update(elapsed: number, dt: number): void {
    for (let i = 0; i < this.updaters.length; i++) {
      this.updaters[i](elapsed, dt);
    }
  }

  /**
   * Classic Pixar harmonic squash-and-stretch breathing/bobbing on any decorative prop.
   */
  public addSquashBob(
    obj: THREE.Object3D,
    opts: {
      baseY: number;
      bobAmp?: number;
      squashAmp?: number;
      speed?: number;
      phase?: number;
      tiltAmp?: number;
    },
  ): void {
    const {
      baseY,
      bobAmp = 0.08,
      squashAmp = 0.045,
      speed = 2.4,
      phase = 0,
      tiltAmp = 0.03,
    } = opts;
    this.updaters.push((t) => {
      const s = Math.sin(t * speed + phase);
      const c = Math.cos(t * speed + phase);
      obj.position.y = baseY + (s * 0.5 + 0.5) * bobAmp;
      const sy = 1 + c * squashAmp;
      const sxz = 1 / Math.sqrt(Math.max(0.7, sy));
      obj.scale.set(sxz, sy, sxz);
      if (tiltAmp > 0) {
        obj.rotation.z = Math.sin(t * speed * 0.5 + phase) * tiltAmp;
      }
    });
  }

  /**
   * Expressive hanging pendulum sway (lanterns, banners, signs, bells) with subtle secondary twist.
   */
  public addPendulumSway(
    obj: THREE.Object3D,
    opts: {
      ampX?: number;
      ampZ?: number;
      speed?: number;
      phase?: number;
    } = {},
  ): void {
    const { ampX = 0.06, ampZ = 0.11, speed = 1.9, phase = 0 } = opts;
    this.updaters.push((t) => {
      obj.rotation.z =
        Math.sin(t * speed + phase) * ampZ +
        Math.sin(t * speed * 2.1 + phase * 1.4) * ampZ * 0.18;
      obj.rotation.x = Math.cos(t * speed * 0.85 + phase) * ampX;
    });
  }

  /**
   * Builds and animates a Pixar-style curling steam/smoke puff plume (chimneys, kettles, locomotives).
   */
  public addSteamPlume(
    parent: THREE.Object3D,
    origin: { x: number; y: number; z: number },
    opts: {
      count?: number;
      color?: number;
      riseHeight?: number;
      speed?: number;
      baseRadius?: number;
      driftX?: number;
      driftZ?: number;
    } = {},
  ): void {
    const {
      count = 7,
      color = 0xf4f7fb,
      riseHeight = 3.2,
      speed = 0.42,
      baseRadius = 0.2,
      driftX = 0.55,
      driftZ = 0.25,
    } = opts;

    const geo = new THREE.SphereGeometry(baseRadius, 10, 8);
    const puffs: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; offset: number }> = [];

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(origin.x, origin.y, origin.z);
      parent.add(mesh);
      puffs.push({ mesh, mat, offset: i / count });
    }

    this.updaters.push((t) => {
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        const u = (t * speed + p.offset) % 1;
        const easeOut = 1 - Math.pow(1 - u, 2);
        const swirl = Math.sin(u * Math.PI * 3 + i * 1.7) * 0.18 * u;
        p.mesh.position.set(
          origin.x + driftX * easeOut + swirl,
          origin.y + riseHeight * u,
          origin.z + driftZ * easeOut + Math.cos(u * Math.PI * 2.5 + i) * 0.14 * u,
        );
        // Pixar squash-expand as puff rises
        const scaleXZ = 0.55 + easeOut * 1.65;
        const scaleY = 0.48 + easeOut * 1.35 + Math.sin(u * Math.PI) * 0.18;
        p.mesh.scale.set(scaleXZ, scaleY, scaleXZ);
        p.mat.opacity = Math.sin(u * Math.PI) * 0.52;
      }
    });
  }

  /**
   * Builds and animates a flock of expressive 2-wing flapping birds, seagulls, or butterflies
   * gliding along smooth Lissajous / circular figure-8 trajectories with realistic banking.
   */
  public addFlyingCritters(
    parent: THREE.Object3D,
    opts: {
      kind: 'bird' | 'seagull' | 'butterfly';
      count: number;
      centerX: number;
      centerZ: number;
      radiusX: number;
      radiusZ: number;
      minY: number;
      maxY: number;
      colors: number[];
    },
  ): void {
    const isButterfly = opts.kind === 'butterfly';
    const isSeagull = opts.kind === 'seagull';
    const bodyGeo = isButterfly
      ? new THREE.CapsuleGeometry(0.025, 0.1, 4, 6)
      : new THREE.SphereGeometry(isSeagull ? 0.14 : 0.1, 8, 6);
    const wingGeo = isButterfly
      ? new THREE.CircleGeometry(0.14, 7)
      : new THREE.BoxGeometry(isSeagull ? 0.48 : 0.28, 0.028, isSeagull ? 0.18 : 0.13);

    interface Critter {
      root: THREE.Group;
      leftWing: THREE.Object3D;
      rightWing: THREE.Object3D;
      phase: number;
      speed: number;
      rX: number;
      rZ: number;
      yBase: number;
      yAmp: number;
      flapSpeed: number;
      freqX: number;
      freqZ: number;
    }

    const list: Critter[] = [];

    for (let i = 0; i < opts.count; i++) {
      const root = new THREE.Group();
      const tint = opts.colors[i % opts.colors.length];
      const bodyMat = new THREE.MeshStandardMaterial({
        color: isButterfly ? 0x2a2018 : isSeagull ? 0xfbfdff : tint,
        roughness: 0.48,
      });
      const wingMat = new THREE.MeshStandardMaterial({
        color: tint,
        roughness: 0.42,
        side: THREE.DoubleSide,
      });

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      if (isButterfly) {
        body.rotation.x = Math.PI / 2;
      } else {
        body.scale.set(0.85, 0.72, 1.45);
      }
      root.add(body);

      if (!isButterfly) {
        const beak = new THREE.Mesh(
          new THREE.ConeGeometry(0.036, 0.12, 5),
          new THREE.MeshStandardMaterial({ color: 0xf09b28, roughness: 0.4 }),
        );
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.01, isSeagull ? 0.22 : 0.15);
        root.add(beak);
      }

      const leftWingPivot = new THREE.Group();
      const rightWingPivot = new THREE.Group();
      const lw = new THREE.Mesh(wingGeo, wingMat);
      const rw = new THREE.Mesh(wingGeo, wingMat);
      if (isButterfly) {
        lw.rotation.x = -Math.PI / 2;
        rw.rotation.x = -Math.PI / 2;
        lw.position.set(-0.12, 0, 0);
        rw.position.set(0.12, 0, 0);
      } else {
        const half = isSeagull ? 0.24 : 0.14;
        lw.position.set(-half, 0, 0);
        rw.position.set(half, 0, 0);
      }
      leftWingPivot.add(lw);
      rightWingPivot.add(rw);
      root.add(leftWingPivot, rightWingPivot);
      parent.add(root);

      const tFrac = i / Math.max(1, opts.count);
      list.push({
        root,
        leftWing: leftWingPivot,
        rightWing: rightWingPivot,
        phase: tFrac * Math.PI * 2,
        speed: (isButterfly ? 0.55 : isSeagull ? 0.28 : 0.36) * (0.82 + (i % 4) * 0.1),
        rX: opts.radiusX * (0.65 + (i % 3) * 0.22),
        rZ: opts.radiusZ * (0.65 + ((i + 1) % 3) * 0.22),
        yBase: opts.minY + (opts.maxY - opts.minY) * ((i * 0.37) % 1),
        yAmp: isButterfly ? 0.55 : 0.85,
        flapSpeed: isButterfly ? 15.5 : isSeagull ? 5.6 : 9.8,
        freqX: 1,
        freqZ: i % 2 === 0 ? 1 : 2,
      });
    }

    this.updaters.push((t) => {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const a = t * c.speed + c.phase;
        const x = opts.centerX + Math.sin(a * c.freqX) * c.rX;
        const z = opts.centerZ + Math.cos(a * c.freqZ) * c.rZ;
        const y = c.yBase + Math.sin(a * 2.1 + c.phase) * c.yAmp;

        const vx = Math.cos(a * c.freqX) * c.freqX * c.rX * c.speed;
        const vz = -Math.sin(a * c.freqZ) * c.freqZ * c.rZ * c.speed;
        c.root.position.set(x, y, z);
        c.root.rotation.y = Math.atan2(vx, vz);
        c.root.rotation.z = -Math.sin(a) * (isButterfly ? 0.2 : 0.32);

        const flap =
          Math.sin(t * c.flapSpeed + c.phase * 3) * (isButterfly ? 0.95 : 0.62);
        c.leftWing.rotation.z = flap;
        c.rightWing.rotation.z = -flap;
      }
    });
  }

  /**
   * Builds and animates a Pixar-grade dancing water fountain with synchronized
   * parabolic arcing droplet streams and expanding splash rings!
   */
  public addDancingFountain(
    parent: THREE.Object3D,
    x: number,
    z: number,
    opts: {
      basinRadius?: number;
      jetHeight?: number;
      streamCount?: number;
      waterColor?: number;
      stoneColor?: number;
    } = {},
  ): void {
    const {
      basinRadius = 3.2,
      jetHeight = 3.6,
      streamCount = 8,
      waterColor = 0x58d4ec,
      stoneColor = 0xe8decb,
    } = opts;

    const fountain = new THREE.Group();
    fountain.position.set(x, 0, z);
    parent.add(fountain);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: stoneColor,
      roughness: 0.68,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdca944,
      roughness: 0.28,
      metalness: 0.82,
    });
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: waterColor,
      roughness: 0.12,
      metalness: 0.06,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.84,
    });

    // Octagonal stepped basin
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(basinRadius, basinRadius + 0.18, 0.56, 12),
      stoneMat,
    );
    rim.position.y = 0.28;
    rim.castShadow = true;
    rim.receiveShadow = true;
    fountain.add(rim);

    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(basinRadius - 0.26, basinRadius - 0.26, 0.12, 16),
      waterMat,
    );
    pool.position.y = 0.52;
    fountain.add(pool);

    // Sculpted lotus tier pedestal
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.48, 1.45, 10),
      stoneMat,
    );
    stem.position.y = 1.05;
    stem.castShadow = true;
    fountain.add(stem);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 0.42, 0.36, 12),
      stoneMat,
    );
    bowl.position.y = 1.72;
    bowl.castShadow = true;
    fountain.add(bowl);

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      brassMat,
    );
    finial.position.y = 2.04;
    fountain.add(finial);

    // Animated parabolic droplet arcs (zero GC InstancedMesh!)
    const dropsPerStream = 6;
    const totalDrops = streamCount * dropsPerStream + 8;
    const dropGeo = new THREE.SphereGeometry(0.085, 6, 6);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xbaf4ff,
      emissive: 0x266a80,
      emissiveIntensity: 0.28,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });
    const inst = new THREE.InstancedMesh(dropGeo, dropMat, totalDrops);
    inst.frustumCulled = false;
    fountain.add(inst);

    // Expanding splash rings on pool water surface
    const splashRings: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; phase: number }> = [];
    const ringGeo = new THREE.RingGeometry(0.18, 0.28, 18);
    for (let i = 0; i < 4; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xdffbff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, rMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.6;
      fountain.add(ring);
      splashRings.push({ mesh: ring, mat: rMat, phase: i * 0.25 });
    }

    const dummy = new THREE.Object3D();

    this.updaters.push((t) => {
      let idx = 0;
      const pulse = 0.86 + Math.sin(t * 2.2) * 0.16;

      // Side parabolic arcing streams
      for (let s = 0; s < streamCount; s++) {
        const ang = (s / streamCount) * Math.PI * 2 + Math.sin(t * 0.45) * 0.18;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        for (let d = 0; d < dropsPerStream; d++) {
          const u = (t * 0.95 + d / dropsPerStream + s * 0.07) % 1;
          const dist = 0.22 + u * (basinRadius - 0.85);
          const arcY = 2.02 + Math.sin(u * Math.PI) * (jetHeight * 0.42 * pulse) - u * 1.44;
          dummy.position.set(cosA * dist, Math.max(0.58, arcY), sinA * dist);
          const sc = 0.72 + Math.sin(u * Math.PI) * 0.55;
          dummy.scale.set(sc * 0.85, sc * 1.25, sc * 0.85);
          dummy.updateMatrix();
          inst.setMatrixAt(idx++, dummy.matrix);
        }
      }

      // Central vertical geyser plume
      for (let c = 0; c < 8; c++) {
        const u = (t * 1.15 + c / 8) % 1;
        const gy = 2.06 + Math.sin(u * Math.PI) * (jetHeight * 0.58 * pulse);
        const spread = u * 0.22;
        const ca = c * 1.7 + t * 2.2;
        dummy.position.set(Math.cos(ca) * spread, gy, Math.sin(ca) * spread);
        const sc = 0.65 + (1 - Math.abs(u - 0.5) * 2) * 0.8;
        dummy.scale.set(sc, sc * 1.35, sc);
        dummy.updateMatrix();
        inst.setMatrixAt(idx++, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < splashRings.length; i++) {
        const sr = splashRings[i];
        const u = (t * 0.7 + sr.phase) % 1;
        const sc = 0.8 + u * (basinRadius * 2.5);
        sr.mesh.scale.set(sc, sc, 1);
        sr.mat.opacity = (1 - u) * 0.48;
      }
    });
  }

  /**
   * Builds and animates a Giant Glowing Indian Mela Ferris Wheel (Charkhi)
   * with counterweighted swinging passenger gondolas & chasing carnival lights!
   */
  public addFerrisWheel(
    parent: THREE.Object3D,
    x: number,
    z: number,
    opts: { radius?: number; gondolas?: number; rotY?: number } = {},
  ): void {
    const { radius = 7.4, gondolas = 10, rotY = 0 } = opts;
    const hubY = radius + 2.4;

    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = rotY;
    parent.add(root);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xd94336,
      roughness: 0.42,
      metalness: 0.35,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf4c44e,
      roughness: 0.3,
      metalness: 0.72,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3b2a22,
      roughness: 0.78,
    });

    // Platform base
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.55, 5.2), baseMat);
    base.position.y = 0.275;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    // A-frame support legs on front & back
    const legLen = Math.hypot(hubY, 2.35);
    const legGeo = new THREE.CylinderGeometry(0.16, 0.22, legLen, 8);
    for (const sideZ of [-1.45, 1.45]) {
      for (const tilt of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(tilt * 1.18, hubY * 0.5, sideZ);
        leg.rotation.z = tilt * 0.23;
        leg.castShadow = true;
        root.add(leg);
      }
    }

    // Main rotating wheel assembly
    const wheel = new THREE.Group();
    wheel.position.set(0, hubY, 0);
    root.add(wheel);

    // Dual structural rims
    const rimGeo = new THREE.TorusGeometry(radius, 0.16, 8, 32);
    const innerRimGeo = new THREE.TorusGeometry(radius * 0.62, 0.11, 8, 24);
    for (const rz of [-0.95, 0.95]) {
      const rim = new THREE.Mesh(rimGeo, goldMat);
      rim.position.z = rz;
      rim.castShadow = true;
      wheel.add(rim);

      const innerRim = new THREE.Mesh(innerRimGeo, frameMat);
      innerRim.position.z = rz;
      wheel.add(innerRim);
    }

    // Center hub + starburst medallion
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 2.6, 12),
      goldMat,
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    const gondolaColors = [
      0xf25c43, 0x33a6b8, 0xf2ba36, 0xd84c8e, 0x45a866,
      0xe67b35, 0x6765d4, 0xe84855, 0x2fb38b, 0xf2a12c,
    ];
    const gondolaPivots: Array<{ pivot: THREE.Group; phase: number }> = [];
    const bulbMats: THREE.MeshBasicMaterial[] = [];

    const spokeGeo = new THREE.CylinderGeometry(0.06, 0.06, radius * 2, 6);
    const barGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.05, 6);
    const bulbGeo = new THREE.SphereGeometry(0.16, 6, 6);

    for (let i = 0; i < gondolas; i++) {
      const ang = (i / gondolas) * Math.PI * 2;
      const gx = Math.cos(ang) * radius;
      const gy = Math.sin(ang) * radius;

      if (i < gondolas / 2) {
        for (const rz of [-0.95, 0.95]) {
          const spoke = new THREE.Mesh(spokeGeo, frameMat);
          spoke.position.z = rz;
          spoke.rotation.z = ang;
          wheel.add(spoke);
        }
      }

      // Glowing carnival light bulb at each rim node
      const bMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffe478 : 0xff78b4,
      });
      bulbMats.push(bMat);
      for (const rz of [-1.08, 1.08]) {
        const bulb = new THREE.Mesh(bulbGeo, bMat);
        bulb.position.set(gx, gy, rz);
        wheel.add(bulb);
      }

      // Crossbar & counter-rotating passenger cabin
      const pivot = new THREE.Group();
      pivot.position.set(gx, gy, 0);
      wheel.add(pivot);

      const bar = new THREE.Mesh(barGeo, goldMat);
      bar.rotation.x = Math.PI / 2;
      pivot.add(bar);

      const cabinMat = new THREE.MeshStandardMaterial({
        color: gondolaColors[i % gondolaColors.length],
        roughness: 0.36,
        metalness: 0.12,
      });
      // Hanger rods
      for (const hz of [-0.58, 0.58]) {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, 0.95, 5),
          goldMat,
        );
        rod.position.set(0, -0.48, hz);
        pivot.add(rod);
      }
      // Rounded carnival gondola basket + canopy roof
      const basket = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.72, 1.25),
        cabinMat,
      );
      basket.position.set(0, -1.12, 0);
      basket.castShadow = true;
      pivot.add(basket);

      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(0.88, 0.42, 4),
        goldMat,
      );
      canopy.rotation.y = Math.PI / 4;
      canopy.position.set(0, -0.22, 0);
      pivot.add(canopy);

      gondolaPivots.push({ pivot, phase: i * 0.75 });
    }

    this.updaters.push((t) => {
      const wheelAngle = t * 0.36;
      wheel.rotation.z = wheelAngle;
      for (let i = 0; i < gondolaPivots.length; i++) {
        const g = gondolaPivots[i];
        // Counter-rotate to stay upright + gentle playful pendulum swing!
        g.pivot.rotation.z =
          -wheelAngle + Math.sin(t * 1.9 + g.phase) * 0.075;
      }
      // Chasing marquee carnival lights
      const chaseIdx = Math.floor(t * 6) % bulbMats.length;
      for (let i = 0; i < bulbMats.length; i++) {
        const bright = (i + chaseIdx) % 3 === 0;
        bulbMats[i].color.setHex(
          bright ? 0xfff5b0 : i % 2 === 0 ? 0xff9238 : 0xff4fa0,
        );
      }
    });
  }

  /**
   * Builds and animates a Pixar-style Merry-Go-Round Carousel with 8 bobbing painted horses!
   */
  public addCarousel(parent: THREE.Object3D, x: number, z: number): void {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    parent.add(root);

    const deckMat = new THREE.MeshStandardMaterial({ color: 0xf4e3c1, roughness: 0.58 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd93b44, roughness: 0.42 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf5c342,
      roughness: 0.25,
      metalness: 0.78,
    });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x26899e, roughness: 0.48 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.5, 0.45, 20), trimMat);
    base.position.y = 0.225;
    base.receiveShadow = true;
    root.add(base);

    const spinner = new THREE.Group();
    spinner.position.y = 0.45;
    root.add(spinner);

    const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.14, 20), deckMat);
    deck.receiveShadow = true;
    spinner.add(deck);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 3.6, 12), goldMat);
    core.position.y = 1.8;
    core.castShadow = true;
    spinner.add(core);

    const tent = new THREE.Mesh(new THREE.ConeGeometry(4.45, 1.85, 16), canopyMat);
    tent.position.y = 4.42;
    tent.castShadow = true;
    spinner.add(tent);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.42, 16), trimMat);
    skirt.position.y = 3.45;
    spinner.add(skirt);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 8), goldMat);
    spire.position.y = 5.72;
    spinner.add(spire);

    const horseColors = [0xffffff, 0xf2b950, 0xe86d58, 0x70c4cf, 0xf29bb8, 0xc98b52, 0xf7e7a8, 0x899cf0];
    const horses: Array<{ group: THREE.Group; phase: number }> = [];

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const hx = Math.cos(ang) * 2.95;
      const hz = Math.sin(ang) * 2.95;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.4, 6), goldMat);
      pole.position.set(hx, 1.7, hz);
      spinner.add(pole);

      const hGroup = new THREE.Group();
      hGroup.position.set(hx, 1.25, hz);
      hGroup.rotation.y = -ang;
      spinner.add(hGroup);

      const hMat = new THREE.MeshStandardMaterial({
        color: horseColors[i % horseColors.length],
        roughness: 0.35,
      });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.65, 5, 8), hMat);
      body.rotation.x = Math.PI / 2;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.52, 7), hMat);
      neck.position.set(0, 0.32, 0.36);
      neck.rotation.x = -0.35;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.36), hMat);
      head.position.set(0, 0.54, 0.54);
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.36), trimMat);
      saddle.position.set(0, 0.22, 0);
      hGroup.add(body, neck, head, saddle);
      horses.push({ group: hGroup, phase: i * (Math.PI / 2) });
    }

    this.updaters.push((t) => {
      spinner.rotation.y = t * 0.62;
      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        const gall = Math.sin(t * 2.8 + h.phase);
        h.group.position.y = 1.28 + gall * 0.38;
        h.group.rotation.x = Math.cos(t * 2.8 + h.phase) * 0.12;
      }
    });
  }

  /**
   * Builds and animates an elevated 1990s Hill Station Toy Train (Steam Engine + 2 Coaches + Steam Puffs)
   * gliding smoothly around an oval track!
   */
  public addToyTrainLoop(
    parent: THREE.Object3D,
    opts: { centerX: number; centerZ: number; radiusX: number; radiusZ: number; yBase?: number },
  ): void {
    const { centerX, centerZ, radiusX, radiusZ, yBase = 0.08 } = opts;

    // Build stylized rail oval + wooden sleepers
    const railMat = new THREE.MeshStandardMaterial({ color: 0x5c646c, roughness: 0.45, metalness: 0.72 });
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x6b4b32, roughness: 0.88 });
    const sleeperCount = 96;
    const sleeperGeo = new THREE.BoxGeometry(1.55, 0.09, 0.24);
    const sleeperInst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < sleeperCount; i++) {
      const a = (i / sleeperCount) * Math.PI * 2;
      const sx = centerX + Math.cos(a) * radiusX;
      const sz = centerZ + Math.sin(a) * radiusZ;
      const tx = -Math.sin(a) * radiusX;
      const tz = Math.cos(a) * radiusZ;
      dummy.position.set(sx, yBase, sz);
      dummy.rotation.set(0, Math.atan2(tx, tz), 0);
      dummy.updateMatrix();
      sleeperInst.setMatrixAt(i, dummy.matrix);
    }
    sleeperInst.instanceMatrix.needsUpdate = true;
    sleeperInst.computeBoundingSphere();
    parent.add(sleeperInst);

    for (const rOff of [-0.52, 0.52]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            centerX + Math.cos(a) * (radiusX + rOff),
            yBase + 0.09,
            centerZ + Math.sin(a) * (radiusZ + rOff),
          ),
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.045, 5, true), railMat);
      parent.add(rail);
    }

    // Build Pixar-stylized blue-and-red Toy Steam Locomotive + 2 Coaches
    const buildCar = (kind: 'engine' | 'coach', colorHex: number): THREE.Group => {
      const car = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.38, metalness: 0.18 });
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xe6b441, roughness: 0.28, metalness: 0.8 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.65 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xf4ebd8, roughness: 0.55 });
      const winMat = new THREE.MeshStandardMaterial({
        color: 0xffebb0,
        emissive: 0xffbb55,
        emissiveIntensity: 0.45,
        roughness: 0.2,
      });

      const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.26, 3.0), darkMat);
      chassis.position.y = 0.42;
      car.add(chassis);

      if (kind === 'engine') {
        const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 1.75, 12), bodyMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 1.05, 0.42);
        boiler.castShadow = true;
        car.add(boiler);

        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.35, 1.15), bodyMat);
        cab.position.set(0, 1.24, -0.82);
        cab.castShadow = true;
        car.add(cab);

        const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.14, 1.36), roofMat);
        cabRoof.position.set(0, 1.96, -0.82);
        car.add(cabRoof);

        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.72, 10), darkMat);
        funnel.position.set(0, 1.82, 0.98);
        car.add(funnel);

        const brassBand = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 6, 16), brassMat);
        brassBand.position.set(0, 1.05, 0.5);
        car.add(brassBand);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), winMat);
        lamp.position.set(0, 1.1, 1.36);
        car.add(lamp);
      } else {
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.25, 2.75), bodyMat);
        cabin.position.set(0, 1.18, 0);
        cabin.castShadow = true;
        car.add(cabin);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.16, 2.95), roofMat);
        roof.position.set(0, 1.86, 0);
        car.add(roof);

        for (const wz of [-0.82, 0, 0.82]) {
          const wMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.52), winMat);
          wMesh.position.set(0, 1.32, wz);
          car.add(wMesh);
        }
      }

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10);
      for (const wz of [-0.95, 0, 0.95]) {
        for (const wx of [-0.66, 0.66]) {
          const wh = new THREE.Mesh(wheelGeo, brassMat);
          wh.rotation.z = Math.PI / 2;
          wh.position.set(wx, 0.28, wz);
          car.add(wh);
        }
      }
      return car;
    };

    const engineCar = buildCar('engine', 0x2969a8);
    const coach1 = buildCar('coach', 0xc9483b);
    const coach2 = buildCar('coach', 0xd89c2e);
    parent.add(engineCar, coach1, coach2);

    // Chugging steam puffs trailing the locomotive funnel!
    const puffGeo = new THREE.SphereGeometry(0.22, 7, 6);
    const puffs: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; offset: number }> = [];
    for (let i = 0; i < 6; i++) {
      const pMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.95,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const pm = new THREE.Mesh(puffGeo, pMat);
      parent.add(pm);
      puffs.push({ mesh: pm, mat: pMat, offset: i / 6 });
    }

    const cars = [
      { obj: engineCar, lag: 0 },
      { obj: coach1, lag: 0.11 },
      { obj: coach2, lag: 0.22 },
    ];

    this.updaters.push((t) => {
      const baseA = t * 0.16;
      for (let i = 0; i < cars.length; i++) {
        const a = baseA - cars[i].lag;
        const cx = centerX + Math.cos(a) * radiusX;
        const cz = centerZ + Math.sin(a) * radiusZ;
        const tx = -Math.sin(a) * radiusX;
        const tz = Math.cos(a) * radiusZ;
        const chug = Math.abs(Math.sin(t * 7.5 + i * 0.6)) * 0.04;
        cars[i].obj.position.set(cx, yBase + 0.08 + chug, cz);
        cars[i].obj.rotation.y = Math.atan2(tx, tz);
        cars[i].obj.rotation.z = Math.sin(t * 3.75 + i) * 0.025;
      }

      // Position puffs above locomotive funnel
      const fx = engineCar.position.x + Math.sin(engineCar.rotation.y) * 0.95;
      const fz = engineCar.position.z + Math.cos(engineCar.rotation.y) * 0.95;
      for (let i = 0; i < puffs.length; i++) {
        const p = puffs[i];
        const u = (t * 0.85 + p.offset) % 1;
        p.mesh.position.set(
          fx - Math.sin(engineCar.rotation.y) * u * 2.2,
          yBase + 2.25 + u * 2.4,
          fz - Math.cos(engineCar.rotation.y) * u * 2.2,
        );
        const sc = 0.55 + u * 1.9;
        p.mesh.scale.set(sc, sc * 0.88, sc);
        p.mat.opacity = Math.sin(u * Math.PI) * 0.58;
      }
    });
  }

  /**
   * Builds and animates a rotating 360° Lighthouse Beacon with dual golden light cones!
   */
  public addLighthouseBeacon(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
  ): void {
    const beacon = new THREE.Group();
    beacon.position.set(x, y, z);
    parent.add(beacon);

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff8c4 }),
    );
    beacon.add(lamp);

    const coneGeo = new THREE.ConeGeometry(2.8, 22, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffe896,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    for (const dir of [-1, 1]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.z = dir * (Math.PI / 2);
      cone.position.x = -dir * 11;
      cone.position.y = -1.6;
      beacon.add(cone);
    }

    this.updaters.push((t) => {
      beacon.rotation.y = t * 0.65;
    });
  }

  /**
   * Builds and animates a spinning wooden waterwheel with cascading splash droplets!
   */
  public addWaterwheel(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    rotY = 0,
  ): void {
    const root = new THREE.Group();
    root.position.set(x, y, z);
    root.rotation.y = rotY;
    parent.add(root);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e472b, roughness: 0.82 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x4b2f1c, roughness: 0.88 });
    const wheel = new THREE.Group();
    root.add(wheel);

    for (const wz of [-0.42, 0.42]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.11, 7, 20), woodMat);
      rim.position.z = wz;
      rim.castShadow = true;
      wheel.add(rim);
    }

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8), darkWood);
    axle.rotation.x = Math.PI / 2;
    wheel.add(axle);

    const paddleGeo = new THREE.BoxGeometry(0.42, 0.08, 0.94);
    const spokeGeo = new THREE.BoxGeometry(3.45, 0.12, 0.1);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(spokeGeo, darkWood);
      sp.rotation.z = (i * Math.PI) / 4;
      wheel.add(sp);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pad = new THREE.Mesh(paddleGeo, woodMat);
      pad.position.set(Math.cos(a) * 1.75, Math.sin(a) * 1.75, 0);
      pad.rotation.z = a;
      wheel.add(pad);
    }

    // Animated falling water droplets off the spinning paddles
    const dropGeo = new THREE.SphereGeometry(0.08, 6, 5);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xd4f7ff, transparent: true, opacity: 0.78 });
    const drops = new THREE.InstancedMesh(dropGeo, dropMat, 14);
    drops.frustumCulled = false;
    root.add(drops);
    const dummy = new THREE.Object3D();

    this.updaters.push((t) => {
      wheel.rotation.z = -t * 1.15;
      for (let i = 0; i < 14; i++) {
        const u = (t * 1.2 + i / 14) % 1;
        const side = i % 2 === 0 ? 1 : -1;
        dummy.position.set(
          1.45 - u * 0.45,
          0.95 - u * u * 2.5,
          side * (0.28 * Math.sin(i * 2.1)),
        );
        const sc = 0.75 + Math.sin(u * Math.PI) * 0.55;
        dummy.scale.set(sc, sc * 1.35, sc);
        dummy.updateMatrix();
        drops.setMatrixAt(i, dummy.matrix);
      }
      drops.instanceMatrix.needsUpdate = true;
    });
  }

  /**
   * Builds and animates gentle 3D swirling snowflakes or floating petals using one InstancedMesh!
   */
  public addAmbientParticles(
    parent: THREE.Object3D,
    opts: {
      count: number;
      areaRadius: number;
      minY: number;
      maxY: number;
      color: number;
      size: number;
      fallSpeed: number;
      swirlAmp?: number;
      glow?: boolean;
    },
  ): void {
    const {
      count,
      areaRadius,
      minY,
      maxY,
      color,
      size,
      fallSpeed,
      swirlAmp = 1.1,
      glow = false,
    } = opts;
    const geo = new THREE.OctahedronGeometry(size, 0);
    const mat = glow
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
      : new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.25,
          roughness: 0.5,
        });
    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;
    parent.add(inst);

    const seeds: Array<{ x: number; z: number; yOff: number; phase: number; sp: number }> = [];
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / count) * areaRadius;
      seeds.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        yOff: (i * 0.618034) % 1,
        phase: i * 1.37,
        sp: 0.75 + (i % 5) * 0.12,
      });
    }

    const dummy = new THREE.Object3D();
    const spanY = Math.max(1, maxY - minY);

    this.updaters.push((t) => {
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        let y: number;
        if (fallSpeed > 0) {
          const u = (s.yOff - (t * fallSpeed * s.sp) / spanY) % 1;
          y = minY + (u < 0 ? u + 1 : u) * spanY;
        } else {
          // Floating fireflies / glowing motes
          y = minY + s.yOff * spanY + Math.sin(t * 1.4 * s.sp + s.phase) * 0.75;
        }
        dummy.position.set(
          s.x + Math.sin(t * 0.85 * s.sp + s.phase) * swirlAmp,
          y,
          s.z + Math.cos(t * 0.72 * s.sp + s.phase) * swirlAmp,
        );
        dummy.rotation.set(t * 0.9 + s.phase, t * 1.1 + s.phase, 0);
        const pulse = glow ? 0.65 + 0.55 * Math.sin(t * 3.4 + s.phase) : 1.0;
        dummy.scale.setScalar(pulse);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    });
  }

  /**
   * Builds and animates a bouncing cluster of colorful Mela helium balloons!
   */
  public addBalloonCluster(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    colors: number[],
  ): void {
    const cluster = new THREE.Group();
    cluster.position.set(x, y, z);
    parent.add(cluster);

    const stringMat = new THREE.LineBasicMaterial({ color: 0xeee5d8 });
    const balloonGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const items: Array<{ mesh: THREE.Mesh; baseX: number; baseY: number; baseZ: number; phase: number }> = [];

    for (let i = 0; i < colors.length; i++) {
      const ang = (i / colors.length) * Math.PI * 2;
      const bx = Math.cos(ang) * 0.34;
      const bz = Math.sin(ang) * 0.34;
      const by = 1.65 + (i % 3) * 0.34;

      const mat = new THREE.MeshPhysicalMaterial({
        color: colors[i],
        roughness: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });
      const mesh = new THREE.Mesh(balloonGeo, mat);
      mesh.scale.set(0.92, 1.16, 0.92);
      mesh.position.set(bx, by, bz);
      mesh.castShadow = true;
      cluster.add(mesh);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(bx, by - 0.28, bz),
      ]);
      cluster.add(new THREE.Line(lineGeo, stringMat));
      items.push({ mesh, baseX: bx, baseY: by, baseZ: bz, phase: i * 1.15 });
    }

    this.updaters.push((t) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        it.mesh.position.set(
          it.baseX + Math.sin(t * 1.8 + it.phase) * 0.09,
          it.baseY + Math.sin(t * 2.4 + it.phase) * 0.11,
          it.baseZ + Math.cos(t * 1.6 + it.phase) * 0.09,
        );
      }
    });
  }

  /**
   * Builds and animates a playful dancing Rajasthani Kathputli (wooden marionette) on a stage!
   */
  public addKathputliPuppet(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    dressColor: number,
    phase: number,
  ): void {
    const puppet = new THREE.Group();
    puppet.position.set(x, y, z);
    parent.add(puppet);

    const dressMat = new THREE.MeshStandardMaterial({ color: dressColor, roughness: 0.48 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99b66, roughness: 0.55 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf4c542, roughness: 0.28, metalness: 0.72 });

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.72, 10), dressMat);
    skirt.position.y = 0.36;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.32, 8), goldMat);
    torso.position.y = 0.82;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skinMat);
    head.position.y = 1.08;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 6), dressMat);
    crown.position.y = 1.28;

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 6), dressMat);
    leftArm.position.set(-0.22, 0.86, 0);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 6), dressMat);
    rightArm.position.set(0.22, 0.86, 0);

    puppet.add(skirt, torso, head, crown, leftArm, rightArm);

    this.updaters.push((t) => {
      const beat = t * 4.2 + phase;
      puppet.position.y = y + Math.abs(Math.sin(beat)) * 0.16;
      puppet.rotation.y = Math.sin(t * 2.1 + phase) * 0.85;
      puppet.rotation.z = Math.sin(beat) * 0.14;
      leftArm.rotation.z = 0.7 + Math.sin(beat * 1.2) * 0.65;
      rightArm.rotation.z = -0.7 - Math.cos(beat * 1.2) * 0.65;
    });
  }

  /**
   * Builds and animates a proud Pixar-style Peacock fanning its shimmering turquoise tail!
   */
  public addAnimatedPeacock(
    parent: THREE.Object3D,
    x: number,
    z: number,
    rotY = 0,
    phase = 0,
  ): void {
    const bird = new THREE.Group();
    bird.position.set(x, 0, z);
    bird.rotation.y = rotY;
    parent.add(bird);

    const royalBlue = new THREE.MeshPhysicalMaterial({
      color: 0x1554a6,
      roughness: 0.25,
      metalness: 0.22,
      clearcoat: 0.65,
    });
    const tealFeather = new THREE.MeshPhysicalMaterial({
      color: 0x16a38d,
      roughness: 0.28,
      metalness: 0.3,
      clearcoat: 0.8,
      side: THREE.DoubleSide,
    });
    const goldEye = new THREE.MeshBasicMaterial({ color: 0xffd54a });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), royalBlue);
    body.scale.set(0.85, 0.8, 1.35);
    body.position.set(0, 0.48, 0);
    body.castShadow = true;
    bird.add(body);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.48, 8), royalBlue);
    neck.position.set(0, 0.82, 0.24);
    neck.rotation.x = 0.22;
    bird.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), royalBlue);
    head.position.set(0, 1.08, 0.3);
    bird.add(head);

    const fanPivot = new THREE.Group();
    fanPivot.position.set(0, 0.56, -0.24);
    bird.add(fanPivot);

    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.26;
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 5), tealFeather);
      feather.position.set(Math.sin(ang) * 0.55, Math.cos(ang) * 0.55, -0.05);
      feather.rotation.z = -ang;
      feather.rotation.x = -0.22;
      fanPivot.add(feather);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), goldEye);
      eye.position.set(Math.sin(ang) * 0.96, Math.cos(ang) * 0.96, 0.02);
      fanPivot.add(eye);
    }

    this.updaters.push((t) => {
      const fanCycle = 0.5 + 0.5 * Math.sin(t * 0.95 + phase);
      fanPivot.rotation.x = -0.85 + fanCycle * 0.78;
      fanPivot.scale.set(0.58 + fanCycle * 0.52, 0.85 + fanCycle * 0.2, 1);
      head.rotation.y = Math.sin(t * 2.2 + phase) * 0.35;
      bird.rotation.y = rotY + Math.sin(t * 0.6 + phase) * 0.25;
    });
  }
}

/**
 * Helper to create a lush Pixar-style rounded multi-crown tree (4-6 layered spheres
 * with subtle color-temperature gradient & tapered curved trunk, grounded cleanly at y = 0).
 */
export function buildPixarTree(
  x: number,
  z: number,
  opts: {
    kind: 'pine' | 'palm' | 'blossom' | 'deodar_snow' | 'royal_cypress' | 'banyan_lush';
    scale?: number;
    seed?: number;
  },
): { group: THREE.Group; canopy: THREE.Object3D; trunkRadius: number } {
  const { kind, scale = 1.0, seed = 0 } = opts;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: kind === 'palm' ? 0x8a6a4b : kind === 'deodar_snow' ? 0x4d3a2d : 0x69452e,
    roughness: 0.9,
  });

  const canopy = new THREE.Group();
  let trunkRadius = 0.45 * scale;

  if (kind === 'pine' || kind === 'deodar_snow') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 2.2, 8), trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    group.add(trunk);

    const leafColor = kind === 'deodar_snow' ? 0x265446 : 0x276b48;
    const tipColor = kind === 'deodar_snow' ? 0xf2f8ff : 0x3b8f5a;
    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.74 });
    const snowMat = new THREE.MeshPhysicalMaterial({
      color: tipColor,
      roughness: 0.38,
      clearcoat: kind === 'deodar_snow' ? 0.35 : 0,
    });

    const tiers = [
      { y: 2.6, r: 2.0, h: 2.0 },
      { y: 4.0, r: 1.55, h: 1.85 },
      { y: 5.25, r: 1.05, h: 1.65 },
    ];
    for (const tr of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tr.r, tr.h, 9), leafMat);
      cone.position.y = tr.y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      canopy.add(cone);

      if (kind === 'deodar_snow') {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(tr.r * 0.88, tr.h * 0.45, 9), snowMat);
        cap.position.y = tr.y + tr.h * 0.28;
        canopy.add(cap);
      }
    }
    group.add(canopy);
    trunkRadius = 0.44 * scale;
  } else if (kind === 'palm') {
    const curvePts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.sin(seed) * 0.35, 2.4, Math.cos(seed) * 0.25),
      new THREE.Vector3(Math.sin(seed) * 0.65, 5.2, Math.cos(seed) * 0.45),
    ];
    const trunkCurve = new THREE.CatmullRomCurve3(curvePts);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 10, 0.22, 7, false), trunkMat);
    trunk.castShadow = true;
    group.add(trunk);

    const top = curvePts[2];
    canopy.position.copy(top);
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x399c4a,
      roughness: 0.62,
      side: THREE.DoubleSide,
    });
    const cocoMat = new THREE.MeshStandardMaterial({ color: 0x6b4322, roughness: 0.72 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + seed;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.55, 5), frondMat);
      frond.position.set(Math.cos(a) * 1.15, 0.1, Math.sin(a) * 1.15);
      frond.rotation.z = -Math.cos(a) * 1.2;
      frond.rotation.x = Math.sin(a) * 1.2;
      frond.scale.set(0.65, 1.0, 0.25);
      frond.castShadow = true;
      canopy.add(frond);
    }
    for (let c = 0; c < 3; c++) {
      const ca = c * 2.1;
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), cocoMat);
      nut.position.set(Math.cos(ca) * 0.26, -0.2, Math.sin(ca) * 0.26);
      canopy.add(nut);
    }
    group.add(canopy);
    trunkRadius = 0.36 * scale;
  } else if (kind === 'royal_cypress') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.0, 7), trunkMat);
    trunk.position.y = 0.5;
    group.add(trunk);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x266a47, roughness: 0.72 });
    const spire = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 3.6, 6, 10), foliageMat);
    spire.position.y = 2.9;
    spire.castShadow = true;
    canopy.add(spire);
    group.add(canopy);
    trunkRadius = 0.55 * scale;
  } else {
    // Lush Pixar multi-puff rounded canopy (blossom or banyan_lush)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, 2.5, 9), trunkMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    group.add(trunk);

    const isBlossom = kind === 'blossom';
    const baseHue = isBlossom ? 0xf27da2 : 0x358f49;
    const hiHue = isBlossom ? 0xffb3c9 : 0x57b859;
    const matA = new THREE.MeshStandardMaterial({ color: baseHue, roughness: 0.68 });
    const matB = new THREE.MeshStandardMaterial({ color: hiHue, roughness: 0.62 });

    const puffs = [
      { x: 0, y: 3.3, z: 0, r: 1.55, hi: false },
      { x: 1.05, y: 2.95, z: 0.45, r: 1.15, hi: true },
      { x: -1.0, y: 3.05, z: -0.4, r: 1.12, hi: false },
      { x: 0.25, y: 3.85, z: -0.65, r: 1.05, hi: true },
      { x: -0.45, y: 2.85, z: 0.95, r: 0.98, hi: true },
    ];
    for (const p of puffs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(p.r, 11, 9), p.hi ? matB : matA);
      m.position.set(p.x, p.y, p.z);
      m.castShadow = true;
      m.receiveShadow = true;
      canopy.add(m);
    }
    group.add(canopy);
    trunkRadius = 0.52 * scale;
  }

  return { group, canopy, trunkRadius };
}
