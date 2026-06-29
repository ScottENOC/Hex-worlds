#!/usr/bin/env node
// Procedural map generator for scenarios/custom/
// Produces map.json, units.json, scenario.json

const fs = require("fs");
const path = require("path");

// ── Grid dimensions ──────────────────────────────────────────────────────────
const ROWS = 40;
const COLS = 60;

// ── Simple FBM noise (no external deps) ─────────────────────────────────────
function hash(x, y, seed) {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (
    hash(ix,   iy,   seed) * (1-ux) * (1-uy) +
    hash(ix+1, iy,   seed) *   ux   * (1-uy) +
    hash(ix,   iy+1, seed) * (1-ux) *   uy   +
    hash(ix+1, iy+1, seed) *   ux   *   uy
  );
}

function fbm(x, y, seed, octaves=5) {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v   += smoothNoise(x * freq, y * freq, seed + i * 1000) * amp;
    max += amp;
    amp  *= 0.5;
    freq *= 2;
  }
  return v / max;
}

// ── Terrain from noise ────────────────────────────────────────────────────────
const SEED = Math.floor(Math.random() * 100000);
console.log(`Seed: ${SEED}`);

// Scale so map spans roughly 4 noise "periods"
const SX = 4 / COLS;
const SY = 4 / ROWS;

function noiseAt(row, col) {
  return fbm(col * SX, row * SY, SEED);
}

// Second noise for moisture / variation
function moistureAt(row, col) {
  return fbm(col * SX, row * SY, SEED + 99999);
}

function classifyTerrain(n, m) {
  if (n < 0.25)  return "water";   // ocean / lake — very clustered low values
  if (n < 0.35)  return "marsh";
  if (n < 0.50)  return "plains";
  if (n < 0.63)  return m > 0.5 ? "forest" : "plains";
  if (n < 0.75)  return "hills";
  return "mountain";
}

// ── Build raw grid ────────────────────────────────────────────────────────────
const grid = {}; // key "r,c" → { row, col, terrain, elevation }

for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const n = noiseAt(r, c);
    const m = moistureAt(r, c);
    grid[`${r},${c}`] = {
      row: r, col: c,
      noise: n,
      terrain: classifyTerrain(n, m),
    };
  }
}

// ── Hex adjacency (1-indexed, even rows shifted right) ───────────────────────
// Even row (r % 2 === 0): side→[dr,dc] = 0:(0,1) 1:(1,1) 2:(1,0) 3:(0,-1) 4:(-1,0) 5:(-1,1)
// Odd  row (r % 2 === 1): side→[dr,dc] = 0:(0,1) 1:(1,0) 2:(1,-1) 3:(0,-1) 4:(-1,-1) 5:(-1,0)
function neighbors(r, c) {
  const even = r % 2 === 0;
  const dirs = even
    ? [[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]]
    : [[0,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0]];
  return dirs.map(([dr,dc], side) => ({ r: r+dr, c: c+dc, side }));
}

// ── River tracing ─────────────────────────────────────────────────────────────
// From each mountain/hill hex, trace downhill to water; mark river sides.
const riverSides = {}; // "r,c" → Set of sides

function addRiver(r, c, side) {
  const k = `${r},${c}`;
  if (!riverSides[k]) riverSides[k] = new Set();
  riverSides[k].add(side);
}

function traceRiver(startR, startC) {
  let r = startR, c = startC;
  const visited = new Set();
  for (let step = 0; step < 40; step++) {
    const key = `${r},${c}`;
    if (visited.has(key)) break;
    visited.add(key);
    const t = grid[key]?.terrain;
    if (t === "water") break;

    // Pick neighbor with lowest noise (steepest descent)
    const nbs = neighbors(r, c).filter(n => {
      const nk = `${n.r},${n.c}`;
      return grid[nk] && n.r >= 1 && n.r <= ROWS && n.c >= 1 && n.c <= COLS;
    });
    if (!nbs.length) break;
    nbs.sort((a, b) => (grid[`${a.r},${a.c}`].noise) - (grid[`${b.r},${b.c}`].noise));
    const best = nbs[0];
    if (grid[`${best.r},${best.c}`].noise >= grid[key].noise && t !== "water") break;

    const exitSide = best.side;
    const enterSide = (exitSide + 3) % 6;
    addRiver(r, c, exitSide);
    addRiver(best.r, best.c, enterSide);
    r = best.r; c = best.c;
  }
}

