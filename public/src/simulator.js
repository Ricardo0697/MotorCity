// src/simulator.js
// MotorCity Simulator (SimCity-like) scaffold
// Provides a separate sandbox with zoning and budgets placeholders

class MotorCitySimulator {
  constructor(containerId = 'gameContainer') {
    this.containerId = containerId;
    this.running = false;
    this.money = 10000;
    this.population = 0;
  this.zones = []; // {type:'R'|'C'|'I', x,y,w,h,demand}
  this.buildings = []; // {type,x,y}
  this.taxRate = 0.08; // 8%
  this.maintenance = 10; // slower costs per tick
  this.powerPlants = []; // {x,y,radius}
  this.waterTowers = []; // {x,y,radius}
  this.tool = 'zone_R'; // current tool
  this.brush = 1; // tiles per side
  this.grid = 32; // tile size
  this.preview = null; // {x,y,w,h}
  this._safeBounds = { left: 0, top: 0, right: 0, bottom: 0 };
  this.dragging = false;
  this.roads = [];
  this.pollution = [];
  this.showPollution = false;
    this.scene = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._initPhaser();
  }

  _initPhaser() {
    const self = this;
    const SimScene = new Phaser.Class({
      Extends: Phaser.Scene,
      initialize: function SimScene() { Phaser.Scene.call(this, { key: 'SimScene' }); },
      create: function () {
        this.graphics = this.add.graphics();
        self.scene = this;
        this.cameras.main.setBackgroundColor('#132033');
        this.time.addEvent({ delay: 500, loop: true, callback: () => self.updateUI() });
        // input for tools
  this.input.on('pointermove', p => self.onPointerMove(p));
  this.input.on('pointerdown', p => { self.dragging = true; self.onPointerDown(p); });
  this.input.on('pointerup', () => { self.dragging = false; });
        // compute safe bounds avoiding left UI panel
        self._computeSafeBounds();
        // announce ready (to show sim panel)
        window.dispatchEvent(new CustomEvent('motorcity:sim:ready'));
      },
      update: function (time, delta) {
        self.draw(this.graphics);
        self.tick(delta);
      }
    });

    const config = {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: window.innerWidth,
      height: window.innerHeight,
      scene: [SimScene],
      backgroundColor: '#132033'
    };
    this._game = new Phaser.Game(config);
    window.MotorCitySim = this; // expose
    // keep safe bounds updated on resize
    window.addEventListener('resize', () => { try { this._computeSafeBounds(); } catch(e){} });
  }

  draw(g) {
    g.clear();
    // grid
    g.lineStyle(1, 0x1f2d47, 1);
    for (let x = 0; x < window.innerWidth; x += this.grid) { g.lineBetween(x, 0, x, window.innerHeight); }
    for (let y = 0; y < window.innerHeight; y += this.grid) { g.lineBetween(0, y, window.innerWidth, y); }
    // zones
    for (const z of this.zones) {
      const color = z.type === 'R' ? 0x66bb6a : z.type === 'C' ? 0xffca28 : 0x42a5f5;
      g.fillStyle(color, 0.25);
      g.fillRect(z.x, z.y, z.w, z.h);
    }
  // utilities coverage
    for (const p of this.powerPlants) { g.lineStyle(1, 0xef5350, 0.6); g.strokeCircle(p.x, p.y, p.radius); }
    for (const w of this.waterTowers) { g.lineStyle(1, 0x42a5f5, 0.6); g.strokeCircle(w.x, w.y, w.radius); }
  // roads
  g.lineStyle(10, 0x7fb3ff, 1);
  for (const r of this.roads) g.strokeRect(r.x, r.y, this.grid, this.grid);
    // buildings dots
    g.fillStyle(0xe0f2f1, 0.8);
    for (const b of this.buildings) g.fillCircle(b.x, b.y, 2);
    // preview
    if (this.preview) {
      const color = this.tool.startsWith('zone_') ? (this.tool === 'zone_R' ? 0x66bb6a : this.tool === 'zone_C' ? 0xffca28 : 0x42a5f5) : 0xffffff;
      g.lineStyle(2, color, 0.8);
      g.strokeRect(this.preview.x, this.preview.y, this.preview.w, this.preview.h);
    }
    // pollution overlay (heat circles)
    if (this.showPollution && this.pollution.length) {
      for (const p of this.pollution) {
        const col = p.type === 'smog' ? 0xff7043 : 0xffc107;
        const rad = Math.max(16, p.value * 14);
        g.fillStyle(col, 0.08);
        g.fillCircle(p.x, p.y, rad);
      }
    }
  }

