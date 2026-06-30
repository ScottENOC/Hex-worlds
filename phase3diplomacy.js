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

function getPersonalityCard(kingdom) {
  const cardId = typeof personalityCards !== "undefined" ? personalityCards[kingdom] : null;
  return cardId != null && typeof PERSONALITY_CARDS !== "undefined" ? PERSONALITY_CARDS[cardId] : null;
}

function isAmbassadorBanned(faction, kingdom) {
  return ambassadorBanned[faction]?.has(kingdom) ?? false;
}

function banAmbassador(faction, kingdom) {
  if (!ambassadorBanned[faction]) ambassadorBanned[faction] = new Set();
  ambassadorBanned[faction].add(kingdom);
  alert(`${faction.toUpperCase()}'s ambassador has been BANISHED from ${kingdom.toUpperCase()}! They may no longer conduct diplomacy there.`);
}

// ── Barbarian Recruiting ───────────────────────────────────────────────────────
function handleBarbarianRecruiting(faction, onComplete) {
  const input = prompt(
    `${faction.toUpperCase()} — BARBARIAN RECRUITING (Advanced)\n\n` +
    `Place ambassador on a clear, unclaimed hex on the north (row 0-1) or south (row 28+) map edge.\n\n` +
    `Enter target hex as "row,col", or leave blank to skip:`
  );
  if (!input?.trim()) { onComplete(); return; }

  const parts = input.trim().split(",").map(s => parseInt(s.trim(), 10));
  if (parts.length !== 2 || parts.some(isNaN)) { alert("Invalid hex — skipping."); onComplete(); return; }
  const [row, col] = parts;

  const key = `${row},${col}`;
  const tile = tileData[key];
  const isEdge = row <= 1 || row >= 28;
  const isUnclaimed = !tile || !tile.faction || tile.faction === "none";
  const terrains = Array.isArray(tile?.terrain) ? tile.terrain : tile?.terrain ? [tile.terrain] : [];
  const isClear = terrains.length === 0 || terrains.includes("plains");
  const hasEnemies = units.some(u => u.row === row && u.col === col && u.faction !== faction);

  if (!isEdge) { alert("Hex must be on the north (row 0-1) or south (row 28+) map edge."); onComplete(); return; }
  if (!isUnclaimed) { alert("Hex must be unclaimed (pale brown) territory."); onComplete(); return; }
  if (!isClear) { alert("Hex must be clear terrain (no forest, mountain, hills, etc.)."); onComplete(); return; }
  if (hasEnemies) { alert("Hex is occupied by enemy forces."); onComplete(); return; }

  const roll = Math.ceil(Math.random() * 6);

  if (roll >= 3) {
    const available = barbarianPool.filter(b => b.faction === null);
    const ownedCount = units.filter(u => u.isBarbarian && u.faction === faction).length;
    const cap = 15;
    const canRecruit = Math.min(roll, available.length, cap - ownedCount);

    if (!barbarianOwners[faction]) {
      const tribeChoice = prompt(
        `Choose your Barbarian tribe:\n` +
        BARBARIAN_TRIBES.map((t, i) => `${i+1}. ${t}`).join("\n") +
        `\n\nEnter number 1-6:`
      );
      const idx = parseInt(tribeChoice, 10) - 1;
      const tribe = BARBARIAN_TRIBES[idx] ?? BARBARIAN_TRIBES[0];
      barbarianOwners[faction] = { tribe, inPlay: 0 };
      alert(`${faction} tribe: ${tribe}`);
    }

    let recruited = 0;
    for (let i = 0; i < canRecruit; i++) {
      const b = available[i];
      b.faction = faction; b.row = row; b.col = col;
      b.hasMoved = true; b.justRecruited = true;
      units.push(b);
      barbarianPool.splice(barbarianPool.indexOf(b), 1);
      recruited++;
    }
    alert(`Die roll: ${roll} — ${recruited} Barbarian(s) join ${faction} at (${row},${col})!\nThey may not move or attack this turn.`);
  } else {
    const friendly = units.filter(u => u.isBarbarian && u.faction === faction);
    const toRemove = Math.min(roll, friendly.length);
    for (let i = 0; i < toRemove; i++) {
      const b = friendly[i];
      units.splice(units.indexOf(b), 1);
      b.faction = null; b.row = undefined; b.col = undefined;
      barbarianPool.push(b);
    }
    alert(`Die roll: ${roll} — ${toRemove} Barbarian(s) of ${faction} desert.`);

    if (roll === 1) {
      alert(`The Barbarians burn your ambassador! Out of play for 2 turns.`);
      if (!ambassadorStatus[faction]) ambassadorStatus[faction] = {};
      ambassadorStatus[faction].deadUntilTurn = (turnNumber || 1) + 2;
    }
  }

  drawMap();
  onComplete();
}

