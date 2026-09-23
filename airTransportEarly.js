// Register before the generic leader-stack movement layer so magic air transport
// cannot accidentally carry an unlimited ground stack.
(function(){
  function enabled(){return window.scenarioMeta?.id==='board-game';}
  function carried(unit,name){return unit?.magicGift===name||(unit?.wanderingGiftRecords||[]).some(g=>g.name===name);}
  function enemyFlyerAt(r,c,faction){return units.some(u=>u.row===r&&u.col===c&&u.faction!==faction&&(u.isFlying||u.airboatActive||u.flyingCarpetActive)&&u.airborne!==false&&(u.combatStrength||0)>0);}
  function friendlyFleetAt(r,c,faction){return units.some(u=>u.row===r&&u.col===c&&u.faction===faction&&u.isFleet);}
  function sea(t){return Array.isArray(t?.lakes)&&t.lakes.length>=6;}
  function flyMoves(unit,mustLand){
    const max=Number(unit.moveSpeed||0);const q=[[unit.row,unit.col,0]],seen=new Set([`${unit.row},${unit.col}`]),out=[];
    while(q.length){const [r,c,d]=q.shift();if(d>=max)continue;for(const [rr,cc] of getAdjacentCoords(r,c)){
      const key=`${rr},${cc}`;if(seen.has(key)||!tileData[key]||enemyFlyerAt(rr,cc,unit.faction))continue;seen.add(key);q.push([rr,cc,d+1]);
      const t=tileData[key];if(mustLand&&sea(t)&&!friendlyFleetAt(rr,cc,unit.faction))continue;
      if(mustLand&&units.some(u=>u.row===rr&&u.col===cc&&u.faction!==unit.faction&&(u.combatStrength||0)>0))continue;
      out.push([rr,cc]);
    }}return out;
  }

  const baseValid=typeof validMoves==='function'?validMoves:null;
  if(baseValid)validMoves=function(unit){
    if(enabled()&&unit?.isLeader&&carried(unit,'Airboat of Armera')){unit.airboatActive=true;return flyMoves(unit,false);}
    if(enabled()&&unit?.isLeader&&carried(unit,'Flying Carpet')){unit.flyingCarpetActive=true;return flyMoves(unit,true);}
    return baseValid(unit);
  };

  if(typeof svg!=='undefined'&&svg?.addEventListener&&svg.dataset.airTransportEarly!=='1'){
    svg.dataset.airTransportEarly='1';
    svg.addEventListener('click',event=>{
      if(!enabled()||currentPhase!=='movement'||!selectedUnit?.isLeader||selectedUnit.hasMoved)return;
      const leader=selectedUnit;const airboat=carried(leader,'Airboat of Armera'),carpet=carried(leader,'Flying Carpet');if(!airboat&&!carpet)return;
      const text=event.target?.dataset?.hex;if(!text)return;const [r,c]=text.split(',').map(Number);
      const moves=flyMoves(leader,!airboat);if(!moves.some(([rr,cc])=>rr===r&&cc===c))return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
      const passengers=[];
      if(airboat){
        const local=units.filter(u=>u!==leader&&u.faction===leader.faction&&u.row===leader.row&&u.col===leader.col&&!u.isFleet&&!u.hasMoved);
        const combats=local.filter(u=>!u.isLeader&&(u.combatStrength||0)>0);
        if(combats.length){const raw=prompt(`Airboat may carry ONE land combat unit.\n0. none\n${combats.map((u,i)=>`${i+1}. ${u.name||u.originalFaction||u.faction}`).join('\n')}`);const pick=combats[Number.parseInt(raw,10)-1];if(pick)passengers.push(pick);}
        const leaders=local.filter(u=>u.isLeader);if(leaders.length&&confirm(`Carry ${leaders.length} co-located friendly leader(s) on the Airboat?`))passengers.push(...leaders);
      }
      for(const u of [leader,...passengers]){u.row=r;u.col=c;u.hasMoved=true;u.movedByAirTransportTurn=turnNumber;}
      leader.airborne=airboat; // Carpet must land; Airboat stays aloft unless it later makes a surface attack.
      if(!airboat&&typeof recordDiplomaticViolation==='function'){
        const t=tileData[`${r},${c}`],kingdom=t&&(t.originalFaction||t.faction);if(kingdom&&kingdom!=='none'&&neutralFactions.has(kingdom)&&kingdom!==leader.faction)recordDiplomaticViolation(leader.faction,kingdom);
      }
      selectedUnit=null;highlightedTilesByType.movement=[];drawMap();showHexInfo(r,c);
    },true);
  }
})();
