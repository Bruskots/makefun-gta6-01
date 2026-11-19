// City generation for Solmar Bay: a road grid, building blocks, a park,
// a beach and harbour strip, plus collision helpers. Deterministic from
// a fixed seed so every run builds the same city.
import { WORLD, CITY, PALETTE, rngFrom, clamp } from './config.js';

export class City {
  constructor(seed = 20261119) {
    this.seed = seed;
    this.roadsX = [];   // vertical road centre x positions
    this.roadsY = [];   // horizontal road centre y positions
    for (let x = CITY.roadGap / 2; x < WORLD.w - 60; x += CITY.roadGap) this.roadsX.push(x);
    for (let y = CITY.roadGap / 2; y < CITY.beachY - 60; y += CITY.roadGap) this.roadsY.push(y);
    this.buildings = [];
    this.trees = [];
    this.lamps = [];
    this.parkingSpots = [];
    this.generate();
  }

  generate() {
    const rng = rngFrom(this.seed);
    const hw = CITY.roadWidth / 2;
    for (let cx = 0; cx < this.roadsX.length - 1; cx++) {
      for (let cy = 0; cy < this.roadsY.length - 1; cy++) {
        const x0 = this.roadsX[cx] + hw + CITY.blockPad;
        const x1 = this.roadsX[cx + 1] - hw - CITY.blockPad;
        const y0 = this.roadsY[cy] + hw + CITY.blockPad;
        const y1 = this.roadsY[cy + 1] - hw - CITY.blockPad;
        if (cx === CITY.parkBlock.cx && cy === CITY.parkBlock.cy) {
          // Central park: trees, paths and a pond instead of buildings.
          for (let i = 0; i < 26; i++) {
            this.trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 12 + rng() * 10 });
          }
          continue;
        }
        // 1-4 buildings per block, in a rough 2x2 layout.
        const cols = rng() < 0.5 ? 1 : 2;
        const rows = rng() < 0.5 ? 1 : 2;
        const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            if (rng() < 0.12) continue; // empty lot / plaza
            const w = bw * (0.55 + rng() * 0.3);
            const h = bh * (0.55 + rng() * 0.3);
            const x = x0 + i * bw + (bw - w) / 2 + (rng() - 0.5) * 8;
            const y = y0 + j * bh + (bh - h) / 2 + (rng() - 0.5) * 8;
            const ci = Math.floor(rng() * PALETTE.buildingRoof.length);
            this.buildings.push({
              x, y, w, h,
              roof: PALETTE.buildingRoof[ci],
              wall: PALETTE.buildingWall[ci],
              height: 6 + rng() * 22,          // fake 3D extrusion
              windows: Math.floor(rng() * 4),
              plaza: rng() < 0.15,
            });
          }
        }
        // A few street trees and lamps on the block corners.
        for (let k = 0; k < 3; k++) {
          this.trees.push({ x: x0 + rng() * (x1 - x0), y: y0 - 8, r: 9 + rng() * 6 });
        }
      }
    }
    // Lamps along every road, every ~180 px.
    for (const rx of this.roadsX) for (let y = 60; y < CITY.beachY; y += 180) this.lamps.push({ x: rx + hw + 8, y });
    for (const ry of this.roadsY) for (let x = 60; x < WORLD.w; x += 180) this.lamps.push({ x, y: ry + hw + 8 });
    // Road-edge bays too: just outside the traffic lanes, validated clear
    // of buildings, so a car is always in reach from the street.
    for (const rx of this.roadsX) {
      for (const ry of this.roadsY) {
        if (rng() < 0.55) {
          const s = { x: rx + 58, y: ry + 140 + rng() * 130, angle: Math.PI / 2 };
          if (this.spotClear(s.x, s.y, s.angle)) this.parkingSpots.push(s);
        }
        if (rng() < 0.4) {
          const s = { x: rx - 58, y: ry + 140 + rng() * 130, angle: -Math.PI / 2 };
          if (this.spotClear(s.x, s.y, s.angle)) this.parkingSpots.push(s);
        }
      }
    }
    // Block-corner spots as well, for cars tucked just inside a block.
    for (let cx = 0; cx < this.roadsX.length - 1; cx++) {
      for (let cy = 0; cy < this.roadsY.length - 1; cy++) {
        const x0 = this.roadsX[cx] + hw + CITY.blockPad;
        const x1 = this.roadsX[cx + 1] - hw - CITY.blockPad;
        const y0 = this.roadsY[cy] + hw + CITY.blockPad;
        const y1 = this.roadsY[cy + 1] - hw - CITY.blockPad;
        const corners = [
          { x: x0 + 46, y: y0 + 46, angle: 0 },
          { x: x1 - 46, y: y1 - 46, angle: Math.PI },
          { x: x1 - 46, y: y0 + 46, angle: Math.PI / 2 },
          { x: x0 + 46, y: y1 - 46, angle: -Math.PI / 2 },
        ];
        for (const c of corners) {
          if (rng() < 0.45 && this.spotClear(c.x, c.y, c.angle)) this.parkingSpots.push(c);
        }
      }
    }
  }

  isOnRoad(x, y) {
    const hw = CITY.roadWidth / 2;
    if (y > CITY.beachY) return false;
    for (const rx of this.roadsX) if (Math.abs(x - rx) <= hw) return true;
    for (const ry of this.roadsY) if (Math.abs(y - ry) <= hw) return true;
    return false;
  }
  isBeach(x, y) { return y >= CITY.beachY && y < WORLD.h - 120; }
  isWater(x, y) { return y >= WORLD.h - 120; }

  // A parking spot is usable only if the car can also drive out of it:
  // check the spot itself and the lane ahead of it, in its facing.
  spotClear(x, y, angle) {
    if (this.hitsBuilding(x, y, 30)) return false;
    for (const d of [70, 140, -70, -140]) {
      if (this.hitsBuilding(x + Math.cos(angle) * d, y + Math.sin(angle) * d, 20)) return false;
    }
    return true;
  }

  // Push a circle (px,py,r) out of buildings; returns corrected position.
  collideCircle(px, py, r) {
    let x = px, y = py;
    for (const b of this.buildings) {
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      const dx = x - nx, dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; y = ny + (dy / d) * r;
      } else if (d2 <= 0.001) {
        // Centre inside the building: push out along the smallest overlap.
        const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r; else y = b.y + b.h + r;
      }
    }
    x = clamp(x, 20, WORLD.w - 20);
    y = clamp(y, 20, WORLD.h - 20);
    return { x, y };
  }
  // Circle vs building test (used for cars / bullets).
  hitsBuilding(x, y, r) {
    for (const b of this.buildings) {
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      const dx = x - nx, dy = y - ny;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }
  // Nearest road centre to a point (for spawning traffic on roads).
  nearestRoadPoint(x, y) {
    let best = null, bd = Infinity;
    for (const rx of this.roadsX) {
      const d = Math.abs(x - rx);
      if (d < bd) { bd = d; best = { x: rx, y, horizontal: false }; }
    }
    for (const ry of this.roadsY) {
      const d = Math.abs(y - ry);
      if (d < bd) { bd = d; best = { x, y: ry, horizontal: true }; }
    }
    return best;
  }
  randomRoadPoint(rng) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = this.roadsX[Math.floor(rng() * this.roadsX.length)];
      return { x: rx + (rng() < 0.5 ? -22 : 22), y: 80 + rng() * (CITY.beachY - 160), angle: rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2 };
    }
    const ry = this.roadsY[Math.floor(rng() * this.roadsY.length)];
    return { x: 80 + rng() * (WORLD.w - 160), y: ry + (rng() < 0.5 ? -22 : 22), angle: rng() < 0.5 ? 0 : Math.PI };
  }
}
