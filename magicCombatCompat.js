// Small compatibility layer between magic gifts and the final combat resolver.
(function(){
  function enabled(){return window.scenarioMeta?.id==='board-game';}
  const baseCanGhost=window.canAttackGhostRiders;
  if(typeof baseCanGhost==='function') window.canAttackGhostRiders=function(attackers,defenders){
    if(!enabled())return baseCanGhost(attackers,defenders);
    if(!defenders?.some(u=>u.isGhostRiders))return true;
    return (attackers||[]).some(u=>u.isMagical||u.isEatersOfWisdom||u.isBlackHand||(u.isLeader&&!u.isPrisoner&&u.magicGift==='Sword of Wizardry'));
  };

  window.divineRightEffectiveCombatStrength=function(side,targetHex){
    let total=0;
    const talisman=typeof hexHasActiveTalisman==='function'&&hexHasActiveTalisman(targetHex.row,targetHex.col);
    for(const u of (side||[])){
      const magical=!!(u.isMagical||u.isEatersOfWisdom||u.isBlackHand||u.isGhostRiders||(u.isLeader&&u.magicGift==='Sword of Wizardry'));
      if(talisman&&magical)continue;
      total+=Number(u.combatStrength||0);
    }
    // Airboat is a separate CS 1 combat unit represented by its monarch's gift.
    if((side||[]).some(u=>u.isLeader&&!u.isPrisoner&&u.magicGift==='Airboat of Armera')) total+=1;
    return total;
  };

  window.divineRightPrepareSurfaceAttack=function(attackers,defenders){
    const surfaceTarget=(defenders||[]).some(u=>!(typeof isDivineRightFlyingUnit==='function'&&isDivineRightFlyingUnit(u)&&u.airborne!==false));
    if(!surfaceTarget)return;
    for(const u of (attackers||[])){
      if(u.isUrmoff)u.submerged=false;
      if(typeof isDivineRightFlyingUnit==='function'&&isDivineRightFlyingUnit(u))u.airborne=false;
    }
  };
})();
