// ═══════════════════════════════════════════════════════════════
// LANE SCENERY — what scrolls behind the runner in solo practice, one world per stage.
//   CharKit.RaceTrack gets this as its `world` prop: the camera follows the runner and
//   every layer slides at its own speed (1 = the ground the runner is on, smaller = further away).
//   • no `x`  → the strip repeats across the whole lane
//   • `x`     → a one-off piece standing at that spot (px along its own layer)
//   • `y`     → lifted this many px above the bottom of the lane
//   The practice lane is about 860 px wide on the lab screens (1366 px), so a one-off piece is
//   only ever reached if x ≤ 860 + travel × speed.
//   Strips are in assets/bg/lanes/, already cut to size (half-scale CraftPix layers).
//   A stage without an entry keeps the plain still lane.
// ═══════════════════════════════════════════════════════════════
const DIR = 'assets/bg/lanes/';
const W = 288;                                   // every strip is 288 px wide

const strip = (name, h, speed, more) => ({ src: DIR + name + '.png', w: W, h, speed, ...more });

const WORLDS = {
  1: {                                           // หมู่บ้านต้นทาง
    travel: 1500, sky: '#8ED4E4',
    layers: [
      strip('s1-sky', 100, .04),
      strip('s1-mountain', 59, .12, { x: 520, y: 55 }),
      strip('s1-field', 62, .3),
      strip('s1-bushes', 32, .3, { x: 60, y: 56 }),
      strip('s1-bushes', 32, .3, { x: 620, y: 56, flip: true }),
      strip('s1-bushes', 32, .3, { x: 1100, y: 56 }),
      strip('s1-tree', 127, 1, { x: 380 }),
      strip('s1-house', 108, 1, { x: 1000 }),
      strip('s1-tree', 127, 1, { x: 1550, flip: true }),
      strip('s1-birch', 100, 1, { x: 2000 }),
      strip('s1-front', 39, 1),
    ],
  },
};

export const laneWorld = stage => WORLDS[stage] || null;
