// Central tuning. The descent runs along world -Z ("into the screen"); the player
// dodges in the X/Y plane, which maps WASD/arrows straight to screen directions.
export const CONFIG = {
  // Shaft cross-section half-extent. Player and obstacles live in [-arena, arena]
  // on both X (horizontal) and Y (vertical).
  arena: 7,

  // World -Z depth covered by one slab, and how many slabs stay live around the
  // player. (behind + ahead + 1) slabs exist at once.
  slabDepth: 14,
  slabsBehind: 2,
  slabsAhead: 10,

  // Player lateral movement.
  playerRadius: 0.6,
  latMaxSpeed: 17, // units/s
  latAccel: 95, // units/s^2 toward the input target velocity
  latDamping: 70, // units/s^2 bleed-off when no input

  // Fall-speed ramp — "he slowly speeds up".
  startSpeed: 22, // units/s at the start of a run
  maxSpeed: 72, // units/s cap
  accelPerSec: 1.25, // speed gained per second survived

  // Difficulty ramp: obstacle density grows and gaps shrink as depth approaches
  // this value (then plateaus).
  rampDepth: 1600,
};
