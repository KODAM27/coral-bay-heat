// Coral Bay Heat — the city itself: a seeded street grid of pastel blocks
// between asphalt roads, a sand beach and the bay along the east edge.
// Landmarks the story needs (police HQ, hospital, the chop shop, Marina's
// cafe, the hideout) are pinned to fixed blocks; everything else is rolled
// from the seed: towers, parking lots full of stealable cars, palm plazas.
import {
  BLOCK, BUILDING_PALETTE, CAR_COLORS, CITY_W, COLS, PITCH, ROAD, ROWS,
  SAND_W, WATER_X, WORLD_H, WORLD_W,
} from './config.js';

/** Centre lines of the horizontal and vertical roads, for traffic and the minimap. */
export function roadCentres() {
  const h = [];
  const v = [];
  for (let j = 0; j <= ROWS; j += 1) h.push(j * PITCH + ROAD / 2);
  for (let i = 0; i <= COLS; i += 1) v.push(i * PITCH + ROAD / 2);
  return { h, v };
}

function blockRect(i, j) {
  return { x: i * PITCH + ROAD, y: j * PITCH + ROAD, w: BLOCK, h: BLOCK };
}

const LANDMARK_BLOCKS = {
  police: { i: 0, j: 0, label: 'POLICE HQ', color: '#33507e' },
  hideout: { i: 0, j: 2, label: 'HIDEOUT', color: '#8a6d4b' },
  hospital: { i: 0, j: 4, label: 'HOSPITAL', color: '#eef2f4' },
  chopshop: { i: 5, j: 1, label: 'CHOP SHOP', color: '#5c6068' },
  target: { i: 3, j: 2, label: '', color: '' },
};

