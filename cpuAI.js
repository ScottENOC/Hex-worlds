// cpuAI.js — CPU player logic

function dispatchCPUIfNeeded() {
  const faction = turnOrder[currentTurnIndex];
  if (controlTypes[faction] === "cpu") {
    setTimeout(() => handleCPUPhase(faction), 700);
  }
}

function handleCPUPhase(faction) {
  info.innerText = `CPU — ${faction.toUpperCase()}: auto-playing ${currentPhase}…`;
  switch (currentPhase) {
    case "event":          cpuEvent(faction);       break;
    case "diplo-draw":     cpuDiploDrawAuto();      break;
    case "diplo-play":     cpuDiplomacy(faction);   break;
    case "siege":          endTurn();               break;
    case "movement":       cpuMovement(faction);    break;
    case "combat-declare": endTurn();               break;
    case "combat-resolve": cpuCombatResolve();      break;
  }
}

// ── Diplo draw without alert ──────────────────────────────────────────────────
function cpuDiploDrawAuto() {
  const faction = turnOrder[currentTurnIndex];
  if (diploDeck.length < 2) diploDeck = buildDiploDeck();
  const drawn = diploDeck.splice(0, 2);
  diplomacyHands[faction] = (diplomacyHands[faction] || []).concat(drawn);
  currentPhase = "diplo-play";
  updateTurnInfo();
  dispatchCPUIfNeeded();
}

// ── Event phase ───────────────────────────────────────────────────────────────
function cpuEvent(faction) {
  // Troll regeneration
  if (faction === "trolls") {
    const pool = reserves["trolls"] || [];
    const u = pool.find(x => !x.isMercenary);
    if (u) {
      const [sr, sc] = u.startCoords || [u.row, u.col];
      if (!units.some(e => e.row === sr && e.col === sc)) {
        u.row = sr; u.col = sc;
        pool.splice(pool.indexOf(u), 1);
        units.push(u);
      }
    }
  }

  const d1 = Math.ceil(Math.random() * 6), d2 = Math.ceil(Math.random() * 6);
  const total = d1 + d2;
  info.innerText = `CPU (${faction}): event roll ${d1}+${d2}=${total}`;

  const advance = () => {
    currentPhase = "diplo-draw";
    drawMap(); updateTurnInfo(); dispatchCPUIfNeeded();
  };

  const removeFilters = {
    3: u => u.faction === faction && u.isFleet && !u.isLeader,
    4: u => u.faction === faction && !u.isLeader,
    9: u => u.faction === faction && !u.isLeader,
    11: u => u.faction === faction && u.isMercenary && !u.isLeader,
  };
  if (removeFilters[total]) {
    const eligible = units.filter(removeFilters[total]);
    if (eligible.length) {
      eligible.sort((a, b) => (a.combatStrength || 0) - (b.combatStrength || 0));
      removeUnit(eligible[0]);
      drawMap();
    }
    advance(); return;
  }

  const deployCount = { 6: 2, 8: 2, 10: 1 };
  const deployPredicate = {
    6: u => !u.isMercenary,
    8: u => u.isMercenary,
    10: () => true,
  };
  if (deployCount[total] !== undefined) {
    const pool = (reserves[faction] || []).filter(deployPredicate[total]);
    let placed = 0;
    for (const u of pool) {
      if (placed >= deployCount[total]) break;
      const [sr, sc] = u.startCoords || [u.row, u.col];
      if (!units.some(e => e.row === sr && e.col === sc)) {
        u.row = sr; u.col = sc;
        (reserves[faction] || []).splice((reserves[faction] || []).indexOf(u), 1);
        units.push(u);
        placed++;
      }
    }
    drawMap(); advance(); return;
  }

  if (total === 12) {
    for (const u of units) {
      if (u.faction === faction && u.isLeader) u.hasMoved = false;
    }
  }
  advance();
}

// ── BFS hex distance (ignores terrain and rivers, just counts map hops) ───────
function hexBFSDistance(r1, c1, r2, c2) {
  if (r1 === r2 && c1 === c2) return 0;
  const visited = new Set([`${r1},${c1}`]);
  const queue = [[r1, c1, 0]];
  while (queue.length) {
    const [r, c, d] = queue.shift();
    for (const [nr, nc] of getAdjacentCoords(r, c)) {
      if (nr === r2 && nc === c2) return d + 1;
      const k = `${nr},${nc}`;
      if (!visited.has(k) && tileData[k]) {
        visited.add(k);
        queue.push([nr, nc, d + 1]);
      }
    }
  }
  return Infinity;
}

