// Returns the list of neutral kingdoms currently present on the map as fortresses.
function getNeutralKingdoms() {
  const playerFactions = new Set(Object.keys(factions).filter(f => f !== "none"));
  const result = new Set();
  for (const key in tileData) {
    const tile = tileData[key];
    if (tile?.isFortress && tile.faction && !playerFactions.has(tile.faction)) {
      result.add(tile.faction);
    }
  }
  return Array.from(result);
}

// Prompt the active faction to play a card from their hand against a neutral kingdom.
function handleDiploPlayPhase(faction, onComplete) {
  const hand = diplomacyHands[faction] || [];
  const kingdoms = getNeutralKingdoms();

  if (hand.length === 0 || kingdoms.length === 0) {
    if (kingdoms.length === 0) {
      alert(`${faction.toUpperCase()}: No neutral kingdoms on the map yet — diplomacy skipped.`);
    } else {
      alert(`${faction.toUpperCase()}: No diplomatic cards in hand — pass.`);
    }
    onComplete();
    return;
  }

  const handStr = hand.map((c, i) => `  ${i}: +${c.value}`).join('\n');
  const kingdomStr = kingdoms.join(', ');

  const cardChoice = prompt(
    `${faction.toUpperCase()} — DIPLOMACY\n\nHand:\n${handStr}\n\nNeutral kingdoms: ${kingdomStr}\n\nEnter card number to play, or leave blank to skip:`
  );

  if (!cardChoice || cardChoice.trim() === '') {
    alert(`${faction} passes diplomacy this turn.`);
    onComplete();
    return;
  }

  const cardIndex = parseInt(cardChoice.trim(), 10);
  if (isNaN(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) {
    alert('Invalid card selection — passing.');
    onComplete();
    return;
  }

  const kingdom = prompt(`Which kingdom?\n${kingdomStr}\n\nType kingdom name exactly:`);
  if (!kingdom || !kingdoms.includes(kingdom.trim().toLowerCase())) {
    // Try case-insensitive match
    const matched = kingdoms.find(k => k.toLowerCase() === (kingdom || '').trim().toLowerCase());
    if (!matched) {
      alert('Invalid kingdom — passing.');
      onComplete();
      return;
    }
    playDiplomaticCard(faction, hand.splice(cardIndex, 1)[0], matched, onComplete);
    return;
  }

  playDiplomaticCard(faction, hand.splice(cardIndex, 1)[0], kingdom.trim().toLowerCase(), onComplete);
}

function playDiplomaticCard(faction, card, kingdom, onComplete) {
  if (!diplomaticInfluence[kingdom]) {
    diplomaticInfluence[kingdom] = {};
    for (const f of factionList) diplomaticInfluence[kingdom][f] = 0;
  }

  diplomaticInfluence[kingdom][faction] = (diplomaticInfluence[kingdom][faction] || 0) + card.value;
  const score = diplomaticInfluence[kingdom][faction];

  alert(`${faction.toUpperCase()} plays +${card.value} on ${kingdom}.\nInfluence: ${score} / 10`);

  if (score >= 10) {
    formAlliance(faction, kingdom);
  }

  onComplete();
}

function formAlliance(faction, kingdom) {
  alert(`${kingdom.toUpperCase()} joins forces with ${faction.toUpperCase()}!`);

  // Transfer fortress ownership so the new ally's castles show under the correct colour.
  for (const key in tileData) {
    const tile = tileData[key];
    if (tile.faction === kingdom && tile.isFortress) {
      tile.allyOf = faction;  // track origin
      tile.faction = faction;
    }
  }

  // Transfer any neutral kingdom units to the new ally.
  for (const u of units) {
    if (u.faction === kingdom) u.faction = faction;
  }

  // Reward VP proportional to fortress strength.
  let vpGain = 0;
  for (const key in tileData) {
    const t = tileData[key];
    if (t.allyOf === faction && t.isFortress) vpGain += (t.fortressStrength || 1) * 5;
  }
  if (vpGain > 0) addVictoryPoints(faction, vpGain);

  delete diplomaticInfluence[kingdom];
  drawMap();
  updateVPInfo();
}
