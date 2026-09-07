import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type BlockType = "grass" | "dirt" | "stone" | "wood" | "leaves" | "sand" | "cobble" | "glass";
type Overlay = "inventory" | "map" | "settings" | "chat" | null;

type Voxel = {
  type: BlockType;
  x: number;
  y: number;
  z: number;
};

type Player = {
  x: number;
  z: number;
  health: number;
  hunger: number;
  xp: number;
};

type Camera = {
  yaw: number;
  pitch: number;
};

type IconName =
  | "menu"
  | "map"
  | "chat"
  | "settings"
  | "sun"
  | "pin"
  | "book"
  | "volume"
  | "volumeOff"
  | "close"
  | "backpack"
  | "search"
  | "check"
  | "spark"
  | "lock"
  | "keyboard"
  | "mouse"
  | "moon"
  | "arrow";

const BLOCKS: Array<{
  type: BlockType;
  label: string;
  short: string;
  color: string;
  edge: string;
  glyph: string;
}> = [
  { type: "grass", label: "Grass Block", short: "Grass", color: "#74a94a", edge: "#4e7737", glyph: "▦" },
  { type: "dirt", label: "Dirt", short: "Dirt", color: "#8c593d", edge: "#603d2d", glyph: "▧" },
  { type: "stone", label: "Stone", short: "Stone", color: "#899399", edge: "#5d666d", glyph: "▨" },
  { type: "wood", label: "Oak Log", short: "Oak", color: "#a36b3d", edge: "#6d4328", glyph: "▥" },
  { type: "leaves", label: "Oak Leaves", short: "Leaves", color: "#4f8e4b", edge: "#32613a", glyph: "❖" },
  { type: "sand", label: "Sand", short: "Sand", color: "#d8b979", edge: "#a48753", glyph: "▪" },
  { type: "cobble", label: "Cobblestone", short: "Cobble", color: "#737b80", edge: "#4d5559", glyph: "▤" },
  { type: "glass", label: "Glass", short: "Glass", color: "#9dd7d2", edge: "#5b9f9b", glyph: "◇" },
];

const HOTBAR = ["grass", "dirt", "stone", "wood", "leaves", "sand", "cobble", "glass"] as BlockType[];
const WORLD_LIMIT = 11;
const INITIAL_COUNTS: Record<BlockType, number> = {
  grass: 46,
  dirt: 32,
  stone: 18,
  wood: 12,
  leaves: 20,
  sand: 24,
  cobble: 16,
  glass: 8,
};

function Icon({ name, size = 18, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.4-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
    settings: <><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3.1 1.3v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3.1-1.3l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-1.3-3.1h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 1.3-3.1l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3.1-1.3v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3.1 1.3l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 1.3 3.1h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-1.3 3.1Z" /></>,
    sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.4" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20M8 7h7M8 10h5" /></>,
    volume: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 9a5 5 0 0 1 0 6M19.5 6.5a9 9 0 0 1 0 11" /></>,
    volumeOff: <><path d="m4 9 4 0 5-4v14l-5-4H4V9Z" /><path d="m18 9-5 6M13 9l5 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    backpack: <><path d="M6 8V6a6 6 0 0 1 12 0v2M5 8h14l1 13H4L5 8Z" /><path d="M9 12h6M8 8v4a4 4 0 0 0 8 0V8" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    spark: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    keyboard: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10" /></>,
    mouse: <><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 3v6M9 7h6" /></>,
    moon: <><path d="M20 15.2A8 8 0 0 1 8.8 4 8.3 8.3 0 1 0 20 15.2Z" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function keyFor(x: number, y: number, z: number) {
  return `${x}|${y}|${z}`;
}

function blockInfo(type: BlockType) {
  return BLOCKS.find((block) => block.type === type) ?? BLOCKS[0];
}

function terrainHeight(x: number, z: number) {
  const wave = Math.sin(x * 0.62) * 0.68 + Math.cos(z * 0.48) * 0.5 + Math.sin((x + z) * 0.31) * 0.4;
  return Math.max(1, Math.min(4, Math.round(2.25 + wave)));
}

function createWorld() {
  const next: Record<string, Voxel> = {};
  for (let x = -WORLD_LIMIT; x <= WORLD_LIMIT; x += 1) {
    for (let z = -WORLD_LIMIT; z <= WORLD_LIMIT; z += 1) {
      const height = terrainHeight(x, z);
      const beach = Math.abs(x + 3) < 4 && Math.abs(z - 5) < 3;
      for (let y = 0; y < height; y += 1) {
        const type: BlockType = beach ? "sand" : y === height - 1 ? "grass" : y === 0 ? "stone" : "dirt";
        next[keyFor(x, y, z)] = { type, x, y, z };
      }
    }
  }

  const treeSpots = [
    { x: -6, z: -4 },
    { x: 4, z: -5 },
    { x: 7, z: 5 },
    { x: -7, z: 6 },
  ];
  treeSpots.forEach(({ x, z }) => {
    const base = terrainHeight(x, z);
    for (let y = base; y < base + 4; y += 1) {
      next[keyFor(x, y, z)] = { type: "wood", x, y, z };
    }
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        for (let dy = 2; dy <= 4; dy += 1) {
          if (Math.abs(dx) + Math.abs(dz) + (dy === 4 ? 1 : 0) < 4) {
            const leafX = x + dx;
            const leafZ = z + dz;
            const leafY = base + dy;
            next[keyFor(leafX, leafY, leafZ)] = { type: "leaves", x: leafX, y: leafY, z: leafZ };
          }
        }
      }
    }
  });

  return next;
}

