// src/game.js
// Motor City - game.js actualizado
// - Snapping de nodos (20px)
// - A* pathfinding entre nodos
// - Visualización persistente de rutas A* por vehículo
// - startSimulation() expuesto

/* ---------- Helpers ---------- */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function id() { return 'id_' + Phaser.Math.RND.uuid(); }

/* ---------- Node & RoadSegment ---------- */
class Node {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.id = id();
    this.edges = []; // {node, seg}
    this.lockedBy = null;
    this.queue = []; // vehicles waiting with approach angle
  }
  tryReserve(vehicleId) {
    if (!this.lockedBy) { this.lockedBy = vehicleId; return true; }
    return this.lockedBy === vehicleId;
  }
  release(vehicleId) { if (this.lockedBy === vehicleId) this.lockedBy = null; }
  isFree() { return this.lockedBy === null; }
}

class RoadSegment {
  constructor(points = [], meta = {}) {
    this.points = points;
    this.meta = meta;
    this.id = id();
    this.from = null; this.to = null; // nodes (set by graph rebuild)
    this.blocked = false; // for red highlight when blocked
  }
}

/* ---------- A* (nodes) ---------- */
class AStar {
  static findPath(start, goal, costFn) {
    if (!start || !goal) return null;
    // simple A*
    const open = new Map(); const closed = new Set();
    const g = new Map(), f = new Map(), came = new Map();
    const key = n => n.id;
    g.set(start, 0); f.set(start, dist(start, goal));
    open.set(key(start), start);

    while (open.size) {
      // pick lowest f
      let current = null; let bestF = Infinity;
      for (const [k, n] of open) {
        const fn = f.get(n) ?? Infinity;
        if (fn < bestF) { bestF = fn; current = n; }
      }
      if (current === goal) {
        // reconstruct
        const path = [];
        let c = current;
        while (c) { path.unshift(c); c = came.get(c); }
        return path;
      }
      open.delete(key(current)); closed.add(current);
      for (const e of current.edges) {
        const neighbor = e.node;
        if (closed.has(neighbor)) continue;
        const from = came.get(current) || null;
        const stepCost = costFn ? costFn(from, current, neighbor, e.seg) : dist(current, neighbor);
        const tentative = (g.get(current) ?? Infinity) + stepCost;
        if (!open.has(key(neighbor))) open.set(key(neighbor), neighbor);
        if (tentative < (g.get(neighbor) ?? Infinity)) {
          came.set(neighbor, current);
          g.set(neighbor, tentative);
          f.set(neighbor, tentative + dist(neighbor, goal));
        }
      }
    }
    return null;
  }
}

/* ---------- Vehicle (con ruta y gráfico de ruta) ---------- */
class Vehicle {
  constructor(scene, segments = [], opts = {}) {
    this.scene = scene;
    this.segments = Array.isArray(segments) ? segments : [segments];
  const flat = this.flattenSegments(this.segments);
  this.pathPoints = flat.points;
  this.segmentRanges = flat.ranges; // track which points belong to each segment
  this.currentSegIdx = 0;
    this.index = 0;
    this.speed = opts.speed || (70 + Math.random() * 60);
    this.color = opts.color ?? 0xffc107;
    this.id = id();
    this.visitorId = opts.visitorId ?? null;
    this.state = 'moving'; // moving | waiting
    this.showRoute = !!opts.showRoute;
  this.waitingForNode = null;
  this.releaseNodeAtIndex = null;
    // sprite
    const p0 = this.pathPoints[0] || { x: 0, y: 0 };
    this.sprite = scene.add.rectangle(p0.x, p0.y, 12, 8, this.color).setDepth(6);
    // route graphics (persistent while active)
    this.routeGraphics = scene.add.graphics().setDepth(4);
    this.drawRoute();
    const first = this.segmentRanges[0];
    if (first && first.seg) first.seg.vehCount = (first.seg.vehCount || 0) + 1;
  }

