const svg = document.getElementById("map");
const info = document.getElementById("info");
const turnInfo = document.getElementById("turnInfo");
const vpInfo = document.getElementById("vpInfo");

// Shuffle and deal personality cards to all neutral non-player kingdoms.
// In a full game each kingdom gets a unique card; duplicates should not normally occur.
// If we have fewer card definitions than neutral kingdoms (e.g. during development when
// only a subset of cards are coded), we cycle through the available cards rather than
// crashing — a kingdom may share a card type with another, which is acceptable as a
// temporary state until the full 20-card personality deck is implemented.
function assignPersonalityCards() {
  const cardIds = Object.keys(PERSONALITY_CARDS).map(Number);
  if (!cardIds.length) return;

  const neutralKingdoms = [
    ...Object.keys(neutralKingdomColors),
    ...Object.keys(factions).filter(f => f !== "none" && controlTypes[f] === "neutral")
  ];

  // Build a deck large enough to cover all kingdoms (cycle if needed)
  const deck = [];
  for (let i = 0; i < neutralKingdoms.length; i++) {
    deck.push(cardIds[i % cardIds.length]);
  }
  // Fisher-Yates shuffle so assignment is random even when cycling
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  for (let i = 0; i < neutralKingdoms.length; i++) {
    personalityCards[neutralKingdoms[i]] = deck[i];
  }
}

// initGame is called by setup.js once the player configuration is known.
function initGame({ players } = {}) {
  // Build turn order from human + cpu players only
  if (players && players.length) {
    turnOrder = players.map(p => p.faction);
  } else {
    // Fallback: all non-neutral factions
    turnOrder = factionList.filter(f => controlTypes[f] !== "neutral");
    if (!turnOrder.length) turnOrder = [...factionList];
  }
  shuffle(turnOrder);
  currentTurnIndex = 0;

  diploDeck = buildDiploDeck();
  initDiplomaticInfluence();
  assignPersonalityCards();
  drawMap();
  updateTurnInfo();
  updateVPInfo();
  resetEatersSpellsForTurn();

  dispatchCPUIfNeeded();
}

// ---------------------------
// TEMPLE OF KINGS TEST OF GODS
// ---------------------------
// Called at the start of a faction's combat phase.
// Each monarch (leader) of this faction who is in the Temple hex undergoes the Test.
// Roll: 1=death, 2-5=magic gift, 6=enchanted sleep.
// Sleeping monarchs can only be rescued (carried out) by another monarch.
function runTempleOfKingsTests(faction) {
  // Find the Temple hex
  let templeKey = null;
  for (const k in tileData) {
    if (tileData[k].isTempleOfKings) { templeKey = k; break; }
  }
  if (!templeKey) return;

  const [tRow, tCol] = templeKey.split(",").map(Number);
  const monarchsInTemple = units.filter(u =>
    u.isLeader && u.faction === faction && u.row === tRow && u.col === tCol && !u.isEatersOfWisdom
  );

  for (const monarch of monarchsInTemple) {
    // Sleeping monarchs can't take the test again until rescued
    if (monarch.templeSleep) continue;

    // Non-sleeping monarch staying more than 1 consecutive turn without doing anything
    // becomes Dream of Paradise (treated as death). Track with templeEntryTurn.
    if (monarch.templeEntryTurn !== undefined && monarch.templeEntryTurn !== turnNumber &&
        !monarch.templeActedThisTurn) {
      alert(`${monarch.name || monarch.faction} monarch has been lost in the Dream of Paradise in the Temple of Kings! They abandon secular life and are removed from play.`);
      fateDieRoll(monarch); // use fate die roll to handle death/removal
      continue;
    }

    const roll = Math.ceil(Math.random() * 6);
    monarch.templeEntryTurn = monarch.templeEntryTurn ?? turnNumber;
    monarch.templeActedThisTurn = true;

    if (roll === 1) {
      alert(`${monarch.name || faction} takes the Test of the Gods in the Temple of Kings!\nRoll: 1 — The gods slay the monarch instantly!`);
      removeUnit(monarch);
    } else if (roll === 6) {
      alert(`${monarch.name || faction} takes the Test of the Gods in the Temple of Kings!\nRoll: 6 — The monarch falls into an Enchanted Sleep!\nThey may only leave if carried out by another friendly monarch.`);
      monarch.templeSleep = true;
      // Sleeping monarch: all their units get -1 to combat/siege rolls
      // (tracked via monarchSleepPenalty flag, applied in combat resolution)
    } else {
      // 2-5: receive magic gift (draw from gift pool)
      const gifts = ["Helm of Wisdom", "Airboat of Armera", "Talisman of Dispel", "Mask of Influence", "Wand of Healing", "Sword of Wizardry"];
      const availableGifts = gifts.filter(g => !units.some(u => u.magicGift === g));
      if (!availableGifts.length) {
        alert(`${monarch.name || faction} takes the Test of the Gods!\nRoll: ${roll} — A gift is granted, but all gifts are taken!`);
      } else {
        const gift = availableGifts[Math.floor(Math.random() * availableGifts.length)];
        monarch.magicGift = gift;
        alert(`${monarch.name || faction} takes the Test of the Gods in the Temple of Kings!\nRoll: ${roll} — The gods grant: ${gift}!`);
      }
    }
  }
}