function highestBlock(world: Record<string, Voxel>, x: number, z: number) {
  let highest = -1;
  for (let y = 0; y <= 12; y += 1) {
    if (world[keyFor(x, y, z)]) highest = y;
  }
  return highest;
}

function formatGameTime(minutes: number) {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = Math.floor(minutes % 60).toString().padStart(2, "0");
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<Record<string, Voxel>>(createWorld());
  const dragging = useRef({ active: false, moved: false, x: 0, y: 0 });
  const [world, setWorld] = useState(worldRef.current);
  const [player, setPlayer] = useState<Player>({ x: 0, z: 0, health: 8, hunger: 9, xp: 68 });
  const [camera, setCamera] = useState<Camera>({ yaw: 0.15, pitch: 0.34 });
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [counts, setCounts] = useState(INITIAL_COUNTS);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [gameMinutes, setGameMinutes] = useState(8 * 60 + 42);
  const [message, setMessage] = useState("Welcome back, builder");
  const selectedBlock = HOTBAR[selectedSlot];
  const selectedInfo = blockInfo(selectedBlock);

  const target = useMemo(() => {
    const dirX = Math.sin(camera.yaw);
    const dirZ = Math.cos(camera.yaw);
    const x = clamp(Math.round(player.x + dirX * 3.2), -WORLD_LIMIT, WORLD_LIMIT);
    const z = clamp(Math.round(player.z + dirZ * 3.2), -WORLD_LIMIT, WORLD_LIMIT);
    return { x, z, y: highestBlock(world, x, z) };
  }, [camera.yaw, player.x, player.z, world]);

  const flashMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage("Ready to build"), 1900);
  }, []);

  const movePlayer = useCallback((dx: number, dz: number) => {
    setPlayer((current) => ({
      ...current,
      x: clamp(current.x + dx, -WORLD_LIMIT + 1, WORLD_LIMIT - 1),
      z: clamp(current.z + dz, -WORLD_LIMIT + 1, WORLD_LIMIT - 1),
    }));
  }, []);

  const breakBlock = useCallback(() => {
    if (target.y < 0) return;
    const key = keyFor(target.x, target.y, target.z);
    const existing = worldRef.current[key];
    if (!existing || existing.type === "leaves") {
      flashMessage("Nothing solid to mine here");
      return;
    }
    const nextWorld = { ...worldRef.current };
    delete nextWorld[key];
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    setCounts((current) => ({ ...current, [existing.type]: current[existing.type] + 1 }));
    flashMessage(`Mined ${blockInfo(existing.type).label}`);
  }, [flashMessage, target]);

  const placeBlock = useCallback(() => {
    const y = target.y + 1;
    if (target.y < 0 || y > 12) return;
    if (counts[selectedBlock] <= 0) {
      flashMessage(`You're out of ${selectedInfo.short.toLowerCase()}`);
      return;
    }
    const key = keyFor(target.x, y, target.z);
    if (worldRef.current[key]) {
      flashMessage("That space is already occupied");
      return;
    }
    const nextWorld = { ...worldRef.current, [key]: { type: selectedBlock, x: target.x, y, z: target.z } };
    worldRef.current = nextWorld;
    setWorld(nextWorld);
    setCounts((current) => ({ ...current, [selectedBlock]: current[selectedBlock] - 1 }));
    flashMessage(`Placed ${selectedInfo.label}`);
  }, [counts, flashMessage, selectedBlock, selectedInfo, target]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOverlay(null);
        setPaused(false);
        return;
      }
      if ((event.target as HTMLElement)?.tagName === "INPUT") return;
      const key = event.key.toLowerCase();
      if (key === "i") setOverlay((current) => (current === "inventory" ? null : "inventory"));
      if (key === "m") setOverlay((current) => (current === "map" ? null : "map"));
      if (key === "b") placeBlock();
      if (key === "q") setCamera((current) => ({ ...current, yaw: current.yaw - 0.12 }));
      if (key === "e") setCamera((current) => ({ ...current, yaw: current.yaw + 0.12 }));
      if (key === "1" || key === "2" || key === "3" || key === "4" || key === "5" || key === "6" || key === "7" || key === "8") {
        setSelectedSlot(Number(key) - 1);
      }
      const step = event.shiftKey ? 0.72 : 0.42;
      if (key === "w" || key === "arrowup") movePlayer(Math.sin(camera.yaw) * step, Math.cos(camera.yaw) * step);
      if (key === "s" || key === "arrowdown") movePlayer(-Math.sin(camera.yaw) * step, -Math.cos(camera.yaw) * step);
      if (key === "a" || key === "arrowleft") movePlayer(Math.cos(camera.yaw) * step, -Math.sin(camera.yaw) * step);
      if (key === "d" || key === "arrowright") movePlayer(-Math.cos(camera.yaw) * step, Math.sin(camera.yaw) * step);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [camera.yaw, movePlayer, placeBlock]);

  useEffect(() => {
    if (paused || overlay) return;
    const timer = window.setInterval(() => setGameMinutes((current) => current + 0.38), 1000);
    return () => window.clearInterval(timer);
  }, [overlay, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animationFrame = 0;
    const start = performance.now();

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const time = (now - start) / 1000;
      const daylight = Math.max(0, Math.sin((gameMinutes / 1440) * Math.PI * 2 - 0.9));
      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, daylight > 0.35 ? "#70b7d5" : "#263a62");
      sky.addColorStop(0.56, daylight > 0.35 ? "#b9d7d8" : "#526b89");
      sky.addColorStop(1, daylight > 0.35 ? "#d8c79f" : "#303c58");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      const horizon = height * 0.43;
      const sunX = width * 0.77;
      const sunY = height * (daylight > 0.3 ? 0.18 : 0.3);
      context.globalAlpha = daylight > 0.3 ? 0.95 : 0.45;
      context.fillStyle = daylight > 0.3 ? "#fff2b1" : "#d6dcff";
      context.beginPath();
      context.arc(sunX, sunY, daylight > 0.3 ? 27 : 19, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;

      // Distant voxel hills keep the horizon grounded before the near blocks are drawn.
      context.fillStyle = daylight > 0.3 ? "#7b9b9a" : "#354765";
      context.beginPath();
      context.moveTo(0, horizon + 46);
      for (let x = 0; x <= width + 45; x += 45) {
        const y = horizon + 22 + Math.sin(x * 0.018) * 17 + Math.cos(x * 0.041) * 12;
        context.lineTo(x, y);
      }
      context.lineTo(width, horizon + 82);
      context.lineTo(0, horizon + 82);
      context.closePath();
      context.fill();

      const scale = Math.min(width, height) * 0.062;
      const cos = Math.cos(camera.yaw);
      const sin = Math.sin(camera.yaw);
      const pitch = camera.pitch;
      const project = (x: number, y: number, z: number) => {
        const dx = x - player.x;
        const dz = z - player.z;
        const rx = dx * cos - dz * sin;
        const rz = dx * sin + dz * cos;
        const perspective = 1 / Math.max(0.58, 1 + rz * 0.027);
        return {
          x: width * 0.5 + rx * scale * perspective,
          y: horizon + (rz * scale * 0.43 + (3.1 - y) * scale * (0.86 + pitch * 0.25)) * perspective,
          depth: rz + y * 0.32,
        };
      };
      const poly = (points: Array<{ x: number; y: number }>, fill: string, stroke = "rgba(28, 48, 43, .18)") => {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = stroke;
        context.lineWidth = 0.8;
        context.stroke();
      };

      const voxels = Object.values(world).filter((voxel) => Math.abs(voxel.x - player.x) < 13 && Math.abs(voxel.z - player.z) < 13);
      voxels.sort((a, b) => project(a.x + 0.5, a.y, a.z + 0.5).depth - project(b.x + 0.5, b.y, b.z + 0.5).depth);
      voxels.forEach((voxel) => {
        const p000 = project(voxel.x, voxel.y, voxel.z);
        const p100 = project(voxel.x + 1, voxel.y, voxel.z);
        const p110 = project(voxel.x + 1, voxel.y, voxel.z + 1);
        const p010 = project(voxel.x, voxel.y, voxel.z + 1);
        const p001 = project(voxel.x, voxel.y + 1, voxel.z);
        const p101 = project(voxel.x + 1, voxel.y + 1, voxel.z);
        const p111 = project(voxel.x + 1, voxel.y + 1, voxel.z + 1);
        const p011 = project(voxel.x, voxel.y + 1, voxel.z + 1);
        const info = blockInfo(voxel.type);
        const base = info.color;
        const side = info.edge;
        const top = voxel.type === "glass" ? "rgba(188, 239, 231, .52)" : voxel.type === "leaves" ? "#5fa052" : base;
        // Back-to-front faces. The slight texture marks sell the low-poly block style without image assets.
        poly([p001, p101, p111, p011], top, voxel.type === "glass" ? "rgba(221, 255, 247, .6)" : "rgba(44, 69, 50, .18)");
        poly([p000, p001, p011, p010], side);
        poly([p100, p110, p111, p101], voxel.type === "glass" ? "rgba(111, 181, 178, .5)" : side);
        if (voxel.type !== "leaves" && voxel.type !== "glass") {
          context.globalAlpha = 0.13;
          context.fillStyle = "#ffffff";
          context.fillRect(p001.x + 3, p001.y + 3, Math.max(2, Math.abs(p101.x - p001.x) * 0.16), 1.2);
          context.globalAlpha = 1;
        }
      });

      // Soft player shadow / marker, useful while exploring in the isometric view.
      const playerGround = project(player.x + 0.5, highestBlock(world, Math.round(player.x), Math.round(player.z)) + 0.04, player.z + 0.5);
      context.globalAlpha = 0.24;
      context.fillStyle = "#183b3e";
      context.beginPath();
      context.ellipse(playerGround.x, playerGround.y, 17, 6, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;

      if (target.y >= 0) {
        const tx = target.x;
        const ty = target.y;
        const tz = target.z;
        const a = project(tx, ty + 1.03, tz);
        const b = project(tx + 1, ty + 1.03, tz);
        const c = project(tx + 1, ty + 1.03, tz + 1);
        const d = project(tx, ty + 1.03, tz + 1);
        context.strokeStyle = "rgba(255, 246, 180, .92)";
        context.lineWidth = 2;
        context.setLineDash([5, 3]);
        context.beginPath();
        context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.lineTo(d.x, d.y); context.closePath();
        context.stroke();
        context.setLineDash([]);
      }

      // Floating dust and slow cloud strips add life without taking focus from the HUD.
      context.globalAlpha = 0.13;
      context.fillStyle = "#ffffff";
      for (let i = 0; i < 4; i += 1) {
        const cloudX = ((i * 260 + time * (8 + i * 2)) % (width + 260)) - 130;
        const cloudY = 76 + i * 45;
        context.beginPath();
        context.roundRect(cloudX, cloudY, 100 + i * 12, 10, 8);
        context.fill();
        context.beginPath();
        context.roundRect(cloudX + 22, cloudY - 10, 40, 16, 9);
        context.fill();
      }
      context.globalAlpha = 1;
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [camera, gameMinutes, player, target, world]);

  const closeOverlay = () => setOverlay(null);
  const togglePause = () => setPaused((current) => !current);

  return (
    <div className={`game-shell ${paused ? "is-paused" : ""}`}>
      <div className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div>
            <div className="brand-name">BLOCKHAVEN</div>
            <div className="brand-subtitle">SURVIVAL REALM <span className="live-dot" /> ONLINE</div>
          </div>
        </div>
        <div className="topbar-world">
          <div className="world-name">Pinefall Valley</div>
          <div className="world-meta"><span className="season-dot" /> Meadow biome <span className="meta-divider" /> Seed #80941</div>
        </div>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setOverlay("map")} aria-label="Open map"><Icon name="map" size={19} /></button>
          <button className="icon-button" onClick={() => setOverlay("chat")} aria-label="Open chat"><Icon name="chat" size={19} /><i className="notification-dot" /></button>
          <button className="icon-button" onClick={() => setOverlay("settings")} aria-label="Open settings"><Icon name="settings" size={19} /></button>
          <button className="pause-button" onClick={togglePause}>{paused ? "RESUME" : "PAUSE"}<span>{paused ? "▶" : "Ⅱ"}</span></button>
        </div>
      </div>

      <main className="game-stage">
        <canvas
          ref={canvasRef}
          className="world-canvas"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            dragging.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!dragging.current.active || paused || overlay) return;
            const dx = event.clientX - dragging.current.x;
            const dy = event.clientY - dragging.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) dragging.current.moved = true;
            if (dragging.current.moved) {
              setCamera((current) => ({ yaw: current.yaw + dx * 0.006, pitch: clamp(current.pitch - dy * 0.002, 0.12, 0.58) }));
              dragging.current.x = event.clientX;
              dragging.current.y = event.clientY;
            }
          }}
          onPointerUp={(event) => {
            if (!dragging.current.moved && !paused && !overlay) {
              if (event.button === 2) placeBlock();
              else if (event.button === 0) breakBlock();
            }
            dragging.current.active = false;
          }}
        />
        <div className="scene-vignette" />
        <div className="scene-grain" />

        <div className="scene-status left-status">
          <div className="status-eyebrow"><span className="status-pulse" /> EXPLORING</div>
          <div className="coordinates"><Icon name="pin" size={15} /> X {Math.round(player.x)} <b>·</b> Y {Math.max(1, target.y + 1)} <b>·</b> Z {Math.round(player.z)}</div>
          <div className="status-divider" />
          <div className="weather-line"><Icon name="sun" size={16} /> Clear skies <span>22°</span></div>
        </div>

        <div className="scene-status right-status">
          <div className="day-line"><Icon name="sun" size={16} /> DAY 08 <span>{formatGameTime(gameMinutes)}</span></div>
          <div className="objective"><span className="objective-check"><Icon name="check" size={12} /></span><span><b>Build a shelter</b><small>Collect 32 more blocks</small></span></div>
        </div>

        <div className="center-reticle" aria-hidden="true"><span /><i /><b /><em /></div>
        <div className="toast-message"><span className="toast-icon"><Icon name="spark" size={13} /></span>{message}</div>

        <div className="control-hints">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span>
          <span><kbd>DRAG</kbd> Look around</span>
          <span><kbd>LMB</kbd> Mine</span>
          <span><kbd>RMB</kbd> Place</span>
        </div>

        <div className="bottom-hud">
          <div className="player-vitals">
            <div className="vital-label"><span>VITALS</span><b>{player.health * 10}%</b></div>
            <div className="hearts" aria-label={`${player.health} hearts`}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={index < player.health ? "heart full" : "heart"}>♥</span>)}</div>
            <div className="hunger-row"><span className="vital-label"><span>ENERGY</span><b>{player.hunger * 10}%</b></span><div className="hunger-bar"><i style={{ width: `${player.hunger * 10}%` }} /></div></div>
          </div>
          <div className="hotbar-wrap">
            <div className="xp-row"><span>LVL 12</span><div className="xp-track"><i style={{ width: `${player.xp}%` }} /></div><span>{player.xp}/100 XP</span></div>
            <div className="hotbar" role="toolbar" aria-label="Hotbar">
              {HOTBAR.map((type, index) => {
                const info = blockInfo(type);
                return <button key={type} className={`hotbar-slot ${selectedSlot === index ? "selected" : ""}`} onClick={() => setSelectedSlot(index)} aria-label={`Select ${info.label}`}>
                  <span className={`block-icon block-${type}`}><i>{info.glyph}</i></span>
                  <small>{index + 1}</small>
                  <strong>{counts[type]}</strong>
                </button>;
              })}
            </div>
            <div className="selected-name"><span className="selected-swatch" style={{ background: selectedInfo.color }} />{selectedInfo.label}<b>·</b><span>Press B to place</span></div>
          </div>
          <div className="hud-actions">
            <button className={`hud-action ${overlay === "inventory" ? "active" : ""}`} onClick={() => setOverlay(overlay === "inventory" ? null : "inventory")}><Icon name="backpack" size={18} /><span>Inventory</span><kbd>I</kbd></button>
            <button className={`hud-action ${muted ? "muted" : ""}`} onClick={() => setMuted((current) => !current)}><Icon name={muted ? "volumeOff" : "volume"} size={18} /><span>{muted ? "Muted" : "Sound on"}</span></button>
          </div>
        </div>

        {paused && <div className="pause-overlay"><div className="pause-card"><div className="pause-kicker"><span /> REALM PAUSED</div><h1>Take a breather.</h1><p>Your world is waiting right where you left it.</p><button className="primary-button" onClick={togglePause}>RETURN TO WORLD <Icon name="arrow" size={16} /></button><button className="text-button" onClick={() => setOverlay("settings")}>Game settings</button></div></div>}

        {overlay && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeOverlay(); }}>
          <section className={`game-panel panel-${overlay}`}>
            <header className="panel-header">
              <div><div className="panel-kicker">PINEFALL VALLEY <span /> {overlay === "inventory" ? "BACKPACK" : overlay.toUpperCase()}</div><h2>{overlay === "inventory" ? "Your inventory" : overlay === "map" ? "Valley map" : overlay === "settings" ? "Game settings" : "Campfire chat"}</h2></div>
              <button className="close-button" onClick={closeOverlay} aria-label="Close"><Icon name="close" size={20} /></button>
            </header>
            {overlay === "inventory" && <InventoryPanel counts={counts} selectedBlock={selectedBlock} onSelect={(type) => { const slot = HOTBAR.indexOf(type); if (slot >= 0) setSelectedSlot(slot); closeOverlay(); }} />}
            {overlay === "map" && <MapPanel player={player} target={target} />}
            {overlay === "settings" && <SettingsPanel muted={muted} setMuted={setMuted} />}
            {overlay === "chat" && <ChatPanel />}
          </section>
        </div>}
      </main>
    </div>
  );
}