export function buildCity(rand) {
  const buildings = [];
  const palms = [];
  const parked = [];
  const lots = [];
  const landmarks = {};

  function addBuilding(rect, color, floors, label) {
    const b = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, color, floors, label: label || '', seed: rand.int(1, 99999) };
    buildings.push(b);
    return b;
  }

  function addPalm(x, y) {
    palms.push({ x, y, s: rand.range(0.8, 1.25), seed: rand.int(1, 9999) });
  }

  function addParked(x, y, angle, kind, color, id) {
    parked.push({ x, y, angle, kind, color, id: id || '', hp: 100 });
  }

  for (let j = 0; j < ROWS; j += 1) {
    for (let i = 0; i < COLS; i += 1) {
      const block = blockRect(i, j);
      const key = Object.keys(LANDMARK_BLOCKS).find((k) => LANDMARK_BLOCKS[k].i === i && LANDMARK_BLOCKS[k].j === j);
      if (key) {
        const lm = LANDMARK_BLOCKS[key];
        const rect = { x: block.x + 34, y: block.y + 34, w: BLOCK - 68, h: BLOCK - 68 };
        const b = addBuilding(rect, lm.color, key === 'police' ? 6 : 3, lm.label);
        landmarks[key] = { x: rect.x + rect.w / 2, y: rect.y + rect.h + 16, building: b };
        if (key === 'target') {
          // The lot where the mission sports car waits: asphalt, palms, and the car itself.
          lots.push({ x: block.x + 8, y: block.y + 8, w: BLOCK - 16, h: BLOCK - 16 });
          addParked(block.x + 66, block.y + 60, Math.PI / 2, 'sport', '#ff3fa4', 'target');
          addParked(block.x + 66, block.y + 128, Math.PI / 2, 'sedan', rand.pick(CAR_COLORS), '');
          addParked(block.x + 160, block.y + 60, Math.PI / 2, 'van', rand.pick(CAR_COLORS), '');
          addPalm(block.x + 24, block.y + 24);
          addPalm(block.x + BLOCK - 24, block.y + BLOCK - 24);
        }
        continue;
      }
      const roll = rand.next();
      if (roll < 0.52) {
        // One tower per block, set back behind a sidewalk.
        addBuilding(
          { x: block.x + 32, y: block.y + 32, w: BLOCK - 64, h: BLOCK - 64 },
          rand.pick(BUILDING_PALETTE), rand.int(4, 13), '',
        );
        if (rand.chance(0.5)) addPalm(block.x + 16, block.y + 16);
        if (rand.chance(0.4)) addPalm(block.x + BLOCK - 16, block.y + BLOCK - 16);
      } else if (roll < 0.72) {
        // Two smaller buildings sharing the block.
        addBuilding({ x: block.x + 22, y: block.y + 22, w: 92, h: BLOCK - 44 }, rand.pick(BUILDING_PALETTE), rand.int(2, 6), '');
        addBuilding({ x: block.x + 126, y: block.y + 22, w: 84, h: BLOCK - 44 }, rand.pick(BUILDING_PALETTE), rand.int(2, 6), '');
      } else if (roll < 0.88) {
        // A parking lot: rows of cars anyone can "borrow".
        lots.push({ x: block.x + 8, y: block.y + 8, w: BLOCK - 16, h: BLOCK - 16 });
        const n = rand.int(3, 5);
        for (let k = 0; k < n; k += 1) {
          addParked(
            block.x + 52 + (k % 2) * 108, block.y + 52 + Math.floor(k / 2) * 72,
            Math.PI / 2, rand.pick(['sedan', 'sedan', 'taxi', 'van', 'sport']),
            rand.pick(CAR_COLORS), '',
          );
        }
        addPalm(block.x + 18, block.y + BLOCK - 18);
      } else {
        // A palm plaza.
        for (let k = 0; k < 5; k += 1) {
          addPalm(block.x + rand.range(24, BLOCK - 24), block.y + rand.range(24, BLOCK - 24));
        }
      }
    }
  }

  // Marina's cafe stands on the sand, facing the water; the story starts here.
  const cafe = addBuilding({ x: CITY_W + 26, y: 742, w: 92, h: 74 }, '#f7c8d8', 1, 'MARINA CAFE');
  landmarks.cafe = { x: cafe.x + cafe.w / 2, y: cafe.y + cafe.h + 18, building: cafe };

  // Beach dressing: palms down the sand and umbrellas near the water.
  const umbrellas = [];
  for (let y = 90; y < WORLD_H - 60; y += rand.range(120, 210)) {
    addPalm(CITY_W + rand.range(18, 52), y);
    if (rand.chance(0.7)) umbrellas.push({ x: WATER_X - rand.range(16, 60), y: y + rand.range(-20, 30), color: rand.pick(['#e5484d', '#f2a541', '#4f79d9', '#57b26a']) });
  }

  // A few cars parked along the kerbs, ready to steal.
  const { h: hRoads, v: vRoads } = roadCentres();
  for (let k = 0; k < 10; k += 1) {
    if (rand.chance(0.5)) {
      const y = rand.pick(hRoads) + (rand.chance(0.5) ? ROAD / 2 - 12 : -ROAD / 2 + 12);
      addParked(rand.range(120, CITY_W - 160), y, 0, rand.pick(['sedan', 'taxi', 'sport']), rand.pick(CAR_COLORS), '');
    } else {
      const x = rand.pick(vRoads) + (rand.chance(0.5) ? ROAD / 2 - 12 : -ROAD / 2 + 12);
      addParked(x, rand.range(120, WORLD_H - 160), Math.PI / 2, rand.pick(['sedan', 'van', 'sedan']), rand.pick(CAR_COLORS), '');
    }
  }

  return {
    buildings, palms, parked, lots, umbrellas, landmarks,
    roads: { h: hRoads, v: vRoads },
    bounds: { w: WORLD_W, h: WORLD_H },
    waterX: WATER_X,
    sandX: CITY_W,
  };
}

/** Is the point inside any building (with `pad` of slack)? Buildings are the world's hard walls. */
export function hitsBuilding(city, x, y, pad) {
  const list = city.buildings;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

/** Push a circle at (x, y) out of every building it overlaps; returns the corrected point. */
export function resolveBuildings(city, x, y, radius) {
  const list = city.buildings;
  for (let i = 0; i < list.length; i += 1) {
    const b = list[i];
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        y = ny + (dy / d) * radius;
      } else {
        // Centre inside the rect: leave by the nearest face.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - radius;
        else if (m === right) x = b.x + b.w + radius;
        else if (m === top) y = b.y - radius;
        else y = b.y + b.h + radius;
      }
    }
  }
  return { x, y };
}
