import * as THREE from 'three';

export type CarChassisType = 'OCTANE' | 'DOMINUS' | 'FENNEC' | 'CYBER_RACER';
export type CarTopperType = 'NONE' | 'CROWN' | 'HALO' | 'CYBER_VISOR' | 'WIZARD_HAT' | 'DEVIL_HORNS';
export type CarDecalType = 'NONE' | 'STRIPES' | 'FLAMES' | 'CYBER_GRID' | 'CARBON';

export interface CarCustomization {
  chassis: CarChassisType;
  primaryColor: number;
  accentColor: number;
  decal: CarDecalType;
  topper: CarTopperType;
  underglowColor: number;
  boostColor: number;
}

export const DEFAULT_P1_CUSTOMIZATION: CarCustomization = {
  chassis: 'OCTANE',
  primaryColor: 0x0088ff,
  accentColor: 0x00ffff,
  decal: 'STRIPES',
  topper: 'HALO',
  underglowColor: 0x00d2ff,
  boostColor: 0x00ffff
};

export const DEFAULT_P2_CUSTOMIZATION: CarCustomization = {
  chassis: 'DOMINUS',
  primaryColor: 0xff5500,
  accentColor: 0xffaa00,
  decal: 'FLAMES',
  topper: 'CROWN',
  underglowColor: 0xff7700,
  boostColor: 0xff8800
};

export class CarChassisBuilder {
  /**
   * Builds high-detail AAA 3D Battle-Car models with realistic aerodynamics,
   * custom wheel rims, brake calipers, rollcages, engine blocks, and exhaust thrusters.
   */
  public static buildChassis(
    parentGroup: THREE.Group,
    custom: CarCustomization,
    isBlueTeam: boolean
  ): {
    bodyMesh: THREE.Mesh;
    wheels: THREE.Mesh[];
    wheelHubs: THREE.Group[];
    thrusterGroup: THREE.Group;
    supersonicTrails: THREE.Mesh[];
    taillightMat: THREE.MeshBasicMaterial;
    underglowMesh: THREE.Mesh;
    topperGroup: THREE.Group;
  } {
    // Clear any previous children in parentGroup
    while (parentGroup.children.length > 0) {
      parentGroup.remove(parentGroup.children[0]);
    }

    // High-Fidelity PBR Materials
    const paintMat = new THREE.MeshStandardMaterial({
      color: custom.primaryColor,
      metalness: 0.85,
      roughness: 0.18
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: custom.accentColor,
      emissive: custom.accentColor,
      emissiveIntensity: 0.65,
      metalness: 0.9,
      roughness: 0.12
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x11151e,
      metalness: 0.95,
      roughness: 0.35
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      metalness: 0.8,
      roughness: 0.5
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 1.0,
      roughness: 0.05
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x060c18,
      transmission: 0.88,
      opacity: 0.95,
      transparent: true,
      roughness: 0.04,
      metalness: 0.1,
      ior: 1.52
    });

    const glowLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    let bodyMesh: THREE.Mesh = new THREE.Mesh();
    const wheels: THREE.Mesh[] = [];
    const wheelHubs: THREE.Group[] = [];
    const supersonicTrails: THREE.Mesh[] = [];
    const thrusterGroup = new THREE.Group();
    const topperGroup = new THREE.Group();

    // =============================================================
    // 1. HIGH-DETAIL 3D CHASSIS GEOMETRIES
    // =============================================================
    if (custom.chassis === 'DOMINUS') {
      // -----------------------------------------------------------
      // DOMINUS: LOW-PROFILE MUSCLE GT BATTLE-CAR
      // -----------------------------------------------------------
      // Lower Skid Plate & Chassis Floor
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.28, 3.8), carbonMat);
      chassis.position.y = 0.18;
      chassis.castShadow = true;
      parentGroup.add(chassis);

