import { FACES, type Envelope, type Face, type WindResult } from "@wind/engine";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Block, Project } from "../project";
import { elevationSvg, envelopeSegments, FACE_NAMES, fmt, maxMagnitude, pressureColour, signed, zoneSegments, type Segment } from "../viz";

type Ok = Extract<WindResult, { ok: true }>;
export type ViewMode = "envelope" | Face;

/** Places a point on an elevation in scene coordinates (x east, y up, z south), before rotation. */
export function facePoint(face: Face, s: number, z: number, W: number, D: number): [number, number, number] {
  switch (face) {
    case "N":
      return [W / 2 - s, z, -D / 2];
    case "E":
      return [W / 2, z, D / 2 - s];
    case "S":
      return [-W / 2 + s, z, D / 2];
    case "W":
      return [-W / 2, z, -D / 2 + s];
  }
}

const FACE_ROT: Record<Face, number> = { N: Math.PI, E: Math.PI / 2, S: 0, W: -Math.PI / 2 };
const OUT = 0.02;

/** Segments to draw on each face for a view mode. */
export function faceSegments(r: Ok, mode: ViewMode, env: Envelope, h: number): Record<Face, Segment[]> {
  const out = {} as Record<Face, Segment[]>;
  for (const el of r.elevations) out[el.face] = mode === "envelope" ? envelopeSegments(el, env, h) : zoneSegments(el, mode, env);
  return out;
}

const NORMALS: Record<Face, [number, number, number]> = { N: [0, 0, -1], E: [1, 0, 0], S: [0, 0, 1], W: [-1, 0, 0] };

/** Elevations whose outward normal points towards the camera; labels on the others are hidden. */
function useFacingFaces(group: React.RefObject<THREE.Group | null>, W: number, D: number, h: number): Set<Face> {
  const [facing, setFacing] = useState<Set<Face>>(new Set(FACES));
  const key = useRef("");
  const n = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const out: Face[] = [];
    for (const f of FACES) {
      n.set(...NORMALS[f]).applyQuaternion(g.getWorldQuaternion(q));
      c.set(...facePoint(f, (f === "N" || f === "S" ? W : D) / 2, h / 2, W, D)).applyMatrix4(g.matrixWorld);
      if (n.dot(camera.position.clone().sub(c)) > 0) out.push(f);
    }
    const k = out.join("");
    if (k !== key.current) {
      key.current = k;
      setFacing(new Set(out));
    }
  });
  return facing;
}

function Building({ r, block, mode, env, onProbe }: { r: Ok; block: Block; mode: ViewMode; env: Envelope; onProbe: (t: string | null) => void }) {
  const { widthNS: W, widthEW: D, height: h } = block.building;
  const segs = useMemo(() => faceSegments(r, mode, env, h), [r, mode, env, h]);
  const max = maxMagnitude(r, env);
  const group = useRef<THREE.Group>(null);
  const facing = useFacingFaces(group, W, D, h);
  return (
    <group ref={group}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[W * 0.999, h * 0.999, D * 0.999]} />
        <meshStandardMaterial color="#d9e2e7" />
      </mesh>
      {FACES.map((f) =>
        segs[f].map((s, i) => {
          const mid = facePoint(f, (s.from + s.to) / 2, (s.zFrom + s.zTo) / 2, W, D);
          const n = { N: [0, 0, -OUT], E: [OUT, 0, 0], S: [0, 0, OUT], W: [-OUT, 0, 0] }[f];
          const label = `${FACE_NAMES[f]} · ${s.zone === "env" ? "general" : `zone ${s.label}`} · ${signed(s.value, 3)} kPa`;
          return (
            <mesh
              key={`${f}${i}`}
              position={[mid[0] + n[0]!, mid[1], mid[2] + n[2]!]}
              rotation={[0, FACE_ROT[f], 0]}
              onPointerOver={(e) => {
                e.stopPropagation();
                onProbe(label);
              }}
              onPointerOut={() => onProbe(null)}
            >
              <planeGeometry args={[Math.max(s.to - s.from, 0.01), Math.max(s.zTo - s.zFrom, 0.01)]} />
              <meshStandardMaterial color={pressureColour(s.value, max)} />
              {facing.has(f) && s.to - s.from > Math.max(W, D) * 0.08 ? (
                <Html position={[0, 0, 0.1]} center distanceFactor={Math.max(W, D, h) * 1.4} zIndexRange={[10, 0]} className="zone-tag">
                  {s.zone === "env" ? "" : `${s.label} `}
                  {signed(s.value, 2)}
                </Html>
              ) : null}
            </mesh>
          );
        }),
      )}
      {FACES.map((f) => {
        const p = facePoint(f, (f === "N" || f === "S" ? W : D) / 2, h + Math.max(h * 0.08, 1.5), W, D);
        return (
          <Html key={f} position={p} center className="face-tag">
            {f}
          </Html>
        );
      })}
    </group>
  );
}

