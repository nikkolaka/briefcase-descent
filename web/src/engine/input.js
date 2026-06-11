// Keyboard input: WASD + arrow keys for lateral dodging, plus one-shot "action"
// keys (start / restart). Movement is read as a normalized axis every tick;
// actions are queued and drained so a press is never missed between frames.

const MOVE_CODES = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
]);
const ACTION_CODES = new Set(['Enter', 'Space', 'KeyR']);

export function createInput(target = window) {
  const held = new Set();
  const pressed = []; // queued one-shot key presses

  function onDown(e) {
    if (MOVE_CODES.has(e.code) || ACTION_CODES.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (!held.has(e.code)) pressed.push(e.code);
    held.add(e.code);
  }
  function onUp(e) {
    held.delete(e.code);
  }
  // Releasing on blur stops the player "sticking" in a direction after alt-tab.
  function onBlur() {
    held.clear();
  }

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);

  return {
    // Lateral intent. x: -1 left .. +1 right, y: -1 down .. +1 up (screen space).
    axis() {
      let x = 0;
      let y = 0;
      if (held.has('ArrowLeft') || held.has('KeyA')) x -= 1;
      if (held.has('ArrowRight') || held.has('KeyD')) x += 1;
      if (held.has('ArrowUp') || held.has('KeyW')) y += 1;
      if (held.has('ArrowDown') || held.has('KeyS')) y -= 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },

    // True once per physical press for any of the given codes (drains the queue).
    consumePress(codes) {
      let hit = false;
      for (let i = pressed.length - 1; i >= 0; i--) {
        if (codes.includes(pressed[i])) {
          pressed.splice(i, 1);
          hit = true;
        }
      }
      return hit;
    },

    clearPresses() { pressed.length = 0; },

    destroy() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