  flattenSegments(segs) {
    const pts = [];
    const ranges = [];
    let cursor = 0;
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      if (!seg || !seg.points || seg.points.length === 0) continue;
      const arr = seg.points;
      const start = cursor;
      if (pts.length === 0) { pts.push(...arr); cursor += arr.length; }
      else {
        const last = pts[pts.length - 1];
        if (last.x === arr[0].x && last.y === arr[0].y) { pts.push(...arr.slice(1)); cursor += (arr.length - 1); }
        else { pts.push(...arr); cursor += arr.length; }
      }
      const end = cursor - 1;
      ranges.push({ seg, start, end });
    }
    return { points: pts, ranges };
  }

  drawRoute() {
    this.routeGraphics.clear();
    if (!this.showRoute) return;
    if (!this.pathPoints || this.pathPoints.length < 2) return;
    this.routeGraphics.lineStyle(3, this.color, 0.5);
    this.routeGraphics.beginPath();
    this.routeGraphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
    for (let i = 1; i < this.pathPoints.length; i++) this.routeGraphics.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
    this.routeGraphics.strokePath();
  }

  update(dt) {
    // if waiting for a node, try again to reserve
    if (this.state === 'waiting') {
      if (this.waitingForNode && this._canProceedAtNode(this.waitingForNode)) {
        this.waitingForNode.lockedBy = this.id; // take the node
        this.state = 'moving';
        // perform segment transition accounting now
        const cur = this.segmentRanges[this.currentSegIdx];
        const nxt = this.segmentRanges[this.currentSegIdx + 1];
        if (cur && nxt) {
          if (cur.seg) cur.seg.vehCount = Math.max(0, (cur.seg.vehCount || 1) - 1);
          if (nxt.seg) nxt.seg.vehCount = (nxt.seg.vehCount || 0) + 1;
          this.currentSegIdx++;
          // release this node shortly after passing first point of next segment
          this.releaseNodeAtIndex = nxt.start + 1;
        }
        this.waitingForNode = null;
      } else {
        return;
      }
    }
    if (!this.pathPoints || this.pathPoints.length < 2) return;
    if (this.index >= this.pathPoints.length - 1) return;

    const a = this.pathPoints[this.index];
    const b = this.pathPoints[this.index + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const segDist = Math.hypot(dx, dy);
    if (segDist === 0) { this.index++; return; }
    const dirx = dx / segDist, diry = dy / segDist;
    // adjust speed by congestion on current segment
    let factor = 1;
    const meta = this.segmentRanges[this.currentSegIdx];
    if (meta && meta.seg) {
      const cap = meta.seg.capacity || 6;
      const util = Math.min(1.5, (meta.seg.vehCount || 0) / cap);
      factor = Math.max(0.25, 1 - 0.6 * util);
      if (meta.seg.meta && meta.seg.meta.priority >= 3) factor *= 1.25; // autopista más rápida
    }
    const step = this.speed * factor * dt / 1000;
    const newX = this.sprite.x + dirx * step, newY = this.sprite.y + diry * step;
    this.sprite.rotation = Math.atan2(diry, dirx);
    const remainToB = Math.hypot(b.x - newX, b.y - newY);
    if (step >= Math.hypot(b.x - this.sprite.x, b.y - this.sprite.y)) {
      // moved to the point
      this.sprite.x = b.x; this.sprite.y = b.y; this.index++;
      // release reserved node if we passed the first point of next segment
      if (this.releaseNodeAtIndex !== null && this.index > this.releaseNodeAtIndex) {
        // release all nodes locked by this vehicle if any
        for (const n of this.scene.nodes) if (n.lockedBy === this.id) n.release(this.id);
        this.releaseNodeAtIndex = null;
      }
      // segment transition for congestion counts
      const cur = this.segmentRanges[this.currentSegIdx];
      if (cur && this.index > cur.end && this.currentSegIdx < this.segmentRanges.length - 1) {
        const nxtMeta = this.segmentRanges[this.currentSegIdx + 1];
        const node = nxtMeta && nxtMeta.seg ? nxtMeta.seg.from : null;
        if (node && !this._canProceedAtNode(node)) {
          // wait at intersection until free
          this.state = 'waiting';
          this.waitingForNode = node;
          // queue with approach angle for right-of-way
          const ang = Math.atan2(this.sprite.y - node.y, this.sprite.x - node.x);
          node.queue.push({ vid: this.id, angle: ang, time: this.scene.time.now });
          // keep index at end of current segment so we don't advance
          this.index = cur.end;
          return;
        }
        // reserve succeeded or no node
        if (node) node.lockedBy = this.id;
        if (cur.seg) cur.seg.vehCount = Math.max(0, (cur.seg.vehCount || 1) - 1);
        this.currentSegIdx++;
        if (nxtMeta && nxtMeta.seg) nxtMeta.seg.vehCount = (nxtMeta.seg.vehCount || 0) + 1;
        // mark release after we pass the first point of next segment
        this.releaseNodeAtIndex = nxtMeta ? nxtMeta.start + 1 : null;
      }
      // If we just reached the last point, we can mark arrival (visitor)
      if (this.index >= this.pathPoints.length - 1) {
        // arrival handled outside by Visitor check (distance to city)
      }
    } else {
      this.sprite.x = newX; this.sprite.y = newY;
    }
  }

  // Right-hand rule: if multiple vehicles wait, allow the one that has no vehicle coming from its right.
  _canProceedAtNode(node) {
    if (!node) return true;
    if (node.lockedBy && node.lockedBy !== this.id) return false;
    // limpiar obsoletos
    node.queue = node.queue.filter(q => this.scene.vehicles.find(v => v.id === q.vid));
    // si cola vacía o solo yo
    const mine = node.queue.find(q => q.vid === this.id);
    if (!node.queue.length || !mine) return node.isFree();
    // Determinar vector de entrada por vehículo usando el último segmento hacia el nodo
    const approach = (vid)=>{
      const v = this.scene.vehicles.find(o=>o.id===vid); if(!v||!v.pathPoints||v.pathPoints.length<2) return null;
      // punto actual y el siguiente (nodo)
      const idx = Math.max(0, Math.min(v.index, v.pathPoints.length-2));
      const a = v.pathPoints[idx], b = v.pathPoints[idx+1];
      return { x: b.x - a.x, y: b.y - a.y };
    };
    const rightOf = (vA, vB)=>{
      // vB está a la derecha de vA si cross(vA, vB) < 0 (regla de la mano derecha en 2D y ejes canvas)
      const cross = vA.x * vB.y - vA.y * vB.x; return cross < 0;
    };
    const myVec = approach(this.id) || {x:1,y:0};
    for (const q of node.queue){ if (q.vid===this.id) continue; const otherVec = approach(q.vid); if (!otherVec) continue; if (rightOf(myVec, otherVec)) return false; }
    // if tie, earliest waiting time first
    const earliest = node.queue.reduce((a,b)=> a.time < b.time ? a : b);
    return earliest.vid === this.id;
  }

  destroy() {
    const cur = this.segmentRanges ? this.segmentRanges[this.currentSegIdx] : null;
    if (cur && cur.seg) cur.seg.vehCount = Math.max(0, (cur.seg.vehCount || 1) - 1);
    // release any node lock
    for (const n of this.scene.nodes) if (n.lockedBy === this.id) n.release(this.id);
    if (this.sprite) this.sprite.destroy();
    if (this.routeGraphics) this.routeGraphics.destroy();
  }
}

/* ---------- Spawner (ciudades y casas) ---------- */
class Spawner {
  constructor(scene) {
    this.scene = scene;
    this.colors = ['yellow', 'red', 'blue', 'green'];
    this.cities = []; this.houses = [];
    this.lastCity = null;
  }
  colorToHex(name) {
    return { yellow: 0xfff176, red: 0xef5350, blue: 0x64b5f6, green: 0x81c784 }[name] || 0xffffff;
  }
  makeCity(x, y, color = null) {
    const c = color || Phaser.Utils.Array.GetRandom(this.colors);
    const city = { id: id(), x, y, color: c };
    this.cities.push(city);
    // interactive marker
    const circle = this.scene.add.circle(x, y, 18, this.colorToHex(c), 0.9).setDepth(3).setInteractive({ useHandCursor: true });
    circle.on('pointerdown', () => {
      this.scene.selectedCityColor = c;
      this.scene.flashMessage(`Ciudad seleccionada (${c})`);
    });
    this.scene.add.text(x - 16, y - 28, 'Ciudad', { fontSize: 10 }).setDepth(4);
  // conectar a carretera
  this.scene._connectBuildingToRoad({x,y});
    // also spawn nearby houses for this and previous city color (if different)
    const spawnAround = (col) => {
      for (let i=0;i<2;i++) {
        const nx = x + Phaser.Math.Between(-160, 160);
        const ny = y + Phaser.Math.Between(-120, 120);
        this.makeHouse(nx, ny, col);
      }
    };
    spawnAround(c);
    if (this.lastCity && this.lastCity.color !== c) spawnAround(this.lastCity.color);
    this.lastCity = city;
    return city;
  }
  makeHouse(x, y, color = null) {
    const c = color || Phaser.Utils.Array.GetRandom(this.colors);
    const house = { id: id(), x, y, color: c };
    this.houses.push(house);
    this.scene.add.rectangle(x, y, 14, 12, this.colorToHex(c)).setDepth(3);
    this.scene._connectBuildingToRoad({x,y});
    return house;
  }
}