function InventoryPanel({ counts, selectedBlock, onSelect }: { counts: Record<BlockType, number>; selectedBlock: BlockType; onSelect: (type: BlockType) => void }) {
  const [filter, setFilter] = useState("");
  const filtered = BLOCKS.filter((block) => block.label.toLowerCase().includes(filter.toLowerCase()));
  return <div className="inventory-content">
    <div className="inventory-summary"><div className="avatar-badge">B</div><div><b>Builder</b><span>Explorer rank <strong>12</strong></span></div><div className="armor-slots"><i /><i /><i /><i /></div></div>
    <div className="inventory-toolbar"><span>8 / 36 slots used</span><label><Icon name="search" size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search items" /></label></div>
    <div className="inventory-grid">{filtered.map((block) => <button key={block.type} className={`inventory-item ${block.type === selectedBlock ? "active" : ""}`} onClick={() => onSelect(block.type)}><span className={`block-icon block-${block.type}`}><i>{block.glyph}</i></span><b>{block.label}</b><small>{counts[block.type]} in bag</small>{block.type === selectedBlock && <em><Icon name="check" size={12} /></em>}</button>)}</div>
    <div className="inventory-tip"><Icon name="spark" size={15} /><span><b>Quick tip</b> Drag your view to look around. Use the number keys to switch blocks fast.</span></div>
  </div>;
}

