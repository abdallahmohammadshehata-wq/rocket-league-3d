import * as THREE from 'three';
import { Car } from '../entities/Car';
import { Ball } from './../entities/Ball';

export interface CameraSettings {
  fov: number;
  distance: number;
  height: number;
  angle: number;
  stiffness: number;
}

export class CameraController {
  public cameraP1: THREE.PerspectiveCamera;
  public cameraP2: THREE.PerspectiveCamera;

  public isBallCamP1: boolean = true;
  public isBallCamP2: boolean = true;
  public isSplitScreen: boolean = false;

  public settings: CameraSettings = {
    fov: 68,
    distance: 8.5,
    height: 3.0,
    angle: -3.0,
    stiffness: 12.0
  };

  private currentLookAtP1: THREE.Vector3 = new THREE.Vector3();
  private currentLookAtP2: THREE.Vector3 = new THREE.Vector3();
  private shakeIntensityP1: number = 0;
  private shakeIntensityP2: number = 0;
  private shakeDecay: number = 5.0;

  // Arena wall boundary limits for camera collision avoidance
  private readonly arenaLimits = {
    minX: -38.5,
    maxX: 38.5,
    minZ: -48.5,
    maxZ: 48.5,
    minY: 1.2,
    maxY: 19.0
  };

  constructor(aspect: number) {
    this.cameraP1 = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.1, 1000);
    this.cameraP2 = new THREE.PerspectiveCamera(this.settings.fov, aspect, 0.1, 1000);
  }

  public toggleModeP1(): boolean {
    this.isBallCamP1 = !this.isBallCamP1;
    return this.isBallCamP1;
  }

  public toggleModeP2(): boolean {
    this.isBallCamP2 = !this.isBallCamP2;
    return this.isBallCamP2;
  }

  public addScreenShake(amount: number): void {
    this.shakeIntensityP1 = Math.min(2.0, this.shakeIntensityP1 + amount);
    this.shakeIntensityP2 = Math.min(2.0, this.shakeIntensityP2 + amount);
  }

  public update(dt: number, carP1: Car, carP2: Car, ball: Ball): void {
    // 1. Update Player 1 Camera
    this.updateSingleCamera(
      dt,
      this.cameraP1,
      carP1,
      ball,
      this.isBallCamP1,
      this.currentLookAtP1,
      this.shakeIntensityP1
    );
    this.shakeIntensityP1 = Math.max(0, this.shakeIntensityP1 - this.shakeDecay * dt);

    // 2. Update Player 2 Camera (if active / 2-player mode)
    if (this.isSplitScreen) {
      this.updateSingleCamera(
        dt,
        this.cameraP2,
        carP2,
        ball,
        this.isBallCamP2,
        this.currentLookAtP2,
        this.shakeIntensityP2
      );
      this.shakeIntensityP2 = Math.max(0, this.shakeIntensityP2 - this.shakeDecay * dt);
    }
  }

  public snap(carP1: Car, carP2: Car, ball: Ball): void {
    this.updateSingleCamera(1.0, this.cameraP1, carP1, ball, this.isBallCamP1, this.currentLookAtP1, 0, true);
    if (this.isSplitScreen) {
      this.updateSingleCamera(1.0, this.cameraP2, carP2, ball, this.isBallCamP2, this.currentLookAtP2, 0, true);
    }
  }

  private updateSingleCamera(
    dt: number,
    camera: THREE.PerspectiveCamera,
    car: Car,
    ball: Ball,
    isBallCam: boolean,
    currentLookAt: THREE.Vector3,
    shakeIntensity: number,
    snap: boolean = false
  ): void {
    const carPos = car.getPosition();
    const carForward = car.getForward();
    const carUp = car.getUp();
    const ballPos = ball.getPosition();

    let targetCamPos: THREE.Vector3;
    let targetLookAt: THREE.Vector3;

    if (isBallCam) {
      // Vector from Ball to Car (in XZ horizontal plane)
      const ballToCar = new THREE.Vector3(carPos.x - ballPos.x, 0, carPos.z - ballPos.z);
      const horizontalDist = ballToCar.length();

      let camDir: THREE.Vector3;
      if (horizontalDist < 1.5) {
        // When car is directly under/above the ball, maintain car's rear view direction
        camDir = carForward.clone().negate();
      } else {
        camDir = ballToCar.normalize();
      }

      // Position camera behind the car relative to the ball
      targetCamPos = carPos.clone()
        .add(camDir.multiplyScalar(this.settings.distance))
        .add(new THREE.Vector3(0, this.settings.height, 0));

      // Look at a weighted focus point between car and ball so car stays visible at screen bottom
      targetLookAt = new THREE.Vector3(
        carPos.x * 0.2 + ballPos.x * 0.8,
        carPos.y * 0.25 + ballPos.y * 0.75 + 0.6,
        carPos.z * 0.2 + ballPos.z * 0.8
      );
    } else {
      // Car Cam (Chase Camera)
      targetCamPos = carPos.clone()
        .sub(carForward.clone().multiplyScalar(this.settings.distance))
        .add(carUp.clone().multiplyScalar(this.settings.height));

      targetLookAt = carPos.clone().add(carForward.clone().multiplyScalar(8.0)).add(new THREE.Vector3(0, 0.8, 0));
    }

    // Arena boundary collision clamping
    targetCamPos.x = THREE.MathUtils.clamp(targetCamPos.x, this.arenaLimits.minX, this.arenaLimits.maxX);
    targetCamPos.z = THREE.MathUtils.clamp(targetCamPos.z, this.arenaLimits.minZ, this.arenaLimits.maxZ);
    targetCamPos.y = THREE.MathUtils.clamp(targetCamPos.y, this.arenaLimits.minY, this.arenaLimits.maxY);

    // Dynamic FOV adjustment for supersonic speed sensation
    const targetFov = car.isSupersonic ? this.settings.fov + 10 : this.settings.fov;
    camera.fov = snap ? targetFov : THREE.MathUtils.lerp(camera.fov, targetFov, dt * 6.0);
    camera.updateProjectionMatrix();

    // Smooth position and look-at interpolation
    const lerpRate = snap ? 1.0 : Math.min(1.0, dt * this.settings.stiffness);
    camera.position.lerp(targetCamPos, lerpRate);

    // Screen Shake
    if (shakeIntensity > 0.01) {
      const shakeOffset = new THREE.Vector3(
        (Math.random() - 0.5) * shakeIntensity * 0.4,
        (Math.random() - 0.5) * shakeIntensity * 0.4,
        (Math.random() - 0.5) * shakeIntensity * 0.4
      );
      camera.position.add(shakeOffset);
    }

    if (snap || currentLookAt.lengthSq() < 0.01) {
      currentLookAt.copy(targetLookAt);
    } else {
      currentLookAt.lerp(targetLookAt, lerpRate);
    }

    camera.lookAt(currentLookAt);
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (this.isSplitScreen) {
      // Left Viewport (Player 1)
      renderer.setViewport(0, 0, width / 2, height);
      renderer.setScissor(0, 0, width / 2, height);
      renderer.setScissorTest(true);
      this.cameraP1.aspect = (width / 2) / height;
      this.cameraP1.updateProjectionMatrix();
      renderer.render(scene, this.cameraP1);

      // Right Viewport (Player 2)
      renderer.setViewport(width / 2, 0, width / 2, height);
      renderer.setScissor(width / 2, 0, width / 2, height);
      renderer.setScissorTest(true);
      this.cameraP2.aspect = (width / 2) / height;
      this.cameraP2.updateProjectionMatrix();
      renderer.render(scene, this.cameraP2);

      renderer.setScissorTest(false);
    } else {
      // Full Screen Viewport (Player 1)
      renderer.setViewport(0, 0, width, height);
      this.cameraP1.aspect = width / height;
      this.cameraP1.updateProjectionMatrix();
      renderer.render(scene, this.cameraP1);
    }
  }

  public onResize(width: number, height: number): void {
    if (this.isSplitScreen) {
      this.cameraP1.aspect = (width / 2) / height;
      this.cameraP2.aspect = (width / 2) / height;
    } else {
      this.cameraP1.aspect = width / height;
    }
    this.cameraP1.updateProjectionMatrix();
    this.cameraP2.updateProjectionMatrix();
  }
}