/* ---------- Visitor ---------- */
class Visitor {
  constructor(scene, house, city, timeLimit = 120) {
    this.scene = scene; this.house = house; this.city = city; this.timeLeft = timeLimit; this.id = id();
    // plan nodes -> segments -> vehicle
    const startNode = scene.findNearestNode(house.x, house.y);
    const endNode = scene.findNearestNode(city.x, city.y);
    this.vehicle = null;
    if (startNode && endNode) {
      const nodePath = scene.findPathNodes(startNode, endNode);
      if (nodePath) {
        const segPath = scene.nodePathToSegments(nodePath);
        if (segPath.length) {
          this.vehicle = new Vehicle(scene, segPath, { color: scene.spawner.colorToHex(house.color), visitorId: this.id });
          scene.vehicles.push(this.vehicle);
        }
      }
    }
  }
  update(dt) {
    this.timeLeft -= dt / 1000;
    if (this.timeLeft <= 0) { this.scene.onVisitorFailed(this); return; }
    // if vehicle exists, check arrival proximity to city
    if (this.vehicle) {
      const pos = { x: this.vehicle.sprite.x, y: this.vehicle.sprite.y };
      if (dist(pos, { x: this.city.x, y: this.city.y }) < 22) this.scene.onVisitorArrived(this);
    }
  }
}

