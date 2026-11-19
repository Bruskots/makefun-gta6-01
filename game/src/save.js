// Save / load through localStorage: cash, missions completed, stats and
// the player's last position. Nothing leaves the browser.
const KEY = 'solmar-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) { return null; }
}

export function writeSave(game) {
  try {
    const data = {
      cash: game.cash,
      missionsDone: game.missions.completedCount,
      stats: game.stats,
      player: { x: game.player.x, y: game.player.y },
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable — play on without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
