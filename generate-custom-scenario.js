#!/usr/bin/env node
// Procedural map generator for scenarios/custom/
// Produces map.json, units.json, scenario.json

const fs = require("fs");
const path = require("path");

// ── Grid dimensions ──────────────────────────────────────────────────────────
const ROWS = 40;
const COLS = 60;

// ── Target terrain distribution ───────────────────────────────────────────────
const WATER_PCT   = 0.25;  // full lake tiles
const MARSH_PCT   = 0.08;
const PLAINS_PCT  = 0.30;
const FOREST_PCT  = 0.15;
const HILLS_PCT   = 0.14;
// remainder → mountain

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

// ── Generate noise values for all tiles ──────────────────────────────────────
const SEED = Math.floor(Math.random() * 100000);
console.log(`Seed: ${SEED}`);

const SX = 4 / COLS;
const SY = 4 / ROWS;

// Collect all noise values then find percentile thresholds so we hit exact %s
const rawNoise = {};
const rawMoisture = {};
const allNoise = [];

for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const n = fbm(c * SX, r * SY, SEED);
    const m = fbm(c * SX, r * SY, SEED + 99999);
    rawNoise[`${r},${c}`]    = n;
    rawMoisture[`${r},${c}`] = m;
    allNoise.push(n);
  }
}

// Sort to derive percentile thresholds
const sorted = [...allNoise].sort((a, b) => a - b);
const total = sorted.length;
const tWater  = sorted[Math.floor(total * WATER_PCT) - 1];
const tMarsh  = sorted[Math.floor(total * (WATER_PCT + MARSH_PCT)) - 1];
const tPlains = sorted[Math.floor(total * (WATER_PCT + MARSH_PCT + PLAINS_PCT)) - 1];
const tForest = sorted[Math.floor(total * (WATER_PCT + MARSH_PCT + PLAINS_PCT + FOREST_PCT)) - 1];
const tHills  = sorted[Math.floor(total * (WATER_PCT + MARSH_PCT + PLAINS_PCT + FOREST_PCT + HILLS_PCT)) - 1];

function classifyTerrain(n, m) {
  if (n <= tWater)  return "water";
  if (n <= tMarsh)  return "marsh";
  if (n <= tPlains) return "plains";
  if (n <= tForest) return m > 0.5 ? "forest" : "plains";
  if (n <= tHills)  return "hills";
  return "mountain";
}

// ── Build raw grid ────────────────────────────────────────────────────────────
const grid = {};

for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const key = `${r},${c}`;
    const n = rawNoise[key];
    const m = rawMoisture[key];
    grid[key] = { row: r, col: c, noise: n, terrain: classifyTerrain(n, m) };
  }
}

// ── Hex adjacency (1-indexed, even rows shifted right) ───────────────────────
// Even row: side→[dr,dc] = 0:(0,1) 1:(1,1) 2:(1,0) 3:(0,-1) 4:(-1,0) 5:(-1,1)
// Odd  row: side→[dr,dc] = 0:(0,1) 1:(1,0) 2:(1,-1) 3:(0,-1) 4:(-1,-1) 5:(-1,0)
function neighbors(r, c) {
  const even = r % 2 === 0;
  const dirs = even
    ? [[0,1],[1,1],[1,0],[0,-1],[-1,0],[-1,1]]
    : [[0,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0]];
  return dirs.map(([dr,dc], side) => ({ r: r+dr, c: c+dc, side }));
}

function inBounds(r, c) {
  return r >= 1 && r <= ROWS && c >= 1 && c <= COLS;
}

// ── Build lake-side sets: full water + coastal slices ─────────────────────────
// lakeSides["r,c"] = Set of sides that have a lake edge on this tile
const lakeSides = {};

for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const key = `${r},${c}`;
    if (grid[key].terrain === "water") {
      // Full water tile — all 6 sides are lake
      lakeSides[key] = new Set([0,1,2,3,4,5]);
    }
  }
}

