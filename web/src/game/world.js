// Infinite world as a sliding window of slabs. As the player falls, slabs that
// drop behind are discarded and new ones ahead are generated on demand. `dirty`
// tells the render layer when it must re-pack the instance buffers.

import { CONFIG } from './config.js';
import { genSlab } from '../engine/obstacles.js';

export function createWorld() {
  const slabs = new Map(); // index -> obstacle[]
  let dirty = true;
  let lo = 1;
  let hi = 0; // start with an empty, impossible range so the first ensure() fills it

  function ensure(depth) {
    const front = Math.floor(depth / CONFIG.slabDepth);
    const newLo = front - CONFIG.slabsBehind;
    const newHi = front + CONFIG.slabsAhead;
    if (newLo === lo && newHi === hi) return;

    for (const key of slabs.keys()) {
      if (key < newLo || key > newHi) {
        slabs.delete(key);
        dirty = true;
      }
    }
    for (let i = newLo; i <= newHi; i++) {
      if (!slabs.has(i)) {
        slabs.set(i, genSlab(i));
        dirty = true;
      }
    }
    lo = newLo;
    hi = newHi;
  }

  return {
    slabs,
    ensure,
    get dirty() { return dirty; },
    clearDirty() { dirty = false; },

    // Obstacles within collision range of the player's depth (current +/- 1 slab).
    near(depth) {
      const front = Math.floor(depth / CONFIG.slabDepth);
      const res = [];
      for (let i = front - 1; i <= front + 1; i++) {
        const s = slabs.get(i);
        if (s) for (let j = 0; j < s.length; j++) res.push(s[j]);
      }
      return res;
    },

    count() {
      let n = 0;
      for (const s of slabs.values()) n += s.length;
      return n;
    },

    reset() {
      slabs.clear();
      dirty = true;
      lo = 1;
      hi = 0;
    },
  };
}
