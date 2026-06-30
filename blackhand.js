// blackhand.js — The Black Hand necromancer faction mechanics

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBlackHand() {
  return units.find(u => u.isBlackHand && u.isLeader);
}

function getGuardian() {
  return units.find(u => u.isGuardian);
}

function getTheDead() {
  return units.find(u => u.isTheDead);
}

function getColossus() {
  return units.find(u => u.isColossus);
}

function getUndeadUnits() {
  return units.filter(u => u.isUndead);
}

function blackHandOwnedByCurrentFaction() {
  const bh = getBlackHand();
  if (!bh) return false;
  return bh.faction === turnOrder[currentTurnIndex];
}

function getZardsTile() {
  for (const k in tileData) {
    if (tileData[k].name === "Tower of Zards") return tileData[k];
  }
  return null;
}

function isOnZards(unit) {
  const z = getZardsTile();
  return z && unit.row === z.row && unit.col === z.col;
}

function isOnAncientBattlefield(r, c) {
  return !!(tileData[`${r},${c}`]?.isAncientBattlefield);
}

function isOnRecentBattlefield(r, c) {
  return !!(tileData[`${r},${c}`]?.isRecentBattlefield);
}

// ── Recent Battlefields ───────────────────────────────────────────────────────

const MAX_BATTLEFIELD_MARKERS = 8;

function markRecentBattlefield(row, col) {
  const bh = getBlackHand();
  if (!bh) return;

  const key = `${row},${col}`;
  if (tileData[key]?.isRecentBattlefield) return; // already marked

  // Count existing markers
  const existing = Object.values(tileData).filter(t => t.isRecentBattlefield);
  if (existing.length >= MAX_BATTLEFIELD_MARKERS) return; // at cap, BH player can manually remove

  tileData[key].isRecentBattlefield = true;
}

// Called by the combat resolution system when units are eliminated
// Pass the hex where the combat happened.
function onCombatUnitsEliminated(row, col) {
  const bh = getBlackHand();
  if (!bh) return;
  markRecentBattlefield(row, col);
}

// ── Guardian ──────────────────────────────────────────────────────────────────

// Returns true if Zards is currently protected from siege
function guardianBlocksSiege(row, col) {
  const guardian = getGuardian();
  if (!guardian || !guardian.guardianActive) return false;
  const z = getZardsTile();
  return z && z.row === row && z.col === col;
}

// Exorcism attempt: magical unit adjacent to Zards, during exorcist's combat phase.
// Returns true if Guardian was destroyed.
function attemptExorcism(exorcistFaction) {
  const guardian = getGuardian();
  if (!guardian || !guardian.guardianActive) {
    alert("The Guardian is not present or already banished.");
    return false;
  }
  const z = getZardsTile();
  if (!z) return false;

  // Check that exorcist faction has a magical unit adjacent to Zards
  const adjacent = getAdjacentCoords(z.row, z.col);
  const magicUnits = units.filter(u =>
    u.faction === exorcistFaction && u.isMagical &&
    adjacent.some(([r, c]) => u.row === r && u.col === c)
  );
  if (!magicUnits.length) {
    alert("No magical unit is adjacent to the Tower of Zards.");
    return false;
  }

  const exorcistRoll = Math.ceil(Math.random() * 6);
  const guardianRoll = Math.ceil(Math.random() * 6);

  // Talisman of Dispel adds +1 to exorcist's roll
  const hasTalisman = magicUnits.some(u => u.magicGift === "Talisman of Dispel");
  const effectiveRoll = exorcistRoll + (hasTalisman ? 1 : 0);

  alert(`Exorcism attempt!\nExorcist rolls: ${exorcistRoll}${hasTalisman ? "+1 (Talisman)" : ""} = ${effectiveRoll}\nGuardian rolls: ${guardianRoll}`);

  if (effectiveRoll > guardianRoll) {
    guardian.guardianActive = false;
    guardian.row = undefined;
    guardian.col = undefined;
    units.splice(units.indexOf(guardian), 1);
    alert("The Guardian is exorcized and banished!");
    drawMap();
    return true;
  } else {
    alert("The Guardian holds! Exorcism failed.");
    return false;
  }
}

// ── The Dead ──────────────────────────────────────────────────────────────────

