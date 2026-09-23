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
   * Builds the chassis geometry and sub-meshes based on selected model preset.
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

    const paintMat = new THREE.MeshStandardMaterial({
      color: custom.primaryColor,
      metalness: 0.8,
      roughness: 0.18
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: custom.accentColor,
      emissive: custom.accentColor,
      emissiveIntensity: 0.6,
      metalness: 0.85,
      roughness: 0.12
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0d121c,
      metalness: 0.9,
      roughness: 0.3
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050912,
      transmission: 0.85,
      opacity: 0.95,
      transparent: true,
      roughness: 0.05,
      metalness: 0.1,
      ior: 1.5
    });

    let bodyMesh: THREE.Mesh;
    const wheels: THREE.Mesh[] = [];
    const wheelHubs: THREE.Group[] = [];
    const supersonicTrails: THREE.Mesh[] = [];
    const thrusterGroup = new THREE.Group();
    const topperGroup = new THREE.Group();

    // -------------------------------------------------------------
    // 1. BUILD CHASSIS ACCORDING TO MODEL PRESET
    // -------------------------------------------------------------
    if (custom.chassis === 'DOMINUS') {
      // DOMINUS (Long, Low-profile Muscle car)
      const chassisGeo = new THREE.BoxGeometry(1.95, 0.38, 3.7);
      const chassis = new THREE.Mesh(chassisGeo, darkMat);
      chassis.position.y = 0.22;
      chassis.castShadow = true;
      parentGroup.add(chassis);

      // Low wedge cabin
      const cabinGeo = new THREE.BoxGeometry(1.7, 0.45, 2.2);
      bodyMesh = new THREE.Mesh(cabinGeo, paintMat);
      bodyMesh.position.set(0, 0.58, 0.35);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Muscle long hood
      const hoodGeo = new THREE.BoxGeometry(1.75, 0.3, 1.4);
      const hood = new THREE.Mesh(hoodGeo, paintMat);
      hood.position.set(0, 0.44, -1.25);
      parentGroup.add(hood);

      // Supercharger blower on hood
      const blower = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.6), accentMat);
      blower.position.set(0, 0.65, -1.0);
      parentGroup.add(blower);

      // Sloped front splitter
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.15, 0.4), darkMat);
      splitter.position.set(0, 0.18, -1.85);
      parentGroup.add(splitter);

      // Windshield & fastback glass
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.38, 0.9), glassMat);
      windshield.position.set(0, 0.72, -0.25);
      parentGroup.add(windshield);

      // Ducktail rear spoiler
      const ducktail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.25), accentMat);
      ducktail.position.set(0, 0.85, 1.7);
      ducktail.rotation.x = 0.3;
      parentGroup.add(ducktail);

    } else if (custom.chassis === 'FENNEC') {
      // FENNEC (Boxy Hatchback, punchy compact shape)
      const chassisGeo = new THREE.BoxGeometry(2.0, 0.45, 3.3);
      const chassis = new THREE.Mesh(chassisGeo, darkMat);
      chassis.position.y = 0.25;
      chassis.castShadow = true;
      parentGroup.add(chassis);

      // Boxy upright cabin
      const cabinGeo = new THREE.BoxGeometry(1.8, 0.75, 2.3);
      bodyMesh = new THREE.Mesh(cabinGeo, paintMat);
      bodyMesh.position.set(0, 0.8, 0.2);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Sloped front hood
      const hoodGeo = new THREE.BoxGeometry(1.78, 0.45, 1.0);
      const hood = new THREE.Mesh(hoodGeo, paintMat);
      hood.position.set(0, 0.55, -1.2);
      parentGroup.add(hood);

      // Wide Rally front bumper
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 0.45), darkMat);
      bumper.position.set(0, 0.3, -1.65);
      parentGroup.add(bumper);

      // Rally grill
      const grill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.1), accentMat);
      grill.position.set(0, 0.45, -1.72);
      parentGroup.add(grill);

      // Boxy windshield
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 0.8), glassMat);
      windshield.position.set(0, 0.95, -0.4);
      parentGroup.add(windshield);

      // Roof spoiler
      const roofSpoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), accentMat);
      roofSpoiler.position.set(0, 1.25, 1.35);
      parentGroup.add(roofSpoiler);

    } else if (custom.chassis === 'CYBER_RACER') {
      // CYBER RACER (Futuristic Supercar, sharp angles)
      const chassisGeo = new THREE.BoxGeometry(2.1, 0.32, 3.6);
      const chassis = new THREE.Mesh(chassisGeo, darkMat);
      chassis.position.y = 0.2;
      parentGroup.add(chassis);

      // Jet fighter cabin
      const cabinGeo = new THREE.ConeGeometry(0.95, 2.6, 5);
      bodyMesh = new THREE.Mesh(cabinGeo, paintMat);
      bodyMesh.rotation.x = Math.PI / 2;
      bodyMesh.rotation.y = Math.PI / 5;
      bodyMesh.position.set(0, 0.65, -0.1);
      parentGroup.add(bodyMesh);

      // Twin cyber side pods
      [-0.85, 0.85].forEach((x) => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 2.8), accentMat);
        pod.position.set(x, 0.48, 0.1);
        parentGroup.add(pod);
      });

      // Jet canopy glass
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), glassMat);
      canopy.scale.set(1.1, 0.65, 2.0);
      canopy.position.set(0, 0.75, -0.1);
      parentGroup.add(canopy);

      // Twin angled stabilizer wings
      [-0.95, 0.95].forEach((x, idx) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.8), accentMat);
        fin.position.set(x, 0.9, 1.4);
        fin.rotation.z = idx === 0 ? 0.35 : -0.35;
        parentGroup.add(fin);
      });

    } else {
      // OCTANE (Standard Hybrid Battle-Car)
      const chassisGeo = new THREE.BoxGeometry(1.9, 0.45, 3.2);
      const chassis = new THREE.Mesh(chassisGeo, darkMat);
      chassis.position.y = 0.25;
      parentGroup.add(chassis);

      const bumperGeo = new THREE.BoxGeometry(2.1, 0.3, 0.5);
      const bumper = new THREE.Mesh(bumperGeo, accentMat);
      bumper.position.set(0, 0.25, -1.65);
      parentGroup.add(bumper);

      const cabinGeo = new THREE.BoxGeometry(1.65, 0.6, 1.9);
      bodyMesh = new THREE.Mesh(cabinGeo, paintMat);
      bodyMesh.position.set(0, 0.72, 0.1);
      parentGroup.add(bodyMesh);

      const hoodGeo = new THREE.CylinderGeometry(0.8, 0.95, 1.1, 4);
      const hood = new THREE.Mesh(hoodGeo, paintMat);
      hood.rotation.y = Math.PI / 4;
      hood.rotation.x = Math.PI / 2;
      hood.position.set(0, 0.5, -1.15);
      parentGroup.add(hood);

      const windshieldGeo = new THREE.BoxGeometry(1.5, 0.48, 1.05);
      const windshield = new THREE.Mesh(windshieldGeo, glassMat);
      windshield.position.set(0, 0.88, -0.22);
      parentGroup.add(windshield);

      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.45), accentMat);
      spoiler.position.set(0, 1.18, 1.45);
      parentGroup.add(spoiler);

      const standL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.12), darkMat);
      standL.position.set(-0.75, 0.98, 1.4);
      parentGroup.add(standL);

      const standR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.12), darkMat);
      standR.position.set(0.75, 0.98, 1.4);
      parentGroup.add(standR);
    }

    // -------------------------------------------------------------
    // 2. DECALS OVERLAY
    // -------------------------------------------------------------
    if (custom.decal === 'STRIPES') {
      [-0.3, 0.3].forEach((x) => {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18, 2.6),
          new THREE.MeshBasicMaterial({ color: custom.accentColor, side: THREE.DoubleSide })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 1.03, -0.2);
        parentGroup.add(stripe);
      });
    } else if (custom.decal === 'FLAMES') {
      const flame = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.8),
        new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(0, 0.85, -0.5);
      parentGroup.add(flame);
    } else if (custom.decal === 'CYBER_GRID') {
      const gridDecal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 2.2),
        new THREE.MeshBasicMaterial({ color: custom.accentColor, wireframe: true, side: THREE.DoubleSide })
      );
      gridDecal.rotation.x = -Math.PI / 2;
      gridDecal.position.set(0, 1.04, 0.1);
      parentGroup.add(gridDecal);
    }

    // -------------------------------------------------------------
    // 3. TOPPER HATS
    // -------------------------------------------------------------
    topperGroup.position.set(0, 1.15, 0.2);
    if (custom.topper === 'HALO') {
      const haloGeo = new THREE.TorusGeometry(0.45, 0.06, 12, 32);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.35;
      topperGroup.add(halo);
    } else if (custom.topper === 'CROWN') {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.3, 16), crownMat);
      topperGroup.add(crownBase);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 8), crownMat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.35, 0.25, Math.sin(angle) * 0.35);
        topperGroup.add(spike);
      }
    } else if (custom.topper === 'CYBER_VISOR') {
      const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.3), visorMat);
      visor.position.set(0, 0.15, -0.4);
      topperGroup.add(visor);
    } else if (custom.topper === 'DEVIL_HORNS') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0022, roughness: 0.3 });
      [-0.35, 0.35].forEach((x) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 12), hornMat);
        horn.position.set(x, 0.35, 0);
        horn.rotation.z = x > 0 ? -0.3 : 0.3;
        horn.rotation.x = 0.2;
        topperGroup.add(horn);
      });
    } else if (custom.topper === 'WIZARD_HAT') {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x4b0082, roughness: 0.8 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 20), hatMat);
      topperGroup.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 16), hatMat);
      cone.position.y = 0.45;
      cone.rotation.z = -0.15;
      topperGroup.add(cone);
    }
    parentGroup.add(topperGroup);

    // -------------------------------------------------------------
    // 4. LIGHTS (HEADLIGHTS & TAILLIGHT BAR)
    // -------------------------------------------------------------
    const lightGeo = new THREE.BoxGeometry(0.45, 0.12, 0.1);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headL = new THREE.Mesh(lightGeo, headMat);
    headL.position.set(-0.7, 0.42, -1.65);
    parentGroup.add(headL);

    const headR = new THREE.Mesh(lightGeo, headMat);
    headR.position.set(0.7, 0.42, -1.65);
    parentGroup.add(headR);

    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.08), taillightMat);
    tail.position.set(0, 0.55, 1.65);
    parentGroup.add(tail);

    // -------------------------------------------------------------
    // 5. NEON UNDERGLOW
    // -------------------------------------------------------------
    const underglowGeo = new THREE.PlaneGeometry(2.2, 3.4);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: custom.underglowColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.y = -0.15;
    parentGroup.add(underglowMesh);

    // -------------------------------------------------------------
    // 6. WHEELS & RIMS
    // -------------------------------------------------------------
    const tireGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.42, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 });
    const rimMat = new THREE.MeshStandardMaterial({ color: custom.accentColor, metalness: 0.9, roughness: 0.15 });

    const wheelPositions = [
      new THREE.Vector3(-1.12, 0.15, -1.05), // FL
      new THREE.Vector3(1.12, 0.15, -1.05),  // FR
      new THREE.Vector3(-1.12, 0.15, 1.05),  // RL
      new THREE.Vector3(1.12, 0.15, 1.05)    // RR
    ];

    wheelPositions.forEach((pos) => {
      const hub = new THREE.Group();
      hub.position.copy(pos);

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      hub.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.43, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      hub.add(rim);

      parentGroup.add(hub);
      wheelHubs.push(hub);
      wheels.push(tire);
    });

    // -------------------------------------------------------------
    // 7. THRUSTER NOZZLES & BOOST FLAMES
    // -------------------------------------------------------------
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.95 });
    const nozzleGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.45, 16);

    [-0.35, 0.35].forEach((x) => {
      const nozzle = new THREE.Mesh(nozzleGeo, exhaustMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, 0.38, 1.68);
      parentGroup.add(nozzle);
    });

    const flameMat = new THREE.MeshBasicMaterial({ color: custom.boostColor, transparent: true, opacity: 0.9 });
    const flameCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });

    [-0.35, 0.35].forEach((x) => {
      const flameGroup = new THREE.Group();
      flameGroup.position.set(x, 0.38, 1.95);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.8, 16), flameMat);
      outerFlame.rotation.x = -Math.PI / 2;
      outerFlame.position.z = 0.9;
      flameGroup.add(outerFlame);

      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 16), flameCoreMat);
      innerFlame.rotation.x = -Math.PI / 2;
      innerFlame.position.z = 0.55;
      flameGroup.add(innerFlame);

      thrusterGroup.add(flameGroup);
    });

    thrusterGroup.visible = false;
    parentGroup.add(thrusterGroup);

    // -------------------------------------------------------------
    // 8. SUPERSONIC SPEED TRAILS
    // -------------------------------------------------------------
    const trailMat = new THREE.MeshBasicMaterial({
      color: custom.accentColor,
      transparent: true,
      opacity: 0.85
    });
    [-1.0, 1.0].forEach((x) => {
      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 3.5), trailMat);
      trail.position.set(x, 0.15, 2.5);
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