// ── Special Mercenary Recruiting ──────────────────────────────────────────────
// Called when a player plays a specialMerc card from their hand.
function handleSpecialMercCard(faction, card, onComplete) {
  const { mercType, entryType, entryHex, entryName } = card;
  const pool = specialMercPool[mercType];
  if (!pool) { alert(`No pool found for ${mercType}.`); onComplete(); return; }

  const available = pool.filter(u => u.faction === null);
  if (!available.length) { alert(`${card.label} is already in play — card discarded.`); onComplete(); return; }

  let targetRow, targetCol;

  if (entryType === "fixed") {
    const [r, c] = entryHex.split(",").map(Number);
    targetRow = r; targetCol = c;

  } else if (entryType === "friendlyCastle") {
    const castles = Object.entries(tileData)
      .filter(([, t]) => t.isFortress && t.faction === faction)
      .map(([k]) => k);
    if (!castles.length) { alert("No friendly castles available."); onComplete(); return; }
    const pick = prompt(`${card.label}\nChoose a friendly castle:\n${castles.join(', ')}\n\nEnter hex (row,col):`);
    const parts = pick?.trim().split(",").map(Number);
    if (!parts || parts.length !== 2 || parts.some(isNaN)) { onComplete(); return; }
    [targetRow, targetCol] = parts;
    if (!tileData[`${targetRow},${targetCol}`]?.isFortress || tileData[`${targetRow},${targetCol}`].faction !== faction) {
      alert("Not a friendly castle."); onComplete(); return;
    }

  } else if (entryType === "friendlyPort") {
    const ports = Object.entries(tileData)
      .filter(([, t]) => t.isPort && t.faction === faction)
      .map(([k]) => k);
    if (!ports.length) { alert("No friendly seaports available — Bilge Rat cannot be recruited."); onComplete(); return; }
    // Reaver can only enter on Great Sea / Sea of Drowning Men ports — player picks
    const pick = prompt(`${card.label}\nChoose a friendly seaport:\n${ports.join(', ')}\n\nEnter hex (row,col):`);
    const parts = pick?.trim().split(",").map(Number);
    if (!parts || parts.length !== 2 || parts.some(isNaN)) { onComplete(); return; }
    [targetRow, targetCol] = parts;

  } else if (entryType === "friendlyNonCastle") {
    const pick = prompt(`${card.label}\nEnter any friendly non-castle land hex (row,col):`);
    const parts = pick?.trim().split(",").map(Number);
    if (!parts || parts.length !== 2 || parts.some(isNaN)) { onComplete(); return; }
    [targetRow, targetCol] = parts;
    const t = tileData[`${targetRow},${targetCol}`];
    if (!t || t.faction !== faction || t.isFortress) { alert("Must be a friendly non-castle hex."); onComplete(); return; }

  } else if (entryType === "confusedKingdom") {
    // Usurper: enter at royal castle of a kingdom whose monarch is dead
    // For now, player specifies the castle hex manually
    const pick = prompt(`${card.label}\nEnter the royal castle hex of a kingdom in confusion (row,col):`);
    const parts = pick?.trim().split(",").map(Number);
    if (!parts || parts.length !== 2 || parts.some(isNaN)) { onComplete(); return; }
    [targetRow, targetCol] = parts;
  }

  // Check not enemy-occupied
  const enemyAtTarget = units.some(u => u.row === targetRow && u.col === targetCol &&
    u.faction !== faction && !neutralFactions.has(u.faction));
  if (enemyAtTarget) { alert(`${entryName} is enemy-occupied — cannot recruit there.`); onComplete(); return; }

  // Special case: Wandering People gifts go to royal castle
  if (mercType === "wanderingPeople") {
    const royalCastle = Object.entries(tileData).find(([, t]) => t.isCapital && t.faction === faction);
    if (royalCastle) {
      royalCastle[1].wanderingPeopleGifts = ["Flying Carpet", "Spinning Wheel", "Guiding Light"];
      alert(`The Wandering People's gifts (Flying Carpet, Spinning Wheel, Guiding Light) are placed at ${royalCastle[1].name || royalCastle[0]}.`);
    }
    // Immovable marker stays at entry hex; troop is also placed there
  }

  // Place all units from the pool at the target hex
  for (const u of available) {
    u.faction = faction;
    u.row = targetRow;
    u.col = targetCol;
    u.hasMoved = false;
    units.push(u);
  }

  const count = available.length > 1 ? `${available.length}× ` : "";
  alert(`${faction.toUpperCase()} enters ${count}${card.label} at (${targetRow},${targetCol}) — ${entryName}!`);
  drawMap();
  onComplete();
}

