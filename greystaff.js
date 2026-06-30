// greystaff.js — Altars of Greystaff sacrifice and boons

// Returns the tile of the Altars of Greystaff, or null
function getGreystaffTile() {
  for (const k in tileData) {
    if (tileData[k].isAltarsOfGreystaff) return { key: k, ...tileData[k] };
  }
  return null;
}

// Called at the end of a faction's turn if they have a unit at the Altars
function offerGreystaffSacrifice(faction, onDone) {
  const gt = getGreystaffTile();
  if (!gt) { onDone(); return; }
  const [gRow, gCol] = gt.key.split(',').map(Number);

  // Eligible sacrifice candidates: non-magical, non-barbarian combat units of this faction at the Altars
  const eligible = units.filter(u =>
    u.faction === faction &&
    u.row === gRow && u.col === gCol &&
    !u.isLeader && !u.isMagical && !u.isBarbarian &&
    (u.combatStrength || 0) > 0
  );

  if (!eligible.length) { onDone(); return; }

  const sacrificeUnit = eligible[0];
  const doSacrifice = confirm(
    `A unit of ${faction} stands at the Altars of Greystaff!\n` +
    `Sacrifice a combat unit to receive a Boon of Greystaff?`
  );
  if (!doSacrifice) { onDone(); return; }

  removeUnit(sacrificeUnit);
  _chooseBoon(faction, onDone);
}

function _chooseBoon(faction, onDone) {
  const boons = [
    "Earthquake — destroy a castle (roll 4-6)",
    "Devil Wind — destroy a flying unit (roll 4-6)",
    "Steal a Gift — steal a magic item from a monarch",
    "Firestorm — attack any land/coastal hex (roll 4-6 to ignite)",
    "Possession — swap a neutral monarch's personality card",
    "Tempest — attack a fleet stack at open sea (roll 4-6)",
  ];
  const choice = prompt(
    `Choose your Boon of Greystaff:\n` +
    boons.map((b, i) => `${i + 1}. ${b}`).join('\n') +
    `\n\nEnter 1-6:`
  );
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx > 5) {
    alert("Invalid choice — boon forfeit.");
    onDone();
    return;
  }
  _resolveBoon(faction, idx, onDone);
}

function _resolveBoon(faction, idx, onDone) {
  switch (idx) {
    case 0: _boonEarthquake(onDone); break;
    case 1: _boonDevilWind(onDone); break;
    case 2: _boonStealGift(faction, onDone); break;
    case 3: _boonFirestorm(onDone); break;
    case 4: _boonPossession(onDone); break;
    case 5: _boonTempest(onDone); break;
  }
}

// ── EARTHQUAKE ───────────────────────────────────────────────────────────────
function _boonEarthquake(onDone) {
  const target = prompt("Earthquake: Enter target hex as row,col:");
  if (!target) { onDone(); return; }
  const [r, c] = target.split(',').map(Number);
  const tile = tileData[`${r},${c}`];
  if (!tile?.isFortress) { alert("No castle at that hex."); onDone(); return; }

  const roll = Math.ceil(Math.random() * 6);
  alert(`Earthquake at (${r},${c}) — Roll: ${roll}`);
  if (roll < 4) { alert("The earth barely trembles. No effect."); onDone(); return; }

  alert("The castle is destroyed by an earthquake!");
  tile.isFortress = false;
  tile.fortressStrength = 0;

  // Test each unit in the hex
  const inHex = units.filter(u => u.row === r && u.col === c);
  for (const u of [...inHex]) {
    if (u.isLeader) { fateDieRoll(u); continue; }
    const uRoll = Math.ceil(Math.random() * 6);
    if (uRoll >= 4) { removeUnit(u); alert(`A unit at (${r},${c}) perished in the earthquake! (${uRoll})`); }
    else alert(`A unit at (${r},${c}) survived the earthquake. (${uRoll})`);
  }
  drawMap();
  onDone();
}

