// multiplayer.js — Firebase Firestore async multiplayer
//
// Room lifecycle:
//   Create  → host enters name, gets 6-char code
//   Pick    → each player picks faction from synced grid; server resolves conflicts
//   Playing → host clicks Start; state pushed; others receive via listener
//   Offline → falls back to single-device mode

const MP = (() => {
  let _db         = null;
  let _gameId     = null;
  let _playerId   = null;
  let _playerName = null;
  let _myFaction  = null;
  let _isHost     = false;
  let _unsubscribe     = null;
  let _onRemoteState   = null;
  let _onFactionUpdate = null;
  let _onGameStart     = null;
  let _lastRoomData    = null;

  // ── Init ────────────────────────────────────────────────────────────────────
  function _ensureInit() {
    if (_db) return true;
    if (!window.FIREBASE_CONFIG) return false;
    if (typeof firebase === "undefined") return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      _db = firebase.firestore();
      console.log("[MP] Firebase connected");
      return true;
    } catch (e) {
      console.warn("[MP] Firebase init failed — offline mode", e);
      return false;
    }
  }

  function init() {}
  function _online()   { return _ensureInit(); }
  function _gameRef()  { return _db.collection("games").doc(_gameId); }
  function _makeCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }
  function _makeId()   { return Math.random().toString(36).substring(2, 10) + Date.now().toString(36); }

  // ── Serialize / Deserialize ──────────────────────────────────────────────────
  function _serialize() {
    return {
      units:            JSON.parse(JSON.stringify(units)),
      tileData:         JSON.parse(JSON.stringify(tileData)),
      kingdomColors:    JSON.parse(JSON.stringify(kingdomColors)),
      turnOrder,        currentTurnIndex, currentPhase, turnNumber,
      reserves:         JSON.parse(JSON.stringify(reserves)),
      victoryPoints:    JSON.parse(JSON.stringify(victoryPoints)),
      gold:             JSON.parse(JSON.stringify(gold)),
      declaredCombats:  JSON.parse(JSON.stringify(declaredCombats)),
      diplomacyHands:   JSON.parse(JSON.stringify(diplomacyHands)),
      diploDeck:        JSON.parse(JSON.stringify(diploDeck)),
      personalityCards: JSON.parse(JSON.stringify(personalityCards)),
      controlTypes:     JSON.parse(JSON.stringify(controlTypes)),
      updatedAt:        Date.now(),
    };
  }

  function _deserialize(state) {
    units.length = 0;
    units.push(...state.units);
    for (const k of Object.keys(tileData))       delete tileData[k];
    for (const k of Object.keys(kingdomColors))  delete kingdomColors[k];
    Object.assign(tileData,      state.tileData);
    Object.assign(kingdomColors, state.kingdomColors || {});
    turnOrder.length = 0;
    turnOrder.push(...state.turnOrder);
    currentTurnIndex = state.currentTurnIndex;
    currentPhase     = state.currentPhase;
    turnNumber       = state.turnNumber;
    for (const k of Object.keys(reserves))         delete reserves[k];
    for (const k of Object.keys(victoryPoints))    delete victoryPoints[k];
    for (const k of Object.keys(gold))             delete gold[k];
    for (const k of Object.keys(diplomacyHands))   delete diplomacyHands[k];
    for (const k of Object.keys(personalityCards)) delete personalityCards[k];
    for (const k of Object.keys(controlTypes))     delete controlTypes[k];
    Object.assign(reserves,         state.reserves         || {});
    Object.assign(victoryPoints,    state.victoryPoints    || {});
    Object.assign(gold,             state.gold             || {});
    Object.assign(diplomacyHands,   state.diplomacyHands   || {});
    Object.assign(personalityCards, state.personalityCards || {});
    Object.assign(controlTypes,     state.controlTypes     || {});
    declaredCombats.length = 0;
    declaredCombats.push(...(state.declaredCombats || []));
    if (state.diploDeck) {
      diploDeck.length = 0;
      diploDeck.push(...state.diploDeck);
    }
  }

  // ── Create game ─────────────────────────────────────────────────────────────
  async function createGame(playerName) {
    _playerName = playerName;
    _playerId   = _makeId();
    _isHost     = true;

    if (!_online()) {
      console.log("[MP] Offline — no room created");
      return null;
    }

    _gameId = _makeCode();
    await _gameRef().set({
      host:          _playerId,
      status:        "faction-pick",
      players:       { [_playerId]: { name: playerName, faction: null, ready: false } },
      factionClaims: {},
      createdAt:     Date.now(),
    });
    _listenFactionPicker();
    return _gameId;
  }

  // ── Join game ────────────────────────────────────────────────────────────────
  async function joinGame(code, playerName) {
    if (!_online()) return false;
    _gameId     = code.toUpperCase();
    _playerName = playerName;
    _playerId   = _makeId();
    _isHost     = false;

    const snap = await _gameRef().get();
    if (!snap.exists) { alert("Room not found: " + _gameId); return false; }
    const data = snap.data();
    if (data.status === "playing") { alert("Game already started."); return false; }

    await _gameRef().update({
      [`players.${_playerId}`]: { name: playerName, faction: null, ready: false }
    });
    _listenFactionPicker();
    return true;
  }

  // ── Auto-assign a random unclaimed faction ───────────────────────────────────
  async function autoAssign(playableFactions) {
    const snap = await _gameRef().get();
    if (!snap.exists) return;
    const data     = snap.data();
    const claimed  = new Set(Object.keys(data.factionClaims || {}));
    const available = playableFactions.filter(f => !claimed.has(f));
    if (!available.length) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    await claimFaction(pick);
  }

  // ── Claim a faction (atomic — server wins on conflict) ───────────────────────
  // Returns true if claim succeeded, false if the faction was already taken.
  async function claimFaction(factionId) {
    if (!_online() || !_gameId) return false;
    try {
      const ok = await _db.runTransaction(async tx => {
        const doc = await tx.get(_gameRef());
        if (!doc.exists) return false;
        const data   = doc.data();
        const claims = { ...(data.factionClaims || {}) };

        // Release any existing claim by this player first
        for (const [fId, pId] of Object.entries(claims)) {
          if (pId === _playerId) delete claims[fId];
        }

        // Attempt claim (null = release only)
        if (factionId) {
          if (claims[factionId]) return false; // taken by someone else
          claims[factionId] = _playerId;
        }

        tx.update(_gameRef(), {
          factionClaims: claims,
          [`players.${_playerId}.faction`]: factionId || null,
          [`players.${_playerId}.ready`]:   false,
        });
        return true;
      });

      if (ok) _myFaction = factionId || null;
      return ok;
    } catch (e) {
      console.warn("[MP] claimFaction failed", e);
      return false;
    }
  }

  // ── Mark player as "random" (no specific claim) ─────────────────────────────
  async function setFactionRandom() {
    if (!_online() || !_gameId) return;
    _myFaction = "random";
    await _gameRef().update({
      [`players.${_playerId}.faction`]: "random",
      [`players.${_playerId}.ready`]:   false,
    });
  }

  // ── Ready up ─────────────────────────────────────────────────────────────────
  async function setReady(ready = true) {
    if (!_online() || !_gameId) return;
    await _gameRef().update({ [`players.${_playerId}.ready`]: ready });
  }

  // ── Start game (host only) ───────────────────────────────────────────────────
  async function startGame() {
    if (!_online() || !_isHost) return;
    const gameState = _serialize();
    await _gameRef().update({ status: "playing", gameState });
    _listenGameState();
  }

  // ── Push state after every turn ──────────────────────────────────────────────
  async function pushState() {
    if (!_online() || !_gameId) return;
    try {
      await _gameRef().update({ gameState: _serialize() });
    } catch (e) {
      console.warn("[MP] pushState failed", e);
    }
  }

  // ── Faction picker listener ──────────────────────────────────────────────────
  function _listenFactionPicker() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _unsubscribe = _gameRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      _lastRoomData = data;

      // Server is authoritative — sync my faction from the snapshot
      const myEntry = data.players?.[_playerId];
      if (myEntry) _myFaction = myEntry.faction || null;

      if (typeof _onFactionUpdate === "function") _onFactionUpdate(data, _playerId);

      if (data.status === "playing") {
        if (!_isHost && data.gameState) _deserialize(data.gameState);
        _listenGameState();
        if (typeof _onGameStart === "function") _onGameStart(data);
      }
    });
  }

  // ── In-game listener ─────────────────────────────────────────────────────────
  function _listenGameState() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _unsubscribe = _gameRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      if (!data.gameState) return;
      const myTurn = turnOrder[currentTurnIndex] === _myFaction;
      if (myTurn) return;
      if (data.gameState.updatedAt !== (window._lastStateTimestamp || 0)) {
        window._lastStateTimestamp = data.gameState.updatedAt;
        _deserialize(data.gameState);
        drawMap();
        updateTurnInfo();
        updateVPInfo();
        if (typeof _onRemoteState === "function") _onRemoteState(data.gameState);
      }
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  function isMyTurn() {
    if (!_myFaction) return true;
    return turnOrder[currentTurnIndex] === _myFaction;
  }

  function myFaction()   { return _myFaction; }
  function gameId()      { return _gameId; }
  function online()      { return _online(); }
  function isHost()      { return _isHost; }
  function playerId()    { return _playerId; }
  function getRoomData() { return _lastRoomData; }

  function onRemoteState(cb)   { _onRemoteState   = cb; }
  function onFactionUpdate(cb) { _onFactionUpdate = cb; }
  function onGameStart(cb)     { _onGameStart     = cb; }

  return {
    init, createGame, joinGame, claimFaction, autoAssign, setFactionRandom, setReady, startGame, pushState,
    isMyTurn, myFaction, gameId, online, isHost, playerId, getRoomData,
    onRemoteState, onFactionUpdate, onGameStart,
  };
})();
