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
    tileData[key].lakes = lakes;
  });
}

function initializeMap() {
  // The Shire
  paintTiles([[5,5], [5,6], [6,5], [6,6]], "hobbits", ["plains"]);
  tileData["5,5"].name = "Hobbiton";
  tileData["5,5"].isFortress = false;

  // Bree
  paintTiles([[7,7]], "men", ["plains"]);
  tileData["7,7"].name = "Bree";
  tileData["7,7"].isFortress = true;
  tileData["7,7"].fortressStrength = 2;

  // Rivendell
  paintTiles([[10,10]], "elves", ["forest", "hills"]);
  tileData["10,10"].name = "Rivendell";
  tileData["10,10"].isFortress = true;
  tileData["10,10"].fortressStrength = 3;

  // Misty Mountains
  paintTiles([[9,9], [10,9], [11,9], [12,9]], "none", ["mountain"]);

  // Moria
  paintTiles([[11,9]], "dwarves", ["mountain"]);
  tileData["11,9"].name = "Moria";
  tileData["11,9"].isFortress = true;
  tileData["11,9"].fortressStrength = 4;

  // Lothlórien
  paintTiles([[12,10], [12,11]], "elves", ["forest"]);
  tileData["12,10"].name = "Lothlórien";

  // Rohan
  paintTiles([[15,12], [15,13], [16,12], [16,13]], "men", ["plains"]);
  tileData["15,12"].name = "Edoras";
  tileData["15,12"].isFortress = true;
  tileData["15,12"].fortressStrength = 3;

  // Fangorn Forest
  paintTiles([[14,11], [14,12]], "none", ["forest"]);

  // Isengard
  paintTiles([[14,10]], "sauron", ["plains"]);
  tileData["14,10"].name = "Isengard";
  tileData["14,10"].isFortress = true;
  tileData["14,10"].fortressStrength = 4;

  // Gondor
  paintTiles([[20,15], [20,16], [21,15], [21,16]], "men", ["plains"]);
  tileData["20,15"].name = "Minas Tirith";
  tileData["20,15"].isFortress = true;
  tileData["20,15"].fortressStrength = 5;

  // Mordor
  paintTiles([[22,18], [23,18], [24,18]], "sauron", ["mountain"]);
  tileData["23,18"].name = "Barad-dûr";
  tileData["23,18"].isFortress = true;
  tileData["23,18"].fortressStrength = 5;

  // Mount Doom
  paintTiles([[24,18]], "sauron", ["mountain"]);
  tileData["24,18"].name = "Mount Doom";

  // Dead Marshes
  paintTiles([[21,17], [22,17]], "none", ["marsh"]);

  // Mirkwood
  paintTiles([[10,20], [11,20], [12,20], [13,20]], "elves", ["forest"]);
  tileData["11,20"].name = "Thranduil's Halls";

  // Erebor
  paintTiles([[8,25]], "dwarves", ["mountain"]);
  tileData["8,25"].name = "Erebor";
  tileData["8,25"].isFortress = true;
  tileData["8,25"].fortressStrength = 4;

  // Dale
  paintTiles([[9,25]], "men", ["plains"]);
  tileData["9,25"].name = "Dale";
  tileData["9,25"].isFortress = true;
  tileData["9,25"].fortressStrength = 2;

  // Lake-town
  paintTiles([[9,26]], "men", ["plains"]);
  tileData["9,26"].name = "Lake-town";

  // Iron Hills
  paintTiles([[7,27], [8,27]], "dwarves", ["mountain"]);
  tileData["7,27"].name = "Iron Hills";

  // Rhovanion
  paintTiles([[13,22], [14,22], [15,22]], "men", ["plains"]);

  // Rhûn
  paintTiles([[16,25], [17,25]], "easterlings", ["plains"]);

  // Harad
  paintTiles([[25,15], [26,15]], "haradrim", ["desert"]);

  // Umbar
  paintTiles([[25,14]], "haradrim", ["plains"]);
  tileData["25,14"].name = "Umbar";
  tileData["25,14"].isFortress = true;
  tileData["25,14"].fortressStrength = 3;

  // Sea of Rhûn
  paintTiles([[14,26], [15,26]], "none", ["plains"], [], [0,1,2,3,4,5]);
  tileData["14,26"].name = "Sea of Rhûn";

  // Anduin River
  paintTiles([[10,12], [11,12], [12,12], [13,12], [14,12], [15,12], [16,12], [17,12], [18,12], [19,12]], "none", ["plains"], [2], []);
  tileData["10,12"].name = "Anduin River";
}