function rebuildTheDead(bh) {
  const z = getZardsTile();
  const onBattlefield = isOnRecentBattlefield(bh.row, bh.col);
  const colossusBattlefield = getColossus()?.spawnedBattlefield;
  const sameAsColossus = colossusBattlefield && bh.row === colossusBattlefield[0] && bh.col === colossusBattlefield[1];

  if (onBattlefield && sameAsColossus) {
    alert("Cannot rebuild The Dead from a battlefield used to build the Colossus.");
    return false;
  }

  if (!onBattlefield && !(z && bh.row === z.row && bh.col === z.col)) {
    alert("The Black Hand must end movement on a Recent Battlefield or in the Tower of Zards to rebuild The Dead.");
    return false;
  }

  const dead = {
    faction: "blackhand",
    row: bh.row,
    col: bh.col,
    moveSpeed: 5,
    isTheDead: true,
    isBlackHand: true,
    isMagical: true,
    combatStrength: 5,
    siegeStrength: 1,
    hasMoved: true, // can attack but not move this turn
    justRebuilt: true,
  };
  units.push(dead);
  alert("The Dead have been rebuilt and placed with the Black Hand!");
  drawMap();
  return true;
}

// ── Undead ────────────────────────────────────────────────────────────────────

function raiseUndead(bh) {
  if (!isOnAncientBattlefield(bh.row, bh.col)) {
    alert("The Black Hand must end movement on an Ancient Battlefield to raise the Undead.");
    return false;
  }

  const undead = {
    faction: "blackhand",
    row: bh.row,
    col: bh.col,
    moveSpeed: 5,
    isUndead: true,
    isBlackHand: true,
    isMagical: true,
    combatStrength: 4,
    siegeStrength: 1,
    hasMoved: true, // can attack but not move this turn
    justRaised: true,
  };
  units.push(undead);
  alert("Undead raised! Placed with the Black Hand. They may attack but not move this turn.");
  drawMap();
  return true;
}

// Remove Undead not stacked with the Black Hand at end of turn.
function cleanupUndead() {
  const bh = getBlackHand();
  const toRemove = units.filter(u => u.isUndead && (!bh || u.row !== bh.row || u.col !== bh.col));
  for (const u of toRemove) {
    units.splice(units.indexOf(u), 1);
  }
  if (toRemove.length) {
    alert(`${toRemove.length} Undead troop(s) vanish — they were not stacked with the Black Hand.`);
    drawMap();
  }
}

// ── Colossus ──────────────────────────────────────────────────────────────────

function buildColossus(bh) {
  const deadBattlefield = getTheDead() ? null : null; // Dead rebuilding check
  if (!isOnRecentBattlefield(bh.row, bh.col)) {
    alert("The Black Hand must end movement on a Recent Battlefield to build the Colossus.");
    return false;
  }

  const existing = getColossus();
  if (existing) {
    alert("The Colossus is already in play. Destroy or remove it first.");
    return false;
  }

  const colossus = {
    faction: "blackhand",
    row: bh.row,
    col: bh.col,
    moveSpeed: 5,
    isColossus: true,
    isBlackHand: true,
    isMagical: true,
    combatStrength: 0, // special: fights equal to opponent
    siegeStrength: 0,  // useless at sieges
    hasMoved: true,    // can attack but not move this turn
    spawnedBattlefield: [bh.row, bh.col],
    maxRangeFromBattlefield: 5,
  };
  units.push(colossus);
  alert("The Colossus rises! Placed with the Black Hand. It may attack but not move this turn.");
  drawMap();
  return true;
}

// ── Teleport ──────────────────────────────────────────────────────────────────

function teleportBlackHand() {
  const bh = getBlackHand();
  if (!bh) return;
  const z = getZardsTile();
  if (!z) return;

  if (bh.row === z.row && bh.col === z.col) {
    alert("The Black Hand is already in the Tower of Zards.");
    return;
  }

  bh.row = z.row;
  bh.col = z.col;
  bh.hasMoved = true;
  info.innerText = "The Black Hand teleports back to the Tower of Zards!";
  drawMap();
}

// ── Vented Wraiths ────────────────────────────────────────────────────────────

function canSummonWraiths() {
  const bh = getBlackHand();
  if (!bh) return false;
  if (bh.wraithsUsedTurn && bh.wraithsUsedTurn >= turnNumber - 1 && bh.wraithsUsedTurn !== 0) return false;
  return true;
}

function canSummonWings() {
  const bh = getBlackHand();
  if (!bh) return false;
  if (bh.wingsUsedTurn && bh.wingsUsedTurn >= turnNumber - 1 && bh.wingsUsedTurn !== 0) return false;
  return true;
}

