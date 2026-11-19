// SOLMAR BAY — boot and the one game loop.
// Screens: title, play, paused, busted, wasted, complete.
// ?shot=start|drive|chase|end stages a scene for screenshots and sets
// window.__shotReady once it has been painted.
import { WORLD, PLAYER, WANTED, CAR_COLORS, clamp, angleTo, rngFrom } from './config.js';
import { City } from './city.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Traffic, makeCar } from './vehicles.js';
import { People } from './people.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { loadSave, writeSave } from './save.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot'); // null in normal play

class Game {
  constructor() {
    this.city = new City(20261119);
    this.input = new Input(canvas);
    this.sounds = new SoundBank();
    this.traffic = new Traffic(this.city);
    this.people = new People(this.city);
    this.missions = new MissionRunner();
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.screen = 'title';
    this.titleTime = 0;
    this.playTime = 0;
    this.cash = 0;
    this.wanted = 0;
    this.wantedTimer = 0;
    this.bustTimer = 0;
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.toast = '';
    this.toastT = 0;
    this.targetCar = null;   // harbour courier car for mission 4
    this.stats = { missionsDone: 0, carsStolen: 0, copsDodged: 0, shotsFired: 0, totalEarned: 0 };
    this.player = {
      x: 1470, y: 1470, facing: 0, aimAngle: 0,
      health: PLAYER.maxHealth, ammo: 60,
      inCar: false, car: null, speed: 0,
    };
    this.saveTimer = 0;
    this.engineTimer = 0;
    this.spawnPickups();
    this.restoreSave();
  }

  restoreSave() {
    const save = loadSave();
    if (!save) return;
    this.cash = save.cash || 0;
    this.stats = { ...this.stats, ...(save.stats || {}) };
    this.missions.completedCount = save.missionsDone || 0;
    if (save.player) { this.player.x = save.player.x; this.player.y = save.player.y; }
  }

  spawnPickups() {
    const spots = [
      { x: 1470, y: 630, kind: 'health' },
      { x: 630, y: 1050, kind: 'ammo' },
      { x: 2310, y: 1470, kind: 'cash' },
      { x: 1890, y: 1890, kind: 'health' },
      { x: 2730, y: 630, kind: 'ammo' },
      { x: 1050, y: 2100, kind: 'cash' },
      { x: 1890, y: 1050, kind: 'health' },
    ];
    this.pickups = spots.map((s) => ({ ...s, taken: false, respawn: 0 }));
  }

  setWanted(n, exact) {
    if (exact) this.wanted = n;
    else this.wanted = clamp(this.wanted + n, 0, WANTED.maxStars);
  }

  toastMsg(text, seconds = 3) { this.toast = text; this.toastT = seconds; }

  startGame() {
    this.screen = 'play';
    this.sounds.ensure();
    this.sounds.startMusic();
    if (this.missions.state === 'idle') {
      const idx = Math.min(this.missions.completedCount, MISSIONS.length - 1);
      this.missions.start(idx);
      this.setWanted(this.missions.mission.wantedOnStart || 0, true);
    }
  }

  // --- Player actions -------------------------------------------------
  tryEnterCar() {
    const pl = this.player;
    if (pl.inCar) {
      // Exit the car.
      const car = pl.car;
      car.driver = null; car.parked = true; car.speed = 0;
      pl.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      pl.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      const fixed = this.city.collideCircle(pl.x, pl.y, PLAYER.radius);
      pl.x = fixed.x; pl.y = fixed.y;
      pl.inCar = false; pl.car = null;
      return;
    }
    const car = this.traffic.nearestCar(pl.x, pl.y, 130, (c) => c.driver !== 'player');
    if (!car) return;
    const wasParked = car.parked;
    car.parked = false;
    car.driver = 'player';
    pl.inCar = true;
    pl.car = car;
    if (wasParked) {
      this.stats.carsStolen++;
      this.setWanted(1, false);
      this.toastMsg('Car stolen! The cops noticed — 1 star');
      this.sounds.sirenBlip();
      // A nearby pedestrian sometimes shouts.
      const witness = this.people.peds.find((p) => Math.hypot(p.x - pl.x, p.y - pl.y) < 260);
      if (witness) witness.fleeing = 2;
    }
  }

  shoot() {
    const pl = this.player;
    if (pl.ammo <= 0) { this.toastMsg('Out of ammo — find an AMMO pickup'); return; }
    pl.ammo--;
    this.stats.shotsFired++;
    this.sounds.shoot();
    const gx = pl.inCar && pl.car ? pl.car.x : pl.x;
    const gy = pl.inCar && pl.car ? pl.car.y : pl.y;
    const a = pl.aimAngle;
    this.bullets.push({ x: gx + Math.cos(a) * 24, y: gy + Math.sin(a) * 24, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.7 });
    this.setWanted(0.5, false);
    this.spawnSparks(gx + Math.cos(a) * 30, gy + Math.sin(a) * 30, '#ffe9a8', 4);
  }

  spawnSparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, maxLife: 0.4, size: 2 + Math.random() * 3, color });
    }
  }
  spawnExplosion(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 320;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.7 + Math.random() * 0.4, maxLife: 1.1, size: 3 + Math.random() * 6, color: ['#ff7a2e', '#ffd23e', '#e03a3a', '#888'][i % 4] });
    }
    this.sounds.crash();
  }

  damagePlayer(amount) {
    const pl = this.player;
    if (this.screen !== 'play') return;
    pl.health -= amount;
    if (pl.health <= 0) {
      pl.health = 0;
      this.screen = 'wasted';
      this.sounds.missionFail();
      this.sounds.stopMusic();
    }
  }

  // --- Police / wanted ------------------------------------------------
  updateWanted(dt) {
    // Wanted decays when no police can see the player.
    const seen = this.traffic.cars.some((c) => c.police && Math.hypot(c.x - this.player.x, c.y - this.player.y) < 520)
      || this.people.cops.some((c) => Math.hypot(c.x - this.player.x, c.y - this.player.y) < 420);
    if (!seen && this.wanted > 0) {
      this.wantedTimer += dt;
      if (this.wantedTimer > 4) {
        this.wanted = Math.max(0, this.wanted - WANTED.decayPerSec * dt * 4);
        if (this.wanted < 0.1) { this.wanted = 0; this.stats.copsDodged++; }
      }
    } else this.wantedTimer = 0;
    // Keep the right number of police cruisers on the road.
    const wantCount = Math.round(this.wanted) * WANTED.policePerStar;
    const have = this.traffic.cars.filter((c) => c.police).length;
    if (have < wantCount) {
      const c = this.traffic.spawnPolice(this.player.x, this.player.y);
      // Drop it on a road near the player, not across the map.
      const p = this.city.randomRoadPoint(Math.random);
      c.x = clamp(this.player.x + (Math.random() - 0.5) * 900, 60, WORLD.w - 60);
      c.y = clamp(this.player.y + (Math.random() - 0.5) * 900, 60, WORLD.h - 60);
      const road = this.city.nearestRoadPoint(c.x, c.y);
      c.x = road.x; c.y = road.y;
    } else if (have > wantCount) {
      const extra = this.traffic.cars.find((c) => c.police);
      if (extra) this.traffic.removeCar(extra);
    }
    // Foot cops join at 2+ stars.
    if (this.wanted >= 2 && this.people.cops.length < Math.round(this.wanted) && Math.random() < dt * 0.5) {
      this.people.spawnCopNear(this.player.x, this.player.y);
    }
    // Busted: a foot cop stands next to the player on foot.
    if (!this.player.inCar && this.wanted > 0) {
      const near = this.people.cops.some((c) => Math.hypot(c.x - this.player.x, c.y - this.player.y) < WANTED.bustRadius);
      if (near) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.2) {
          this.screen = 'busted';
          this.sounds.missionFail();
          this.sounds.stopMusic();
        }
      } else this.bustTimer = 0;
    } else this.bustTimer = 0;
  }

  // --- Per-frame update ----------------------------------------------
  update(dt) {
    const input = this.input;
    const pl = this.player;
    if (this.screen === 'title') {
      this.titleTime += dt;
      this.renderer.updateCamera(1700, 1300);
      if (input.hit('enter', ' ') || input.mouse.clicked) this.startGame();
      return;
    }
    if (this.screen === 'paused') {
      if (input.hit('p', 'escape', 'enter')) { this.screen = 'play'; }
      return;
    }
    if (this.screen === 'busted' || this.screen === 'wasted' || this.screen === 'complete') {
      if (input.hit('enter', ' ')) {
        pl.health = PLAYER.maxHealth;
        this.wanted = 0;
        this.bustTimer = 0;
        this.people.cops = [];
        if (pl.inCar && pl.car) { pl.car.driver = null; pl.car.parked = true; }
        pl.inCar = false; pl.car = null;
        pl.x = 1470; pl.y = 1050;
        this.screen = 'play';
        this.sounds.startMusic();
        if (this.missions.state === 'failed') this.missions.start(this.missions.index);
      }
      return;
    }
    // --- playing ---
    this.playTime += dt;
    if (input.hit('p', 'escape')) { this.screen = 'paused'; return; }
    if (input.hit('m')) { const muted = this.sounds.toggleMute(); this.toastMsg(muted ? 'Sound muted' : 'Sound on'); }
    if (input.hit('r') && this.missions.state === 'active') { this.missions.start(this.missions.index); this.toastMsg('Mission restarted'); }
    if (input.hit('e')) this.tryEnterCar();

    // Aim follows the mouse (screen -> world).
    const cam = this.renderer.cam;
    const wx = input.mouse.x + cam.x, wy = input.mouse.y + cam.y;
    const ax = pl.inCar && pl.car ? pl.car.x : pl.x;
    const ay = pl.inCar && pl.car ? pl.car.y : pl.y;
    pl.aimAngle = angleTo(ax, ay, wx, wy);
    if (input.mouse.clicked || input.mouse.down) {
      if (!this.shootCooldown) { this.shoot(); this.shootCooldown = 0.22; }
    }
    if (this.shootCooldown) this.shootCooldown -= dt;

    if (pl.inCar && pl.car) {
      const fast = this.traffic.drivePlayer(pl.car, input, dt);
      this.engineTimer -= dt;
      if (fast && this.engineTimer <= 0) { this.engineTimer = 0.4; this.sounds.engineHum(Math.abs(pl.car.speed) / 560); }
      if (pl.car.health <= 0) {
        this.spawnExplosion(pl.car.x, pl.car.y);
        this.traffic.removeCar(pl.car);
        pl.inCar = false; pl.car = null;
        this.damagePlayer(25);
        this.setWanted(1, false);
      }
      // Running over pedestrians is a crime.
      for (const ped of this.people.peds) {
        if (Math.abs(pl.car.speed) > 200 && Math.hypot(ped.x - pl.car.x, ped.y - pl.car.y) < 30) {
          ped.dead = true;
          this.setWanted(0.5, false);
          this.spawnSparks(ped.x, ped.y, '#e03a3a', 8);
          this.sounds.crash();
        }
      }
      // Police ramming the player car damages it.
      for (const c of this.traffic.cars) {
        if (c.police && Math.hypot(c.x - pl.car.x, c.y - pl.car.y) < 48 && Math.abs(c.speed) > 150) {
          pl.car.health -= 12 * dt;
          this.spawnSparks(pl.car.x, pl.car.y, '#ffd23e', 2);
        }
      }
    } else {
      // On foot.
      const axis = input.moveAxis();
      const sprint = input.down('shift');
      const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      pl.x += axis.x * speed * dt;
      pl.y += axis.y * speed * dt;
      if (axis.x || axis.y) pl.facing = Math.atan2(axis.y, axis.x);
      const fixed = this.city.collideCircle(pl.x, pl.y, PLAYER.radius);
      pl.x = fixed.x; pl.y = fixed.y;
    }

    // Bullets.
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (this.city.hitsBuilding(b.x, b.y, 4)) { b.life = 0; this.spawnSparks(b.x, b.y, '#ccc', 3); }
      for (const c of this.traffic.cars) {
        if (c.driver === 'player') continue;
        if (Math.hypot(b.x - c.x, b.y - c.y) < 26) {
          b.life = 0; c.health -= 34;
          this.spawnSparks(b.x, b.y, '#ffd23e', 5);
          if (c.police) this.setWanted(1, false);
          if (c.health <= 0) { this.spawnExplosion(c.x, c.y); this.traffic.removeCar(c); }
          break;
        }
      }
      for (const ped of this.people.peds) {
        if (Math.hypot(b.x - ped.x, b.y - ped.y) < 12) { b.life = 0; ped.dead = true; this.setWanted(0.5, false); this.spawnSparks(b.x, b.y, '#e03a3a', 6); break; }
      }
      for (const cop of this.people.cops) {
        if (Math.hypot(b.x - cop.x, b.y - cop.y) < 12) { b.life = 0; cop.health -= 34; this.spawnSparks(b.x, b.y, '#e03a3a', 6); if (cop.health <= 0) cop.dead = true; this.setWanted(1, false); break; }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    // Particles.
    for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.92; pt.vy *= 0.92; pt.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);

    // Pickups.
    for (const pk of this.pickups) {
      if (pk.taken) { pk.respawn -= dt; if (pk.respawn <= 0) pk.taken = false; continue; }
      if (Math.hypot(pl.x - pk.x, pl.y - pk.y) < 30 || (pl.inCar && pl.car && Math.hypot(pl.car.x - pk.x, pl.car.y - pk.y) < 36)) {
        pk.taken = true; pk.respawn = 45;
        if (pk.kind === 'health') { pl.health = Math.min(PLAYER.maxHealth, pl.health + 50); this.toastMsg('Health +50'); }
        else if (pk.kind === 'ammo') { pl.ammo += 40; this.toastMsg('Ammo +40'); }
        else { this.cash += 150; this.stats.totalEarned += 150; this.toastMsg('Found $150'); }
        this.sounds.pickup();
      }
    }

    // Mission 4 target car: spawn it when the mission reaches the ram objective.
    const m = this.missions.mission;
    if (m && m.id === 'harbor-heat' && this.missions.state === 'active' && this.missions.objIndex === 1 && !this.targetCar) {
      this.targetCar = makeCar(2730, 2100, 0, { kind: 'sport', color: '#e07a2e', driver: 'traffic' });
      this.targetCar.speed = 200;
      this.traffic.cars.push(this.targetCar);
      this.toastMsg('There he is — ram his car!');
    }
    if (this.targetCar && this.missions.state !== 'active') this.targetCar = null;

    // Missions.
    const before = this.missions.state;
    this.missions.update(dt, this);
    if (this.missions.state === 'done' && before === 'active') {
      this.sounds.missionOk();
      this.sounds.cash();
      this.stats.totalEarned += this.missions.mission.reward;
      if (this.missions.index >= MISSIONS.length - 1) this.screen = 'complete';
      else this.missions.start(this.missions.index + 1);
    } else if (this.missions.state === 'failed' && before === 'active') {
      this.sounds.missionFail();
    }

    this.traffic.update(dt, pl, this.wanted, (a, b) => {
      this.sounds.crash();
      this.spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd23e', 6);
    });
    this.people.update(dt, pl, this.bullets.length ? { x: this.bullets[0].x, y: this.bullets[0].y } : null);
    this.updateWanted(dt);

    // Camera follows the player (or their car).
    const fx = pl.inCar && pl.car ? pl.car.x : pl.x;
    const fy = pl.inCar && pl.car ? pl.car.y : pl.y;
    this.renderer.updateCamera(fx, fy);

    if (this.toastT > 0) this.toastT -= dt;
    // Autosave every 10 seconds.
    this.saveTimer += dt;
    if (this.saveTimer > 10) { this.saveTimer = 0; writeSave(this); }
  }

  draw() {
    this.renderer.draw(this);
    this.hud.draw(this.renderer.ctx, this);
  }

  // --- Screenshot staging -------------------------------------------
  stageShot(mode) {
    const pl = this.player;
    if (mode === 'start') {
      this.screen = 'title';
      this.titleTime = 0.5;
      this.renderer.updateCamera(1700, 1300);
    } else if (mode === 'drive') {
      this.screen = 'play';
      this.missions.start(0);
      const car = this.traffic.nearestCar(1470, 1470, 600, (c) => c.parked);
      if (car) { car.parked = false; car.driver = 'player'; pl.inCar = true; pl.car = car; car.x = 1470; car.y = 1470; car.angle = 0; car.speed = 260; }
      pl.x = 1470; pl.y = 1470;
      this.stepSim(1.2);
    } else if (mode === 'chase') {
      this.screen = 'play';
      this.missions.start(2);
      this.missions.objIndex = 3; // escape phase
      this.missions.message = 'Lose the cops! Stay out of sight until the heat dies';
      this.missions.messageT = 6;
      const car = makeCar(1890, 1050, 0, { kind: 'sport', color: '#d94f3d', driver: 'player' });
      car.speed = 420;
      this.traffic.cars.push(car);
      pl.inCar = true; pl.car = car;
      pl.x = 1890; pl.y = 1050;
      this.setWanted(3, true);
      this.cash = 2500;
      for (let i = 0; i < 5; i++) {
        const cop = this.traffic.spawnPolice(pl.x, pl.y);
        cop.x = pl.x - 160 - i * 70; cop.y = pl.y + (i % 2 ? 60 : -60); cop.angle = 0; cop.speed = 430;
      }
      this.stepSim(0.8);
    } else if (mode === 'end') {
      this.screen = 'complete';
      this.stats = { missionsDone: 5, carsStolen: 9, copsDodged: 14, shotsFired: 86, totalEarned: 10600 };
      this.cash = 10600;
      this.missions.completedCount = 5;
      this.renderer.updateCamera(1470, 1470);
      this.stepSim(0.5);
    }
    this.draw();
    this.draw();
    window.__shotReady = true;
  }

  stepSim(seconds) {
    const steps = Math.floor(seconds * 60);
    for (let i = 0; i < steps; i++) {
      // Simulate traffic and people only — no input, no mission progress.
      this.traffic.update(1 / 60, this.player, this.wanted, null);
      this.people.update(1 / 60, this.player, null);
      for (const c of this.traffic.cars) if (c.police) c.siren += 1 / 60 * 6;
    }
    const fx = this.player.inCar && this.player.car ? this.player.car.x : this.player.x;
    const fy = this.player.inCar && this.player.car ? this.player.car.y : this.player.y;
    this.renderer.updateCamera(fx, fy);
  }
}

const game = new Game();
window.__game = game;

if (shotMode) {
  game.stageShot(shotMode);
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    game.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Keep the title screen lively behind the menu.
  setInterval(() => { if (game.screen === 'title') { game.traffic.update(1 / 60, game.player, 0, null); game.people.update(1 / 60, game.player, null); } }, 1000 / 30);
}
