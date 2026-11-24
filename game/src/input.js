// Coral Bay Heat — keyboard and mouse input. Held keys are read as state
// every frame; one-shot presses (confirm, pause, enter/exit car) are queued
// as bit flags and taken once by the loop, so a press between frames is
// never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_NEWGAME = 8;
export const ACTION_CONTINUE = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_CAR = new Set(['KeyE']);
const NEW_GAME = new Set(['KeyN']);
const CONTINUE = new Set(['KeyC']);

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER_CAR.has(event.code)) actions |= ACTION_ENTER;
    else if (NEW_GAME.has(event.code)) actions |= ACTION_NEWGAME;
    else if (CONTINUE.has(event.code)) actions |= ACTION_CONTINUE;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    held(code) {
      return keys.has(code);
    },
    /** Movement axes from WASD/arrows: x and y in -1..1 (not normalised). */
    move() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    mouse,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
