import * as THREE from 'three';

export type CarChassisType = 'NFS_M3_GTR' | 'NFS_SKYLINE_R34' | 'NFS_HYPERCAR' | 'OCTANE' | 'DOMINUS' | 'FENNEC' | 'CYBER_RACER';
export type CarTopperType = 'NONE' | 'CROWN' | 'HALO' | 'CYBER_VISOR' | 'WIZARD_HAT' | 'DEVIL_HORNS';
export type CarDecalType = 'NONE' | 'NFS_HERO_STRIPES' | 'STRIPES' | 'FLAMES' | 'CYBER_GRID' | 'CARBON';

export interface CarCustomization {
  chassis: CarChassisType;
  primaryColor: number;
  accentColor: number;
  decal: CarDecalType;
  topper: CarTopperType;
  underglowColor: number;
  boostColor: number;
}

// Default Player 1: Iconic Need for Speed Most Wanted BMW M3 GTR
export const DEFAULT_P1_CUSTOMIZATION: CarCustomization = {
  chassis: 'NFS_M3_GTR',
  primaryColor: 0xd4dbe4, // Pure Metallic Silver
  accentColor: 0x0044cc,  // M3 GTR Royal Blue Livery
  decal: 'NFS_HERO_STRIPES',
  topper: 'NONE',
  underglowColor: 0x00a2ff,
  boostColor: 0x00ffff
};

// Default Player 2 / Bot: Need for Speed Underground Skyline GT-R R34
export const DEFAULT_P2_CUSTOMIZATION: CarCustomization = {
  chassis: 'NFS_SKYLINE_R34',
  primaryColor: 0x0033aa, // Bayside Blue
  accentColor: 0xffffff,  // White/Silver Livery Stripes
  decal: 'STRIPES',
  topper: 'NONE',
  underglowColor: 0x0066ff,
  boostColor: 0xffaa00
};

