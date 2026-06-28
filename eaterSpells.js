// eaterSpells.js — Eaters of Wisdom spell panel and resolution

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEaters() {
  return units.find(u => u.isEatersOfWisdom);
}

// Returns true if the Eaters are allied to (or ARE) the current faction
function eatersOwnedByCurrentFaction() {
  const e = getEaters();
  if (!e) return false;
  const faction = turnOrder[currentTurnIndex];
  return e.faction === faction || (e.faction === "eaters" && faction === "eaters");
}

function canUseSpell(spellKey) {
  const e = getEaters();
  if (!e || !e.spells) return false;
  if (e.spellUsedThisTurn) return false;  // one spell per turn
  const last = e.spells[spellKey] || 0;
  if (last >= turnNumber - 1 && last !== 0) return false;  // no consecutive turn use
  // EC and Mist can't be used in consecutive turns even if they're different spells
  if (spellKey === "enchantedCastle" && (e.spells.mistOfGroping || 0) === turnNumber - 1) return false;
  if (spellKey === "mistOfGroping" && (e.spells.enchantedCastle || 0) === turnNumber - 1) return false;
  return true;
}

function markSpellUsed(spellKey) {
  const e = getEaters();
  if (!e) return;
  if (!e.spells) e.spells = {};
  e.spells[spellKey] = turnNumber;
  e.spellUsedThisTurn = spellKey;
}

function resetEatersSpellsForTurn() {
  const e = getEaters();
  if (e) e.spellUsedThisTurn = null;
  // Clear Mist when Eaters' next turn starts
  if (e && e.mistActiveTurn && e.mistActiveTurn < turnNumber) {
    e.mistActive = false;
    e.mistActiveTurn = null;
  }
}

// ── Show/hide panel ───────────────────────────────────────────────────────────

function showSpellPanel(context, onDone) {
  if (!eatersOwnedByCurrentFaction()) { onDone(); return; }

  const buttons = [];

  if (context === "movement" && canUseSpell("theBridge")) {
    buttons.push({ key: "theBridge", label: "The Bridge — move through difficult terrain as clear" });
  }
  if (context === "combat") {
    if (canUseSpell("whirlingVortex"))
      buttons.push({ key: "whirlingVortex", label: "Whirling Vortex — attack adjacent stack at their own strength" });
    if (canUseSpell("reflector"))
      buttons.push({ key: "reflector", label: "The Reflector — 2-hex illusionary attack, attacker suffers no losses" });
  }
  if (context === "endturn") {
    if (canUseSpell("mistOfGroping"))
      buttons.push({ key: "mistOfGroping", label: "Mist of Groping — protect from attacks until next turn" });
    if (canUseSpell("enchantedCastle") && !getEaters()?.enchantedCastleActive)
      buttons.push({ key: "enchantedCastle", label: "Enchanted Castle — double defensive strength this hex" });
  }

  if (buttons.length === 0) { onDone(); return; }

  window._spellDone = onDone;

  const panel = document.getElementById("spell-panel");
  document.getElementById("spell-panel-content").innerHTML =
    `<strong>Eaters of Wisdom — Spells</strong><br><br>` +
    buttons.map(b => `<button onclick="activateSpell('${b.key}')">${b.label}</button>`).join("<br>") +
    `<br><br><button onclick="skipSpell()">Skip</button>`;
  panel.style.display = "block";
}

function skipSpell() {
  document.getElementById("spell-panel").style.display = "none";
  if (window._spellDone) { const cb = window._spellDone; window._spellDone = null; cb(); }
}

function activateSpell(key) {
  document.getElementById("spell-panel").style.display = "none";
  markSpellUsed(key);
  const cb = window._spellDone; window._spellDone = null;

  switch (key) {
    case "theBridge":
      getEaters().bridgeActive = true;
      info.innerText = "Bridge active — Eaters move through any terrain freely this turn.";
      if (cb) cb();
      break;
    case "mistOfGroping":
      const e1 = getEaters();
      e1.mistActive = true; e1.mistActiveTurn = turnNumber;
      info.innerText = "Mist of Groping — Eaters and allies cannot be attacked this turn.";
      if (cb) cb();
      break;
    case "enchantedCastle":
      getEaters().enchantedCastleActive = true;
      drawMap();
      info.innerText = "Enchanted Castle raised — defensive strength doubled in this hex.";
      if (cb) cb();
      break;
    case "whirlingVortex":
      invokeWhirlingVortex(cb);
      break;
    case "reflector":
      invokeReflector(cb);
      break;
  }
}

// ── Whirling Vortex ───────────────────────────────────────────────────────────

function invokeWhirlingVortex(onDone) {
  const e = getEaters();
  if (!e) { if (onDone) onDone(); return; }

  const adjacent = getAdjacentCoords(e.row, e.col);
  const targets = adjacent.filter(([r, c]) =>
    units.some(u => u.row === r && u.col === c && u.faction !== e.faction && (u.combatStrength || 0) > 0)
  );

  if (targets.length === 0) {
    alert("Whirling Vortex: no adjacent enemies to target.");
    if (onDone) onDone(); return;
  }

  // Highlight targets for selection
  highlightTiles(targets, "combat");
  info.innerText = "Vortex: click an adjacent enemy hex to attack.";

  window._vortexTargets = targets;
  window._vortexCallback = onDone;
  window._spellMode = "vortex";
}

