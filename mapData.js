const tileData = {};

function paintTiles(coords, faction, terrain, rivers = [], lakes = []) {
  coords.forEach(([row, col]) => {
    const key = `${row},${col}`;
    if (!tileData[key]) {
      tileData[key] = {};
    }
    tileData[key].faction = faction;
    tileData[key].terrain = terrain;
    tileData[key].rivers = rivers;
    tileData[key].lakes = lakes; // <-- lakes is always an array (even if empty)
  });
}

function initializeMap() {

  paintTiles([
  [1,1], [1,2], [1,3]
], "neuth", ["forest"]);

paintTiles([
  [1,4]
], "dwarfland", ["forest"]);

paintTiles([
[2,3], [11,33], [16,33]
], "dwarfland", ["plains"]);

paintTiles([
[12,32], [12,33], [13,33], [16,32], [17,33]
], "dwarfland", ["mountain"]);

paintTiles([
[17,34]
], "dwarfland", ["hills"]);



tileData["2,3"].name = "Aws Noir";
tileData["2,3"].isFortress = true;
tileData["2,3"].fortressStrength = 4;

tileData["11,33"].name = "Mines of Rozekgg";
tileData["11,33"].isFortress = true;
tileData["11,33"].fortressStrength = 5;

tileData["16,33"].name = "Alzak";
tileData["16,33"].isFortress = true;
tileData["16,33"].fortressStrength = 4;


paintTiles([[6,5]], "neuth", "plains");
tileData["6,5"].isFortress = true;
tileData["6,5"].name = "Ider Bolis";
tileData["6,5"].fortressStrength = 5;

paintTiles([[14,6],[3,27],[23,34],[29,17]], "trolls", "plains");
tileData["14,6"].isFortress = true;
tileData["14,6"].name = "The Stone Face";
tileData["14,6"].fortressStrength = 1;
tileData["3,27"].name = "The Crag";
tileData["23,34"].name = "The Gathering";
tileData["29,17"].name = "The Shunned Vale";

paintTiles([[13,6],[13,7],[13,8],[14,5],[14,7]], "trolls", "forest");

paintTiles([[14,8]], "trolls", ["forest", "mountain"]);

paintTiles([[15,6]], "trolls", "mountain");

paintTiles([[3,23]], "zorn", "plains");
tileData["3,23"].name = "The Pits";
tileData["3,23"].isFortress = true;
tileData["3,23"].fortressStrength = 4;

paintTiles([
  [3,24], [2,23]
], "zorn", "plains");

paintTiles([[3,25]], "zorn", ["mountain"]);
paintTiles([[2,24]], "zorn", ["hills"]);

paintTiles([
  [2,4], [3,3]
], "neuth", ["forest", "mountain"]);

paintTiles([[5,6]], "neuth", ["forest"]);
tileData["5,6"].name = "Mires of the Sinking Kind";

paintTiles([[4,15]], "immer", ["plains"]);
tileData["4,15"].name = "Gorpin Woodsmen";

paintTiles([[4,25]], "zorn", ["forest"]);
tileData["4,25"].name = "Leeks";

paintTiles([
  [4,22], [4,23]
], "zorn", ["forest"]);
tileData["4,22"].name = "Shrieker's Scrub";
tileData["4,23"].name = "Shrieker's Scrub";

paintTiles([[10,1]], "none", ["plains"]);
tileData["10,1"].name = "Stump Hole";
tileData["10,1"].isEntryHex = "ogsbogg";

paintTiles([[5,11]], "none", ["plains"]);
tileData["5,11"].name = "The Unknown Army";
tileData["5,11"].isAncientBattlefield = true;

paintTiles([[2,16]], "none", ["plains"]);
tileData["2,16"].name = "The Temple of Kings";
tileData["2,16"].isTempleOfKings = true;

paintTiles([[15,5]], "none", ["plains"], [], [0,1,2,3,4,5]);
tileData["15,5"].name = "Serpent Bay";
tileData["15,5"].isEntryHex = "urmoff";

paintTiles([[3,18]], "none", ["plains"]);
tileData["3,18"].name = "Winter Rest";
tileData["3,18"].isEntryHex = "hamahara";

paintTiles([[1,8]], "none", ["forest"]);
tileData["1,8"].name = "Sacred Stones";
tileData["1,8"].isSacredStones = true;

paintTiles([[7,22]], "none", ["plains"]);
tileData["7,22"].name = "Ozerg Mountaineers";
tileData["7,22"].isEntryHex = "ozergMtrs";

paintTiles([[2,9]], "neuth", ["forest", "hills"]);

paintTiles([[7,14]], "immer", "plains");
tileData["7,14"].name = "Castle Altarr";
tileData["7,14"].isFortress = true;
tileData["7,14"].fortressStrength = 3;

paintTiles([[4,12]], "immer", "plains");
tileData["4,12"].name = "Lone Wirzor";
tileData["4,12"].isFortress = true;
tileData["4,12"].fortressStrength = 2;

paintTiles([[6,18]], "immer", "plains");
tileData["6,18"].name = "The Gap Fortress";
tileData["6,18"].isFortress = true;
tileData["6,18"].fortressStrength = 2;

paintTiles([[9,16]], "immer", "plains");
tileData["9,16"].name = "Muscaster";
tileData["9,16"].isFortress = true;
tileData["9,16"].fortressStrength = 3;

paintTiles([[13,3]], "mivior", "plains", [], [1,2]);
tileData["13,3"].name = "Addat";
tileData["13,3"].isFortress = true;
tileData["13,3"].fortressStrength = 2;

paintTiles([[22,4]], "mivior", "plains", [], [0,5]);
tileData["22,4"].name = "Colist";
tileData["22,4"].isFortress = true;
tileData["22,4"].fortressStrength = 4;

paintTiles([[19,4]], "mivior", "plains", [], [1,2,3,4,5]);
tileData["19,4"].name = "The Shining Isle";
tileData["19,4"].isFortress = true;
tileData["19,4"].fortressStrength = 3;

paintTiles([[17,5]], "mivior", "plains", [], [3]);
tileData["17,5"].name = "Boran Moor";
tileData["17,5"].isFortress = true;
tileData["17,5"].fortressStrength = 1;

paintTiles([
  [2,1], [2,2], [3,1], [3,2], [4,1], [4,2], [5,1], [5,2],
  [6,1], [6,2], [7,1], [7,2], [8,1], [8,2], [9,1], [9,2],
  [6,3], [5,3], [5,4], [5,5], [4,3], [4,4], [6,4],
  [2,5], [2,6], [2,7], [2,8],
  [3,7],
  [4,8], [4,9],
  [5,9], [5,10],
  [6,8], [6,9], [6,10],
  [7,3],
  [7,9], [7,10], [7,11],
  [8,3], [8,4],
  [8,8], [8,9],
  [9,3], [9,4], [9,5],
  [9,8], [9,9],
  [10,2], [10,3], [10,4], [10,5],
  [10,9]
], "neuth", "forest");
 
 
paintTiles([
  [3,4]], "neuth", "forest", [0,4]);
 
paintTiles([
  [3,6]], "neuth", "forest", [1,2,3]);
 
paintTiles([
[3,8]], "neuth", "forest", [0,2]);
 
paintTiles([
  [3,5],[3,9]], "neuth", "forest", [0,3]);
 
paintTiles([
[4,5]], "neuth", "forest", [0,5]);
 
paintTiles([
[4,6]], "neuth", "forest", [0,1,3,4]);
 
paintTiles([
  [6,6]], "neuth", "forest", [0,2,5]);
 
paintTiles([
  [5,7]], "neuth", "forest", [0,1,2,4]);
 
paintTiles([
  [6,7]], "neuth", "forest", [3,4]);
 
paintTiles([
  [9,6]], "neuth", "forest", [0,5]);
 
paintTiles([
  [9,7],[10,8]], "neuth", "forest", [1,3]);
 
paintTiles([[7, 4]], "neuth", "forest", [], [0]);
 
paintTiles([[7, 5]], "neuth", "forest", [], [0,3,4,5]);
 
paintTiles([[7, 6]], "neuth", "forest", [], [1,2,3,4]);
 
paintTiles([[7, 7]], "neuth", "forest", [0,1], [2]);
 
paintTiles([[7, 8]], "neuth", "forest", [3], []);
 
paintTiles([[8, 5]], "neuth", "forest", [], [0,5]);
 
paintTiles([[8, 6]], "neuth", "forest", [2], [3,4,5]);
 
paintTiles([[8, 7]], "neuth", "forest", [4], []);
 
 
paintTiles([[13,2]], "mivior", "plains", [], [1,2]);
 
paintTiles([[13,1]], "none", "plains", [], [1,2]);
 
paintTiles([[3,11]], "none", "plains", [3,5], []);

paintTiles([[2,12]], "none", "plains", [1,3], []);

paintTiles([[2,14]], "none", "plains", [0,3], []);

paintTiles([[2,11],[2,13]], "none", "plains", [0,2], []);

paintTiles([[2,15]], "none", "mountain", [3,5], []);

paintTiles([[1,16]], "none", "mountain", [2], []);


paintTiles([[14,1], [14,2], [15,1], [15,2], [15,3], [16,1], [16,2], [16,3], [17,1], [17,2], [17,3], [17,4], [18,1], [18,2], [18,3], [19,1], [19,2], [19,3], [20,1], [20,2], [20,3]], "none", "plains", [], [0,1,2,3,4,5]);
 
paintTiles([
  [10,7]], "neuth", "forest", [0,3,4]);
 
paintTiles([
  [4,7]], "neuth", "forest", [1,3,5]);
 
paintTiles(
  [[3,10]],
  "neuth",
  ["hills", "forest"],
  [0,3]
);
 
paintTiles([
  [5,8]], "neuth", "forest", [3,4]);
 
 
paintTiles(
  [[3,17], [5,20]],
  "zorn",
  ["mountain", "forest"]
);
 
 
paintTiles([
  [1,5], [1,6], [1,7]
], "none", "forest");
 
paintTiles([[2,10],[3,12],[4,10],[4,11],
  [11,2], [11,3], [11,4], [12,2], [12,3]
], "none", "hills");
 
paintTiles([[1,9],[1,10],[1,11],[1,12],[1,13],[1,14],[1,17],
  [11,1], [12,2]
], "none", "plains");

paintTiles([
  [1,15], [1,17]
], "none", "mountain");
 
paintTiles([
  [4,13],
  [5,12], [5,13], [5,14],
  [6,11], [6,16],
  [7,12], [7,15], [7,16],
  [8,10], [8,11], [8,12], [8,13], [8,14], [8,15], [8,16],[8,17],
  [9,14], [9,15], [9,17], [9,18], [9,19], [9,20],
  [10,16], [10,17], [10,18],
  [11,17]
], "immer", "plains");
 
paintTiles([
  [3,13]], "immer", "plains", [4,5]);

paintTiles([
  [3,14],
  [3,15], [3,16], [4,14],
  [4,16], [5,16],
  [5,17], [6,17], [7,13],
  [7,17], [10,19], [10,20]
], "immer", "forest");
 
paintTiles([
  [9,11],
  [9,12], [9,13]
], "immer", "marsh");
 
paintTiles([
  [5,15],
  [6,12], [6,13], [6,14],
  [6,15], [9,10],
  [10,10]
], "immer", "hills");
 
paintTiles([
  [7,18],
  [7,19], [8,18], [8,19]
], "immer", "mountain");
 
paintTiles([[6,19]], "immer", ["mountain_pass"]);
tileData["6,19"].name = "Choked in Snow Pass";

paintTiles([
  [1,18],
  [1,19], [1,20], [1,21],
  [1,22], [1,23],[2,17], [2,18], [2,19], [3,25], [4,17], [4,18], [4,24], [4,26], [5,18], [5,19],[5,26], [5,27], [6,21], [6,22], [6,25], [6,26], [7,20], [7,21], [7,23], [7,25], [8,20], [8,21]
], "zorn", "mountain");
 
paintTiles([
  [1,24],
  [2,24]
], "zorn", "hills");
 
paintTiles([
  [2,22], [3,20], [3,21], [4,19], [4,20], [4,21], [5,22],  [5,24], [5,25], [6,23]
], "zorn", "forest");
 
paintTiles([
  [2,20],
  [2,21], [3,19], [5,21], [5,23], [6,20], [6,24], [9,21]
], "zorn", "plains");
 
paintTiles([
  [3,22]
], "zorn", "marsh");

paintTiles([
  [13,4]
], "mivior", "plains",[0,5],[2]);

paintTiles([
  [12,4]
], "mivior", "plains",[2],[]);

paintTiles([
  [13,5]
], "mivior", "plains",[3,5],[]);

paintTiles([
  [12,5]
], "mivior", "plains",[2,5],[]);

paintTiles([
  [14,3]
], "mivior", "plains",[],[2,3,4,5]);

paintTiles([
  [14,4]
], "mivior", "plains",[],[1]);

paintTiles([
  [15,4]
], "mivior", "plains",[],[0,1,2,3]);

paintTiles([
  [16,4]
], "mivior", "forest",[],[2,3,4,5]);

paintTiles([
  [16,5],[16,6],[17,6],[18,5],[18,6],[19,6],[20,5]
], "mivior", "mountain");

paintTiles([
  [18,4]], "mivior", "plains",[], [1,2,3,4]);

paintTiles([
  [19,5]], "mivior", "mountain",[], [2,3,4]);

paintTiles([
  [20,4]], "mivior", "forest",[], [3,4,5]);

paintTiles([
  [21,4]], "mivior", "forest",[], [3,4]);

paintTiles([
  [21,5]], "mivior", "mountain",[], [1,2]);

paintTiles([
  [21,6]], "mivior", "plains",[], [1,2]);

paintTiles([
  [21,7]], "mivior", "plains",[], [0,1,2]);

paintTiles([
  [20,7]], "mivior", "plains",[], [0,1]);

paintTiles([
  [22,3]], "mivior", "plains",[], [2,3,4]);

paintTiles([
  [23,4]], "mivior", "plains",[], [1,2,3]);

paintTiles([
  [23,5]], "mivior", "plains",[], [0,1,2]);

paintTiles([
  [19,7],[20,6]
], "mivior", "plains");

// Unclaimed terrain (no faction)
paintTiles([
  [11,5], [11,7], [11,8], [12,6], [12,7], [12,8], [13,10]
], "none", ["hills"]);

paintTiles([[11,6]], "none", ["hills"], [5, 2]); // rivers: upper-right, lower-left

paintTiles([[10,6]], "none", ["hills"], [0, 2]); // rivers: right, lower-left

paintTiles([[11,9]], "none", ["hills"], [4]); // river: upper-left

paintTiles([[14,10]], "none", ["hills"], [5, 1]); // rivers: upper-right, lower-right

paintTiles([[13,11]], "none", ["hills"], [2]); // river: lower-left

paintTiles([
  [11,10], [12,10], [14,9]
], "none", ["hills"]);

paintTiles([
  [12,9], [13,9], [13,12]
], "none", ["plains"]);

paintTiles([[13,13]], "none", ["forest"]);

// More unclaimed terrain
paintTiles([[14,11]], "none", ["plains"]);
paintTiles([[14,12]], "none", ["forest"]);

// ── Eaters of Wisdom ──────────────────────────────────────────────────────────
paintTiles([
  [10,11], [11,11]
], "eaters", ["plains"]);

paintTiles([
  [12,11]
], "eaters", ["mountain"]);

paintTiles([[12,12]], "eaters", ["mountain"], [], [5]); // lake: upper-right

paintTiles([[11,12]], "eaters", ["plains"]);
tileData["11,12"].name = "Invisible School of Thaumaturgy";
tileData["11,12"].isFortress = true;
tileData["11,12"].fortressStrength = 3;
tileData["11,12"].requiresMagicalSieger = true; // only besiegeable by a magical unit

paintTiles([[10,12]], "eaters", ["hills"], [], [0, 1]); // lakes: right, lower-right

paintTiles([[10,13]], "eaters", ["hills"], [], [2, 3]); // lakes: lower-left, left

paintTiles([[12,13]], "eaters", ["forest"], [1], [4]); // river: lower-right; lake: upper-left

paintTiles([[11,13]], "eaters", ["plains"], [], [0, 1, 2, 3, 4, 5]); // lake all sides

// Unclaimed, bordering Eaters territory
paintTiles([[11,14]], "none", ["hills", "forest"], [], [3]); // lake: left

// ── Hothior ───────────────────────────────────────────────────────────────────
// Mountains
paintTiles([
  [15,7], [15,8]
], "hothior", ["mountain"]);

// Forest
paintTiles([
  [16,7], [16,8], [17,7], [17,8], [18,7]
], "hothior", ["forest"]);

// Port Lork — capital, strength 3, lake at lower-left (side 2), seaport
paintTiles([[18,9]], "hothior", ["plains"], [], [2]);
tileData["18,9"].name = "Port Lork";
tileData["18,9"].isFortress = true;
tileData["18,9"].fortressStrength = 3;
tileData["18,9"].isPort = true;
tileData["18,9"].isCapital = true;

// Tadafot on the River — strength 2 castle
paintTiles([[15,10]], "hothior", ["plains"]);
tileData["15,10"].name = "Tadafot on the River";
tileData["15,10"].isFortress = true;
tileData["15,10"].fortressStrength = 2;

// Farnot Seafolk — named Hothior tile
paintTiles([[20,10]], "hothior", ["plains"]);
tileData["20,10"].name = "Farnot Seafolk";

paintTiles([
  [15,9], [16,9], [17,9], [17,10], [19,11], [20,9],
  [15,12], [15,14], [16,13], [16,14], [17,14], [17,15],
  [18,11], [18,12], [18,13]
], "hothior", ["plains"]);

paintTiles([[19,8]], "hothior", ["forest"], [], [3, 2]); // lakes: left, lower-left
paintTiles([[18,8]], "hothior", ["forest"], [], [2]);    // lake: lower-left
paintTiles([[19,9]], "hothior", ["plains"], [0], [5, 4, 3, 2]); // river: right; lakes: upper-right, upper-left, left, lower-left
paintTiles([[20,8]], "hothior", ["plains"], [], [5, 4, 3, 2]); // lakes: upper-right, upper-left, left, lower-left
paintTiles([[19,10]], "hothior", ["plains"], [5, 3]);           // rivers: upper-right, left

paintTiles([[21,9]],  "hothior", ["plains"], [], [1, 2]);          // lakes: lower-right, lower-left
paintTiles([[21,8]],  "hothior", ["plains"], [], [5, 4, 3, 2, 1]); // lakes: upper-right, upper-left, left, lower-left, lower-right
paintTiles([[21,10]], "hothior", ["plains"], [], [2, 1, 0]);        // lakes: lower-left, lower-right, right
paintTiles([[20,11]], "hothior", ["plains"], [], [1, 2, 0]);        // lakes: lower-right, lower-left, right

paintTiles([[19,12]], "hothior", ["plains"], [], [1]);         // lake: lower-right
paintTiles([[18,10]], "hothior", ["plains"], [2, 5]);          // rivers: lower-left, upper-right
paintTiles([[17,11]], "hothior", ["plains"], [4, 0, 2]);       // rivers: upper-left, right, lower-left
paintTiles([[17,12]], "hothior", ["plains"], [5, 3]);          // rivers: upper-right, left
paintTiles([[16,12]], "hothior", ["plains"], [2, 5]);          // rivers: lower-left, upper-right
paintTiles([[15,13]], "hothior", ["plains"], [2, 5]);          // rivers: lower-left, upper-right
paintTiles([[16,10]], "hothior", ["plains"], [1, 5]);          // rivers: lower-right, upper-right
paintTiles([[15,11]], "hothior", ["hills"],  [4, 2]);          // rivers: upper-left, lower-left
paintTiles([[19,14]], "hothior", ["plains"], [5], [2]);        // river: upper-right; lake: lower-left
paintTiles([[18,14]], "hothior", ["plains"], [2, 0]);          // rivers: lower-left, right

paintTiles([[16,11], [17,13]], "hothior", ["hills"]);

paintTiles([[20,13]], "none", ["plains"], [], [5, 4]);        // lakes: upper-right, upper-left

paintTiles([[20,14]], "none", ["plains"]);
tileData["20,14"].name = "Huts of the Scum";
tileData["20,14"].isEntryHex = "scum";

// Stubstaff Keep — NOT a castle at setup; only activates when the Black Knight deploys.
// isFortress remains false until activateStubstaffKeep(faction) is called.
paintTiles([[19,20]], "none", ["plains"]);
tileData["19,20"].name = "Stubstaff Keep";
tileData["19,20"].isFortress = false;
tileData["19,20"].fortressStrength = 2;
tileData["19,20"].isStubstaffKeep = true;
tileData["19,20"].stubstaffVP = 10;

paintTiles([[22,13], [21,14], [21,15]], "none", ["hills"]);

paintTiles([
  [20,15], [20,16], [20,17], [20,18], [20,19],
  [21,16], [21,17], [21,18], [21,19], [21,20],
  [22,14], [22,16], [22,17]
], "none", ["plains"]);

paintTiles([[22,15]], "none", ["forest"]);

paintTiles([
  [19,15], [19,16], [19,17], [19,18], [19,19]
], "none", ["plains"]);

paintTiles([[18,15]], "none", ["plains"], [3, 5]); // rivers: left, upper-right

paintTiles([
  [19,21], [19,22], [20,20], [20,21]
], "none", ["forest"]);

paintTiles([
  [20,22], [20,23], [20,24], [19,23], [19,24]
], "none", ["plains"]);
paintTiles([[21,12]], "none", ["forest"], [], [4]);           // lake: upper-left
paintTiles([[21,13]], "none", ["hills"]);
paintTiles([[20,12]], "none", ["plains"], [], [5, 4, 3]);     // lakes: upper-right, upper-left, left
paintTiles([[21,11]], "none", ["plains"], [], [5, 4, 3]);     // lakes: upper-right, upper-left, left

// Castle Lapspell — strength 3, lakes at lower-right (side 1) and lower-left (side 2)
paintTiles([[19,13]], "hothior", ["plains"], [], [1, 2]);
tileData["19,13"].name = "Castle Lapspell";
tileData["19,13"].isFortress = true;
tileData["19,13"].fortressStrength = 3;

// Further unclaimed terrain
paintTiles([[12,1]], "none", ["plains"]);

paintTiles([[13,14]], "none", ["forest"], [4, 2]); // rivers: upper-left, lower-left
paintTiles([[14,13]], "none", ["forest"], [5, 2]); // rivers: upper-right, lower-left

paintTiles([
  [14,14], [13,15], [12,14], [12,15], [11,15], [10,14], [10,15]
], "none", ["forest"]);

paintTiles([
  [11,16], [12,16]
], "none", ["plains"]);

// ── Muetar ────────────────────────────────────────────────────────────────────
// Pennol — capital, strength 4, plains (lake is on adjacent tiles, not this one)
paintTiles([[12,19]], "muetar", ["plains"]);
tileData["12,19"].name = "Pennol";
tileData["12,19"].isFortress = true;
tileData["12,19"].fortressStrength = 4;
tileData["12,19"].isCapital = true;

// Plibba — strength 2, plains
paintTiles([[15,17]], "muetar", ["plains"]);
tileData["15,17"].name = "Plibba";
tileData["15,17"].isFortress = true;
tileData["15,17"].fortressStrength = 2;

// Beolon — strength 1, downs (plains)
paintTiles([[17,21]], "muetar", ["plains"]);
tileData["17,21"].name = "Beolon";
tileData["17,21"].isFortress = true;
tileData["17,21"].fortressStrength = 1;

// Groat — strength 3, plains
paintTiles([[16,23]], "muetar", ["plains"]);
tileData["16,23"].name = "Groat";
tileData["16,23"].isFortress = true;
tileData["16,23"].fortressStrength = 3;

// Basimar — strength 2, plains
paintTiles([[10,24]], "muetar", ["plains"]);
tileData["10,24"].name = "Basimar";
tileData["10,24"].isFortress = true;
tileData["10,24"].fortressStrength = 3;

// Muetar plains
paintTiles([
  [14,16], [14,17], [15,16], [15,18], [16,16], [16,17], [13,16], [18,16], [18,18]
], "muetar", ["plains"]);
paintTiles([[17,19]], "muetar", ["plains"]);

// Muetar hills
paintTiles([[14,15], [15,15], [16,15]], "muetar", ["hills"]);

// Muetar plains with rivers
paintTiles([[17,16]], "muetar", ["plains"], [0, 2]);

// Muetar hills with rivers
paintTiles([[17,17]], "muetar", ["hills"], [3, 0]);

// Yando Rivermen — special named tile
paintTiles([[17,18]], "muetar", ["plains"], [3, 5]);
tileData["17,18"].name = "Yando Rivermen";

// Muetar marsh
paintTiles([[18,17]], "muetar", ["marsh"]);

// Muetar forest
paintTiles([[16,19]], "muetar", ["forest"]);
paintTiles([[16,22]], "muetar", ["forest"], [3, 5, 1]);

// Muetar plains (new)
paintTiles([[17,22]], "muetar", ["plains"]);

// Muetar hills (new)
paintTiles([[17,20], [18,19], [18,20], [18,21]], "muetar", ["hills"]);

// Muetar plains with rivers
paintTiles([[16,18]], "muetar", ["plains"], [2, 5]);
paintTiles([[15,19]], "muetar", ["plains"], [2, 0]);
paintTiles([[15,20]], "muetar", ["plains"], [3, 5, 1]);
paintTiles([[16,20]], "muetar", ["plains"], [4, 0]);
paintTiles([[16,21]], "muetar", ["plains"], [3, 0]);

paintTiles([[28,24]], "none", ["plains"]);
tileData["28,24"].name = "Spires to the Sun";
tileData["28,24"].isEntryHex = "orderHippogriff";

paintTiles([[20,33]], "none", ["plains"]);
tileData["20,33"].name = "Lost City of Khos";
tileData["20,33"].isEntryHex = "ghostRiders";

}