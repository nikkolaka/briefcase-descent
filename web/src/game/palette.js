// Level-based color system. Every LEVEL_DEPTH metres the hue jumps to the next
// palette entry — an abrupt colour shift that marks "progressing deeper".
// Within a level the hue stays fixed; the per-obstacle `salt` adds slight
// variation so a wall of shapes isn't monochrome.
//
// Background is the complementary hue (opponent colour on the wheel) kept very
// dark, so the bright obstacles pop. Both are pure functions for headless testing.

export const LEVEL_DEPTH = 200; // world units per level

// 12 evenly-spaced hues cycling the full colour wheel — cool→warm→cool.
// Tuned so adjacent levels feel maximally different.
const LEVEL_HUES = [
  0.52, // 0  cyan-blue  (lobby)
  0.62, // 1  electric blue
  0.72, // 2  indigo
  0.80, // 3  violet
  0.88, // 4  hot pink
  0.96, // 5  magenta-red
  0.03, // 6  warm red
  0.09, // 7  orange
  0.14, // 8  gold
  0.28, // 9  lime
  0.38, // 10 spring green
  0.47, // 11 teal
];

export function hsl2rgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

// Obstacle colour: discrete hue from the current level, ±salt variation so
// adjacent cells in the same wall read as slightly different shades.
export function obstacleColor(depth, salt = 0) {
  const level = Math.floor(depth / LEVEL_DEPTH) % LEVEL_HUES.length;
  const hue = LEVEL_HUES[level] + salt * 0.05 - 0.025;
  return hsl2rgb(hue, 0.92, 0.64);
}

// Background / fog: complementary hue, very dark, so the bright obstacles read.
export function backgroundColor(depth) {
  const level = Math.floor(depth / LEVEL_DEPTH) % LEVEL_HUES.length;
  const hue = LEVEL_HUES[level] + 0.5;
  return hsl2rgb(hue, 0.55, 0.042);
}
