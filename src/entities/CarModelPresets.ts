import * as THREE from 'three';

export type CarChassisType = 'NFS_M3_GTR' | 'NFS_SKYLINE_R34' | 'NFS_HYPERCAR' | 'OCTANE' | 'DOMINUS' | 'FENNEC';
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
  primaryColor: 0xd6dde8, // Pure Metallic Silver
  accentColor: 0x0044cc,  // M3 GTR Royal Blue Livery
  decal: 'NFS_HERO_STRIPES',
  topper: 'NONE',
  underglowColor: 0x00d2ff,
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
   * Generates AAA-quality 3D Battle-Car models with sleek aerodynamic curves,
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
      metalness: 0.94,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.98
    });

    const accentMat = new THREE.MeshPhysicalMaterial({
      color: custom.accentColor,
      emissive: custom.accentColor,
      emissiveIntensity: 0.35,
      metalness: 0.90,
      roughness: 0.10,
      clearcoat: 1.0
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x12151c,
      metalness: 0.92,
      roughness: 0.28
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x080c14,
      metalness: 0.85,
      roughness: 0.45
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      metalness: 1.0,
      roughness: 0.03
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x040812,
      transmission: 0.92,
      opacity: 0.96,
      transparent: true,
      roughness: 0.02,
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
    if (custom.chassis === 'NFS_M3_GTR') {
      // -----------------------------------------------------------
      // NEED FOR SPEED: MOST WANTED (2005) - HERO BMW M3 GTR
      // -----------------------------------------------------------
      // Sleek low-drag aerodynamic profile
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.95, 0.14);
      bodyShape.lineTo(-1.85, 0.38); // Front splitter chin
      bodyShape.lineTo(-1.18, 0.48); // Long sculpted hood line
      bodyShape.lineTo(-0.38, 0.84); // Low-drag windshield rake
      bodyShape.lineTo(0.68, 0.84);  // Carbon roofline
      bodyShape.lineTo(1.48, 0.58);  // Fastback C-pillar
      bodyShape.lineTo(1.88, 0.54);  // Rear trunk lid with lip
      bodyShape.lineTo(1.94, 0.22);  // Rear diffuser tuck
      bodyShape.lineTo(1.48, 0.14);
      bodyShape.lineTo(-1.95, 0.14);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 4,
        depth: 1.96,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.12,
        bevelSegments: 6
      };

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.56, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      // Carbon Fiber Roof Panel
      const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.05, 1.28), carbonMat);
      roofPanel.position.set(0, 0.99, 0.15);
      parentGroup.add(roofPanel);

      // BMW Twin Kidney Grille with Chrome Surrounds
      [-0.24, 0.24].forEach((x) => {
        const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.12), darkTrimMat);
        kidney.position.set(x, 0.46, -1.98);
        parentGroup.add(kidney);

        const kidneyBorder = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.024, 8, 16), chromeMat);
        kidneyBorder.position.set(x, 0.46, -2.0);
        parentGroup.add(kidneyBorder);
      });

      // Quad BMW Angle-Eye Projector Headlights (Halo Rings)
      [-0.72, -0.48, 0.48, 0.72].forEach((x) => {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 16), headlightGlowMat);
        lamp.rotation.x = Math.PI / 2;
        lamp.position.set(x, 0.48, -1.96);
        parentGroup.add(lamp);

        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.018, 8, 16), new THREE.MeshBasicMaterial({ color: 0x00d2ff }));
        halo.position.set(x, 0.48, -1.98);
        parentGroup.add(halo);
      });

      // Dual Hood Heat-Extracting Louvers
      [-0.38, 0.38].forEach((x) => {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.65), darkTrimMat);
        louver.position.set(x, 0.81, -0.92);
        louver.rotation.x = -0.22;
        parentGroup.add(louver);
      });

      // Front Carbon Splitter with Dual Tie-Rods
      const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.07, 0.65), carbonMat);
      frontSplitter.position.set(0, 0.15, -1.98);
      parentGroup.add(frontSplitter);

      [-0.65, 0.65].forEach((x) => {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), chromeMat);
        strut.position.set(x, 0.29, -1.92);
        strut.rotation.x = -0.35;
        parentGroup.add(strut);
      });

      // Widebody Box Flared Fenders with Cooling Ducts
      [-1.02, 1.02].forEach((x, idx) => {
        // Front Fender Box Flare
        const frontFlare = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 1.1), paintMat);
        frontFlare.position.set(x, 0.48, -1.05);
        parentGroup.add(frontFlare);

        // Rear Fender Box Flare
        const rearFlare = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.50, 1.35), paintMat);
        rearFlare.position.set(x, 0.54, 1.05);
        parentGroup.add(rearFlare);

        // Carbon Side Skirt
        const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 1.8), carbonMat);
        sideSkirt.position.set(x, 0.16, 0.0);
        parentGroup.add(sideSkirt);

        // M3 GTR Side-Exit Dual Exhaust Tips
        const sideExhaust = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.38), darkTrimMat);
        sideExhaust.position.set(x + (idx === 0 ? -0.1 : 0.1), 0.22, 0.35);
        parentGroup.add(sideExhaust);

        [-0.08, 0.08].forEach((zOff) => {
          const sideTip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.18, 12), chromeMat);
          sideTip.rotation.z = Math.PI / 2;
          sideTip.position.set(x + (idx === 0 ? -0.14 : 0.14), 0.22, 0.35 + zOff);
          parentGroup.add(sideTip);
        });
      });

      // Tinted Cockpit Glass
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.44, 0.95), glassMat);
      windshield.position.set(0, 0.77, -0.28);
      windshield.rotation.x = -0.38;
      parentGroup.add(windshield);

      const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.40, 1.10), glassMat);
      rearWindow.position.set(0, 0.75, 0.85);
      rearWindow.rotation.x = 0.32;
      parentGroup.add(rearWindow);

      // Carbon Fiber GT Race Wing
      const gtWing = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.08, 0.55), carbonMat);
      gtWing.position.set(0, 1.34, 1.62);
      gtWing.rotation.x = 0.08;
      parentGroup.add(gtWing);

      [-1.18, 1.18].forEach((x) => {
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.58), accentMat);
        endplate.position.set(x, 1.34, 1.62);
        parentGroup.add(endplate);
      });

      [-0.65, 0.65].forEach((x) => {
        const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.18), chromeMat);
        stanchion.position.set(x, 1.08, 1.58);
        stanchion.rotation.x = -0.28;
        parentGroup.add(stanchion);
      });

      // Rear Diffuser
      const rearDiffuser = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 0.45), carbonMat);
      rearDiffuser.position.set(0, 0.2, 1.95);
      parentGroup.add(rearDiffuser);

    } else if (custom.chassis === 'NFS_SKYLINE_R34') {
      // -----------------------------------------------------------
      // NEED FOR SPEED: UNDERGROUND - NISSAN SKYLINE GT-R R34
      // -----------------------------------------------------------
      const bodyShape = new THREE.Shape();
      bodyShape.moveTo(-1.9, 0.14);
      bodyShape.lineTo(-1.8, 0.42);
      bodyShape.lineTo(-1.1, 0.52);
      bodyShape.lineTo(-0.35, 0.90);
      bodyShape.lineTo(0.75, 0.90);
      bodyShape.lineTo(1.55, 0.64);
      bodyShape.lineTo(1.88, 0.60);
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

      // Front-Mount Intercooler (FMIC)
      const intercooler = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.34, 0.12), chromeMat);
      intercooler.position.set(0, 0.32, -1.95);
      parentGroup.add(intercooler);

      // Quad Round Skyline Taillights
      [-0.65, 0.65].forEach((x) => {
        const outerLight = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 12, 24), taillightMat);
        outerLight.position.set(x, 0.56, 1.95);
        parentGroup.add(outerLight);

        const innerLight = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 12, 24), taillightMat);
        innerLight.position.set(x > 0 ? x - 0.26 : x + 0.26, 0.56, 1.95);
        parentGroup.add(innerLight);
      });

      // Carbon GT Wing
      const r34Wing = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.08, 0.52), carbonMat);
      r34Wing.position.set(0, 1.36, 1.58);
      parentGroup.add(r34Wing);

      [-0.75, 0.75].forEach((x) => {
        const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.16), carbonMat);
        stanchion.position.set(x, 1.12, 1.54);
        stanchion.rotation.x = -0.22;
        parentGroup.add(stanchion);
      });

      // Titanium Cannon Exhaust
      const cannonExhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 18), chromeMat);
      cannonExhaust.rotation.x = Math.PI / 2 + 0.15;
      cannonExhaust.rotation.y = -0.25;
      cannonExhaust.position.set(0.68, 0.22, 1.98);
      parentGroup.add(cannonExhaust);

    } else if (custom.chassis === 'DOMINUS') {
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

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { steps: 2, depth: 1.9, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 4 });
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.54, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

      const blower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.85), chromeMat);
      blower.position.set(0, 0.72, -0.92);
      parentGroup.add(blower);

    } else if (custom.chassis === 'FENNEC') {
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

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { steps: 2, depth: 1.95, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 4 });
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.62, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

    } else {
      // OCTANE
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

      const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { steps: 3, depth: 1.85, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 5 });
      bodyGeo.center();
      bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
      bodyMesh.rotation.y = Math.PI / 2;
      bodyMesh.position.set(0, 0.58, 0);
      bodyMesh.castShadow = true;
      parentGroup.add(bodyMesh);

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
    // 6. FORGED BBS-STYLE MULTI-SPOKE ALLOY WHEELS & BREMBO CALIPERS
    // =============================================================
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ed, metalness: 0.95, roughness: 0.12 });
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

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.46, 28), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      hub.add(tire);

      const rimBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.47, 24), darkTrimMat);
      rimBarrel.rotation.z = Math.PI / 2;
      hub.add(rimBarrel);

      for (let s = 0; s < 10; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.03), rimMat);
        const angle = (s / 10) * Math.PI * 2;
        spoke.position.set(idx % 2 === 0 ? -0.23 : 0.23, Math.sin(angle) * 0.16, Math.cos(angle) * 0.16);
        spoke.rotation.x = angle;
        hub.add(spoke);
      }

      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), chromeMat);
      hubCap.rotation.z = Math.PI / 2;
      hubCap.position.x = idx % 2 === 0 ? -0.24 : 0.24;
      hub.add(hubCap);

      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 20), rotorMat);
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = idx % 2 === 0 ? -0.12 : 0.12;
      hub.add(rotor);

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
