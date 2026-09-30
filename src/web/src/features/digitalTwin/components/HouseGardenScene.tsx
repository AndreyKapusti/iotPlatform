import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Billboard,
  OrbitControls,
  Sparkles,
  useProgress,
  useGLTF,
  Html,
} from '@react-three/drei';
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, CircularProgress } from '@mui/material';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Group, InstancedMesh, Mesh, Object3D } from 'three';
import type { TwinVisualState } from '../lib/mapTwinState';

interface HouseGardenSceneProps {
  state: TwinVisualState;
  className?: string;
}

const MODEL_BASE = '/models/homely-house';
/** Tiny Treats Homely House (CC0) — hero GLTF under /models/homely-house. */
const HOUSE_URL = `${MODEL_BASE}/house.gltf`;

const GARDEN_URLS = {
  floor: `${MODEL_BASE}/floor_base.gltf`,
  tree: `${MODEL_BASE}/tree.gltf`,
  treeLarge: `${MODEL_BASE}/tree_large.gltf`,
  foliageA: `${MODEL_BASE}/foliage_A.gltf`,
  foliageB: `${MODEL_BASE}/foliage_B.gltf`,
  cobble: `${MODEL_BASE}/cobblestones.gltf`,
  fenceLong: `${MODEL_BASE}/fence_straight_long.gltf`,
  fenceCorner: `${MODEL_BASE}/fence_corner.gltf`,
  fenceStraight: `${MODEL_BASE}/fence_straight.gltf`,
  fencePost: `${MODEL_BASE}/fence_post.gltf`,
  gate: `${MODEL_BASE}/gate_single.gltf`,
  doormat: `${MODEL_BASE}/doormat.gltf`,
  mailbox: `${MODEL_BASE}/mailbox.gltf`,
  bench: `${MODEL_BASE}/bench_A.gltf`,
} as const;

/**
 * house.gltf hierarchy (Tiny Treats Homely House):
 *   Scene → house (body mesh)
 *            ├─ house_chimney
 *            ├─ house_door   ← only this node may rotate for the hinge
 *            └─ house_heart
 * Garden props are separate GLTFs and must never be parented under house_door.
 */

type TwinPart = 'door' | 'chimney' | 'heart' | 'roof' | 'window' | 'glass' | 'body';

/**
 * Explicit window light planes — house body atlas has no separate glass meshes.
 * Positions are in house-local units (parent HomelyHouse applies scale).
 *
 * Mesh layout (house.gltf): door opening ≈ x[-0.81,0.81] at z≈2.6;
 * front window frames ≈ x±[1.30,1.70], y≈[0.85,2.35], z≈2.67;
 * side walls at |x|≈2.95 with openings near z≈0 and z≈±1.0.
 * Do NOT place panes on the door or centered over the heart.
 */
const WINDOW_PANES: {
  pos: [number, number, number];
  rot: [number, number, number];
  size: [number, number];
}[] = [
  // Front facade — narrow panes inside left/right window frames (clear of door)
  { pos: [-1.50, 1.60, 2.66], rot: [0, 0, 0], size: [0.34, 1.28] },
  { pos: [1.50, 1.60, 2.66], rot: [0, 0, 0], size: [0.34, 1.28] },
  // Side wall openings (outward-facing)
  { pos: [-2.84, 1.80, 0.05], rot: [0, Math.PI / 2, 0], size: [0.78, 1.15] },
  { pos: [2.84, 1.80, 0.05], rot: [0, -Math.PI / 2, 0], size: [0.78, 1.15] },
  { pos: [-2.84, 1.55, -1.0], rot: [0, Math.PI / 2, 0], size: [0.62, 0.95] },
  { pos: [2.84, 1.55, -1.0], rot: [0, -Math.PI / 2, 0], size: [0.62, 0.95] },
];

function classifyMesh(obj: Object3D): TwinPart {
  const n = (obj.name || '').toLowerCase();
  if (n.includes('door')) return 'door';
  if (n.includes('chimney')) return 'chimney';
  if (n.includes('roof')) return 'roof';
  if (n.includes('heart')) return 'heart';
  if (n.includes('window') || n.includes('glass') || n.includes('pane')) return 'window';
  if (n.includes('house')) return 'body';
  return 'body';
}

function prepareMaterial(mat: THREE.Material): THREE.Material {
  const m = mat as THREE.MeshStandardMaterial;
  if (m.map) {
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.map.anisotropy = 4;
    m.map.needsUpdate = true;
  }
  m.roughness = Math.min(0.92, (m.roughness ?? 0.5) + 0.08);
  m.metalness = Math.min(0.12, m.metalness ?? 0);
  m.envMapIntensity = 0.55;
  if (!m.emissive) m.emissive = new THREE.Color('#000000');
  m.emissiveIntensity = 0;
  return m;
}

function cloneProp(scene: Object3D): Group {
  const cloned = cloneSkeleton(scene) as Group;
  cloned.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => prepareMaterial(m.clone()));
    } else if (mesh.material) {
      mesh.material = prepareMaterial(mesh.material.clone());
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return cloned;
}

function GardenProp({
  url,
  position,
  rotation,
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => cloneProp(scene), [scene]);
  return <primitive object={root} position={position} rotation={rotation} scale={scale} />;
}

/** Static front gate leaf + posts — does NOT swing with house_door (that looked like wooden junk). */
function FrontGate() {
  return (
    <group name="FrontGate" position={[0, 0, 4.05]}>
      <GardenProp url={GARDEN_URLS.fencePost} position={[-1.15, 0, 0]} />
      <GardenProp url={GARDEN_URLS.gate} position={[-0.15, 0, 0]} />
      <GardenProp url={GARDEN_URLS.fencePost} position={[0.95, 0, 0]} />
    </group>
  );
}

