// Talisman of Dispel integration with the Eaters, Black Hand and Greystaff-facing spell hooks.
(function(){
  function enabled(){return window.scenarioMeta?.id==='board-game';}
  function protectedHex(r,c){return enabled()&&typeof isTalismanProtectedHex==='function'&&isTalismanProtectedHex(r,c);}

  // Eaters: their spells/devices are inert while the Eaters themselves occupy a
  // Talisman hex, and offensive projected effects cannot affect a protected hex.
  const baseCanUse=typeof canUseSpell==='function'?canUseSpell:null;
  if(baseCanUse) canUseSpell=function(key){
    const e=typeof getEaters==='function'?getEaters():null;
    if(e&&protectedHex(e.row,e.col))return false;
    return baseCanUse(key);
  };
  const baseVortex=typeof resolveVortex==='function'?resolveVortex:null;
  if(baseVortex) resolveVortex=function(r,c){
    if(protectedHex(r,c)){
      window._spellMode=null; highlightedTilesByType.combat=[];
      const cb=window._vortexCallback;window._vortexCallback=null;
      alert('The Talisman of Dispel nullifies the Whirling Vortex in this hex.');drawMap();if(cb)cb();return;
    }
    return baseVortex(r,c);
  };
  const baseReflector=typeof resolveReflector==='function'?resolveReflector:null;
  if(baseReflector) resolveReflector=function(r,c){
    if(protectedHex(r,c)){
      window._spellMode=null;highlightedTilesByType.combat=[];
      const cb=window._reflectorCallback;window._reflectorCallback=null;
      alert('The Talisman of Dispel nullifies the Reflector in this hex.');drawMap();if(cb)cb();return;
    }
    return baseReflector(r,c);
  };
  const baseCastleBonus=typeof getEnchantedCastleBonus==='function'?getEnchantedCastleBonus:null;
  if(baseCastleBonus) getEnchantedCastleBonus=function(r,c){return protectedHex(r,c)?1:baseCastleBonus(r,c);};

  // If a Talisman is brought into the Eaters' own hex, standing defensive/movement
  // devices there immediately become inert for as long as it remains present.
  function suppressEaterLocalEffects(){
    const e=typeof getEaters==='function'?getEaters():null;if(!e||!protectedHex(e.row,e.col))return;
    e.bridgeActive=false;e.mistActive=false;e.enchantedCastleActive=false;
  }
  const baseShowSpell=typeof showSpellPanel==='function'?showSpellPanel:null;
  if(baseShowSpell) showSpellPanel=function(context,onDone){suppressEaterLocalEffects();return baseShowSpell(context,onDone);};

  // Black Hand: its magical creatures/powers cannot affect a Talisman-protected
  // hex. This covers Guardian protection, Wraith terror, Wings, and creation of
  // Dead/Undead/Colossus in a protected hex.
  const baseGuardian=typeof guardianBlocksSiege==='function'?guardianBlocksSiege:null;
  if(baseGuardian) guardianBlocksSiege=function(r,c){if(protectedHex(r,c))return false;return baseGuardian(r,c);};

  const baseWraiths=typeof invokeVentedWraiths==='function'?invokeVentedWraiths:null;
  if(baseWraiths) invokeVentedWraiths=function(onDone){
    const bh=typeof getBlackHand==='function'?getBlackHand():null;if(!bh)return baseWraiths(onDone);
    // Temporarily make protected adjacent stacks invisible to the legacy Wraith routine.
    const protectedUnits=units.filter(u=>u.faction!==bh.faction&&protectedHex(u.row,u.col)&&getAdjacentCoords(bh.row,bh.col).some(([r,c])=>r===u.row&&c===u.col));
    const saved=protectedUnits.map(u=>({u,cs:u.combatStrength}));for(const x of saved)x.u.combatStrength=0;
    try{return baseWraiths(onDone);}finally{for(const x of saved)x.u.combatStrength=x.cs;}
  };

  const baseInvokeWings=typeof invokeWingsOfDarkness==='function'?invokeWingsOfDarkness:null;
  if(baseInvokeWings) invokeWingsOfDarkness=function(onDone){
    const bh=typeof getBlackHand==='function'?getBlackHand():null;if(!bh)return baseInvokeWings(onDone);
    const protectedUnits=units.filter(u=>u.faction!==bh.faction&&protectedHex(u.row,u.col)&&getAdjacentCoords(bh.row,bh.col).some(([r,c])=>r===u.row&&c===u.col));
    const saved=protectedUnits.map(u=>({u,cs:u.combatStrength}));for(const x of saved)x.u.combatStrength=0;
    try{return baseInvokeWings(onDone);}finally{for(const x of saved)x.u.combatStrength=x.cs;}
  };
  const baseResolveWings=typeof resolveWingsTarget==='function'?resolveWingsTarget:null;
  if(baseResolveWings) resolveWingsTarget=function(r,c){
    if(protectedHex(r,c)){
      window._bhSpellMode=null;highlightedTilesByType.combat=[];const cb=window._wingsCallback;window._wingsCallback=null;
      alert('The Talisman of Dispel disperses the Wings of Darkness over this hex.');drawMap();if(cb)cb();return;
    }
    return baseResolveWings(r,c);
  };
  const baseWingsBonus=typeof getWingsDarknessBonus==='function'?getWingsDarknessBonus:null;
  if(baseWingsBonus) getWingsDarknessBonus=function(f,r,c){return protectedHex(r,c)?0:baseWingsBonus(f,r,c);};

  for(const name of ['rebuildTheDead','raiseUndead','buildColossus']){
    const base=window[name];if(typeof base!=='function')continue;
    window[name]=function(bh){const actor=bh||((typeof getBlackHand==='function')?getBlackHand():null);if(actor&&protectedHex(actor.row,actor.col)){alert('The Talisman of Dispel prevents this Black Hand magic from taking effect in the hex.');return false;}return base.apply(this,arguments);};
  }

  // Final combat helpers: a side carrying the Talisman receives no other magic-device
  // combat benefit in that battle (Helm, Wand, Airboat, Sword-derived magic, etc.).
  const priorHealing=window.stackHasHealingWand;
  if(typeof priorHealing==='function') window.stackHasHealingWand=function(side){
    if(enabled()&&(side||[]).some(u=>u?.isLeader&&!u.isPrisoner&&u.magicGift==='Talisman of Dispel'))return false;
    return priorHealing(side);
  };
})();