function WindArrow({ onto, block }: { onto: Face; block: Block }) {
  const { widthNS: W, widthEW: D, height: h } = block.building;
  const L = Math.max(W, D) * 0.45;
  const start = facePoint(onto, (onto === "N" || onto === "S" ? W : D) / 2, h * 0.5, W, D);
  const dir = { N: [0, 0, -1], E: [1, 0, 0], S: [0, 0, 1], W: [-1, 0, 0] }[onto];
  const pos: [number, number, number] = [start[0] + dir[0]! * (L * 0.5 + 1), start[1], start[2] + dir[2]! * (L * 0.5 + 1)];
  const rotY = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 }[onto];
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[L * 0.03, L * 0.03, L, 12]} />
        <meshStandardMaterial color="#2a6fb0" />
      </mesh>
      <mesh position={[0, 0, L / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[L * 0.09, L * 0.22, 16]} />
        <meshStandardMaterial color="#2a6fb0" />
      </mesh>
    </group>
  );
}

function Scene({ r, block, orientation, mode, env, onProbe }: { r: Ok; block: Block; orientation: number; mode: ViewMode; env: Envelope; onProbe: (t: string | null) => void }) {
  const { widthNS: W, widthEW: D, height: h } = block.building;
  const size = Math.max(W, D, h);
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[size, size * 2, size * 1.5]} intensity={1.1} />
      <gridHelper args={[size * 4, 20, "#9fb2bb", "#d3dde2"]} />
      <Html position={[0, 0.1, -size * 1.6]} center className="face-tag north">
        N ↑
      </Html>
      <group rotation={[0, (-orientation * Math.PI) / 180, 0]}>
        <Building r={r} block={block} mode={mode} env={env} onProbe={onProbe} />
        {mode !== "envelope" ? <WindArrow onto={mode} block={block} /> : null}
      </group>
    </>
  );
}

/** Camera at a fixed angle to the building (looking at its south-east corner), whatever its orientation. */
export function cameraPosition(size: number, orientation: number): [number, number, number] {
  const a = (-(Number.isFinite(orientation) ? orientation : 0) * Math.PI) / 180;
  const x = size * 1.5;
  const z = size * 1.9;
  return [x * Math.cos(a) + z * Math.sin(a), size * 1.15, -x * Math.sin(a) + z * Math.cos(a)];
}

export function Viewer({ project, block, result, env }: { project: Project; block: Block; result: WindResult; env: Envelope }) {
  const [tab, setTab] = useState<"3d" | "elevations">("3d");
  const [mode, setMode] = useState<ViewMode>("envelope");
  const [probe, setProbe] = useState<string | null>(null);
  const r = result.ok ? result : null;
  const { widthNS: W, widthEW: D, height: h } = block.building;
  const size = Math.max(W, D, h) || 10;
  const max = r ? maxMagnitude(r, env) : 1;
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <div className="seg" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={tab === "3d"} onClick={() => setTab("3d")}>
            3D
          </button>
          <button type="button" role="tab" aria-selected={tab === "elevations"} onClick={() => setTab("elevations")}>
            Elevations
          </button>
        </div>
        {tab === "3d" ? (
          <label className="toggle">
            Show
            <select value={mode} onChange={(e) => setMode(e.target.value as ViewMode)}>
              <option value="envelope">Design suction envelope</option>
              {FACES.map((f) => (
                <option key={f} value={f}>
                  Zones, wind onto {FACE_NAMES[f]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span className="legend" aria-hidden="true">
          <span>{signed(-max, 2)}</span>
          <span className="legend-bar" style={{ background: `linear-gradient(90deg, ${pressureColour(-max, max)}, ${pressureColour(0, max)}, ${pressureColour(max, max)})` }} />
          <span>{signed(max, 2)} kPa</span>
        </span>
      </div>
      {tab === "3d" ? (
        <div className="canvas-wrap">
          {r ? (
            <Canvas key={block.id} camera={{ position: cameraPosition(size, project.site.orientation), fov: 38 }} gl={{ preserveDrawingBuffer: true, antialias: true }}>
              <Scene r={r} block={block} orientation={project.site.orientation} mode={mode} env={env} onProbe={setProbe} />
              <OrbitControls makeDefault enableDamping target={[0, h / 3, 0]} />
            </Canvas>
          ) : (
            <p className="canvas-empty">Complete the inputs to see the building.</p>
          )}
          <p className={`probe${probe ? "" : " probe-hint"}`}>{probe ?? "Hover a face for its net pressure · drag to orbit"}</p>
        </div>
      ) : (
        <div className="elevations">
          {r ? (
            r.elevations.map((el) => (
              <figure key={el.face} className="elevation">
                <div
                  className="elevation-svg"
                  // Generated by elevationSvg from numbers only; no user text except the block name, which is escaped.
                  dangerouslySetInnerHTML={{ __html: elevationSvg(el, env, h, `${block.name} · ${FACE_NAMES[el.face]} elevation`) }}
                />
              </figure>
            ))
          ) : (
            <p className="canvas-empty">Complete the inputs to see the elevations.</p>
          )}
        </div>
      )}
      <p className="caption">
        {fmt(W, 2)} × {fmt(D, 2)} m plan, {fmt(h, 2)} m high. Blue is pressure and red is suction. Corner zones use the larger e/5 of the two side directions.
      </p>
    </div>
  );
}