/** Mailbox flag flips up on presence / open door. */
function AnimatedMailbox({ flagUp }: { flagUp: boolean }) {
  const { scene } = useGLTF(GARDEN_URLS.mailbox);
  const root = useMemo(() => cloneProp(scene), [scene]);
  const flagRef = useRef<Object3D | null>(null);
  const target = useRef(0);

  useLayoutEffect(() => {
    flagRef.current = null;
    root.traverse((obj) => {
      if (/flag/i.test(obj.name) && !flagRef.current) flagRef.current = obj;
    });
  }, [root]);

  useFrame((_, dt) => {
    target.current = flagUp ? 1 : 0;
    const flag = flagRef.current;
    if (!flag) return;
    const z = THREE.MathUtils.damp(flag.rotation.z, target.current * (-Math.PI * 0.55), 6, dt);
    flag.rotation.z = z;
  });

  return (
    <primitive object={root} position={[2.35, 0, 3.55]} rotation={[0, -0.35, 0]} />
  );
}

/**
 * Homely House yard — trees, fence, path from the same Tiny Treats set.
 * Placed in house-local units (parent applies Homely scale).
 * Kept as a sibling of the house GLTF — never under house_door.
 */
function HomelyGarden({
  mailboxFlag,
  valveOpen,
}: {
  mailboxFlag: boolean;
  valveOpen: boolean;
}) {
  return (
    <group name="HomelyGarden">
      <GardenProp url={GARDEN_URLS.floor} position={[0, 0.02, 0.6]} />

      <GardenProp url={GARDEN_URLS.treeLarge} position={[-4.1, 0, -2.4]} rotation={[0, 0.4, 0]} />
      <GardenProp url={GARDEN_URLS.tree} position={[4.0, 0, -2.1]} rotation={[0, -0.55, 0]} />
      <GardenProp url={GARDEN_URLS.tree} position={[-3.6, 0, 3.1]} rotation={[0, 1.1, 0]} scale={0.92} />

      <GardenProp url={GARDEN_URLS.foliageA} position={[-2.4, 0, 3.6]} rotation={[0, 0.3, 0]} />
      <GardenProp url={GARDEN_URLS.foliageB} position={[2.6, 0, 3.5]} rotation={[0, -0.8, 0]} />
      <GardenProp url={GARDEN_URLS.foliageA} position={[3.8, 0, 0.4]} rotation={[0, 1.4, 0]} />
      <GardenProp url={GARDEN_URLS.foliageB} position={[-4.0, 0, 0.2]} rotation={[0, 0.2, 0]} />
      <GardenProp url={GARDEN_URLS.foliageA} position={[-1.2, 0, -3.2]} />
      <GardenProp url={GARDEN_URLS.foliageB} position={[1.5, 0, -3.3]} rotation={[0, 2.1, 0]} />

      {/* Cobble path toward the front door */}
      <GardenProp url={GARDEN_URLS.cobble} position={[0.15, 0.01, 4.15]} rotation={[0, 0.08, 0]} />
      <GardenProp url={GARDEN_URLS.cobble} position={[-0.05, 0.01, 3.35]} rotation={[0, -0.12, 0]} />
      <GardenProp url={GARDEN_URLS.cobble} position={[0.2, 0.01, 2.55]} rotation={[0, 0.18, 0]} />

      <GardenProp url={GARDEN_URLS.doormat} position={[0.05, 0.02, 2.35]} />
      <AnimatedMailbox flagUp={mailboxFlag} />
      <GardenProp url={GARDEN_URLS.bench} position={[-3.2, 0, -0.6]} rotation={[0, Math.PI / 2 + 0.15, 0]} />

      {/* Back fence */}
      <GardenProp url={GARDEN_URLS.fenceCorner} position={[-4.7, 0, -3.6]} rotation={[0, Math.PI / 2, 0]} />
      <GardenProp url={GARDEN_URLS.fenceLong} position={[-2.2, 0, -3.85]} />
      <GardenProp url={GARDEN_URLS.fenceLong} position={[0.35, 0, -3.85]} />
      <GardenProp url={GARDEN_URLS.fenceLong} position={[2.9, 0, -3.85]} />
      <GardenProp url={GARDEN_URLS.fenceCorner} position={[4.7, 0, -3.6]} />

      {/* Side fences */}
      <GardenProp url={GARDEN_URLS.fenceLong} position={[-4.95, 0, -1.4]} rotation={[0, Math.PI / 2, 0]} />
      <GardenProp url={GARDEN_URLS.fenceLong} position={[-4.95, 0, 1.15]} rotation={[0, Math.PI / 2, 0]} />
      <GardenProp url={GARDEN_URLS.fenceStraight} position={[-4.95, 0, 3.0]} rotation={[0, Math.PI / 2, 0]} />
      <GardenProp url={GARDEN_URLS.fenceLong} position={[4.95, 0, -1.4]} rotation={[0, -Math.PI / 2, 0]} />
      <GardenProp url={GARDEN_URLS.fenceLong} position={[4.95, 0, 1.15]} rotation={[0, -Math.PI / 2, 0]} />
      <GardenProp url={GARDEN_URLS.fenceStraight} position={[4.95, 0, 3.0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Front fence — static gate (posts + leaf); only house_door swings */}
      <GardenProp url={GARDEN_URLS.fenceStraight} position={[-3.6, 0, 4.0]} />
      <FrontGate />
      <GardenProp url={GARDEN_URLS.fenceStraight} position={[2.85, 0, 4.0]} />

      {valveOpen && <IrrigationSpray />}
    </group>
  );
}

/**
 * Warm emissive panes in real window openings — intensity tracks lightNorm
 * (light sensor). Door opening is intentionally left dark.
 */
function WindowLightPlanes({ lightsOn, lightNorm }: { lightsOn: boolean; lightNorm: number }) {
  const matsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const bloomRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const lightsRef = useRef<(THREE.PointLight | null)[]>([]);

  useFrame(({ clock }) => {
    // lightNorm 0→1 is the primary driver; lightsOn boosts the ceiling.
    const base = lightsOn ? Math.max(0.55, lightNorm) : lightNorm;
    const flicker = 0.92 + 0.08 * Math.sin(clock.elapsedTime * 5.1);
    const intensity = base * flicker;
    const show = intensity > 0.04;

    for (const mat of matsRef.current) {
      if (!mat) continue;
      mat.emissiveIntensity = intensity * (1.6 + lightNorm * 1.4);
      mat.opacity = show ? 0.4 + intensity * 0.55 : 0;
      mat.emissive.setRGB(1.0, 0.76 + intensity * 0.14, 0.32);
      mat.visible = show;
    }
    for (const bloom of bloomRef.current) {
      if (!bloom) continue;
      bloom.opacity = show ? 0.08 + intensity * 0.28 : 0;
      bloom.visible = show;
    }
    for (const pl of lightsRef.current) {
      if (!pl) continue;
      pl.intensity = intensity * (0.85 + lightNorm * 1.1);
      pl.visible = intensity > 0.06;
    }
  });

  return (
    <group name="Window_Light_Planes">
      {WINDOW_PANES.map((pane, i) => (
        <group key={i} position={pane.pos} rotation={pane.rot}>
          <mesh>
            <planeGeometry args={[pane.size[0], pane.size[1]]} />
            <meshStandardMaterial
              ref={(m) => {
                if (m) matsRef.current[i] = m;
              }}
              color="#1a1520"
              emissive="#ffd089"
              emissiveIntensity={0}
              transparent
              opacity={0.4}
              roughness={0.35}
              metalness={0.05}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Soft bloom spill — keep tight so it stays in the opening */}
          <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[pane.size[0] * 1.06, pane.size[1] * 1.06]} />
            <meshBasicMaterial
              ref={(m) => {
                if (m) bloomRef.current[i] = m;
              }}
              color="#ffcc7a"
              transparent
              opacity={0}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <pointLight
            ref={(l) => {
              lightsRef.current[i] = l;
            }}
            color="#ffd9a0"
            intensity={0}
            distance={2.8}
            decay={2}
            position={[0, 0, 0.28]}
          />
        </group>
      ))}
    </group>
  );
}

