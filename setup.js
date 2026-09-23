// setup.js — pre-game configuration screen
// Runs after all other scripts have loaded.
(function () {
  const SCENARIOS = [
    { id: "board-game", label: "Cry Havoc (Board Game)" },
    { id: "custom",     label: "Custom (Procedural)" },
  ];

  // Inject scenario picker into setup box
  const setupBox = document.getElementById("setup-box");
  const scenarioLabel = document.createElement("label");
  scenarioLabel.innerHTML = `Scenario: <select id="setup-scenario">
    ${SCENARIOS.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
  </select>`;
  setupBox.insertBefore(scenarioLabel, document.getElementById("setup-slots"));

  const rulesLabel = document.createElement("label");
  rulesLabel.id = "setup-casualty-option";
  rulesLabel.style.display = "block";
  rulesLabel.style.margin = "8px 0";
  rulesLabel.innerHTML = `
    <input type="checkbox" id="setup-priority-casualties" checked>
    Streamlined casualties (Scum → Barbarians → mercenaries → allied troops → regular troops → special mercenaries)
  `;
  setupBox.insertBefore(rulesLabel, document.getElementById("setup-slots"));

  function buildSlots(playableFactions, displayNames) {
    const n = +document.getElementById("setup-count").value;
    const box = document.getElementById("setup-slots");
    box.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const div = document.createElement("div");
      div.className = "setup-slot";
      const defaultFaction = playableFactions[i] || playableFactions[0];
      div.innerHTML = `
        <span class="setup-label">Player ${i + 1}</span>
        <select class="setup-faction">
          ${playableFactions.map(f => `<option value="${f}"${f === defaultFaction ? " selected" : ""}>${displayNames[f] || f}</option>`).join("")}
        </select>
        <select class="setup-control">
          <option value="human">Human</option>
          <option value="cpu">CPU</option>
        </select>`;
      box.appendChild(div);
    }
  }

  async function startGame(playableFactions, displayNames, allFactions, scenarioId) {
    const slots = [...document.querySelectorAll(".setup-slot")];
    const chosen = new Map();
    for (const slot of slots) {
      const f = slot.querySelector(".setup-faction").value;
      const c = slot.querySelector(".setup-control").value;
      if (chosen.has(f)) { alert(`${displayNames[f] || f} is already taken by another player.`); return; }
      chosen.set(f, c);
    }

    // Rules options are kept separate from scenario defaults. This lets local
    // hotseat use owner-selected casualties while async multiplayer can default
    // to deterministic priority casualties.
    window.gameOptions = window.gameOptions || {};
    window.gameOptions.casualtySelectionMode = document.getElementById("setup-priority-casualties")?.checked
      ? "priority"
      : "manual";
    localStorage.setItem("hexWorldsCasualtySelectionMode", window.gameOptions.casualtySelectionMode);

    // Populate globals
    for (const [f, c] of chosen) controlTypes[f] = c;

    // Unclaimed playable factions → neutral
    for (const f of playableFactions) {
      if (!chosen.has(f)) { controlTypes[f] = "neutral"; neutralFactions.add(f); }
    }
    // NPC (non-playable) kingdoms always neutral
    for (const f of allFactions) {
      if (!chosen.has(f) && !controlTypes[f]) {
        controlTypes[f] = "neutral"; neutralFactions.add(f);
      }
    }

    document.getElementById("setup-screen").style.display = "none";

    await loadScenario(scenarioId);
    initGame({ players: [...chosen.entries()].map(([faction, control]) => ({ faction, control })) });
  }

  function loadScenarioMeta(scenarioId) {
    fetch(`scenarios/${scenarioId}/scenario.json`)
      .then(r => r.json())
      .then(data => {
        const playableFactions = Object.entries(data.factions)
          .filter(([, f]) => f.playable)
          .map(([id]) => id);
        const displayNames = Object.fromEntries(
          Object.entries(data.factions).map(([id, f]) => [id, f.display || id])
        );
        const allFactions = Object.keys(data.factions);

        const casualtyCheckbox = document.getElementById("setup-priority-casualties");
        if (casualtyCheckbox) {
          const saved = localStorage.getItem("hexWorldsCasualtySelectionMode");
          const defaultMode = saved || data.rules?.casualtySelectionMode || "manual";
          casualtyCheckbox.checked = defaultMode === "priority";
        }

        // Cap player count to number of playable factions
        const countSel = document.getElementById("setup-count");
        for (const opt of countSel.options) {
          opt.disabled = +opt.value > playableFactions.length;
        }
        if (+countSel.value > playableFactions.length) {
          countSel.value = playableFactions.length;
        }

        buildSlots(playableFactions, displayNames);

        // Detach and reattach count listener for new faction list
        const newCountSel = document.getElementById("setup-count");
        const cloned = newCountSel.cloneNode(true);
        newCountSel.parentNode.replaceChild(cloned, newCountSel);
        cloned.addEventListener("change", () => buildSlots(playableFactions, displayNames));

        // Detach and reattach start button listener
        const btn = document.getElementById("setup-start-btn");
        const btnClone = btn.cloneNode(true);
        btn.parentNode.replaceChild(btnClone, btn);
        btnClone.addEventListener("click", () =>
          startGame(playableFactions, displayNames, allFactions, scenarioId)
        );
      });
  }

  // Initial load
  loadScenarioMeta(SCENARIOS[0].id);

  // Reload metadata when scenario changes
  document.getElementById("setup-scenario").addEventListener("change", function () {
    // Reset controlTypes and neutralFactions
    for (const k of Object.keys(controlTypes)) delete controlTypes[k];
    neutralFactions.clear();
    loadScenarioMeta(this.value);
  });
})();

