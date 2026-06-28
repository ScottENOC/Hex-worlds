const factions = {
  "none": "#d2b48c",
  "neuth": "darkgreen",
  "zorn": "#66CDAA",
  "dwarfland": "lightgreen",
  "hothior": "#E85025",
  "immer": "#e25822",
  "mivior": "#C8A2C8",
  "trolls": "#8eae4a",
  "muetar": "#FFD700"
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

// Rulebook: 13 mercenary armies (moneybags) + 2 mercenary fleets
for (let i = 0; i < 13; i++) {
  mercenaryReserves.land.push({
    isFleet: false,
    isMercenary: true,
    faction: null,
    hasMoved: false,
    moveSpeed: 5,
    combatStrength: 1,
    siegeStrength: 1,
    isLeader: false,
    startCoords: null
  });
}

for (let i = 0; i < 2; i++) {
  mercenaryReserves.fleet.push({
    isFleet: true,
    isMercenary: true,
    faction: null,
    hasMoved: false,
    moveSpeed: 8,
    combatStrength: 1,
    siegeStrength: 1,
    isLeader: false,
    startCoords: null
  });
}

// Barbarian pool — shared unnamed counters; named tribal units are tracked per-player.
// Each player may recruit up to 18 Barbarians (5 named + unnamed); max 15 on map at once.
const BARBARIAN_TRIBES = ["Savages", "Outlanders", "Wildmen", "Cannibals", "Tribesmen", "Berserkers"];
const barbarianPool = [];  // filled at runtime; isBarbarian: true units in reserve
for (let i = 0; i < 43; i++) {
  barbarianPool.push({
    isBarbarian: true,
    isMercenary: false,
    isLeader: false,
    isFleet: false,
    faction: null,
    hasMoved: false,
    moveSpeed: 5,
    combatStrength: 1,
    siegeStrength: 1,
    startCoords: null
  });
}
// Per-player barbarian tracking: { faction → { tribe, inPlay, named } }
const barbarianOwners = {};

// Special mercenary pool — one instance per merc type.
// faction:null = available; faction set = in play with that player.
const specialMercPool = {
  scum: [
    { id:"scum_1", name:"The Scum", isScum:true, isSpecialMerc:true, isLeader:false, isFleet:false,
      combatStrength:0, siegeStrength:0, moveSpeed:5, hasMoved:false, faction:null },
    { id:"scum_2", name:"The Scum", isScum:true, isSpecialMerc:true, isLeader:false, isFleet:false,
      combatStrength:0, siegeStrength:0, moveSpeed:5, hasMoved:false, faction:null }
  ],
  ogsbogg: [
    { id:"ogsbogg", name:"Ogsbogg the Ogre", isOgsbogg:true, isSpecialMerc:true, isLeader:false,
      isFleet:false, combatStrength:5, siegeStrength:4, siegeDieBonus:1, moveSpeed:4, hasMoved:false, faction:null }
  ],
  ozergMtrs: [
    { id:"ozerg_mtrs", name:"Ozerg Mountaineers", isSpecialMerc:true, isLeader:false, isFleet:false,
      combatStrength:5, siegeStrength:2, moveSpeed:5, hasMoved:false, faction:null }
  ],
  hamahara: [
    { id:"hamahara", name:"Hamahara the Air Dragon", isHamahara:true, isSpecialMerc:true,
      isFlying:true, isLeader:false, isFleet:false, combatStrength:15, siegeStrength:0,
      canCarryLeader:true, moveSpeed:99, hasMoved:false, faction:null }
  ],
  urmoff: [
    { id:"urmoff", name:"Urmoff the Sea Serpent", isUrmoff:true, isSpecialMerc:true,
      isFleet:true, isSubmersible:true, combatStrength:10, siegeStrength:0, moveSpeed:10,
      hasMoved:false, faction:null }
  ],
  blackKnight: [
    { id:"black_knight", name:"The Black Knight", isBlackKnight:true, isSpecialMerc:true,
      isLeader:true, isMagical:true, isFleet:false, combatStrength:0, siegeStrength:0,
      combatDieBonus:1, moveSpeed:7, hasMoved:false, hasTakenAFateDieRoll:false,
      isImmortal:true, faction:null },
    { id:"stubstaff_guards", name:"Stubstaff Guards", isStubstaffGuards:true, isSpecialMerc:true,
      isLeader:false, isFleet:false, combatStrength:3, siegeStrength:2, moveSpeed:7,
      hasMoved:false, faction:null }
  ],
  juulute: [
    { id:"juulute", name:"Juulute Wolfheart", isJuulute:true, isSpecialMerc:true,
      isLeader:true, isMagical:false, isFleet:false, combatStrength:0, siegeStrength:0,
      combatDieBonus:1, canLeadBarbarians:true, moveSpeed:8, hasMoved:false,
      hasTakenAFateDieRoll:false, faction:null }
  ],
  schardenzar: [
    { id:"schardenzar", name:"Schardenzar the Sorcerer", isSchardenzar:true, isSpecialMerc:true,
      isLeader:true, isMagical:true, isFleet:false, combatStrength:0, siegeStrength:0,
      combatDieBonus:1, riverWalk:true, waterWalk:true, moveSpeed:8, hasMoved:false,
      hasTakenAFateDieRoll:false, faction:null }
  ],
  bilgeRat: [
    { id:"bilge_rat", name:"The Bilge Rat", isBilgeRat:true, isSpecialMerc:true,
      isLeader:true, isMagical:false, isFleet:false, combatStrength:0, siegeStrength:0,
      navalCombatDieBonus:1, moveSpeed:8, hasMoved:false, hasTakenAFateDieRoll:false,
      faction:null },
    { id:"the_reaver", name:"The Reaver", isReaver:true, isSpecialMerc:true,
      isLeader:false, isFleet:true, combatStrength:10, siegeStrength:0, moveSpeed:10,
      hasMoved:false, faction:null }
  ],
  usurper: [
    { id:"usurper", name:"The Usurper", isUsurper:true, isSpecialMerc:true,
      isLeader:true, isMagical:false, isFleet:false, combatStrength:0, siegeStrength:0,
      moveSpeed:7, hasMoved:false, hasTakenAFateDieRoll:false, faction:null }
  ],
  orderHippogriff: [
    { id:"order_hippogriff", name:"Order of the Hippogriff", isOrderHippogriff:true,
      isSpecialMerc:true, isLeader:false, isFleet:false, isFlying:true, mustLand:true,
      combatStrength:12, siegeStrength:0, moveSpeed:8, hasMoved:false, faction:null }
  ],
  ghostRiders: [
    { id:"ghost_riders", name:"Ghost Riders of Khos", isGhostRiders:true, isSpecialMerc:true,
      isLeader:false, isFleet:false, isFlying:true, isMagical:true,
      onlyMagicCanAttack:true, frightenAttack:true,
      combatStrength:1, siegeStrength:0, moveSpeed:8, hasMoved:false, faction:null }
  ],
  wanderingPeople: [
    { id:"wandering_people", name:"Wandering People", isWanderingPeople:true, isSpecialMerc:true,
      isLeader:false, isFleet:false, isImmovable:true,
      combatStrength:0, siegeStrength:0, moveSpeed:0, hasMoved:false, faction:null },
    { id:"wandering_troop", name:"Wandering People Troop", isWanderingTroop:true, isSpecialMerc:true,
      isLeader:false, isFleet:false, entrancinMusic:true,
      combatStrength:6, siegeStrength:2, moveSpeed:5, hasMoved:false, faction:null }
  ]
};

// Ambassador tracking — { faction: { deadUntilTurn: N } }
const ambassadorStatus = {};
// Banishment — { faction: Set of kingdom names where ambassador is banned }
const ambassadorBanned = {};

// ── Personality Card System ────────────────────────────────────────────────────
// Non-player monarchs each receive one personality card face-down at game start.
// Cards define the monarch's traits and how they respond to diplomacy.
//
// Card effects used in diplomacy rolls:
//   diplomacyBonus      — flat modifier to the diplomatic die roll (unconditional)
//   bribeBonus          — extra +N when the played card is a bribe type
//   crassBribeImmunity  — crass bribes cannot get the ambassador banished from this kingdom
//   monarchCantLeave    — monarch's leader unit may never leave the royal castle hex
//
// Additional cards should be added here as implemented.
const PERSONALITY_CARDS = {
  11: {
    id: 11,
    name: "Receptive to Bribes",
    desc: "Ambassadors offering bribes or crass bribes get +1 to the diplomatic roll. Crass bribes cannot get you banished from this kingdom.",
    bribeBonus: 1,
    crassBribeImmunity: true
  },
  17: {
    id: 17,
    name: "Castle-Bound Monarch",
    desc: "The monarch cannot leave the royal castle.",
    monarchCantLeave: true
  }
};

// Assigned at game start: { "muetar": cardId, "pon": cardId, ... }
// Populated by assignPersonalityCards() called from initGame.
const personalityCards = {};
 
const factionList = Object.keys(factions).filter(f => f !== "none");

// Colours for neutral kingdoms that appear on the map but aren't player-controlled.
// Drawing code uses kingdomColors so new kingdoms just need an entry here.
const neutralKingdomColors = {
  "pon":       "#4488CC",
  "shucassam": "#9B4B1C",
  "rombune":   "#CC22BB",
  "wasteland": "#C4A265",
  "eaters":    "#888888",   // Eaters of Wisdom — dark grey
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

// Populated by setup screen before initGame runs
let controlTypes = {};          // { faction: "human" | "cpu" | "neutral" }
const neutralFactions = new Set(); // factions not assigned to any player