/** Simple thermometer stick beside the chimney — mercury rises with heatNorm. */
function ThermometerProp({ heatNorm, temperature }: { heatNorm: number; temperature: number | null }) {
  if (temperature == null) return null;
  const fill = 0.15 + heatNorm * 0.75;
  return (
    <group name="Thermometer" position={[2.55, 1.35, 1.15]} rotation={[0, -0.4, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.15, 10]} />
        <meshStandardMaterial color="#e8eef4" roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.55 + fill * 0.5, 0.01]} scale={[0.55, fill, 0.55]}>
        <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
        <meshStandardMaterial
          color={heatNorm > 0.75 ? '#ef4444' : heatNorm > 0.45 ? '#f97316' : '#38bdf8'}
          emissive={heatNorm > 0.55 ? '#f97316' : '#0ea5e9'}
          emissiveIntensity={0.35 + heatNorm * 0.7}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, -0.62, 0]} castShadow>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          color={heatNorm > 0.75 ? '#ef4444' : '#38bdf8'}
          emissive={heatNorm > 0.55 ? '#fb923c' : '#38bdf8'}
          emissiveIntensity={0.45 + heatNorm * 0.55}
        />
      </mesh>
    </group>
  );
}

/**
 * Homely House hero — mesh names drive twin effects:
 * house_door (hinge leaf only), house_chimney + ChimneyFire (heat), house_heart + body (presence).
 * Sensor light: WindowLightPlanes only — no door-centered point lights / porch bulb.
 */
