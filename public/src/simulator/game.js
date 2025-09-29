// --- MotorCitySimulator global function ---
window.createMotorCitySimulator = function() {
  // Create a Phaser scene for the simulator
  const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 480,
    parent: 'game-container',
    scene: {
      preload: function() {
        // Load basic assets (pixelart tiles, car sprite)
        this.load.image('tile_grass', 'assets/pixelart/tile_grass.png');
        this.load.image('tile_road', 'assets/pixelart/tile_road_h.png');
        this.load.image('car_auto', 'assets/pixelart/car_auto_derecha.png');
      },
      create: function() {
        // Render a simple procedural map (grass + road)
        for (let i = 0; i < 20; i++) {
          for (let j = 0; j < 15; j++) {
            let type = (i === 10) ? 'tile_road' : 'tile_grass';
            this.add.image(i * 32, j * 32, type).setDisplaySize(32, 32).setDepth(1);
          }
        }
        // Place a car sprite on the road
        this.car = this.add.image(10 * 32, 7 * 32, 'car_auto').setDisplaySize(32, 32).setDepth(2);
      }
    }
  };
  // Destroy previous Phaser game instance if exists
  if (window._simulatorGame && window._simulatorGame.destroy) {
    window._simulatorGame.destroy(true);
  }
  window._simulatorGame = new Phaser.Game(config);
};
// Lógica principal del simulador

export function startSimulatorGame() {
  window.createMotorCitySimulator();
}

// --- Render pixelart en el simulador ---
// Ejemplo de uso de sprites de auto según dirección:
// scene.add.image(x, y, 'car_auto_up').setDisplaySize(32, 32);
// --- Procedural: render de tiles con sprites pixelart ---
function renderTile(scene, x, y, type) {
  let spriteKey = '';
  switch(type) {
    case 'forest': spriteKey = 'tile_forest'; break;
    case 'water': spriteKey = 'tile_water'; break;
    case 'grass': spriteKey = 'tile_grass'; break;
    case 'sand': spriteKey = 'tile_sand'; break;
    case 'road': spriteKey = 'tile_road'; break;
    default: spriteKey = 'tile_grass';
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
function makeHouse(scene, x, y) {
  const houseSprite = 'house_' + (1 + Math.floor(Math.random() * 5));
  scene.add.image(x, y, houseSprite).setDisplaySize(32, 32).setDepth(3);
}
function makeShop(scene, x, y) {
  const shopSprite = 'shop_' + (1 + Math.floor(Math.random() * 5));
  scene.add.image(x, y, shopSprite).setDisplaySize(32, 32).setDepth(3);
}
function makeIndustry(scene, x, y) {
  const indSprite = 'industry_' + (1 + Math.floor(Math.random() * 5));
  scene.add.image(x, y, indSprite).setDisplaySize(32, 32).setDepth(3);
}
function makePlantElectric(scene, x, y) {
  scene.add.image(x, y, 'plant_electric').setDisplaySize(32, 32).setDepth(3);
}
function makeNPC(scene, x, y, gender = 'male') {
  const idx = 1 + Math.floor(Math.random() * 9);
  const npcSprite = gender === 'male' ? `npc_male_${idx}` : `npc_female_${idx}`;
  scene.add.image(x, y, npcSprite).setDisplaySize(32, 32).setDepth(3);
}

// --- Integración de sonidos y animaciones ---
function playSound(key) {
  const audio = new window.Audio(`assets/pixelart/${key}`);
  audio.volume = 0.7;
  audio.play();
}

function showAnim(scene, x, y, animKey) {
  const img = scene.add.image(x, y, animKey).setDepth(20);
  setTimeout(() => img.destroy(), 700);
}

// En MotorCitySimulator, dentro de _paintRoad y _eraseAt:
// ...existing code...
// Ejemplo para _paintRoad:
// playSound('sound_build_road.wav');
// showAnim(this.scene, x, y, 'anim_build_road');
// Ejemplo para _eraseAt (si borra bosque):
// playSound('sound_cut_forest.wav');
// showAnim(this.scene, x, y, 'anim_cut_forest');