function invokeVentedWraiths(onDone) {
  const bh = getBlackHand();
  if (!bh) { if (onDone) onDone(); return; }

  const adjacent = getAdjacentCoords(bh.row, bh.col);
  const enemyStacks = {};
  for (const [r, c] of adjacent) {
    const stackUnits = units.filter(u => u.faction !== "blackhand" && u.row === r && u.col === c && (u.combatStrength || 0) > 0);
    if (stackUnits.length) enemyStacks[`${r},${c}`] = stackUnits;
  }

  const hexes = Object.keys(enemyStacks);
  if (!hexes.length) {
    alert("Vented Wraiths: no adjacent enemy stacks to terrify.");
    if (onDone) onDone(); return;
  }

  bh.wraithsUsedTurn = turnNumber;

  // For each adjacent enemy stack, force retreat check
  for (const hexKey of hexes) {
    const [r, c] = hexKey.split(",").map(Number);
    const stack = enemyStacks[hexKey];
    // Use per-unit retreat threshold: unit with worst odds tests first
    const worstUnit = stack.reduce((worst, u) => {
      const th = typeof getRetreatThreshold === "function" ? getRetreatThreshold(u) : 4;
      const wth = typeof getRetreatThreshold === "function" ? getRetreatThreshold(worst) : 4;
      return th > wth ? u : worst;
    }, stack[0]);
    const threshold = typeof getRetreatThreshold === "function" ? getRetreatThreshold(worstUnit) : 4;
    const roll = Math.ceil(Math.random() * 6);
    const stands = roll >= threshold;

    if (stands) {
      alert(`Vented Wraiths terrorize (${r},${c})!\nRoll: ${roll} (needs ${threshold}+) — They STAND before the Wraiths! But they may not attempt retreat before combat.`);
      for (const u of stack) u.cannotRetreatBeforeCombat = true;
    } else {
      // Force retreat
      alert(`Vented Wraiths terrorize (${r},${c})!\nRoll: ${roll} — They flee before the Wraiths!`);
      const retreatDirs = getAdjacentCoords(r, c).filter(([nr, nc]) => {
        const nk = `${nr},${nc}`;
        return tileData[nk] && !units.some(u => u.row === nr && u.col === nc && u.faction !== stack[0].faction);
      });
      if (retreatDirs.length) {
        const [nr, nc] = retreatDirs[Math.floor(Math.random() * retreatDirs.length)];
        for (const u of stack) { u.row = nr; u.col = nc; }
        alert(`Stack retreated to (${nr},${nc}).`);
      } else {
        alert("No retreat possible — stack destroyed by Wraiths!");
        for (const u of [...stack]) {
          if (!u.isLeader) removeUnit(u);
        }
        for (const u of stack.filter(u => u.isLeader)) fateDieRoll(u);
      }
    }
  }

  drawMap();
  if (onDone) onDone();
}

// ── Wings of Darkness ─────────────────────────────────────────────────────────

let _wingsTargetHex = null;

function invokeWingsOfDarkness(onDone) {
  const bh = getBlackHand();
  if (!bh) { if (onDone) onDone(); return; }

  const adjacent = getAdjacentCoords(bh.row, bh.col);
  const targets = adjacent.filter(([r, c]) =>
    units.some(u => u.faction !== "blackhand" && u.row === r && u.col === c && (u.combatStrength || 0) > 0)
  );

  if (!targets.length) {
    alert("Wings of Darkness: no adjacent enemy stacks.");
    if (onDone) onDone(); return;
  }

  bh.wingsUsedTurn = turnNumber;
  bh.wingsActive = true;

  highlightTiles(targets, "combat");
  info.innerText = "Wings of Darkness: click an adjacent enemy hex — attacks against that stack get +1 this turn.";
  window._wingsCallback = onDone;
  window._bhSpellMode = "wings";
}

function resolveWingsTarget(row, col) {
  window._bhSpellMode = null;
  highlightedTilesByType.combat = [];
  const onDone = window._wingsCallback; window._wingsCallback = null;

  const bh = getBlackHand();
  if (bh) {
    bh.wingsTargetRow = row;
    bh.wingsTargetCol = col;
  }

  info.innerText = `Wings of Darkness shroud (${row},${col}) — attacks gain +1 this combat phase.`;
  drawMap();
  if (onDone) onDone();
}

