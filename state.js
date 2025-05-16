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

let turnNumber = 1;
const maxTurns = 1;
let currentPhase = "event";
let declaredCombats = [];
let highlightedTilesByType = {
  movement: [],
  combat: [],
  event: [],
  siege: [],
};

let turnOrder = [];
let currentTurnIndex = 0;
let selectedUnit = null;