// For every non-water tile, add a lake slice on each side that faces a water tile
for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const key = `${r},${c}`;
    if (grid[key].terrain === "water") continue;
    for (const nb of neighbors(r, c)) {
      if (!inBounds(nb.r, nb.c)) continue;
      if (grid[`${nb.r},${nb.c}`]?.terrain === "water") {
        if (!lakeSides[key]) lakeSides[key] = new Set();
        lakeSides[key].add(nb.side);
      }
    }
  }
}

// ── River tracing ─────────────────────────────────────────────────────────────
const riverSides = {};

function addRiver(r, c, side) {
  // Skip if this side is already a lake edge
  const lk = lakeSides[`${r},${c}`];
  if (lk && lk.has(side)) return;
  const k = `${r},${c}`;
  if (!riverSides[k]) riverSides[k] = new Set();
  riverSides[k].add(side);
}

function traceRiver(startR, startC) {
  let r = startR, c = startC;
  const visited = new Set();
  for (let step = 0; step < 60; step++) {
    const key = `${r},${c}`;
    if (visited.has(key)) break;
    visited.add(key);
    const t = grid[key]?.terrain;
    if (t === "water") break;

    const nbs = neighbors(r, c).filter(nb => inBounds(nb.r, nb.c));
    if (!nbs.length) break;
    nbs.sort((a, b) => rawNoise[`${a.r},${a.c}`] - rawNoise[`${b.r},${b.c}`]);
    const best = nbs[0];
    if (rawNoise[`${best.r},${best.c}`] >= rawNoise[key]) break;

    const exitSide = best.side;
    const enterSide = (exitSide + 3) % 6;
    addRiver(r, c, exitSide);
    addRiver(best.r, best.c, enterSide);
    r = best.r; c = best.c;
  }
}

for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const t = grid[`${r},${c}`].terrain;
    if (t === "mountain") traceRiver(r, c);
    if (t === "hills" && hash(r, c, SEED+42) < 0.3) traceRiver(r, c);
  }
}

// ── Choose faction capitals ───────────────────────────────────────────────────
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
let waterCount = 0, coastCount = 0;

for (let r = 1; r <= ROWS; r++) {
  for (let c = 1; c <= COLS; c++) {
    const key = `${r},${c}`;
    const g = grid[key];
    const isWater = g.terrain === "water";

    const lakes = lakeSides[key] ? [...lakeSides[key]].sort() : [];
    // Rivers: exclude any side that's a lake side
    const lakeSet = lakeSides[key] || new Set();
    const rivers = riverSides[key]
      ? [...riverSides[key]].filter(s => !lakeSet.has(s))
      : [];

    const tile = {
      row: r,
      col: c,
      faction: g.faction || "none",
      terrain: isWater ? ["plains"] : [g.terrain],
      rivers,
    };

    if (lakes.length) tile.lakes = lakes;
    if (g.name)       tile.name = g.name;
    if (g.isFortress) { tile.isFortress = true; tile.fortressStrength = g.fortressStrength; }
    if (g.isCapital)  tile.isCapital = true;

    if (isWater) waterCount++;
    else if (lakes.length) coastCount++;

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

// ── units.json ────────────────────────────────────────────────────────────────
const startingUnits = [
  { faction: "veldra", row: vR, col: vC, moveSpeed: 7, isLeader: true, combatStrength: 0, siegeStrength: 0 },
  { faction: "keth",   row: kR, col: kC, moveSpeed: 7, isLeader: true, combatStrength: 0, siegeStrength: 0 }
];

// ── Write files ───────────────────────────────────────────────────────────────
const dir = path.join(__dirname, "scenarios", "custom");
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, "scenario.json"), JSON.stringify(scenario, null, 2));
fs.writeFileSync(path.join(dir, "map.json"), JSON.stringify(tiles, null, 2));
fs.writeFileSync(path.join(dir, "units.json"), JSON.stringify(startingUnits, null, 2));

console.log(`Generated ${tiles.length} tiles`);
console.log(`  Full water: ${waterCount} (${(waterCount/tiles.length*100).toFixed(1)}%)`);
console.log(`  Coastal (partial lake slices): ${coastCount}`);
console.log(`Veldra capital: ${vR},${vC}`);
console.log(`Keth capital:   ${kR},${kC}`);
console.log(`Written to ${dir}`);
