const units = [
  // Hobbits in the Shire
  { faction: "hobbits", row: 6, col: 5, hasMoved: false, moveSpeed: 4, startCoords: [6, 5], isFleet: false, isMercenary: false },
  { faction: "hobbits", row: 6, col: 6, hasMoved: false, moveSpeed: 4, startCoords: [6, 6], isFleet: false, isMercenary: false },

  // Men of Bree
  { faction: "men", row: 7, col: 7, hasMoved: false, moveSpeed: 5, startCoords: [7, 7], isFleet: false, isMercenary: false },

  // Elves of Rivendell
  { faction: "elves", row: 10, col: 10, hasMoved: false, moveSpeed: 6, startCoords: [10, 10], isFleet: false, isMercenary: false },
  { faction: "elves", row: 11, col: 10, hasMoved: false, moveSpeed: 6, startCoords: [11, 10], isFleet: false, isMercenary: false },

  // Dwarves of Moria
  { faction: "dwarves", row: 11, col: 9, hasMoved: false, moveSpeed: 4, startCoords: [11, 9], isFleet: false, isMercenary: false },
  { faction: "dwarves", row: 10, col: 9, hasMoved: false, moveSpeed: 4, startCoords: [10, 9], isFleet: false, isMercenary: false },

  // Elves of Lothlórien
  { faction: "elves", row: 12, col: 10, hasMoved: false, moveSpeed: 6, startCoords: [12, 10], isFleet: false, isMercenary: false },

  // Riders of Rohan
  { faction: "men", row: 15, col: 12, hasMoved: false, moveSpeed: 7, startCoords: [15, 12], isFleet: false, isMercenary: false },
  { faction: "men", row: 16, col: 13, hasMoved: false, moveSpeed: 7, startCoords: [16, 13], isFleet: false, isMercenary: false },

  // Gondor
  { faction: "men", row: 21, col: 15, hasMoved: false, moveSpeed: 6, startCoords: [21, 15], isFleet: false, isMercenary: false },
  { faction: "men", row: 20, col: 16, hasMoved: false, moveSpeed: 6, startCoords: [20, 16], isFleet: false, isMercenary: false },

  // Sauron's land forces
  { faction: "sauron", row: 23, col: 18, hasMoved: false, moveSpeed: 5, startCoords: [23, 18], isFleet: false, isMercenary: false },
  { faction: "sauron", row: 24, col: 18, hasMoved: false, moveSpeed: 5, startCoords: [24, 18], isFleet: false, isMercenary: false },

  // Elves of Mirkwood
  { faction: "elves", row: 11, col: 20, hasMoved: false, moveSpeed: 6, startCoords: [11, 20], isFleet: false, isMercenary: false },

  // Dwarves of Erebor
  { faction: "dwarves", row: 8, col: 25, hasMoved: false, moveSpeed: 4, startCoords: [8, 25], isFleet: false, isMercenary: false },
  { faction: "dwarves", row: 7, col: 27, hasMoved: false, moveSpeed: 4, startCoords: [7, 27], isFleet: false, isMercenary: false },

  // Men of Dale and Lake-town
  { faction: "men", row: 9, col: 25, hasMoved: false, moveSpeed: 5, startCoords: [9, 25], isFleet: false, isMercenary: false },
  { faction: "men", row: 9, col: 26, hasMoved: false, moveSpeed: 5, startCoords: [9, 26], isFleet: false, isMercenary: false },

  // Easterlings of Rhûn
  { faction: "easterlings", row: 16, col: 25, hasMoved: false, moveSpeed: 6, startCoords: [16, 25], isFleet: false, isMercenary: false },
  { faction: "easterlings", row: 17, col: 25, hasMoved: false, moveSpeed: 6, startCoords: [17, 25], isFleet: false, isMercenary: false },

  // Haradrim
  { faction: "haradrim", row: 25, col: 14, hasMoved: false, moveSpeed: 5, startCoords: [25, 14], isFleet: false, isMercenary: false },
  { faction: "haradrim", row: 26, col: 15, hasMoved: false, moveSpeed: 5, startCoords: [26, 15], isFleet: false, isMercenary: false },

  // Gondor Navy
  { faction: "men", row: 22, col: 14, hasMoved: false, moveSpeed: 7, startCoords: [22, 14], isFleet: true, isMercenary: false },
  { faction: "men", row: 23, col: 14, hasMoved: false, moveSpeed: 7, startCoords: [23, 14], isFleet: true, isMercenary: false },

  // Umbar Corsairs
  { faction: "haradrim", row: 25, col: 13, hasMoved: false, moveSpeed: 7, startCoords: [25, 13], isFleet: true, isMercenary: false },

  // Dwarf Navy from Iron Hills (just for spice)
  { faction: "dwarves", row: 8, col: 28, hasMoved: false, moveSpeed: 6, startCoords: [8, 28], isFleet: true, isMercenary: false }
];