// -----------------------------------------------------------------------------
// Combat fidelity layer
// Loaded last so it can refine the prototype combat resolver while keeping the
// original UI and special-unit hooks intact.
// -----------------------------------------------------------------------------
(function () {
  function combatRule(name, fallback = false) {
    const rules = window.scenarioRules || {};
    return rules[name] != null ? !!rules[name] : fallback;
  }

  function originKey(hex) {
    return `${hex.row},${hex.col}`;
  }

  function restoreAttackersToOrigins(attackers, attackerOrigins) {
    for (const unit of attackers) {
      if (!units.includes(unit)) continue;
      const origin = attackerOrigins.get(unit);
      if (!origin) continue;
      unit.row = origin.row;
      unit.col = origin.col;
    }
  }

  function chooseAdvancingUnits(attackers, attackerFaction, targetHex, attackerOrigins) {
    const eligible = attackers.filter(u => units.includes(u) && (!u.isLeader || u.isEatersOfWisdom));
    if (!eligible.length) return [];

    const control = controlTypes[attackerFaction];
    if (control === "cpu") return [...eligible];

    const menu = eligible.map((u, i) => {
      const origin = attackerOrigins.get(u);
      const name = u.name || (u.originalFaction && u.originalFaction !== u.faction
        ? `${u.originalFaction} allied troop`
        : `${u.faction} troop`);
      return `${i + 1}. ${name} from (${origin?.row ?? "?"},${origin?.col ?? "?"})`;
    }).join("\n");

    const answer = prompt(
      `Advance after combat into (${targetHex.row},${targetHex.col})?\n\n` +
      `${menu}\n\nEnter "all", "none", or unit numbers separated by commas:`
    );
    const indexes = typeof parseAdvanceSelection === "function"
      ? parseAdvanceSelection(answer, eligible.length)
      : [];
    return indexes.map(i => eligible[i]).filter(Boolean);
  }

  if (typeof startCombatResolution === "function") {
    startCombatResolution = function () {
      if (declaredCombats.length === 0) {
        endTurn();
        return;
      }

      const merged = combatRule("multiHexCombat", false) && typeof mergeNextCombatDeclarations === "function"
        ? mergeNextCombatDeclarations(declaredCombats)
        : (() => {
            const combat = declaredCombats.shift();
            return combat ? { targetHex: combat.targetHex, fromHexes: [combat.fromHex] } : null;
          })();
      if (!merged) { endTurn(); return; }

      const { targetHex, fromHexes } = merged;
      const defenders = units.filter(u => u.row === targetHex.row && u.col === targetHex.col);
      const defFaction = defenders[0]?.faction;
      const attackingFaction = turnOrder[currentTurnIndex];
      const attackers = [];
      const attackerOrigins = new Map();

      for (const fromHex of fromHexes) {
        const stack = units.filter(u =>
          u.row === fromHex.row && u.col === fromHex.col &&
          u.faction === attackingFaction && u.faction !== defFaction
        );
        for (const u of stack) {
          if (attackers.includes(u)) continue;
          attackers.push(u);
          attackerOrigins.set(u, { ...fromHex });
        }
      }

      if (!attackers.length) {
        startCombatResolution();
        return;
      }

      const allScumDefenders = defenders.length > 0 && defenders.every(u => u.isScum);
      if (allScumDefenders) {
        const roll = Math.ceil(Math.random() * 6);
        if (roll >= 4) {
          const adj = getAdjacentCoords(targetHex.row, targetHex.col);
          const safeHex = adj.find(([r, c]) => !units.some(u => u.row === r && u.col === c && u.faction !== defenders[0].faction));
          if (safeHex) {
            for (const u of defenders) { u.row = safeHex[0]; u.col = safeHex[1]; }
            alert(`The Scum retreat! (Roll: ${roll} ≥ 4 — they flee to ${safeHex[0]},${safeHex[1]})`);
          } else {
            for (const u of [...defenders]) removeUnit(u);
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

      const lepersInTarget = defenders.some(u => u.isLeper);
      if (lepersInTarget && typeof canAttackLepers === "function" && !canAttackLepers(attackingFaction)) {
        alert(`The Lepers at (${targetHex.row},${targetHex.col}) cannot be attacked by ${attackingFaction}! Only the Black Hand or Eaters of Wisdom may attack them.`);
        startCombatResolution();
        return;
      }

      if (typeof getLepers === "function") {
        const leper = getLepers();
        if (leper && leper.row != null) {
          const defenderFaction = defenders[0]?.faction;
          if (typeof checkLepersAutoRetreat === "function" && checkLepersAutoRetreat(defenderFaction, targetHex.row, targetHex.col)) {
            alert(`Units of ${defenderFaction} at (${targetHex.row},${targetHex.col}) must automatically retreat before the Lepers!`);
            executeLepersRetreat(defenders, targetHex.row, targetHex.col, leper.row, leper.col);
            drawMap();
            startCombatResolution();
            return;
          }
        }
      }

      const defFactionName = defenders[0]?.faction;
      if (defenders.length > 0 && defFactionName !== attackingFaction) {
        const wantRetreat = confirm(
          `${defFactionName} is being attacked at (${targetHex.row},${targetHex.col}).\nAttempt retreat before combat?`
        );
        if (wantRetreat) {
          const retreated = attemptRetreatBeforeCombat(defenders, targetHex);
          if (retreated) {
            drawMap();
            startCombatResolution();
            return;
          }
        }
      }

      window.currentCombat = {
        attackers: [...attackers],
        defenders: [...defenders],
        fromHex: fromHexes[0],
        fromHexes: fromHexes.map(h => ({ ...h })),
        attackerOrigins,
        targetHex
      };

      document.getElementById("combat-info").innerHTML = `
        <p><strong>Combat at (${targetHex.row},${targetHex.col})</strong></p>
        <p>Attackers (${attackers.length}) from ${fromHexes.length} hex${fromHexes.length === 1 ? "" : "es"}</p>
        <p>Defenders (${defenders.length}): ${defenders.map(u => u.faction).join(', ') || 'none'}</p>
        <p>Click "Resolve Combat" to roll dice.</p>
      `;

      highlightedTilesByType.combat = [
        [targetHex.row, targetHex.col],
        ...fromHexes.map(h => [h.row, h.col])
      ];
      drawMap();
      document.getElementById("combat-panel").style.display = "block";
      document.getElementById("resolve-button").style.display = "inline";
      document.getElementById("continue-button").style.display = "none";
    };
  }

  if (typeof resolveCurrentCombat === "function") {
    resolveCurrentCombat = function () {
      const { attackers, defenders, fromHex, targetHex } = window.currentCombat;
      const attackerOrigins = window.currentCombat.attackerOrigins || new Map(attackers.map(u => [u, fromHex]));
      const tile = tileData[`${targetHex.row},${targetHex.col}`];
      const terrain = tile?.terrain;

      const eaterInDefenders = defenders.find(u => u.isEatersOfWisdom);
      if (eaterInDefenders) {
        const enemiesInHex = units.some(u =>
          u.row === targetHex.row && u.col === targetHex.col &&
          u.faction !== eaterInDefenders.faction && (u.combatStrength || 0) > 0
        );
        if (enemiesInHex) eaterInDefenders.combatStrength = 0;
      }

      let attackerStrength = attackers.reduce((s, u) => s + (u.combatStrength || 0), 0);
      let defenderStrength = defenders.reduce((s, u) => s + (u.combatStrength || 0), 0);
      const terrainList = Array.isArray(terrain) ? terrain : [terrain];
      if (terrainList.includes("mountain_pass")) defenderStrength *= 2;
      if (typeof getEnchantedCastleBonus === "function") defenderStrength *= getEnchantedCastleBonus(targetHex.row, targetHex.col);

      let attackerBonus = 0;
      let defenderBonus = 0;
      if (attackerStrength > defenderStrength && defenderStrength > 0) {
        attackerBonus = Math.floor(attackerStrength / defenderStrength) - 1;
      } else if (defenderStrength > attackerStrength && attackerStrength > 0) {
        defenderBonus = Math.floor(defenderStrength / attackerStrength) - 1;
        if (defenderBonus === 0) defenderBonus = 1;
      }
      if (terrainList.includes("mountain")) defenderBonus += 1;

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

      let attackerLosses = 0;
      let defenderLosses = 0;
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
        const u = typeof chooseCombatCasualty === "function"
          ? chooseCombatCasualty(defenders, defenderFaction, `${defenderFaction || "Defender"} defence`)
          : defenders.find(x => !x.isLeader && units.includes(x));
        if (!u) break;
        hexesWithLosses.add(`${u.row},${u.col}`);
        removeUnit(u);
        const idx = defenders.indexOf(u);
        if (idx !== -1) defenders.splice(idx, 1);
      }

      for (let i = 0; i < attackerLosses; i++) {
        const u = typeof chooseCombatCasualty === "function"
          ? chooseCombatCasualty(attackers, attackerFaction, `${attackerFaction || "Attacker"} attack`)
          : attackers.find(x => !x.isLeader && units.includes(x));
        if (!u) break;
        hexesWithLosses.add(`${u.row},${u.col}`);
        removeUnit(u);
        const idx = attackers.indexOf(u);
        if (idx !== -1) attackers.splice(idx, 1);
      }

      for (const hexKey of hexesWithLosses) {
        const [r, c] = hexKey.split(',').map(Number);
        for (const leader of units.filter(u => u.isLeader && u.row === r && u.col === c)) fateDieRoll(leader);
      }

      if (eaterInDefenders && eaterInDefenders.combatStrength === 0) eaterInDefenders.combatStrength = eaterInDefenders.baseCombatStrength || 2;

      const nonLeaderDefenders = defenders.filter(u => !u.isLeader || u.isEatersOfWisdom);
      restoreAttackersToOrigins(attackers, attackerOrigins);

      if (nonLeaderDefenders.length === 0 && attackers.length > 0) {
        for (const leader of defenders.filter(u => u.isLeader && !u.isEatersOfWisdom)) fateDieRoll(leader);

        const advancing = combatRule("optionalAdvanceAfterCombat", false)
          ? chooseAdvancingUnits(attackers, attackerFaction, targetHex, attackerOrigins)
          : [...attackers];
        for (const u of advancing) {
          if (units.includes(u)) { u.row = targetHex.row; u.col = targetHex.col; }
        }
        resultLine += `<p>${advancing.length} attacker${advancing.length === 1 ? "" : "s"} advanced.</p>`;
      }

      document.getElementById("combat-info").innerHTML = `
        <p><strong>Combat Result</strong></p>
        <p>Attacker: ${attackerRoll}${attackerBonus ? ` +${attackerBonus}` : ''} = ${attackerTotal}</p>
        <p>Defender: ${defenderRoll}${defenderBonus ? ` +${defenderBonus}` : ''} = ${defenderTotal}</p>
        ${resultLine}
      `;

      document.getElementById("resolve-button").style.display = "none";
      document.getElementById("continue-button").style.display = "inline";
    };
  }
})();