// ── Standard Diplomacy ─────────────────────────────────────────────────────────
function handleDiploPlayPhase(faction, onComplete) {
  const hand = diplomacyHands[faction] || [];
  const kingdoms = getNeutralKingdoms().filter(k => !isAmbassadorBanned(faction, k));
  const regularCards = hand.filter(c => c.type !== "specialMerc");
  const mercCards    = hand.filter(c => c.type === "specialMerc");
  const wizardKingdoms = kingdoms.filter(k => k === "eaters" || k === "black_hand");
  const hasRegular   = regularCards.length > 0;
  const hasKingdoms  = kingdoms.length > 0;

  const handDisplay = hand.map((c, i) => `  ${i}: ${c.label || `+${c.value}`}`).join('\n');

  const options = [];
  if (hasKingdoms) options.push("1. Send ambassador (bare roll, need 6+; or optionally play a card for bonus)");
  if (mercCards.length) options.push("2. Play a special mercenary card");
  options.push("3. Recruit Barbarians (Advanced)");
  options.push("0. Skip");

  const choice = prompt(
    `${faction.toUpperCase()} — DIPLOMACY\nHand:\n${handDisplay || "  (empty)"}\n\n` +
    options.join('\n') + `\n\nEnter number:`
  );
  const c = parseInt(choice?.trim(), 10);

  if (c === 1 && hasKingdoms) {
    const kingdomStr = kingdoms.join(', ');
    const raw = prompt(`Which neutral kingdom?\n${kingdomStr}`);
    const matched = kingdoms.find(k => k.toLowerCase() === (raw || '').trim().toLowerCase());
    if (!matched) { alert('Invalid kingdom — passing.'); onComplete(); return; }

    // Wizard factions ignore card value — offer bare roll or waste a card
    const isWizard = matched === "eaters" || matched === "black_hand";
    if (isWizard) {
      rollBareAmbassador(faction, matched, onComplete);
      return;
    }

    // Regular kingdom: optionally play a card for a bonus
    let card = null;
    if (regularCards.length) {
      const regularDisplay = regularCards.map((c, i) => `  ${i}: ${c.label || `+${c.value}`}`).join('\n');
      const cardIdx = parseInt(prompt(`Play a card for a bonus? (blank/cancel for bare roll)\n${regularDisplay}\n\nEnter index, or leave blank to roll bare:`), 10);
      if (!isNaN(cardIdx) && cardIdx >= 0 && cardIdx < regularCards.length) {
        card = regularCards[cardIdx];
        hand.splice(hand.indexOf(card), 1);
      }
    }

    if (card) {
      playDiplomaticCard(faction, card, matched, onComplete);
    } else {
      rollBareAmbassador(faction, matched, onComplete);
    }

  } else if (c === 2 && mercCards.length) {
    const mercDisplay = mercCards.map((mc, i) => `  ${i}: ${mc.label} (entry: ${mc.entryName})`).join('\n');
    const cardIdx = parseInt(prompt(`Choose a special merc card:\n${mercDisplay}\n\nEnter index:`), 10);
    if (isNaN(cardIdx) || cardIdx < 0 || cardIdx >= mercCards.length) { onComplete(); return; }
    const card = mercCards[cardIdx];
    hand.splice(hand.indexOf(card), 1);
    handleSpecialMercCard(faction, card, onComplete);

  } else if (c === 3) {
    handleBarbarianRecruiting(faction, onComplete);

  } else {
    if (c !== 0) alert(`${faction} passes diplomacy.`);
    onComplete();
  }
}