// ── DEVIL WIND ───────────────────────────────────────────────────────────────
function _boonDevilWind(onDone) {
  const flyingUnits = units.filter(u => u.isFlying);
  if (!flyingUnits.length) { alert("No flying units on the map."); onDone(); return; }

  const list = flyingUnits.map((u, i) => `${i + 1}. ${u.name || u.faction} at (${u.row},${u.col})`).join('\n');
  const choice = parseInt(prompt(`Devil Wind: Choose flying unit to attack:\n${list}\nEnter number:`)) - 1;
  if (isNaN(choice) || choice < 0 || choice >= flyingUnits.length) { alert("Invalid."); onDone(); return; }

  const target = flyingUnits[choice];
  const roll = Math.ceil(Math.random() * 6);
  alert(`Devil Wind attacks ${target.name || target.faction} — Roll: ${roll}`);
  if (roll >= 4) {
    alert(`${target.name || target.faction} is destroyed by the Devil Wind!`);
    // Any leaders aboard also die
    const aboard = units.filter(u => u.isLeader && u.row === target.row && u.col === target.col && !u.isFlying);
    for (const l of aboard) fateDieRoll(l);
    removeUnit(target);
    drawMap();
  } else {
    alert("The air spirits fail. No effect.");
  }
  onDone();
}

// ── STEAL A GIFT ─────────────────────────────────────────────────────────────
function _boonStealGift(greystaffOwner, onDone) {
  const monarchsWithGifts = units.filter(u => u.isLeader && u.magicGift);
  if (!monarchsWithGifts.length) { alert("No monarchs hold a Temple gift."); onDone(); return; }

  const list = monarchsWithGifts.map((u, i) => `${i + 1}. ${u.faction} — ${u.magicGift}`).join('\n');
  const choice = parseInt(prompt(`Steal a Gift: Choose target monarch:\n${list}\nEnter number:`)) - 1;
  if (isNaN(choice) || choice < 0 || choice >= monarchsWithGifts.length) { alert("Invalid."); onDone(); return; }

  const victim = monarchsWithGifts[choice];
  const roll = Math.ceil(Math.random() * 6);
  alert(`The imp rolls: ${roll}`);
  if (roll === 6) {
    // Stolen — give to a monarch of the greystaffOwner
    const recipient = prompt(
      `Gift stolen! Assign "${victim.magicGift}" to which monarch of ${greystaffOwner}?\n` +
      `(Enter faction or press OK for current monarch)`
    ) || greystaffOwner;
    const recipientMonarch = units.find(u => u.isLeader && u.faction === (recipient || greystaffOwner) && !u.magicGift);
    if (recipientMonarch) { recipientMonarch.magicGift = victim.magicGift; alert(`${recipientMonarch.faction} receives ${victim.magicGift}!`); }
    else alert(`${victim.magicGift} stolen but no eligible recipient — gift is lost.`);
    victim.magicGift = null;
  } else if (roll === 1) {
    alert(`The imp fumbles — ${victim.magicGift} is destroyed!`);
    victim.magicGift = null;
  } else {
    alert("The imp fails to steal the gift (2-5 — no effect).");
  }
  onDone();
}

// ── FIRESTORM ─────────────────────────────────────────────────────────────────
function _boonFirestorm(onDone) {
  const target = prompt("Firestorm: Enter target hex as row,col (land or coastal only):");
  if (!target) { onDone(); return; }
  const [r, c] = target.split(',').map(Number);
  const tile = tileData[`${r},${c}`];
  if (!tile) { alert("No tile found."); onDone(); return; }

  const igniteRoll = Math.ceil(Math.random() * 6);
  alert(`Firestorm ignition roll: ${igniteRoll}`);
  if (igniteRoll < 4) { alert("The firestorm fizzles. No effect."); onDone(); return; }

  const inHex = units.filter(u => u.row === r && u.col === c);
  if (!inHex.length) { alert("Firestorm rages with no targets!"); onDone(); return; }

  // First unit eliminated outright
  const first = inHex[0];
  if (first.isLeader) { fateDieRoll(first); }
  else { alert(`A unit at (${r},${c}) is consumed by the firestorm!`); removeUnit(first); }

  // All remaining units tested individually
  for (const u of inHex.slice(1)) {
    if (!units.includes(u)) continue;
    if (u.isLeader) { fateDieRoll(u); continue; }
    const uRoll = Math.ceil(Math.random() * 6);
    if (uRoll >= 4) { alert(`A unit at (${r},${c}) burned! (${uRoll})`); removeUnit(u); }
    else alert(`A unit at (${r},${c}) survived. (${uRoll})`);
  }
  drawMap();
  onDone();
}