// ── Returns aggression level 0–1 based on relative VP standing ───────────────
// Winning → more aggressive; losing → more defensive
function cpuAggression(faction) {
  const myVP = victoryPoints[faction] || 0;
  const others = Object.entries(victoryPoints)
    .filter(([f]) => f !== faction)
    .map(([, v]) => v);
  if (!others.length) return 0.6;
  const avgOther = others.reduce((a, b) => a + b, 0) / others.length;
  return Math.max(0.2, Math.min(0.9, 0.55 + (myVP - avgOther) * 0.04));
}

// ── Diplomacy phase ───────────────────────────────────────────────────────────
// Strategy:
//   1. Always take a free bare roll on any accessible wizard faction (eaters/black_hand).
//      Cards are wasted on wizards (they ignore card value), so save them for regulars.
//   2. For regular kingdoms, target the one whose capital is closest to the nearest
//      opponent capital (contest it before opponents do). Play highest-value card.
function cpuDiplomacy(faction) {
  const advance = () => {
    currentPhase = "siege";
    updateTurnInfo();
    dispatchCPUIfNeeded();
  };

  const hand = diplomacyHands[faction] || [];
  const kingdoms = getNeutralKingdoms().filter(k => !isAmbassadorBanned(faction, k));

  // --- Step 1: free bare roll on wizard factions ---
  const wizardKingdoms = kingdoms.filter(k => k === "eaters" || k === "black_hand");
  if (wizardKingdoms.length) {
    // Pick one wizard faction and roll (no card consumed)
    const target = wizardKingdoms[0];
    rollWizardDiplomacy(faction, target, advance);
    return;
  }

  // --- Step 2: play a card on the best regular neutral kingdom ---
  const regularCards = hand.filter(c => c.type !== "specialMerc");
  const regularKingdoms = kingdoms.filter(k => k !== "eaters" && k !== "black_hand");
  if (!regularCards.length || !regularKingdoms.length) { advance(); return; }

  // Locate my capital
  const myCapEntry = Object.entries(tileData).find(([, t]) => t.isCapital && t.faction === faction);
  const [myCapR, myCapC] = myCapEntry ? myCapEntry[0].split(",").map(Number) : [15, 17];

  // Find nearest opponent capital
  const opponentFactions = Object.keys(factions).filter(f => f !== "none" && f !== faction);
  let nearestOppR = myCapR, nearestOppC = myCapC, nearestOppDist = Infinity;
  for (const opp of opponentFactions) {
    const capEntry = Object.entries(tileData).find(([, t]) => t.isCapital && t.faction === opp);
    if (!capEntry) continue;
    const [r, c] = capEntry[0].split(",").map(Number);
    const d = hexBFSDistance(myCapR, myCapC, r, c);
    if (d < nearestOppDist) { nearestOppDist = d; nearestOppR = r; nearestOppC = c; }
  }

  // Score each regular neutral kingdom: close to opponent threat = high priority
  let bestKingdom = null, bestScore = Infinity;
  for (const k of regularKingdoms) {
    const capEntry = Object.entries(tileData).find(([, t]) => t.isCapital && t.faction === k);
    if (!capEntry) continue;
    const [r, c] = capEntry[0].split(",").map(Number);
    const toOpp = hexBFSDistance(r, c, nearestOppR, nearestOppC);
    const toMe  = hexBFSDistance(r, c, myCapR, myCapC);
    const score = toOpp * 1.5 + toMe * 0.5;
    if (score < bestScore) { bestScore = score; bestKingdom = k; }
  }

  if (!bestKingdom) { advance(); return; }

  // Play highest-value card (card value matters for regular kingdoms)
  const card = regularCards.reduce((best, c) => (c.value || 0) > (best.value || 0) ? c : best, regularCards[0]);
  hand.splice(hand.indexOf(card), 1);

  playDiplomaticCard(faction, card, bestKingdom, advance);
}

