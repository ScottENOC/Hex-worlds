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

  let attackerStrength = attackers.reduce((s, u) => s + (u.combatStrength || 0), 0);
  let defenderStrength = defenders.reduce((s, u) => s + (u.combatStrength || 0), 0);

  if (terrain === "mountain_pass") defenderStrength *= 2;

  let attackerBonus = 0, defenderBonus = 0;
  if (attackerStrength > defenderStrength && defenderStrength > 0) {
    attackerBonus = Math.floor(attackerStrength / defenderStrength) - 1;
  } else if (defenderStrength > attackerStrength && attackerStrength > 0) {
    defenderBonus = Math.floor(defenderStrength / attackerStrength) - 1;
    if (defenderBonus === 0) defenderBonus = 1;
  }
  if (terrain === "mountain") defenderBonus += 1;

  const attackerRoll = Math.floor(Math.random() * 6) + 1;
  const defenderRoll = Math.floor(Math.random() * 6) + 1;
  const attackerTotal = attackerRoll + attackerBonus;
  const defenderTotal = defenderRoll + defenderBonus;

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
    const eligible = defenders.filter(u => !u.isLeader && units.includes(u));
    if (!eligible.length) break;
    const u = eligible[Math.floor(Math.random() * eligible.length)];
    hexesWithLosses.add(`${u.row},${u.col}`);
    removeUnit(u);
    defenders.splice(defenders.indexOf(u), 1);
  }

  for (let i = 0; i < attackerLosses; i++) {
    const eligible = attackers.filter(u => !u.isLeader && units.includes(u));
    if (!eligible.length) break;
    const u = eligible[Math.floor(Math.random() * eligible.length)];
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

  const nonLeaderDefenders = defenders.filter(u => !u.isLeader);
  if (nonLeaderDefenders.length === 0 && attackers.length > 0) {
    for (const u of attackers) {
      if (units.includes(u)) { u.row = targetHex.row; u.col = targetHex.col; }
    }
    for (const leader of defenders.filter(u => u.isLeader)) fateDieRoll(leader);
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
