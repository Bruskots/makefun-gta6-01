// SOLMAR BAY — shared tuning constants and palette.
// A fictional sun-soaked coastal city. Nothing here belongs to any
// commercial game: every name, place and character is invented.
export const WORLD = { w: 3400, h: 2600 };

export const CITY = {
  roadGap: 420,      // distance between road centre lines
  roadWidth: 96,
  blockPad: 26,      // buildings keep this clear of the road edge
  beachY: 2320,      // sand + water strip starts here
  parkBlock: { cx: 3, cy: 2 }, // block column/row that is a park
};

export const PLAYER = {
  walkSpeed: 235,
  sprintSpeed: 330,
  radius: 14,
  maxHealth: 100,
  punchRange: 34,
};

export const CAR = {
  accel: 620,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.9,
  grip: 0.92,
  length: 52,
  width: 26,
};

export const WANTED = {
  decayPerSec: 0.045,   // stars fall slowly when unseen
  maxStars: 5,
  policePerStar: 2,
  bustRadius: 30,
};

export const PALETTE = {
  grass: '#3f7a44',
  grassDry: '#5d8a4a',
  road: '#33363d',
  roadLine: '#e8d44d',
  sidewalk: '#8a8d94',
  sand: '#e3c98f',
  water: '#2e7fa8',
  waterDeep: '#1f5f86',
  buildingRoof: ['#b5543f', '#4f7fa8', '#c99a4b', '#7a5a9e', '#5a8a6a', '#a85a6e', '#6a7a8a'],
  buildingWall: ['#8a3f2f', '#3c6180', '#9a7434', '#5d4378', '#44684f', '#7e4252', '#4f5d68'],
  parkTree: '#2c6b34',
  parkPath: '#c9b183',
};

export const CAR_COLORS = [
  '#d94f3d', '#3d7ad9', '#e8c33a', '#37b06a', '#8a4fd9',
  '#e8e8e8', '#22242a', '#e07a2e', '#2ec4b6', '#c94f8a',
];

export const MISSION_REWARDS = [400, 900, 2500, 1800, 5000];

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Deterministic pseudo-random from an integer seed (mulberry32).
export function rngFrom(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
