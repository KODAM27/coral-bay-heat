// Coral Bay Heat — the screenshot scenes behind ?shot=start|play|end&seed=N.
// Each one builds the real world from the seed, stages a moment the game can
// genuinely reach, then plays the real rules forward for a fixed number of
// steps — so a screenshot is the game itself, and the same seed always
// frames the same moment.
import { STEP } from './config.js';
import { MISSIONS } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function idleInput(world) {
  const p = world.state.player;
  return { mx: 0, my: 0, sprint: false, fire: false, aimX: p.x - 80, aimY: p.y - 40, enter: false };
}

function stepN(world, n, makeInput) {
  for (let i = 0; i < n; i += 1) world.step(STEP, makeInput(world));
}

/** start: the title over the living city — traffic rolling past the beach. */
function stageStart(world) {
  stepN(world, 300, idleInput);
  return { screen: SCREEN_TITLE };
}

/** play: mid-delivery — the stolen Comet at speed, three stars, cops behind. */
function stagePlay(world) {
  const { state, city } = world;
  const p = state.player;
  p.hasPistol = true;
  p.cash = 175;
  state.missionIndex = 2; // Special Delivery
  const target = state.cars.find((c) => c.id === 'target');
  const roadY = city.roads.h[2];
  target.mode = 'player';
  target.hot = true;
  target.x = 640;
  target.y = roadY + 19;
  target.angle = 0;
  target.vx = 190;
  target.vy = 0;
  target.speed = 190;
  p.car = target;
  p.x = target.x;
  p.y = target.y;
  state.heat = 260; // three stars
  state.stars = 3;
  // Three interceptors roll in behind the Comet.
  const cops = [];
  for (let i = 0; i < 3; i += 1) {
    const cop = world.spawnPolice();
    cop.x = 640 - 170 - i * 74;
    cop.y = roadY - 16 + i * 30;
    cop.angle = 0;
    cop.speed = 210;
    cops.push(cop);
  }
  // Drive east for two and a half seconds, holding the lane.
  stepN(world, 150, (w) => {
    const car = w.state.player.car;
    if (!car) return idleInput(w);
    const desired = Math.atan2((roadY + 19) - car.y, 320);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return {
      mx: Math.max(-1, Math.min(1, diff * 2.4)), my: -1, sprint: false,
      fire: false, aimX: car.x + 200, aimY: car.y, enter: false,
    };
  });
  world.setBanner('SPECIAL DELIVERY', 'The Chop Shop is waiting — do not stop.', 3.4);
  return { screen: SCREEN_PLAY };
}

/** end: the story told — the Comet delivered, Marina paid, the city calm. */
function stageEnd(world) {
  const { state, city } = world;
  const p = state.player;
  p.hasPistol = true;
  p.cash = 1250;
  state.missionIndex = MISSIONS.length;
  state.storyDone = true;
  state.job = null;
  const target = state.cars.find((c) => c.id === 'target');
  const shop = city.landmarks.chopshop;
  target.mode = 'parked';
  target.x = shop.x - 30;
  target.y = shop.y + 6;
  target.angle = 0.12;
  target.speed = 0;
  target.vx = 0;
  target.vy = 0;
  p.car = null;
  p.x = shop.x + 26;
  p.y = shop.y + 12;
  p.angle = -2.2;
  state.heat = 0;
  state.stars = 0;
  stepN(world, 110, idleInput);
  world.setBanner('STORY COMPLETE', '+$600 — Marina pays up. Coral Bay is yours.', 3.4);
  return { screen: SCREEN_PLAY };
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'end') return stageEnd(world);
  return stageStart(world);
}
