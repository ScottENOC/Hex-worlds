const factions = {
  "none": "#d2b48c",
  "neuth": "darkgreen",
  "zorn": "#66CDAA",
  "dwarfland": "lightgreen",
  "immer": "#e25822",
  "mivior": "#C8A2C8",
  "trolls": "#8eae4a"
};
 
const reserves = {
  neuth: [],
  immer: [],
  zorn:  [],
  dwarfland:  [],
  mivior:   [],
  trolls:   []
};

const victoryPoints = {
  neuth: 0,
  immer: 0,
  zorn:  0,
  dwarfland:  0,
  mivior:   0,
  trolls:   0
};

/*const factions = {
  "none": "#d2b48c",           // neutral
  "gondor": "#003366",         // deep navy
  "rohan": "#228B22",          // forest green
  "mordor": "#4B0000",         // dark red/black
  "isengard": "#708090",       // slate gray
  "harad": "#8B4513",          // saddle brown
  "elves": "#32CD32",          // lime green
  "dwarves": "#DAA520",        // goldenrod
  "orcs": "#556B2F"            // dark olive green
};

const reserves = {
  gondor: [],
  rohan: [],
  mordor: [],
  isengard: [],
  harad: [],
  elves: [],
  dwarves: [],
  orcs: []
};*/

const mercenaryReserves = {
  land: [],
  fleet: []
};

// Example: 12 land, 4 fleet mercenaries
for (let i = 0; i < 12; i++) {
  mercenaryReserves.land.push({
    isFleet: false,
    isMercenary: true,
    faction: null,
    hasMoved: false,
    moveSpeed: 5,
    startCoords: null
  });
}

for (let i = 0; i < 4; i++) {
  mercenaryReserves.fleet.push({
    isFleet: true,
    isMercenary: true,
    faction: null,
    hasMoved: false,
    moveSpeed: 8,
    startCoords: null
  });
}
 
const factionList = Object.keys(factions).filter(f => f !== "none");

// Colours for neutral kingdoms that appear on the map but aren't player-controlled.
// Drawing code uses kingdomColors so new kingdoms just need an entry here.
const neutralKingdomColors = {
  "hothior":   "#E85025",
  "muetar":    "#FFD700",
  "pon":       "#4488CC",
  "shucassam": "#9B4B1C",
  "rombune":   "#CC22BB",
  "wasteland": "#C4A265",
};
const kingdomColors = { ...factions, ...neutralKingdomColors };

// Gold treasury per player faction
const gold = { neuth: 5, immer: 5, zorn: 5, dwarfland: 5, mivior: 5, trolls: 5 };

// Diplomatic influence: { kingdomName: { factionName: score } }
const diplomaticInfluence = {};

// Each player's hand of diplomatic cards
const diplomacyHands = {};
for (const f of factionList) diplomacyHands[f] = [];

// Shared diplomatic deck — populated by buildDiploDeck() in initGame
let diploDeck = [];

// Factions whose leader has died and who are out of the game
const eliminatedFactions = new Set();

let turnNumber = 1;
const maxTurns = 20;
let currentPhase = "event";
let declaredCombats = [];   // array of { fromHex:{row,col}, targetHex:{row,col} }
let highlightedTilesByType = {
  movement: [],
  combat: [],
  event: [],
  siege: [],
};

let turnOrder = [];
let currentTurnIndex = 0;
let selectedUnit = null;