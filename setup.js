// setup.js — pre-game configuration screen
// Runs after all other scripts have loaded.
(function () {
  const PLAYABLE = ["neuth","immer","zorn","dwarfland","mivior","trolls","eaters","hothior","muetar"];
  const DISPLAY = {
    neuth:"Neuth (Elves)", immer:"Immer", zorn:"Zorn (Goblins)",
    dwarfland:"Ghem (Dwarves)", mivior:"Mivior", trolls:"Trolls",
    eaters:"Eaters of Wisdom", hothior:"Hothior", muetar:"Muetar"
  };

  function buildSlots() {
    const n = +document.getElementById("setup-count").value;
    const box = document.getElementById("setup-slots");
    box.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const div = document.createElement("div");
      div.className = "setup-slot";
      // Default each slot to a different faction
      const defaultFaction = PLAYABLE[i] || PLAYABLE[0];
      div.innerHTML = `
        <span class="setup-label">Player ${i + 1}</span>
        <select class="setup-faction">
          ${PLAYABLE.map(f => `<option value="${f}"${f === defaultFaction ? " selected" : ""}>${DISPLAY[f]}</option>`).join("")}
        </select>
        <select class="setup-control">
          <option value="human">Human</option>
          <option value="cpu">CPU</option>
        </select>`;
      box.appendChild(div);
    }
  }

  function startGame() {
    const slots = [...document.querySelectorAll(".setup-slot")];
    const chosen = new Map();
    for (const slot of slots) {
      const f = slot.querySelector(".setup-faction").value;
      const c = slot.querySelector(".setup-control").value;
      if (chosen.has(f)) { alert(`${DISPLAY[f]} is already taken by another player.`); return; }
      chosen.set(f, c);
    }

    // Populate globals
    for (const [f, c] of chosen) controlTypes[f] = c;

    // Unclaimed playable factions → neutral
    for (const f of PLAYABLE) {
      if (!chosen.has(f)) { controlTypes[f] = "neutral"; neutralFactions.add(f); }
    }
    // NPC kingdoms always neutral
    for (const k of Object.keys(neutralKingdomColors)) {
      controlTypes[k] = "neutral"; neutralFactions.add(k);
    }

    document.getElementById("setup-screen").style.display = "none";
    initGame({ players: [...chosen.entries()].map(([faction, control]) => ({ faction, control })) });
  }

  document.getElementById("setup-count").addEventListener("change", buildSlots);
  document.getElementById("setup-start-btn").addEventListener("click", startGame);
  buildSlots(); // initial render with default count
})();
