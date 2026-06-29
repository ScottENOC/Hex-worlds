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
