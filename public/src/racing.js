// Racing Game - MotorCity
export function startRacingGame() {
  const config = {
    type: Phaser.AUTO,
    parent: 'gameContainer',
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [RacingScene],
    backgroundColor: '#222'
  };
  const game = new Phaser.Game(config);
  window.RacingGame = game;
}

class RacingScene extends Phaser.Scene {
  constructor() { super({ key: 'RacingScene' }); }
  preload() {
    this.load.image('car_auto_up', 'assets/pixelart/car_auto_arriba.png');
    this.load.image('car_auto_down', 'assets/pixelart/car_auto_abajo.png');
    this.load.image('car_auto_left', 'assets/pixelart/car_auto_izquierda.png');
    this.load.image('car_auto_right', 'assets/pixelart/car_auto_derecha.png');
    this.load.image('tile_road_h', 'assets/pixelart/tile_road_h.png');
    this.load.image('tile_road_v', 'assets/pixelart/tile_road_v.png');
    this.load.image('tile_grass', 'assets/pixelart/tile_grass.png');
    this.load.image('meta_v', 'assets/pixelart/meta_v.png');
    this.load.image('meta_h', 'assets/pixelart/meta_h.png');
    // Curve tiles
    this.load.image('tile_road_curve_derecha', 'assets/pixelart/tile_road_curve_derecha.png');
    this.load.image('tile_road_curve_izq', 'assets/pixelart/tile_road_curve_izq.png');
    this.load.image('tile_road_curve_derecha_abajo', 'assets/pixelart/tile_road_curve_derecha_abajo.png');
    this.load.image('tile_road_curve_izq_abajo', 'assets/pixelart/tile_road_curve_izq_abajo.png');
    this.cursors = this.input.keyboard.createCursorKeys();
    this.eKey = this.input.keyboard.addKey('E');
  }
  create() {
    const tileSize = 48;
    // Circuito con curvas (ejemplo, puedes modificar el diseño)
    const roadMap = [
      ['g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g'],
      ['tile_road_curve_izq','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','tile_road_curve_derecha'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['v','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','v'],
      ['v','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','g','h','v'],
      ['tile_road_curve_izq_abajo','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','h','tile_road_curve_derecha_abajo']
    ];
    const rows = roadMap.length, cols = roadMap[0].length;
    const offsetX = (this.cameras.main.width - cols*tileSize)/2;
    const offsetY = (this.cameras.main.height - rows*tileSize)/2;
    this.roadMap = roadMap;
    this.tileSize = tileSize;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    for (let r=0; r<rows; r++) {
      for (let c=0; c<cols; c++) {
        const x = offsetX + c*tileSize + tileSize/2;
        const y = offsetY + r*tileSize + tileSize/2;
        let tile = 'tile_grass';
        if (roadMap[r][c] === 'h') tile = 'tile_road_h';
        if (roadMap[r][c] === 'v') tile = 'tile_road_v';
        if (roadMap[r][c] === 'meta_v') tile = 'meta_v';
        if (roadMap[r][c] === 'meta_h') tile = 'meta_h';
        this.add.image(x, y, tile).setDisplaySize(tileSize, tileSize).setDepth(0);
      }
    }
    // Coloca el auto en la línea de meta
    this.car = this.add.image(offsetX + tileSize*1.5, offsetY + tileSize*(rows-1.5), 'car_auto_up').setDisplaySize(48, 32);
    this.car.setDepth(2);
    this.engineOn = false;
    this.carDirection = 'up';
    this.infoText = this.add.text(32, 32, 'Presiona E para encender el motor', { fontSize: '20px', fill: '#ffd54f' });
  }
  update() {
    if (!this.engineOn && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.engineOn = true;
      this.infoText.setText('Usa las flechas para conducir');
    }
    if (this.engineOn) {
      // Detect tile under car
      const col = Math.floor((this.car.x - this.offsetX) / this.tileSize);
      const row = Math.floor((this.car.y - this.offsetY) / this.tileSize);
      let speed = 4;
      if (row >= 0 && row < this.roadMap.length && col >= 0 && col < this.roadMap[0].length) {
        const tileType = this.roadMap[row][col];
        if (tileType === 'g') speed = 2; // penalización por pasto
        if (tileType !== 'h' && tileType !== 'v' && tileType !== 'meta_v' && tileType !== 'meta_h') speed = 2;
      }
      if (this.cursors.left.isDown) {
        this.car.x -= speed;
        if (this.carDirection !== 'left') {
          this.car.setTexture('car_auto_left');
          this.carDirection = 'left';
        }
      } else if (this.cursors.right.isDown) {
        this.car.x += speed;
        if (this.carDirection !== 'right') {
          this.car.setTexture('car_auto_right');
          this.carDirection = 'right';
        }
      } else if (this.cursors.up.isDown) {
        this.car.y -= speed;
        if (this.carDirection !== 'up') {
          this.car.setTexture('car_auto_up');
          this.carDirection = 'up';
        }
      } else if (this.cursors.down.isDown) {
        this.car.y += speed;
        if (this.carDirection !== 'down') {
          this.car.setTexture('car_auto_down');
          this.carDirection = 'down';
        }
      }
    }
  }
}
