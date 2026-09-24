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
  public readonly fixedDeltaTime: number = 1 / 60; // Rock-solid 60Hz physics with alpha interpolation
  private readonly maxSubsteps: number = 4; // Prevent accumulator lag

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

    // 2. Initialize Three.js Graphics (Unreal Engine quality rendering)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050813);
    this.scene.fog = new THREE.FogExp2(0x050813, 0.007);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 1000);
    this.camera.position.set(0, 10, 25);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Balanced high-DPI performance
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

    // 4. Preload 3D Supercar Assets
    import('../entities/CarModelPresets').then((mod) => mod.preloadFerrariModel());

    // 5. Handle Window Resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting(): void {
    // Ambient stadium glow
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    // Hemispherical arena light (Cyan sky, Warm amber turf bounce)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.65);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Primary High-Quality Key Stadium Floodlight (Casts soft high-resolution shadows)
    const primarySun = new THREE.DirectionalLight(0xffffff, 1.3);
    primarySun.position.set(35, 42, -45);
    primarySun.castShadow = true;
    primarySun.shadow.mapSize.width = 2048;
    primarySun.shadow.mapSize.height = 2048;
    primarySun.shadow.camera.near = 0.5;
    primarySun.shadow.camera.far = 140;
    primarySun.shadow.camera.left = -50;
    primarySun.shadow.camera.right = 50;
    primarySun.shadow.camera.top = 50;
    primarySun.shadow.camera.bottom = -50;
    primarySun.shadow.bias = -0.0003;
    primarySun.shadow.normalBias = 0.02;
    primarySun.shadow.radius = 2.0;

    const sunTarget = new THREE.Object3D();
    sunTarget.position.set(0, 0, 0);
    this.scene.add(sunTarget);
    primarySun.target = sunTarget;
    this.scene.add(primarySun);

    // Secondary Fill Lights (No expensive shadow map overhead - delivers max 60FPS speed!)
    const fillLight1 = new THREE.DirectionalLight(0x00d2ff, 0.7);
    fillLight1.position.set(-38, 34, -55);
    this.scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xff7700, 0.7);
    fillLight2.position.set(38, 34, 55);
    this.scene.add(fillLight2);

    const fillLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight3.position.set(-38, 34, 55);
    this.scene.add(fillLight3);

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
