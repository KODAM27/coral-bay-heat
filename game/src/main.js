// Coral Bay Heat — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, the renderer paints what is there,
// and the audio module turns the step's events into sound. Screens: title,
// play, paused (busted and wasted are the world's own overlays).
//
// ?seed=N fixes the city. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BLIP, EVENT_BUSTED, EVENT_CASH, EVENT_COMPLETE, EVENT_CRASH, EVENT_HIT, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_ENTER, ACTION_NEWGAME, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return typeof data === 'object' && data !== null && typeof data.cash === 'number' ? data : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { hasSave: false, saveInfo: null });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let enterArmed = false;

  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  function announce(message) {
    status.textContent = message;
  }

  function startNew() {
    clearSave();
    world.reset(null);
    save = null;
    screen = SCREEN_PLAY;
    world.setBanner('FIRST CONTACT', 'Meet Marina at her cafe on the beach.', 3.6);
    announce('New game. Meet Marina at her cafe.');
  }

  function startContinue() {
    if (!save) return;
    world.reset(save);
    screen = SCREEN_PLAY;
    announce('Welcome back to Coral Bay.');
  }

  function playEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash(true);
    else if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_COMPLETE) audio.complete();
    if (events & EVENT_BUSTED) audio.busted();
    if (events & EVENT_WASTED) audio.busted();
    if (events & EVENT_BLIP) audio.blip();
  }

  function buildStepInput(actions) {
    const move = input.move();
    const cam = renderer.getCamera();
    const enter = enterArmed || (actions & ACTION_ENTER) !== 0;
    enterArmed = false;
    return {
      mx: move.x,
      my: move.y,
      sprint: input.sprint(),
      fire: input.mouse.down,
      aimX: cam.x + input.mouse.x,
      aimY: cam.y + input.mouse.y,
      enter,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) enterArmed = true;

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONTINUE && save) startContinue();
      else if (actions & (ACTION_CONFIRM | ACTION_NEWGAME)) startNew();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }

    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        playEvents(world.step(STEP, buildStepInput(actions)));
        accumulator -= STEP;
        if (world.state.saveT > 5) {
          world.state.saveT = 0;
          writeSave();
        }
      }
    } else if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic rolls, nobody is playing.
      while (accumulator >= STEP) {
        const p = world.state.player;
        world.step(STEP, { mx: 0, my: 0, sprint: false, fire: false, aimX: p.x - 80, aimY: p.y - 40, enter: false });
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    // Continuous audio: engine, sirens, music.
    const p = world.state.player;
    let siren = 0;
    if (world.state.stars > 0) {
      let nearest = Infinity;
      for (const car of world.state.cars) {
        if (car.mode === 'police') nearest = Math.min(nearest, Math.hypot(car.x - p.x, car.y - p.y));
      }
      if (nearest < Infinity) siren = Math.max(0, 1 - nearest / 520);
    }
    audio.update(STEP, screen === SCREEN_PLAY && p.car ? p.car.speed : null, siren);

    renderer.draw(world, screen, { hasSave: !!save, saveInfo: save });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Coral Bay Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
