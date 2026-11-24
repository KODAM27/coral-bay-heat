// Coral Bay Heat — tuning constants for the city, the law and the player.
// Everything the other modules need to agree on lives here: the street grid,
// the physics numbers, the wanted-level economy and the save-game key.
export const STEP = 1 / 60;

/** Street grid: blocks of BLOCK px separated by ROAD px of asphalt. */
export const BLOCK = 232;
export const ROAD = 76;
export const PITCH = BLOCK + ROAD;
export const COLS = 6;
export const ROWS = 5;

/** The city proper ends at CITY_W; east of it is sand, then the bay itself. */
export const CITY_W = COLS * PITCH + ROAD;
export const SAND_W = 156;
export const WORLD_W = CITY_W + SAND_W + 320;
export const WORLD_H = ROWS * PITCH + ROAD;
export const WATER_X = CITY_W + SAND_W;

/** Player on foot. */
export const FOOT = {
  radius: 10,
  walk: 138,
  sprint: 208,
};

/** Car handling, per kind: top speed, acceleration, grip and bulk. */
export const CAR_KINDS = {
  sedan: { top: 252, accel: 265, grip: 7.5, radius: 14, hp: 100, label: 'Sedan' },
  taxi: { top: 244, accel: 255, grip: 7.5, radius: 14, hp: 100, label: 'Taxi' },
  sport: { top: 348, accel: 385, grip: 8.5, radius: 14, hp: 90, label: 'Sports car' },
  van: { top: 208, accel: 215, grip: 6.5, radius: 16, hp: 150, label: 'Van' },
  police: { top: 318, accel: 340, grip: 8.5, radius: 14, hp: 130, label: 'Interceptor' },
};

/** Wanted economy: heat 0..500, one star per 100 heat. */
export const HEAT = {
  steal: 120,
  shoot: 55,
  hitCar: 45,
  hitPed: 130,
  killPed: 220,
  hitPolice: 110,
  decayPerSecond: 7,
  unseenAfter: 4,
};

/** Combat. */
export const PISTOL = { rate: 0.24, speed: 780, damage: 34, range: 460 };
export const FIST = { rate: 0.34, reach: 27, damage: 26 };

export const SAVE_KEY = 'coral-bay-heat-save-v1';

/** Palette: sun-bleached pastels over turquoise water. */
export const COLORS = {
  water: '#1b7f9e',
  waterDeep: '#146a86',
  sand: '#ecd29a',
  grass: '#79b657',
  sidewalk: '#cfc8bb',
  blockGround: '#b9bfae',
  plaza: '#d9cf9f',
  parking: '#5c6068',
  road: '#3d4148',
  roadEdge: '#e8e4da',
  dash: '#f5d76e',
  buildingShadow: 'rgba(20,26,38,0.35)',
  palmTrunk: '#8a6642',
  palmLeaf: '#3e9e4f',
  player: '#ffcf3f',
  playerSkin: '#e8b08a',
  marker: '#ffd83d',
  target: '#ff3fa4',
  hp: '#58d158',
  hpLow: '#e5484d',
  cash: '#7be495',
  hudBg: 'rgba(10,16,26,0.55)',
};

export const BUILDING_PALETTE = [
  '#f2e3c9', '#eec9a3', '#dfe9f2', '#f6d7d7', '#cfe3d0', '#f9ecc8',
  '#e3d7f2', '#f2f2f2', '#ffd9b0', '#cfe8f5', '#f7c8d8', '#dde8c8',
];

export const CAR_COLORS = ['#d94f4f', '#4f79d9', '#f2f2f2', '#2f2f36', '#f2a541', '#57b26a', '#9b59c9', '#e8e3d5', '#4fc3d9'];