function resolveVortex(tr, tc) {
  window._spellMode = null;
  highlightedTilesByType.combat = [];
  const onDone = window._vortexCallback; window._vortexCallback = null;

  const e = getEaters();
  const defenders = units.filter(u => u.row === tr && u.col === tc && u.faction !== e.faction);
  const defStr = defenders.reduce((s, u) => s + (u.combatStrength || 0), 0);

  // Vortex attack = defending stack's combat strength
  const vRoll = Math.ceil(Math.random() * 6);
  const dRoll = Math.ceil(Math.random() * 6);
  let result = "";

  if (vRoll > dRoll) {
    const losses = vRoll - dRoll;
    let removed = 0;
    for (const u of [...defenders]) {
      if (removed >= losses || u.isLeader) continue;
      removeUnit(u); removed++;
    }
    result = `Vortex wins! Defenders lose ${removed} unit(s).`;
  } else if (vRoll === dRoll) {
    // Tie: only defenders suffer (Vortex rule)
    let removed = 0;
    for (const u of [...defenders]) {
      if (removed >= vRoll || u.isLeader) continue;
      removeUnit(u); removed++;
    }
    result = `Tie — only defenders suffer: ${removed} unit(s) lost.`;
  } else {
    // Vortex loses — Eaters suffer NO adverse result
    result = "Vortex fizzles — Eaters suffer no ill effect.";
  }

  alert(`Whirling Vortex (${tr},${tc})\nVortex: ${vRoll}  Defender: ${dRoll}\n${result}`);
  drawMap();
  if (onDone) onDone();
}

// ── Reflector ─────────────────────────────────────────────────────────────────

function hexesWithinRange(row, col, range) {
  const seen = new Set(); const result = [];
  function dfs(r, c, steps) {
    const k = `${r},${c}`;
    if (!tileData[k] || seen.has(k)) return;
    seen.add(k);
    if (!(r === row && c === col)) result.push([r, c]);
    if (steps < range) getAdjacentCoords(r, c).forEach(([nr, nc]) => dfs(nr, nc, steps + 1));
  }
  dfs(row, col, 0);
  return result;
}

function invokeReflector(onDone) {
  const e = getEaters();
  if (!e) { if (onDone) onDone(); return; }

  const inRange = hexesWithinRange(e.row, e.col, 2);
  const targets = inRange.filter(([r, c]) =>
    units.some(u => u.row === r && u.col === c && u.faction !== e.faction && (u.combatStrength || 0) > 0)
  );

  if (targets.length === 0) {
    alert("Reflector: no enemy units within 2 hexes.");
    if (onDone) onDone(); return;
  }

  highlightTiles(targets, "combat");
  info.innerText = "Reflector: click an enemy hex within 2 hexes to target.";
  window._reflectorCallback = onDone;
  window._spellMode = "reflector";
}

function resolveReflector(tr, tc) {
  window._spellMode = null;
  highlightedTilesByType.combat = [];
  const onDone = window._reflectorCallback; window._reflectorCallback = null;

  const e = getEaters();
  const eatersStack = units.filter(u => u.row === e.row && u.col === e.col && u.faction === e.faction);
  const attackStr = eatersStack.reduce((s, u) => s + (u.combatStrength || 0), 0);
  const defenders = units.filter(u => u.row === tr && u.col === tc && u.faction !== e.faction);
  const defStr = defenders.reduce((s, u) => s + (u.combatStrength || 0), 0);

  const aRoll = Math.ceil(Math.random() * 6);
  const dRoll = Math.ceil(Math.random() * 6);
  let result = "";

  if (aRoll > dRoll) {
    const losses = aRoll - dRoll;
    let removed = 0;
    for (const u of [...defenders]) {
      if (removed >= losses || u.isLeader) continue;
      removeUnit(u); removed++;
    }
    result = `Reflector wins! Defenders lose ${removed} unit(s). Attackers suffer no losses (illusionary attack).`;
  } else {
    // Reflector loses or ties: defenders unharmed, attackers ALWAYS suffer no losses
    result = "Reflector fails — all adverse results ignored by the Eaters.";
  }

  alert(`The Reflector → (${tr},${tc})\nAttacker: ${aRoll}  Defender: ${dRoll}\n${result}`);
  drawMap();
  if (onDone) onDone();
}

// ── Enchanted Castle — defensive bonus ────────────────────────────────────────
// Applied in phase7CombatResolution when Eaters and stack are defending in their hex

function getEnchantedCastleBonus(defenderRow, defenderCol) {
  const e = getEaters();
  if (!e || !e.enchantedCastleActive) return 1;
  if (e.row === defenderRow && e.col === defenderCol) return 2;
  return 1;
}

// ── Intercept hex clicks for spell target selection ───────────────────────────
// Called from drawing.js hex click handler before normal phase handling.
// Returns true if the click was consumed by a spell.
function handleSpellClick(row, col) {
  if (window._spellMode === "vortex") {
    const valid = (window._vortexTargets || []).some(([r, c]) => r === row && c === col);
    if (valid) { resolveVortex(row, col); return true; }
  }
  if (window._spellMode === "reflector") {
    const e = getEaters();
    if (e) {
      const inRange = hexesWithinRange(e.row, e.col, 2);
      const valid = inRange.some(([r, c]) => r === row && c === col);
      if (valid) { resolveReflector(row, col); return true; }
    }
  }
  return false;
}