function HomelyHouse({ state }: { state: TwinVisualState }) {
  const { scene } = useGLTF(HOUSE_URL);
  const groupRef = useRef<Group>(null);
  const doorRef = useRef<Object3D | null>(null);
  const doorOpenTarget = useRef(0);

  const root = useMemo(() => {
    const cloned = cloneSkeleton(scene) as Group;
    cloned.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;

      const part = classifyMesh(mesh);
      mesh.userData.twinPart = part;

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => prepareMaterial(m.clone()));
      } else if (mesh.material) {
        mesh.material = prepareMaterial(mesh.material.clone());
      }

      if (part === 'window' || part === 'glass') {
        mesh.userData.glass = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = 0.55;
        mat.roughness = 0.15;
        mat.metalness = 0.12;
        mat.depthWrite = false;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return cloned;
  }, [scene]);

  /**
   * Bind hinge to exact `house_door` only (not mailbox_door / fuzzy /door/ matches).
   * Eject any non-door children that may have been wrongly nested under it.
   */
  useLayoutEffect(() => {
    doorRef.current = null;
    const doorNode = root.getObjectByName('house_door');
    if (!doorNode) return;

    const houseBody = root.getObjectByName('house') ?? doorNode.parent ?? root;

    // house_door should be a leaf mesh; reparent any stray props back to the house body.
    for (const child of [...doorNode.children]) {
      const n = (child.name || '').toLowerCase();
      if (n.includes('door')) continue;
      houseBody.attach(child);
    }

    doorRef.current = doorNode;
  }, [root]);

  useFrame(({ clock }, dt) => {
    const open = state.doorOpen || state.presence;
    doorOpenTarget.current = open ? 1 : 0;
    const door = doorRef.current;
    if (door) {
      // GLTF translation is already the hinge pivot (right edge of the leaf).
      const targetY = doorOpenTarget.current * (-Math.PI * 0.62);
      door.rotation.y = THREE.MathUtils.damp(door.rotation.y, targetY, 6, dt);
    }

    const ln = state.lightNorm;
    const hn = state.heatNorm;
    // Soft body wash only; sharp light cue is WindowLightPlanes (never the doorway).
    const lit = state.lightsOn ? 0.12 + ln * 0.14 : ln * 0.04;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * (hn > 0.85 ? 5.5 : 1.8));
    const heartPulse = 0.55 + 0.45 * Math.sin(clock.elapsedTime * (state.presence ? 3.2 : 1.4));

    if (!groupRef.current) return;

    groupRef.current.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const part = mesh.userData.twinPart as TwinPart | undefined;
      if (!part) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat?.emissive) return;

      if (part === 'door') {
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
        return;
      }

      if (part === 'heart') {
        const glow = state.presence || state.lightsOn ? 0.4 + heartPulse * 0.6 : 0.08;
        mat.emissive.setRGB(0.95 * glow, 0.25 * glow, 0.35 * glow);
        mat.emissiveIntensity = glow * (0.75 + state.presenceNorm * 0.6);
        return;
      }

      // Chimney mesh: subtle emissive support; primary heat visual is ChimneyFire.
      if (part === 'chimney' || /chimney/i.test(mesh.name)) {
        if (hn < 0.25) {
          mat.emissive.setRGB(0, 0, 0);
          mat.emissiveIntensity = 0;
          return;
        }
        const e = hn * 0.7 * pulse;
        mat.emissive.setRGB(Math.min(1, e * 1.4), Math.min(1, e * 0.28), 0.02);
        mat.emissiveIntensity = 0.35 + hn * 1.1;
        return;
      }

      // Roof: very mild warm tint only — not the temp cue.
      if (part === 'roof') {
        if (hn < 0.45) {
          mat.emissive.setRGB(0, 0, 0);
          mat.emissiveIntensity = 0;
          return;
        }
        mat.emissive.setRGB(hn * 0.25 * pulse, hn * 0.08 * pulse, 0.01);
        mat.emissiveIntensity = hn * 0.35;
        return;
      }

      if (mesh.userData.glass || part === 'window' || part === 'glass') {
        mat.emissive.setRGB(
          Math.min(1, lit * 1.05),
          Math.min(1, lit * 0.62),
          Math.min(1, lit * 0.22),
        );
        mat.emissiveIntensity = lit * (1.2 + ln * 0.8);
        mat.opacity = state.lightsOn ? 0.88 : 0.45 + lit * 0.3;
        return;
      }

      // Soft interior spill on fused body atlas (windows handle the sharp glow).
      // Keep very low so the doorway never reads as a light source.
      const warm = lit * 0.12;
      mat.emissive.setRGB(
        Math.min(1, warm * 1.05),
        Math.min(1, warm * 0.65),
        Math.min(1, warm * 0.22),
      );
      mat.emissiveIntensity = lit * 0.28;
    });
  });

  return (
    <group ref={groupRef} name="HomelyHouse" scale={0.58} position={[0, 0, 0]}>
      <primitive object={root} />
      <WindowLightPlanes lightsOn={state.lightsOn} lightNorm={state.lightNorm} />
      <ChimneyFire heatNorm={state.heatNorm} heatLevel={state.heatLevel} />
      <ThermometerProp heatNorm={state.heatNorm} temperature={state.temperature} />
      <HomelyGarden mailboxFlag={state.mailboxFlag} valveOpen={state.valveOpen} />
    </group>
  );
}

/** Rising ember particle seeded once per heat band. */
type EmberSeed = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  phase: number;
  scale: number;
  life: number;
};

/**
 * Primary temperature visual: living fire at the chimney mouth
 * (house_chimney at local [1.8, 5.2, 0], mouth ≈ y 6.5).
 * heatNorm drives height, brightness, and particle count; cool → gone.
 */