function MapPanel({ player, target }: { player: Player; target: { x: number; z: number } }) {
  const points = [
    { x: 30, y: 28, label: "Old oak", icon: "✦" },
    { x: 66, y: 40, label: "You", icon: "◆", user: true },
    { x: 42, y: 70, label: "River bend", icon: "≈" },
    { x: 76, y: 74, label: "Cave", icon: "◈" },
  ];
  return <div className="map-content"><div className="map-legend"><span><i className="legend-you" /> You are here</span><span><i className="legend-point" /> Landmark</span><span><i className="legend-water" /> River</span></div><div className="map-canvas"><div className="map-river" /><div className="map-grid-lines" />{points.map((point) => <div key={point.label} className={`map-point ${point.user ? "user-point" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }}><b>{point.icon}</b><span>{point.label}</span></div>)}<div className="map-compass">N</div></div><div className="map-footer"><div><Icon name="pin" size={15} /><span>Current position <b>X {Math.round(player.x)}, Z {Math.round(player.z)}</b></span></div><div><Icon name="spark" size={15} /><span>Next objective <b>Build a shelter</b></span></div><span className="map-target">Target: {target.x}, {target.z}</span></div></div>;
}

function SettingsPanel({ muted, setMuted }: { muted: boolean; setMuted: (muted: boolean) => void }) {
  const [shadows, setShadows] = useState(true);
  const [sensitivity, setSensitivity] = useState(64);
  return <div className="settings-content"><div className="settings-section"><p className="settings-title">GAMEPLAY</p><SettingRow icon="mouse" label="Look sensitivity" detail="Adjust camera movement"><input className="range-input" type="range" min="20" max="100" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} /><b className="range-value">{sensitivity}%</b></SettingRow><SettingRow icon="sun" label="Dynamic shadows" detail="Ambient world lighting"><button className={`toggle ${shadows ? "on" : ""}`} onClick={() => setShadows((current) => !current)}><i /></button></SettingRow></div><div className="settings-section"><p className="settings-title">AUDIO</p><SettingRow icon={muted ? "volumeOff" : "volume"} label="World sounds" detail="Nature, footsteps and blocks"><button className={`toggle ${!muted ? "on" : ""}`} onClick={() => setMuted(!muted)}><i /></button></SettingRow><SettingRow icon="spark" label="Ambient music" detail="Calm overworld soundtrack"><span className="coming-soon">COMING SOON</span></SettingRow></div><div className="settings-section controls-section"><p className="settings-title">CONTROLS</p><div className="control-row"><span><Icon name="keyboard" size={16} /> Movement</span><b><kbd>W A S D</kbd></b></div><div className="control-row"><span><Icon name="mouse" size={16} /> Mine / place</span><b><kbd>LMB</kbd><kbd>RMB</kbd></b></div></div><div className="settings-footer"><span>Blockhaven v0.8.4</span><span>Made for the Overworld <Icon name="spark" size={12} /></span></div></div>;
}

function SettingRow({ icon, label, detail, children }: { icon: IconName; label: string; detail: string; children: ReactNode }) {
  return <div className="setting-row"><div className="setting-icon"><Icon name={icon} size={17} /></div><div className="setting-copy"><b>{label}</b><span>{detail}</span></div>{children}</div>;
}

function ChatPanel() {
  return <div className="chat-content"><div className="chat-status"><span className="status-pulse" /> 3 explorers in this realm</div><div className="chat-messages"><div className="chat-message"><span className="chat-avatar moss">M</span><p><b>MossyMira <small>08:39</small></b>Has anyone found the river village yet?</p></div><div className="chat-message"><span className="chat-avatar ember">E</span><p><b>EmberFox <small>08:40</small></b>Not yet, but I marked a cave near the birch grove.</p></div><div className="chat-message yours"><span className="chat-avatar you">B</span><p><b>You <small>08:41</small></b>I’ll scout south after I finish this shelter.</p></div></div><label className="chat-input"><input placeholder="Send a message..." /><button><Icon name="arrow" size={16} /></button></label></div>;
}

export { App };
