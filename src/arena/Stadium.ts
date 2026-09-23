import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface BoostPad {
  mesh: THREE.Group;
  position: THREE.Vector3;
  isBig: boolean;
  amount: number;
  active: boolean;
  respawnTime: number;
  timer: number;
}

export class Stadium {
  private scene: THREE.Scene;
  private world: RAPIER.World;

  public readonly length: number = 102.4; // Z: -51.2 to +51.2
  public readonly width: number = 82.0;   // X: -41.0 to +41.0
  public readonly height: number = 20.4;  // Y: 0 to 20.4

  public readonly goalWidth: number = 17.8;
  public readonly goalHeight: number = 6.4;
  public readonly goalDepth: number = 8.8;

  public blueGoalSensorCollider!: RAPIER.Collider;
  public orangeGoalSensorCollider!: RAPIER.Collider;

  public boostPads: BoostPad[] = [];
  private billboardMats: THREE.MeshBasicMaterial[] = [];
  private animatedLightStrips: THREE.MeshBasicMaterial[] = [];

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;

    this.buildPitch();
    this.buildWallsAndPhysicsColliders();
    this.buildGoals();
    this.buildStadiumGrandstands();
    this.buildBoostPads();
    this.buildFloodlightBeams();
  }

  private buildPitch(): void {
    // 1. High-Resolution Cyber-Turf & Neon Markings Texture
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // Base pitch gradient: Cyber Blue to Neutral Turf to Cyber Orange
    const grad = ctx.createLinearGradient(0, 0, 0, 2048);
    grad.addColorStop(0, '#041728');    // Deep Blue team side
    grad.addColorStop(0.25, '#072535');
    grad.addColorStop(0.5, '#0a231b');   // Vibrant green-tinted center
    grad.addColorStop(0.75, '#2e1908');
    grad.addColorStop(1, '#2c0e04');    // Deep Orange team side
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2048, 2048);

    // Turf stripe pattern
    const stripeCount = 24;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, (i / stripeCount) * 2048, 2048, 2048 / stripeCount);
    }

    // Subtle Hexagonal Cyber Mesh Pattern on Turf
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    const hexSize = 48;
    const h = hexSize * Math.sqrt(3);
    for (let y = 0; y < 2048 + h; y += h) {
      for (let x = 0; x < 2048 + hexSize * 3; x += hexSize * 3) {
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a;
          const px = x + hexSize * Math.cos(angle);
          const py = y + hexSize * Math.sin(angle);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a;
          const px = x + hexSize * 1.5 + hexSize * Math.cos(angle);
          const py = y + h / 2 + hexSize * Math.sin(angle);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Grid guide lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 2048; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 2048);
      ctx.stroke();
    }

    // Glowing Pitch Markings
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#00d2ff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 8;

    // Outer boundary line
    ctx.strokeRect(60, 60, 2048 - 120, 2048 - 120);

    // Center line
    ctx.beginPath();
    ctx.moveTo(60, 1024);
    ctx.lineTo(2048 - 60, 1024);
    ctx.stroke();

    // Center circle & kickoff spot
    ctx.beginPath();
    ctx.arc(1024, 1024, 280, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(1024, 1024, 24, 0, Math.PI * 2);
    ctx.fill();

    // Blue goal penalty box
    ctx.strokeStyle = '#00d2ff';
    ctx.strokeRect(1024 - 360, 60, 720, 360);
    // Orange goal penalty box
    ctx.strokeStyle = '#ff7700';
    ctx.strokeRect(1024 - 360, 2048 - 420, 720, 360);

    const pitchTexture = new THREE.CanvasTexture(canvas);
    pitchTexture.wrapS = THREE.ClampToEdgeWrapping;
    pitchTexture.wrapT = THREE.ClampToEdgeWrapping;
    pitchTexture.anisotropy = 16;

    // Floor 3D Mesh
    const floorGeo = new THREE.PlaneGeometry(this.width, this.length);
    const floorMat = new THREE.MeshStandardMaterial({
      map: pitchTexture,
      roughness: 0.65,
      metalness: 0.18
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Rapier Physics Floor Collider (strictly flat at y = 0)
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0);
    const floorBody = this.world.createRigidBody(floorBodyDesc);
    const floorColliderDesc = RAPIER.ColliderDesc.cuboid(this.width / 2 + 10, 0.5, this.length / 2 + 10)
      .setFriction(0.7)
      .setRestitution(0.15);
    this.world.createCollider(floorColliderDesc, floorBody);
  }

  private buildWallsAndPhysicsColliders(): void {
    const halfW = this.width / 2;    // 30
    const halfL = this.length / 2;   // 50
    const h = this.height;           // 28
    const sideBackWidth = (this.width - this.goalWidth) / 2; // 22
    const leftOffsetX = -halfW + sideBackWidth / 2;          // -19
    const rightOffsetX = halfW - sideBackWidth / 2;          // +19
    const goalUpperH = h - this.goalHeight;                  // 21.2

    // Modern cyber glass stadium wall material with glowing edges
    const glassWallMat = new THREE.MeshPhysicalMaterial({
      color: 0x0c1e30,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      metalness: 0.3,
      transmission: 0.75,
      ior: 1.45,
      side: THREE.DoubleSide
    });

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x08101a,
      roughness: 0.4,
      metalness: 0.6
    });

    // -------------------------------------------------------------
    // 1. VERTICAL PERIMETER WALLS (Mesh + Fixed Rapier Physics Box)
    // -------------------------------------------------------------
    // Left Wall (X = -halfW)
    this.createSolidWall(new THREE.Vector3(-halfW, h / 2, 0), new THREE.Vector3(0.6, h, this.length), glassWallMat);
    // Right Wall (X = +halfW)
    this.createSolidWall(new THREE.Vector3(halfW, h / 2, 0), new THREE.Vector3(0.6, h, this.length), glassWallMat);

    // Blue Back Walls (Z = -halfL)
    this.createSolidWall(new THREE.Vector3(leftOffsetX, h / 2, -halfL), new THREE.Vector3(sideBackWidth, h, 0.6), glassWallMat);
    this.createSolidWall(new THREE.Vector3(rightOffsetX, h / 2, -halfL), new THREE.Vector3(sideBackWidth, h, 0.6), glassWallMat);
    this.createSolidWall(new THREE.Vector3(0, this.goalHeight + goalUpperH / 2, -halfL), new THREE.Vector3(this.goalWidth, goalUpperH, 0.6), glassWallMat);

    // Orange Back Walls (Z = +halfL)
    this.createSolidWall(new THREE.Vector3(leftOffsetX, h / 2, halfL), new THREE.Vector3(sideBackWidth, h, 0.6), glassWallMat);
    this.createSolidWall(new THREE.Vector3(rightOffsetX, h / 2, halfL), new THREE.Vector3(sideBackWidth, h, 0.6), glassWallMat);
    this.createSolidWall(new THREE.Vector3(0, this.goalHeight + goalUpperH / 2, halfL), new THREE.Vector3(this.goalWidth, goalUpperH, 0.6), glassWallMat);

    // -------------------------------------------------------------
    // 2. CEILING (Wireframe Mesh + Top Solid Collider)
    // -------------------------------------------------------------
    const ceilGeo = new THREE.PlaneGeometry(this.width, this.length);
    const ceilMat = new THREE.MeshBasicMaterial({
      color: 0x00a2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.12
    });
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
    ceilMesh.position.y = h;
    ceilMesh.rotation.x = Math.PI / 2;
    this.scene.add(ceilMesh);

    const ceilBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, h + 0.5, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(halfW + 5, 0.5, halfL + 5).setRestitution(0.4), ceilBody);

    // -------------------------------------------------------------
    // 3. 45-DEGREE SMOOTH WALL RAMPS (Accurate, non-intersecting!)
    // -------------------------------------------------------------
    const rampWidth = 3.6;
    const rampHalf = rampWidth / 2;
    const rampThick = 0.3;

    // Left Wall Ramp (Runs along Z: -50 to +50 at X = -30)
    this.createAngledRamp(
      new THREE.Vector3(-halfW + rampHalf * 0.707, rampHalf * 0.707, 0),
      new THREE.Euler(0, 0, -Math.PI / 4),
      new THREE.Vector3(rampWidth, rampThick, this.length),
      rampMat
    );

    // Right Wall Ramp (Runs along Z: -50 to +50 at X = +30)
    this.createAngledRamp(
      new THREE.Vector3(halfW - rampHalf * 0.707, rampHalf * 0.707, 0),
      new THREE.Euler(0, 0, Math.PI / 4),
      new THREE.Vector3(rampWidth, rampThick, this.length),
      rampMat
    );

    // Blue Back Wall Ramps (Runs along X at Z = -50)
    this.createAngledRamp(
      new THREE.Vector3(leftOffsetX, rampHalf * 0.707, -halfL + rampHalf * 0.707),
      new THREE.Euler(Math.PI / 4, 0, 0),
      new THREE.Vector3(sideBackWidth, rampThick, rampWidth),
      rampMat
    );
    this.createAngledRamp(
      new THREE.Vector3(rightOffsetX, rampHalf * 0.707, -halfL + rampHalf * 0.707),
      new THREE.Euler(Math.PI / 4, 0, 0),
      new THREE.Vector3(sideBackWidth, rampThick, rampWidth),
      rampMat
    );

    // Orange Back Wall Ramps (Runs along X at Z = +50)
    this.createAngledRamp(
      new THREE.Vector3(leftOffsetX, rampHalf * 0.707, halfL - rampHalf * 0.707),
      new THREE.Euler(-Math.PI / 4, 0, 0),
      new THREE.Vector3(sideBackWidth, rampThick, rampWidth),
      rampMat
    );
    this.createAngledRamp(
      new THREE.Vector3(rightOffsetX, rampHalf * 0.707, halfL - rampHalf * 0.707),
      new THREE.Euler(-Math.PI / 4, 0, 0),
      new THREE.Vector3(sideBackWidth, rampThick, rampWidth),
      rampMat
    );

    // -------------------------------------------------------------
    // 4. 45-DEGREE ARENA CORNER WALLS (Rocket League Octagonal Arenas)
    // -------------------------------------------------------------
    const cornerCut = 9.0;
    const cornerW = cornerCut * 1.414;

    // Corner 1: Blue Left (-X, -Z)
    this.createAngledRamp(
      new THREE.Vector3(-halfW + cornerCut / 2, h / 2, -halfL + cornerCut / 2),
      new THREE.Euler(0, -Math.PI / 4, 0),
      new THREE.Vector3(cornerW, h, 0.6),
      glassWallMat
    );
    // Corner 2: Blue Right (+X, -Z)
    this.createAngledRamp(
      new THREE.Vector3(halfW - cornerCut / 2, h / 2, -halfL + cornerCut / 2),
      new THREE.Euler(0, Math.PI / 4, 0),
      new THREE.Vector3(cornerW, h, 0.6),
      glassWallMat
    );
    // Corner 3: Orange Left (-X, +Z)
    this.createAngledRamp(
      new THREE.Vector3(-halfW + cornerCut / 2, h / 2, halfL - cornerCut / 2),
      new THREE.Euler(0, Math.PI / 4, 0),
      new THREE.Vector3(cornerW, h, 0.6),
      glassWallMat
    );
    // Corner 4: Orange Right (+X, +Z)
    this.createAngledRamp(
      new THREE.Vector3(halfW - cornerCut / 2, h / 2, halfL - cornerCut / 2),
      new THREE.Euler(0, -Math.PI / 4, 0),
      new THREE.Vector3(cornerW, h, 0.6),
      glassWallMat
    );

    // Glowing Neon Perimeter Border Trim
    this.createNeonBorderStrips();
  }

  private createSolidWall(position: THREE.Vector3, size: THREE.Vector3, material: THREE.Material): void {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(position);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setFriction(0.3)
      .setRestitution(0.4);
    this.world.createCollider(colDesc, body);
  }

  private createAngledRamp(
    position: THREE.Vector3,
    rotation: THREE.Euler,
    size: THREE.Vector3,
    material: THREE.Material
  ): void {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const q = new THREE.Quaternion().setFromEuler(rotation);
    bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const body = this.world.createRigidBody(bodyDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setFriction(0.4)
      .setRestitution(0.35);
    this.world.createCollider(colDesc, body);
  }

  private createNeonBorderStrips(): void {
    const blueStripMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const orangeStripMat = new THREE.MeshBasicMaterial({ color: 0xff7700 });
    this.animatedLightStrips.push(blueStripMat, orangeStripMat);

    // Glowing base line around pitch
    const stripGeo = new THREE.BoxGeometry(0.3, 0.15, this.length);
    const leftStrip = new THREE.Mesh(stripGeo, blueStripMat);
    leftStrip.position.set(-this.width / 2 + 0.15, 0.08, 0);
    this.scene.add(leftStrip);

    const rightStrip = new THREE.Mesh(stripGeo, orangeStripMat);
    rightStrip.position.set(this.width / 2 - 0.15, 0.08, 0);
    this.scene.add(rightStrip);
  }

  private buildGoals(): void {
    const halfL = this.length / 2;
    const gw = this.goalWidth;
    const gh = this.goalHeight;
    const gd = this.goalDepth;

    const bluePostMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.15
    });

    const orangePostMat = new THREE.MeshStandardMaterial({
      color: 0xff7700,
      emissive: 0xff5500,
      emissiveIntensity: 0.9,
      metalness: 0.8,
      roughness: 0.15
    });

    const netMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });

    // --- BLUE GOAL (-Z = -50) ---
    this.createGoalAssembly(-halfL, -1, 0x00d2ff, bluePostMat, netMat);

    // Blue Sensor Collider inside Net
    const blueSensorBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, gh / 2, -halfL - gd / 2)
    );
    const blueSensorDesc = RAPIER.ColliderDesc.cuboid(gw / 2 - 0.5, gh / 2 - 0.5, gd / 2 - 0.5)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.blueGoalSensorCollider = this.world.createCollider(blueSensorDesc, blueSensorBody);

    // --- ORANGE GOAL (+Z = +50) ---
    this.createGoalAssembly(halfL, 1, 0xff7700, orangePostMat, netMat);

    // Orange Sensor Collider inside Net
    const orangeSensorBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, gh / 2, halfL + gd / 2)
    );
    const orangeSensorDesc = RAPIER.ColliderDesc.cuboid(gw / 2 - 0.5, gh / 2 - 0.5, gd / 2 - 0.5)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    this.orangeGoalSensorCollider = this.world.createCollider(orangeSensorDesc, orangeSensorBody);
  }

  private createGoalAssembly(
    zPos: number,
    dir: number,
    glowColor: number,
    postMat: THREE.Material,
    netMat: THREE.Material
  ): void {
    const gw = this.goalWidth;
    const gh = this.goalHeight;
    const gd = this.goalDepth;
    const postRadius = 0.4;

    const group = new THREE.Group();

    // 1. Sleek High-Tech Goal Posts (Left, Right, Top Crossbar)
    const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, gh, 24);
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-gw / 2, gh / 2, zPos);
    group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(gw / 2, gh / 2, zPos);
    group.add(rightPost);

    const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, gw + postRadius * 2, 24);
    const crossbar = new THREE.Mesh(crossbarGeo, postMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, gh, zPos);
    group.add(crossbar);

    // 2. Net Box Structure
    const netGeo = new THREE.BoxGeometry(gw, gh, gd);
    const netMesh = new THREE.Mesh(netGeo, netMat);
    netMesh.position.set(0, gh / 2, zPos + (dir * gd) / 2);
    group.add(netMesh);

    // Glowing Neon Goal Line on Floor
    const lineGeo = new THREE.PlaneGeometry(gw, 1.2);
    const lineMat = new THREE.MeshBasicMaterial({ color: glowColor, side: THREE.DoubleSide });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.rotation.x = -Math.PI / 2;
    lineMesh.position.set(0, 0.04, zPos);
    group.add(lineMesh);

    this.scene.add(group);

    // Goal Net Solid Physics Walls (Back wall, Left wall, Right wall, Roof)
    const netWalls = [
      { pos: new THREE.Vector3(0, gh / 2, zPos + dir * gd), size: new THREE.Vector3(gw, gh, 0.5) },
      { pos: new THREE.Vector3(-gw / 2, gh / 2, zPos + (dir * gd) / 2), size: new THREE.Vector3(0.5, gh, gd) },
      { pos: new THREE.Vector3(gw / 2, gh / 2, zPos + (dir * gd) / 2), size: new THREE.Vector3(0.5, gh, gd) },
      { pos: new THREE.Vector3(0, gh, zPos + (dir * gd) / 2), size: new THREE.Vector3(gw, 0.5, gd) }
    ];

    netWalls.forEach((w) => {
      const b = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(w.pos.x, w.pos.y, w.pos.z));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(w.size.x / 2, w.size.y / 2, w.size.z / 2).setRestitution(0.2), b);
    });
  }

  private buildStadiumGrandstands(): void {
    // 1. Electronic LED Animated Stadium Billboards
    const billboardTexts = ['⚡ ROCKET LEAGUE ⚡', '🚀 HYPER DRIVE', '🔥 AERIAL MASTERS', '⚡ SUPERSPEED BOOST'];
    
    billboardTexts.forEach((text, idx) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#060d17';
      ctx.fillRect(0, 0, 1024, 128);

      ctx.fillStyle = idx % 2 === 0 ? '#00d2ff' : '#ff7700';
      ctx.font = 'bold 56px "Outfit", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.fillText(text, 512, 64);

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      this.billboardMats.push(mat);

      // Left & Right Upper Billboards
      const boardGeo = new THREE.PlaneGeometry(42, 4.5);
      const leftBoard = new THREE.Mesh(boardGeo, mat);
      leftBoard.position.set(-this.width / 2 - 0.8, 16 + (idx % 2) * 6, -22 + idx * 15);
      leftBoard.rotation.y = Math.PI / 2;
      this.scene.add(leftBoard);

      const rightBoard = new THREE.Mesh(boardGeo, mat);
      rightBoard.position.set(this.width / 2 + 0.8, 16 + (idx % 2) * 6, -22 + idx * 15);
      rightBoard.rotation.y = -Math.PI / 2;
      this.scene.add(rightBoard);
    });

    // 2. Giant Stadium Arch Structure
    const stadiumFrameMat = new THREE.MeshStandardMaterial({
      color: 0x08121e,
      metalness: 0.9,
      roughness: 0.25
    });

    const ribCount = 14;
    for (let i = 0; i <= ribCount; i++) {
      const z = -this.length / 2 + (i / ribCount) * this.length;
      const archGeo = new THREE.TorusGeometry(35, 0.7, 10, 36, Math.PI);
      const archMesh = new THREE.Mesh(archGeo, stadiumFrameMat);
      archMesh.position.set(0, 0, z);
      archMesh.rotation.x = Math.PI;
      this.scene.add(archMesh);
    }
  }

  private buildFloodlightBeams(): void {
    // Volumetric Glow Cones from 4 Corner Floodlight Towers
    const floodlightPositions = [
      { pos: new THREE.Vector3(-38, 34, -55), target: new THREE.Vector3(-10, 0, -20), color: 0x00d2ff },
      { pos: new THREE.Vector3(38, 34, -55), target: new THREE.Vector3(10, 0, -20), color: 0x00d2ff },
      { pos: new THREE.Vector3(-38, 34, 55), target: new THREE.Vector3(-10, 0, 20), color: 0xff7700 },
      { pos: new THREE.Vector3(38, 34, 55), target: new THREE.Vector3(10, 0, 20), color: 0xff7700 }
    ];

    floodlightPositions.forEach(({ pos, target, color }) => {
      const dir = new THREE.Vector3().subVectors(target, pos);
      const len = dir.length();
      
      const beamGeo = new THREE.ConeGeometry(14, len, 24, 1, true);
      beamGeo.translate(0, -len / 2, 0);
      beamGeo.rotateX(-Math.PI / 2);

      const beamMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });

      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.copy(pos);
      beamMesh.lookAt(target);
      this.scene.add(beamMesh);
    });
  }

  private buildBoostPads(): void {
    // 6 Big Full Boost Orbs (+100)
    const bigPadLocations = [
      new THREE.Vector3(-24, 0.05, -42), // Blue Back Left
      new THREE.Vector3(24, 0.05, -42),  // Blue Back Right
      new THREE.Vector3(-26, 0.05, 0),    // Mid Left
      new THREE.Vector3(26, 0.05, 0),     // Mid Right
      new THREE.Vector3(-24, 0.05, 42),  // Orange Back Left
      new THREE.Vector3(24, 0.05, 42)   // Orange Back Right
    ];

    bigPadLocations.forEach((pos) => {
      const padGroup = new THREE.Group();
      padGroup.position.copy(pos);

      // Glowing Ground Ring
      const ringGeo = new THREE.RingGeometry(1.6, 2.4, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      padGroup.add(ringMesh);

      // Rotating Faceted Cyber Crystal
      const crystalGeo = new THREE.OctahedronGeometry(0.9, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xffc400,
        emissive: 0xff8800,
        emissiveIntensity: 1.4,
        roughness: 0.1,
        metalness: 0.9
      });
      const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
      crystalMesh.position.y = 1.4;
      crystalMesh.castShadow = true;
      padGroup.add(crystalMesh);

      this.scene.add(padGroup);

      this.boostPads.push({
        mesh: padGroup,
        position: pos.clone(),
        isBig: true,
        amount: 100,
        active: true,
        respawnTime: 10.0,
        timer: 0
      });
    });

    // 12 Small Boost Pads (+12)
    const smallPadLocations = [
      new THREE.Vector3(0, 0.05, -35),
      new THREE.Vector3(-12, 0.05, -24),
      new THREE.Vector3(12, 0.05, -24),
      new THREE.Vector3(0, 0.05, -14),
      new THREE.Vector3(-14, 0.05, 0),
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(14, 0.05, 0),
      new THREE.Vector3(0, 0.05, 14),
      new THREE.Vector3(-12, 0.05, 24),
      new THREE.Vector3(12, 0.05, 24),
      new THREE.Vector3(0, 0.05, 35)
    ];

    smallPadLocations.forEach((pos) => {
      const padGroup = new THREE.Group();
      padGroup.position.copy(pos);

      // Glowing Yellow Ground Diamond
      const diamondGeo = new THREE.CircleGeometry(0.95, 4);
      const diamondMat = new THREE.MeshBasicMaterial({
        color: 0xffea00,
        side: THREE.DoubleSide
      });
      const diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
      diamondMesh.rotation.x = -Math.PI / 2;
      diamondMesh.rotation.z = Math.PI / 4;
      padGroup.add(diamondMesh);

      this.scene.add(padGroup);

      this.boostPads.push({
        mesh: padGroup,
        position: pos.clone(),
        isBig: false,
        amount: 12,
        active: true,
        respawnTime: 4.0,
        timer: 0
      });
    });
  }

  public update(deltaTime: number): void {
    const time = performance.now() * 0.003;

    // Animate LED billboard scrolls
    this.billboardMats.forEach((mat) => {
      if (mat.map) {
        mat.map.offset.x = (time * 0.1) % 1;
      }
    });

    // Animate boost pickups & handle respawn timers
    this.boostPads.forEach((pad) => {
      if (!pad.active) {
        pad.timer -= deltaTime;
        if (pad.timer <= 0) {
          pad.active = true;
          pad.mesh.visible = true;
        }
      } else {
        if (pad.isBig) {
          const crystal = pad.mesh.children[1];
          if (crystal) {
            crystal.rotation.y = time * 2.2;
            crystal.rotation.z = time * 1.1;
            crystal.position.y = 1.4 + Math.sin(time * 3.5) * 0.22;
          }
        }
      }
    });
  }
}
