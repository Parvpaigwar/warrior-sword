// Camera / product state shared by the page and the (lazily loaded) 3D stage.
export const DEFAULT_STATE = {
  fx: 0, fy: 52, fz: 0, // focus point on the product (cm, product space)
  dist: 7.5,            // camera distance (world units)
  rotX: 0, rotY: 0,     // product rotation
  nx: 0, ny: 0,         // where the focus sits on screen (-1..1)
  sep: 0,               // 0 mounted → 1 sword lifted off the plaque
  warm: 0,              // 0 studio light → 1 golden hour
  opacity: 1,
};
