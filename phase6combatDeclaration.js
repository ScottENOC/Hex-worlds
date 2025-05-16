function handleDeclareAttack(event) {
  const targetId = event.target.dataset.hex;
  const sourceId = gameState.currentAttackSource;

  if (!sourceId || !targetId) return;

  // Restructure declarations: targetId => array of sources
  if (!gameState.combatDeclarations) gameState.combatDeclarations = {};
  if (!gameState.combatDeclarations[targetId]) gameState.combatDeclarations[targetId] = [];

  if (!gameState.combatDeclarations[targetId].includes(sourceId)) {
    gameState.combatDeclarations[targetId].push(sourceId);

    // Visual confirmation
    moveUnitToCombatEdge(sourceId, targetId);
  }

  clearHighlights('attack-target');
  gameState.currentAttackSource = null;

  document.querySelectorAll('.attack-target').forEach(el => {
    el.removeEventListener('click', handleDeclareAttack);
  });
}
 
function moveUnitToCombatEdge(sourceId, targetId) {
    const sourceEl = document.getElementById(`hex-${sourceId}`);
    const targetEl = document.getElementById(`hex-${targetId}`);
    if (!sourceEl || !targetEl) return;
 
    const unitEl = sourceEl.querySelector('.unit');
    if (!unitEl) return;
 
    const dx = targetEl.offsetLeft - sourceEl.offsetLeft;
    const dy = targetEl.offsetTop - sourceEl.offsetTop;
 
    const shiftX = dx * 0.3;
    const shiftY = dy * 0.3;
 
    unitEl.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
    unitEl.style.zIndex = 10;  // bring forward during attack
}