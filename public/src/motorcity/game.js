

// --- MainScene completo (lógica MotorCity) ---
/* ---------- Helpers ---------- */
// function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function id() { return 'id_' + Phaser.Math.RND.uuid(); }

// ...existing code from src/game.js...

// (Insert all class definitions: Node, RoadSegment, AStar, Vehicle, Spawner, Visitor)

// (Insert full MainScene class implementation from src/game.js)

// (Insert game init code: Phaser config, window.MotorCityGame, window.startSimulation, resize handler)

export function startMotorCityGame(mapType = 'llanura') {
  // Configuración Phaser y escena principal
  const config = {
    type: Phaser.AUTO,
    parent: 'gameContainer',
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [MainScene],
    backgroundColor: '#0b1220'
  };
  const game = new Phaser.Game(config);
  window.MotorCityGame = game;
  window.startSimulation = (mapType = 'llanura') => {
    const s = game.scene.keys['MainScene'];
    if (!s) return setTimeout(() => window.startSimulation(mapType), 200);
    s.startSimulation ? s.startSimulation(mapType) : s.scene.start && s.scene.start();
  };
  window.addEventListener('resize', () => game.scale.resize(window.innerWidth, window.innerHeight));
  // Iniciar simulación al cargar
  setTimeout(() => window.startSimulation(mapType), 300);

  // Contador de semana y día
  let dia = 1, semana = 1;
  const contador = document.createElement('div');
  contador.id = 'contador-dia-semana';
  contador.style.position = 'fixed';
  contador.style.top = '24px';
  contador.style.right = '32px';
  contador.style.zIndex = '100';
  contador.style.background = '#222c';
  contador.style.color = '#ffe066';
  contador.style.fontSize = '20px';
  contador.style.padding = '8px 18px';
  contador.style.borderRadius = '12px';
  contador.style.fontFamily = 'monospace';
  contador.innerText = `Semana ${semana}  Día ${dia}`;
  document.body.appendChild(contador);
  // Simulación de avance de día/semana
  setInterval(() => {
    dia++;
    if (dia > 7) { dia = 1; semana++; }
    contador.innerText = `Semana ${semana}  Día ${dia}`;
  }, 3500);
}

/* ---------- Helpers ---------- */
// function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function id() { return 'id_' + Phaser.Math.RND.uuid(); }

// --- Clases y render pixelart ---
// --- Procedural: render de tiles con sprites pixelart ---
function renderTile(scene, x, y, type) {
  let spriteKey = '';
  switch(type) {
  case 'forest': spriteKey = 'tile_forest_new'; break;
  case 'water': spriteKey = 'tile_water_new'; break;
  case 'grass': spriteKey = 'tile_grass'; break;
  case 'sand': spriteKey = 'tile_sand_new'; break;
  case 'road': spriteKey = 'tile_road_v'; break;
  default: spriteKey = 'tile_grass_new';
  }
  scene.add.image(x, y, spriteKey).setDisplaySize(32, 32).setDepth(1);
}

// Ejemplo de uso en generación procedural:
// for (let i = 0; i < mapWidth; i++) {
//   for (let j = 0; j < mapHeight; j++) {
//     const tipo = proceduralType(i, j); // 'forest', 'water', etc.
//     renderTile(scene, i * 32, j * 32, tipo);
//   }
// }
// Ejemplo de clase Vehicle con sprite pixelart
class Vehicle {
  constructor(scene, segments = [], opts = {}) {
    this.scene = scene;
    this.segments = Array.isArray(segments) ? segments : [segments];
    // ...existing code...
    // Selección de sprite según tipo
  let spriteKey = 'car_auto';
  if (opts.type === 'bus') spriteKey = 'car_bus_new';
  else if (opts.type === 'taxi') spriteKey = 'car_taxi_new';
  else if (opts.type === 'police') spriteKey = 'car_police';
  else if (opts.type === 'firetruck') spriteKey = 'car_firetruck';
  else if (opts.type === 'ambulance') spriteKey = 'car_ambulance';
  else if (opts.type === 'limo') spriteKey = 'car_autoblack';
  else if (opts.type === 'pickup') spriteKey = 'car_pickup_new';
  else if (opts.type === 'moto') spriteKey = 'car_moto_new';
    const p0 = this.segments[0]?.start || { x: 0, y: 0 };
    this.sprite = scene.add.image(p0.x, p0.y, spriteKey).setDisplaySize(32, 32).setDepth(6);
    // ...existing code...
  }
}

// Ejemplo de creación de casas, comercios, industrias, planta eléctrica y NPCs
function makeHouse(scene, x, y) {
  const houseSprite = 'house_1_new';
  scene.add.image(x, y, houseSprite).setDisplaySize(32, 32).setDepth(3);
}
function makeShop(scene, x, y) {
  const shopSprite = 'shop_1_new';
  scene.add.image(x, y, shopSprite).setDisplaySize(32, 32).setDepth(3);
}
function makeIndustry(scene, x, y) {
  const indSprite = 'industry_1_new';
  scene.add.image(x, y, indSprite).setDisplaySize(32, 32).setDepth(3);
}
function makePlantElectric(scene, x, y) {
  scene.add.image(x, y, 'plant_electric_new').setDisplaySize(32, 32).setDepth(3);
}
function makeNPC(scene, x, y, gender = 'male') {
  const npcSprite = gender === 'male' ? 'npc_male_1_new' : 'npc_female_1_new';
  scene.add.image(x, y, npcSprite).setDisplaySize(32, 32).setDepth(3);
}

// --- Integración de sonidos y animaciones ---
function playSound(key) {
  const audio = new window.Audio(`assets/pixelart/${key}`);
  audio.volume = 0.7;
  audio.play();
}

function showAnim(scene, x, y, animKey) {
  // Usar animaciones nuevas si existen
  let animSprite = animKey;
  if (animKey === 'anim_build_road') animSprite = 'anim_build_road_new';
  if (animKey === 'anim_cut_forest') animSprite = 'anim_cut_forest_new';
  const img = scene.add.image(x, y, animSprite).setDepth(20);
  setTimeout(() => img.destroy(), 700);
}

// En MainScene, dentro de _placeForest y construcción de carretera:
// ...existing code...
// Ejemplo para _placeForest:
// this._placeForest = function(x, y) {
//   ...existing code...
//   playSound('sound_cut_forest.wav');
//   showAnim(this, x, y, 'anim_cut_forest');
// }

// Ejemplo para construcción de carretera (dentro de pointerup):
// playSound('sound_build_road.wav');
// showAnim(this, endPt.x, endPt.y, 'anim_build_road');