function ChimneyFire({
  heatNorm,
  heatLevel,
}: {
  heatNorm: number;
  heatLevel: TwinVisualState['heatLevel'];
}) {
  const groupRef = useRef<Group>(null);
  const mouthLightRef = useRef<THREE.PointLight>(null);
  const emberMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const outerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tipMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const flameARef = useRef<Group>(null);
  const flameBRef = useRef<Group>(null);
  const flameCRef = useRef<Group>(null);
  const billboardARef = useRef<Mesh>(null);
  const billboardBRef = useRef<Mesh>(null);
  const billboardMatARef = useRef<THREE.MeshBasicMaterial>(null);
  const billboardMatBRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fire = heatLevel === 'fire';
  const hot = heatLevel === 'hot' || fire;
  const alive = heatNorm >= 0.18;

  const emberCount = !alive
    ? 0
    : Math.floor(6 + heatNorm * (fire ? 48 : hot ? 32 : 18));

  const embers = useMemo(() => {
    if (emberCount === 0) return [] as EmberSeed[];
    return Array.from({ length: emberCount }, () => ({
      x: (Math.random() - 0.5) * 0.35,
      y: Math.random() * 0.4,
      z: (Math.random() - 0.5) * 0.35,
      vx: (Math.random() - 0.5) * 0.12,
      vy: 0.35 + Math.random() * (0.45 + heatNorm * 1.1),
      phase: Math.random() * Math.PI * 2,
      scale: 0.018 + Math.random() * (0.02 + heatNorm * 0.035),
      life: Math.random(),
    }));
  }, [emberCount, heatNorm]);

  useFrame(({ clock }, dt) => {
    if (!alive) return;
    const t = clock.elapsedTime;
    // Multi-frequency flicker — reads as flame, not a sine pulse on a cone.
    const flick =
      0.78 +
      0.14 * Math.sin(t * (fire ? 14 : hot ? 10 : 6.5)) +
      0.08 * Math.sin(t * 23.7 + 1.2) +
      0.05 * Math.sin(t * 41.3 + 0.4);
    const strength = heatNorm * flick;
    const height = 0.55 + heatNorm * (fire ? 1.55 : hot ? 1.15 : 0.75);

    if (mouthLightRef.current) {
      mouthLightRef.current.intensity = strength * (fire ? 3.6 : hot ? 2.4 : 1.25);
      mouthLightRef.current.distance = 3.2 + heatNorm * (fire ? 4.2 : 2.6);
      mouthLightRef.current.visible = strength > 0.04;
      mouthLightRef.current.position.y = 0.15 + height * 0.22;
    }
    if (emberMatRef.current) {
      emberMatRef.current.emissiveIntensity = strength * (fire ? 2.6 : 1.5);
      emberMatRef.current.opacity = Math.min(0.95, 0.3 + strength * 0.65);
      emberMatRef.current.visible = strength > 0.05;
    }
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = strength * (fire ? 3.2 : 2.0);
      coreMatRef.current.opacity = Math.min(0.92, 0.35 + strength * 0.55);
    }
    if (outerMatRef.current) {
      outerMatRef.current.emissiveIntensity = strength * (fire ? 2.4 : 1.4);
      outerMatRef.current.opacity = Math.min(0.75, 0.2 + strength * 0.45);
    }
    if (tipMatRef.current) {
      tipMatRef.current.emissiveIntensity = strength * (fire ? 2.8 : 1.6);
      tipMatRef.current.opacity = Math.min(0.7, 0.15 + strength * 0.5);
    }
    if (billboardMatARef.current) {
      billboardMatARef.current.opacity = Math.min(0.85, 0.25 + strength * 0.55);
    }
    if (billboardMatBRef.current) {
      billboardMatBRef.current.opacity = Math.min(0.55, 0.12 + strength * 0.4);
    }

    // Layered flame meshes sway / stretch independently.
    const sway = (phase: number, amp: number, freq: number) =>
      Math.sin(t * freq + phase) * amp * (0.6 + heatNorm);

    if (flameARef.current) {
      flameARef.current.scale.set(
        0.85 + 0.2 * Math.sin(t * 11.2),
        height * (0.92 + 0.12 * Math.sin(t * 9.4)),
        0.85 + 0.18 * Math.sin(t * 13.1 + 0.7),
      );
      flameARef.current.rotation.z = sway(0, 0.12, 7.5);
      flameARef.current.rotation.x = sway(1.1, 0.08, 6.2);
      flameARef.current.position.y = 0.18 + height * 0.28;
    }
    if (flameBRef.current) {
      flameBRef.current.scale.set(
        1.05 + 0.25 * Math.sin(t * 8.7 + 0.5),
        height * (0.75 + 0.18 * Math.sin(t * 12.6 + 1.3)),
        1.0 + 0.22 * Math.sin(t * 10.4 + 0.2),
      );
      flameBRef.current.rotation.z = sway(2.2, 0.18, 5.8);
      flameBRef.current.rotation.y = sway(0.4, 0.35, 3.1);
      flameBRef.current.position.y = 0.12 + height * 0.2;
    }
    if (flameCRef.current) {
      flameCRef.current.scale.set(
        0.55 + 0.15 * Math.sin(t * 15.3),
        height * (0.55 + 0.22 * Math.sin(t * 17.8 + 0.9)),
        0.55 + 0.12 * Math.sin(t * 14.1 + 1.5),
      );
      flameCRef.current.rotation.z = sway(3.4, 0.22, 9.2);
      flameCRef.current.position.y = 0.35 + height * 0.55;
      flameCRef.current.position.x = sway(0.8, 0.06, 8.1);
    }
    if (billboardARef.current) {
      const h = height * (0.9 + 0.15 * Math.sin(t * 13.5));
      billboardARef.current.scale.set(0.45 + heatNorm * 0.25, h, 1);
      billboardARef.current.position.y = 0.15 + h * 0.45;
    }
    if (billboardBRef.current) {
      const h = height * (0.7 + 0.2 * Math.sin(t * 11.8 + 1.6));
      billboardBRef.current.scale.set(0.55 + heatNorm * 0.35, h * 0.85, 1);
      billboardBRef.current.position.y = 0.2 + h * 0.4;
      billboardBRef.current.position.x = 0.04 * Math.sin(t * 6.5);
    }

    // Rising embers / sparks — recycle at mouth, climb, drift, fade by life.
    const mesh = particlesRef.current;
    if (mesh && embers.length > 0) {
      const riseMul = 0.7 + heatNorm * 1.6;
      const maxY = 0.6 + height * 1.35;
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        e.life += dt * (0.35 + heatNorm * 0.55);
        e.y += e.vy * dt * riseMul;
        e.x += e.vx * dt + Math.sin(t * 2.4 + e.phase) * 0.004;
        e.z += Math.cos(t * 1.9 + e.phase) * 0.003;
        if (e.y > maxY || e.life > 1) {
          e.x = (Math.random() - 0.5) * 0.32;
          e.y = -0.05 + Math.random() * 0.12;
          e.z = (Math.random() - 0.5) * 0.32;
          e.vx = (Math.random() - 0.5) * 0.14;
          e.vy = 0.35 + Math.random() * (0.45 + heatNorm * 1.1);
          e.life = 0;
          e.scale = 0.016 + Math.random() * (0.018 + heatNorm * 0.035);
        }
        const fade = 1 - e.life;
        const s = e.scale * (0.55 + fade * 0.9) * (0.7 + heatNorm * 0.6);
        dummy.position.set(e.x, e.y, e.z);
        dummy.scale.set(s, s * 1.35, s);
        dummy.rotation.set(0, e.phase + t, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 1.2 + strength * (fire ? 2.4 : 1.4);
        mat.opacity = Math.min(0.95, 0.35 + heatNorm * 0.55);
      }
    }
  });

  if (!alive) return null;

  const sparkCount = Math.floor(8 + heatNorm * (fire ? 38 : hot ? 26 : 14));
  const flameColor = fire ? '#ef4444' : hot ? '#f97316' : '#fb923c';
  const tipColor = fire ? '#fde68a' : '#fdba74';

  return (
    <group ref={groupRef} name="Chimney_Fire" position={[1.8, 6.35, 0]}>
      {/* Ember bed in the chimney mouth */}
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.18, 10]} />
        <meshStandardMaterial
          ref={emberMatRef}
          color="#7c2d12"
          emissive="#ea580c"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
          roughness={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* Inner core cone — hottest layer */}
      <group ref={flameARef} position={[0, 0.35, 0]}>
        <mesh>
          <coneGeometry args={[0.16, 0.9, 7]} />
          <meshStandardMaterial
            ref={coreMatRef}
            color="#fff7ed"
            emissive={tipColor}
            emissiveIntensity={1.4}
            transparent
            opacity={0.7}
            roughness={0.35}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Outer envelope — wider, cooler orange */}
      <group ref={flameBRef} position={[0, 0.25, 0]}>
        <mesh>
          <coneGeometry args={[0.28, 1.05, 8]} />
          <meshStandardMaterial
            ref={outerMatRef}
            color="#fb923c"
            emissive={flameColor}
            emissiveIntensity={1.0}
            transparent
            opacity={0.5}
            roughness={0.45}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Tip tongue — smaller, faster flicker */}
      <group ref={flameCRef} position={[0, 0.7, 0]}>
        <mesh>
          <coneGeometry args={[0.1, 0.55, 6]} />
          <meshStandardMaterial
            ref={tipMatRef}
            color="#fef3c7"
            emissive={fire ? '#fbbf24' : '#fdba74'}
            emissiveIntensity={1.2}
            transparent
            opacity={0.55}
            roughness={0.3}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Camera-facing flame billboards — soft multi-plane glow */}
      <Billboard follow position={[0, 0.4, 0]}>
        <mesh ref={billboardARef}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={billboardMatARef}
            color={flameColor}
            transparent
            opacity={0.45}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>
      <Billboard follow position={[0.02, 0.5, 0]}>
        <mesh ref={billboardBRef}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={billboardMatBRef}
            color={tipColor}
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>

      <pointLight
        ref={mouthLightRef}
        color={flameColor}
        intensity={0}
        distance={4.5}
        decay={2}
        position={[0, 0.25, 0]}
      />

      {/* Instanced rising embers */}
      {emberCount > 0 && (
        <instancedMesh ref={particlesRef} args={[undefined, undefined, emberCount]} frustumCulled={false}>
          <sphereGeometry args={[1, 5, 5]} />
          <meshStandardMaterial
            color="#fdba74"
            emissive={fire ? '#fbbf24' : '#fb923c'}
            emissiveIntensity={1.5}
            transparent
            opacity={0.75}
            roughness={0.4}
            depthWrite={false}
          />
        </instancedMesh>
      )}

      {/* Soft sparkle haze above the stack */}
      <Sparkles
        count={sparkCount}
        scale={[0.5 + heatNorm * 0.35, 0.9 + heatNorm * (fire ? 1.6 : 1.0), 0.5 + heatNorm * 0.35]}
        size={1.8 + heatNorm * (fire ? 4.2 : 2.6)}
        speed={0.25 + heatNorm * (fire ? 1.5 : 0.7)}
        opacity={0.25 + heatNorm * 0.5}
        color={fire ? '#fde68a' : '#fb923c'}
        position={[0, 0.45 + heatNorm * 0.5, 0]}
      />
      {hot && (
        <Sparkles
          count={Math.floor(8 + heatNorm * 14)}
          scale={[0.85 + heatNorm * 0.4, 1.6 + heatNorm * 1.2, 0.85 + heatNorm * 0.4]}
          size={1.4 + heatNorm * 1.6}
          speed={0.15 + heatNorm * 0.2}
          opacity={0.12 + heatNorm * 0.28}
          color="#fef3c7"
          position={[0, 0.9 + heatNorm * 0.7, 0]}
        />
      )}
    </group>
  );
}

