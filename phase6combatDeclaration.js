// Combat declaration helpers. Divine Right permits individual counters from one
// stack to be allocated among different adjacent combats. Declarations therefore
// carry stable combat unit IDs rather than implicitly committing an entire hex.

function clearCombatDeclarations() {
  declaredCombats = [];
  highlightedTilesByType.combat = [];
}

function sameHex(a, b) {
  return !!a && !!b && a.row === b.row && a.col === b.col;
}

function ensureCombatUnitIds(unitList = units) {
  let next = 1;
  const used = new Set();
  for (const unit of unitList || []) {
    if (unit?.combatId) {
      used.add(String(unit.combatId));
      const match = /^u(\d+)$/.exec(String(unit.combatId));
      if (match) next = Math.max(next, Number(match[1]) + 1);
    }
  }
  for (const unit of unitList || []) {
    if (!unit || unit.combatId) continue;
    while (used.has(`u${next}`)) next++;
    unit.combatId = `u${next++}`;
    used.add(unit.combatId);
  }
  return unitList;
}

function allocatedCombatUnitIds(queue = declaredCombats) {
  const ids = new Set();
  for (const declaration of queue || []) {
    for (const id of declaration.unitIds || []) ids.add(String(id));
  }
  return ids;
}

function availableCombatUnitsAt(fromHex, faction, queue = declaredCombats) {
  ensureCombatUnitIds(units);
  const allocated = allocatedCombatUnitIds(queue);
  return units.filter(u =>
    u.row === fromHex.row && u.col === fromHex.col &&
    u.faction === faction && !allocated.has(String(u.combatId))
  );
}

function combatUnitLabel(unit) {
  const name = unit.name || (unit.originalFaction && unit.originalFaction !== unit.faction
    ? `${unit.originalFaction} allied troop`
    : `${unit.faction || "unknown"} troop`);
  const role = unit.isLeader && !unit.isEatersOfWisdom ? "leader" : `combat ${unit.combatStrength || 0}`;
  return `${name} (${role})`;
}

// Compact parser shared by combat allocation and post-combat advance prompts.
// Accepts "all", "none", or comma/space separated 1-based unit numbers.
function parseUnitSelection(input, count, defaultAll = false) {
  const text = String(input ?? "").trim().toLowerCase();
  if (!text) return defaultAll ? Array.from({ length: count }, (_, i) => i) : [];
  if (text === "none" || text === "0") return [];
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

function chooseCombatUnitsForDeclaration(fromHex, targetHex, faction, preferredUnit = null) {
  const available = availableCombatUnitsAt(fromHex, faction);
  if (!available.length) return [];

  // Put the counter the player tapped first in the list so a single-counter
  // allocation remains quick on mobile.
  if (preferredUnit) {
    const idx = available.indexOf(preferredUnit);
    if (idx > 0) {
      available.splice(idx, 1);
      available.unshift(preferredUnit);
    }
  }

  if (available.length === 1) return [available[0]];

  const menu = available.map((u, i) => `${i + 1}. ${combatUnitLabel(u)}`).join("\n");
  const answer = prompt(
    `Allocate attackers from (${fromHex.row},${fromHex.col}) to (${targetHex.row},${targetHex.col}).\n\n` +
    `${menu}\n\nEnter "all" or unit numbers separated by commas. Press OK with the box empty for all.`
  );
  if (answer === null) return [];
  return parseUnitSelection(answer, available.length, true).map(i => available[i]).filter(Boolean);
}

function addCombatDeclaration(fromHex, targetHex, selectedUnits) {
  if (!selectedUnits?.length) return null;
  ensureCombatUnitIds(selectedUnits);
  const ids = selectedUnits.map(u => String(u.combatId));

  // Multiple allocations from the same origin to the same target are folded
  // together, while the same origin may still allocate other counters elsewhere.
  let declaration = declaredCombats.find(c => sameHex(c.fromHex, fromHex) && sameHex(c.targetHex, targetHex));
  if (!declaration) {
    declaration = { fromHex: { ...fromHex }, targetHex: { ...targetHex }, unitIds: [] };
    declaredCombats.push(declaration);
  }
  const existing = new Set((declaration.unitIds || []).map(String));
  for (const id of ids) if (!existing.has(id)) declaration.unitIds.push(id);
  return declaration;
}

// Remove and return the next combat from the queue, merging every declaration
// against the same defending hex. Several origins can therefore contribute to a
// single combat, while declarations retain the exact allocated counters.
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
  const unitIds = [];
  const seenUnits = new Set();
  for (const declaration of declarations) {
    const key = `${declaration.fromHex.row},${declaration.fromHex.col}`;
    if (!seenOrigins.has(key)) {
      seenOrigins.add(key);
      fromHexes.push({ ...declaration.fromHex });
    }
    for (const id of declaration.unitIds || []) {
      const text = String(id);
      if (seenUnits.has(text)) continue;
      seenUnits.add(text);
      unitIds.push(text);
    }
  }

  return { targetHex, fromHexes, declarations, unitIds };
}

function parseAdvanceSelection(input, count) {
  return parseUnitSelection(input, count, false);
}

if (typeof window !== "undefined") {
  window.ensureCombatUnitIds = ensureCombatUnitIds;
  window.allocatedCombatUnitIds = allocatedCombatUnitIds;
  window.availableCombatUnitsAt = availableCombatUnitsAt;
  window.chooseCombatUnitsForDeclaration = chooseCombatUnitsForDeclaration;
  window.addCombatDeclaration = addCombatDeclaration;
  window.mergeNextCombatDeclarations = mergeNextCombatDeclarations;
  window.parseAdvanceSelection = parseAdvanceSelection;
  window.parseUnitSelection = parseUnitSelection;
}
