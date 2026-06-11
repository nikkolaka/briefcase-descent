// One InstancedBatch per primitive type (cube / tetra / sphere). All obstacles of
// a type are drawn in a single instanced draw call; recycling a slab just rewrites
// the per-instance attribute arrays (offset / scale / quat / spin / color) and
// bumps `instancedCount` — no geometry rebuilds, no allocations per frame.

import { Geometry } from 'ogl';

export class InstancedBatch {
  constructor(gl, baseGeo, capacity = 1024) {
    this.capacity = capacity;
    this.count = 0;

    this.offset = new Float32Array(capacity * 3);
    this.scaleArr = new Float32Array(capacity * 3);
    this.quat = new Float32Array(capacity * 4);
    this.spin = new Float32Array(capacity * 4); // xyz axis, w rate
    this.color = new Float32Array(capacity * 3);

    this.geometry = new Geometry(gl, {
      position: { size: 3, data: baseGeo.position },
      normal: { size: 3, data: baseGeo.normal },
      iOffset: { instanced: 1, size: 3, data: this.offset },
      iScale: { instanced: 1, size: 3, data: this.scaleArr },
      iQuat: { instanced: 1, size: 4, data: this.quat },
      iSpin: { instanced: 1, size: 4, data: this.spin },
      iColor: { instanced: 1, size: 3, data: this.color },
    });
    this.geometry.instancedCount = 0;
  }

  begin() {
    this.count = 0;
  }

  add(o) {
    const i = this.count;
    if (i >= this.capacity) return; // capacity is sized generously; just clamp
    const i3 = i * 3;
    const i4 = i * 4;
    this.offset[i3] = o.x; this.offset[i3 + 1] = o.y; this.offset[i3 + 2] = o.z;
    this.scaleArr[i3] = o.scale; this.scaleArr[i3 + 1] = o.scale; this.scaleArr[i3 + 2] = o.scale;
    this.quat[i4] = o.qx; this.quat[i4 + 1] = o.qy; this.quat[i4 + 2] = o.qz; this.quat[i4 + 3] = o.qw;
    this.spin[i4] = o.sx; this.spin[i4 + 1] = o.sy; this.spin[i4 + 2] = o.sz; this.spin[i4 + 3] = o.spin;
    this.color[i3] = o.r; this.color[i3 + 1] = o.g; this.color[i3 + 2] = o.b;
    this.count++;
  }

  commit() {
    this.geometry.instancedCount = this.count;
    const a = this.geometry.attributes;
    a.iOffset.needsUpdate = true;
    a.iScale.needsUpdate = true;
    a.iQuat.needsUpdate = true;
    a.iSpin.needsUpdate = true;
    a.iColor.needsUpdate = true;
  }
}