// ── POSSESSION ────────────────────────────────────────────────────────────────
function _boonPossession(onDone) {
  const neutralMonarchs = factionList.filter(f =>
    controlTypes[f] === "neutral" &&
    units.some(u => u.isLeader && u.faction === f) &&
    personalityCards[f] != null
  );
  if (!neutralMonarchs.length) { alert("No eligible neutral monarchs with personality cards."); onDone(); return; }

  const list = neutralMonarchs.map((f, i) => `${i + 1}. ${f} (card #${personalityCards[f]})`).join('\n');
  const choice = parseInt(prompt(`Possession: Choose neutral monarch:\n${list}\nEnter number:`)) - 1;
  if (isNaN(choice) || choice < 0 || choice >= neutralMonarchs.length) { alert("Invalid."); onDone(); return; }

  const target = neutralMonarchs[choice];
  const oldCard = personalityCards[target];
  const availableCards = Object.keys(PERSONALITY_CARDS).map(Number).filter(id => id !== oldCard);
  if (!availableCards.length) { alert("No alternate personality cards available."); onDone(); return; }

  const newCard = availableCards[Math.floor(Math.random() * availableCards.length)];
  personalityCards[target] = newCard;
  const cardInfo = PERSONALITY_CARDS[newCard];
  alert(`${target}'s personality changes! New card: #${newCard} — ${cardInfo?.name || "Unknown"}.`);
  if (newCard === 13) {
    alert(`Card #13: ${target} deactivates immediately!`);
    // Deactivate the kingdom
    for (const u of units.filter(u => u.faction === target)) {
      if (!u.isLeader) { u.row = null; u.col = null; }
    }
  }
  onDone();
}

// ── TEMPEST ───────────────────────────────────────────────────────────────────
function _boonTempest(onDone) {
  // Find fleet stacks on open sea (not coastal — lakes array must be empty AND tile is all-sea)
  const seaFleets = units.filter(u => {
    if (!u.isFleet) return false;
    const tile = tileData[`${u.row},${u.col}`];
    if (!tile) return false;
    const allSea = (tile.lakes || []).length === 6;
    return allSea;
  });

  if (!seaFleets.length) { alert("No fleets on open sea."); onDone(); return; }

  // Group by hex
  const byHex = {};
  for (const u of seaFleets) {
    const k = `${u.row},${u.col}`;
    if (!byHex[k]) byHex[k] = [];
    byHex[k].push(u);
  }
  const hexKeys = Object.keys(byHex);
  const list = hexKeys.map((k, i) => `${i + 1}. ${byHex[k].map(u => u.faction).join(',')} at (${k})`).join('\n');
  const choice = parseInt(prompt(`Tempest: Choose fleet stack to attack:\n${list}\nEnter number:`)) - 1;
  if (isNaN(choice) || choice < 0 || choice >= hexKeys.length) { alert("Invalid."); onDone(); return; }

  const chosenKey = hexKeys[choice];
  const roll = Math.ceil(Math.random() * 6);
  alert(`Tempest strikes fleet at (${chosenKey}) — Roll: ${roll}`);
  if (roll < 4) { alert("The water spirits fail. No effect."); onDone(); return; }

  alert(`The fleet at (${chosenKey}) is sunk by the Tempest!`);
  for (const u of [...byHex[chosenKey]]) {
    if (u.isLeader) fateDieRoll(u);
    else removeUnit(u);
  }
  drawMap();
  onDone();
}
