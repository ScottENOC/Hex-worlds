function startCombatResolution() {
  if (declaredCombats.length === 0) {
    endTurn();
    return;
  }

  const combat = declaredCombats.shift();
  const { fromHex, targetHex } = combat;

  const defenders = units.filter(u => u.row === targetHex.row && u.col === targetHex.col);
  const defFaction = defenders[0]?.faction;
  const attackers = units.filter(
    u => u.row === fromHex.row && u.col === fromHex.col && u.faction !== defFaction
  );

  // Scum-alone rule: if all defenders are Scum, they retreat (4-6) or are eliminated.
  const allScumDefenders = defenders.length > 0 && defenders.every(u => u.isScum);
  if (allScumDefenders) {
    const roll = Math.ceil(Math.random() * 6);
    if (roll >= 4) {
      // Retreat — move Scum to an adjacent friendly or empty hex
      const adj = getAdjacentCoords(targetHex.row, targetHex.col);
      const safeHex = adj.find(([r, c]) => !units.some(u => u.row === r && u.col === c && u.faction !== defenders[0].faction));
      if (safeHex) {
        for (const u of defenders) { u.row = safeHex[0]; u.col = safeHex[1]; }
        alert(`The Scum retreat! (Roll: ${roll} ≥ 4 — they flee to ${safeHex[0]},${safeHex[1]})`);
      } else {
        for (const u of defenders) removeUnit(u);
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

  // ── LEPERS: block attacks unless attacker is Black Hand or Eaters ────────
  const lepersInTarget = defenders.some(u => u.isLeper);
  if (lepersInTarget) {
    const attFaction = attackers[0]?.faction;
    if (!canAttackLepers(attFaction)) {
      alert(`The Lepers at (${targetHex.row},${targetHex.col}) cannot be attacked by ${attFaction}! Only the Black Hand or Eaters of Wisdom may attack them.`);
      startCombatResolution();
      return;
    }
  }

  // ── LEPERS: auto-retreat any stack adjacent to Lepers ────────────────────
  const leper = getLepers();
  if (leper && leper.row != null) {
    const defFaction = defenders[0]?.faction;
    if (checkLepersAutoRetreat(defFaction, targetHex.row, targetHex.col)) {
      alert(`Units of ${defFaction} at (${targetHex.row},${targetHex.col}) must automatically retreat before the Lepers!`);
      executeLepersRetreat(defenders, targetHex.row, targetHex.col, leper.row, leper.col);
      drawMap();
      startCombatResolution();
      return;
    }
  }

  // ── RETREAT BEFORE COMBAT ─────────────────────────────────────────────────
  const defFactionName = defenders[0]?.faction;
  if (defenders.length > 0 && defFactionName !== turnOrder[currentTurnIndex]) {
    const wantRetreat = confirm(
      `${defFactionName} is being attacked at (${targetHex.row},${targetHex.col}).\n` +
      `Attempt retreat before combat?`
    );
    if (wantRetreat) {
      const retreated = attemptRetreatBeforeCombat(defenders, targetHex);
      if (retreated) {
        drawMap();
        startCombatResolution();
        return;
      }
      // Failed retreat — attacker may optionally advance into vacated hex (only if fully vacated)
    }
  }

  window.currentCombat = { attackers: [...attackers], defenders: [...defenders], fromHex, targetHex };

  document.getElementById("combat-info").innerHTML = `
    <p><strong>Combat at (${targetHex.row},${targetHex.col})</strong></p>
    <p>Attackers (${attackers.length}): ${attackers.map(u => u.faction).join(', ') || 'none'}</p>
    <p>Defenders (${defenders.length}): ${defenders.map(u => u.faction).join(', ') || 'none'}</p>
    <p>Click "Resolve Combat" to roll dice.</p>
  `;

  highlightedTilesByType.combat = [[targetHex.row, targetHex.col], [fromHex.row, fromHex.col]];
  drawMap();
  document.getElementById("combat-panel").style.display = "block";
  document.getElementById("resolve-button").style.display = "inline";
  document.getElementById("continue-button").style.display = "none";
}

function resolveCurrentCombat() {
  const { attackers, defenders, fromHex, targetHex } = window.currentCombat;
  const tile = tileData[`${targetHex.row},${targetHex.col}`];
  const terrain = tile?.terrain;

  // Eaters of Wisdom lose their combat value if enemy combat units occupy their hex.
  // This only happens after enemies advanced in via a prior combat/siege.
  const eaterInDefenders = defenders.find(u => u.isEatersOfWisdom);
  if (eaterInDefenders) {
    const enemiesInHex = units.some(u =>
      u.row === targetHex.row && u.col === targetHex.col &&
      u.faction !== eaterInDefenders.faction && (u.combatStrength || 0) > 0
    );
    if (enemiesInHex) eaterInDefenders.combatStrength = 0;
  }
  // Restore Eaters' base combat strength after this resolution finishes (see below).

  let attackerStrength = attackers.reduce((s, u) => s + (u.combatStrength || 0), 0);
  let defenderStrength = defenders.reduce((s, u) => s + (u.combatStrength || 0), 0);

  if (terrain === "mountain_pass") defenderStrength *= 2;

  // Enchanted Castle doubles defensive strength for all units in the Eaters' hex
  if (typeof getEnchantedCastleBonus === "function") {
    defenderStrength *= getEnchantedCastleBonus(targetHex.row, targetHex.col);
  }

  let attackerBonus = 0, defenderBonus = 0;
  if (attackerStrength > defenderStrength && defenderStrength > 0) {
    attackerBonus = Math.floor(attackerStrength / defenderStrength) - 1;
  } else if (defenderStrength > attackerStrength && attackerStrength > 0) {
    defenderBonus = Math.floor(defenderStrength / attackerStrength) - 1;
    if (defenderBonus === 0) defenderBonus = 1;
  }
  if (terrain === "mountain") defenderBonus += 1;

  // Sleeping monarch penalty: units of a sleeping king get -1 to combat rolls
  const attackerFaction = attackers[0]?.faction;
  const defenderFaction = defenders[0]?.faction;
  const attackerSleepPenalty = units.some(u => u.isLeader && u.faction === attackerFaction && u.templeSleep) ? -1 : 0;
  const defenderSleepPenalty = units.some(u => u.isLeader && u.faction === defenderFaction && u.templeSleep) ? -1 : 0;
  const attackerIsleOfFrightPenalty = typeof getIsleOfFrightPenalty === "function" ? getIsleOfFrightPenalty(attackerFaction) : 0;
  const defenderIsleOfFrightPenalty = typeof getIsleOfFrightPenalty === "function" ? getIsleOfFrightPenalty(defenderFaction) : 0;

  const attackerRoll = Math.floor(Math.random() * 6) + 1;
  const defenderRoll = Math.floor(Math.random() * 6) + 1;
  const attackerTotal = attackerRoll + attackerBonus + attackerSleepPenalty + attackerIsleOfFrightPenalty;
  const defenderTotal = defenderRoll + defenderBonus + defenderSleepPenalty + defenderIsleOfFrightPenalty;

  let attackerLosses = 0, defenderLosses = 0;
  let resultLine;
  if (attackerTotal > defenderTotal) {
    defenderLosses = attackerTotal - defenderTotal;
    resultLine = `<p>Attackers win! Defenders lose ${defenderLosses} unit(s).</p>`;
  } else if (defenderTotal > attackerTotal) {
    attackerLosses = defenderTotal - attackerTotal;
    resultLine = `<p>Defenders win! Attackers lose ${attackerLosses} unit(s).</p>`;
  } else {
    attackerLosses = defenderLosses = attackerTotal;
    resultLine = `<p>Tie! Both sides lose ${attackerLosses} unit(s).</p>`;
  }

  const hexesWithLosses = new Set();

  for (let i = 0; i < defenderLosses; i++) {
    // Scum absorb losses in place of better troops (preferred loss candidate)
    let eligible = defenders.filter(u => !u.isLeader && units.includes(u));
    if (!eligible.length) break;
    const scumFirst = eligible.filter(u => u.isScum);
    const u = scumFirst.length ? scumFirst[0] : eligible[Math.floor(Math.random() * eligible.length)];
    hexesWithLosses.add(`${u.row},${u.col}`);
    removeUnit(u);
    defenders.splice(defenders.indexOf(u), 1);
  }

  for (let i = 0; i < attackerLosses; i++) {
    let eligible = attackers.filter(u => !u.isLeader && units.includes(u));
    if (!eligible.length) break;
    const scumFirst = eligible.filter(u => u.isScum);
    const u = scumFirst.length ? scumFirst[0] : eligible[Math.floor(Math.random() * eligible.length)];
    hexesWithLosses.add(`${u.row},${u.col}`);
    removeUnit(u);
    attackers.splice(attackers.indexOf(u), 1);
  }

  for (const hexKey of hexesWithLosses) {
    const [r, c] = hexKey.split(',').map(Number);
    for (const leader of units.filter(u => u.isLeader && u.row === r && u.col === c)) {
      fateDieRoll(leader);
    }
  }

  // Restore Eaters' combat strength if it was nullified above (safe hex restores it)
  if (eaterInDefenders && eaterInDefenders.combatStrength === 0) {
    eaterInDefenders.combatStrength = eaterInDefenders.baseCombatStrength || 2;
  }

  // Eaters are a combined leader+combat unit — count them in the "non-leader" check
  // so that attackers can advance when only the Eaters remain (they're also a combat unit).
  const nonLeaderDefenders = defenders.filter(u => !u.isLeader || u.isEatersOfWisdom);
  if (nonLeaderDefenders.length === 0 && attackers.length > 0) {
    for (const u of attackers) {
      if (units.includes(u)) { u.row = targetHex.row; u.col = targetHex.col; }
    }
    // Fate die roll for any surviving non-Eaters leaders; Eaters roll is already handled
    for (const leader of defenders.filter(u => u.isLeader && !u.isEatersOfWisdom)) fateDieRoll(leader);
  } else {
    for (const u of attackers) {
      if (units.includes(u)) { u.row = fromHex.row; u.col = fromHex.col; }
    }
  }

  document.getElementById("combat-info").innerHTML = `
    <p><strong>Combat Result</strong></p>
    <p>Attacker: ${attackerRoll}${attackerBonus ? ` +${attackerBonus}` : ''} = ${attackerTotal}</p>
    <p>Defender: ${defenderRoll}${defenderBonus ? ` +${defenderBonus}` : ''} = ${defenderTotal}</p>
    ${resultLine}
  `;

  document.getElementById("resolve-button").style.display = "none";
  document.getElementById("continue-button").style.display = "inline";
}

document.getElementById("resolve-button").addEventListener("click", () => {
  resolveCurrentCombat();
  drawMap();
});

document.getElementById("continue-button").addEventListener("click", () => {
  document.getElementById("combat-panel").style.display = "none";
  document.getElementById("continue-button").style.display = "none";
  highlightedTilesByType.combat = [];
  drawMap();
  startCombatResolution();
});