// Start rivers from mountain and some hill tiles (≈ 30% of hills)
const rng = () => hash(Math.random()*1e6|0, Math.random()*1e6|0, SEED);
for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const t = grid[`${r},${c}`].terrain;
    if (t === "mountain") traceRiver(r, c);
    if (t === "hills" && hash(r, c, SEED+42) < 0.3) traceRiver(r, c);
  }
}

// ── Choose faction capitals ───────────────────────────────────────────────────
// veldra in top-left quadrant, keth in bottom-right quadrant
// Pick a plains/hills tile not on the border
function pickCapital(rMin, rMax, cMin, cMax) {
  const candidates = [];
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const t = grid[`${r},${c}`]?.terrain;
      if (t === "plains" || t === "hills") candidates.push([r, c]);
    }
  }
  if (!candidates.length) return [Math.floor((rMin+rMax)/2), Math.floor((cMin+cMax)/2)];
  return candidates[Math.floor(hash(rMin, cMin, SEED+777) * candidates.length)];
}

const [vR, vC] = pickCapital(2, Math.floor(ROWS*0.45), 2, Math.floor(COLS*0.45));
const [kR, kC] = pickCapital(Math.floor(ROWS*0.55), ROWS-1, Math.floor(COLS*0.55), COLS-1);

// Mark capitals as their faction's territory
grid[`${vR},${vC}`].faction = "veldra";
grid[`${vR},${vC}`].isCapital = true;
grid[`${vR},${vC}`].isFortress = true;
grid[`${vR},${vC}`].fortressStrength = 1;
grid[`${vR},${vC}`].name = "Veldra Keep";

grid[`${kR},${kC}`].faction = "keth";
grid[`${kR},${kC}`].isCapital = true;
grid[`${kR},${kC}`].isFortress = true;
grid[`${kR},${kC}`].fortressStrength = 1;
grid[`${kR},${kC}`].name = "Keth Hold";

// ── Assemble tile list ────────────────────────────────────────────────────────
const tiles = [];
for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const g = grid[`${r},${c}`];
    const rivers = riverSides[`${r},${c}`] ? [...riverSides[`${r},${c}`]] : [];

    const tile = {
      row: r,
      col: c,
      faction: g.faction || "none",
      terrain: g.terrain === "water" ? ["plains"] : [g.terrain],
      rivers,
    };

    if (g.terrain === "water") tile.lakes = [0,1,2,3,4,5];
    if (g.name)           tile.name = g.name;
    if (g.isFortress)     { tile.isFortress = true; tile.fortressStrength = g.fortressStrength; }
    if (g.isCapital)      tile.isCapital = true;

    tiles.push(tile);
  }
}

// ── scenario.json ─────────────────────────────────────────────────────────────
const scenario = {
  id: "custom",
  name: "Custom (Procedural)",
  factions: {
    veldra: { color: "#CC3333", playable: true, display: "Veldra" },
    keth:   { color: "#3366CC", playable: true, display: "Keth" }
  },
  neutralColor: "#d2b48c",
  rules: {
    maxTurns: 20,
    mercenaryLandCount: 13,
    mercenaryFleetCount: 2,
    barbarianPoolSize: 43,
    canSeizeTerrain: false,
    tileUpgrades: false,
    resources: false,
    dynamicFortresses: false
  }
};

// ── units.json — leader at capital for each faction ──────────────────────────
const startingUnits = [
  {
    faction: "veldra", row: vR, col: vC,
    moveSpeed: 7, isLeader: true,
    combatStrength: 0, siegeStrength: 0
  },
  {
    faction: "keth", row: kR, col: kC,
    moveSpeed: 7, isLeader: true,
    combatStrength: 0, siegeStrength: 0
  }
];

// ── Write files ───────────────────────────────────────────────────────────────
const dir = path.join(__dirname, "scenarios", "custom");
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, "scenario.json"), JSON.stringify(scenario, null, 2));
fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify(tiles, null, 2));
fs.writeFileSync(path.join(dir, "units.json"), JSON.stringify(startingUnits, null, 2));

console.log(`Generated ${tiles.length} tiles`);
console.log(`Veldra capital: ${vR},${vC}`);
console.log(`Keth capital:   ${kR},${kC}`);
console.log(`Written to ${dir}`);