// ── Movement phase ────────────────────────────────────────────────────────────
// Fear vs greed: aggression (VP-based) toggles between taking enemy cities
// and defending threatened own assets. Leaders move first.
function cpuMovement(faction) {
  const aggression = cpuAggression(faction);

  // Gather strategic landscape
  const enemyFortresses = Object.entries(tileData)
    .filter(([, t]) => t.isFortress && t.faction !== faction && t.faction !== "none")
    .map(([k, t]) => {
      const [r, c] = k.split(",").map(Number);
      return { row: r, col: c, strength: t.fortressStrength || 1 };
    });

  const myFortresses = Object.entries(tileData)
    .filter(([, t]) => t.isFortress && t.faction === faction)
    .map(([k]) => { const [r, c] = k.split(",").map(Number); return { row: r, col: c }; });

  const myCapEntry = Object.entries(tileData).find(([, t]) => t.isCapital && t.faction === faction);
  const myAssets = [...myFortresses];
  if (myCapEntry) {
    const [r, c] = myCapEntry[0].split(",").map(Number);
    myAssets.push({ row: r, col: c });
  }

  // Fear: how much enemy strength is near my assets?
  let totalThreat = 0;
  const myUnitsOnMap = units.filter(u => u.faction === faction);
  const myStrength = myUnitsOnMap.reduce((s, u) => s + (u.combatStrength || 0), 0) || 1;
  for (const asset of myAssets) {
    const nearby = units.filter(u => u.faction !== faction && (u.combatStrength || 0) > 0 &&
      hexBFSDistance(u.row, u.col, asset.row, asset.col) <= 4);
    totalThreat += nearby.reduce((s, u) => s + (u.combatStrength || 0), 0);
  }
  const fearLevel = Math.min(1, totalThreat / myStrength);

  // Blend attack vs defend weights
  const attackWeight = aggression * (1 - fearLevel * 0.6);
  const defendWeight = 1 - attackWeight;

  // Score a candidate destination for this unit
  function scoreMove(unit, r, c) {
    let score = 0;

    // Attack: move toward enemy fortresses (siege opportunities)
    if (attackWeight > 0 && enemyFortresses.length) {
      const minDist = Math.min(...enemyFortresses.map(f => hexBFSDistance(r, c, f.row, f.col)));
      score += attackWeight * (20 - minDist);
      // Bonus for being adjacent and able to siege
      const adjacentFort = enemyFortresses.find(f => hexBFSDistance(r, c, f.row, f.col) === 1);
      if (adjacentFort && (unit.siegeStrength || 0) > 0) score += attackWeight * 12;
    }

    // Defend: move toward threatened own assets
    if (defendWeight > 0 && myAssets.length) {
      let closestThreatenedDist = Infinity;
      for (const asset of myAssets) {
        const threat = units.filter(u => u.faction !== faction &&
          hexBFSDistance(u.row, u.col, asset.row, asset.col) <= 4).length;
        if (threat > 0) {
          const d = hexBFSDistance(r, c, asset.row, asset.col);
          if (d < closestThreatenedDist) closestThreatenedDist = d;
        }
      }
      if (closestThreatenedDist < Infinity) {
        score += defendWeight * (15 - closestThreatenedDist);
      }
    }

    // Small bonus for stacking with friendlies (concentration of force)
    const friendlies = units.filter(u => u.faction === faction && u.row === r && u.col === c).length;
    if (friendlies > 0 && friendlies < 3) score += 1.5;

    // Slight penalty for staying put (prefer forward movement)
    if (r === unit.row && c === unit.col) score -= 3;

    return score;
  }

  // Move leaders first (they provide stacking bonuses), then strongest units
  const movable = units
    .filter(u => u.faction === faction && !u.hasMoved && !u.isImmovable && u.row != null)
    .sort((a, b) => {
      if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
      return (b.combatStrength || 0) - (a.combatStrength || 0);
    });

  for (const unit of movable) {
    if (unit.hasMoved) continue;
    const moves = validMoves(unit);
    if (!moves.length) { unit.hasMoved = true; continue; }

    let bestMove = null, bestScore = -Infinity;
    for (const [r, c] of moves) {
      const s = scoreMove(unit, r, c);
      if (s > bestScore) { bestScore = s; bestMove = [r, c]; }
    }

    if (bestMove) { unit.row = bestMove[0]; unit.col = bestMove[1]; }
    unit.hasMoved = true;
  }

  drawMap();
  endTurn();
}

// ── Combat resolve ────────────────────────────────────────────────────────────
function cpuCombatResolve() {
  const resolve = document.getElementById("resolve-button");
  const cont = document.getElementById("continue-button");
  if (resolve && resolve.style.display !== "none") {
    setTimeout(() => {
      resolve.click();
      setTimeout(() => { if (cont && cont.style.display !== "none") cont.click(); }, 600);
    }, 400);
  } else {
    endTurn();
  }
}
