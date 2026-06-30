// ── Diplomacy Card Deck ───────────────────────────────────────────────────────
// Full 46-card deck matching the rulebook.
//
// Regular cards: type, value, isBribe, canBanish
//   canBanish — if the roll fails, ambassador risks banishment (roll d6: 1-2 = banished)
//   isBribe   — counts as a bribe for personality card #11 bonus
//
// Special merc cards: type:"specialMerc", mercType, entryType, entryName
//   entryType: "fixed"           → ambassador must go to entryHex
//   entryType: "friendlyCastle"  → any friendly fortress hex
//   entryType: "friendlyPort"    → any friendly port hex
//   entryType: "friendlyNonCastle" → any friendly non-fortress land hex

const DIPLO_CARD_TEMPLATES = [
  // Long Oration — standard, no penalty
  { type:"longOration",        value:1, label:"Long Oration +1" },
  { type:"longOration",        value:1, label:"Long Oration +1" },
  { type:"longOration",        value:1, label:"Long Oration +1" },
  { type:"longOration",        value:2, label:"Long Oration +2" },
  { type:"longOration",        value:2, label:"Long Oration +2" },

  // Bribe — isBribe; personality card #11 gives +1 here
  { type:"bribe",              value:1, label:"Bribe +1",        isBribe:true },
  { type:"bribe",              value:1, label:"Bribe +1",        isBribe:true },
  { type:"bribe",              value:1, label:"Bribe +1",        isBribe:true },
  { type:"bribe",              value:2, label:"Bribe +2",        isBribe:true },
  { type:"bribe",              value:2, label:"Bribe +2",        isBribe:true },
  { type:"bribe",              value:2, label:"Bribe +2",        isBribe:true },

  // Crass Bribe — isBribe; failure may get ambassador banished
  { type:"crassBribe",         value:2, label:"Crass Bribe +2",  isBribe:true, canBanish:true },
  { type:"crassBribe",         value:2, label:"Crass Bribe +2",  isBribe:true, canBanish:true },
  { type:"crassBribe",         value:2, label:"Crass Bribe +2",  isBribe:true, canBanish:true },

  // Threats — failure may get ambassador banished
  { type:"threats",            value:1, label:"Threats +1",      canBanish:true },
  { type:"threats",            value:1, label:"Threats +1",      canBanish:true },
  { type:"threats",            value:2, label:"Threats +2",      canBanish:true },
  { type:"threats",            value:2, label:"Threats +2",      canBanish:true },

  // Diplomatic Marriage — standard
  { type:"diplomaticMarriage", value:1, label:"Diplomatic Marriage +1" },
  { type:"diplomaticMarriage", value:1, label:"Diplomatic Marriage +1" },
  { type:"diplomaticMarriage", value:1, label:"Diplomatic Marriage +1" },
  { type:"diplomaticMarriage", value:2, label:"Diplomatic Marriage +2" },

  // Blackmail — failure may get ambassador banished
  { type:"blackmail",          value:2, label:"Blackmail +2",    canBanish:true },
  { type:"blackmail",          value:2, label:"Blackmail +2",    canBanish:true },
  { type:"blackmail",          value:3, label:"Blackmail +3",    canBanish:true },

  // White Magic — standard
  { type:"whiteMagic",         value:1, label:"White Magic +1" },
  { type:"whiteMagic",         value:1, label:"White Magic +1" },
  { type:"whiteMagic",         value:2, label:"White Magic +2" },
  { type:"whiteMagic",         value:2, label:"White Magic +2" },

  // Black Magic — failure may get ambassador banished
  { type:"blackMagic",         value:2, label:"Black Magic +2",  canBanish:true },
  { type:"blackMagic",         value:2, label:"Black Magic +2",  canBanish:true },
  { type:"blackMagic",         value:2, label:"Black Magic +2",  canBanish:true },
  { type:"blackMagic",         value:3, label:"Black Magic +3",  canBanish:true },

  // ── Special Mercenary Cards ───────────────────────────────────────────────
  { type:"specialMerc", label:"Juulute Wolfheart",          mercType:"juulute",
    entryType:"friendlyCastle",    entryName:"any friendly castle" },
  { type:"specialMerc", label:"Schardenzar the Sorcerer",   mercType:"schardenzar",
    entryType:"friendlyCastle",    entryName:"any friendly castle" },
  { type:"specialMerc", label:"The Black Knight + Stubstaff Guards", mercType:"blackKnight",
    entryType:"fixed",             entryHex:"19,20", entryName:"Stubstaff Keep" },
  { type:"specialMerc", label:"The Bilge Rat + The Reaver", mercType:"bilgeRat",
    entryType:"friendlyPort",      entryName:"any friendly seaport" },
  { type:"specialMerc", label:"The Usurper",                mercType:"usurper",
    entryType:"confusedKingdom",   entryName:"royal castle of a kingdom in confusion" },
  { type:"specialMerc", label:"Ogsbogg the Ogre",           mercType:"ogsbogg",
    entryType:"fixed",             entryHex:"10,1",  entryName:"Stump Hole" },
  { type:"specialMerc", label:"Hamahara the Air Dragon",    mercType:"hamahara",
    entryType:"fixed",             entryHex:"3,18",  entryName:"Winter Rest" },
  { type:"specialMerc", label:"Urmoff the Sea Serpent",     mercType:"urmoff",
    entryType:"fixed",             entryHex:"15,5",  entryName:"Serpent Bay" },
  { type:"specialMerc", label:"Order of the Hippogriff",    mercType:"orderHippogriff",
    entryType:"fixed",             entryHex:"28,24", entryName:"Spires to the Sun" },
  { type:"specialMerc", label:"Ozerg Mountaineers",         mercType:"ozergMtrs",
    entryType:"fixed",             entryHex:"7,22",  entryName:"Ozerg Mountain" },
  { type:"specialMerc", label:"The Scum (×2 units)",        mercType:"scum",
    entryType:"fixed",             entryHex:"20,14", entryName:"Huts of the Scum" },
  { type:"specialMerc", label:"The Wandering People",       mercType:"wanderingPeople",
    entryType:"friendlyNonCastle", entryName:"any friendly non-castle land hex" },
  { type:"specialMerc", label:"Ghost Riders of Khos",       mercType:"ghostRiders",
    entryType:"fixed",             entryHex:"20,33", entryName:"Lost City of Khos" },
];

function buildDiploDeck() {
  const deck = DIPLO_CARD_TEMPLATES.map(t => ({ ...t }));
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

// Draw 1 card for the active faction.
function handleDiploDrawPhase(faction, onComplete) {
  if (!diploDeck.length) diploDeck = buildDiploDeck();
  const drawn = diploDeck.splice(0, 1);
  diplomacyHands[faction] = (diplomacyHands[faction] || []).concat(drawn);
  const summary = drawn.map(c => c.label || `+${c.value}`).join(', ');
  alert(`${faction.toUpperCase()} draws: ${summary}\nHand size: ${diplomacyHands[faction].length}`);
  onComplete();
}
