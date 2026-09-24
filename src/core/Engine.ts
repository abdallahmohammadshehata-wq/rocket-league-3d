import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SoundManager } from './SoundManager';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class Engine {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public world!: RAPIER.World;
  public eventQueue!: RAPIER.EventQueue;
  public soundManager: SoundManager;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  public readonly fixedDeltaTime: number = 1 / 120; // 120Hz High-Precision Physics step
  private readonly maxSubsteps: number = 5; // Prevent accumulator spiral-of-death

  private physicsCallbacks: Array<(fixedDeltaTime: number) => void> = [];
  private renderCallbacks: Array<(alpha: number, deltaTime: number) => void> = [];

  constructor() {
    this.soundManager = new SoundManager();
  }

  public async init(container: HTMLElement): Promise<void> {
    // 1. Initialize Rapier3D Physics
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(0.0, -13.2, 0.0);
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);

    // 2. Initialize Three.js Graphics
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060913);
    this.scene.fog = new THREE.FogExp2(0x060913, 0.008);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
    this.camera.position.set(0, 10, 25);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    // High-Dynamic Range Environment Reflections for Clearcoat Paint & Glass
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;

    container.appendChild(this.renderer.domElement);

    // 3. Setup Stadium Lighting
    this.setupLighting();

    // 4. Handle Window Resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting(): void {
    // Ambient stadium glow
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    // Hemispherical arena light
    const hemiLight = new THREE.HemisphereLight(0x00d2ff, 0xff7700, 0.5);
    hemiLight.position.set(0, 45, 0);
    this.scene.add(hemiLight);

    // 4 Corner Stadium Floodlights with Soft Shadows
    const floodlightPositions = [
      { x: -38, y: 34, z: -55, targetX: 0, targetZ: -15 },
      { x: 38, y: 34, z: -55, targetX: 0, targetZ: -15 },
      { x: -38, y: 34, z: 55, targetX: 0, targetZ: 15 },
      { x: 38, y: 34, z: 55, targetX: 0, targetZ: 15 }
    ];

    floodlightPositions.forEach((pos) => {
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
      dirLight.position.set(pos.x, pos.y, pos.z);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 130;
      dirLight.shadow.camera.left = -48;
      dirLight.shadow.camera.right = 48;
      dirLight.shadow.camera.top = 48;
      dirLight.shadow.camera.bottom = -48;
      dirLight.shadow.bias = -0.0004;

      const target = new THREE.Object3D();
      target.position.set(pos.targetX, 0, pos.targetZ);
      this.scene.add(target);
      dirLight.target = target;

      this.scene.add(dirLight);
    });

    // Colored accent goal spot lights & arena center core
    const blueGoalLight = new THREE.PointLight(0x00d2ff, 6.0, 45, 1.2);
    blueGoalLight.position.set(0, 8, -50);
    this.scene.add(blueGoalLight);

    const orangeGoalLight = new THREE.PointLight(0xff7700, 6.0, 45, 1.2);
    orangeGoalLight.position.set(0, 8, 50);
    this.scene.add(orangeGoalLight);

    const centerGlow = new THREE.PointLight(0x00ffff, 2.0, 30, 1.5);
    centerGlow.position.set(0, 12, 0);
    this.scene.add(centerGlow);
  }

  public onPhysicsStep(callback: (fixedDeltaTime: number) => void): void {
    this.physicsCallbacks.push(callback);
  }

  public customRender: ((renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void) | null = null;

  public onRenderStep(callback: (alpha: number, deltaTime: number) => void): void {
    this.renderCallbacks.push(callback);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame((time) => this.loop(time));
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;
    this.accumulator += frameTime;

    // Fixed timestep physics update loop with substepping
    let substeps = 0;
    while (this.accumulator >= this.fixedDeltaTime && substeps < this.maxSubsteps) {
      for (const cb of this.physicsCallbacks) {
        cb(this.fixedDeltaTime);
      }

      this.world.step(this.eventQueue);
      this.accumulator -= this.fixedDeltaTime;
      substeps++;
    }

    if (substeps >= this.maxSubsteps) {
      this.accumulator = 0; // Prevent overflow
    }

    // Alpha interpolation factor for ultra-smooth rendering
    const alpha = this.accumulator / this.fixedDeltaTime;

    for (const cb of this.renderCallbacks) {
      cb(alpha, frameTime);
    }

    if (this.customRender) {
      this.customRender(this.renderer, this.scene);
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    requestAnimationFrame((time) => this.loop(time));
  }

  private onWindowResize(): void {
    if (!this.renderer || !this.camera) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
