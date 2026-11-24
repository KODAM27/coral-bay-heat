// Coral Bay Heat — the whole simulation: one drifter, a city of stealable
// cars, traffic that minds its own business, pedestrians, a five-star
// wanted system with police who chase and ram, fists and a pistol, and
// Marina's four-job story chain. No drawing and no browser in here: step()
// advances one fixed step from a plain input object and returns what
// happened as EVENT_* flags, so the caller can play sounds and watch for
// the run ending without the world knowing about screens.
import {
  CAR_KINDS, CAR_COLORS, FIST, FOOT, HEAT, PISTOL, WORLD_H, WORLD_W,
} from './config.js';
import { buildCity, resolveBuildings } from './city.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_HIT = 4;
export const EVENT_CRASH = 8;
export const EVENT_CASH = 16;
export const EVENT_COMPLETE = 32;
export const EVENT_BUSTED = 64;
export const EVENT_WASTED = 128;
export const EVENT_BLIP = 256;

const LANE = 19; // right-hand traffic offset from a road's centre line
const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]; // E S W N

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** The story: four jobs for Marina, then the city is yours. */
export const MISSIONS = [
  {
    id: 'meet', title: 'First Contact',
    objective: 'Meet Marina at her cafe on the beach',
    intro: 'Marina runs the cafe on Coral Bay beach — and half the city’s quiet business.',
  },
  {
    id: 'steal', title: 'Hot Wheels',
    objective: 'Steal the pink Comet sports car from the lot on 4th & Palm',
    intro: 'A collector left a pink Comet in a lot mid-town. Marina wants it.',
  },
  {
    id: 'deliver', title: 'Special Delivery',
    objective: 'Deliver the Comet to the Chop Shop, fast and in one piece',
    intro: 'The Chop Shop pays for the Comet — more if it arrives quickly.',
  },
  {
    id: 'getaway', title: 'The Getaway',
    objective: 'Lose the heat, then reach the Hideout on the west side',
    intro: 'Every cop in Coral Bay is looking for you. Cool it, then get home.',
  },
];