function MistLayer({ active, humidityNorm }: { active: boolean; humidityNorm: number }) {
  // Mist density scales continuously with humidityNorm (active flag = very high RH).
  if (!active && humidityNorm < 0.35) return null;
  const strong = active || humidityNorm >= 0.7;
  const count = Math.floor(8 + humidityNorm * 32);
  return (
    <group name="Humidity_Mist">
      <Sparkles
        count={count}
        scale={[4.6, 1.4 + humidityNorm * 0.8, 4.6]}
        size={2.8 + humidityNorm * 3.2}
        speed={0.1 + humidityNorm * 0.22}
        opacity={0.1 + humidityNorm * 0.4}
        color="#cbd5e1"
        position={[0, 1.35, 0.35]}
      />
      {strong && (
        <Sparkles
          count={Math.floor(10 + humidityNorm * 16)}
          scale={[3.2, 2.0 + humidityNorm, 3.2]}
          size={1.8 + humidityNorm * 1.2}
          speed={0.4 + humidityNorm * 0.35}
          opacity={0.18 + humidityNorm * 0.3}
          color="#94a3b8"
          position={[0.1, 1.9, 0.5]}
        />
      )}
    </group>
  );
}

/** Falling droplets — count and speed scale with humidityNorm. */
function HumidityDroplets({ active, humidityNorm }: { active: boolean; humidityNorm: number }) {
  // Continuous scale: more humidity → more/faster drops (active boosts when RH threshold hit).
  const count =
    humidityNorm < 0.3 && !active
      ? 0
      : Math.floor((active ? 18 : 6) + humidityNorm * (active ? 48 : 36));
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const drops = useMemo(() => {
    if (count === 0) return [] as { x: number; y: number; z: number; speed: number; phase: number; scale: number }[];
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 5.2,
      y: 0.4 + Math.random() * 3.6,
      z: (Math.random() - 0.5) * 4.8 + 0.4,
      speed: 0.45 + Math.random() * (0.6 + humidityNorm * 1.1),
      phase: Math.random() * Math.PI * 2,
      scale: 0.03 + Math.random() * (0.03 + humidityNorm * 0.04),
    }));
  }, [count, humidityNorm]);

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current;
    if (!mesh || drops.length === 0) return;
    const t = clock.elapsedTime;
    const fallMul = 0.55 + humidityNorm * 1.35;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y -= d.speed * dt * fallMul;
      d.x += Math.sin(t * 1.4 + d.phase) * 0.002;
      if (d.y < 0.08) {
        d.y = 2.4 + Math.random() * 2.2;
        d.x = (Math.random() - 0.5) * 5.2;
        d.z = (Math.random() - 0.5) * 4.8 + 0.4;
      }
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(d.scale * 0.55, d.scale * 1.6, d.scale * 0.55);
      dummy.rotation.set(0, 0, Math.sin(t + d.phase) * 0.15);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <group name="Humidity_Droplets">
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color="#7dd3fc"
          emissive="#38bdf8"
          emissiveIntensity={0.4 + humidityNorm * 0.7}
          transparent
          opacity={0.55 + humidityNorm * 0.4}
          roughness={0.25}
          metalness={0.05}
          depthWrite={false}
        />
      </instancedMesh>
      <Sparkles
        count={Math.floor(6 + humidityNorm * 24)}
        scale={[3.8, 0.55, 3.2]}
        size={1.4 + humidityNorm * 1.2}
        speed={0.25 + humidityNorm * 0.35}
        opacity={0.2 + humidityNorm * 0.5}
        color="#bae6fd"
        position={[0, 2.55, 0.55]}
      />
    </group>
  );
}