// Bare d6 roll with no card — needs 6+ to succeed. Works for any kingdom.
// Wizard factions always use this path (they ignore card values).
function rollBareAmbassador(faction, kingdom, onComplete) {
  const pCard = getPersonalityCard(kingdom);
  const pCardNote = pCard ? `\n[Personality: ${pCard.name} — ${pCard.desc}]` : "";
  const roll = Math.ceil(Math.random() * 6);
  const name = kingdom.replace(/_/g, " ");
  alert(`${faction.toUpperCase()} → ${name.toUpperCase()} (bare roll — no card)${pCardNote}\nRoll: ${roll} (need 6+)\n${roll >= 6 ? "✓ Joins your alliance!" : "✗ No effect."}`);
  if (roll >= 6) formAlliance(faction, kingdom);
  onComplete();
}

function playDiplomaticCard(faction, card, kingdom, onComplete) {
  // Magicians: immune to cards, need unmodified roll of 6; card is still consumed
  if (kingdom === "eaters" || kingdom === "black_hand") {
    const roll = Math.ceil(Math.random() * 6);
    const name = kingdom === "eaters" ? "Eaters of Wisdom" : "Black Hand";
    alert(`${faction.toUpperCase()} → ${name}\nCard discarded (Magicians ignore Diplomacy cards).\nRoll: ${roll}${roll === 6 ? "\n✓ Joins your alliance!" : "\n✗ No effect."}`);
    if (roll === 6) formAlliance(faction, kingdom);
    onComplete(); return;
  }

  // Reveal personality card on first ambassador contact
  const pCard = getPersonalityCard(kingdom);
  const pCardNote = pCard ? `\n[Personality: ${pCard.name} — ${pCard.desc}]` : "";

  // Personality card #11: bribeBonus when a bribe-type card is played
  const bribeBonus = (pCard?.bribeBonus && card.isBribe) ? pCard.bribeBonus : 0;

  const roll = Math.ceil(Math.random() * 6);
  const total = roll + (card.value || 0) + bribeBonus;
  const success = total >= 6;
  const bonusNote = bribeBonus ? ` + bribe +${bribeBonus}` : "";

  alert(
    `${faction.toUpperCase()} plays "${card.label}" on ${kingdom.toUpperCase()}${pCardNote}\n` +
    `Roll: ${roll} + ${card.value || 0}${bonusNote} = ${total} (need 7+)\n` +
    (success ? `✓ ${kingdom} joins your alliance!` : `✗ Failed.`)
  );

  if (success) {
    formAlliance(faction, kingdom);
  } else if (card.canBanish) {
    // Crass bribe immunity from personality card #11
    const immune = card.type === "crassBribe" && pCard?.crassBribeImmunity;
    if (!immune) {
      const banRoll = Math.ceil(Math.random() * 6);
      if (banRoll <= 2) {
        banAmbassador(faction, kingdom);
      } else {
        alert(`Close call — ambassador escapes banishment (roll: ${banRoll}).`);
      }
    }
  }

  onComplete();
}

function formAlliance(faction, kingdom) {
  alert(`${kingdom.toUpperCase()} joins forces with ${faction.toUpperCase()}!`);

  for (const key in tileData) {
    const tile = tileData[key];
    if (tile.faction === kingdom && tile.isFortress) {
      tile.allyOf = faction;
      tile.faction = faction;
    }
  }

  for (const u of units) {
    if (u.faction === kingdom) u.faction = faction;
  }

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