export function createWorld(rand) {
  const city = buildCity(rand);
  const state = {};
  let events = 0;

  function makeCar(x, y, angle, kind, color, mode, id) {
    return {
      x, y, vx: 0, vy: 0, angle, speed: 0, kind, color, mode, id: id || '',
      hp: CAR_KINDS[kind].hp, hot: false, roadType: 'h', roadIdx: 0, dir: 0,
      cruise: 0, panic: 0, smoke: 0,
    };
  }

  function nearestRoadIndex(centres, value) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < centres.length; i += 1) {
      const d = Math.abs(centres[i] - value);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function spawnTraffic(n) {
    for (let k = 0; k < n; k += 1) {
      const horizontal = rand.chance(0.5);
      const kind = rand.pick(['sedan', 'sedan', 'taxi', 'van']);
      let car;
      if (horizontal) {
        const j = rand.int(0, city.roads.h.length - 1);
        const dir = rand.chance(0.5) ? 0 : 2;
        car = makeCar(rand.range(80, city.bounds.w - 500), city.roads.h[j] + (dir === 0 ? LANE : -LANE), dir === 0 ? 0 : Math.PI, kind, kind === 'taxi' ? '#f2c14e' : rand.pick(CAR_COLORS), 'traffic');
        car.roadType = 'h'; car.roadIdx = j; car.dir = dir;
      } else {
        const i = rand.int(0, city.roads.v.length - 1);
        const dir = rand.chance(0.5) ? 1 : 3;
        car = makeCar(city.roads.v[i] + (dir === 1 ? -LANE : LANE), rand.range(80, city.bounds.h - 200), dir === 1 ? Math.PI / 2 : -Math.PI / 2, kind, kind === 'taxi' ? '#f2c14e' : rand.pick(CAR_COLORS), 'traffic');
        car.roadType = 'v'; car.roadIdx = i; car.dir = dir;
      }
      car.cruise = CAR_KINDS[kind].top * rand.range(0.4, 0.55);
      state.cars.push(car);
    }
  }

  function spawnPeds(n) {
    for (let k = 0; k < n; k += 1) {
      const bi = rand.int(0, 5);
      const bj = rand.int(0, 4);
      const rect = { x: bi * 308 + 76 + 7, y: bj * 308 + 76 + 7, w: 218, h: 218 };
      state.peds.push({
        x: rect.x + rand.range(0, rect.w), y: rect.y, rect, s: rand.range(0, 872),
        speed: rand.range(34, 58), hp: 60, mode: 'walk', fleeT: 0, downT: 0,
        vx: 0, vy: 0, shirt: rand.pick(['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#f2f2f2', '#ff8a65']),
        lastCrimeT: -9,
      });
    }
  }

  function reset(save) {
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.particles = [];
    for (const p of city.parked) {
      state.cars.push(makeCar(p.x, p.y, p.angle, p.kind, p.color, 'parked', p.id));
    }
    spawnTraffic(14);
    spawnPeds(22);
    const cafe = city.landmarks.cafe;
    state.player = {
      x: cafe.x + 30, y: cafe.y + 26, vx: 0, vy: 0, angle: -Math.PI / 2,
      hp: 100, cash: 25, car: null, hasPistol: false, fireT: 0, punchT: 0,
      bust: 0, hurtT: 0, deadT: 0,
    };
    state.heat = 0;
    state.stars = 0;
    state.unseenT = 0;
    state.missionIndex = 0;
    state.missionT = 0;
    state.storyDone = false;
    state.job = null;
    state.banner = null;
    state.over = null;
    state.overT = 0;
    state.earned = 0;
    state.saveT = 0;
    if (save) {
      state.player.cash = save.cash | 0;
      state.player.hasPistol = !!save.hasPistol;
      state.missionIndex = Math.min(save.missionIndex | 0, MISSIONS.length);
      state.storyDone = state.missionIndex >= MISSIONS.length;
      if (typeof save.x === 'number' && typeof save.y === 'number') {
        state.player.x = save.x;
        state.player.y = save.y;
      }
      state.earned = save.earned | 0;
    }
  }

  function serialize() {
    return {
      cash: state.player.cash, hasPistol: state.player.hasPistol,
      missionIndex: state.missionIndex, x: Math.round(state.player.x),
      y: Math.round(state.player.y), earned: state.earned,
    };
  }

  function setBanner(title, sub, seconds) {
    state.banner = { title, sub: sub || '', t: seconds || 3.4 };
  }

  function crime(amount, x, y) {
    state.heat = Math.min(500, state.heat + amount);
    // A crime seen by a cop or a crowd keeps the heat fresh.
    let seen = false;
    for (const c of state.cars) {
      if (c.mode === 'police' && dist2(c.x, c.y, x, y) < 380 * 380) { seen = true; break; }
    }
    if (!seen) {
      for (const p of state.peds) {
        if (p.mode !== 'down' && dist2(p.x, p.y, x, y) < 200 * 200) { seen = true; break; }
      }
    }
    if (seen) state.unseenT = 0;
  }

  function pay(amount, why) {
    state.player.cash += amount;
    state.earned += amount;
    events |= EVENT_CASH;
    setBanner(`+$${amount}`, why, 2.2);
  }

  function spawnPolice() {
    // Come from HQ or roll in off a boundary road, always a way off-screen.
    const p = state.player;
    const fromHQ = rand.chance(0.4);
    let x;
    let y;
    if (fromHQ) {
      x = city.landmarks.police.x;
      y = city.landmarks.police.y;
      if (dist2(x, y, p.x, p.y) < 420 * 420) { x = 60; y = 60; }
    } else {
      const side = rand.int(0, 3);
      x = side === 0 ? 50 : side === 1 ? city.bounds.w - 380 : rand.range(100, city.bounds.w - 400);
      y = side === 2 ? 50 : side === 3 ? city.bounds.h - 50 : rand.range(100, city.bounds.h - 100);
      if (side <= 1) y = rand.range(80, city.bounds.h - 80);
    }
    const car = makeCar(x, y, Math.atan2(p.y - y, p.x - x), 'police', '#f2f2f2', 'police');
    state.cars.push(car);
    return car;
  }

  function missionMarker() {
    const m = MISSIONS[state.missionIndex];
    if (!m) return null;
    if (m.id === 'meet') return { x: city.landmarks.cafe.x, y: city.landmarks.cafe.y, label: 'Marina' };
    if (m.id === 'steal') {
      const t = state.cars.find((c) => c.id === 'target');
      return t ? { x: t.x, y: t.y, label: 'The Comet' } : null;
    }
    if (m.id === 'deliver') {
      const t = state.cars.find((c) => c.id === 'target');
      if (state.player.car && state.player.car.id === 'target') {
        return { x: city.landmarks.chopshop.x, y: city.landmarks.chopshop.y, label: 'Chop Shop' };
      }
      return t ? { x: t.x, y: t.y, label: 'The Comet' } : null;
    }
    if (m.id === 'getaway') return { x: city.landmarks.hideout.x, y: city.landmarks.hideout.y, label: 'Hideout' };
    return null;
  }

  function completeMission() {
    const m = MISSIONS[state.missionIndex];
    events |= EVENT_COMPLETE;
    if (m.id === 'meet') {
      state.player.hasPistol = true;
      pay(50, 'Marina: “Take my pistol. You’ll need it.”');
    } else if (m.id === 'steal') {
      setBanner('HOT WHEELS', 'Now get the Comet to the Chop Shop!', 3);
    } else if (m.id === 'deliver') {
      const bonus = state.missionT < 75 ? 100 : 0;
      pay(400 + bonus, bonus ? 'Delivered fast — Chop Shop bonus included.' : 'The Chop Shop takes the Comet.');
    } else if (m.id === 'getaway') {
      pay(600, 'Story complete. Coral Bay is yours — odd jobs pay cash.');
      state.storyDone = true;
    }
    state.missionIndex += 1;
    state.missionT = 0;
    if (state.missionIndex < MISSIONS.length) {
      const next = MISSIONS[state.missionIndex];
      if (next.id === 'getaway') {
        // The Getaway opens at three stars: the whole force turns out.
        state.heat = Math.max(state.heat, 300);
        state.stars = 3;
      }
      setBanner(next.title.toUpperCase(), next.intro, 3.6);
    }
  }

  function checkMissions(dt) {
    const p = state.player;
    state.missionT += dt;
    if (state.storyDone) {
      // Free-roam odd jobs: a marker, a drive, a payday, forever.
      if (!state.job) {
        const spots = [city.landmarks.cafe, city.landmarks.chopshop, city.landmarks.hideout, city.landmarks.hospital, city.landmarks.police];
        const spot = spots[rand.int(0, spots.length - 1)];
        state.job = { x: spot.x + rand.range(-30, 30), y: spot.y + rand.range(-10, 30), reward: rand.int(80, 170) };
      } else if (dist2(p.x, p.y, state.job.x, state.job.y) < 42 * 42) {
        pay(state.job.reward, 'Odd job done.');
        state.job = null;
      }
      return;
    }
    const m = MISSIONS[state.missionIndex];
    if (!m) return;
    if (m.id === 'meet' && dist2(p.x, p.y, city.landmarks.cafe.x, city.landmarks.cafe.y) < 38 * 38) completeMission();
    else if (m.id === 'steal' && p.car && p.car.id === 'target') completeMission();
    else if (m.id === 'deliver' && p.car && p.car.id === 'target'
      && dist2(p.x, p.y, city.landmarks.chopshop.x, city.landmarks.chopshop.y) < 52 * 52) completeMission();
    else if (m.id === 'getaway' && state.stars <= 1
      && dist2(p.x, p.y, city.landmarks.hideout.x, city.landmarks.hideout.y) < 44 * 44) completeMission();
  }

  function hurtPlayer(amount, x, y) {
    const p = state.player;
    p.hp -= amount;
    p.hurtT = 0;
    events |= EVENT_HIT;
    if (x !== undefined) {
      const a = Math.atan2(p.y - y, p.x - x);
      p.vx += Math.cos(a) * 190;
      p.vy += Math.sin(a) * 190;
    }
    if (p.hp <= 0 && !state.over) {
      state.over = 'wasted';
      state.overT = 3;
      events |= EVENT_WASTED;
    }
  }

  function endRun(kind) {
    const p = state.player;
    const fine = kind === 'busted'
      ? Math.min(p.cash, 100 + state.stars * 60)
      : Math.min(p.cash, 150);
    p.cash -= fine;
    state.over = null;
    state.heat = 0;
    state.stars = 0;
    p.hp = 100;
    p.bust = 0;
    if (p.car) {
      p.car.mode = 'parked';
      p.car = null;
    }
    const spot = kind === 'busted' ? city.landmarks.police : city.landmarks.hospital;
    p.x = spot.x;
    p.y = spot.y;
    p.vx = 0;
    p.vy = 0;
    // The law melts away while you are processed.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].mode === 'police') state.cars.splice(i, 1);
    }
    setBanner(kind === 'busted' ? 'RELEASED' : 'PATCHED UP', `The city took $${fine} from you.`, 3);
  }

  function enterExitCar() {
    const p = state.player;
    if (p.car) {
      const car = p.car;
      car.mode = 'parked';
      car.speed = 0;
      p.car = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 22;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 22;
      const fixed = resolveBuildings(city, p.x, p.y, FOOT.radius);
      p.x = fixed.x;
      p.y = fixed.y;
      events |= EVENT_BLIP;
      return;
    }
    let best = null;
    let bestD = 34 * 34;
    for (const car of state.cars) {
      if (car.mode === 'police' || car.mode === 'wreck') continue;
      const d = dist2(p.x, p.y, car.x, car.y);
      if (d < bestD && Math.abs(car.speed) < 55) { bestD = d; best = car; }
    }
    if (!best) return;
    if (best.mode === 'traffic') {
      // The driver bails out and runs.
      state.peds.push({
        x: best.x + 16, y: best.y + 10, rect: null, s: 0, speed: 120, hp: 60,
        mode: 'flee', fleeT: 5, downT: 0, vx: 60, vy: 20, shirt: '#cccccc', lastCrimeT: -9,
      });
    }
    if (!best.hot) {
      best.hot = true;
      crime(HEAT.steal, best.x, best.y);
      setBanner('STOLEN', `A ${CAR_KINDS[best.kind].label.toLowerCase()} — the law noticed.`, 1.6);
    }
    best.mode = 'player';
    p.car = best;
    p.bust = 0;
    events |= EVENT_BLIP;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    p.fireT = Math.max(0, p.fireT - dt);
    p.punchT = Math.max(0, p.punchT - dt);
    p.hurtT += dt;
    if (p.hp < 100 && p.hurtT > 6) p.hp = Math.min(100, p.hp + 3 * dt);
    if (input.enter) enterExitCar();

    if (p.car) {
      const car = p.car;
      const spec = CAR_KINDS[car.kind];
      const throttle = -input.my; // W (my=-1) drives forward
      const steer = input.mx;
      if (car.hp > 0) {
        if (throttle > 0) car.speed += spec.accel * dt * (car.speed < 0 ? 2.2 : 1);
        else if (throttle < 0) car.speed -= spec.accel * 0.72 * dt * (car.speed > 0 ? 2.2 : 1);
      }
      car.speed -= car.speed * 0.55 * dt; // rolling drag
      if (throttle === 0) car.speed -= car.speed * 1.4 * dt;
      car.speed = Math.max(-95, Math.min(spec.top, car.speed));
      if (Math.abs(car.speed) > 4) {
        const turn = steer * 1.9 * Math.min(1, Math.abs(car.speed) / 120) * (car.speed >= 0 ? 1 : -1);
        car.angle += turn * dt;
      }
      // Velocity chases the heading; the gap between them is the drift.
      const grip = spec.grip;
      const tvx = Math.cos(car.angle) * car.speed;
      const tvy = Math.sin(car.angle) * car.speed;
      car.vx += (tvx - car.vx) * Math.min(1, grip * dt);
      car.vy += (tvy - car.vy) * Math.min(1, grip * dt);
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.speed = Math.hypot(car.vx, car.vy) * (Math.cos(car.angle) * car.vx + Math.sin(car.angle) * car.vy >= 0 ? 1 : -1);
      const before = Math.hypot(car.vx, car.vy);
      const fixed = resolveBuildings(city, car.x, car.y, spec.radius);
      if (fixed.x !== car.x || fixed.y !== car.y) {
        car.x = fixed.x;
        car.y = fixed.y;
        if (before > 130) {
          events |= EVENT_CRASH;
          car.hp -= (before - 110) / 6;
          hurtPlayer((before - 130) / 14);
          crime(HEAT.hitCar, car.x, car.y);
        }
        car.vx *= -0.22;
        car.vy *= -0.22;
        car.speed *= -0.22;
      }
      car.x = Math.max(16, Math.min(city.waterX - 10, car.x));
      car.y = Math.max(16, Math.min(WORLD_H - 16, car.y));
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      return;
    }

    // On foot: twin-stick — WASD moves, the mouse aims.
    const len = Math.hypot(input.mx, input.my);
    const speed = input.sprint ? FOOT.sprint : FOOT.walk;
    if (len > 0.01) {
      p.vx = (input.mx / len) * speed * Math.min(1, len);
      p.vy = (input.my / len) * speed * Math.min(1, len);
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const fixed = resolveBuildings(city, p.x, p.y, FOOT.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    p.x = Math.max(12, Math.min(city.waterX - 6, p.x));
    p.y = Math.max(12, Math.min(WORLD_H - 12, p.y));
    const aimD = Math.hypot(input.aimX - p.x, input.aimY - p.y);
    if (aimD > 4) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    else if (len > 0.01) p.angle = Math.atan2(input.my, input.mx);

    if (input.fire && p.fireT <= 0) {
      if (p.hasPistol) {
        p.fireT = PISTOL.rate;
        events |= EVENT_SHOT;
        crime(HEAT.shoot, p.x, p.y);
        scarePeds(p.x, p.y, 230);
        state.bullets.push({
          x: p.x + Math.cos(p.angle) * 14, y: p.y + Math.sin(p.angle) * 14,
          vx: Math.cos(p.angle) * PISTOL.speed, vy: Math.sin(p.angle) * PISTOL.speed,
          life: PISTOL.range / PISTOL.speed,
        });
      } else {
        p.fireT = FIST.rate;
        p.punchT = 0.18;
        events |= EVENT_PUNCH;
        // A swing at whoever is close: a ped, or a car's paintwork.
        for (const ped of state.peds) {
          if (ped.mode !== 'down' && dist2(p.x, p.y, ped.x, ped.y) < FIST.reach * FIST.reach) {
            damagePed(ped, FIST.damage, p.x, p.y, true);
          }
        }
        for (const car of state.cars) {
          if (car.mode !== 'player' && dist2(p.x, p.y, car.x, car.y) < 30 * 30) {
            car.hp -= FIST.damage / 3;
            crime(HEAT.hitCar, car.x, car.y);
          }
        }
      }
    }
  }

  function scarePeds(x, y, radius) {
    for (const ped of state.peds) {
      if (ped.mode === 'walk' && dist2(ped.x, ped.y, x, y) < radius * radius) {
        ped.mode = 'flee';
        ped.fleeT = rand.range(2.5, 4.5);
        const a = Math.atan2(ped.y - y, ped.x - x);
        ped.vx = Math.cos(a) * 130;
        ped.vy = Math.sin(a) * 130;
      }
    }
  }

  function damagePed(ped, amount, fromX, fromY, byPlayer) {
    ped.hp -= amount;
    events |= EVENT_HIT;
    if (ped.hp <= 0 && ped.mode !== 'down') {
      ped.mode = 'down';
      ped.downT = 9999;
      if (byPlayer) crime(HEAT.killPed, ped.x, ped.y);
    } else if (ped.mode !== 'down') {
      ped.mode = 'flee';
      ped.fleeT = 4;
      const a = Math.atan2(ped.y - fromY, ped.x - fromX);
      ped.vx = Math.cos(a) * 140;
      ped.vy = Math.sin(a) * 140;
      if (byPlayer) crime(HEAT.hitPed / 2, ped.x, ped.y);
    }
  }

  function stepTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.mode !== 'traffic') continue;
      const spec = CAR_KINDS[car.kind];
      let want = car.panic > 0 ? spec.top * 0.8 : car.cruise;
      car.panic = Math.max(0, car.panic - dt);
      // Brake for whatever is ahead: another car, or the player in the road.
      const fx = car.x + DIRS[car.dir].x * 54;
      const fy = car.y + DIRS[car.dir].y * 54;
      for (const other of state.cars) {
        if (other !== car && other.mode !== 'wreck' && dist2(fx, fy, other.x, other.y) < 30 * 30) { want = 0; break; }
      }
      if (want > 0 && !p.car && dist2(fx, fy, p.x, p.y) < 30 * 30) want = 0;
      car.speed += Math.max(-320 * dt, Math.min(140 * dt, want - car.speed));
      const along = DIRS[car.dir];
      const prevAlong = car.roadType === 'h' ? car.x : car.y;
      car.x += along.x * car.speed * dt;
      car.y += along.y * car.speed * dt;
      // Ease onto the lane line for the current direction.
      if (car.roadType === 'h') {
        const laneY = city.roads.h[car.roadIdx] + (car.dir === 0 ? LANE : -LANE);
        car.y += Math.max(-130 * dt, Math.min(130 * dt, laneY - car.y));
        car.angle = angleLerp(car.angle, car.dir === 0 ? 0 : Math.PI, Math.min(1, 8 * dt));
      } else {
        const laneX = city.roads.v[car.roadIdx] + (car.dir === 1 ? -LANE : LANE);
        car.x += Math.max(-130 * dt, Math.min(130 * dt, laneX - car.x));
        car.angle = angleLerp(car.angle, car.dir === 1 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, 8 * dt));
      }
      car.vx = along.x * car.speed;
      car.vy = along.y * car.speed;
      // Intersections: maybe turn; always turn rather than leave the city.
      const centres = car.roadType === 'h' ? city.roads.v : city.roads.h;
      const nowAlong = car.roadType === 'h' ? car.x : car.y;
      for (let k = 0; k < centres.length; k += 1) {
        const c = centres[k];
        const crossed = along.x + along.y > 0 ? (prevAlong < c && nowAlong >= c) : (prevAlong > c && nowAlong <= c);
        if (!crossed) continue;
        const atEdge = (car.roadType === 'h' && ((car.dir === 0 && k === centres.length - 1) || (car.dir === 2 && k === 0)))
          || (car.roadType === 'v' && ((car.dir === 1 && k === centres.length - 1) || (car.dir === 3 && k === 0)));
        if (atEdge || rand.chance(0.32)) {
          const newDir = car.roadType === 'h' ? (rand.chance(0.5) ? 1 : 3) : (rand.chance(0.5) ? 0 : 2);
          car.roadType = car.roadType === 'h' ? 'v' : 'h';
          car.roadIdx = k;
          car.dir = newDir;
        }
        break;
      }
      if (car.hp <= 0) car.mode = 'wreck';
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    const want = state.stars <= 0 ? 0 : Math.min(2 + state.stars, 6);
    let count = 0;
    for (const c of state.cars) if (c.mode === 'police') count += 1;
    if (count < want && rand.chance(0.05 + state.stars * 0.02)) spawnPolice();
    let nearest = Infinity;
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.mode !== 'police') continue;
      const d = Math.hypot(p.x - car.x, p.y - car.y);
      nearest = Math.min(nearest, d);
      if (state.stars <= 0 && d > 760) { state.cars.splice(i, 1); continue; }
      const spec = CAR_KINDS.police;
      const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.7 * dt, Math.min(2.7 * dt, diff));
      const topSpeed = state.stars <= 0 ? spec.top * 0.4 : spec.top * (d > 300 ? 1 : 0.82);
      car.speed += Math.max(-300 * dt, Math.min(spec.accel * dt, topSpeed - car.speed));
      car.vx = Math.cos(car.angle) * car.speed;
      car.vy = Math.sin(car.angle) * car.speed;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      const fixed = resolveBuildings(city, car.x, car.y, spec.radius);
      if (fixed.x !== car.x || fixed.y !== car.y) {
        car.x = fixed.x;
        car.y = fixed.y;
        car.speed *= 0.55;
      }
      car.x = Math.max(16, Math.min(city.waterX - 10, car.x));
      car.y = Math.max(16, Math.min(WORLD_H - 16, car.y));
      if (car.hp <= 0) car.mode = 'wreck';
    }
    // Being caught: a cop close by while you are slow or on foot.
    if (state.stars > 0 && nearest < 40 && (!p.car || Math.abs(p.car.speed) < 12)) {
      p.bust += dt;
      if (p.bust > 1.3 && !state.over) {
        state.over = 'busted';
        state.overT = 3;
        events |= EVENT_BUSTED;
      }
    } else {
      p.bust = Math.max(0, p.bust - dt * 1.6);
    }
    return nearest;
  }

  function stepCarCollisions(dt) {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (a.mode === 'parked' || a.mode === 'wreck') continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        const rr = CAR_KINDS[a.kind].radius + CAR_KINDS[b.kind].radius - 4;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 > rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        const push = (rr - d) / 2;
        if (a.mode !== 'parked') { a.x -= nx * push; a.y -= ny * push; }
        if (b.mode !== 'parked') { b.x += nx * push; b.y += ny * push; }
        const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
        const swap = (a.vx - b.vx) * 0.4;
        a.vx -= swap * nx * 2 * 0.5 + nx * rel * 0.1;
        a.vy -= swap * ny * 2 * 0.5 + ny * rel * 0.1;
        b.vx += swap * nx * 2 * 0.5 - nx * rel * 0.1;
        b.vy += swap * ny * 2 * 0.5 - ny * rel * 0.1;
        if (b.mode === 'parked' || b.mode === 'traffic') { b.speed *= 0.4; }
        if (rel > 60) {
          a.hp -= rel / 14;
          b.hp -= rel / 14;
          events |= EVENT_CRASH;
          const involvesPlayer = a.mode === 'player' || b.mode === 'player';
          const other = a.mode === 'player' ? b : a;
          if (involvesPlayer) {
            if (rel > 130) hurtPlayer((rel - 120) / 16);
            if (other.mode === 'police') crime(HEAT.hitPolice, other.x, other.y);
            else crime(HEAT.hitCar, other.x, other.y);
            if (other.mode === 'traffic') other.panic = 3;
          }
          spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 6);
        }
      }
      // Cars versus the player on foot: traffic brakes, but speed still hurts.
      const p = state.player;
      if (!p.car && a.mode !== 'parked') {
        const rr = CAR_KINDS[a.kind].radius + FOOT.radius - 2;
        if (dist2(a.x, a.y, p.x, p.y) < rr * rr && Math.abs(a.speed) > 55) {
          hurtPlayer(24, a.x, a.y);
          if (a.mode === 'traffic') a.panic = 3;
        }
      }
    }
  }

  function spawnSparks(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      state.particles.push({
        x, y, vx: rand.range(-120, 120), vy: rand.range(-120, 120),
        life: rand.range(0.2, 0.5), max: 0.5, color: '#ffd83d', size: rand.range(1.5, 3),
      });
    }
  }

  function stepPeds(dt) {
    const per = 872; // perimeter of a sidewalk rect (218 x 218)
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      if (ped.mode === 'flee') {
        ped.fleeT -= dt;
        ped.x += ped.vx * dt;
        ped.y += ped.vy * dt;
        ped.vx *= 1 - 1.6 * dt;
        ped.vy *= 1 - 1.6 * dt;
        const fixed = resolveBuildings(city, ped.x, ped.y, 8);
        ped.x = Math.max(10, Math.min(city.waterX - 4, fixed.x));
        ped.y = Math.max(10, Math.min(WORLD_H - 10, fixed.y));
        if (ped.fleeT <= 0) {
          ped.mode = 'walk';
          // Re-anchor to the nearest block sidewalk so walking resumes cleanly.
          const bi = Math.max(0, Math.min(5, Math.floor(ped.x / 308)));
          const bj = Math.max(0, Math.min(4, Math.floor(ped.y / 308)));
          ped.rect = { x: bi * 308 + 83, y: bj * 308 + 83, w: 218, h: 218 };
          ped.s = 0;
        }
        continue;
      }
      if (!ped.rect) { ped.mode = 'flee'; ped.fleeT = 2; continue; }
      ped.s = (ped.s + ped.speed * dt) % per;
      const r = ped.rect;
      const s = ped.s;
      if (s < r.w) { ped.x = r.x + s; ped.y = r.y; }
      else if (s < r.w + r.h) { ped.x = r.x + r.w; ped.y = r.y + (s - r.w); }
      else if (s < 2 * r.w + r.h) { ped.x = r.x + r.w - (s - r.w - r.h); ped.y = r.y + r.h; }
      else { ped.x = r.x; ped.y = r.y + r.h - (s - 2 * r.w - r.h); }
      // A fast car close by is worth running from, driver or not.
      for (const car of state.cars) {
        if ((car.mode === 'player' || car.mode === 'police') && Math.abs(car.speed) > 120
          && dist2(ped.x, ped.y, car.x, car.y) < 90 * 90) {
          ped.mode = 'flee';
          ped.fleeT = rand.range(2, 3.5);
          const a = Math.atan2(ped.y - car.y, ped.x - car.x);
          ped.vx = Math.cos(a) * 135;
          ped.vy = Math.sin(a) * 135;
          break;
        }
      }
    }
    // Cars running peds down.
    for (const ped of state.peds) {
      if (ped.mode === 'down') continue;
      for (const car of state.cars) {
        if (car.mode === 'parked' || car.mode === 'wreck') continue;
        if (Math.abs(car.speed) < 65) continue;
        const rr = CAR_KINDS[car.kind].radius + 7;
        if (dist2(ped.x, ped.y, car.x, car.y) < rr * rr) {
          const byPlayer = car.mode === 'player';
          damagePed(ped, 70, car.x, car.y, false);
          if (byPlayer && state.time - ped.lastCrimeT > 2) {
            ped.lastCrimeT = state.time;
            crime(HEAT.hitPed, ped.x, ped.y);
            events |= EVENT_HIT;
          }
          break;
        }
      }
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && resolveBuildings(city, b.x, b.y, 1).x !== b.x) dead = true;
      if (!dead) {
        for (const car of state.cars) {
          if (car.mode === 'player') continue;
          const rr = CAR_KINDS[car.kind].radius + 3;
          if (dist2(b.x, b.y, car.x, car.y) < rr * rr) {
            car.hp -= PISTOL.damage;
            if (car.mode === 'traffic') car.panic = 3;
            if (car.mode === 'police') crime(HEAT.hitPolice, car.x, car.y);
            if (car.hp <= 0 && car.mode !== 'wreck') {
              car.mode = 'wreck';
              spawnSparks(car.x, car.y, 14);
            }
            spawnSparks(b.x, b.y, 3);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.mode !== 'down' && dist2(b.x, b.y, ped.x, ped.y) < 11 * 11) {
            damagePed(ped, PISTOL.damage, b.x - b.vx * 0.01, b.y - b.vy * 0.01, true);
            dead = true;
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    // Smoke from hurt cars.
    for (const car of state.cars) {
      if (car.hp < 45 && car.mode !== 'wreck' && rand.chance(0.1)) {
        state.particles.push({
          x: car.x, y: car.y, vx: rand.range(-8, 8), vy: rand.range(-26, -14),
          life: rand.range(0.5, 0.9), max: 0.9, color: 'rgba(60,60,60,0.5)', size: rand.range(3, 6),
        });
      } else if (car.mode === 'wreck' && rand.chance(0.05)) {
        state.particles.push({
          x: car.x, y: car.y, vx: rand.range(-6, 6), vy: rand.range(-30, -18),
          life: rand.range(0.6, 1), max: 1, color: 'rgba(40,40,40,0.6)', size: rand.range(4, 7),
        });
      }
    }
  }

  function step(dt, input) {
    events = 0;
    state.time += dt;
    if (state.banner) {
      state.banner.t -= dt;
      if (state.banner.t <= 0) state.banner = null;
    }
    if (state.over) {
      state.overT -= dt;
      stepParticles(dt);
      if (state.overT <= 0) endRun(state.over);
      return events;
    }
    stepPlayer(dt, input);
    stepTraffic(dt);
    const nearestCop = stepPolice(dt);
    stepCarCollisions(dt);
    stepPeds(dt);
    stepBullets(dt);
    stepParticles(dt);
    // Wanted bookkeeping: the heat cools only while no cop can see you.
    if (nearestCop < 340) state.unseenT = 0;
    else state.unseenT += dt;
    if (state.unseenT > HEAT.unseenAfter && state.heat > 0) {
      state.heat = Math.max(0, state.heat - HEAT.decayPerSecond * dt);
    }
    state.stars = Math.min(5, Math.ceil(state.heat / 100));
    checkMissions(dt);
    state.saveT += dt;
    return events;
  }

  reset(null);
  return {
    state, city, step, reset, serialize,
    missionMarker,
    spawnPolice,
    setBanner,
    get events() { return events; },
  };
}
