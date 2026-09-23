// Divine Right fleet movement and sea transport fidelity.
(function () {
  function enabled() { return window.scenarioMeta?.id === "board-game"; }

  function tileKind(tile) {
    const lakes = Array.isArray(tile?.lakes) ? tile.lakes : [];
    if (lakes.length >= 6) return "sea";
    if (lakes.length > 0) return "coastal";
    return "land";
  }

  function unitKingdom(unit) { return unit?.originalFaction || unit?.faction || null; }
  function isCombatCargo(unit) { return !!unit && !unit.isFleet && !unit.isLeader && (unit.combatStrength || 0) > 0; }
  function isLeaderOrDevice(unit) { return !!unit && !unit.isFleet && (!!unit.isLeader || !!unit.isDevice || (unit.combatStrength || 0) <= 0); }

  function fleetCanTransit(fleet, row, col) {
    const tile = tileData[`${row},${col}`];
    if (!tile) return false;
    const kind = tileKind(tile);
    const friendlyPort = !!tile.isPort && tile.faction === fleet.faction;
    if (!(kind === "sea" || kind === "coastal" || friendlyPort)) return false;
    return !units.some(u => u.isFleet && u.row === row && u.col === col && u.faction !== fleet.faction);
  }

  function fleetCanEnd(fleet, row, col) {
    if (!fleetCanTransit(fleet, row, col)) return false;
    const tile = tileData[`${row},${col}`];
    const kind = tileKind(tile);
    if (kind === "coastal" && units.some(u => !u.isFleet && u.row === row && u.col === col && u.faction !== fleet.faction)) return false;
    const myKingdom = unitKingdom(fleet);
    return !units.some(u => u.isFleet && u !== fleet && u.row === row && u.col === col && u.faction === fleet.faction && unitKingdom(u) !== myKingdom);
  }

  function fleetValidMoves(fleet) {
    const max = fleet.moveSpeed || 0;
    const best = new Map([[`${fleet.row},${fleet.col}`, 0]]);
    const queue = [{ row: fleet.row, col: fleet.col, cost: 0 }];
    const result = [];
    const resultSet = new Set();
    while (queue.length) {
      const cur = queue.shift();
      for (const [r, c] of getAdjacentCoords(cur.row, cur.col)) {
        const nextCost = cur.cost + 1;
        if (nextCost > max || !fleetCanTransit(fleet, r, c)) continue;
        const key = `${r},${c}`;
        if (best.has(key) && best.get(key) <= nextCost) continue;
        best.set(key, nextCost);
        queue.push({ row: r, col: c, cost: nextCost });
        if (fleetCanEnd(fleet, r, c) && !resultSet.has(key)) {
          resultSet.add(key); result.push([r, c]);
        }
      }
    }
    return result;
  }

  function cargoList(fleet) {
    if (!Array.isArray(fleet.cargo)) fleet.cargo = [];
    return fleet.cargo;
  }

  function embarkUnit(fleet, unit) {
    if (!fleet?.isFleet || !unit || unit.isFleet || unit.faction !== fleet.faction) return false;
    if (unit.row !== fleet.row || unit.col !== fleet.col) return false;
    const cargo = cargoList(fleet);
    if (isCombatCargo(unit) && cargo.some(isCombatCargo)) return false;
    const idx = units.indexOf(unit);
    if (idx < 0) return false;
    units.splice(idx, 1);
    unit.aboardFleetId = fleet.combatId || fleet.id || `${fleet.faction}:${fleet.row},${fleet.col}`;
    unit.hasMoved = true;
    cargo.push(unit);
    return true;
  }

  function canDisembarkHere(fleet) {
    const tile = tileData[`${fleet.row},${fleet.col}`];
    if (!tile) return false;
    if (tile.isPort && tile.faction === fleet.faction) return true;
    if (tileKind(tile) !== "coastal") return false;
    const terrain = Array.isArray(tile.terrain) ? tile.terrain : [tile.terrain];
    return !terrain.includes("mountain");
  }

  function disembarkAll(fleet) {
    if (!canDisembarkHere(fleet)) return 0;
    const cargo = cargoList(fleet);
    let count = 0;
    while (cargo.length) {
      const unit = cargo.shift();
      delete unit.aboardFleetId;
      unit.row = fleet.row; unit.col = fleet.col; unit.hasMoved = true;
      units.push(unit); count++;
    }
    return count;
  }

  function offerCargo(fleet) {
    if (!enabled() || !fleet?.isFleet || fleet.faction !== turnOrder[currentTurnIndex]) return;
    const cargo = cargoList(fleet);
    const local = units.filter(u => u !== fleet && !u.isFleet && u.faction === fleet.faction && u.row === fleet.row && u.col === fleet.col);
    const combatAvailable = local.filter(isCombatCargo);
    const extras = local.filter(isLeaderOrDevice);
    let text = `Fleet cargo: ${cargo.length ? cargo.map(u => u.name || u.originalFaction || u.faction).join(', ') : '(empty)'}\n`;
    if (canDisembarkHere(fleet) && cargo.length && confirm(`${text}\nDisembark all cargo here?`)) {
      disembarkAll(fleet); drawMap(); return;
    }
    if (!local.length) { alert(text + "\nNo friendly land units here to embark."); return; }
    if (combatAvailable.length && !cargo.some(isCombatCargo)) {
      const menu = combatAvailable.map((u,i)=>`${i+1}. ${u.name || u.originalFaction || u.faction}`).join('\n');
      const n = Number.parseInt(prompt(`${text}\nEmbark one combat unit (one per fleet), or 0 for none:\n${menu}`),10);
      if (n > 0 && n <= combatAvailable.length) embarkUnit(fleet, combatAvailable[n-1]);
    }
    if (extras.length && confirm(`Embark all ${extras.length} co-located leader/device unit(s) as well?`)) {
      for (const u of [...extras]) embarkUnit(fleet, u);
    }
    drawMap();
  }

  const baseValidMoves = typeof validMoves === "function" ? validMoves : null;
  if (baseValidMoves) {
    validMoves = function (unit) {
      if (enabled() && unit?.isFleet) return fleetValidMoves(unit);
      return baseValidMoves(unit);
    };
  }

  function installUi() {
    const hud = document.getElementById('hud');
    if (!hud || document.getElementById('fleet-cargo-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'fleet-cargo-btn'; btn.textContent = 'Fleet Cargo'; btn.style.display = 'none';
    btn.addEventListener('click', () => { if (selectedUnit?.isFleet) offerCargo(selectedUnit); });
    hud.appendChild(btn);

    svg.addEventListener('click', event => {
      setTimeout(() => {
        btn.style.display = enabled() && currentPhase === 'movement' && selectedUnit?.isFleet ? 'inline-block' : 'none';
      }, 0);
    });

    svg.addEventListener('click', event => {
      if (!enabled() || currentPhase !== 'movement' || !selectedUnit?.isFleet) return;
      const fleet = selectedUnit;
      const hexText = event.target?.dataset?.hex;
      if (!hexText) return;
      const [r,c] = hexText.split(',').map(Number);
      const legal = fleetValidMoves(fleet).some(([rr,cc]) => rr===r && cc===c);
      if (!legal) return;
      setTimeout(() => {
        if (fleet.hasMoved && fleet.row === r && fleet.col === c && cargoList(fleet).length && canDisembarkHere(fleet)) {
          if (confirm(`Disembark ${cargoList(fleet).length} carried unit(s) at (${r},${c})?`)) {
            disembarkAll(fleet); drawMap();
          }
        }
        btn.style.display = 'none';
      }, 0);
    }, true);
  }

  window.drTileKind = tileKind;
  window.fleetValidMoves = fleetValidMoves;
  window.embarkUnit = embarkUnit;
  window.disembarkAll = disembarkAll;
  window.canDisembarkHere = canDisembarkHere;
  window.getFleetCargoCombatUnits = fleet => cargoList(fleet).filter(isCombatCargo);
  setTimeout(installUi, 0);
})();
