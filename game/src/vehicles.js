// Cars: player driving physics, traffic AI that follows the road grid,
// parked cars that can be stolen, and police cruisers that chase.
import { CAR, CAR_COLORS, WORLD, clamp, angleDiff, rngFrom } from './config.js';

let nextId = 1;
export function makeCar(x, y, angle, opts = {}) {
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    kind: opts.kind || 'sedan',       // sedan | taxi | truck | police | sport
    police: !!opts.police,
    parked: !!opts.parked,
    driver: opts.driver || null,      // 'traffic' | 'police' | 'player' | null
    health: opts.health || 100,
    siren: 0,
    targetAngle: angle,
    stuck: 0,
    honk: 0,
    brakeLight: false,
  };
}

export class Traffic {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.spawnTimer = 0;
    this.hitCooldown = new Map(); // "idA-idB" -> last hard-impact time
    const rng = rngFrom(777);
    // Parked cars the player can steal — spread evenly over all spots so
    // every district has cars in reach, not just the first few blocks.
    const spots = city.parkingSpots;
    const stride = Math.max(1, Math.floor(spots.length / 48));
    for (let i = 0; i < spots.length; i += stride) {
      const spot = spots[i];
      this.cars.push(makeCar(spot.x, spot.y, spot.angle, { parked: true, color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)] }));
    }
    // Moving traffic.
    for (let i = 0; i < 14; i++) {
      const p = city.randomRoadPoint(rng);
      const c = makeCar(p.x, p.y, p.angle, { driver: 'traffic' });
      c.speed = 120 + rng() * 90;
      this.cars.push(c);
    }
  }

  nearestCar(x, y, maxDist, predicate) {
    let best = null, bd = maxDist * maxDist;
    for (const c of this.cars) {
      if (predicate && !predicate(c)) continue;
      const dx = c.x - x, dy = c.y - y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = c; }
    }
    return best;
  }

  spawnPolice(x, y) {
    const p = this.city.randomRoadPoint(Math.random);
    // Spawn a bit away from the player, on a road.
    const c = makeCar(p.x, p.y, p.angle, { kind: 'police', police: true, driver: 'police', color: '#1c2733' });
    c.speed = 200;
    this.cars.push(c);
    return c;
  }

  removeCar(car) { this.cars = this.cars.filter((c) => c !== car); }

  // Arcade car physics for the player-driven car.
  drivePlayer(car, input, dt) {
    const axis = input.moveAxis();
    const fwd = -axis.y;                 // W = forward
    const steer = axis.x;                // A/D steer
    const speedSign = car.speed >= 0 ? 1 : -1;
    if (fwd > 0) car.speed += CAR.accel * dt;
    else if (fwd < 0) {
      if (car.speed > 30) car.speed -= CAR.brake * dt;   // brake first
      else car.speed -= CAR.reverseAccel * dt;           // then reverse
    } else {
      car.speed -= car.speed * 1.4 * dt;                 // drag
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const turn = steer * CAR.turnRate * clamp(Math.abs(car.speed) / 220, 0, 1) * speedSign;
    car.angle += turn * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.brakeLight = fwd < 0 && car.speed > 30;
    // Building collision: bounce off with damage.
    // Building collision uses the car's half-width (16), not its length:
    // a car hugging the road edge must not snag on the building line.
    const hit = this.city.hitsBuilding(car.x, car.y, 16);
    if (hit) {
      const p = this.city.collideCircle(car.x, car.y, 16);
      car.x = p.x; car.y = p.y;
      if (Math.abs(car.speed) > 160) car.health -= 6;
      car.speed *= -0.25;
    }
    car.x = clamp(car.x, 24, WORLD.w - 24);
    car.y = clamp(car.y, 24, WORLD.h - 24);
    return Math.abs(car.speed) > 200;
  }

  update(dt, player, wantedStars, onCrash) {
    const rng = Math.random;
    for (const c of this.cars) {
      if (c.driver === 'player' || c.parked) continue;
      if (c.driver === 'traffic') this.updateTrafficCar(c, dt);
      else if (c.driver === 'police') this.updatePoliceCar(c, dt, player);
    }
    // Keep traffic density up near the player.
    this.spawnTimer -= dt;
    const moving = this.cars.filter((c) => c.driver === 'traffic').length;
    if (this.spawnTimer <= 0 && moving < 14) {
      this.spawnTimer = 2.5;
      const p = this.city.randomRoadPoint(rng);
      if (Math.hypot(p.x - player.x, p.y - player.y) > 500) {
        const c = makeCar(p.x, p.y, p.angle, { driver: 'traffic' });
        c.speed = 130 + rng() * 80;
        this.cars.push(c);
      }
    }
    // Car-car collisions: push apart. Parked cars are immovable — the
    // moving car takes the whole push and the parked car takes no damage.
    const list = this.cars;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 46 * 46 && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (46 - d) / 2;
          const nx = dx / d, ny = dy / d;
          if (a.parked && !b.parked) { b.x += nx * push * 2; b.y += ny * push * 2; }
          else if (b.parked && !a.parked) { a.x -= nx * push * 2; a.y -= ny * push * 2; }
          else { a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 140 && onCrash) onCrash(a, b);
          // Only hard impacts damage cars, and only once per contact:
          // a pair already overlapping does not grind health away.
          if (rel > 200) {
            const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
            const last = this.hitCooldown.get(key) || -10;
            const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
            if (now - last > 0.8) {
              this.hitCooldown.set(key, now);
              if (!a.parked) a.health -= 6;
              if (!b.parked) b.health -= 6;
            }
          }
          if (!a.parked) a.speed *= 0.7;
          if (!b.parked) b.speed *= 0.7;
        }
      }
    }
    // Remove wrecks (burnt-out cars fade away).
    this.cars = this.cars.filter((c) => c.health > 0 || c.driver === 'player');
  }

  updateTrafficCar(c, dt) {
    // Follow the road: keep angle aligned to the nearest road axis,
    // turn at intersections, slow down for the car ahead.
    const road = this.city.nearestRoadPoint(c.x, c.y);
    const want = road.horizontal ? (c.angle > -Math.PI / 2 && c.angle < Math.PI / 2 ? 0 : Math.PI) : (c.angle > 0 ? Math.PI / 2 : -Math.PI / 2);
    // At an intersection, sometimes turn.
    const nearX = this.city.roadsX.some((rx) => Math.abs(c.x - rx) < 14);
    const nearY = this.city.roadsY.some((ry) => Math.abs(c.y - ry) < 14);
    if (nearX && nearY && Math.random() < 0.004) {
      c.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    c.angle += angleDiff(c.angle, want) * Math.min(1, 2.2 * dt);
    // Slow down only for a car actually in our path (ahead and near our
    // heading line), not for cars parked beside the road.
    let blocked = false;
    for (const o of this.cars) {
      if (o === c || o.driver === 'player') continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const fwd = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const lat = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (fwd > 0 && fwd < 110 && lat < 30) { blocked = true; break; }
    }
    const target = blocked ? 0 : 150;
    c.speed += (target - c.speed) * Math.min(1, 1.5 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (this.city.hitsBuilding(c.x, c.y, 16)) {
      // Lost its way off the road: snap back onto the nearest road and
      // carry on along it instead of grinding against a building.
      const road = this.city.nearestRoadPoint(c.x, c.y);
      c.x = road.x; c.y = road.y;
      c.angle = road.horizontal ? (c.angle > -Math.PI / 2 && c.angle < Math.PI / 2 ? 0 : Math.PI) : (c.angle > 0 ? Math.PI / 2 : -Math.PI / 2);
      c.speed = 80;
    }
  }

  updatePoliceCar(c, dt, player) {
    const target = player.inCar ? player.car : player;
    const want = Math.atan2(target.y - c.y, target.x - c.x);
    c.angle += angleDiff(c.angle, want) * Math.min(1, 3.2 * dt);
    const d = Math.hypot(target.x - c.x, target.y - c.y);
    // Ram in, then back off and circle instead of grinding on the bumper.
    const targetSpeed = d > 60 ? 480 : (d > 35 ? 150 : 120);
    c.speed += (targetSpeed - c.speed) * Math.min(1, 2 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.siren += dt * 6;
    if (this.city.hitsBuilding(c.x, c.y, 16)) {
      const road = this.city.nearestRoadPoint(c.x, c.y);
      c.x = road.x; c.y = road.y;
      c.angle = road.horizontal ? (c.angle > -Math.PI / 2 && c.angle < Math.PI / 2 ? 0 : Math.PI) : (c.angle > 0 ? Math.PI / 2 : -Math.PI / 2);
      c.speed *= 0.5;
    }
  }
}
