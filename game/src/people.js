// Pedestrians and police officers on foot: wanderers who flee from
// gunfire, and cops who chase and try to bust the player.
import { WORLD, clamp, angleTo, rngFrom } from './config.js';

const PED_SHIRTS = ['#e8e8e8', '#d94f3d', '#3d7ad9', '#e8c33a', '#37b06a', '#8a4fd9', '#e07a2e', '#2ec4b6'];
const PED_PANTS = ['#22242a', '#3c4a5a', '#5a3a2a', '#4a4a4a'];

export class People {
  constructor(city) {
    this.city = city;
    this.peds = [];
    this.cops = [];
    const rng = rngFrom(4242);
    for (let i = 0; i < 26; i++) {
      const p = city.randomRoadPoint(rng);
      this.peds.push(this.makePed(p.x, p.y, rng));
    }
    this.spawnTimer = 0;
  }

  makePed(x, y, rng) {
    rng = rng || Math.random;
    return {
      x, y,
      angle: rng() * Math.PI * 2,
      speed: 40 + rng() * 40,
      shirt: PED_SHIRTS[Math.floor(rng() * PED_SHIRTS.length)],
      pants: PED_PANTS[Math.floor(rng() * PED_PANTS.length)],
      skin: ['#f0c8a0', '#c98d5f', '#8a5a3a', '#f5d7b0'][Math.floor(rng() * 4)],
      fleeing: 0,
      wanderT: 1 + rng() * 3,
      dead: false,
      panic: 0,
    };
  }

  spawnCopNear(x, y) {
    const cop = {
      x: x + (Math.random() - 0.5) * 300,
      y: y + (Math.random() - 0.5) * 300,
      angle: 0, speed: 250, health: 60,
      shirt: '#1c2733', pants: '#1c2733', skin: '#f0c8a0',
      fleeing: 0, wanderT: 0, dead: false, panic: 0, cop: true,
    };
    cop.x = clamp(cop.x, 30, WORLD.w - 30);
    cop.y = clamp(cop.y, 30, WORLD.h - 30);
    this.cops.push(cop);
    return cop;
  }

  update(dt, player, gunfireAt) {
    // Pedestrians wander, flee gunfire and speeding cars.
    for (const p of this.peds) {
      if (p.dead) continue;
      p.wanderT -= dt;
      let scared = p.fleeing > 0;
      if (gunfireAt && Math.hypot(p.x - gunfireAt.x, p.y - gunfireAt.y) < 320) scared = true;
      if (player.inCar && player.car && Math.hypot(p.x - player.car.x, p.y - player.car.y) < 90 && Math.abs(player.car.speed) > 200) scared = true;
      if (scared) {
        p.fleeing = 1.2;
        const away = angleTo(player.x, player.y, p.x, p.y);
        p.angle = away;
        p.x += Math.cos(p.angle) * 150 * dt;
        p.y += Math.sin(p.angle) * 150 * dt;
      } else {
        if (p.wanderT <= 0) {
          p.wanderT = 2 + Math.random() * 4;
          // Drift toward the nearest road, then along it.
          const road = this.city.nearestRoadPoint(p.x, p.y);
          p.angle = road.horizontal ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
        }
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
      }
      p.fleeing = Math.max(0, p.fleeing - dt);
      const fixed = this.city.collideCircle(p.x, p.y, 10);
      p.x = fixed.x; p.y = fixed.y;
    }
    // Cops on foot chase the player and try to bust them.
    for (const c of this.cops) {
      if (c.dead) continue;
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (player.inCar) {
        // Cops back off from a speeding car, then regroup.
        c.angle = angleTo(player.x, player.y, c.x, c.y);
        c.x += Math.cos(c.angle) * 90 * dt;
        c.y += Math.sin(c.angle) * 90 * dt;
      } else if (d > 26) {
        c.angle = angleTo(c.x, c.y, player.x, player.y);
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
      }
      const fixed = this.city.collideCircle(c.x, c.y, 10);
      c.x = fixed.x; c.y = fixed.y;
    }
    this.peds = this.peds.filter((p) => !p.dead);
    this.cops = this.cops.filter((c) => !c.dead);
    // Keep the streets populated.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.peds.length < 26) {
      this.spawnTimer = 3;
      const p = this.city.randomRoadPoint(Math.random);
      if (Math.hypot(p.x - player.x, p.y - player.y) > 420) this.peds.push(this.makePed(p.x, p.y));
    }
  }
}
