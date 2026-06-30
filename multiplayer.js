// multiplayer.js — Firebase Firestore async multiplayer
//
// Setup: add your Firebase config to index.html (see comment there).
// If window.FIREBASE_CONFIG is not set the game runs fully offline.
//
// Room lifecycle:
//   Create  → 6-char code generated, creator picks faction, others join by code
//   Lobby   → each player picks faction + clicks Ready
//   Start   → host clicks Start once everyone ready; game state written to Firestore
//   In-game → only the player whose faction matches currentFaction can act;
//              after endTurn() state is pushed; all others receive it via listener
//   Offline → falls back to single-device mode with no Firestore calls

const MP = (() => {
  let _db       = null;
  let _gameId   = null;     // Firestore document id (= room code)
  let _myFaction = null;    // which faction I control in this session
  let _isHost   = false;
  let _unsubscribe = null;  // Firestore listener cleanup
  let _onRemoteState = null; // callback(state) when remote pushes a new state

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    if (!window.FIREBASE_CONFIG) return; // offline mode
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      _db = firebase.firestore();
      console.log("[MP] Firebase connected");
    } catch (e) {
      console.warn("[MP] Firebase init failed — offline mode", e);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function _online() { return !!_db; }

  function _gameRef() { return _db.collection("games").doc(_gameId); }

  function _makeCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Serialize the full game state (superset of localStorage save)
  function _serialize() {
    return {
      units:            JSON.parse(JSON.stringify(units)),
      tileData:         JSON.parse(JSON.stringify(tileData)),
      turnOrder,
      currentTurnIndex,
      currentPhase,
      turnNumber,
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
    // units is a mutable global array — splice in place
    units.length = 0;
    units.push(...state.units);

    // tileData: clear and repopulate
    for (const k of Object.keys(tileData)) delete tileData[k];
    Object.assign(tileData, state.tileData);

    turnOrder.length = 0;
    turnOrder.push(...state.turnOrder);

    currentTurnIndex = state.currentTurnIndex;
    currentPhase     = state.currentPhase;
    turnNumber       = state.turnNumber;

    for (const k of Object.keys(reserves))       delete reserves[k];
    for (const k of Object.keys(victoryPoints))  delete victoryPoints[k];
    for (const k of Object.keys(gold))           delete gold[k];
    for (const k of Object.keys(diplomacyHands)) delete diplomacyHands[k];
    for (const k of Object.keys(personalityCards)) delete personalityCards[k];
    for (const k of Object.keys(controlTypes))   delete controlTypes[k];

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
  async function createGame(myFaction) {
    _myFaction = myFaction;
    _isHost    = true;

    if (!_online()) {
      console.log("[MP] Offline — no room created");
      return null;
    }

    _gameId = _makeCode();
    const doc = {
      host:      myFaction,
      status:    "lobby",   // lobby | playing | finished
      players:   { [myFaction]: { ready: false } },
      createdAt: Date.now(),
    };
    await _gameRef().set(doc);
    _listenLobby();
    return _gameId;
  }

  // ── Join game ────────────────────────────────────────────────────────────────
  async function joinGame(code, myFaction) {
    if (!_online()) return false;
    _gameId    = code.toUpperCase();
    _myFaction = myFaction;
    _isHost    = false;

    const snap = await _gameRef().get();
    if (!snap.exists) { alert("Room not found: " + _gameId); return false; }
    const data = snap.data();
    if (data.status !== "lobby") { alert("Game already started."); return false; }

    await _gameRef().update({
      [`players.${myFaction}`]: { ready: false }
    });
    _listenLobby();
    return true;
  }

  // ── Ready up ─────────────────────────────────────────────────────────────────
  async function setReady(ready = true) {
    if (!_online() || !_gameId) return;
    await _gameRef().update({ [`players.${_myFaction}.ready`]: ready });
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

  // ── Listeners ────────────────────────────────────────────────────────────────
  function _listenLobby() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _unsubscribe = _gameRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      _updateLobbyUI(data);
      if (data.status === "playing") {
        // Host already pushed initial state; others receive it here
        if (!_isHost && data.gameState) {
          _deserialize(data.gameState);
        }
        _listenGameState();
        _hideLobbyUI();
      }
    });
  }

  function _listenGameState() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _unsubscribe = _gameRef().onSnapshot(snap => {
      if (!snap.exists) return;
      const data = snap.data();
      if (!data.gameState) return;

      const myTurn = turnOrder[currentTurnIndex] === _myFaction;
      if (myTurn) return; // ignore — I'm the one pushing

      // Remote player finished their turn — pull state
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

  // ── Lobby UI ─────────────────────────────────────────────────────────────────
  function _updateLobbyUI(data) {
    const el = document.getElementById("mp-lobby-players");
    if (!el) return;
    const entries = Object.entries(data.players || {});
    el.innerHTML = entries.map(([f, p]) =>
      `<div class="mp-player ${p.ready ? 'mp-ready' : ''}">
        <span>${f}</span>
        <span>${p.ready ? "✓ Ready" : "Waiting…"}</span>
       </div>`
    ).join("");

    const startBtn = document.getElementById("mp-start-btn");
    if (startBtn) {
      const allReady = entries.length > 0 && entries.every(([, p]) => p.ready);
      startBtn.disabled = !_isHost || !allReady;
      startBtn.textContent = _isHost ? (allReady ? "Start Game" : "Waiting for players…") : "Waiting for host…";
    }

    const codeEl = document.getElementById("mp-room-code");
    if (codeEl && _gameId) codeEl.textContent = "Room: " + _gameId;
  }

  function _hideLobbyUI() {
    const el = document.getElementById("mp-lobby");
    if (el) el.style.display = "none";
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  function isMyTurn() {
    if (!_myFaction) return true; // offline — always your turn
    return turnOrder[currentTurnIndex] === _myFaction;
  }

  function myFaction() { return _myFaction; }
  function gameId()    { return _gameId; }
  function online()    { return _online(); }

  function onRemoteState(cb) { _onRemoteState = cb; }

  return { init, createGame, joinGame, setReady, startGame, pushState, isMyTurn, myFaction, gameId, online, onRemoteState };
})();
