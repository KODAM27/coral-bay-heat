// Coral Bay Heat — drawing only: the world and the screen in, pixels out.
// A camera follows the player across the city; the HUD (health, cash, wanted
// stars, objective, weapon) and the minimap frame the view; the title,
// pause, busted and wasted screens are panels over the live city.
import { CAR_KINDS, COLORS, ROAD, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { MISSIONS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function hash(n) {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 2246822519) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, dpr: 1 };
  const cam = { x: 0, y: 0 };

  function resize() {
    view.dpr = window.devicePixelRatio || 1;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function text(value, x, y, size, color, align, weight) {
    ctx.font = `${weight || 600} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- the city ----------

  function drawGround(city, t) {
    // Land base, then sand, then the bay.
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(cam.x - 40, cam.y - 40, view.w + 80, view.h + 80);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(city.sandX, 0, city.waterX - city.sandX, WORLD_H);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(city.waterX, 0, WORLD_W - city.waterX, WORLD_H);
    ctx.fillStyle = COLORS.waterDeep;
    const off = (t * 14) % 90;
    for (let y = -90 + off; y < WORLD_H; y += 90) {
      ctx.fillRect(city.waterX + 26, y, 120, 7);
      ctx.fillRect(city.waterX + 190, y + 40, 90, 7);
    }
    // Block grounds and parking lots.
    for (let j = 0; j < 5; j += 1) {
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = COLORS.blockGround;
        ctx.fillRect(i * 308 + ROAD, j * 308 + ROAD, 232, 232);
      }
    }
    for (const lot of city.lots) {
      ctx.fillStyle = COLORS.parking;
      ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 10; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, lot.y + 12);
        ctx.lineTo(x, lot.y + 44);
        ctx.stroke();
      }
    }
    // Roads: asphalt bands, kerb lines, dashed centres.
    ctx.fillStyle = COLORS.road;
    for (const c of city.roads.h) ctx.fillRect(0, c - ROAD / 2, city.sandX, ROAD);
    for (const c of city.roads.v) ctx.fillRect(c - ROAD / 2, 0, ROAD, WORLD_H);
    ctx.fillStyle = COLORS.dash;
    const x0 = Math.max(0, Math.floor((cam.x - 60) / 46) * 46);
    const x1 = Math.min(city.sandX, cam.x + view.w + 60);
    for (const c of city.roads.h) {
      for (let x = x0; x < x1; x += 46) ctx.fillRect(x, c - 2, 26, 4);
    }
    const y0 = Math.max(0, Math.floor((cam.y - 60) / 46) * 46);
    const y1 = Math.min(WORLD_H, cam.y + view.h + 60);
    for (const c of city.roads.v) {
      for (let y = y0; y < y1; y += 46) ctx.fillRect(c - 2, y, 4, 26);
    }
  }

  function drawBuilding(b) {
    ctx.fillStyle = COLORS.buildingShadow;
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    // South face, then the roof.
    const face = Math.min(16, 6 + b.floors);
    ctx.fillStyle = shade(b.color, -28);
    ctx.fillRect(b.x, b.y + b.h - face, b.w, face + 4);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h - face + 2);
    // Windows, lit and dark by a hash of the building's seed.
    const cols = Math.max(2, Math.floor(b.w / 21));
    const rows = Math.max(2, Math.floor((b.h - face) / 19));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = hash(b.seed + r * 31 + c * 7) > 0.42;
        ctx.fillStyle = lit ? 'rgba(255,214,120,0.85)' : 'rgba(52,72,96,0.55)';
        ctx.fillRect(b.x + 8 + c * ((b.w - 14) / cols), b.y + 8 + r * ((b.h - face - 12) / rows), 9, 11);
      }
    }
    if (b.label) {
      const w = b.label.length * 9.5 + 18;
      ctx.fillStyle = 'rgba(12,18,28,0.82)';
      roundRect(b.x + b.w / 2 - w / 2, b.y + b.h / 2 - 13, w, 26, 5);
      ctx.fill();
      text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, 14, '#ffd83d', 'center', 800);
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawPalm(p) {
    ctx.strokeStyle = COLORS.palmTrunk;
    ctx.lineWidth = 3.5 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 3 * p.s, p.y - 13 * p.s);
    ctx.stroke();
    ctx.strokeStyle = COLORS.palmLeaf;
    ctx.lineWidth = 2.6 * p.s;
    const tx = p.x + 3 * p.s;
    const ty = p.y - 13 * p.s;
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2 + p.seed;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(
        tx + Math.cos(a) * 10 * p.s, ty + Math.sin(a) * 7 * p.s - 3,
        tx + Math.cos(a) * 16 * p.s, ty + Math.sin(a) * 11 * p.s + 4,
      );
      ctx.stroke();
    }
  }

  function drawCar(car, t) {
    const spec = CAR_KINDS[car.kind];
    const len = car.kind === 'van' ? 40 : car.kind === 'sport' ? 35 : 33;
    const wid = car.kind === 'van' ? 18 : 16;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(15,20,30,0.3)';
    roundRect(-len / 2 + 2, -wid / 2 + 3, len, wid, 5);
    ctx.fill();
    const wreck = car.mode === 'wreck';
    ctx.fillStyle = wreck ? '#3a3a40' : car.color;
    roundRect(-len / 2, -wid / 2, len, wid, 5);
    ctx.fill();
    if (car.kind === 'police' && !wreck) {
      ctx.fillStyle = '#20304a';
      ctx.fillRect(-len / 2 + 3, -wid / 2, 8, wid);
      ctx.fillRect(len / 2 - 11, -wid / 2, 8, wid);
      const flash = Math.floor(t * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff4040' : '#7a1010';
      ctx.fillRect(-6, -wid / 2 + 2, 5, 5);
      ctx.fillStyle = flash ? '#2255ff' : '#101f66';
      ctx.fillRect(1, -wid / 2 + 2, 5, 5);
      ctx.fillStyle = '#ffd83d';
      ctx.font = `800 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 2.5);
    }
    if (car.kind === 'taxi' && !wreck) {
      ctx.fillStyle = '#20304a';
      ctx.fillRect(-4, -4, 8, 8);
    }
    // Glass and roof.
    ctx.fillStyle = wreck ? '#22242a' : 'rgba(24,42,64,0.9)';
    ctx.fillRect(len * 0.08, -wid / 2 + 2.5, len * 0.2, wid - 5);
    ctx.fillStyle = wreck ? '#2c2e34' : shade(car.color, -18);
    if (car.kind !== 'police') {
      roundRect(-len * 0.22, -wid / 2 + 2.5, len * 0.26, wid - 5, 3);
      ctx.fill();
    }
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(len / 2 - 2.5, -wid / 2 + 2, 2.5, 3.5);
    ctx.fillRect(len / 2 - 2.5, wid / 2 - 5.5, 2.5, 3.5);
    ctx.restore();
    if (car.mode === 'player') {
      // A soft ring so your car is never lost in traffic.
      ctx.strokeStyle = 'rgba(255,216,61,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, spec.radius + 7 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (car.id === 'target') {
      ctx.strokeStyle = COLORS.target;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(car.x, car.y, spec.radius + 8 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPed(ped, t) {
    if (ped.mode === 'down') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(1.2);
      ctx.fillStyle = shade(ped.shirt, -40);
      ctx.fillRect(-9, -4, 18, 8);
      ctx.fillStyle = '#e8b08a';
      ctx.beginPath();
      ctx.arc(12, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(15,20,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 6, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = ped.mode === 'flee' || ped.speed > 70 ? Math.sin(t * 14 + ped.x) * 1.6 : Math.sin(t * 7 + ped.x) * 1;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b08a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 4.5 + bob * 0.3, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state, t) {
    const p = state.player;
    if (p.car) return;
    ctx.fillStyle = 'rgba(15,20,30,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 7, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    if (p.hasPistol) {
      ctx.fillStyle = '#22242a';
      ctx.fillRect(6, -1.6, 13, 3.2);
    } else if (p.punchT > 0) {
      ctx.fillStyle = '#e8b08a';
      ctx.beginPath();
      ctx.arc(15, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerSkin;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 1, 5, 0, Math.PI * 2);
    ctx.fill();
    // Bust meter while a cop is close enough to grab you.
    if (p.bust > 0.05) {
      ctx.fillStyle = 'rgba(10,16,26,0.7)';
      ctx.fillRect(p.x - 16, p.y - 26, 32, 6);
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(p.x - 15, p.y - 25, 30 * Math.min(1, p.bust / 1.3), 4);
    }
  }

  function drawMarker(x, y, color, t, label) {
    const bob = Math.sin(t * 3.2) * 5;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3.2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 190);
    ctx.lineTo(x, y - 18 + bob);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(x, y - 26 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15 + Math.sin(t * 3.2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    if (label) text(label, x, y - 48 + bob, 13, color, 'center', 800);
  }

  // ---------- HUD ----------

  function drawMinimap(world, t) {
    const { state, city } = world;
    const w = 196;
    const h = 150;
    const x = 14;
    const y = view.h - h - 14;
    const sx = w / WORLD_W;
    const sy = h / WORLD_H;
    ctx.fillStyle = 'rgba(10,18,28,0.78)';
    roundRect(x - 3, y - 3, w + 6, h + 6, 7);
    ctx.fill();
    ctx.fillStyle = '#274b63';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3f6b4f';
    ctx.fillRect(x, y, city.sandX * sx, h);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x + city.sandX * sx, y, (city.waterX - city.sandX) * sx, h);
    ctx.strokeStyle = 'rgba(230,230,230,0.5)';
    ctx.lineWidth = 1.5;
    for (const c of city.roads.h) {
      ctx.beginPath(); ctx.moveTo(x, y + c * sy); ctx.lineTo(x + city.sandX * sx, y + c * sy); ctx.stroke();
    }
    for (const c of city.roads.v) {
      ctx.beginPath(); ctx.moveTo(x + c * sx, y); ctx.lineTo(x + c * sx, y + h); ctx.stroke();
    }
    const marker = world.missionMarker();
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.job) dot(state.job.x, state.job.y, '#7be495', 3.5);
    for (const car of state.cars) {
      if (car.mode === 'police') dot(car.x, car.y, Math.floor(t * 4) % 2 ? '#ff5a5a' : '#5a8aff', 2.6);
      else if (car.id === 'target') dot(car.x, car.y, COLORS.target, 3.2);
    }
    if (marker) dot(marker.x, marker.y, COLORS.marker, 3.6 + Math.sin(t * 5) * 0.8);
    const p = state.player;
    dot(p.x, p.y, '#ffffff', 3.4);
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + p.x * sx, y + p.y * sy);
    ctx.lineTo(x + (p.x + Math.cos(p.angle) * 26) * sx, y + (p.y + Math.sin(p.angle) * 26) * sy);
    ctx.stroke();
    text('CORAL BAY', x + 4, y + h - 5, 9, 'rgba(255,255,255,0.65)', 'left', 700);
  }

  function drawHud(world, t) {
    const { state } = world;
    const p = state.player;
    // Top-left: health and cash.
    ctx.fillStyle = COLORS.hudBg;
    roundRect(12, 12, 218, 58, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(22, 24, 130, 13, 4);
    ctx.fill();
    ctx.fillStyle = p.hp > 30 ? COLORS.hp : COLORS.hpLow;
    roundRect(22, 24, 130 * Math.max(0, p.hp) / 100, 13, 4);
    ctx.fill();
    text('HP', 22, 21, 10, '#ffffff', 'left', 800);
    text(`$${p.cash}`, 22, 62, 21, COLORS.cash, 'left', 800);
    if (p.car) text(`${CAR_KINDS[p.car.kind].label} · ${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, 78, 62, 12.5, '#ffffff', 'left', 600);
    // Top-right: wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text('★', view.w - 30 - i * 30, 44, 27, i < state.stars ? '#ffd83d' : 'rgba(255,255,255,0.28)', 'center', 800);
    }
    if (state.stars > 0 && state.unseenT > 1) {
      text('losing them…', view.w - 22, 66, 11.5, 'rgba(255,255,255,0.75)', 'right', 600);
    }
    // Top-centre: the objective.
    const mission = MISSIONS[state.missionIndex];
    const marker = world.missionMarker();
    let title = '';
    let body = '';
    if (state.storyDone) {
      title = 'FREE ROAM';
      body = state.job ? `Odd job: reach the green marker — $${state.job.reward}` : 'Odd job incoming…';
    } else if (mission) {
      title = mission.title.toUpperCase();
      body = mission.objective;
      if (mission.id === 'getaway' && state.stars > 1) body = `Lose the heat first (${state.stars}★), then reach the Hideout`;
    }
    if (title) {
      ctx.font = `700 13px ${FONT}`;
      const bw = Math.max(ctx.measureText(body).width + 30, 240);
      ctx.fillStyle = COLORS.hudBg;
      roundRect(view.w / 2 - bw / 2, 12, bw, 52, 8);
      ctx.fill();
      text(title, view.w / 2, 32, 12.5, '#ffd83d', 'center', 800);
      text(body, view.w / 2, 54, 13.5, '#ffffff', 'center', 600);
      if (marker) {
        const d = Math.round(Math.hypot(marker.x - p.x, marker.y - p.y) / 10);
        text(`${d} m`, view.w / 2 + bw / 2 - 8, 32, 11.5, 'rgba(255,255,255,0.8)', 'right', 700);
      }
    }
    // Bottom-right: weapon and controls.
    text(p.car ? 'E — get out' : p.hasPistol ? 'PISTOL — click to shoot · E — enter car' : 'FISTS — click to punch · E — enter car', view.w - 16, view.h - 16, 12.5, 'rgba(255,255,255,0.8)', 'right', 600);
    // Centre banner (mission news, payouts).
    if (state.banner) {
      const b = state.banner;
      const alpha = Math.min(1, b.t / 0.5, (3.4 - b.t) / 0.4 + 0.4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = `800 15px ${FONT}`;
      const bw = Math.max(300, ctx.measureText(b.sub).width + 48);
      ctx.fillStyle = 'rgba(10,16,26,0.72)';
      roundRect(view.w / 2 - bw / 2, view.h * 0.2, bw, 74, 10);
      ctx.fill();
      text(b.title, view.w / 2, view.h * 0.2 + 34, 24, '#ffd83d', 'center', 800);
      text(b.sub, view.w / 2, view.h * 0.2 + 58, 13.5, '#ffffff', 'center', 600);
      ctx.restore();
    }
    drawMinimap(world, t);
  }

  function drawTitle(hasSave, saveInfo) {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, 'rgba(8,12,24,0.55)');
    grad.addColorStop(0.55, 'rgba(8,12,24,0.25)');
    grad.addColorStop(1, 'rgba(8,12,24,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);
    text('CORAL BAY', view.w / 2, view.h * 0.3, 64, '#ffd83d', 'center', 900);
    text('H E A T', view.w / 2, view.h * 0.3 + 58, 40, '#ff6b9d', 'center', 900);
    text('One drifter. One beach city. Every car unlocked, every cop awake.', view.w / 2, view.h * 0.3 + 96, 16.5, '#ffffff', 'center', 600);
    text('Marina has work for you — four jobs, real money, and the whole Coral Bay PD in the way.', view.w / 2, view.h * 0.3 + 120, 14, 'rgba(255,255,255,0.85)', 'center', 500);
    const lines = [
      'WASD / arrows — move & drive      Shift — sprint',
      'E — steal / leave a car      Mouse — aim      Click — shoot or punch',
      'P — pause      Stars bring police: break their line of sight to cool off',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.w / 2, view.h * 0.62 + i * 22, 13.5, 'rgba(255,255,255,0.9)', 'center', 600);
    }
    if (hasSave && saveInfo) {
      text(`ENTER — new game      C — continue ($${saveInfo.cash}, job ${Math.min(saveInfo.missionIndex + 1, 4)} of 4)`, view.w / 2, view.h * 0.8, 17, '#7be495', 'center', 800);
    } else {
      text('ENTER — start', view.w / 2, view.h * 0.8, 17, '#7be495', 'center', 800);
    }
  }

  function drawOver(state) {
    const wasted = state.over === 'wasted';
    ctx.fillStyle = wasted ? 'rgba(120,10,16,0.45)' : 'rgba(16,32,74,0.45)';
    ctx.fillRect(0, 0, view.w, view.h);
    text(wasted ? 'WASTED' : 'BUSTED', view.w / 2, view.h * 0.46, 58, wasted ? '#ff5a5a' : '#7ab5ff', 'center', 900);
    text(wasted ? 'The hospital patches you up — for a price.' : 'The Coral Bay PD takes its cut.', view.w / 2, view.h * 0.46 + 36, 15, '#ffffff', 'center', 600);
  }

  /** Paint one frame. `screen` is SCREEN_TITLE / SCREEN_PLAY / SCREEN_PAUSED. */
  function draw(world, screen, opts) {
    const { state, city } = world;
    const p = state.player;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    cam.x = Math.max(0, Math.min(Math.max(0, WORLD_W - view.w), p.x - view.w / 2));
    cam.y = Math.max(0, Math.min(Math.max(0, WORLD_H - view.h), p.y - view.h / 2));
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    const t = state.time;
    drawGround(city, t);
    for (const b of city.buildings) {
      if (b.x + b.w < cam.x - 30 || b.x > cam.x + view.w + 30 || b.y + b.h < cam.y - 30 || b.y > cam.y + view.h + 30) continue;
      drawBuilding(b);
    }
    for (const u of city.umbrellas) {
      ctx.fillStyle = u.color;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(u.x, u.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of city.palms) drawPalm(palm);
    // The story marker and the job marker float over the world.
    const marker = world.missionMarker();
    if (screen !== SCREEN_TITLE) {
      if (marker) drawMarker(marker.x, marker.y, COLORS.marker, t, marker.label);
      if (state.job) drawMarker(state.job.x, state.job.y, '#7be495', t, 'Odd job');
    }
    for (const ped of state.peds) drawPed(ped, t);
    for (const car of state.cars) drawCar(car, t);
    drawPlayer(state, t);
    // Bullets and particles.
    ctx.strokeStyle = '#fff3a0';
    ctx.lineWidth = 2;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (screen === SCREEN_TITLE) {
      drawTitle(opts && opts.hasSave, opts && opts.saveInfo);
      return;
    }
    drawHud(world, t);
    if (state.over) drawOver(state);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,12,24,0.5)';
      ctx.fillRect(0, 0, view.w, view.h);
      text('PAUSED', view.w / 2, view.h * 0.46, 44, '#ffffff', 'center', 900);
      text('P — resume', view.w / 2, view.h * 0.46 + 34, 15, 'rgba(255,255,255,0.85)', 'center', 600);
    }
  }

  return {
    draw,
    getCamera() {
      return { x: cam.x, y: cam.y, w: view.w, h: view.h };
    },
  };
}
