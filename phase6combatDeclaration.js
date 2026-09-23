// Combat declaration UI is handled by drawing.js hex-click handler, which pushes
// { fromHex, targetHex } objects to declaredCombats[].  The helpers below turn
// repeated declarations against the same target into one multi-hex combat.

function clearCombatDeclarations() {
  declaredCombats = [];
  highlightedTilesByType.combat = [];
}

function sameHex(a, b) {
  return !!a && !!b && a.row === b.row && a.col === b.col;
}

// Remove and return the next combat from the queue, merging every declaration
// against the same defending hex. This lets the existing tap UI support attacks
// from several adjacent hexes without adding another modal/declaration step.
function mergeNextCombatDeclarations(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return null;

  const first = queue.shift();
  const targetHex = { ...first.targetHex };
  const declarations = [first];

  for (let i = queue.length - 1; i >= 0; i--) {
    if (sameHex(queue[i].targetHex, targetHex)) {
      declarations.push(queue[i]);
      queue.splice(i, 1);
    }
  }

  const seenOrigins = new Set();
  const fromHexes = [];
  for (const declaration of declarations) {
    const key = `${declaration.fromHex.row},${declaration.fromHex.col}`;
    if (seenOrigins.has(key)) continue;
    seenOrigins.add(key);
    fromHexes.push({ ...declaration.fromHex });
  }

  return { targetHex, fromHexes, declarations };
}

// Parse the compact advance prompt used after a vacated defence. Accepts
// "all", "none", or comma/space separated 1-based unit numbers.
function parseAdvanceSelection(input, count) {
  const text = String(input ?? "").trim().toLowerCase();
  if (!text || text === "none" || text === "0") return [];
  if (text === "all" || text === "a") return Array.from({ length: count }, (_, i) => i);

  const result = [];
  const seen = new Set();
  for (const part of text.split(/[\s,]+/)) {
    const index = Number.parseInt(part, 10) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) continue;
    seen.add(index);
    result.push(index);
  }
  return result;
}

if (typeof window !== "undefined") {
  window.mergeNextCombatDeclarations = mergeNextCombatDeclarations;
  window.parseAdvanceSelection = parseAdvanceSelection;
}
