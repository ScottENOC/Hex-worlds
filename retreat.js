// retreat.js — Retreat Before Combat and Lepers mechanics

// Retreat threshold: minimum die roll needed to successfully retreat before combat.
// Barbarian: 5+, Human: 4+, Non-Human (Elf/Dwarf/Goblin/Troll): 3+, Magical: 2+
function getRetreatThreshold(unit) {
  if (unit.isMagical || unit.isEatersOfWisdom || unit.isBlackHand || unit.isGhostRiders) return 2;
  if (unit.isBarbarian) return 5;
  // Non-human factions
  const nonHumanFactions = new Set(["neuth", "dwarfland", "zorn", "trolls", "eaters", "blackhand"]);
  if (nonHumanFactions.has(unit.faction)) return 3;
  return 4; // human default
}

// Attempt a retreat before combat for a stack of defenders.
// Returns true if the stack successfully retreated.
function attemptRetreatBeforeCombat(defenders, targetHex) {
  if (!defenders.length) return false;

  // The unit with the HIGHEST threshold (hardest to retreat) tests first.
  const sorted = [...defenders].sort((a, b) => getRetreatThreshold(b) - getRetreatThreshold(a));
  const hardest = sorted[0];
  const threshold = getRetreatThreshold(hardest);

  const roll = Math.ceil(Math.random() * 6);
  const success = roll >= threshold;

  if (!success) {
    alert(
      `Retreat attempt for ${hardest.faction}: needs ${threshold}+, rolled ${roll} — FAIL. Must stand and fight.`
    );
    return false;
  }

  alert(`Retreat attempt for ${hardest.faction}: needs ${threshold}+, rolled ${roll} — SUCCESS!`);

  // Find a safe adjacent hex (not occupied by enemy)
  const adj = getAdjacentCoords(targetHex.row, targetHex.col);
  const defFaction = defenders[0].faction;
  const safeHex = adj.find(([r, c]) => {
    return !units.some(u => u.row === r && u.col === c && u.faction !== defFaction);
  });

  if (!safeHex) {
    alert(`No safe hex to retreat to — retreat blocked! ${defFaction} must stand and fight.`);
    return false;
  }

  for (const u of defenders) {
    u.row = safeHex[0];
    u.col = safeHex[1];
  }
  alert(`${defFaction} retreats to (${safeHex[0]},${safeHex[1]}).`);
  return true;
}

// Wraiths use the same retreat threshold: units STAND if roll >= threshold
// (stand before Wraiths = same ability as retreat before combat)
function resolveWraithsStand(unit) {
  const threshold = getRetreatThreshold(unit);
  const roll = Math.ceil(Math.random() * 6);
  return { roll, stands: roll >= threshold, threshold };
}

// ── LEPERS ─────────────────────────────────────────────────────────────────
// Returns the Leper unit if any, or null
function getLepers() {
  return units.find(u => u.isLeper) || null;
}

// Check if a given hex contains Lepers
function hexHasLepers(row, col) {
  return units.some(u => u.isLeper && u.row === row && u.col === col);
}

// Apply Lepers auto-retreat: any enemy stack adjacent to Lepers must retreat
// automatically before combat (no die roll needed).
// Returns true if the target hex is adjacent to Lepers (and auto-retreat applies).
function checkLepersAutoRetreat(defenderFaction, targetRow, targetCol) {
  const leper = getLepers();
  if (!leper || leper.row == null) return false;
  const adj = getAdjacentCoords(leper.row, leper.col);
  const isAdj = adj.some(([r, c]) => r === targetRow && c === targetCol);
  if (!isAdj) return false;
  if (defenderFaction === leper.faction) return false; // friendly — no effect
  return true;
}

// Execute auto-retreat away from Lepers (no roll — automatic)
function executeLepersRetreat(defenders, targetRow, targetCol, leperRow, leperCol) {
  if (!defenders.length) return false;
  const defFaction = defenders[0].faction;

  // Must retreat to a hex NOT adjacent to the Lepers
  const adj = getAdjacentCoords(targetRow, targetCol);
  const leperAdj = new Set(
    getAdjacentCoords(leperRow, leperCol).map(([r, c]) => `${r},${c}`)
  );
  leperAdj.add(`${leperRow},${leperCol}`);

  const safeHex = adj.find(([r, c]) => {
    if (leperAdj.has(`${r},${c}`)) return false;
    return !units.some(u => u.row === r && u.col === c && u.faction !== defFaction);
  });

  if (!safeHex) {
    // Fall back: any hex not occupied by enemies
    const anyHex = adj.find(([r, c]) =>
      !units.some(u => u.row === r && u.col === c && u.faction !== defFaction)
    );
    if (!anyHex) {
      alert(`${defFaction} units cannot flee the Lepers — nowhere to go! Units destroyed.`);
      for (const u of [...defenders]) { if (!u.isLeader) removeUnit(u); else fateDieRoll(u); }
      return true;
    }
    for (const u of defenders) { u.row = anyHex[0]; u.col = anyHex[1]; }
    alert(`${defFaction} flees the Lepers to (${anyHex[0]},${anyHex[1]})! (No hex free of Leper adjacency.)`);
    return true;
  }

  for (const u of defenders) { u.row = safeHex[0]; u.col = safeHex[1]; }
  alert(`${defFaction} automatically retreats before the Lepers to (${safeHex[0]},${safeHex[1]})!`);
  return true;
}

// Can a given unit/faction attack the Lepers?
// Only allowed: Black Hand, Eaters' Whirling Vortex or Reflector, or Greystaff boons.
// In normal combat, no unit may attack Lepers — returns false.
function canAttackLepers(attackerFaction) {
  if (attackerFaction === "blackhand") return true;
  if (attackerFaction === "eaters") return true; // via Vortex/Reflector handled in spell code
  return false;
}
