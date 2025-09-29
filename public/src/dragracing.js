// DragRacing game mode
export function startDragRacingGame() {
  // Show transmission selection UI
  const uiDiv = document.createElement('div');
  uiDiv.id = 'dragracing-ui';
  uiDiv.style = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:200;background:#222;padding:32px 24px;border-radius:16px;color:#fff;text-align:center;box-shadow:0 0 24px #000;';
  uiDiv.innerHTML = `<h2>DragRacing</h2>
    <p>Selecciona transmisión:</p>
    <button id='btnManual' style='margin:8px 0 12px 0;padding:10px 24px;font-size:1.1em;'>Manual (A/S para cambios)</button>
    <button id='btnAuto' style='margin-bottom:12px;padding:10px 24px;font-size:1.1em;'>Automática</button>
    <p>Pulsa E para elegir transmisión antes de empezar.</p>`;
  document.body.appendChild(uiDiv);

  let transmission = null;
  document.getElementById('btnManual').onclick = () => { transmission = 'manual'; startGame(); };
  document.getElementById('btnAuto').onclick = () => { transmission = 'auto'; startGame(); };

  // Store upgrades and coins between rounds
  if (!window._dragracingUpgrades) window._dragracingUpgrades = { fuel:0, speed:0, tires:0, aero:0, turbo:0, tank:0, shield:0, magnet:0, autoRepair:0 };
  if (!window._dragracingCoins) window._dragracingCoins = 0;
  function startGame() {
    uiDiv.remove();
    // Phaser config
    const config = {
      type: Phaser.AUTO,
      width: 480,
      height: 640,
      parent: 'gameContainer',
      scene: {
        preload: function() {
          this.load.image('track_bg', 'assets/pixelart/track_bg.png');
          this.load.image('car_auto', 'assets/pixelart/car_auto_arriba.png');
          this.load.image('car_auto_red', 'assets/pixelart/car_auto_arriba.png');
          // Obstáculos integrados
          this.load.image('bache', 'assets/pixelart/obstacles/bache.png');
          this.load.image('barrilAceite', 'assets/pixelart/obstacles/barrilAceite.png');
          this.load.image('box', 'assets/pixelart/obstacles/box.png');
          this.load.image('charcoaceite', 'assets/pixelart/obstacles/charcoaceite.png');
          this.load.image('Cono', 'assets/pixelart/obstacles/Cono.png');
          this.load.image('vallaTransito', 'assets/pixelart/obstacles/vallaTransito.png');
          // Obstáculos legacy (puedes eliminar si ya no usas)
          this.load.image('obstacle', 'assets/pixelart/tile_road_curve_derecha_abajo.png');
          this.load.image('oil', 'assets/pixelart/tile_road_curve_izq_abajo.png');
          this.load.image('barrera', 'assets/pixelart/meta_h.png');
          this.load.image('zona', 'assets/pixelart/meta_v.png');
          this.load.image('car_giro_izq', 'assets/pixelart/car_auto_izquierda.png');
          this.load.image('car_giro_der', 'assets/pixelart/car_auto_derecha.png');
          // Power-ups y monedas
          this.load.image('coinbase', 'assets/pixelart/powerUps/coinbase.png');
          this.load.image('Coinx5', 'assets/pixelart/powerUps/Coinx5.png');
          this.load.image('FuelCan', 'assets/pixelart/powerUps/FuelCan.png');
          this.load.image('Magnet', 'assets/pixelart/powerUps/Magnet.png');
          this.load.image('Nitro', 'assets/pixelart/powerUps/Nitro.png');
          this.load.image('Wrench', 'assets/pixelart/powerUps/Wrench.png');
          this.load.image('Shield', 'assets/pixelart/powerUps/Shield.png');
          this.load.image('ClearLane', 'assets/pixelart/powerUps/ClearLane.png');
        },
        create: function() {
          // Center game visually
          this.cameras.main.setBackgroundColor('#101522');
          // Fondo de pista grande (doble para loop, tamaño dinámico)
          // Ajustar fondo a imagen 1024x1536 px, escalando a 480x640 px de canvas
          this.textures.once('onload', () => {
            const tex = this.textures.get('track_bg').getSourceImage();
            this.trackBgHeight = tex.height * (480 / tex.width); // Escala proporcional al ancho del canvas
            this.trackBg1.setDisplaySize(480, this.trackBgHeight);
            this.trackBg2.setDisplaySize(480, this.trackBgHeight);
            this.trackBg2.y = this.cameras.main.height/2 - this.trackBgHeight;
          });
          // Inicialmente crea los fondos con altura provisional
          this.trackBgHeight = 1536 * (480 / 1024);
          this.trackBg1 = this.add.image(this.cameras.main.width/2, this.cameras.main.height/2, 'track_bg')
            .setDisplaySize(480, this.trackBgHeight)
            .setDepth(0);
          this.trackBg2 = this.add.image(this.cameras.main.width/2, this.cameras.main.height/2 - this.trackBgHeight, 'track_bg')
            .setDisplaySize(480, this.trackBgHeight)
            .setDepth(0);
          this.lanes = 7;
          this.laneWidth = 48;
          this.trackWidth = this.lanes * this.laneWidth;
          this.trackX = (this.cameras.main.width - this.trackWidth) / 2;
          this.carLane = 3;
          this.carY = this.cameras.main.height - 120;
          // Use persistent upgrades and coins
          this.upgrades = Object.assign({}, window._dragracingUpgrades);
          this.fuel = 45 + (this.upgrades.fuel || 0) * 5;
          this.maxFuel = 20 + (this.upgrades.tank || 0) * 10;
          this.gear = 1;
          this.maxGear = 6;
          this.speed = 2 + (this.upgrades.speed || 0) * 0.5;
          this.turbo = (this.upgrades.turbo || 0);
          this.turboActive = false;
          this.turboCooldown = 0;
          this.shield = (this.upgrades.shield || 0);
          this.magnet = (this.upgrades.magnet || 0);
          this.autoRepair = (this.upgrades.autoRepair || 0);
          this.transmission = transmission;
          this.distance = 0;
          this.coins = typeof window._dragracingCoins === 'number' ? window._dragracingCoins : 0;
          this.obstacles = [];
          this.trackRows = [];
          this.bacheSlow = 0;
          this.zonaConstruccion = 0;
          // Centrar auto sobre la pista
          this.car = this.add.image(this.cameras.main.width/2 + (this.carLane-3)*this.laneWidth, this.carY, 'car_auto_red').setDisplaySize(40, 56).setDepth(2);
          this.cursors = this.input.keyboard.createCursorKeys();
          this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
          this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
          this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
          this.keyT = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T);
          // UI alineada a la izquierda del canvas, pero siempre visible
          let uiX = 32;
          this.distanceText = this.add.text(uiX, 20, 'Distancia: 0m', { fontSize: '20px', fill: '#fff' });
          this.fuelText = this.add.text(uiX, 50, 'Gasolina: 10', { fontSize: '20px', fill: '#ffd54f' });
          this.gearText = this.add.text(uiX, 80, 'Marcha: 1', { fontSize: '20px', fill: '#80ff80' });
          this.coinText = this.add.text(uiX, 110, 'Monedas: 0', { fontSize: '20px', fill: '#ffe066' });
        },
        update: function() {
          // Transmission logic
          let moveSpeed = this.speed;
          if (this.transmission === 'manual') {
            if (Phaser.Input.Keyboard.JustDown(this.keyA)) {
              if (this.gear < this.maxGear) this.gear++;
            }
            if (Phaser.Input.Keyboard.JustDown(this.keyS)) {
              if (this.gear > 1) this.gear--;
            }
            moveSpeed += (this.gear - 1) * 0.5;
          } else {
            this.gear = Math.min(this.maxGear, 1 + Math.floor(this.distance / 100));
            moveSpeed += (this.gear - 1) * 0.5;
          }
          // Turbo logic
          if (this.keyT.isDown && this.turbo > 0 && !this.turboActive && this.turboCooldown <= 0) {
            this.turboActive = true;
            this.turboCooldown = 120;
          }
          if (this.turboActive) {
            moveSpeed += 3;
            this.fuel -= 0.5;
            this.turboCooldown--;
            if (this.turboCooldown <= 0) this.turboActive = false;
          }
          // Bache slow
          if (this.bacheSlow > 0) {
            moveSpeed *= 0.5;
            this.bacheSlow--;
          }
          // Zona construcción
          if (this.zonaConstruccion > 0) {
            moveSpeed *= 0.7;
            this.zonaConstruccion--;
          }
          // Move car left/right (lane change)
          // Only allow left/right movement, car always faces up
          // Smooth lane movement
          if (!this.moveCooldown) this.moveCooldown = 0;
          this.moveCooldown--;
          if (this.moveCooldown < 0) this.moveCooldown = 0;
          if (this.moveCooldown === 0) {
            if (this.cursors.left.isDown && this.carLane > 0) {
              this.carLane--;
              this.car.x = this.cameras.main.width/2 + (this.carLane-3)*this.laneWidth;
              this.moveCooldown = 10; // frames between lane moves
            } else if (this.cursors.right.isDown && this.carLane < this.lanes-1) {
              this.carLane++;
              this.car.x = this.cameras.main.width/2 + (this.carLane-3)*this.laneWidth;
              this.moveCooldown = 10;
            }
          }
          // Track moves down, car stays static
          let trackSpeed = moveSpeed;
          // Grass penalty
          if (this.carLane === 0 || this.carLane === this.lanes-1) {
            trackSpeed *= 0.2;
            this.fuel -= 0.05;
          }
          // Fuel consumption
          let fuelCost = 0.03 + 0.01 * trackSpeed;
          fuelCost -= (this.upgrades.aero || 0) * 0.2;
          fuelCost -= (this.upgrades.tires || 0) * 0.1;
          fuelCost += (this.upgrades.speed || 0) * 0.5;
          this.fuel -= fuelCost;
          if (this.autoRepair > 0 && Math.floor(this.distance) % 200 === 0 && this.fuel < this.maxFuel) {
            this.fuel += 2 * this.autoRepair;
          }
          if (this.fuel > 0) {
            this.distance += trackSpeed;
            // --- SPAWN MONEDAS Y POWERUPS ---
            if (!this.powerups) this.powerups = [];
            // Control de aparición: no más de 1 powerup por carril visible, y separación mínima
            let lanesUsed = new Set();
            for (let p of this.powerups) if (p.y > -64 && p.y < 128) lanesUsed.add(p.lane);
            // Monedas: probabilidad baja, nunca juntas
            if (Math.random() < 0.07) {
              let lane = Phaser.Math.Between(1, this.lanes-2);
              if (!lanesUsed.has(lane)) {
                let x = this.trackX + lane*this.laneWidth + this.laneWidth/2;
                let type = Math.random() < 0.8 ? 'coinbase' : 'Coinx5';
                let img = this.add.image(x, -32, type).setDisplaySize(this.laneWidth-12, 32).setDepth(2);
                img.type = type;
                img.lane = lane;
                this.powerups.push(img);
                lanesUsed.add(lane);
              }
            }
            // Otros powerups: probabilidad muy baja, nunca juntos
            if (Math.random() < 0.012) {
              let lane = Phaser.Math.Between(1, this.lanes-2);
              if (!lanesUsed.has(lane)) {
                let x = this.trackX + lane*this.laneWidth + this.laneWidth/2;
                let types = ['FuelCan','Magnet','Nitro','Wrench','Shield','ClearLane'];
                let type = types[Phaser.Math.Between(0, types.length-1)];
                let img = this.add.image(x, -32, type).setDisplaySize(this.laneWidth-12, 32).setDepth(2);
                img.type = type;
                img.lane = lane;
                this.powerups.push(img);
              }
            }
            // Mover y recolectar powerups
            for (let p of this.powerups) p.y += trackSpeed;
            // Magnet: recolecta monedas cercanas
            if (this.magnet > 0) {
              for (let p of this.powerups) {
                if ((p.type === 'coinbase' || p.type === 'Coinx5') && Math.abs(p.y - this.carY) < 80 && Math.abs((p.lane||0) - this.carLane) <= 1) {
                  p.y = this.carY;
                  p.x = this.car.x;
                }
              }
            }
            // Colisión con powerups
            for (let i = this.powerups.length-1; i >= 0; i--) {
              let p = this.powerups[i];
              if (Math.abs(p.y - this.carY) < 32 && p.lane === this.carLane) {
                if (p.type === 'coinbase') {
                  this.coins += 3;
                  window._dragracingCoins = this.coins;
                } else if (p.type === 'Coinx5') {
                  this.coins += 5;
                  window._dragracingCoins = this.coins;
                } else if (p.type === 'FuelCan') {
                  this.fuel += 20;
                  if (this.fuel > this.maxFuel) this.fuel = this.maxFuel;
                } else if (p.type === 'Magnet') {
                  this.magnet = 10 * 60; // 10 segundos
                } else if (p.type === 'Nitro') {
                  this.turboActive = true;
                  this.turboCooldown = 180; // 3 segundos
                } else if (p.type === 'Wrench') {
                  this.bacheSlow = 0;
                  this.zonaConstruccion = 0;
                } else if (p.type === 'Shield') {
                  this.shield += 1;
                } else if (p.type === 'ClearLane') {
                  for (let obs of this.obstacles) obs.destroy();
                  this.obstacles = [];
                }
                p.destroy();
                this.powerups.splice(i,1);
              } else if (p.y > this.cameras.main.height + 32) {
                p.destroy();
                this.powerups.splice(i,1);
              }
            }
            // Magnet duración
            if (typeof this.magnet === 'number' && this.magnet > 0) this.magnet--;
            // Mover fondo de pista grande (doble fondo para loop perfecto)
            if (!this.bgOffset) this.bgOffset = 0;
            this.bgOffset += trackSpeed;
            let y1 = (this.cameras.main.height/2 + (this.bgOffset % this.trackBgHeight));
            let y2 = y1 - this.trackBgHeight;
            if (y1 >= this.cameras.main.height + this.trackBgHeight/2) y1 = y2 - this.trackBgHeight;
            if (y2 >= this.cameras.main.height + this.trackBgHeight/2) y2 = y1 - this.trackBgHeight;
            this.trackBg1.y = y1;
            this.trackBg2.y = y2;
            // Mover obstáculos
            for (let obs of this.obstacles) obs.y += trackSpeed;
            this.obstacles = this.obstacles.filter(obs => obs.y < this.cameras.main.height + 32);
            // Procedural obstacle spawn: never block all lanes, never more than 2 consecutive, use all integrated sprites
            let obsLanes = this.obstacles.filter(o => o.y > -64 && o.y < 128).map(o => o.lane);
            let maxObstacles = 2;
            let lanesAvailable = [];
            for (let l = 1; l < this.lanes-1; l++) if (!obsLanes.includes(l)) lanesAvailable.push(l);
            if (lanesAvailable.length > 0 && Math.random() < 0.055) {
              // Procedural: never block all lanes, never more than 2 consecutive
              let nObs = Phaser.Math.Between(1, Math.min(maxObstacles, lanesAvailable.length));
              Phaser.Utils.Array.Shuffle(lanesAvailable);
              // Use all integrated obstacle types
              let types = ['bache','barrilAceite','box','charcoaceite','Cono','vallaTransito'];
              for (let i = 0; i < nObs; i++) {
                let lane = lanesAvailable[i];
                let x = this.trackX + lane*this.laneWidth + this.laneWidth/2;
                let type = types[Phaser.Math.Between(0, types.length-1)];
                let obs = this.add.image(x, -32, type).setDisplaySize(this.laneWidth-8, 32).setDepth(2);
                obs.lane = lane;
                obs.type = type;
                this.obstacles.push(obs);
              }
            }
            // Collision detection
            for (let obs of this.obstacles) {
              if (Math.abs(obs.y - this.carY) < 32 && obs.lane === this.carLane) {
                if (obs.type === 'oil') {
                  // Oil: animate spin and move to random lane
                  let dir = Phaser.Math.Between(0,1) === 0 ? -1 : 1;
                  let newLane = this.carLane + dir;
                  if (newLane > 0 && newLane < this.lanes-1) {
                    let anim = dir === -1 ? 'car_giro_izq' : 'car_giro_der';
                    this.car.setTexture(anim);
                    setTimeout(() => this.car.setTexture('car_auto_red'), 400);
                    this.carLane = newLane;
                    this.car.x = this.cameras.main.width/2 + (this.carLane-3)*this.laneWidth;
                  }
                  obs.destroy();
                  continue;
                }
                if (obs.type === 'bache') {
                  this.bacheSlow = 60;
                  obs.destroy();
                  continue;
                }
                if (obs.type === 'cono') {
                  obs.destroy();
                  continue;
                }
                if (obs.type === 'barrera') {
                  if (this.shield > 0) {
                    this.shield--;
                    obs.destroy();
                    continue;
                  }
                  this.car.setTint(0xff0000);
                  setTimeout(() => this.car.clearTint(), 300);
                  obs.destroy();
                  this.scene.pause();
                  showUpgrades(this);
                  return;
                }
                if (obs.type === 'zona') {
                  this.zonaConstruccion = 120;
                  obs.destroy();
                  continue;
                }
                // Default: crash
                if (this.shield > 0) {
                  this.shield--;
                  obs.destroy();
                  continue;
                }
                this.car.setTint(0xff0000);
                setTimeout(() => this.car.clearTint(), 300);
                obs.destroy();
                this.scene.pause();
                showUpgrades(this);
                return;
              }
            }
            // Prevent car from leaving track
            if (this.carLane < 0) this.carLane = 0;
            if (this.carLane > this.lanes-1) this.carLane = this.lanes-1;
            // Extra coins every 100m
            if (!this.lastCoinBonus) this.lastCoinBonus = 0;
            if (Math.floor(this.distance/100) > this.lastCoinBonus) {
              this.lastCoinBonus = Math.floor(this.distance/100);
              // Spawn 4 coins in random lanes
              let bonusLanes = Phaser.Utils.Array.Shuffle([...Array(this.lanes-2).keys()].map(i=>i+1)).slice(0,4);
              for (let lane of bonusLanes) {
                let x = this.trackX + lane*this.laneWidth + this.laneWidth/2;
                let type = Math.random() < 0.8 ? 'coinbase' : 'Coinx5';
                let img = this.add.image(x, -32, type).setDisplaySize(this.laneWidth-12, 32).setDepth(2);
                img.type = type;
                img.lane = lane;
                if (!this.powerups) this.powerups = [];
                this.powerups.push(img);
              }
            }
            // UI update
            this.distanceText.setText('Distancia: ' + Math.floor(this.distance) + 'm');
            this.fuelText.setText('Gasolina: ' + Math.max(0, Math.floor(this.fuel)));
            this.gearText.setText('Marcha: ' + this.gear);
            this.coinText.setText('Monedas: ' + this.coins);
          } else {
            // End of race
            this.scene.pause();
            showUpgrades(this);
          }
        }
      },
      physics: { default: 'arcade' }
    };
    if (window._dragracingGame && window._dragracingGame.destroy) window._dragracingGame.destroy(true);
    window._dragracingGame = new Phaser.Game(config);
  }

  function showUpgrades(scene) {
    // Individual upgrade costs
    const upgradeCosts = {
      fuel: 50,
      speed: 25,
      tires: 20,
      aero: 30,
      turbo: 40,
      tank: 35,
      shield: 60,
      magnet: 30,
      autoRepair: 45
    };
    const options = [];
    const allUpgrades = ['fuel','speed','tires','aero','turbo','tank','shield','magnet','autoRepair'];
    while (options.length < 3) {
      const upg = allUpgrades[Phaser.Math.Between(0, allUpgrades.length - 1)];
      if (!options.includes(upg)) options.push(upg);
    }
    const upgradeDiv = document.createElement('div');
    upgradeDiv.id = 'upgrade-ui';
    upgradeDiv.style = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:201;background:#222;padding:32px 24px;border-radius:16px;color:#fff;text-align:center;box-shadow:0 0 24px #000;';
    let html = `<h3>¡Mejoras!</h3><p>Elige una mejora:</p>`;
    options.forEach(upg => {
      let nombre = {
        fuel: 'Gasolina', speed: 'Velocidad', tires: 'Llantas', aero: 'Aerodinámica', turbo: 'Turbo', tank: 'Tanque Extra', shield: 'Blindaje', magnet: 'Imán', autoRepair: 'Reparación'
      }[upg];
      html += `<button id='upg${upg.charAt(0).toUpperCase()+upg.slice(1)}'>+${nombre} (${upgradeCosts[upg]} monedas)</button>`;
    });
    html += `<p>Monedas disponibles: ${scene.coins}</p>`;
    html += `<button id='skipUpgrades' style='margin-top:12px;'>No comprar mejoras</button>`;
    upgradeDiv.innerHTML = html;
    document.body.appendChild(upgradeDiv);
    options.forEach(upg => {
      document.getElementById('upg'+upg.charAt(0).toUpperCase()+upg.slice(1)).onclick = () => {
        if (scene.coins >= upgradeCosts[upg]) {
          window._dragracingUpgrades[upg] = (window._dragracingUpgrades[upg]||0)+1;
          window._dragracingCoins = scene.coins - upgradeCosts[upg];
          upgradeDiv.remove();
          startGame();
        } else {
          alert('No tienes suficientes monedas para esta mejora.');
        }
      };
    });
    document.getElementById('skipUpgrades').onclick = () => {
      upgradeDiv.remove();
      startGame();
    };
  }
}