// Returns +1 if Wings of Darkness apply to this attack
function getWingsDarknessBonus(attackerFaction, defRow, defCol) {
  const bh = getBlackHand();
  if (!bh || !bh.wingsActive) return 0;
  if (bh.wingsTargetRow !== defRow || bh.wingsTargetCol !== defCol) return 0;
  if (attackerFaction !== "blackhand") return 0;
  return 1;
}

function clearWingsOfDarkness() {
  const bh = getBlackHand();
  if (bh) {
    bh.wingsActive = false;
    bh.wingsTargetRow = undefined;
    bh.wingsTargetCol = undefined;
  }
}

// ── Black Hand creature panel ──────────────────────────────────────────────────

function showBlackHandPanel(context, onDone) {
  if (!blackHandOwnedByCurrentFaction()) { onDone(); return; }
  const bh = getBlackHand();
  if (!bh) { onDone(); return; }

  const buttons = [];

  if (context === "aftermovement") {
    // Teleport option always available during own turn movement phase
    buttons.push({ key: "teleport", label: "Teleport — return Black Hand to Tower of Zards" });

    // Summon Wraiths
    if (canSummonWraiths()) {
      buttons.push({ key: "wraiths", label: "Vented Wraiths — force adjacent enemy stacks to retreat" });
    }
    // Summon Wings
    if (canSummonWings()) {
      buttons.push({ key: "wings", label: "Wings of Darkness — +1 to combat die vs one adjacent enemy" });
    }
    // Rebuild Dead if eliminated
    if (!getTheDead()) {
      buttons.push({ key: "rebuildDead", label: "Rebuild The Dead (requires Recent Battlefield or Zards)" });
    }
    // Raise Undead if on ancient battlefield
    if (isOnAncientBattlefield(bh.row, bh.col)) {
      buttons.push({ key: "raiseUndead", label: "Raise Undead (Ancient Battlefield)" });
    }
    // Build Colossus if on recent battlefield and no colossus exists
    if (isOnRecentBattlefield(bh.row, bh.col) && !getColossus()) {
      buttons.push({ key: "colossus", label: "Form the Colossus (Recent Battlefield)" });
    }
  }

  if (buttons.length === 0) { onDone(); return; }

  window._bhDone = onDone;

  const panel = document.getElementById("spell-panel");
  document.getElementById("spell-panel-content").innerHTML =
    `<strong>The Black Hand — Creatures & Powers</strong><br><br>` +
    buttons.map(b => `<button onclick="activateBlackHandAbility('${b.key}')">${b.label}</button>`).join("<br>") +
    `<br><br><button onclick="skipBlackHandPanel()">Skip</button>`;
  panel.style.display = "block";
}

function skipBlackHandPanel() {
  document.getElementById("spell-panel").style.display = "none";
  if (window._bhDone) { const cb = window._bhDone; window._bhDone = null; cb(); }
}

function activateBlackHandAbility(key) {
  document.getElementById("spell-panel").style.display = "none";
  const cb = window._bhDone; window._bhDone = null;

  const bh = getBlackHand();

  switch (key) {
    case "teleport":
      teleportBlackHand();
      if (cb) cb();
      break;
    case "wraiths":
      invokeVentedWraiths(cb);
      break;
    case "wings":
      invokeWingsOfDarkness(cb);
      break;
    case "rebuildDead":
      rebuildTheDead(bh);
      if (cb) cb();
      break;
    case "raiseUndead":
      raiseUndead(bh);
      if (cb) cb();
      break;
    case "colossus":
      buildColossus(bh);
      if (cb) cb();
      break;
  }
}

// ── Click handler ─────────────────────────────────────────────────────────────

function handleBlackHandClick(row, col) {
  if (window._bhSpellMode === "wings") {
    const bh = getBlackHand();
    if (bh) {
      const adjacent = getAdjacentCoords(bh.row, bh.col);
      const valid = adjacent.some(([r, c]) => r === row && c === col);
      if (valid) { resolveWingsTarget(row, col); return true; }
    }
  }
  return false;
}

// ── Colossus combat special rules ─────────────────────────────────────────────
// The Colossus fights as equal in number to its opponents.
// Returns the effective combat strength of the Colossus for a given fight.
function getColossusStrength(opponents) {
  return opponents.reduce((s, u) => s + (u.combatStrength || 0), 0);
}

// ── Turn cleanup ──────────────────────────────────────────────────────────────

function resetBlackHandForTurn() {
  clearWingsOfDarkness();
  cleanupUndead();
}
