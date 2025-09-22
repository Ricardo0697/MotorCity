// Conexión entre botones y la escena
window.addEventListener('DOMContentLoaded', ()=>{
const advanceBtn = document.getElementById('advanceWeek');
const toggleOne = document.getElementById('toggleOneWay');
const saveBtn = document.getElementById('save');
const loadBtn = document.getElementById('load');
const togglePlace = document.getElementById('togglePlaceMode');
const unlocks = document.getElementById('unlocks');
const placeCity = document.getElementById('placeCity');
const placeHouse = document.getElementById('placeHouse');
const lanesSelect = document.getElementById('lanesSelect');
const prioritySelect = document.getElementById('prioritySelect');
const trafficParticles = document.getElementById('trafficParticles');
const showPollutionGame = document.getElementById('showPollutionGame');
// Simulator panel elements
const simPanel = document.getElementById('simPanel');
const simTax = document.getElementById('simTax');
const simToolPower = document.getElementById('simToolPower');
const simToolWater = document.getElementById('simToolWater');
const simToolZoneR = document.getElementById('simToolZoneR');
const simToolZoneC = document.getElementById('simToolZoneC');
const simToolZoneI = document.getElementById('simToolZoneI');
const simBrush = document.getElementById('simBrush');
const simToolRoad = document.getElementById('simToolRoad');
const simToolBulldozer = document.getElementById('simToolBulldozer');
const simSave = document.getElementById('simSave');
const simLoad = document.getElementById('simLoad');
const simPollution = document.getElementById('simPollution');
// Bottom build bar elements
const itemDoor = document.getElementById('itemDoor');
const itemRoad = document.getElementById('itemRoad');
const itemBridge = document.getElementById('itemBridge');
const itemRoundabout = document.getElementById('itemRoundabout');
const itemHighway = document.getElementById('itemHighway');
const itemForest = document.getElementById('itemForest');
const itemLake = document.getElementById('itemLake');
const itemBulldozer = document.getElementById('itemBulldozer');
const itemSave = document.getElementById('itemSave');
const itemLoad = document.getElementById('itemLoad');
const itemStart = document.getElementById('itemStart');
const upgradePanel = document.getElementById('upgradePanel');
const pickHighway = document.getElementById('pickHighway');
const pickRoundabout = document.getElementById('pickRoundabout');
const pickBridge = document.getElementById('pickBridge');
const closeUpgrade = document.getElementById('closeUpgrade');


function updateUnlocks(u){
const parts = [];
if(u.bridges) parts.push('Puentes');
if(u.roundabouts) parts.push('Rotondas');
unlocks.textContent = 'Desbloqueos: ' + (parts.length? parts.join(', '): 'Ninguno');
}


window.onUnlocksUpdated = updateUnlocks;


advanceBtn.addEventListener('click', ()=>{
if(window.MC) window.MC.advanceWeek();
});


toggleOne.addEventListener('click', ()=>{
if(window.MC){
window.MC.toggleOneWay();
toggleOne.textContent = 'Alternar Una Vía: ' + (window.MC.oneWayMode? 'ON':'OFF');
}
});


saveBtn.addEventListener('click', async ()=>{
if(!window.MC) return alert('Juego no inicializado');
try{
await window.MC.saveToFirestore();
alert('Guardado correctamente');
}catch(e){
console.error(e); alert('Error al guardar: ' + e.message);
}
});


loadBtn.addEventListener('click', async ()=>{
if(!window.MC) return alert('Juego no inicializado');
try{
const ok = await window.MC.loadLastSave();
alert(ok? 'Cargado ultimo guardado':'No hay guardados');
}catch(e){
console.error(e); alert('Error al cargar: ' + e.message);
}
});


togglePlace.addEventListener('click', ()=>{
if(window.MC){
window.MC.togglePlaceMode();
togglePlace.textContent = 'Modo: ' + (window.MC.placeMode? 'Colocar Carretera':'Navegar');
}
});

if (placeCity) {
	placeCity.addEventListener('click', ()=>{
		if(window.MC){ window.MC.preparePlaceCity(); togglePlace.textContent = 'Modo: Colocar Ciudad'; }
	});
}
if (placeHouse) {
	placeHouse.addEventListener('click', ()=>{
		if(window.MC){ window.MC.preparePlaceHouseOfSelected(); togglePlace.textContent = 'Modo: Colocar Casa'; }
	});
}

if (lanesSelect) {
	lanesSelect.addEventListener('change', ()=>{
		if (window.MC) window.MC.roadLanes = parseInt(lanesSelect.value, 10) || 1;
	});
}
if (prioritySelect) {
	prioritySelect.addEventListener('change', ()=>{
		if (window.MC) window.MC.roadPriority = parseInt(prioritySelect.value, 10) || 1;
	});
}
if (trafficParticles) {
	trafficParticles.addEventListener('change', ()=>{
		if (window.MC) window.MC.showTrafficParticles = !!trafficParticles.checked;
	});
}
if (showPollutionGame) {
  showPollutionGame.addEventListener('change', ()=>{
    if (window.MC) window.MC.showPollution = !!showPollutionGame.checked;
  });
}

// Simulator bindings (if simulator is active)
function getSim(){ return window.MotorCitySim || null; }
function ensureSimPanelVisible(v){ if (simPanel) simPanel.style.display = v? 'block':'none'; }
window.addEventListener('motorcity:sim:ready', ()=> ensureSimPanelVisible(true));
window.addEventListener('motorcity:sim:exit', ()=> ensureSimPanelVisible(false));

if (simTax) {
	simTax.addEventListener('change', ()=>{
		const sim = getSim(); if (!sim) return;
		const val = Math.max(0, Math.min(25, parseFloat(simTax.value || '8')));
		sim.setTaxRate(val / 100);
	});
}
function setTool(tool){ const sim = getSim(); if (sim) sim.setTool(tool); }
if (simToolPower) simToolPower.addEventListener('click', ()=> setTool('power'));
if (simToolWater) simToolWater.addEventListener('click', ()=> setTool('water'));
if (simToolZoneR) simToolZoneR.addEventListener('click', ()=> setTool('zone_R'));
if (simToolZoneC) simToolZoneC.addEventListener('click', ()=> setTool('zone_C'));
if (simToolZoneI) simToolZoneI.addEventListener('click', ()=> setTool('zone_I'));
if (simBrush) simBrush.addEventListener('change', ()=>{ const sim = getSim(); if (sim) sim.setBrush(parseInt(simBrush.value||'1',10)||1); });
if (simToolRoad) simToolRoad.addEventListener('click', ()=> setTool('road'));
if (simToolBulldozer) simToolBulldozer.addEventListener('click', ()=> setTool('bulldozer'));
if (simSave) simSave.addEventListener('click', async ()=>{ const sim=getSim(); if (sim) await sim.save(); });
if (simLoad) simLoad.addEventListener('click', async ()=>{ const sim=getSim(); if (sim) await sim.load(); });
if (simPollution) simPollution.addEventListener('change', ()=>{ const sim=getSim(); if (sim) sim.setShowPollution(!!simPollution.checked); });

// Build bar wiring
if (itemDoor) itemDoor.addEventListener('click', ()=>{ const sim=getSim(); if (sim) sim.setTool('door'); else if (window.MC) window.MC.setTool && window.MC.setTool('door'); });
if (itemRoad) itemRoad.addEventListener('click', ()=>{ const sim=getSim(); if (sim) sim.setTool('road'); else if (window.MC) window.MC.setTool && window.MC.setTool('road'); });
if (itemBridge) itemBridge.addEventListener('click', ()=>{ const sim=getSim(); if (sim) sim.setTool('bridge'); else if (window.MC) window.MC.setTool && window.MC.setTool('bridge'); });
if (itemRoundabout) itemRoundabout.addEventListener('click', ()=>{ if (window.MC && window.MC.setTool) window.MC.setTool('roundabout'); });
if (itemHighway) itemHighway.addEventListener('click', ()=>{ if (window.MC && window.MC.setTool) window.MC.setTool('highway'); });
if (itemForest) itemForest.addEventListener('click', ()=>{ const sim=getSim(); if (sim) sim.setTool('forest'); else if (window.MC && window.MC.setTool) window.MC.setTool('forest'); });
if (itemLake) itemLake.addEventListener('click', ()=>{ const sim=getSim(); if (sim) sim.setTool('lake'); else if (window.MC && window.MC.setTool) window.MC.setTool('lake'); });
if (itemBulldozer) itemBulldozer.addEventListener('click', ()=>{ const sim=getSim(); if (sim) sim.setTool('bulldozer'); else if (window.MC && window.MC.setTool) window.MC.setTool('bulldozer'); });
if (itemSave) itemSave.addEventListener('click', async ()=>{ const sim=getSim(); if (sim) await sim.save(); else if (window.MC) await window.MC.saveToFirestore(); });
if (itemLoad) itemLoad.addEventListener('click', async ()=>{ const sim=getSim(); if (sim) await sim.load(); else if (window.MC) await window.MC.loadLastSave(); });
if (itemStart) itemStart.addEventListener('click', ()=>{ if (window.MC) window.startSimulation('llanura'); });

// Upgrade panel events
function unlock(name){
	if (name==='highway' && itemHighway) itemHighway.classList.remove('locked');
	if (name==='roundabout' && itemRoundabout) itemRoundabout.classList.remove('locked');
	if (name==='bridge' && itemBridge) itemBridge.classList.remove('locked');
}
if (pickHighway) pickHighway.addEventListener('click', ()=>{ unlock('highway'); if (upgradePanel) upgradePanel.style.display='none'; });
if (pickRoundabout) pickRoundabout.addEventListener('click', ()=>{ unlock('roundabout'); if (upgradePanel) upgradePanel.style.display='none'; });
if (pickBridge) pickBridge.addEventListener('click', ()=>{ unlock('bridge'); if (upgradePanel) upgradePanel.style.display='none'; });
if (closeUpgrade) closeUpgrade.addEventListener('click', ()=>{ if (upgradePanel) upgradePanel.style.display='none'; });
window.addEventListener('motorcity:week:choice', ()=>{ if (upgradePanel) upgradePanel.style.display='block'; });
});