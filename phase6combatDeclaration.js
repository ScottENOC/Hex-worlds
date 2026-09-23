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

function combatAllocationRuleEnabled() {
  const rules = (typeof window !== "undefined" && window.scenarioRules) || {};
  return rules.splitStackCombat === true;
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

// The map's original declaration handler commits an entire origin hex. Rather
// than duplicate drawHex(), intercept target-hex clicks during combat declaration
// in the SVG capture phase. Friendly-unit clicks still fall through to the normal
// selector. This keeps the phone UI simple and avoids an extra screen.
function installCombatAllocationClickHandler() {
  if (typeof svg === "undefined" || !svg?.addEventListener || svg.dataset.combatAllocationHandler === "1") return;
  svg.dataset.combatAllocationHandler = "1";
  svg.addEventListener("click", event => {
    if (!combatAllocationRuleEnabled() || currentPhase !== "combat-declare" || !selectedUnit) return;
    const target = event.target;
    const hexText = target?.dataset?.hex;
    if (!hexText) return;

    const [row, col] = hexText.split(",").map(Number);
    const legalTargets = getAdjacentEnemies(selectedUnit).some(([r, c]) => r === row && c === col);
    if (!legalTargets) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    const fromHex = { row: selectedUnit.row, col: selectedUnit.col };
    const targetHex = { row, col };
    const faction = turnOrder[currentTurnIndex];
    const chosen = chooseCombatUnitsForDeclaration(fromHex, targetHex, faction, selectedUnit);
    if (chosen.length) addCombatDeclaration(fromHex, targetHex, chosen);

    selectedUnit = null;
    highlightedTilesByType.combat = [];
    drawMap();
    showHexInfo(row, col);
  }, true);
}

// setup.js installs the multi-hex combat resolver after this file loads. Install
// one final resolver on the next event-loop turn so it can consume unitIds while
// retaining the special-case rules (Scum, Lepers, retreat-before-combat, etc.).
function installAllocatedCombatResolver() {
  if (!combatAllocationRuleEnabled() || typeof startCombatResolution !== "function") return;

  startCombatResolution = function () {
    if (declaredCombats.length === 0) {
      endTurn();
      return;
    }

    const rules = window.scenarioRules || {};
    const merged = rules.multiHexCombat && typeof mergeNextCombatDeclarations === "function"
      ? mergeNextCombatDeclarations(declaredCombats)
      : (() => {
          const combat = declaredCombats.shift();
          return combat ? {
            targetHex: combat.targetHex,
            fromHexes: [combat.fromHex],
            declarations: [combat],
            unitIds: combat.unitIds || []
          } : null;
        })();
    if (!merged) { endTurn(); return; }

    ensureCombatUnitIds(units);
    const { targetHex, fromHexes } = merged;
    const explicitIds = new Set((merged.unitIds || []).map(String));
    const hasExplicitAllocation = explicitIds.size > 0;
    const defenders = units.filter(u => u.row === targetHex.row && u.col === targetHex.col);
    const defFaction = defenders[0]?.faction;
    const attackingFaction = turnOrder[currentTurnIndex];
    const attackers = [];
    const attackerOrigins = new Map();

    for (const fromHex of fromHexes) {
      const stack = units.filter(u =>
        u.row === fromHex.row && u.col === fromHex.col &&
        u.faction === attackingFaction && u.faction !== defFaction &&
        (!hasExplicitAllocation || explicitIds.has(String(u.combatId)))
      );
      for (const u of stack) {
        if (attackers.includes(u)) continue;
        attackers.push(u);
        attackerOrigins.set(u, { ...fromHex });
      }
    }

    if (!attackers.length) {
      startCombatResolution();
      return;
    }

    const allScumDefenders = defenders.length > 0 && defenders.every(u => u.isScum);
    if (allScumDefenders) {
      const roll = Math.ceil(Math.random() * 6);
      if (roll >= 4) {
        const adj = getAdjacentCoords(targetHex.row, targetHex.col);
        const safeHex = adj.find(([r, c]) => !units.some(u => u.row === r && u.col === c && u.faction !== defenders[0].faction));
        if (safeHex) {
          for (const u of defenders) { u.row = safeHex[0]; u.col = safeHex[1]; }
          alert(`The Scum retreat! (Roll: ${roll} ≥ 4 — they flee to ${safeHex[0]},${safeHex[1]})`);
        } else {
          for (const u of [...defenders]) removeUnit(u);
          alert(`The Scum try to retreat but have nowhere to go! (Roll: ${roll}) — Eliminated!`);
        }
      } else {
        for (const u of [...defenders]) removeUnit(u);
        alert(`The Scum cannot retreat and are eliminated! (Roll: ${roll} < 4)`);
      }
      drawMap();
      startCombatResolution();
      return;
    }

    const lepersInTarget = defenders.some(u => u.isLeper);
    if (lepersInTarget && typeof canAttackLepers === "function" && !canAttackLepers(attackingFaction)) {
      alert(`The Lepers at (${targetHex.row},${targetHex.col}) cannot be attacked by ${attackingFaction}! Only the Black Hand or Eaters of Wisdom may attack them.`);
      startCombatResolution();
      return;
    }

    if (typeof getLepers === "function") {
      const leper = getLepers();
      if (leper && leper.row != null) {
        const defenderFaction = defenders[0]?.faction;
        if (typeof checkLepersAutoRetreat === "function" && checkLepersAutoRetreat(defenderFaction, targetHex.row, targetHex.col)) {
          alert(`Units of ${defenderFaction} at (${targetHex.row},${targetHex.col}) must automatically retreat before the Lepers!`);
          executeLepersRetreat(defenders, targetHex.row, targetHex.col, leper.row, leper.col);
          drawMap();
          startCombatResolution();
          return;
        }
      }
    }

    const defFactionName = defenders[0]?.faction;
    if (defenders.length > 0 && defFactionName !== attackingFaction) {
      const wantRetreat = confirm(
        `${defFactionName} is being attacked at (${targetHex.row},${targetHex.col}).\nAttempt retreat before combat?`
      );
      if (wantRetreat) {
        const retreated = attemptRetreatBeforeCombat(defenders, targetHex);
        if (retreated) {
          drawMap();
          startCombatResolution();
          return;
        }
      }
    }

    window.currentCombat = {
      attackers: [...attackers],
      defenders: [...defenders],
      fromHex: fromHexes[0],
      fromHexes: fromHexes.map(h => ({ ...h })),
      attackerOrigins,
      targetHex
    };

    document.getElementById("combat-info").innerHTML = `
      <p><strong>Combat at (${targetHex.row},${targetHex.col})</strong></p>
      <p>Attackers (${attackers.length}) from ${fromHexes.length} hex${fromHexes.length === 1 ? "" : "es"}</p>
      <p>Defenders (${defenders.length}): ${defenders.map(u => u.faction).join(', ') || 'none'}</p>
      <p>Click "Resolve Combat" to roll dice.</p>
    `;

    highlightedTilesByType.combat = [
      [targetHex.row, targetHex.col],
      ...fromHexes.map(h => [h.row, h.col])
    ];
    drawMap();
    document.getElementById("combat-panel").style.display = "block";
    document.getElementById("resolve-button").style.display = "inline";
    document.getElementById("continue-button").style.display = "none";
  };
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

  // Defer both installers until all classic scripts (especially setup.js) have run.
  setTimeout(() => {
    installCombatAllocationClickHandler();
    installAllocatedCombatResolver();
  }, 0);
}
