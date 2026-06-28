// cpuAI.js — basic CPU player logic

function dispatchCPUIfNeeded() {
  const faction = turnOrder[currentTurnIndex];
  if (controlTypes[faction] === "cpu") {
    setTimeout(() => handleCPUPhase(faction), 700);
  }
}

function handleCPUPhase(faction) {
  info.innerText = `CPU — ${faction.toUpperCase()}: auto-playing ${currentPhase}…`;
  switch (currentPhase) {
    case "event":          cpuEvent(faction);     break;
    case "diplo-draw":     cpuDiploDrawAuto();    break;
    case "diplo-play":     endTurn();             break; // skip diplomacy for now
    case "siege":          endTurn();             break;
    case "movement":       cpuMovement(faction);  break;
    case "combat-declare": endTurn();             break;
    case "combat-resolve": cpuCombatResolve();    break;
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

  // Events that remove a unit
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

  // Events that deploy units
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

// ── Movement phase ────────────────────────────────────────────────────────────
function cpuMovement(faction) {
  // Mark all units as moved — CPU skips movement entirely for now
  for (const u of units) {
    if (u.faction === faction) u.hasMoved = true;
  }
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