// ---------------------------
// END TURN
// ---------------------------
function endTurn() {
  const currentFaction = turnOrder[currentTurnIndex];

  // Reset unit movement state
  for (const unit of units) {
    if (unit.faction === currentFaction) {
      unit.hasMoved = false;
      unit.justRecruited = false; // Barbarians can move normally from second turn
    }
  }

  // ── EVENT ─────────────────────────────────────────────────────────────────
  if (currentPhase === "event") {
    resetEatersSpellsForTurn();
    if (controlTypes[currentFaction] === "cpu") {
      cpuEvent(currentFaction);
      return;
    }
    handleEventPhase(currentFaction);
    return;
  }

  // ── DIPLO DRAW ────────────────────────────────────────────────────────────
  if (currentPhase === "diplo-draw") {
    if (controlTypes[currentFaction] === "cpu") {
      cpuDiploDrawAuto();
      return;
    }
    handleDiploDrawPhase(currentFaction, () => {
      currentPhase = "diplo-play";
      updateTurnInfo();
      dispatchCPUIfNeeded();
    });
    return;
  }

  // ── DIPLO PLAY ────────────────────────────────────────────────────────────
  if (currentPhase === "diplo-play") {
    if (controlTypes[currentFaction] === "cpu") {
      // CPU skips diplomacy for now
      currentPhase = "siege";
      updateTurnInfo();
      dispatchCPUIfNeeded();
      return;
    }
    handleDiploPlayPhase(currentFaction, () => {
      currentPhase = "siege";
      updateTurnInfo();
      dispatchCPUIfNeeded();
    });
    return;
  }

  // ── SIEGE ─────────────────────────────────────────────────────────────────
  if (currentPhase === "siege") {
    const besiegedFortresses = getBesiegedFortresses();

    for (const hex of besiegedFortresses) {
      const [row, col] = hex.split(",").map(Number);
      const tileKey = `${row},${col}`;
      const tile = tileData[tileKey];
      if (!tile?.isFortress) continue;
      if (tile.faction === currentFaction) continue;

      const adjacentCoords = getAdjacentCoords(row, col);
      const adjacentAttackers = units.filter(u =>
        u.faction === currentFaction &&
        adjacentCoords.some(([r, c]) => u.row === r && u.col === c)
      );
      if (!adjacentAttackers.length) continue;

      const defendersInFortress = units.filter(u => u.faction === tile.faction && u.row === row && u.col === col);
      let attackerStrength = adjacentAttackers.reduce((s, u) => s + (u.siegeStrength || 0), 0);
      let defenderStrength = (tile.fortressStrength || 0) + defendersInFortress.reduce((s, u) => s + (u.siegeStrength || 0), 0);
      const bonus = Math.max(0, defenderStrength > 0 ? Math.floor(attackerStrength / defenderStrength) - 1 : 0);
      // Ogsbogg adds +1 to the siege die roll when participating
      const ogsboggBonus = adjacentAttackers.some(u => u.isOgsbogg) ? 1 : 0;
      const roll = Math.ceil(Math.random() * 6);
      const total = roll + bonus + ogsboggBonus;

      alert(`Siege at (${row},${col}): roll ${roll} + ratio-bonus ${bonus}${ogsboggBonus ? ` + Ogsbogg +${ogsboggBonus}` : ''} = ${total}`);

      if (total >= 6) {
        for (const u of [...defendersInFortress]) {
          if (!u.isLeader) removeUnit(u);
        }
        for (const u of defendersInFortress) {
          if (u.isLeader) fateDieRoll(u);
        }
        const vpGain = tile.stubstaffVP ?? (5 * (tile.fortressStrength || 1));
        addVictoryPoints(currentFaction, vpGain);
        updateVPInfo();
        tileData[tileKey].fortressStrength = 0;
        // Destroy Enchanted Castle if active on this hex
        const e = getEaters && getEaters();
        if (e && e.enchantedCastleActive && e.row === row && e.col === col) e.enchantedCastleActive = false;
        alert(`Fortress at (${row},${col}) has fallen!`);
        for (const a of adjacentAttackers) { a.row = row; a.col = col; }

        // Barbarians take their share and return home after a successful siege
        const barbsInvolved = adjacentAttackers.filter(u => u.isBarbarian);
        for (const b of barbsInvolved) {
          units.splice(units.indexOf(b), 1);
          b.faction = null; b.row = undefined; b.col = undefined;
          if (typeof barbarianPool !== "undefined") barbarianPool.push(b);
        }
        if (barbsInvolved.length) alert(`${barbsInvolved.length} Barbarian(s) took their plunder and returned home.`);
      }
    }

    currentPhase = "movement";

    // Show Bridge spell option at start of movement if Eaters are present
    if (eatersOwnedByCurrentFaction && eatersOwnedByCurrentFaction()) {
      showSpellPanel("movement", () => { drawMap(); updateTurnInfo(); dispatchCPUIfNeeded(); });
    } else {
      drawMap(); updateTurnInfo(); dispatchCPUIfNeeded();
    }
    return;
  }

  // ── MOVEMENT ──────────────────────────────────────────────────────────────
  if (currentPhase === "movement") {
    currentPhase = "combat-declare";
    // Offer Vortex/Reflector at start of combat-declare
    if (eatersOwnedByCurrentFaction && eatersOwnedByCurrentFaction()) {
      showSpellPanel("combat", () => { updateTurnInfo(); dispatchCPUIfNeeded(); });
    } else {
      updateTurnInfo(); dispatchCPUIfNeeded();
    }
    return;
  }

  // ── COMBAT DECLARE ────────────────────────────────────────────────────────
  if (currentPhase === "combat-declare") {
    // Temple of Kings: any monarch of this faction in the Temple takes the Test of Gods
    runTempleOfKingsTests(currentFaction);

    currentPhase = "combat-resolve";
    if (declaredCombats.length === 0) {
      // No combats — offer end-of-turn spells then advance
      offerEndOfTurnSpells(currentFaction, advanceTurn);
      return;
    }
    startCombatResolution();
    updateTurnInfo();
    return;
  }

  // ── COMBAT RESOLVE ────────────────────────────────────────────────────────
  if (currentPhase === "combat-resolve") {
    offerEndOfTurnSpells(currentFaction, advanceTurn);
  }
}

function offerEndOfTurnSpells(faction, onDone) {
  if (typeof eatersOwnedByCurrentFaction === "function" && eatersOwnedByCurrentFaction()) {
    showSpellPanel("endturn", onDone);
  } else {
    onDone();
  }
}

function advanceTurn() {
  currentTurnIndex = (currentTurnIndex + 1) % turnOrder.length;

  if (currentTurnIndex === 0) {
    if (turnNumber === maxTurns) {
      const entries = Object.entries(victoryPoints).sort((a, b) => b[1] - a[1]);
      const [winner, score] = entries[0];
      alert(`Game over! ${winner} wins with ${score} VP.`);
    }
    turnNumber++;
  }

  for (const unit of units) {
    if (unit.isLeader) unit.hasTakenAFateDieRoll = false;
  }

  currentPhase = "event";
  declaredCombats = [];
  selectedUnit = null;

  drawMap();
  updateTurnInfo();
  dispatchCPUIfNeeded();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(() => console.log('Service Worker registered!'))
    .catch(err => console.error('SW failed:', err));
}