function IrrigationSpray() {
  return (
    <group name="Irrigation">
      <Sparkles
        count={22}
        scale={[1.4, 1.2, 1.4]}
        size={2.8}
        speed={0.85}
        opacity={0.55}
        color="#67e8f9"
        position={[-2.2, 0.85, 3.2]}
      />
      <Sparkles
        count={16}
        scale={[1.1, 1.0, 1.1]}
        size={2.2}
        speed={0.7}
        opacity={0.45}
        color="#a5f3fc"
        position={[2.4, 0.7, 3.1]}
      />
    </group>
  );
}

/** Expanding ring at the gate from distance / proximity. */
function ProximityRing({ nearNorm }: { nearNorm: number }) {
  const ringRef = useRef<Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }, dt) => {
    if (!ringRef.current || !matRef.current) return;
    const show = nearNorm > 0.25;
    const target = show ? 0.55 + nearNorm * 0.9 : 0;
    const s = THREE.MathUtils.damp(ringRef.current.scale.x, target, 4, dt);
    ringRef.current.scale.set(s, 1, s);
    matRef.current.opacity = show ? 0.15 + nearNorm * 0.45 + Math.sin(clock.elapsedTime * 3) * 0.08 : 0;
  });
  return (
    <mesh
      ref={ringRef}
      name="Proximity_Ring"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[-0.05, 0.04, 2.35]}
      scale={[0, 1, 0]}
    >
      <ringGeometry args={[0.55, 0.85, 48]} />
      <meshBasicMaterial ref={matRef} color="#38bdf8" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Soft path sparkles when motion / visitor is active. */
function PathPresence({ active, intensity }: { active: boolean; intensity: number }) {
  if (!active && intensity < 0.4) return null;
  return (
    <Sparkles
      count={Math.floor(8 + intensity * 16)}
      scale={[1.2, 0.35, 2.4]}
      size={2.0}
      speed={0.6}
      opacity={0.3 + intensity * 0.4}
      color="#93c5fd"
      position={[0.15, 0.25, 1.85]}
    />
  );
}

function PresenceMarker({ visible, intensity }: { visible: boolean; intensity: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const s = THREE.MathUtils.damp(ref.current.scale.x, visible ? 1 : 0, 5, dt);
    ref.current.scale.setScalar(s);
    ref.current.position.y = 0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.02 * intensity;
  });
  return (
    <group ref={ref} name="Presence" position={[1.55, 0.55, 2.05]} scale={0}>
      <mesh castShadow>
        <capsuleGeometry args={[0.1, 0.28, 6, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color="#334155" roughness={0.55} />
      </mesh>
      <pointLight color="#60a5fa" intensity={0.35 * intensity} distance={1.8} decay={2} />
    </group>
  );
}

/** Yard grass pad — stays green in both themes (sky/fog may go dark, not the lawn). */
function GardenGround({ dark }: { dark: boolean }) {
  // Keep grass clearly green; only a slight shade shift so dark-mode lighting still reads.
  const pad = dark ? '#7fa86c' : '#8faf78';
  const rim = dark ? '#6e9458' : '#7a9a65';
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0.35]} receiveShadow>
        <circleGeometry args={[6.2, 64]} />
        <meshStandardMaterial color={pad} roughness={0.98} metalness={0.01} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0.35]} receiveShadow>
        <ringGeometry args={[5.2, 6.25, 64]} />
        <meshStandardMaterial color={rim} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