export class CarChassisBuilder {
  /**
   * Generates AAA-quality 3D models with authentic Need for Speed designs,
   * including the iconic NFS Most Wanted BMW M3 GTR, NFS Underground Skyline GT-R R34,
   * realistic automotive clearcoat materials, GT wings, multi-spoke BBS/TE37 rims,
   * Brembo brake calipers, side-exit exhausts, and rocket booster thrusters.
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
      metalness: 0.92,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.98
    });

    const accentMat = new THREE.MeshPhysicalMaterial({
      color: custom.accentColor,
      emissive: custom.accentColor,
      emissiveIntensity: 0.45,
      metalness: 0.90,
      roughness: 0.12,
      clearcoat: 1.0
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x101318,
      metalness: 0.92,
      roughness: 0.30
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x080b12,
      metalness: 0.85,
      roughness: 0.45
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      metalness: 1.0,
      roughness: 0.04
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x040812,
      transmission: 0.90,
      opacity: 0.95,
      transparent: true,
      roughness: 0.02,
      metalness: 0.1,
      ior: 1.55
    });

    const headlightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });

    let bodyMesh: THREE.Mesh = new THREE.Mesh();
    const wheels: THREE.Mesh[] = [];
    const wheelHubs: THREE.Group[] = [];
    const supersonicTrails: THREE.Mesh[] = [];
    const thrusterGroup = new THREE.Group();
    const topperGroup = new THREE.Group();

    // =============================================================
    // 2. PROCEDURAL 3D CURVED BODYWORK BY CHASSIS TYPE
    // =============================================================
    if (custom.chassis === 'NFS_M3_GTR') {
      // -----------------------------------------------------------
      // NEED FOR SPEED: MOST WANTED (2005) - HERO BMW M3 GTR WIDEBODY
      // -----------------------------------------------------------
      // Sculpted Coupe Silhouette with flared hood and low roofline
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.95, 0.12);
      bodyShape.lineTo(-1.85, 0.36); // Front bumper lip
      bodyShape.lineTo(-1.15, 0.48); // Long muscular hood
      bodyShape.lineTo(-0.35, 0.86); // A-Pillar windshield rake
      bodyShape.lineTo(0.65, 0.86);  // Carbon roofline
      bodyShape.lineTo(1.45, 0.58);  // Fastback C-pillar
      bodyShape.lineTo(1.85, 0.54);  // Rear trunk deck
      bodyShape.lineTo(1.92, 0.22);  // Rear race diffuser cut
      bodyShape.lineTo(1.45, 0.12);
      bodyShape.lineTo(-1.95, 0.12);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 3,
        depth: 1.96,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.12,
        bevelSegments: 5
      };

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.56, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Carbon Fiber Roof Panel
      const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.05, 1.25), carbonMat);
      roofPanel.position.set(0, 1.01, 0.15);
      parentGroup.add(roofPanel);

      // Iconic BMW Twin Kidney Grille with Chrome Trim
      [-0.22, 0.22].forEach((x) => {
        const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.1), darkTrimMat);
        kidney.position.set(x, 0.46, -1.98);
        parentGroup.add(kidney);

        const kidneyBorder = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), chromeMat);
        kidneyBorder.position.set(x, 0.46, -1.99);
        parentGroup.add(kidneyBorder);
      });

      // Quad BMW Angle-Eye Halo Projector Headlights
      [-0.72, -0.48, 0.48, 0.72].forEach((x) => {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), headlightGlowMat);
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set(x, 0.48, -1.96);
        parentGroup.add(lamp);

        const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.02, 8, 16), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
        haloRing.position.set(x, 0.48, -1.98);
        parentGroup.add(haloRing);
      });

      // Distinctive Dual Hood Heat-Extracting Louvers
      [-0.35, 0.35].forEach((x) => {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.65), darkTrimMat);
        louver.position.set(x, 0.82, -0.92);
        louver.rotation.x = -0.22;
        parentGroup.add(louver);
      });

      // Front Carbon Splitter with Dual Aero Support Tie-Rods
      const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.07, 0.65), carbonMat);
      frontSplitter.position.set(0, 0.15, -1.98);
      parentGroup.add(frontSplitter);

      [-0.65, 0.65].forEach((x) => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), chromeMat);
        strut.position.set(x, 0.29, -1.92);
        strut.rotation.x = -0.35;
        parentGroup.add(strut);
      });

      // Boxy Widebody Flared GT Fenders with Brake Cooling Vents
      [-1.02, 1.02].forEach((x, idx) => {
        // Front Fender Box Flare
        const frontFlare = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.45, 1.1), paintMat);
        frontFlare.position.set(x, 0.48, -1.05);
        parentGroup.add(frontFlare);

        // Rear Fender Box Flare
        const rearFlare = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.52, 1.35), paintMat);
        rearFlare.position.set(x, 0.54, 1.05);
        parentGroup.add(rearFlare);

        // Side Skirt Extension
        const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 1.8), carbonMat);
        sideSkirt.position.set(x, 0.16, 0.0);
        parentGroup.add(sideSkirt);

        // SIGNATURE M3 GTR SIDE-EXIT DUAL EXHAUST PIPES UNDER SIDE SKIRTS!
        const sideExhaustHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.4), darkTrimMat);
        sideExhaustHousing.position.set(x + (idx === 0 ? -0.1 : 0.1), 0.22, 0.35);
        parentGroup.add(sideExhaustHousing);

        [-0.08, 0.08].forEach((zOff) => {
          const sideTip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 12), chromeMat);
          sideTip.rotation.z = Math.PI / 2;
          sideTip.position.set(x + (idx === 0 ? -0.14 : 0.14), 0.22, 0.35 + zOff);
          parentGroup.add(sideTip);
        });
      });

      // Cockpit Glass & Side Mirrors
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.46, 0.98), glassMat);
      windshield.position.set(0, 0.78, -0.28);
      windshield.rotation.x = -0.38;
      parentGroup.add(windshield);

      const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.42, 1.12), glassMat);
      rearWindow.position.set(0, 0.76, 0.85);
      rearWindow.rotation.x = 0.32;
      parentGroup.add(rearWindow);

      // Aero Carbon Side Mirrors
      [-0.98, 0.98].forEach((x, idx) => {
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.22), carbonMat);
        mirror.position.set(x, 0.82, -0.45);
        mirror.rotation.y = idx === 0 ? 0.2 : -0.2;
        parentGroup.add(mirror);
      });

      // Authentic High-Downforce Carbon Fiber GT Race Wing with Endplates
      const gtWing = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.08, 0.55), carbonMat);
      gtWing.position.set(0, 1.34, 1.62);
      gtWing.rotation.x = 0.08;
      parentGroup.add(gtWing);

      // Wing Endplates
      [-1.18, 1.18].forEach((x) => {
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.58), accentMat);
        endplate.position.set(x, 1.34, 1.62);
        parentGroup.add(endplate);
      });

      // Dual Aluminum Upright Stanchions
      [-0.65, 0.65].forEach((x) => {
        const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.18), chromeMat);
        stanchion.position.set(x, 1.08, 1.58);
        stanchion.rotation.x = -0.28;
        parentGroup.add(stanchion);
      });

      // Rear GT Race Diffuser with Vertical Aero Strakes
      const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 0.45), carbonMat);
      rearDiffuser.position.set(0, 0.2, 1.95);
      parentGroup.add(rearDiffuser);

      [-0.7, -0.25, 0.25, 0.7].forEach((x) => {
        const strake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.42), carbonMat);
        strake.position.set(x, 0.2, 1.96);
        parentGroup.add(strake);
      });

    } else if (custom.chassis === 'NFS_SKYLINE_R34') {
      // -----------------------------------------------------------
      // NEED FOR SPEED: UNDERGROUND - NISSAN SKYLINE GT-R R34
      // -----------------------------------------------------------
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.9, 0.14);
      bodyShape.lineTo(-1.8, 0.42);
      bodyShape.lineTo(-1.1, 0.52);
      bodyShape.lineTo(-0.35, 0.92);
      bodyShape.lineTo(0.75, 0.92);
      bodyShape.lineTo(1.55, 0.65);
      bodyShape.lineTo(1.88, 0.62);
      bodyShape.lineTo(1.92, 0.22);
      bodyShape.lineTo(1.4, 0.14);
      bodyShape.lineTo(-1.9, 0.14);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 3,
        depth: 1.94,
        bevelEnabled: true,
        bevelThickness: 0.14,
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

      // Large Front Bumper Mouth with Polished Aluminum Front-Mount Intercooler (FMIC)
      const intercooler = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.12), chromeMat);
      intercooler.position.set(0, 0.32, -1.95);
      parentGroup.add(intercooler);

      // Turbo Aluminum Charge Pipes
      [-0.65, 0.65].forEach((x) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12), chromeMat);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(x, 0.32, -1.92);
        parentGroup.add(pipe);
      });

      // Iconic Quad Round Skyline Taillights (Outer Large, Inner Medium)
      [-0.65, 0.65].forEach((x) => {
        // Outer large ring
        const outerLight = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 12, 24), taillightMat);
        outerLight.position.set(x, 0.56, 1.95);
        parentGroup.add(outerLight);

        // Inner ring
        const innerLight = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 12, 24), taillightMat);
        innerLight.position.set(x > 0 ? x - 0.26 : x + 0.26, 0.56, 1.95);
        parentGroup.add(innerLight);
      });

      // High-Rise Dual-Blade Carbon GT Wing
      const r34Wing = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.08, 0.52), carbonMat);
      r34Wing.position.set(0, 1.36, 1.58);
      parentGroup.add(r34Wing);

      [-0.75, 0.75].forEach((x) => {
        const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.16), carbonMat);
        stanchion.position.set(x, 1.12, 1.54);
        stanchion.rotation.x = -0.22;
        parentGroup.add(stanchion);
      });

      // Angled JDM High-Flow Titanium Cannon Exhaust with Burnt Blue Tip
      const cannonExhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 18), chromeMat);
      cannonExhaust.rotation.x = Math.PI / 2 + 0.15;
      cannonExhaust.rotation.y = -0.25;
      cannonExhaust.position.set(0.68, 0.22, 1.98);
      parentGroup.add(cannonExhaust);

      const burntTip = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 16), new THREE.MeshBasicMaterial({ color: 0x0088ff }));
      burntTip.rotation.x = Math.PI / 2 + 0.15;
      burntTip.position.set(0.68, 0.22, 2.22);
      parentGroup.add(burntTip);

    } else if (custom.chassis === 'DOMINUS') {
      // -----------------------------------------------------------
      // DOMINUS: LOW-SLUNG AMERICAN MUSCLE GT BATTLE-CAR
      // -----------------------------------------------------------
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.9, 0.12);
      bodyShape.lineTo(-1.8, 0.38);
      bodyShape.lineTo(-1.1, 0.46);
      bodyShape.lineTo(-0.25, 0.82);
      bodyShape.lineTo(0.75, 0.82);
      bodyShape.lineTo(1.65, 0.52);
      bodyShape.lineTo(1.85, 0.58);
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

      // Supercharger Blower
      const blower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.85), chromeMat);
      blower.position.set(0, 0.72, -0.92);
      parentGroup.add(blower);

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
      bodyMesh.position.set(0, 0.62, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

    } else {
      // -----------------------------------------------------------
      // OCTANE: THE ICONIC LEGENDARY BATTLE-CAR
      // -----------------------------------------------------------
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

      // High-Downforce GT Carbon Wing
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
    if (custom.decal === 'NFS_HERO_STRIPES') {
      // Signature NFS Most Wanted Dual Angled Blue Livery Vinyls
      [-0.45, 0.45].forEach((x, idx) => {
        const vinylHood = new THREE.Mesh(
          new THREE.PlaneGeometry(0.32, 1.6),
          new THREE.MeshBasicMaterial({ color: custom.accentColor, side: THREE.DoubleSide })
        );
        vinylHood.rotation.x = -Math.PI / 2 + 0.12;
        vinylHood.position.set(x, 0.88, -0.95);
        parentGroup.add(vinylHood);

        const vinylSide = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8, 0.22),
          new THREE.MeshBasicMaterial({ color: custom.accentColor, side: THREE.DoubleSide })
        );
        vinylSide.position.set(idx === 0 ? -1.02 : 1.02, 0.52, 0.15);
        vinylSide.rotation.y = idx === 0 ? -Math.PI / 2 : Math.PI / 2;
        vinylSide.rotation.z = idx === 0 ? 0.08 : -0.08;
        parentGroup.add(vinylSide);
      });
    } else if (custom.decal === 'STRIPES') {
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
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.14, 0.1), taillightMat);
    tailBar.position.set(0, 0.58, 1.88);
    parentGroup.add(tailBar);

    const underglowGeo = new THREE.PlaneGeometry(2.35, 3.6);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: custom.underglowColor,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.y = -0.12;
    parentGroup.add(underglowMesh);

    // =============================================================
    // 6. AUTHENTIC MULTI-SPOKE BBS / RACING ALLOY WHEELS & BREMBO CALIPERS
    // =============================================================
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, metalness: 0.95, roughness: 0.12 }); // BBS Silver/Gold
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.92, roughness: 0.18 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff0022, roughness: 0.25, metalness: 0.6 }); // Red Brembo

    const wheelPositions = [
      new THREE.Vector3(-1.14, 0.18, -1.05), // Front Left
      new THREE.Vector3(1.14, 0.18, -1.05),  // Front Right
      new THREE.Vector3(-1.14, 0.18, 1.08),  // Rear Left
      new THREE.Vector3(1.14, 0.18, 1.08)    // Rear Right
    ];

    wheelPositions.forEach((pos, idx) => {
      const hub = new THREE.Group();
      hub.position.copy(pos);

      // Low-Profile High-Performance Slick Tire
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.46, 28), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      hub.add(tire);

      // Deep-Dish Rim Barrel
      const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.47, 24), darkTrimMat);
      rimBarrel.rotation.z = Math.PI / 2;
      hub.add(rimBarrel);

      // BBS Multi-Spoke Mesh Racing Face (10 dual-spokes)
      for (let s = 0; s < 10; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.03), rimMat);
        const angle = (s / 10) * Math.PI * 2;
        spoke.position.set(idx % 2 === 0 ? -0.23 : 0.23, Math.sin(angle) * 0.16, Math.cos(angle) * 0.16);
        spoke.rotation.x = angle;
        hub.add(spoke);
      }

      // Center Chrome Hex Cap
      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), chromeMat);
      hubCap.rotation.z = Math.PI / 2;
      hubCap.position.x = idx % 2 === 0 ? -0.24 : 0.24;
      hub.add(hubCap);

      // Cross-Drilled Ventilated Brake Rotor
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 20), rotorMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = idx % 2 === 0 ? -0.12 : 0.12;
      hub.add(rotor);

      // Bright Red Brembo Racing Brake Caliper
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.14), caliperMat);
      caliper.position.set(idx % 2 === 0 ? -0.12 : 0.12, 0.22, 0);
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