      // Low Chiseled Hood & Muscle Nose
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.32, 1.6), paintMat);
      hood.position.set(0, 0.44, -1.15);
      hood.castShadow = true;
      parentGroup.add(hood);

      // Aggressive Front Carbon Splitter with Struts
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), carbonMat);
      splitter.position.set(0, 0.15, -1.9);
      parentGroup.add(splitter);

      [-0.6, 0.6].forEach((x) => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8), chromeMat);
        strut.position.set(x, 0.26, -1.82);
        strut.rotation.x = -0.3;
        parentGroup.add(strut);
      });

      // Front Honeycomb Grille & Recessed Headlight Pods
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.1), darkTrimMat);
      grille.position.set(0, 0.38, -1.96);
      parentGroup.add(grille);

      [-0.65, 0.65].forEach((x) => {
        const headPod = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.12), glowLightMat);
        headPod.position.set(x, 0.42, -1.95);
        parentGroup.add(headPod);
      });

      // Supercharged Engine Blower with Triple Butterfly Valves
      const blowerBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 0.75), chromeMat);
      blowerBase.position.set(0, 0.68, -0.95);
      parentGroup.add(blowerBase);

      const blowerScoop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.45, 12), accentMat);
      blowerScoop.rotation.x = Math.PI / 2;
      blowerScoop.position.set(0, 0.82, -1.1);
      parentGroup.add(blowerScoop);

      for (let i = -1; i <= 1; i++) {
        const valve = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: 0xff3300, side: THREE.DoubleSide }));
        valve.position.set(i * 0.12, 0.82, -1.33);
        parentGroup.add(valve);
      }

      // Fastback Cabin & Sloped Roof
      bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.44, 2.1), paintMat);
      bodyMesh.position.set(0, 0.58, 0.35);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Low-Profile Tinted Windshield & Fastback Rear Window
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.38, 0.95), glassMat);
      windshield.position.set(0, 0.72, -0.22);
      windshield.rotation.x = -0.32;
      parentGroup.add(windshield);

      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.32, 1.1), glassMat);
      rearGlass.position.set(0, 0.68, 0.85);
      rearGlass.rotation.x = 0.25;
      parentGroup.add(rearGlass);

      // Widebody Flared Rear Quarter Fenders with Cooling Intakes
      [-0.92, 0.92].forEach((x, idx) => {
        const flare = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.46, 1.4), paintMat);
        flare.position.set(x, 0.48, 0.9);
        parentGroup.add(flare);

        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.3), darkTrimMat);
        intake.position.set(x + (idx === 0 ? -0.1 : 0.1), 0.5, 0.2);
        parentGroup.add(intake);
      });

      // Integrated Carbon Ducktail Spoiler
      const ducktail = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.32), accentMat);
      ducktail.position.set(0, 0.82, 1.75);
      ducktail.rotation.x = 0.35;
      parentGroup.add(ducktail);

      // Rear Diffuser with Quad Exhaust Tips
      const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.35), carbonMat);
      diffuser.position.set(0, 0.18, 1.85);
      parentGroup.add(diffuser);

      [-0.65, -0.45, 0.45, 0.65].forEach((x) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 16), chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, 0.25, 1.95);
        parentGroup.add(pipe);
      });

    } else if (custom.chassis === 'FENNEC') {
      // -----------------------------------------------------------
      // FENNEC: RALLY TOURING WIDEBODY HATCHBACK
      // -----------------------------------------------------------
      // Heavy-Duty Skid Plate Base
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 3.4), carbonMat);
      chassis.position.y = 0.2;
      chassis.castShadow = true;
      parentGroup.add(chassis);

      // Boxy Upright Cabin with Roof Scoop
      bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.78, 2.3), paintMat);
      bodyMesh.position.set(0, 0.78, 0.22);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Roof Ram-Air Scoop
      const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.65), carbonMat);
      roofScoop.position.set(0, 1.25, 0.1);
      parentGroup.add(roofScoop);

      // Short Sloped Hood with Heat Extraction Vents
      const hood = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.42, 1.15), paintMat);
      hood.position.set(0, 0.52, -1.2);
      hood.castShadow = true;
      parentGroup.add(hood);

      [-0.45, 0.45].forEach((x) => {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.55), darkTrimMat);
        vent.position.set(x, 0.72, -1.1);
        parentGroup.add(vent);
      });

      // Wide Rally Front Bumper & Dual Fog Pods
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.38, 0.45), carbonMat);
      bumper.position.set(0, 0.28, -1.72);
      parentGroup.add(bumper);

      [-0.4, 0.4].forEach((x) => {
        const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
        fog.rotation.x = Math.PI / 2;
        fog.position.set(x, 0.35, -1.95);
        parentGroup.add(fog);
      });

      // Panoramic Wrap-Around Windows
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.56, 0.85), glassMat);
      windshield.position.set(0, 0.92, -0.38);
      windshield.rotation.x = -0.22;
      parentGroup.add(windshield);

      const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 1.4), glassMat);
      sideGlassL.position.set(-0.93, 0.9, 0.35);
      parentGroup.add(sideGlassL);

      const sideGlassR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 1.4), glassMat);
      sideGlassR.position.set(0.93, 0.9, 0.35);
      parentGroup.add(sideGlassR);

      // Dual-Plane High-Mounted Rally Wing
      const wingTop = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 0.55), accentMat);
      wingTop.position.set(0, 1.28, 1.4);
      parentGroup.add(wingTop);

      [-0.85, 0.85].forEach((x) => {
        const wingEnd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.6), carbonMat);
        wingEnd.position.set(x, 1.25, 1.4);
        parentGroup.add(wingEnd);
      });

    } else if (custom.chassis === 'CYBER_RACER') {
      // -----------------------------------------------------------
      // CYBER RACER: HYPERSONIC STEALTH JET HYPERCAR
      // -----------------------------------------------------------
      // Ultra-Low Carbon Aerodynamic Underbody
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.25, 3.7), carbonMat);
      chassis.position.y = 0.16;
      parentGroup.add(chassis);

      // Arrowhead Monocoque Cockpit & Stealth Facets
      const noseGeo = new THREE.ConeGeometry(1.05, 2.8, 6);
      bodyMesh = new THREE.Mesh(noseGeo, paintMat);
      bodyMesh.rotation.x = Math.PI / 2;
      bodyMesh.position.set(0, 0.52, -0.4);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Fighter Jet Iridescent Canopy
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 24), glassMat);
      canopy.scale.set(1.15, 0.62, 2.2);
      canopy.position.set(0, 0.68, -0.15);
      parentGroup.add(canopy);

      // Hypersonic Side Air Tunnels & Pods
      [-0.88, 0.88].forEach((x) => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 2.9), paintMat);
        pod.position.set(x, 0.44, 0.15);
        parentGroup.add(pod);

        const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 2.6), accentMat);
        neonStrip.position.set(x + (x > 0 ? 0.22 : -0.22), 0.55, 0.15);
        parentGroup.add(neonStrip);
      });

      // Twin Angled Vertical Stabilizer Fins
      [-0.95, 0.95].forEach((x, idx) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.95), accentMat);
        fin.position.set(x, 0.88, 1.45);
        fin.rotation.z = idx === 0 ? 0.32 : -0.32;
        parentGroup.add(fin);
      });

      // Front Active Aero Canards
      [-1.0, 1.0].forEach((x, idx) => {
        const canard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.45), carbonMat);
        canard.position.set(x, 0.32, -1.45);
        canard.rotation.z = idx === 0 ? -0.2 : 0.2;
        parentGroup.add(canard);
      });

    } else {
      // -----------------------------------------------------------
      // OCTANE: THE ICONIC LEGENDARY BATTLE-CAR
      // -----------------------------------------------------------
      // Lower Skid Plate & Tubular Frame Base
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.38, 3.4), carbonMat);
      chassis.position.y = 0.22;
      chassis.castShadow = true;
      parentGroup.add(chassis);

      // Sculpted Buggy Curved Hood
      const hoodGeo = new THREE.CylinderGeometry(0.75, 0.98, 1.25, 8);
      const hood = new THREE.Mesh(hoodGeo, paintMat);
      hood.rotation.x = Math.PI / 2;
      hood.position.set(0, 0.48, -1.15);
      hood.castShadow = true;
      parentGroup.add(hood);

      // Reinforced Tubular Steel Roll Cage
      const cageMat = new THREE.MeshStandardMaterial({ color: 0x222838, metalness: 0.95, roughness: 0.2 });
      const barGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.9, 12);

      [-0.75, 0.75].forEach((x) => {
        const barSide = new THREE.Mesh(barGeo, cageMat);
        barSide.position.set(x, 0.92, 0.1);
        barSide.rotation.x = Math.PI / 2;
        parentGroup.add(barSide);

        const barPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.65, 12), cageMat);
        barPillar.position.set(x, 0.72, -0.65);
        barPillar.rotation.x = -0.4;
        parentGroup.add(barPillar);

        const barRear = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 12), cageMat);
        barRear.position.set(x, 0.72, 0.95);
        barRear.rotation.x = 0.45;
        parentGroup.add(barRear);
      });

      // Crossbars across roof
      [-0.5, 0.6].forEach((z) => {
        const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 12), cageMat);
        cross.rotation.z = Math.PI / 2;
        cross.position.set(0, 0.98, z);
        parentGroup.add(cross);
      });

      // Aerodynamic Cockpit & Tinted Glass Dome
      bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.58, 1.95), paintMat);
      bodyMesh.position.set(0, 0.68, 0.1);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.48, 1.1), glassMat);
      windshield.position.set(0, 0.84, -0.25);
      windshield.rotation.x = -0.35;
      parentGroup.add(windshield);

      // Exposed Twin Turbo V8 Engine Block behind Cockpit
      const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.85), chromeMat);
      engineBlock.position.set(0, 0.58, 1.05);
      parentGroup.add(engineBlock);

      [-0.3, 0.3].forEach((x) => {
        const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 12), accentMat);
        manifold.rotation.x = Math.PI / 2;
        manifold.position.set(x, 0.78, 1.05);
        parentGroup.add(manifold);
      });

      // Heavy Front Bullbar Bumper with Halo Headlights
      const bullbar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 0.45), carbonMat);
      bullbar.position.set(0, 0.28, -1.7);
      parentGroup.add(bullbar);

      [-0.72, 0.72].forEach((x) => {
        const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), glowLightMat);
        headlight.rotation.x = Math.PI / 2;
        headlight.position.set(x, 0.44, -1.88);
        parentGroup.add(headlight);

        const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 20), accentMat);
        haloRing.position.set(x, 0.44, -1.9);
        parentGroup.add(haloRing);
      });

      // High-Downforce GT Rear Wing on Angled Aluminum Stanchions
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.48), accentMat);
      spoiler.position.set(0, 1.25, 1.45);
      parentGroup.add(spoiler);

      [-0.72, 0.72].forEach((x) => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.14), carbonMat);
        strut.position.set(x, 1.02, 1.42);
        strut.rotation.x = -0.22;
        parentGroup.add(strut);
      });
    }

    // =============================================================
    // 2. RACING DECALS & LIVERY
    // =============================================================
    if (custom.decal === 'STRIPES') {
      [-0.28, 0.28].forEach((x) => {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18, 2.8),
          new THREE.MeshBasicMaterial({ color: custom.accentColor, side: THREE.DoubleSide })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 1.05, -0.15);
        parentGroup.add(stripe);
      });
    } else if (custom.decal === 'FLAMES') {
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      });
      const flame = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.9), flameMat);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(0, 0.88, -0.45);
      parentGroup.add(flame);
    } else if (custom.decal === 'CYBER_GRID') {
      const gridDecal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 2.4),
        new THREE.MeshBasicMaterial({ color: custom.accentColor, wireframe: true, side: THREE.DoubleSide })
      );
      gridDecal.rotation.x = -Math.PI / 2;
      gridDecal.position.set(0, 1.06, 0.1);
      parentGroup.add(gridDecal);
    }

    // =============================================================
    // 3. TOPPER ACCESSORIES
    // =============================================================
    topperGroup.position.set(0, 1.22, 0.2);
    if (custom.topper === 'HALO') {
      const haloGeo = new THREE.TorusGeometry(0.48, 0.07, 16, 32);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.38;
      topperGroup.add(halo);
    } else if (custom.topper === 'CROWN') {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15 });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.32, 18), crownMat);
      topperGroup.add(crownBase);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.35, 8), crownMat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.38, 0.28, Math.sin(angle) * 0.38);
        topperGroup.add(spike);
      }
    } else if (custom.topper === 'CYBER_VISOR') {
      const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.35), visorMat);
      visor.position.set(0, 0.16, -0.42);
      topperGroup.add(visor);
    } else if (custom.topper === 'DEVIL_HORNS') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0033, roughness: 0.2 });
      [-0.38, 0.38].forEach((x) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 14), hornMat);
        horn.position.set(x, 0.38, 0);
        horn.rotation.z = x > 0 ? -0.32 : 0.32;
        horn.rotation.x = 0.22;
        topperGroup.add(horn);
      });
    } else if (custom.topper === 'WIZARD_HAT') {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x4b0082, roughness: 0.7 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 22), hatMat);
      topperGroup.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.95, 18), hatMat);
      cone.position.y = 0.48;
      cone.rotation.z = -0.15;
      topperGroup.add(cone);
    }
    parentGroup.add(topperGroup);

    // =============================================================
    // 4. NEON LED TAILLIGHT BAR
    // =============================================================
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.1), taillightMat);
    tailBar.position.set(0, 0.55, 1.72);
    parentGroup.add(tailBar);

    // =============================================================
    // 5. NEON UNDERGLOW
    // =============================================================
    const underglowGeo = new THREE.PlaneGeometry(2.3, 3.5);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: custom.underglowColor,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.y = -0.14;
    parentGroup.add(underglowMesh);

    // =============================================================
    // 6. HIGH-DETAIL 3D RACING WHEELS, RIMS & BRAKE CALIPERS
    // =============================================================
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x161616,
      roughness: 0.88,
      metalness: 0.1
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: custom.accentColor,
      metalness: 0.95,
      roughness: 0.12
    });

    const rotorMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.9,
      roughness: 0.2
    });

    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xff0022,
      roughness: 0.25,
      metalness: 0.6
    });

    const wheelPositions = [
      new THREE.Vector3(-1.14, 0.16, -1.05), // Front Left
      new THREE.Vector3(1.14, 0.16, -1.05),  // Front Right
      new THREE.Vector3(-1.14, 0.16, 1.08),  // Rear Left
      new THREE.Vector3(1.14, 0.16, 1.08)    // Rear Right
    ];

    wheelPositions.forEach((pos, idx) => {
      const hub = new THREE.Group();
      hub.position.copy(pos);

      // Chunky Treaded Tire
      const tireGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.44, 28);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      hub.add(tire);

      // Deep-Dish Rim Barrel
      const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.45, 24), darkTrimMat);
      rimBarrel.rotation.z = Math.PI / 2;
      hub.add(rimBarrel);

      // 5-Spoke Star Rim Face
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.04), rimMat);
        const angle = (s / 5) * Math.PI * 2;
        spoke.position.set(idx % 2 === 0 ? -0.22 : 0.22, Math.sin(angle) * 0.16, Math.cos(angle) * 0.16);
        spoke.rotation.x = angle;
        hub.add(spoke);
      }

      // Center Hex Hub Cap
      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 6), chromeMat);
      hubCap.rotation.z = Math.PI / 2;
      hubCap.position.x = idx % 2 === 0 ? -0.23 : 0.23;
      hub.add(hubCap);

      // Slotted Brake Rotor
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20), rotorMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = idx % 2 === 0 ? -0.12 : 0.12;
      hub.add(rotor);

      // Red Racing Brake Caliper
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.12), caliperMat);
      caliper.position.set(idx % 2 === 0 ? -0.12 : 0.12, 0.18, 0);
      hub.add(caliper);

      parentGroup.add(hub);
      wheelHubs.push(hub);
      wheels.push(tire);
    });

    // =============================================================
    // 7. JET THRUSTER NOZZLES & AFTERBURNER FLAMES
    // =============================================================
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x222630, metalness: 0.95, roughness: 0.2 });

    [-0.38, 0.38].forEach((x) => {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.5, 20), nozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, 0.42, 1.72);
      parentGroup.add(nozzle);

      // Glowing interior heat ring
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16), accentMat);
      innerRing.position.set(x, 0.42, 1.95);
      parentGroup.add(innerRing);
    });

    const flameMat = new THREE.MeshBasicMaterial({ color: custom.boostColor, transparent: true, opacity: 0.92 });
    const flameCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98 });

    [-0.38, 0.38].forEach((x) => {
      const flameGroup = new THREE.Group();
      flameGroup.position.set(x, 0.42, 1.98);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 2.0, 16), flameMat);
      outerFlame.rotation.x = -Math.PI / 2;
      outerFlame.position.z = 1.0;
      flameGroup.add(outerFlame);

      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.2, 16), flameCoreMat);
      innerFlame.rotation.x = -Math.PI / 2;
      innerFlame.position.z = 0.6;
      flameGroup.add(innerFlame);

      thrusterGroup.add(flameGroup);
    });

    thrusterGroup.visible = false;
    parentGroup.add(thrusterGroup);

    // =============================================================
    // 8. SUPERSONIC SPEED TRAILS
    // =============================================================
    const trailMat = new THREE.MeshBasicMaterial({
      color: custom.accentColor,
      transparent: true,
      opacity: 0.88
    });

    [-1.02, 1.02].forEach((x) => {
      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 3.8), trailMat);
      trail.position.set(x, 0.16, 2.6);
      trail.visible = false;
      parentGroup.add(trail);
      supersonicTrails.push(trail);
    });

    return {
      bodyMesh,
      wheels,
      wheelHubs,
      thrusterGroup,
      supersonicTrails,
      taillightMat,
      underglowMesh,
      topperGroup
    };
  }
}