function LoaderOverlay() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <Html center>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={26} />
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
          {Math.round(progress)}%
        </Box>
      </Box>
    </Html>
  );
}

function ToneMapping() {
  const { gl } = useThree();
  useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);
  return null;
}

/**
 * Visible sun (day / light theme) or moon (night / dark theme) disc + matching key light.
 * Intensity also eases with lightNorm so a bright light sensor reads as a clearer day.
 */
function CelestialBody({
  dark,
  lightNorm,
  heatLevel,
}: {
  dark: boolean;
  lightNorm: number;
  heatLevel: TwinVisualState['heatLevel'];
}) {
  const night = dark || lightNorm < 0.18;
  const pos: [number, number, number] = night ? [-5.8, 7.2, -3.2] : [5.6, 7.8, 4.0];
  const discColor = night ? '#e8eef8' : heatLevel === 'fire' ? '#ffc4a0' : '#ffe9b0';
  const glowColor = night ? '#9db4d8' : '#ffd789';
  const keyIntensity = night
    ? 0.55 + lightNorm * 0.25
    : 0.95 + lightNorm * 0.35 + (heatLevel === 'fire' ? 0.12 : 0);
  const discSize = night ? 0.42 : 0.55;

  return (
    <group name="CelestialBody">
      <directionalLight
        castShadow
        position={pos}
        intensity={keyIntensity}
        color={night ? '#c5d4ea' : heatLevel === 'fire' ? '#ffc4b4' : '#fff1dd'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={22}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0002}
      />
      <group position={pos}>
        <mesh>
          <sphereGeometry args={[discSize * 1.55, 24, 24]} />
          <meshBasicMaterial color={glowColor} transparent opacity={night ? 0.12 : 0.18} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[discSize, 28, 28]} />
          <meshBasicMaterial color={discColor} toneMapped={false} />
        </mesh>
        {night && <pointLight color="#b8c8e0" intensity={0.35} distance={14} decay={2} />}
      </group>
    </group>
  );
}

function TwinStudio({ state, dark }: { state: TwinVisualState; dark: boolean }) {
  const bg = dark ? '#0e1412' : '#f7f8fa';

  return (
    <>
      <ToneMapping />
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 11, 24]} />

      {/* Soft base + hemisphere so garden/house read without blow-out */}
      <ambientLight intensity={dark ? 0.28 : 0.38} />
      <hemisphereLight
        color={dark ? '#b8c8d8' : '#fff6ea'}
        groundColor={dark ? '#5f8a4e' : '#6f8a5e'}
        intensity={dark ? 0.48 : 0.62}
      />
      {/* Key light is the visible sun / moon */}
      <CelestialBody dark={dark} lightNorm={state.lightNorm} heatLevel={state.heatLevel} />
      {/* Fill — cool, lower intensity from left */}
      <directionalLight position={[-4.5, 4.2, 2.0]} intensity={dark ? 0.22 : 0.32} color="#d7e4f5" />
      {/* Rim — back edge light for silhouette */}
      <directionalLight position={[-1.5, 3.5, -5.0]} intensity={dark ? 0.26 : 0.36} color="#e8f0ff" />
      {/* Soft bounce from the garden pad */}
      <pointLight position={[0, 0.6, 1.2]} intensity={dark ? 0.1 : 0.15} color="#c5d9a8" distance={9} decay={2} />

      <GardenGround dark={dark} />

      <HomelyHouse state={state} />
      <MistLayer active={state.misty} humidityNorm={state.humidityNorm} />
      <HumidityDroplets active={state.droplets} humidityNorm={state.humidityNorm} />
      <ProximityRing nearNorm={state.nearNorm} />
      <PathPresence active={state.motionActive || state.presence} intensity={state.presenceNorm} />
      <PresenceMarker visible={state.presence} intensity={state.presenceNorm} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        minPolarAngle={0.28}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={5.8}
        maxDistance={14}
        target={[0, 1.45, 0.35]}
        autoRotate
        autoRotateSpeed={0.28}
      />

      {!state.online && (
        <mesh position={[0, 1.4, 0.35]}>
          <sphereGeometry args={[7.5, 16, 16]} />
          <meshBasicMaterial
            color={dark ? '#0b1220' : '#e8eef2'}
            transparent
            opacity={0.26}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </>
  );
}

useGLTF.preload(HOUSE_URL);
Object.values(GARDEN_URLS).forEach((url) => useGLTF.preload(url));

/**
 * Overview digital twin: Tiny Treats Homely House + yard, drag-to-rotate.
 * Telemetry: light → window panes + sun/moon, humidity → droplets/mist, temp → chimney fire,
 * door leaf hinge, presence, and more.
 */
export function HouseGardenScene({ state, className }: HouseGardenSceneProps) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';

  return (
    <Box
      className={['twin-scene', className].filter(Boolean).join(' ')}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: { xs: 280, sm: 340, md: 400 },
        borderRadius: 'inherit',
        overflow: 'hidden',
        bgcolor: dark ? '#0e1412' : '#f7f8fa',
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [6.6, 4.0, 7.2], fov: 32, near: 0.1, far: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
      >
        <Suspense fallback={null}>
          <TwinStudio state={state} dark={dark} />
        </Suspense>
        <LoaderOverlay />
      </Canvas>
    </Box>
  );
}
