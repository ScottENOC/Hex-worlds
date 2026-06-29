// setup.js — pre-game configuration screen
// Runs after all other scripts have loaded.
(function () {
  const SCENARIO_ID = "board-game";

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
          ${playableFactions.map(f => `<option value="${f}"${f === defaultFaction ? " selected" : ""}>${displayNames[f]}</option>`).join("")}
        </select>
        <select class="setup-control">
          <option value="human">Human</option>
          <option value="cpu">CPU</option>
        </select>`;
      box.appendChild(div);
    }
  }

  async function startGame(playableFactions, displayNames, allFactions) {
    const slots = [...document.querySelectorAll(".setup-slot")];
    const chosen = new Map();
    for (const slot of slots) {
      const f = slot.querySelector(".setup-faction").value;
      const c = slot.querySelector(".setup-control").value;
      if (chosen.has(f)) { alert(`${displayNames[f]} is already taken by another player.`); return; }
      chosen.set(f, c);
    }

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

    await loadScenario(SCENARIO_ID);
    initGame({ players: [...chosen.entries()].map(([faction, control]) => ({ faction, control })) });
  }

  // Load scenario metadata to populate the setup screen, then wire up events
  fetch(`scenarios/${SCENARIO_ID}/scenario.json`)
    .then(r => r.json())
    .then(data => {
      const playableFactions = Object.entries(data.factions)
        .filter(([, f]) => f.playable)
        .map(([id]) => id);
      const displayNames = Object.fromEntries(
        Object.entries(data.factions).map(([id, f]) => [id, f.display])
      );
      const allFactions = Object.keys(data.factions);

      buildSlots(playableFactions, displayNames);

      document.getElementById("setup-count").addEventListener("change", () =>
        buildSlots(playableFactions, displayNames)
      );
      document.getElementById("setup-start-btn").addEventListener("click", () =>
        startGame(playableFactions, displayNames, allFactions)
      );
    });
})();
