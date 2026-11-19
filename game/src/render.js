// Drawing only: the world state in, pixels out. Top-down camera that
// follows the player, a sun-soaked city with fake-3D buildings, cars,
// people, bullets, particles and objective markers.
import { WORLD, CITY, PALETTE, CAR } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0 };
    this.time = 0;
  }

  // Keep the camera centred on the player, clamped to the world.
  updateCamera(px, py) {
    const w = this.canvas.width, h = this.canvas.height;
    this.cam.x = Math.max(0, Math.min(WORLD.w - w, px - w / 2));
    this.cam.y = Math.max(0, Math.min(WORLD.h - h, py - h / 2));
  }
  toScreen(x, y) { return { x: x - this.cam.x, y: y - this.cam.y }; }

  draw(game) {
    const ctx = this.ctx;
    this.time += 1 / 60;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGround(ctx, game);
    this.drawMarkers(ctx, game);
    this.drawPickups(ctx, game);
    this.drawCars(ctx, game);
    this.drawPeople(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawBullets(ctx, game);
    this.drawParticles(ctx, game);
  }

  drawGround(ctx, game) {
    const city = game.city;
    const x0 = this.cam.x, y0 = this.cam.y, x1 = x0 + 1280, y1 = y0 + 720;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, 1280, 720);
    // Subtle grass patches.
    ctx.fillStyle = PALETTE.grassDry;
    for (let gx = Math.floor(x0 / 260) * 260; gx < x1; gx += 260) {
      for (let gy = Math.floor(y0 / 260) * 260; gy < y1; gy += 260) {
        if (((gx * 7 + gy * 13) % 5) === 0) ctx.fillRect(gx - x0, gy - y0, 130, 110);
      }
    }
    // Beach + water at the south edge.
    if (y1 > CITY.beachY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(0, CITY.beachY - y0, 1280, WORLD.h - 120 - CITY.beachY);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(0, WORLD.h - 120 - y0, 1280, 120);
      ctx.fillStyle = PALETTE.waterDeep;
      for (let wx = 0; wx < 1280; wx += 90) {
        const wy = WORLD.h - 120 - y0 + 18 + ((wx * 31) % 70);
        ctx.fillRect(wx, wy, 46, 4);
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText('SOLMAR BEACH', 40, CITY.beachY - y0 + 34);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of city.roadsX) ctx.fillRect(rx - CITY.roadWidth / 2 - x0, Math.max(0, -y0), CITY.roadWidth, Math.min(720, CITY.beachY - y0));
    for (const ry of city.roadsY) ctx.fillRect(Math.max(0, -x0), ry - CITY.roadWidth / 2 - y0, Math.min(1280, WORLD.w - x0), CITY.roadWidth);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of city.roadsX) {
      for (let y = Math.floor(y0 / 44) * 44; y < Math.min(y1, CITY.beachY); y += 44) ctx.fillRect(rx - 2 - x0, y - y0, 4, 22);
    }
    for (const ry of city.roadsY) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x - x0, ry - 2 - y0, 22, 4);
    }
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsX) {
      ctx.fillRect(rx - CITY.roadWidth / 2 - 8 - x0, Math.max(0, -y0), 8, Math.min(720, CITY.beachY - y0));
      ctx.fillRect(rx + CITY.roadWidth / 2 - x0, Math.max(0, -y0), 8, Math.min(720, CITY.beachY - y0));
    }
    // Park.
    const px = city.roadsX[CITY.parkBlock.cx] + CITY.roadWidth / 2 + CITY.blockPad;
    const py = city.roadsY[CITY.parkBlock.cy] + CITY.roadWidth / 2 + CITY.blockPad;
    const pw = CITY.roadGap - CITY.roadWidth - CITY.blockPad * 2;
    const ph = CITY.roadGap - CITY.roadWidth - CITY.blockPad * 2;
    ctx.fillStyle = '#4c8a3f';
    ctx.fillRect(px - x0, py - y0, pw, ph);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(px + pw / 2 - 10 - x0, py - y0, 20, ph);
    ctx.fillRect(px - x0, py + ph / 2 - 10 - y0, pw, 20);
    ctx.fillStyle = '#3f8ab5';
    ctx.beginPath(); ctx.ellipse(px + pw * 0.3 - x0, py + ph * 0.3 - y0, 42, 26, 0, 0, Math.PI * 2); ctx.fill();
    // Buildings: wall offset down-right for a fake 3D extrusion, then roof.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      const h = b.height;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x - x0 + h * 0.5, b.y - y0 + h * 0.5, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x - x0, b.y - y0 + h * 0.4, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - x0, b.y - y0, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x - x0 + 6, b.y - y0 + 6, b.w - 12, 8);
      // Rooftop details: vents / AC boxes.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x - x0 + 14 + i * 46, b.y - y0 + 16 + j * 46, 18, 12);
      }
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 - 30 || t.x > x1 + 30 || t.y < y0 - 30 || t.y > y1 + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x - x0 + 5, t.y - y0 + 6, t.r, t.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.parkTree;
      ctx.beginPath(); ctx.arc(t.x - x0, t.y - y0, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d8a44';
      ctx.beginPath(); ctx.arc(t.x - x0 - t.r * 0.3, t.y - y0 - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // Lamps.
    ctx.fillStyle = '#22242a';
    for (const l of city.lamps) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      ctx.fillRect(l.x - x0 - 2, l.y - y0 - 2, 4, 4);
    }
  }

  drawMarkers(ctx, game) {
    const o = game.missions.objective;
    if (game.missions.state === 'active' && o && o.type === 'goto') {
      const p = this.toScreen(o.x, o.y);
      const pulse = 1 + Math.sin(this.time * 4) * 0.12;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,62,0.25)';
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(12, -26); ctx.lineTo(-12, -26); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Edge arrow pointing at an off-screen objective.
      if (p.x < 0 || p.x > 1280 || p.y < 0 || p.y > 720) {
        const cx = Math.max(60, Math.min(1220, p.x));
        const cy = Math.max(60, Math.min(660, p.y));
        const a = Math.atan2(p.y - 360, p.x - 640);
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    // Hideout / garage labels.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const spots = [
      { x: 1050, y: 630, label: 'GARAGE' },
      { x: 1470, y: 1050, label: "LENA'S DINER" },
      { x: 2310, y: 630, label: 'CORAL BANK' },
      { x: 2730, y: 2100, label: 'HARBOUR' },
      { x: 630, y: 1890, label: 'HIDEOUT' },
    ];
    for (const s of spots) {
      const p = this.toScreen(s.x, s.y);
      if (p.x < -80 || p.x > 1360 || p.y < -40 || p.y > 760) continue;
      ctx.fillText(s.label, p.x - 34, p.y - 44);
    }
  }

  drawPickups(ctx, game) {
    for (const pk of game.pickups) {
      const p = this.toScreen(pk.x, pk.y);
      const bob = Math.sin(this.time * 3 + pk.x) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff'; ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#d93d3d'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6);
      } else if (pk.kind === 'cash') {
        ctx.fillStyle = '#37b06a';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText('$', 0, 5); ctx.textAlign = 'left';
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#e8c33a'; ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#22242a'; ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.fillText('AMMO', 0, 4); ctx.textAlign = 'left';
      }
      ctx.restore();
    }
  }

  drawCarShape(ctx, car) {
    const L = CAR.length, Wd = CAR.width;
    ctx.save();
    ctx.translate(car.x - this.cam.x, car.y - this.cam.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 8);
    ctx.fill();
    // Cabin + windows.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    ctx.beginPath(); ctx.roundRect(-L / 2 + 13, -Wd / 2 + 4, 20, Wd - 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(-L / 2 + 16, -Wd / 2 + 6, 5, Wd - 12);
    // Headlights / taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 3, -Wd / 2 + 3, 3, 5);
    ctx.fillRect(L / 2 - 3, Wd / 2 - 8, 3, 5);
    ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#a02020';
    ctx.fillRect(-L / 2, -Wd / 2 + 3, 3, 5);
    ctx.fillRect(-L / 2, Wd / 2 - 8, 3, 5);
    if (car.police) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 2, 3);
      ctx.textAlign = 'left';
      const on = Math.floor(car.siren) % 2 === 0;
      ctx.fillStyle = on ? '#ff2e2e' : '#2e6bff';
      ctx.beginPath(); ctx.arc(-6, -Wd / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? '#2e6bff' : '#ff2e2e';
      ctx.beginPath(); ctx.arc(6, -Wd / 2 - 2, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(-8, -Wd / 2 - 1, 16, 4);
    }
    ctx.restore();
  }

  drawCars(ctx, game) {
    for (const c of game.traffic.cars) {
      if (c.x < this.cam.x - 80 || c.x > this.cam.x + 1360 || c.y < this.cam.y - 80 || c.y > this.cam.y + 800) continue;
      this.drawCarShape(ctx, c);
      if (c.health < 45 && c.health > 0) {
        // Smoke from a damaged car.
        ctx.fillStyle = 'rgba(120,120,120,0.5)';
        ctx.beginPath(); ctx.arc(c.x - this.cam.x - Math.cos(c.angle) * 20, c.y - this.cam.y - Math.sin(c.angle) * 20, 8 + Math.sin(this.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  drawPerson(ctx, x, y, angle, shirt, pants, skin, isCop) {
    const p = this.toScreen(x, y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Legs.
    ctx.fillStyle = pants;
    ctx.fillRect(-6, -7, 12, 5);
    ctx.fillRect(-6, 2, 12, 5);
    // Body.
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 6); ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath(); ctx.arc(10, 0, 6.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(8, -2, 5, 4);
    }
    ctx.restore();
  }

  drawPeople(ctx, game) {
    for (const p of game.people.peds) this.drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.pants, p.skin, false);
    for (const c of game.people.cops) this.drawPerson(ctx, c.x, c.y, c.angle, c.shirt, c.pants, c.skin, true);
  }

  drawPlayer(ctx, game) {
    const pl = game.player;
    if (pl.inCar) return;
    const aim = pl.aimAngle;
    this.drawPerson(ctx, pl.x, pl.y, pl.facing, '#e8e8e8', '#22242a', '#f0c8a0', false);
    // Rico's jacket + pistol aim line.
    const p = this.toScreen(pl.x, pl.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(pl.facing);
    ctx.fillStyle = '#c9402e';
    ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 6); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(aim) * 18, p.y + Math.sin(aim) * 18);
    ctx.lineTo(p.x + Math.cos(aim) * 46, p.y + Math.sin(aim) * 46);
    ctx.stroke();
  }

  drawBullets(ctx, game) {
    ctx.fillStyle = '#ffe9a8';
    for (const b of game.bullets) {
      const p = this.toScreen(b.x, b.y);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawParticles(ctx, game) {
    for (const pt of game.particles) {
      const p = this.toScreen(pt.x, pt.y);
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
