// Story missions for Solmar Bay. Rico Vega, a small-time driver from
// the harbour district, works his way up: a first car, a delivery run,
// a bank job, a harbour chase and a final stand at the hideout.
// Each mission is a small state machine of objectives with markers.
import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Marco',
    brief: 'Marco needs wheels. Steal any parked car and bring it to the garage on Coral Ave.',
    objectives: [
      { type: 'stealCar', text: 'Steal a car (walk up to a parked car and press E)' },
      { type: 'goto', x: 1050, y: 630, r: 70, text: 'Drive the car to the garage on Coral Ave' },
    ],
    reward: MISSION_REWARDS[0],
  },
  {
    id: 'pizza-run',
    title: 'Sunset Deliveries',
    giver: 'Lena',
    brief: 'Lena\'s diner has three orders going cold. Deliver them all before the timer runs out.',
    timeLimit: 120,
    objectives: [
      { type: 'goto', x: 1890, y: 630, r: 70, text: 'Deliver order 1 — Marina Apartments' },
      { type: 'goto', x: 630, y: 1470, r: 70, text: 'Deliver order 2 — Palm Court' },
      { type: 'goto', x: 2730, y: 1050, r: 70, text: 'Deliver order 3 — The Boardwalk' },
    ],
    reward: MISSION_REWARDS[1],
  },
  {
    id: 'bank-job',
    title: 'The Coral Bank Job',
    giver: 'Marco',
    brief: 'Pick up the crew at the diner, hit Coral Bank, grab the cash and lose the cops.',
    objectives: [
      { type: 'goto', x: 1470, y: 1050, r: 70, text: 'Pick up the crew at Lena\'s Diner' },
      { type: 'goto', x: 2310, y: 630, r: 70, text: 'Reach Coral Bank' },
      { type: 'wait', seconds: 6, text: 'Crack the vault — hold on!' },
      { type: 'escape', seconds: 25, text: 'Lose the cops! Stay out of sight until the heat dies' },
    ],
    reward: MISSION_REWARDS[2],
    wantedOnStart: 0,
    wantedOnVault: 3,
  },
  {
    id: 'harbor-heat',
    title: 'Harbour Heat',
    giver: 'Dana',
    brief: 'A rival courier is running product out of the harbour. Ram his car until it gives up.',
    objectives: [
      { type: 'goto', x: 2730, y: 2100, r: 90, text: 'Find the courier at the harbour' },
      { type: 'ram', text: 'Ram the courier\'s car until it breaks down' },
      { type: 'goto', x: 1470, y: 1890, r: 70, text: 'Bring the product back to Dana\'s garage' },
    ],
    reward: MISSION_REWARDS[3],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    giver: 'Marco',
    brief: 'The whole force is coming down. Survive the storm, then make it to the hideout.',
    objectives: [
      { type: 'survive', seconds: 60, text: 'Survive the full-force response — 60 seconds' },
      { type: 'goto', x: 630, y: 1890, r: 80, text: 'Slip away to the hideout on Palm Court' },
    ],
    reward: MISSION_REWARDS[4],
    wantedOnStart: 4,
  },
];

export class MissionRunner {
  constructor() {
    this.index = 0;              // which mission is active
    this.objIndex = 0;           // which objective inside it
    this.state = 'idle';         // idle | active | done | failed
    this.timer = 0;              // objective countdown
    this.waitT = 0;
    this.message = '';
    this.messageT = 0;
    this.completedCount = 0;
  }
  get mission() { return MISSIONS[this.index] || null; }
  get objective() {
    const m = this.mission;
    return m ? m.objectives[this.objIndex] : null;
  }
  start(index) {
    this.index = index;
    this.objIndex = 0;
    this.state = 'active';
    this.timer = 0;
    this.waitT = 0;
    const m = this.mission;
    this.message = `${m.title} — ${m.giver}: ${m.brief}`;
    this.messageT = 6;
    return m;
  }
  fail(reason) {
    this.state = 'failed';
    this.message = `Mission failed: ${reason}`;
    this.messageT = 5;
  }
  completeObjective(game) {
    this.objIndex++;
    const m = this.mission;
    if (this.objIndex >= m.objectives.length) {
      this.state = 'done';
      this.completedCount++;
      game.cash += m.reward;
      game.stats.missionsDone++;
      this.message = `Mission complete! +$${m.reward}`;
      this.messageT = 5;
      return 'mission-done';
    }
    const next = this.objective;
    this.message = next.text;
    this.messageT = 4;
    return 'objective-done';
  }
  // Called every frame while a mission is active. Returns events.
  update(dt, game) {
    if (this.state !== 'active') return;
    const m = this.mission, o = this.objective;
    if (!o) return;
    if (this.messageT > 0) this.messageT -= dt;
    if (m.timeLimit) {
      this.timer += dt;
      if (this.timer > m.timeLimit) { this.fail('Out of time'); return; }
    }
    const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
    const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;
    if (o.type === 'stealCar') {
      if (game.player.inCar) this.completeObjective(game);
    } else if (o.type === 'goto') {
      const d = Math.hypot(px - o.x, py - o.y);
      if (d < o.r) {
        if (m.id === 'bank-job' && this.objIndex === 1) game.setWanted(3, true);
        this.completeObjective(game);
      }
    } else if (o.type === 'wait') {
      this.waitT += dt;
      if (this.waitT >= o.seconds) { this.waitT = 0; this.completeObjective(game); }
    } else if (o.type === 'escape') {
      this.waitT += dt;
      if (game.wanted <= 0) { this.waitT = 0; this.completeObjective(game); }
      else if (this.waitT >= o.seconds) { this.waitT = 0; game.setWanted(0, true); this.completeObjective(game); }
    } else if (o.type === 'ram') {
      if (game.targetCar && game.targetCar.health <= 25) {
        game.targetCar.driver = null; game.targetCar.parked = true;
        this.completeObjective(game);
      }
    } else if (o.type === 'survive') {
      this.waitT += dt;
      game.setWanted(5, false);
      if (this.waitT >= o.seconds) { this.waitT = 0; game.setWanted(2, true); this.completeObjective(game); }
    }
  }
  // Distance to the current goto objective, for the HUD compass.
  objectiveDistance(game) {
    const o = this.objective;
    if (!o || o.type !== 'goto') return null;
    const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
    const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;
    return Math.hypot(px - o.x, py - o.y);
  }
}
