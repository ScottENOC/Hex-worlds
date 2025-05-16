function startCombatResolution() {
  if (!gameState.combatDeclarations || Object.keys(gameState.combatDeclarations).length === 0) {
    endTurn();
    return;
  }

  const [targetId, sourceIds] = Object.entries(gameState.combatDeclarations).shift();
  delete gameState.combatDeclarations[targetId];

  const [row, col] = targetId.split(',').map(Number);
  const targetHex = { row, col };
  const defenders = units.filter(u => u.row === row && u.col === col);

  const attackers = sourceIds.flatMap(sourceId => {
    const [sRow, sCol] = sourceId.split(',').map(Number);
    return units.filter(u => u.row === sRow && u.col === sCol);
  });

  window.currentCombat = { attackers, defenders, targetHex, sourceHexes: sourceIds };

  document.getElementById("combat-info").innerHTML = `
    <p><strong>Combat:</strong></p>
    <p>Attackers: ${attackers.map(u => u.faction).join(', ')}</p>
    <p>Defenders: ${defenders.map(u => u.faction).join(', ')}</p>
    <p>Click "Resolve" to resolve this combat!</p>
  `;

  highlightedTiles = [[row, col]];
  drawMap();
  document.getElementById("combat-panel").style.display = "block";
}
 
function resolveCurrentCombat() {
const hexesWithLosses = new Set();
  const { attackers, defenders, fromHex, targetHex } = window.currentCombat;
  const tile = tileData[`${targetHex.row},${targetHex.col}`];
  const terrain = tile?.terrain;

  // Sum up attacker strengths
  let attackerStrength = 0;
  for (const unit of attackers) {
    attackerStrength += unit.combatStrength || 0;
  }

  // Sum up defender strengths
  let defenderStrength = 0;
  for (const unit of defenders) {
    defenderStrength += unit.combatStrength || 0;
  }

  // Double defender strength if mountain_pass
  if (terrain === "mountain_pass") {
    defenderStrength *= 2;
}

  // Base bonus from unit strength difference
  let bonus = 0;
  if (attackerStrength > defenderStrength) {
    bonus = Math.floor(attackerStrength / defenderStrength) - 1;
  } else if (defenderStrength > attackerStrength) {
    bonus = Math.floor(defenderStrength / attackerStrength) - 1;
    if (bonus === 0) bonus = 1;
  }

  // Dice rolls
  const attackerRoll = Math.floor(Math.random() * 6) + 1;
  const defenderRoll = Math.floor(Math.random() * 6) + 1;

  // Assign strength bonus
  let attackerBonus = attackerStrength > defenderStrength ? bonus : 0;
  let defenderBonus = defenderStrength > attackerStrength ? bonus : 0;

  // Add terrain bonus for mountain
  if (terrain === "mountain") {
    defenderBonus += 1;
  }

  const attackerTotal = attackerRoll + attackerBonus;
  const defenderTotal = defenderRoll + defenderBonus;

  let combatResultText = `
    <p><strong>Combat Resolution:</strong></p>
    <p>Attacker rolls: ${attackerRoll}${attackerBonus ? ` + ${attackerBonus}` : ""} = ${attackerTotal}</p>
    <p>Defender rolls: ${defenderRoll}${defenderBonus ? ` + ${defenderBonus}` : ""} = ${defenderTotal}</p>
  `;

  let attackerLosses = 0;
  let defenderLosses = 0;

  if (attackerTotal > defenderTotal) {
    defenderLosses = attackerTotal - defenderTotal;
    combatResultText += `<p>Attacker wins! Defender loses ${defenderLosses} unit(s).</p>`;
  } else if (defenderTotal > attackerTotal) {
    attackerLosses = defenderTotal - attackerTotal;
    combatResultText += `<p>Defender wins! Attacker loses ${attackerLosses} unit(s).</p>`;
  } else {
    attackerLosses = defenderLosses = attackerTotal;
    combatResultText += `<p>It's a tie! Both sides lose ${attackerLosses} unit(s).</p>`;
  }

  // Remove defender units (excluding leaders)
for (let i = 0; i < defenderLosses; i++) {
  const eligibleDefenders = defenders.filter(u => !u.isLeader);
  if (eligibleDefenders.length === 0) break;

  const randomIndex = Math.floor(Math.random() * eligibleDefenders.length);
  const unit = eligibleDefenders[randomIndex];
hexesWithLosses.add(`${unit.row},${unit.col}`);

  removeUnitFromMap(unit);

  // Remove the unit from the original `defenders` array too
  const originalIndex = defenders.indexOf(unit);
  if (originalIndex !== -1) {
    defenders.splice(originalIndex, 1);
  }
}

// Remove attacker units (excluding leaders)
for (let i = 0; i < attackerLosses; i++) {
  const eligibleAttackers = attackers.filter(u => !u.isLeader);
  if (eligibleAttackers.length === 0) break;

  const randomIndex = Math.floor(Math.random() * eligibleAttackers.length);
  const unit = eligibleAttackers[randomIndex];
hexesWithLosses.add(`${unit.row},${unit.col}`);
  removeUnitFromMap(unit);

  // Remove the unit from the original `attackers` array too
  const originalIndex = attackers.indexOf(unit);
  if (originalIndex !== -1) {
    attackers.splice(originalIndex, 1);
  }
}
// Roll fate for leaders in hexes that took casualties
for (const hexKey of hexesWithLosses) {
  const [row, col] = hexKey.split(',').map(Number);
  const leadersInHex = units.filter(u => u.isLeader && u.row === row && u.col === col);
  for (const leader of leadersInHex) {
    fateDieRoll(leader);
  }
}

const nonLeaderDefenders = defenders.filter(u => !u.isLeader);

if (nonLeaderDefenders.length === 0 && attackers.length > 0) {
  // Move all surviving attackers into the target hex
  for (const unit of attackers) {
    if (units.includes(unit)) {
      unit.row = targetHex.row;
      unit.col = targetHex.col;
    }
  }

  // Handle fate die roll for any remaining defenders who are leaders
  const remainingLeaders = defenders.filter(u => u.isLeader);
  for (const leader of remainingLeaders) {
    fateDieRoll(leader);
  }

} else {
  // Retreat all surviving attackers
  for (const unit of attackers) {
    if (units.includes(unit)) {
      unit.row = fromHex.row;
      unit.col = fromHex.col;
    }
  }
}
  // Show results
  const combatInfo = document.getElementById("combat-info");
  combatInfo.innerHTML = combatResultText;

  document.getElementById("continue-button").style.display = "block";
}

document.getElementById("continue-button").addEventListener("click", () => {
  document.getElementById("combat-panel").style.display = "none";
  document.getElementById("continue-button").style.display = "none";
  highlightedTiles = [];
  drawMap();
  startCombatResolution();
});