  tick(delta) {
    // slow the sim: reduce effective delta
    const scale = (delta / 16.67) * 0.25;
    // demand & growth
    for (const z of this.zones) {
      const power = this.inCoverage(z, this.powerPlants);
      const water = this.inCoverage(z, this.waterTowers);
      const service = (power && water) ? 1 : 0.5;
  const nearRoad = this.nearRoad(z) ? 1.2 : 0.8;
  const polPenalty = 1 - this.pollutionAt(z) * 0.3; // up to -30%
  const growth = (z.type === 'R' ? 0.012 : z.type === 'C' ? 0.009 : 0.006) * service * nearRoad * Math.max(0.6, polPenalty);
      z.demand = (z.demand || 0) + growth * scale;
      while (z.demand > 1) {
        z.demand -= 1;
        const px = z.x + 8 + Math.random() * (z.w - 16);
        const py = z.y + 8 + Math.random() * (z.h - 16);
        this.buildings.push({ type: z.type, x: px, y: py });
        if (z.type === 'R') this.population += 3;
        if (z.type === 'I') this.addPollution(px, py, 4, 'smog');
        if (z.type !== 'R') this.addPollution(px, py, 2, 'noise');
      }
    }
    // simple budget
    const valuation = this.buildings.length * 10;
    const income = valuation * this.taxRate;
    const expense = this.maintenance + this.zones.length * 1.2 + this.buildings.length * 0.12;
    this.money += (income - expense) * scale;
  }

  zone(type, x, y, w, h) { this.zones.push({ type, x, y, w, h, demand: 0 }); }

