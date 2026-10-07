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
const W = 288;                                   // strip width, unless a piece gives its own `w`

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
  2: {                                           // ทุ่งหญ้ากว้าง
    travel: 1500, sky: '#5B8FD6',
    layers: [
      strip('s2-sky', 100, .04),
      strip('s2-cloud', 120, .06, { x: 250, y: 10 }),
      strip('s2-cloud2', 107, .06, { x: 620, y: 2 }),
      strip('s2-field', 72, .25),
      strip('s2-trees', 70, .5, { x: 500, y: 37 }),
      strip('s2-tree', 68, .5, { x: 1100, y: 39 }),
      strip('s2-front', 38, 1),
    ],
  },
  3: {                                           // ป่าใหญ่
    travel: 1500, sky: '#12A9D6',
    layers: [
      strip('s3-sky', 100, .04),
      strip('s3-hills', 41, .1, { y: 45 }),
      strip('s3-pines', 80, .25, { y: 20 }),
      strip('s3-trio', 103, .5, { x: 40, y: 20 }),
      strip('s3-teal', 114, .5, { x: 330, y: 20 }),
      strip('s3-light', 103, .5, { x: 560, y: 20 }),
      strip('s3-trio', 103, .5, { x: 820, y: 20, flip: true }),
      strip('s3-teal', 114, .5, { x: 1090, y: 20, flip: true }),
      strip('s3-light', 103, .5, { x: 1300, y: 20 }),
      strip('s3-big', 138, 1, { x: 120, y: 14 }),
      strip('s3-bush', 26, 1, { x: 430, y: 18 }),
      strip('s3-yellow', 125, 1, { x: 620, y: 14 }),
      strip('s3-trunk', 100, 1, { x: 960 }),
      strip('s3-bush', 26, 1, { x: 1180, y: 18, flip: true }),
      strip('s3-big', 138, 1, { x: 1330, y: 14, flip: true }),
      strip('s3-yellow', 125, 1, { x: 1680, y: 14, flip: true }),
      strip('s3-trunk', 100, 1, { x: 2020, flip: true }),
      strip('s3-front', 41, 1),
    ],
  },
  4: {                                           // ริมลำธาร
    travel: 1500, sky: '#7CB9E0',
    layers: [
      strip('sky-pale', 100, .04),
      strip('s4-far', 29, .3, { y: 56 }),
      strip('s4-water', 36, .6, { y: 18 }),
      strip('s4-lily', 36, .6, { y: 18 }),
      strip('s4-reeds', 22, .6, { y: 50 }),
      strip('s4-pines', 100, 1, { x: 300 }),
      strip('s4-pines', 100, 1, { x: 1250, flip: true }),
      strip('s4-pines', 100, 1, { x: 1900 }),
      strip('s4-front', 20, 1),
    ],
  },
  5: {                                           // ภูเขาแถวบนสุด
    travel: 1500, sky: '#7CB9E0',
    layers: [
      strip('sky-pale', 100, .04),
      strip('s5-peak', 88, .1, { w: 202, x: 120, y: 14 }),
      strip('s1-mountain', 59, .12, { x: 560, y: 55 }),
      strip('s5-field', 56, .3),
      strip('s5-pines', 49, .5, { y: 31 }),
      strip('s5-front', 29, 1),
    ],
  },
  6: {                                           // ถ้ำปุ่ม Shift
    travel: 1500, sky: '#C4BEC6',
    layers: [
      strip('s6-1', 100, .1),
      strip('s6-2', 100, .3),
      strip('s6-3', 100, .6),
      strip('s6-4', 100, 1),
    ],
  },
  7: {                                           // ปราสาทอักษรหายาก
    travel: 1500, sky: '#A9B5C4',
    layers: [
      strip('s7-sky', 100, .03),
      strip('s7-jungle', 100, .2),
      strip('s7-ruin', 89, .5, { x: 380, y: 11 }),
      strip('s7-pyramid', 100, .5, { x: 1000 }),
      strip('s7-ledge', 85, 1),
      strip('s7-front', 30, 1),
    ],
  },
  8: {                                           // หอคอยตัวเลข
    travel: 1500, sky: '#B4C0C4',
    layers: [
      strip('s8-sky', 100, .04),
      strip('s8-hills', 55, .6),
      strip('s2-trees', 70, 1, { x: 250, y: 27 }),
      strip('s8-tower', 97, 1, { w: 173, x: 800, y: 30 }),
      strip('s2-tree', 68, 1, { x: 1300, y: 29 }),
      strip('s8-ruin', 85, 1, { x: 1700, y: 30 }),
      strip('s8-front', 38, 1),
    ],
  },
  9: {                                           // ยอดเขาแชมป์
    travel: 1500, sky: '#6B74A8',
    layers: [
      strip('s9-sky', 100, .02),
      strip('s9-gold', 103, .05, { x: 180, y: 38 }),
      strip('s9-glow', 118, .08, { y: 30 }),
      strip('s5-peak', 88, .12, { w: 202, x: 520, y: 22 }),
      strip('s9-dusk', 73, .15, { y: 20 }),
      strip('s9-ridge', 67, .4),
      strip('s9-front', 39, 1),
    ],
  },
};

export const laneWorld = stage => WORLDS[stage] || null;