/* ---------- MainScene ---------- */
class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.roadSegments = [];
    this.nodes = []; // graph nodes
    this.edgeByNodes = new Map(); // oriented edge key -> segment
    this.vehicles = [];
    this.visitors = [];
    this.spawner = null;
    this.graphics = null;
    this.placeMode = true; // legacy flag (kept for UI compatibility)
    this.placeTool = 'road'; // 'road' | 'city' | 'house' | 'none'
    this.isDrawing = false;
    this.currentPoints = [];
    this.oneWayMode = false;
    this.selectedCityColor = null;
  this.roadLanes = 1; // UI-configurable
  this.roadPriority = 1; // UI-configurable
  this.showTrafficParticles = false;
    this.grid = 32; // snap grid for roads
    this.currentTool = 'road'; // for bottom bar
  this.waterRects = [];
  this.decor = []; // {type:'door'|'forest'|'lake', x,y}
    this.week = 1; this.dayIndex = 0; this.days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    this.dayMs = 15000; // 15s per day
    this.midWeekTriggered = false;
    this.score = 0;
    this.failedVisits = 0;
    this.gameOver = false;
    this.showPollution = false;
    this.pollution = []; // {x,y,value}
    this._pollutionAccum = 0;
  }

  preload() {}

  create() {
    this.graphics = this.add.graphics();
    this.spawner = new Spawner(this);
    window.MC = this;

    // input: pointer for tools
    this.input.on('pointerdown', p => {
      if (this.isPointerOverUI(p)) return;
      if (!this.placeMode) return;
      if (this.placeTool === 'road') {
        this.isDrawing = true;
        const pt = this._snapPoint({ x: p.worldX, y: p.worldY });
        this.currentPoints = [pt];
        // drag-to-paint: if highway/bridge/road tools, we keep snapping points as you drag
      } else if (this.placeTool === 'city') {
        const safe = this.clampToSafeArea(p.worldX, p.worldY);
        const city = this.spawner.makeCity(safe.x, safe.y);
        this.selectedCityColor = city.color;
      } else if (this.placeTool === 'house') {
        const color = this.selectedCityColor || (this.spawner.cities[0]?.color);
        const safe = this.clampToSafeArea(p.worldX, p.worldY);
        this.spawner.makeHouse(safe.x, safe.y, color || 'yellow');
      } else if (this.currentTool === 'forest') {
        const s = this._snapPoint({ x: p.worldX, y: p.worldY });
        this._placeForest(s.x, s.y);
      } else if (this.currentTool === 'lake') {
        const s = this._snapPoint({ x: p.worldX, y: p.worldY });
        this._placeLake(s.x, s.y);
      } else if (this.currentTool === 'roundabout') {
        const s = this._snapPoint({ x: p.worldX, y: p.worldY });
        this._placeRoundabout(s);
      } else if (this.currentTool === 'door') {
        const s = this._snapPoint({ x: p.worldX, y: p.worldY });
        this.decor.push({ type: 'door', x: s.x, y: s.y });
      } else if (this.currentTool === 'bulldozer') {
        const s = this._snapPoint({ x: p.worldX, y: p.worldY });
        this._bulldozeAt(s.x, s.y);
      }
    });
    this.input.on('pointermove', p => {
      if (!this.isDrawing) return;
      const last = this.currentPoints[this.currentPoints.length - 1];
      const sp = this._snapPoint({ x: p.worldX, y: p.worldY });
      const dx = sp.x - last.x, dy = sp.y - last.y;
      if (dx * dx + dy * dy > 8 * 8) this.currentPoints.push(sp);
      // ensure snapped points along axis steps (grid roads)
      const lp = this.currentPoints[this.currentPoints.length - 1];
      this.currentPoints[this.currentPoints.length - 1] = this._snapPoint(lp);
    });
    this.input.on('pointerup', p => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.currentPoints.length < 2) { this.currentPoints = []; return; }
      // snapping: if start or end close to existing node, snap coords
      const startPt = this.currentPoints[0], endPt = this.currentPoints[this.currentPoints.length - 1];
      const snapTolerancePx = 20;
      const snapToNode = (pt) => {
        let nearest = null, bd = snapTolerancePx;
        for (const n of this.nodes) {
          const d = dist(pt, { x: n.x, y: n.y });
          if (d < bd) { bd = d; nearest = n; }
        }
        return nearest;
      };
      const snapStart = snapToNode(startPt);
      const snapEnd = snapToNode(endPt);
      if (snapStart) { this.currentPoints[0] = { x: snapStart.x, y: snapStart.y }; }
      if (snapEnd) { this.currentPoints[this.currentPoints.length - 1] = { x: snapEnd.x, y: snapEnd.y }; }

      // create segment and add
      // orthogonalize path to nearest axis-aligned steps
  const snapped = this._orthogonalize(this.currentPoints);
      // if crosses water and not building a bridge, block
      const crossesWater = this.segmentIntersectsWater(snapped);
      const meta = { oneWay: this.oneWayMode, lanes: this.roadLanes, priority: this.roadPriority };
      if (this.currentTool === 'highway') { meta.lanes = Math.max(meta.lanes, 3); meta.priority = Math.max(meta.priority, 3); }
      if (crossesWater && this.currentTool !== 'bridge') {
        this.flashMessage('Necesitas Puente para cruzar el río');
        this.currentPoints = [];
        return;
      }
      if (this.currentTool === 'bridge') meta.bridge = true;
      const seg = new RoadSegment(snapped, meta);
      this.roadSegments.push(seg);

      // rebuild graph with intersection splitting
      this.rebuildGraph();

      // redraw
      this.currentPoints = [];
      this.redraw();
    });

    // Expose startSimulation hook: create world, start timers
    window.startSimulation = (mapType = 'llanura') => {
      this.startSimulation(mapType);
    };

    // schedule UI updates
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.updateUI() });
  }

  startSimulation(mapType = 'llanura') {
    // a bit of world generation depending on mapType (placeholder)
    this.generateMapBackground(mapType);

    // spawn initial city & houses in a centered safe area
    if (this.spawner.cities.length === 0) {
      const center = this.getCenteredSafePoint();
      const c = this.spawner.makeCity(center.x, center.y);
      this.spawner.makeHouse(center.x + 160, center.y + 60, c.color);
      this.spawner.makeHouse(center.x - 160, center.y + 60, c.color);
    }

    // day/week timer (15s per day)
    this.time.addEvent({ delay: this.dayMs, loop: true, callback: () => this._advanceDay() });

    // spawn random traffic occasionally
    this.time.addEvent({ delay: 2500, loop: true, callback: () => this.spawnRandomTraffic() });

    // spawn visitors (houses emit) occasionally
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.maybeSpawnVisitors() });
  }

  generateMapBackground(mapType) {
    // basic background draw with river/coast shapes (kept minimal)
    this.graphics.clear();
    this.waterRects = [];
    if (mapType === 'rios') {
      const x = this.scale.width * 0.42, w = this.scale.width * 0.12;
      this.graphics.fillStyle(0x1565c0, 1); this.graphics.fillRect(x, 0, w, this.scale.height);
      this.waterRects.push({ x, y: 0, w, h: this.scale.height });
    } else if (mapType === 'costas') {
      const h = 110; this.graphics.fillStyle(0x0d47a1, 1); this.graphics.fillRect(0, this.scale.height - h, this.scale.width, h);
      const x = this.scale.width * 0.46, w = this.scale.width * 0.08; this.graphics.fillStyle(0x1565c0, 1); this.graphics.fillRect(x, 0, w, this.scale.height);
      this.waterRects.push({ x: 0, y: this.scale.height - h, w: this.scale.width, h });
      this.waterRects.push({ x, y: 0, w, h: this.scale.height });
    } else {
      this.graphics.clear(); // llanura = clear
    }
    this.redraw();
  }

  _advanceDay() {
    this.dayIndex++;
    if (this.dayIndex > 5) { this.dayIndex = 0; this.week++; this.onWeekEnd(); }
    else {
      if (this.dayIndex === 3 && !this.midWeekTriggered) {
        this.midWeekTriggered = true;
        const cx = Phaser.Math.Between(160, this.scale.width - 160);
        const cy = Phaser.Math.Between(120, this.scale.height - 160);
        this.spawner.makeCity(cx, cy);
      }
    }
    this.updateUI();
  }

  onWeekEnd() {
    this.midWeekTriggered = false;
    // spawn some houses near roads
    const count = Math.max(1, Math.floor(this.roadSegments.length / 2));
    for (let i = 0; i < count; i++) {
      if (!this.roadSegments.length) break;
      const s = Phaser.Utils.Array.GetRandom(this.roadSegments);
      const p = s.points[Math.floor(s.points.length / 2)];
      const nx = p.x + Phaser.Math.Between(-80, 80), ny = p.y + Phaser.Math.Between(-80, 80);
      let color = null;
      if (this.spawner.cities.length) color = Phaser.Utils.Array.GetRandom(this.spawner.cities).color;
      this.spawner.makeHouse(nx, ny, color);
    }
    if (window.onWeekCompleted) window.onWeekCompleted(this.week);
    // show weekly upgrade choice (UI will display panel)
    window.dispatchEvent(new CustomEvent('motorcity:week:choice'));
  }

  /* ---------- Graph (nodes) ---------- */
  rebuildGraph() {
    // 1) split segments at intersections (insert points)
    this.splitAllIntersections();

    // 2) build nodes for ALL vertices with snapping, then edges between consecutive vertices
    const map = new Map();
    const snapKey = p => `${Math.round(p.x / 6)}_${Math.round(p.y / 6)}`; // slightly tighter grid
    const ensureNode = (pt) => {
      const k = snapKey(pt);
      let n = map.get(k);
      if (!n) { n = new Node(pt.x, pt.y); map.set(k, n); }
      return n;
    };

    // reset
    this.edgeByNodes.clear();

    // walk each segment polyline
    for (const seg of this.roadSegments) {
      let prevNode = null;
      for (let i = 0; i < seg.points.length; i++) {
        const n = ensureNode(seg.points[i]);
        if (i === 0) seg.from = n; // first vertex
        if (i === seg.points.length - 1) seg.to = n; // last vertex
        if (prevNode && prevNode !== n) {
          // connect prevNode -> n; consider oneWay
          const keyAB = `${prevNode.id}>${n.id}`;
          const keyBA = `${n.id}>${prevNode.id}`;
          prevNode.edges.push({ node: n, seg });
          this.edgeByNodes.set(keyAB, seg);
          if (!seg.meta || !seg.meta.oneWay) {
            n.edges.push({ node: prevNode, seg });
            this.edgeByNodes.set(keyBA, seg);
          }
        }
        prevNode = n;
      }
      // compute rough capacity by length and lanes
      const length = this.polylineLength(seg.points);
      const lanes = (seg.meta && seg.meta.lanes) ? seg.meta.lanes : 1;
      seg.capacity = Math.max(4, Math.floor(length / 120)) * lanes;
      seg.vehCount = seg.vehCount || 0;
    }

    this.nodes = Array.from(map.values());
  }

  polylineLength(pts) { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y); return L; }

  // Line segment intersection helper
  lineIntersect(p, p2, q, q2) {
    const r = { x: p2.x - p.x, y: p2.y - p.y };
    const s = { x: q2.x - q.x, y: q2.y - q.y };
    const rxs = r.x * s.y - r.y * s.x;
    const q_p = { x: q.x - p.x, y: q.y - p.y };
    const qpxr = q_p.x * r.y - q_p.y * r.x;
    if (Math.abs(rxs) < 1e-6 && Math.abs(qpxr) < 1e-6) return null; // colineal o paralela: ignorar
    if (Math.abs(rxs) < 1e-6) return null; // paralela
    const t = (q_p.x * s.y - q_p.y * s.x) / rxs;
    const u = (q_p.x * r.y - q_p.y * r.x) / rxs;
    if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
      return { x: p.x + t * r.x, y: p.y + t * r.y, t, u };
    }
    return null;
  }

  // Insert intersection points into segment polylines
  splitAllIntersections() {
    const eps2 = 1; // squared epsilon
    const insertPoint = (seg, ins, atIndex) => {
      // avoid duplicates
      const pts = seg.points;
      for (const pt of pts) { if ((pt.x - ins.x) * (pt.x - ins.x) + (pt.y - ins.y) * (pt.y - ins.y) < eps2) return; }
      // insert keeping order: place after atIndex
      pts.splice(atIndex + 1, 0, { x: ins.x, y: ins.y });
    };
    for (let i = 0; i < this.roadSegments.length; i++) {
      const A = this.roadSegments[i];
      for (let j = i + 1; j < this.roadSegments.length; j++) {
        const B = this.roadSegments[j];
        // check all subsegments
        for (let ai = 0; ai < A.points.length - 1; ai++) {
          const a1 = A.points[ai], a2 = A.points[ai + 1];
          for (let bi = 0; bi < B.points.length - 1; bi++) {
            const b1 = B.points[bi], b2 = B.points[bi + 1];
            const hit = this.lineIntersect(a1, a2, b1, b2);
            if (hit) {
              insertPoint(A, hit, ai);
              insertPoint(B, hit, bi);
              // advance indices to skip the inserted points on next loops
              ai++; bi++;
            }
          }
        }
      }
    }
  }

  findNearestNode(x, y) {
    if (!this.nodes.length) return null;
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      const d = dist(n, { x, y }); if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  findPathNodes(startNode, endNode) {
    const costFn = (from, cur, nxt, seg) => {
      const base = dist(cur, nxt);
      let penalty = 0;
      if (from) {
        const v1 = { x: cur.x - from.x, y: cur.y - from.y };
        const v2 = { x: nxt.x - cur.x, y: nxt.y - cur.y };
        const dot = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) + 1e-6);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
        const severity = angle / Math.PI; // 0..1
        penalty += base * Math.pow(severity, 1.5) * 0.6; // penaliza giros cerrados
      }
      const lanes = (seg && seg.meta && seg.meta.lanes) ? seg.meta.lanes : 1;
      const priority = (seg && seg.meta && seg.meta.priority) ? seg.meta.priority : 1;
      const lanesFactor = 1 / Math.max(1, lanes);
      const priorityFactor = 1 / Math.max(1, priority);
      return base * (0.7 * lanesFactor + 0.3 * priorityFactor) + penalty;
    };
    return AStar.findPath(startNode, endNode, costFn);
  }

  nodePathToSegments(nodePath) {
    const segs = [];
    for (let i = 0; i < nodePath.length - 1; i++) {
      const a = nodePath[i], b = nodePath[i + 1];
      const seg = this.edgeByNodes.get(`${a.id}>${b.id}`) || this.edgeByNodes.get(`${b.id}>${a.id}`);
      if (seg) segs.push(seg);
    }
    return segs;
  }

  findNearestSegment(x, y) {
    if (!this.roadSegments.length) return null;
    let best = null, bd = Infinity;
    for (const seg of this.roadSegments) {
      const pts = seg.points || [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const vx = b.x - a.x, vy = b.y - a.y;
        const wx = x - a.x, wy = y - a.y;
        const c1 = vx * wx + vy * wy, c2 = vx * vx + vy * vy;
        let t = c2 > 0 ? c1 / c2 : 0; t = Math.max(0, Math.min(1, t));
        const px = a.x + t * vx, py = a.y + t * vy;
        const d2 = (px - x) * (px - x) + (py - y) * (py - y);
        if (d2 < bd) { bd = d2; best = seg; }
      }
    }
    return best;
  }

  /* ---------- Traffic spawn ---------- */
  spawnRandomTraffic() {
    if (this.gameOver) return;
    if (this.nodes.length < 2) return;
    const start = Phaser.Utils.Array.GetRandom(this.nodes);
    let end = Phaser.Utils.Array.GetRandom(this.nodes);
    if (end === start && this.nodes.length > 1) end = this.nodes[(this.nodes.indexOf(start) + 1) % this.nodes.length];
    const nodePath = this.findPathNodes(start, end);
    if (!nodePath) return;
    const segs = this.nodePathToSegments(nodePath);
    if (!segs.length) return;
    const v = new Vehicle(this, segs, { color: 0x90caf9, speed: 50 + Math.random() * 60, showRoute: false });
    this.vehicles.push(v);
  }

  maybeSpawnVisitors() {
    if (this.gameOver) return;
    if (!this.spawner.houses.length || !this.spawner.cities.length) return;
    for (const h of this.spawner.houses) {
      if (Math.random() < 0.05) this.spawnVisitorFromHouse(h);
    }
  }

  spawnVisitorFromHouse(house) {
    const cities = this.spawner.cities.filter(c => c.color === house.color);
    if (!cities.length) return;
    const city = Phaser.Utils.Array.GetRandom(cities);
    const startNode = this.findNearestNode(house.x, house.y);
    const endNode = this.findNearestNode(city.x, city.y);
    if (!startNode || !endNode) return;
    const nodePath = this.findPathNodes(startNode, endNode);
    if (!nodePath) return;
    const segs = this.nodePathToSegments(nodePath);
    if (!segs.length) return;
    const visitor = new Visitor(this, house, city, 120);
    if (visitor.vehicle) this.visitors.push(visitor);
  }

  /* ---------- Visitors handling ---------- */
  onVisitorFailed(visitor) {
    if (this.gameOver) return;
    if (visitor.vehicle) { visitor.vehicle.destroy(); const i = this.vehicles.indexOf(visitor.vehicle); if (i >= 0) this.vehicles.splice(i, 1); }
    const idx = this.visitors.indexOf(visitor); if (idx >= 0) this.visitors.splice(idx, 1);
    this.failedVisits++;
    const alerts = document.getElementById('alerts'); if (alerts) alerts.textContent = `Visita perdida (${this.failedVisits}/8)`;
    if (this.failedVisits >= 8) this._endGame();
  }

  onVisitorArrived(visitor) {
    this.score += 10;
    if (visitor.vehicle) { visitor.vehicle.destroy(); const i = this.vehicles.indexOf(visitor.vehicle); if (i >= 0) this.vehicles.splice(i, 1); }
    const idx = this.visitors.indexOf(visitor); if (idx >= 0) this.visitors.splice(idx, 1);
    const alerts = document.getElementById('alerts'); if (alerts) alerts.textContent = 'Visita completada +10';
  }

  /* ---------- Update & draw ---------- */
  update(time, delta) {
    // redraw background + roads + nodes + current drawline
    this.redraw();

    // vehicles update
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      v.update(delta);
      // basic removal if sprite inactive
      if (!v.sprite.active) { v.destroy(); this.vehicles.splice(i, 1); }
    }

    // visitors
    for (let i = this.visitors.length - 1; i >= 0; i--) this.visitors[i].update(delta);

    // clear blocked segments if destination node freed
    for (const seg of this.roadSegments) {
      if (seg.blocked) {
        const node = seg.to;
        if (node && node.isFree()) { seg.blocked = false; for (const v of this.vehicles) if (v.state === 'waiting' && v.pathPoints && v.pathPoints.length && v.pathPoints[0]) v.resume && v.resume(); }
      }
    }

    this.updateUI();

    // contaminación por tráfico: acumular cada ~800ms puntos en tramos con coches
    this._pollutionAccum += delta;
    if (this._pollutionAccum > 800) {
      this._pollutionAccum = 0;
      for (const seg of this.roadSegments) {
        const count = seg.vehCount || 0; if (count <= 0) continue;
        const pts = seg.points; if (!pts || pts.length < 2) continue;
        const add = Math.min(3, Math.max(1, Math.floor(count / 3)));
        for (let k=0;k<add;k++) {
          const i = Math.floor(Math.random() * (pts.length - 1));
          const a = pts[i], b = pts[i+1]; const t = Math.random();
          const x = a.x + (b.x - a.x) * t; const y = a.y + (b.y - a.y) * t;
          this.pollution.push({ x, y, value: 1.5 });
        }
      }
    }
    // decaimiento de contaminación
    if (this.pollution.length) {
      for (const p of this.pollution) p.value *= 0.985; // decae lentamente
      this.pollution = this.pollution.filter(p => p.value > 0.15);
    }
  }

  redraw() {
    // clear & draw base map (if any background drawn earlier, keep)
    this.graphics.clear();

    // draw water rects (rivers/coasts/lakes) before roads
    if (this.waterRects && this.waterRects.length) {
      this.graphics.fillStyle(0x1565c0, 1);
      for (const r of this.waterRects) this.graphics.fillRect(r.x, r.y, r.w, r.h);
    }

  // draw roads
    for (const seg of this.roadSegments) {
      const color = seg.blocked ? 0xef5350 : 0x7fb3ff;
      const lanes = (seg.meta && seg.meta.lanes) ? seg.meta.lanes : 1;
      const base = (seg.meta && seg.meta.oneWay) ? 6 : 10;
      const width = base + Math.max(0, lanes - 1) * 4;
      // highways: distinct color
      const isHighway = seg.meta && seg.meta.priority >= 3;
      this.graphics.lineStyle(width, isHighway ? 0xffd54f : color, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(seg.points[0].x, seg.points[0].y);
      for (let i = 1; i < seg.points.length; i++) this.graphics.lineTo(seg.points[i].x, seg.points[i].y);
      this.graphics.strokePath();
      // dashed center for highways
      if (isHighway) {
        this.graphics.lineStyle(Math.max(2, width*0.15), 0xffffff, 0.6);
        for (let i=0;i<seg.points.length-1;i++){
          const a = seg.points[i], b = seg.points[i+1];
          const steps = 8; // draw small dashes
          for (let t=0;t<1;t+=1/steps){
            if (Math.floor(t*steps)%2===0){
              const x1 = a.x + (b.x - a.x)*t;
              const y1 = a.y + (b.y - a.y)*t;
              const x2 = a.x + (b.x - a.x)*(t+0.04);
              const y2 = a.y + (b.y - a.y)*(t+0.04);
              this.graphics.beginPath();
              this.graphics.moveTo(x1,y1);
              this.graphics.lineTo(x2,y2);
              this.graphics.strokePath();
            }
          }
        }
      }
      // draw arrow if oneWay
      if (seg.meta && seg.meta.oneWay) {
        const a = seg.points[seg.points.length - 2], b = seg.points[seg.points.length - 1];
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const cx = b.x - Math.cos(angle) * 12, cy = b.y - Math.sin(angle) * 12;
        const size = Math.max(6, Math.floor(width * 0.5));
        const leftAngle = angle + Math.PI * 0.5, rightAngle = angle - Math.PI * 0.5;
        const p2x = cx + Math.cos(leftAngle) * size, p2y = cy + Math.sin(leftAngle) * size;
        const p3x = cx + Math.cos(rightAngle) * size, p3y = cy + Math.sin(rightAngle) * size;
        this.graphics.fillStyle(0xffffff, 1);
        this.graphics.fillTriangle(b.x, b.y, p2x, p2y, p3x, p3y);
      }
      // congestion overlay
      const util = seg.capacity ? Math.min(1, (seg.vehCount || 0) / seg.capacity) : 0;
      if (util > 0) {
        const col = util < 0.5 ? 0xffeb3b : util < 0.75 ? 0xff9800 : 0xf44336;
        this.graphics.lineStyle(Math.max(2, width * 0.4), col, 0.35 + 0.25 * util);
        this.graphics.beginPath();
        this.graphics.moveTo(seg.points[0].x, seg.points[0].y);
        for (let i = 1; i < seg.points.length; i++) this.graphics.lineTo(seg.points[i].x, seg.points[i].y);
        this.graphics.strokePath();
      }
      // traffic particles (simple dots scaled by utilization)
      if (this.showTrafficParticles && seg.capacity) {
        const util = Math.min(1, (seg.vehCount || 0) / seg.capacity);
        const dotCount = Math.round(util * 12);
        if (dotCount > 0) {
          this.graphics.fillStyle(0x90caf9, 0.5);
          for (let d = 0; d < dotCount; d++) {
            // pick a random point along the polyline
            const idx = Math.floor(Math.random() * (seg.points.length - 1));
            const a = seg.points[idx], b = seg.points[idx + 1];
            const t = Math.random();
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            this.graphics.fillCircle(x, y, 1.8);
          }
        }
      }
    }

  // overlay de contaminación (si está activado)
    if (this.showPollution && this.pollution.length) {
      for (const p of this.pollution) {
        const r = Math.max(12, p.value * 14);
        this.graphics.fillStyle(0xff7043, 0.06);
        this.graphics.fillCircle(p.x, p.y, r);
      }
    }

  // draw nodes
  this.graphics.fillStyle(0xffffff, 1);
  for (const n of this.nodes) this.graphics.fillCircle(n.x, n.y, 3);

    // draw decor (doors as placeholders)
    for (const d of this.decor) {
      if (d.type === 'door') {
        this.graphics.lineStyle(2, 0xfff59d, 1);
        this.graphics.strokeRect(d.x - this.grid/2, d.y - this.grid/2, this.grid, this.grid);
      }
    }

    // draw current in-progress line if any
    if (this.isDrawing && this.currentPoints && this.currentPoints.length > 1) {
      // width preview based on lanes
  const base = 10;
      const add = (this.roadLanes - 1) * 4;
      const width = Math.max(6, base + add);
      this.graphics.lineStyle(width, 0xffffff, 0.9);
      this.graphics.beginPath();
      this.graphics.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
      for (let i = 1; i < this.currentPoints.length; i++) this.graphics.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
      this.graphics.strokePath();
      // arrow preview if one-way
      if (this.oneWayMode && this.currentPoints.length >= 2) {
        const a = this.currentPoints[this.currentPoints.length - 2];
        const b = this.currentPoints[this.currentPoints.length - 1];
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const cx = b.x - Math.cos(angle) * 12, cy = b.y - Math.sin(angle) * 12;
        const size = 6;
        const leftAngle = angle + Math.PI * 0.5, rightAngle = angle - Math.PI * 0.5;
        const p2x = cx + Math.cos(leftAngle) * size, p2y = cy + Math.sin(leftAngle) * size;
        const p3x = cx + Math.cos(rightAngle) * size, p3y = cy + Math.sin(rightAngle) * size;
        this.graphics.fillStyle(0xffffff, 0.9);
        this.graphics.fillTriangle(b.x, b.y, p2x, p2y, p3x, p3y);
      }
    }
  }

  updateUI() {
    const elTime = document.getElementById('time'); if (elTime) elTime.textContent = `Semana ${this.week} — Día: ${this.days[this.dayIndex]}`;
    const elV = document.getElementById('vehiclesCount'); if (elV) elV.textContent = 'Autos: ' + this.vehicles.length;
    const elVis = document.getElementById('visitorsCount'); if (elVis) elVis.textContent = 'Visitas activas: ' + this.visitors.length;
    const elScore = document.getElementById('score'); if (elScore) elScore.textContent = 'Puntaje: ' + this.score;
    const alerts = document.getElementById('alerts'); if (alerts && this.gameOver) alerts.textContent = 'Juego terminado: demasiadas visitas fallidas';
  }

  /* Persistence hooks left as previously implemented in your ui.js (save/load) */

  /* ---------- UI helpers for existing buttons ---------- */
  toggleOneWay() { this.oneWayMode = !this.oneWayMode; return this.oneWayMode; }
  togglePlaceMode() {
    this.placeMode = !this.placeMode; // keep compatibility
    // also rotate tools: road <-> none
    this.placeTool = this.placeMode ? 'road' : 'none';
  }
  setTool(t) { this.currentTool = t; if (t==='road' || t==='bridge' || t==='highway' || t==='roundabout') { this.placeMode = true; this.placeTool='road'; } }
  advanceWeek() { this.onWeekEnd(); this.week++; this.updateUI(); }
  preparePlaceCity() { this.placeMode = true; this.placeTool = 'city'; }
  preparePlaceHouseOfSelected() { this.placeMode = true; this.placeTool = 'house'; }

  flashMessage(msg) {
    const el = document.getElementById('alerts'); if (!el) return;
    el.style.color = '#a5d6a7';
    el.textContent = msg;
    this.time.delayedCall(1200, () => { if (el) el.textContent = ''; });
  }

  async saveToFirestore() {
    // Fallback simple localStorage snapshot (avoid firebase complexity here)
    const data = {
      week: this.week, dayIndex: this.dayIndex, score: this.score,
      segments: this.roadSegments.map(s => ({ points: s.points, meta: s.meta })),
      cities: this.spawner.cities, houses: this.spawner.houses,
      decor: this.decor,
      waterRects: this.waterRects || [],
      unlocks: {
        highway: true, // reflect UI unlock state if you add it later
        roundabout: true,
        bridge: true
      }
    };
    localStorage.setItem('motorcity-save', JSON.stringify(data));
  }
  async loadLastSave() {
    const raw = localStorage.getItem('motorcity-save'); if (!raw) return false;
    const data = JSON.parse(raw);
    this.week = data.week ?? 1; this.dayIndex = data.dayIndex ?? 0; this.score = data.score ?? 0;
    this.roadSegments = (data.segments || []).map(s => new RoadSegment(s.points, s.meta));
    // clear previous graphics objects for cities/houses not tracked — we keep simple redraw
    this.spawner.cities = []; this.spawner.houses = [];
    for (const c of data.cities || []) this.spawner.makeCity(c.x, c.y, c.color);
    for (const h of data.houses || []) this.spawner.makeHouse(h.x, h.y, h.color);
    this.decor = data.decor || [];
    this.waterRects = data.waterRects || [];
    this.rebuildGraph(); this.redraw(); this.updateUI();
    return true;
  }

  // ----- UI Exclusion & Safe Area -----
  isPointerOverUI(pointer) {
    const el = document.getElementById('ui');
    if (!el || !pointer || !pointer.event) return false;
    const r = el.getBoundingClientRect();
    const x = pointer.event.clientX; const y = pointer.event.clientY;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  getSafeBuildBounds(margin = 8) {
    const el = document.getElementById('ui');
    const w = this.scale.width, h = this.scale.height;
    if (!el) return { left: margin, top: margin, right: w - margin, bottom: h - margin };
    const r = el.getBoundingClientRect();
    const left = Math.min(w - margin - 260, r.right + margin); // wider no-build area to avoid menu
    return { left, top: margin, right: w - margin, bottom: h - margin };
  }
  getCenteredSafePoint() { const b = this.getSafeBuildBounds(); return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }; }
  clampToSafeArea(x, y) { const b = this.getSafeBuildBounds(); return { x: Phaser.Math.Clamp(x, b.left, b.right), y: Phaser.Math.Clamp(y, b.top, b.bottom) }; }

  // ---- Grid helpers & environment ----
  _snapPoint(pt) { return { x: Math.round(pt.x / this.grid) * this.grid, y: Math.round(pt.y / this.grid) * this.grid }; }
  _orthogonalize(points) {
    if (!points || points.length < 2) return points;
    const out = [this._snapPoint(points[0])];
    for (let i = 1; i < points.length; i++) {
      const prev = out[out.length - 1];
      const p = this._snapPoint(points[i]);
      const dx = Math.abs(p.x - prev.x), dy = Math.abs(p.y - prev.y);
      if (dx && dy) {
        // pick the dominant axis step first
        if (dx > dy) out.push({ x: p.x, y: prev.y });
        else out.push({ x: prev.x, y: p.y });
      }
      out.push(p);
    }
    // remove duplicates
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i].x === out[i+1].x && out[i].y === out[i+1].y) out.splice(i+1,1);
    }
    return out;
  }
  _placeForest(x, y) {
    // simple visual: cluster of small green squares
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x2e7d32, 0.8);
    for (let i=0;i<8;i++) g.fillRect(x + (Math.random()*this.grid - this.grid/2), y + (Math.random()*this.grid - this.grid/2), 6, 6);
    this.decor.push({ type: 'forest', x, y });
  }
  _placeLake(x, y) {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x1565c0, 0.8);
    g.fillCircle(x, y, this.grid);
    this.decor.push({ type: 'lake', x, y });
    // tratar lago como agua bloqueante
    const r = this.grid; this.waterRects = this.waterRects || []; this.waterRects.push({ x: x - r, y: y - r, w: r*2, h: r*2 });
  }
  _bulldozeAt(x, y) {
    // remove nearest road segment point cluster or decor nearby
    const rad = this.grid;
    const within = (px,py)=> Math.hypot(px-x,py-y) < rad;
    // remove road segments that have a vertex within radius
    for (let i=this.roadSegments.length-1;i>=0;i--) {
      const s = this.roadSegments[i];
      if ((s.points||[]).some(p=>within(p.x,p.y))) this.roadSegments.splice(i,1);
    }
    // remove decor near
    this.decor = this.decor.filter(d=>!within(d.x,d.y));
    this.rebuildGraph();
  }
  _placeRoundabout(center) {
    // create a small square loop approximating a roundabout
    const r = this.grid * 1.5;
    const pts = [
      {x:center.x - r, y:center.y - r},
      {x:center.x + r, y:center.y - r},
      {x:center.x + r, y:center.y + r},
      {x:center.x - r, y:center.y + r},
      {x:center.x - r, y:center.y - r}
    ].map(p=>this._snapPoint(p));
    const seg = new RoadSegment(pts, { oneWay: true, lanes: 1, priority: 2 });
    this.roadSegments.push(seg);
    // auto-connect: find nearby segment endpoints and create short connectors to nearest roundabout side
    const corners = pts.slice(0,4);
    const sides = [
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[3]],
      [corners[3], corners[0]],
    ];
    const projectToSide = (p, a, b)=>{
      const abx=b.x-a.x, aby=b.y-a.y; const apx=p.x-a.x, apy=p.y-a.y; const t = Math.max(0, Math.min(1, (apx*abx+apy*aby)/(abx*abx+aby*aby||1))); return {x:a.x+abx*t,y:a.y+aby*t};
    };
    const endpoints = [];
    for (const s of this.roadSegments) {
      if (s===seg) continue;
      endpoints.push(s.points[0], s.points[s.points.length-1]);
    }
    for (const p of endpoints) {
      if (Math.hypot(p.x-center.x, p.y-center.y) > r*2.5) continue;
      // connect to closest side
      let best=null, bd=Infinity, hit=null;
      for (const [a,b] of sides){ const q=projectToSide(p,a,b); const d=Math.hypot(p.x-q.x,p.y-q.y); if(d<bd){bd=d; best=[a,b]; hit=q;} }
      if (best && hit && bd>this.grid*0.5){
        const path=[this._snapPoint(p), this._snapPoint(hit)];
        this.roadSegments.push(new RoadSegment(path, { oneWay:false, lanes:1, priority:1 }));
      }
    }
    this.rebuildGraph();
  }

  segmentIntersectsWater(pts) {
    if (!this.waterRects || !this.waterRects.length || !pts || pts.length < 2) return false;
    const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    const segIntRect = (a, b, r) => {
      if (inside(a, r) || inside(b, r)) return true;
      // check against 4 edges
      const edges = [
        [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y}],
        [{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h}],
        [{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}],
        [{x:r.x,y:r.y+r.h},{x:r.x,y:r.y}]
      ];
      for (const [p1,p2] of edges) if (this.lineIntersect(a,b,p1,p2)) return true;
      return false;
    };
    for (let i=0;i<pts.length-1;i++) for (const r of this.waterRects) if (segIntRect(pts[i], pts[i+1], r)) return true;
    return false;
  }

  _connectBuildingToRoad(pt) {
    if (!this.roadSegments.length) return;
    // buscar punto más cercano de cualquier polilínea y crear ramal corto
    let best = null, bd = Infinity, bestSeg = null;
    for (const seg of this.roadSegments) {
      const pts = seg.points;
      for (let i=0;i<pts.length-1;i++){
        const a=pts[i], b=pts[i+1];
        const vx=b.x-a.x, vy=b.y-a.y; const wx=pt.x-a.x, wy=pt.y-a.y;
        const t = Math.max(0, Math.min(1, (vx*wx+vy*wy)/((vx*vx+vy*vy)||1)));
        const q = { x: a.x+vx*t, y: a.y+vy*t };
        const d = Math.hypot(pt.x-q.x, pt.y-q.y);
        if (d<bd){ bd=d; best=q; bestSeg=seg; }
      }
    }
    if (!best || bd > this.grid*3) return; // muy lejos
    const path = [ this._snapPoint(pt), this._snapPoint(best) ];
    const meta = { oneWay:false, lanes:1, priority:1, driveway:true };
    this.roadSegments.push(new RoadSegment(path, meta));
    this.rebuildGraph();
  }

  _endGame(){
    this.gameOver = true;
    // detener spawns de tráfico/visitantes; en esta versión evitamos más visitantes en maybeSpawnVisitors
    const el = document.getElementById('alerts'); if (el) el.textContent = 'Juego terminado: 8/8 visitas fallidas';
  }
}

/* ---------- Game init ---------- */
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

// responsive
window.addEventListener('resize', () => game.scale.resize(window.innerWidth, window.innerHeight));
