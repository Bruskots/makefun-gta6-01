// HUD, minimap, menus and banners — everything drawn on top of the
// world: cash, health, wanted stars, mission tracker, minimap, the
// title screen, pause, busted/wasted and mission-complete panels.
import { WORLD, CITY, PALETTE, MISSION_REWARDS } from './config.js';

export class Hud {
  draw(ctx, game) {
    if (game.screen === 'title') { this.drawTitle(ctx, game); return; }
    this.drawTopBar(ctx, game);
    this.drawMinimap(ctx, game);
    this.drawMissionBox(ctx, game);
    this.drawControlsHint(ctx, game);
    if (game.screen === 'paused') this.drawPaused(ctx, game);
    if (game.screen === 'busted' || game.screen === 'wasted') this.drawEndPanel(ctx, game);
    if (game.screen === 'complete') this.drawCompletePanel(ctx, game);
    if (game.missions.messageT > 0 && game.missions.message) this.drawBanner(ctx, game);
    if (game.toastT > 0 && game.toast) this.drawToast(ctx, game);
  }

  drawTopBar(ctx, game) {
    const pl = game.player;
    // Cash.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(14, 12, 190, 44, 8); ctx.fill();
    ctx.fillStyle = '#37e07a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 26, 42);
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(14, 64, 190, 20, 8); ctx.fill();
    ctx.fillStyle = pl.health > 30 ? '#37e07a' : '#e03a3a';
    ctx.beginPath(); ctx.roundRect(18, 68, 182 * (pl.health / 100), 12, 5); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`HEALTH ${Math.ceil(pl.health)}`, 22, 78);
    // Ammo.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(14, 90, 190, 26, 8); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`AMMO ${pl.ammo}   ${pl.inCar ? 'IN CAR — E to exit' : 'E near a car to steal it'}`, 22, 108);
    // Wanted stars, top right.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(1280 - 14 - 5 * 34 - 16, 12, 5 * 34 + 16, 44, 8); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillStyle = i < Math.round(game.wanted) ? '#ffd23e' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 1280 - 14 - (5 - i) * 34 + 4, 44);
    }
    // Clock / day.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(1280 - 210, 64, 196, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const mins = Math.floor(game.playTime / 60);
    ctx.fillText(`SOLMAR BAY  ${String(10 + Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, 1280 - 200, 82);
  }

  drawMinimap(ctx, game) {
    const size = 190, mx = 1280 - size - 14, my = 720 - size - 14;
    const sx = size / WORLD.w, sy = size / WORLD.h;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, size + 12, size + 12, 10); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, size, size); ctx.clip();
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(mx, my, size, size);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(mx, my + CITY.beachY * sy, size, size - CITY.beachY * sy);
    ctx.fillStyle = PALETTE.road;
    for (const rx of game.city.roadsX) ctx.fillRect(mx + rx * sx - 2, my, 4, CITY.beachY * sy);
    for (const ry of game.city.roadsY) ctx.fillRect(mx, my + ry * sy - 2, size, 4);
    // Mission marker.
    const o = game.missions.objective;
    if (game.missions.state === 'active' && o && o.type === 'goto') {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx + o.x * sx, my + o.y * sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx + o.x * sx, my + o.y * sy, 8, 0, Math.PI * 2); ctx.stroke();
    }
    // Police blips (blue) and player (white arrow).
    ctx.fillStyle = '#2e6bff';
    for (const c of game.traffic.cars) if (c.police) { ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
    const pl = game.player;
    const px = pl.inCar && pl.car ? pl.car.x : pl.x;
    const py = pl.inCar && pl.car ? pl.car.y : pl.y;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('SOLMAR BAY', mx + 4, my - 10);
  }

  drawMissionBox(ctx, game) {
    const m = game.missions.mission;
    if (!m || game.missions.state === 'idle') return;
    const o = game.missions.objective;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect(14, 124, 380, 76, 8); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`${game.missions.index + 1}. ${m.title}  —  $${m.reward}`, 26, 148);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    const line = o ? o.text : 'Mission complete!';
    ctx.fillText(line.length > 56 ? line.slice(0, 56) + '…' : line, 26, 170);
    // Progress / timer line.
    ctx.fillStyle = '#cfe8ff';
    ctx.font = '12px system-ui, sans-serif';
    let extra = '';
    if (m.timeLimit) extra = `Time left ${Math.max(0, Math.ceil(m.timeLimit - game.missions.timer))}s`;
    else if (o && o.type === 'wait') extra = `Cracking… ${Math.ceil(o.seconds - game.missions.waitT)}s`;
    else if (o && o.type === 'survive') extra = `Survive ${Math.ceil(o.seconds - game.missions.waitT)}s`;
    else if (o && o.type === 'escape') extra = 'Lose the cops!';
    else if (o) {
      const d = game.missions.objectiveDistance(game);
      if (d != null) extra = `${Math.round(d)}m away`;
    }
    if (extra) ctx.fillText(extra, 26, 190);
  }

  drawControlsHint(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(14, 720 - 34, 560, 24, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD move / drive · E enter car · Click shoot · Shift sprint · M mute · P pause · R restart mission', 22, 720 - 17);
  }

  drawBanner(ctx, game) {
    const msg = game.missions.message;
    ctx.font = 'bold 17px system-ui, sans-serif';
    const w = Math.min(900, ctx.measureText(msg).width + 48);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.roundRect((1280 - w) / 2, 636, w, 40, 8); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(msg, 640, 662);
    ctx.textAlign = 'left';
  }

  drawToast(ctx, game) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(game.toast).width + 36;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.roundRect((1280 - w) / 2, 220, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(game.toast, 640, 242);
    ctx.textAlign = 'left';
  }

  drawTitle(ctx, game) {
    // Dusk gradient over the city + big title.
    const g = ctx.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, 'rgba(20,16,60,0.25)');
    g.addColorStop(0.6, 'rgba(180,80,40,0.28)');
    g.addColorStop(1, 'rgba(20,16,60,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.fillText('SOLMAR BAY', 640, 210);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('An open-world crime story', 640, 258);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Steal cars. Outrun the law. Build your name from the harbour to the hills.', 640, 296);
    // Mission list.
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('FIVE MISSIONS  ·  RICO VEGA', 640, 350);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    const names = ['1. First Wheels — steal your first car', '2. Sunset Deliveries — three drops, one timer', '3. The Coral Bank Job — the big score', '4. Harbour Heat — ram the rival courier', '5. King of Solmar — survive the full force'];
    names.forEach((n, i) => ctx.fillText(n, 640, 380 + i * 24));
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#37e07a';
    const blink = Math.sin(game.titleTime * 3) > -0.2;
    if (blink) ctx.fillText('PRESS ENTER OR CLICK TO START', 640, 560);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('WASD move / drive · E enter or steal a car · Mouse aim, click to shoot · Shift sprint', 640, 600);
    ctx.fillText(`Best so far: ${game.stats.missionsDone} missions done · $${game.cash.toLocaleString('en-US')} earned · saved progress loads automatically`, 640, 626);
    ctx.textAlign = 'left';
  }

  drawPaused(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', 640, 330);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('P to resume · R to restart the mission · M to mute', 640, 372);
    ctx.textAlign = 'left';
  }

  drawEndPanel(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    const busted = game.screen === 'busted';
    ctx.fillStyle = busted ? '#2e6bff' : '#e03a3a';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(busted ? 'BUSTED!' : 'WASTED!', 640, 320);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(busted ? 'The Solmar PD caught up with Rico. The story continues…' : 'Rico went down. The city keeps moving without him.', 640, 360);
    ctx.fillText(`Cash kept: $${game.cash.toLocaleString('en-US')} · Missions done: ${game.stats.missionsDone}`, 640, 392);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#37e07a';
    ctx.fillText('PRESS ENTER TO KEEP PLAYING', 640, 450);
    ctx.textAlign = 'left';
  }

  drawCompletePanel(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('KING OF SOLMAR!', 640, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Rico Vega owns this city now. All five missions complete.', 640, 348);
    ctx.fillText(`Total earned: $${game.stats.totalEarned.toLocaleString('en-US')} · Cars stolen: ${game.stats.carsStolen} · Cops dodged: ${game.stats.copsDodged}`, 640, 384);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#37e07a';
    ctx.fillText('PRESS ENTER TO KEEP EXPLORING THE CITY', 640, 440);
    ctx.textAlign = 'left';
  }
}
