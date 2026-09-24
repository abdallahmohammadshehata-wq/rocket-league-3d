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
   * Generates AAA-quality 3D Battle-Car models with sleek aerodynamic curves,
   * realistic automotive clearcoat materials, roll cages, superchargers,
   * deep-dish alloy wheels, brake calipers, and jet thruster afterburners.
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
    // Clear previous children
    while (parentGroup.children.length > 0) {
      parentGroup.remove(parentGroup.children[0]);
    }

    // =============================================================
    // 1. AUTOMOTIVE PBR MATERIALS (Metallic Clearcoat & Carbon Fiber)
    // =============================================================
    const paintMat = new THREE.MeshPhysicalMaterial({
      color: custom.primaryColor,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95
    });

    const accentMat = new THREE.MeshPhysicalMaterial({
      color: custom.accentColor,
      emissive: custom.accentColor,
      emissiveIntensity: 0.65,
      metalness: 0.92,
      roughness: 0.12,
      clearcoat: 1.0
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x0f131a,
      metalness: 0.95,
      roughness: 0.32
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x070a10,
      metalness: 0.85,
      roughness: 0.45
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xefefef,
      metalness: 1.0,
      roughness: 0.04
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x040812,
      transmission: 0.88,
      opacity: 0.95,
      transparent: true,
      roughness: 0.03,
      metalness: 0.1,
      ior: 1.55
    });

    const headlightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    let bodyMesh: THREE.Mesh = new THREE.Mesh();
    const wheels: THREE.Mesh[] = [];
    const wheelHubs: THREE.Group[] = [];
    const supersonicTrails: THREE.Mesh[] = [];
    const thrusterGroup = new THREE.Group();
    const topperGroup = new THREE.Group();

    // =============================================================
    // 2. PROCEDURAL 3D CURVED BODYWORK BY CHASSIS TYPE
    // =============================================================
    if (custom.chassis === 'DOMINUS') {
      // -----------------------------------------------------------
      // DOMINUS: LOW-SLUNG AMERICAN MUSCLE GT BATTLE-CAR
      // -----------------------------------------------------------
      // Aerodynamic Extruded Body Profile (Side Silhouette)
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.9, 0.12);
      bodyShape.lineTo(-1.8, 0.38);
      bodyShape.lineTo(-1.1, 0.46);
      bodyShape.lineTo(-0.25, 0.82);
      bodyShape.lineTo(0.75, 0.82);
      bodyShape.lineTo(1.65, 0.52);
      bodyShape.lineTo(1.85, 0.58); // Ducktail lip
      bodyShape.lineTo(1.9, 0.22);
      bodyShape.lineTo(1.4, 0.12);
      bodyShape.lineTo(-1.9, 0.12);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 2,
        depth: 1.9,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.1,
        bevelSegments: 4
      };

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.54, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Carbon Front Chin Splitter & Struts
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 0.6), carbonMat);
      splitter.position.set(0, 0.15, -1.95);
      parentGroup.add(splitter);

      [-0.65, 0.65].forEach((x) => {
        const tieRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), chromeMat);
        tieRod.position.set(x, 0.28, -1.88);
        tieRod.rotation.x = -0.32;
        parentGroup.add(tieRod);
      });

      // Front Honeycomb Grille with Quad Projector LEDs
      const grille = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.24, 0.1), darkTrimMat);
      grille.position.set(0, 0.42, -1.96);
      parentGroup.add(grille);

      [-0.68, -0.42, 0.42, 0.68].forEach((x) => {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), headlightGlowMat);
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set(x, 0.42, -1.98);
        parentGroup.add(lamp);
      });

      // Massive Chrome V8 Supercharger Blower with Triple Red Butterfly Valves
      const blower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.85), chromeMat);
      blower.position.set(0, 0.72, -0.92);
      parentGroup.add(blower);

      const blowerScoop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.48, 16), accentMat);
      blowerScoop.rotation.x = Math.PI / 2;
      blowerScoop.position.set(0, 0.88, -1.12);
      parentGroup.add(blowerScoop);

      for (let i = -1; i <= 1; i++) {
        const valve = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0xff2200, side: THREE.DoubleSide }));
        valve.position.set(i * 0.13, 0.88, -1.37);
        parentGroup.add(valve);
      }

      // Tinted Fastback Windshield & Rear Window
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.42, 0.95), glassMat);
      windshield.position.set(0, 0.76, -0.22);
      windshield.rotation.x = -0.35;
      parentGroup.add(windshield);

      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.35, 1.15), glassMat);
      rearGlass.position.set(0, 0.72, 0.88);
      rearGlass.rotation.x = 0.26;
      parentGroup.add(rearGlass);

      // Flared Widebody Fenders with Heat Strakes
      [-0.96, 0.96].forEach((x, idx) => {
        const flare = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 1.5), paintMat);
        flare.position.set(x, 0.52, 0.95);
        parentGroup.add(flare);

        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.35), carbonMat);
        intake.position.set(x + (idx === 0 ? -0.12 : 0.12), 0.54, 0.22);
        parentGroup.add(intake);
      });

      // Quad Titanium Exhaust Tips in Rear Carbon Diffuser
      const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.2, 0.4), carbonMat);
      diffuser.position.set(0, 0.2, 1.88);
      parentGroup.add(diffuser);

      [-0.68, -0.48, 0.48, 0.68].forEach((x) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 16), chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(x, 0.26, 1.98);
        parentGroup.add(pipe);
      });

    } else if (custom.chassis === 'FENNEC') {
      // -----------------------------------------------------------
      // FENNEC: RALLY TOURING WIDEBODY HATCHBACK
      // -----------------------------------------------------------
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.7, 0.15);
      bodyShape.lineTo(-1.6, 0.45);
      bodyShape.lineTo(-1.0, 0.58);
      bodyShape.lineTo(-0.4, 1.05);
      bodyShape.lineTo(1.2, 1.05);
      bodyShape.lineTo(1.65, 0.85);
      bodyShape.lineTo(1.75, 0.32);
      bodyShape.lineTo(1.4, 0.15);
      bodyShape.lineTo(-1.7, 0.15);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 2,
        depth: 1.95,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.12,
        bevelSegments: 4
      };

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.65, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Roof-Mounted Ram Air Scoop
      const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 0.7), carbonMat);
      roofScoop.position.set(0, 1.34, 0.12);
      parentGroup.add(roofScoop);

      // Rally Front Bumper Air Dam & Dual High-Beam Yellow Fog Pods
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 0.5), carbonMat);
      bumper.position.set(0, 0.32, -1.75);
      parentGroup.add(bumper);

      [-0.42, 0.42].forEach((x) => {
        const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xffea00 }));
        fog.rotation.x = Math.PI / 2;
        fog.position.set(x, 0.38, -1.98);
        parentGroup.add(fog);
      });

      // Panoramic Wrap-Around Windows
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.6, 0.9), glassMat);
      windshield.position.set(0, 0.96, -0.42);
      windshield.rotation.x = -0.25;
      parentGroup.add(windshield);

      // Dual-Plane High-Mounted Rally Wing with Aerodynamic Endplates
      const wingTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.09, 0.58), accentMat);
      wingTop.position.set(0, 1.35, 1.45);
      parentGroup.add(wingTop);

      [-0.88, 0.88].forEach((x) => {
        const wingEnd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.62), carbonMat);
        wingEnd.position.set(x, 1.32, 1.45);
        parentGroup.add(wingEnd);
      });

    } else if (custom.chassis === 'CYBER_RACER') {
      // -----------------------------------------------------------
      // CYBER RACER: HYPERSONIC STEALTH JET HYPERCAR
      // -----------------------------------------------------------
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.95, 0.12);
      bodyShape.lineTo(-1.2, 0.38);
      bodyShape.lineTo(-0.1, 0.72);
      bodyShape.lineTo(0.9, 0.72);
      bodyShape.lineTo(1.85, 0.35);
      bodyShape.lineTo(1.6, 0.12);
      bodyShape.lineTo(-1.95, 0.12);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 2,
        depth: 2.1,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.14,
        bevelSegments: 5
      };

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.5, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Jet Fighter Bubble Canopy
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 24), glassMat);
      canopy.scale.set(1.18, 0.65, 2.3);
      canopy.position.set(0, 0.72, -0.18);
      parentGroup.add(canopy);

      // Side Air Pods with Glowing Neon Energy Inlays
      [-0.92, 0.92].forEach((x) => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.45, 3.0), paintMat);
        pod.position.set(x, 0.46, 0.15);
        parentGroup.add(pod);

        const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 2.8), accentMat);
        neonStrip.position.set(x + (x > 0 ? 0.24 : -0.24), 0.58, 0.15);
        parentGroup.add(neonStrip);
      });

      // Twin Angled Vertical Stabilizer Fins with Neon Trim
      [-0.98, 0.98].forEach((x, idx) => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 1.05), accentMat);
        fin.position.set(x, 0.92, 1.48);
        fin.rotation.z = idx === 0 ? 0.32 : -0.32;
        parentGroup.add(fin);
      });

    } else {
      // -----------------------------------------------------------
      // OCTANE: THE ICONIC LEGENDARY BATTLE-CAR
      // -----------------------------------------------------------
      // Aerodynamic Curved Buggy Monocoque
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.75, 0.18);
      bodyShape.lineTo(-1.6, 0.42);
      bodyShape.lineTo(-0.85, 0.52);
      bodyShape.lineTo(-0.25, 0.88);
      bodyShape.lineTo(0.65, 0.88);
      bodyShape.lineTo(1.45, 0.62);
      bodyShape.lineTo(1.7, 0.32);
      bodyShape.lineTo(1.3, 0.18);
      bodyShape.lineTo(-1.75, 0.18);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 3,
        depth: 1.85,
        bevelEnabled: true,
        bevelThickness: 0.15,
        bevelSize: 0.12,
        bevelSegments: 5
      };

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.58, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Steel Exo-Rollcage Tubes (Full 3D Structural Cage)
      const cageMat = new THREE.MeshStandardMaterial({ color: 0x181e2b, metalness: 0.95, roughness: 0.18 });
      const barGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.0, 14);

      [-0.78, 0.78].forEach((x) => {
        // Roof rail
        const barSide = new THREE.Mesh(barGeo, cageMat);
        barSide.position.set(x, 1.05, 0.15);
        barSide.rotation.x = Math.PI / 2;
        parentGroup.add(barSide);

        // A-Pillar
        const barPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 14), cageMat);
        barPillar.position.set(x, 0.82, -0.68);
        barPillar.rotation.x = -0.42;
        parentGroup.add(barPillar);

        // B/C-Pillar
        const barRear = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.82, 14), cageMat);
        barRear.position.set(x, 0.82, 0.98);
        barRear.rotation.x = 0.48;
        parentGroup.add(barRear);
      });

      // Roof Cross-Brace
      [-0.55, 0.65].forEach((z) => {
        const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.56, 12), cageMat);
        cross.rotation.z = Math.PI / 2;
        cross.position.set(0, 1.1, z);
        parentGroup.add(cross);
      });

      // Tinted Cockpit Canopy
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.52, 1.15), glassMat);
      windshield.position.set(0, 0.9, -0.28);
      windshield.rotation.x = -0.38;
      parentGroup.add(windshield);

      // Exposed Twin-Turbo V8 Engine with Chrome Manifolds & Air Filters
      const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.9), chromeMat);
      engineBlock.position.set(0, 0.64, 1.1);
      parentGroup.add(engineBlock);

      [-0.32, 0.32].forEach((x) => {
        const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.65, 14), accentMat);
        manifold.rotation.x = Math.PI / 2;
        manifold.position.set(x, 0.84, 1.1);
        parentGroup.add(manifold);
      });

      // Heavy Bullbar Front Bumper with Halo Projector Headlights
      const bullbar = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.35, 0.48), carbonMat);
      bullbar.position.set(0, 0.32, -1.75);
      parentGroup.add(bullbar);

      [-0.75, 0.75].forEach((x) => {
        const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 18), headlightGlowMat);
        headlight.rotation.x = Math.PI / 2;
        headlight.position.set(x, 0.48, -1.95);
        parentGroup.add(headlight);

        const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20), accentMat);
        haloRing.position.set(x, 0.48, -1.96);
        parentGroup.add(haloRing);
      });

      // High-Downforce GT Carbon Wing on Angled Stanchions
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.52), accentMat);
      spoiler.position.set(0, 1.32, 1.48);
      parentGroup.add(spoiler);

      [-0.75, 0.75].forEach((x) => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.15), carbonMat);
        strut.position.set(x, 1.08, 1.45);
        strut.rotation.x = -0.22;
        parentGroup.add(strut);
      });
    }

    // =============================================================
    // 3. RACING DECALS & LIVERY OVERLAYS
    // =============================================================
    if (custom.decal === 'STRIPES') {
      [-0.28, 0.28].forEach((x) => {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18, 2.9),
          new THREE.MeshBasicMaterial({ color: custom.accentColor, side: THREE.DoubleSide })
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 1.15, -0.15);
        parentGroup.add(stripe);
      });
    } else if (custom.decal === 'FLAMES') {
      const flame = new THREE.Mesh(
        new THREE.PlaneGeometry(1.35, 2.0),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(0, 0.95, -0.45);
      parentGroup.add(flame);
    } else if (custom.decal === 'CYBER_GRID') {
      const gridDecal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.55, 2.5),
        new THREE.MeshBasicMaterial({ color: custom.accentColor, wireframe: true, side: THREE.DoubleSide })
      );
      gridDecal.rotation.x = -Math.PI / 2;
      gridDecal.position.set(0, 1.16, 0.1);
      parentGroup.add(gridDecal);
    }

    // =============================================================
    // 4. TOPPER ACCESSORIES
    // =============================================================
    topperGroup.position.set(0, 1.28, 0.2);
    if (custom.topper === 'HALO') {
      const haloGeo = new THREE.TorusGeometry(0.5, 0.07, 16, 32);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.42;
      topperGroup.add(halo);
    } else if (custom.topper === 'CROWN') {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15 });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.34, 18), crownMat);
      topperGroup.add(crownBase);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 8), crownMat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.4, 0.3, Math.sin(angle) * 0.4);
        topperGroup.add(spike);
      }
    } else if (custom.topper === 'CYBER_VISOR') {
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.18, 0.38), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
      visor.position.set(0, 0.18, -0.45);
      topperGroup.add(visor);
    } else if (custom.topper === 'DEVIL_HORNS') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xff0033, roughness: 0.2 });
      [-0.4, 0.4].forEach((x) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.58, 14), hornMat);
        horn.position.set(x, 0.42, 0);
        horn.rotation.z = x > 0 ? -0.32 : 0.32;
        horn.rotation.x = 0.22;
        topperGroup.add(horn);
      });
    } else if (custom.topper === 'WIZARD_HAT') {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x4b0082, roughness: 0.7 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 22), hatMat);
      topperGroup.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.98, 18), hatMat);
      cone.position.y = 0.5;
      cone.rotation.z = -0.15;
      topperGroup.add(cone);
    }
    parentGroup.add(topperGroup);

    // =============================================================
    // 5. NEON LED TAILLIGHT BAR & UNDERGLOW
    // =============================================================
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.15, 0.1), taillightMat);
    tailBar.position.set(0, 0.58, 1.78);
    parentGroup.add(tailBar);

    const underglowGeo = new THREE.PlaneGeometry(2.35, 3.6);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: custom.underglowColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.y = -0.12;
    parentGroup.add(underglowMesh);

    // =============================================================
    // 6. HIGH-DETAIL 3D RACING WHEELS, RIMS & BRAKE CALIPERS
    // =============================================================
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: custom.accentColor, metalness: 0.95, roughness: 0.12 });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.92, roughness: 0.18 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff0022, roughness: 0.25, metalness: 0.6 });

    const wheelPositions = [
      new THREE.Vector3(-1.14, 0.18, -1.05), // Front Left
      new THREE.Vector3(1.14, 0.18, -1.05),  // Front Right
      new THREE.Vector3(-1.14, 0.18, 1.08),  // Rear Left
      new THREE.Vector3(1.14, 0.18, 1.08)    // Rear Right
    ];

    wheelPositions.forEach((pos, idx) => {
      const hub = new THREE.Group();
      hub.position.copy(pos);

      // Treaded Performance Rubber Tire
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.46, 28), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      hub.add(tire);

      // Deep-Dish Rim Barrel
      const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.47, 24), darkTrimMat);
      rimBarrel.rotation.z = Math.PI / 2;
      hub.add(rimBarrel);

      // 5-Spoke Star Rim Face
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.33, 0.04), rimMat);
        const angle = (s / 5) * Math.PI * 2;
        spoke.position.set(idx % 2 === 0 ? -0.23 : 0.23, Math.sin(angle) * 0.16, Math.cos(angle) * 0.16);
        spoke.rotation.x = angle;
        hub.add(spoke);
      }

      // Center Chrome Hex Cap
      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6), chromeMat);
      hubCap.rotation.z = Math.PI / 2;
      hubCap.position.x = idx % 2 === 0 ? -0.24 : 0.24;
      hub.add(hubCap);

      // Ventilated Brake Rotor
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), rotorMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = idx % 2 === 0 ? -0.12 : 0.12;
      hub.add(rotor);

      // Red Racing Brake Caliper
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.14), caliperMat);
      caliper.position.set(idx % 2 === 0 ? -0.12 : 0.12, 0.2, 0);
      hub.add(caliper);

      parentGroup.add(hub);
      wheelHubs.push(hub);
      wheels.push(tire);
    });

    // =============================================================
    // 7. JET THRUSTER NOZZLES & AFTERBURNER FLAMES
    // =============================================================
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e28, metalness: 0.95, roughness: 0.18 });

    [-0.38, 0.38].forEach((x) => {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.55, 20), nozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, 0.44, 1.76);
      parentGroup.add(nozzle);

      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 16), accentMat);
      innerRing.position.set(x, 0.44, 2.0);
      parentGroup.add(innerRing);
    });

    const flameMat = new THREE.MeshBasicMaterial({ color: custom.boostColor, transparent: true, opacity: 0.92 });
    const flameCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98 });

    [-0.38, 0.38].forEach((x) => {
      const flameGroup = new THREE.Group();
      flameGroup.position.set(x, 0.44, 2.02);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.1, 16), flameMat);
      outerFlame.rotation.x = -Math.PI / 2;
      outerFlame.position.z = 1.05;
      flameGroup.add(outerFlame);

      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.25, 16), flameCoreMat);
      innerFlame.rotation.x = -Math.PI / 2;
      innerFlame.position.z = 0.62;
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
      trail.position.set(x, 0.18, 2.6);
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
