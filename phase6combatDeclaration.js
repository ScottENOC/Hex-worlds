// Combat declaration UI is handled by drawing.js hex-click handler, which pushes
// { fromHex, targetHex } objects to declaredCombats[].  This file is reserved for
// any additional declaration helpers that don't belong in drawing.js.

function clearCombatDeclarations() {
  declaredCombats = [];
  highlightedTilesByType.combat = [];
}
