// Each card has a numeric value (+1, +2, or +3) representing diplomatic influence.
// The deck is generic (no per-kingdom cards) until kingdoms are added to the map.
const DIPLO_DECK_TEMPLATE = [
  ...Array(10).fill(1),
  ...Array(7).fill(2),
  ...Array(4).fill(3),
];

function buildDiploDeck() {
  const deck = DIPLO_DECK_TEMPLATE.map(v => ({ value: v }));
  shuffle(deck);
  return deck;
}

// Scan tileData for neutral fortresses and register them in diplomaticInfluence.
function initDiplomaticInfluence() {
  const playerFactions = new Set(Object.keys(factions).filter(f => f !== "none"));
  for (const key in tileData) {
    const tile = tileData[key];
    if (tile?.isFortress && tile.faction && !playerFactions.has(tile.faction)) {
      if (!diplomaticInfluence[tile.faction]) {
        diplomaticInfluence[tile.faction] = {};
        for (const f of factionList) diplomaticInfluence[tile.faction][f] = 0;
      }
    }
  }
}

// Auto-draw 2 cards for the active faction, then call onComplete.
function handleDiploDrawPhase(faction, onComplete) {
  if (diploDeck.length < 2) {
    diploDeck = buildDiploDeck();
  }
  const drawn = diploDeck.splice(0, 2);
  diplomacyHands[faction] = (diplomacyHands[faction] || []).concat(drawn);
  alert(`${faction.toUpperCase()} draws ${drawn.length} diplomatic card(s): ${drawn.map(c => `+${c.value}`).join(', ')}\nHand size: ${diplomacyHands[faction].length}`);
  onComplete();
}
