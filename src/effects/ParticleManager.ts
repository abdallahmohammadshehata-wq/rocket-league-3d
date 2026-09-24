import * as THREE from 'three';

interface PooledParticle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface PooledShockwave {
  active: boolean;
  mesh: THREE.Mesh;
  scaleSpeed: number;
  fadeSpeed: number;
}

export class ParticleManager {
  private scene: THREE.Scene;
  private particlePool: PooledParticle[] = [];
  private poolIndex: number = 0;
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.PointsMaterial;
  private particlePoints: THREE.Points;

  private readonly maxParticles: number = 2000;
  private positions: Float32Array;
  private colors: Float32Array;

  // Expanding shockwave rings pool (Goal explosions, supersonic booms, dodges)
  private shockwaves: PooledShockwave[] = [];
  private readonly maxShockwaves: number = 24;

  // Tire skid tracks
  private skidSegments: THREE.LineSegments;
  private skidPositions: Float32Array;
  private skidIndex: number = 0;
  private readonly maxSkidPoints: number = 1000;

  // Scratch memory vectors to prevent runtime allocations
  private static readonly _tempSpread = new THREE.Vector3();
  private static readonly _tempVel = new THREE.Vector3();
  private static readonly _tempColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Pre-allocate Particle Pool
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push({
        active: false,
        position: new THREE.Vector3(0, -1000, 0),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        size: 1.0,
        alpha: 0.0,
        life: 0,
        maxLife: 1.0
      });
      this.positions[i * 3 + 1] = -1000;
    }

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Custom circle canvas sprite for soft glowing particles
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const particleTex = new THREE.CanvasTexture(canvas);

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: particleTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particlePoints);

    // 2. Pre-allocate Shockwave Mesh Pool
    const ringGeo = new THREE.RingGeometry(1.0, 2.2, 36);
    for (let i = 0; i < this.maxShockwaves; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00d2ff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo.clone(), ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.visible = false;
      this.scene.add(ringMesh);

      this.shockwaves.push({
        active: false,
        mesh: ringMesh,
        scaleSpeed: 10.0,
        fadeSpeed: 1.5
      });
    }

    // 3. Tire Skidmarks Line System
    this.skidPositions = new Float32Array(this.maxSkidPoints * 3);
    const skidGeo = new THREE.BufferGeometry();
    skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
    const skidMat = new THREE.LineBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.45,
      linewidth: 3
    });
    this.skidSegments = new THREE.LineSegments(skidGeo, skidMat);
    this.scene.add(this.skidSegments);
  }

  private acquireParticle(): PooledParticle {
    const p = this.particlePool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.maxParticles;
    p.active = true;
    return p;
  }

  public emitBoostSparks(origin: THREE.Vector3, direction: THREE.Vector3, isSupersonic: boolean): void {
    const count = isSupersonic ? 6 : 3;
    const baseHex = isSupersonic ? 0xcc00ff : 0xffaa00;

    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      const spreadX = (Math.random() - 0.5) * 0.4;
      const spreadY = (Math.random() - 0.5) * 0.4;
      const spreadZ = (Math.random() - 0.5) * 0.4;

      p.position.set(origin.x + spreadX, origin.y + spreadY, origin.z + spreadZ);
      const speed = -18 - Math.random() * 12;
      p.velocity.set(
        direction.x * speed + spreadX,
        direction.y * speed + spreadY,
        direction.z * speed + spreadZ
      );

      p.color.setHex(baseHex);
      p.size = isSupersonic ? 1.2 : 0.7;
      p.alpha = 1.0;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.25;
    }
  }

  public emitDriftSmoke(position: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      const p = this.acquireParticle();
      p.position.set(
        position.x + (Math.random() - 0.5) * 0.6,
        position.y + 0.1,
        position.z + (Math.random() - 0.5) * 0.6
      );
      p.velocity.set(
        (Math.random() - 0.5) * 2.0,
        1.5 + Math.random() * 2.0,
        (Math.random() - 0.5) * 2.0
      );
      p.color.setHex(0xaaaaaa);
      p.size = 1.4;
      p.alpha = 0.6;
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.3;
    }
  }

  public addSkidPoint(p1: THREE.Vector3, p2: THREE.Vector3): void {
    const arr = (this.skidSegments.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const idx = (this.skidIndex % (this.maxSkidPoints / 2)) * 6;

    arr[idx] = p1.x;
    arr[idx + 1] = 0.04;
    arr[idx + 2] = p1.z;

    arr[idx + 3] = p2.x;
    arr[idx + 4] = 0.04;
    arr[idx + 5] = p2.z;

    this.skidIndex++;
    this.skidSegments.geometry.attributes.position.needsUpdate = true;
  }

  public emitBallHitSparks(position: THREE.Vector3, intensity: number): void {
    const count = Math.min(45, Math.floor(intensity * 25));
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * Math.PI;
      const speed = 10 + Math.random() * 25 * intensity;

      p.position.copy(position);
      p.velocity.set(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed + 5,
        Math.sin(angle) * Math.cos(elevation) * speed
      );

      p.color.setHex(0x00ffff);
      p.size = 0.9;
      p.alpha = 1.0;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.4;
    }

    this.spawnShockwaveRing(position, 0x00d2ff, 1.5, 45.0);
  }

  public emitGoalExplosion(goalPos: THREE.Vector3, teamColor: number): void {
    const count = 280;

    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 15 + Math.random() * 45;

      p.position.copy(goalPos);
      p.velocity.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed + 10,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      p.color.setHex(teamColor);
      p.size = 1.8 + Math.random() * 1.5;
      p.alpha = 1.0;
      p.life = 0;
      p.maxLife = 1.2 + Math.random() * 0.8;
    }

    this.spawnShockwaveRing(goalPos, teamColor, 4.0, 70.0);
    setTimeout(() => this.spawnShockwaveRing(goalPos, 0xffffff, 3.0, 85.0), 120);
  }

  public spawnShockwaveRing(position: THREE.Vector3, color: number, initialRadius: number, expandSpeed: number): void {
    let sw = this.shockwaves.find((s) => !s.active);
    if (!sw) {
      sw = this.shockwaves[0];
    }

    sw.active = true;
    sw.scaleSpeed = expandSpeed;
    sw.fadeSpeed = 1.6;
    sw.mesh.position.set(position.x, Math.max(0.1, position.y), position.z);
    sw.mesh.scale.set(initialRadius, initialRadius, 1);
    sw.mesh.visible = true;

    const mat = sw.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = 0.85;
  }

  public update(dt: number): void {
    // 1. Update Particles Pool
    let activeCount = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        this.positions[i * 3 + 1] = -1000;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.positions[i * 3 + 1] = -1000;
        continue;
      }

      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;
      p.velocity.y -= 15.0 * dt; // Gravity
      p.alpha = 1.0 - p.life / p.maxLife;

      this.positions[i * 3] = p.position.x;
      this.positions[i * 3 + 1] = p.position.y;
      this.positions[i * 3 + 2] = p.position.z;

      this.colors[i * 3] = p.color.r * p.alpha;
      this.colors[i * 3 + 1] = p.color.g * p.alpha;
      this.colors[i * 3 + 2] = p.color.b * p.alpha;
      activeCount++;
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.color.needsUpdate = true;

    // 2. Update Expanding Shockwaves
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;

      sw.mesh.scale.addScalar(sw.scaleSpeed * dt);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity -= sw.fadeSpeed * dt;

      if (mat.opacity <= 0.01) {
        sw.active = false;
        sw.mesh.visible = false;
      }
    }
  }
}