  inCoverage(z, sources) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    for (const s of sources) { if (Math.hypot(cx - s.x, cy - s.y) <= s.radius) return true; }
    return false;
  }

  updateUI() {
    const alerts = document.getElementById('alerts');
    if (alerts) alerts.textContent = `Sim: $${this.money.toFixed(0)} | Población: ${Math.round(this.population)}`;
  }

  // -------- Tools & interactions --------
  setTool(tool) { this.tool = tool; }
  setBrush(n) { this.brush = Math.max(1, Math.min(6, n|0)); }
  setTaxRate(rate) { this.taxRate = Math.max(0, Math.min(0.25, rate)); }
  setShowPollution(v){ this.showPollution = !!v; }
  snap(v) { return Math.floor(v / this.grid) * this.grid; }
  onPointerMove(p) {
    const pos = this._clampToSafe(p.worldX, p.worldY);
    if (this.tool === 'road') {
      const x = this.snap(pos.x), y = this.snap(pos.y);
      this.preview = { x, y, w: this.grid, h: this.grid };
      if (this.dragging) this._paintRoad(x, y);
    } else if (this.tool.startsWith('zone_')) {
      const size = this.brush * this.grid;
      const x = this.snap(pos.x);
      const y = this.snap(pos.y);
      this.preview = { x, y, w: size, h: size };
      if (this.dragging) this.zone(this.tool.split('_')[1], x, y, size, size);
    } else {
      this.preview = null;
    }
  }
  onPointerDown(p) {
    const pos = this._clampToSafe(p.worldX, p.worldY);
    if (this.tool === 'power') {
      this.powerPlants.push({ x: pos.x, y: pos.y, radius: 240 });
      return;
    }
    if (this.tool === 'water') {
      this.waterTowers.push({ x: pos.x, y: pos.y, radius: 220 });
      return;
    }
    if (this.tool === 'road') {
      const x = this.snap(pos.x), y = this.snap(pos.y);
      this._paintRoad(x, y);
      return;
    }
    if (this.tool === 'bulldozer') {
      const x = this.snap(pos.x), y = this.snap(pos.y);
      this._eraseAt(x, y);
      return;
    }
    if (this.tool.startsWith('zone_')) {
      const type = this.tool.split('_')[1]; // R/C/I
      const size = this.brush * this.grid;
      const x = this.snap(pos.x);
      const y = this.snap(pos.y);
      this.zone(type, x, y, size, size);
      return;
    }
  }

  _computeSafeBounds() {
    const el = document.getElementById('ui');
    const w = window.innerWidth, h = window.innerHeight;
    if (!el) { this._safeBounds = { left: 8, top: 8, right: w - 8, bottom: h - 8 }; return; }
    const r = el.getBoundingClientRect();
    const left = Math.min(w - 8 - 50, r.right + 8);
    this._safeBounds = { left, top: 8, right: w - 8, bottom: h - 8 };
  }
  _clampToSafe(x, y) {
    const b = this._safeBounds; return { x: Phaser.Math.Clamp(x, b.left, b.right), y: Phaser.Math.Clamp(y, b.top, b.bottom) };
  }

  nearRoad(z){
    const cx = z.x + z.w/2, cy = z.y + z.h/2;
    for (const r of this.roads) {
      const rx = r.x + this.grid/2, ry = r.y + this.grid/2;
      if (Math.hypot(cx-rx, cy-ry) < 90) return true;
    }
    return false;
  }
  addPollution(x,y,value,type){ this.pollution.push({x,y,value,type}); }
  _paintRoad(x, y){ if(!this.roads.find(r=>r.x===x&&r.y===y)) this.roads.push({x,y}); }
  pollutionAt(z){
    const cx = z.x + z.w/2, cy = z.y + z.h/2;
    let acc = 0;
    for (const p of this.pollution) {
      const d = Math.hypot(cx-p.x, cy-p.y);
      const influence = Math.max(0, 1 - d/160) * (p.value/6);
      acc += influence;
    }
    return Math.max(0, Math.min(1, acc));
  }
  _eraseAt(x,y){
    const hitRect = (o)=> x>=o.x && x<o.x+o.w && y>=o.y && y<o.y+o.h;
    this.zones = this.zones.filter(o=>!hitRect(o));
    this.roads = this.roads.filter(o=> !(x===o.x && y===o.y));
    this.powerPlants = this.powerPlants.filter(o=> Math.hypot(x-o.x,y-o.y) > 32);
    this.waterTowers = this.waterTowers.filter(o=> Math.hypot(x-o.x,y-o.y) > 32);
  }

  async save(){
    const data = { money:this.money,pop:this.population,tax:this.taxRate,zones:this.zones,roads:this.roads,power:this.powerPlants,water:this.waterTowers,buildings:this.buildings };
    localStorage.setItem('motorcity-sim', JSON.stringify(data));
  }
  async load(){
    const raw = localStorage.getItem('motorcity-sim'); if(!raw) return false;
    const d = JSON.parse(raw);
    this.money = d.money||0; this.population = d.pop||0; this.taxRate = d.tax||0.08;
    this.zones = d.zones||[]; this.roads = d.roads||[]; this.powerPlants = d.power||[]; this.waterTowers = d.water||[]; this.buildings = d.buildings||[];
    return true;
  }
}

window.createMotorCitySimulator = function () {
  const sim = new MotorCitySimulator('gameContainer');
  sim.start();
  // show panel initial state & sync tax
  const taxEl = document.getElementById('simTax'); if (taxEl) taxEl.value = (sim.taxRate * 100).toFixed(1);
  window.dispatchEvent(new CustomEvent('motorcity:sim:ready'));
  return sim;
};
