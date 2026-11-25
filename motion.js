// Move localized parts of the pose on a mesh so the torso, arms, and legs can move independently.
const motionJoints = {
  stepA: [[.29,.88,.31,.31,-.13,-.025], [.70,.9,.31,.29,.12,-.07], [.78,.47,.3,.22,-.08,.04]],
  stepB: [[.29,.89,.31,.31,.14,-.09], [.71,.88,.31,.31,-.12,-.018], [.77,.47,.3,.22,.08,-.032]],
  flight: [[.34,.8,.38,.38,-.065,-.08], [.73,.85,.34,.31,-.12,-.04], [.78,.44,.32,.28,-.09,.055]],
  windup: [[.83,.4,.31,.28,-.15,-.03], [.33,.46,.29,.25,-.08,-.02], [.56,.28,.42,.33,-.05,.01]],
  punch: [[.79,.39,.34,.27,.24,-.06], [.34,.46,.32,.26,-.08,-.02], [.58,.27,.38,.26,.07,0]],
  kick: [[.73,.88,.43,.46,.24,-.28], [.58,.70,.29,.31,.15,-.11], [.32,.87,.31,.33,-.03,0]],
  charge: [[.80,.42,.3,.31,-.085,.10], [.29,.47,.29,.30,-.09,.04], [.59,.20,.46,.29,-.039,-.052]],
  fire: [[.81,.41,.35,.32,.19,-.058], [.36,.47,.32,.28,.085,-.04], [.62,.25,.39,.29,.045,-.012]],
  hover: [[.31,.92,.33,.35,.05,-.052], [.72,.94,.31,.35,-.09,-.065], [.54,.44,.48,.36,0,-.017]],
  crouch: [[.55,.28,.49,.45,.04,.14], [.57,.56,.46,.37,.015,.10], [.72,.84,.33,.31,.055,-.022]],
  jump: [[.29,.85,.34,.38,.10,-.13], [.72,.86,.34,.39,.13,-.23], [.78,.42,.29,.27,.06,-.06]],
  hurt: [[.53,.24,.54,.40,-.09,-.038], [.77,.44,.38,.35,-.09,.02], [.45,.70,.40,.29,-.06,-.075]],
  fall: [[.52,.24,.52,.37,-.075,-.048], [.78,.45,.33,.31,.045,-.08], [.72,.84,.38,.38,.11,-.14]],
  settle: [[.72,.88,.31,.30,.10,-.022], [.79,.46,.34,.27,-.04,.035], [.32,.89,.31,.30,-.04,0]],
  lookUp: [[.58,.13,.43,.26,-.042,-.05]],
  lookDown: [[.58,.13,.43,.27,.043,.055]],
  lift: [[.8,.38,.35,.45,.07,-.27], [.62,.28,.41,.34,.045,-.03]],
  pouch: [[.78,.43,.33,.32,-.09,.145], [.30,.46,.31,.30,.115,.13], [.55,.17,.45,.27,.035,.04]],
  eat: [[.79,.4,.33,.33,-.10,-.105], [.31,.47,.33,.32,.12,.11]],
};
const motionCache = new WeakMap();
const drawnMotionSheets = [
  {
    path: 'assets/hero-motion.png', ids: ['piccolo', 'krillin', 'kidGohan'],
    columns: [0, 281, 640, 999, 1287, 1619], rows: [0, 330, 650, 971],
  },
  {
    path: 'assets/motion-saiyans.png', ids: ['vegeta', 'trunks', 'teenGohan', 'majinVegeta'],
    columns: [0, 316, 620, 945, 1261], rows: [0, 310, 618, 930, 1247],
  },
  {
    path: 'assets/motion-fusions.png', ids: ['gotenks', 'vegito', 'ultimateGohan', 'adultGohan'],
    columns: [0, 290, 585, 929, 1245], rows: [0, 299, 632, 944, 1263],
  },
  {
    path: 'assets/motion-earth.png', ids: ['yamcha', 'tien', 'videl', 'goten'],
    columns: [0, 305, 620, 955, 1274], rows: [0, 315, 630, 941, 1235],
  },
];

function spriteMotion(source, name) {
  let state = motionCache.get(source);
  if (!state) {
    const canvas = document.createElement('canvas');
    canvas.height = Math.min(168, source.height);
    canvas.width = Math.max(1, Math.round(source.width * canvas.height / source.height));
    const draw = canvas.getContext('2d');
    draw.imageSmoothingEnabled = false;
    draw.drawImage(source, 0, 0, canvas.width, canvas.height);
    state = { base: draw.getImageData(0, 0, canvas.width, canvas.height), poses: new Map() };
    motionCache.set(source, state);
  }
  if (!state.poses.has(name)) {
    state.poses.set(name, warpSprite(state.base, motionJoints[name]));
  }
  return state.poses.get(name);
}

function warpSprite(source, joints) {
  const { width, height } = source;
  const marginX = Math.ceil(width * .28);
  const marginTop = Math.ceil(height * .25);
  const canvas = document.createElement('canvas');
  canvas.width = width + marginX * 2;
  canvas.height = height + marginTop;
  const draw = canvas.getContext('2d');
  const output = draw.createImageData(canvas.width, canvas.height);
  const columns = 10;
  const rows = 12;
  const vertices = Array.from({ length: (columns + 1) * (rows + 1) }, (_, index) => {
    const u = (index % (columns + 1)) / columns;
    const v = Math.floor(index / (columns + 1)) / rows;
    let x = u;
    let y = v;
    for (const [cx, cy, rx, ry, dx, dy] of joints) {
      const distance = ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;
      const influence = Math.max(0, 1 - distance) ** 1.2;
      x += dx * influence;
      y += dy * influence;
    }
    return { x: x * width + marginX, y: y * height + marginTop, u, v };
  });
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * (columns + 1) + column;
      const a = vertices[index];
      const b = vertices[index + 1];
      const c = vertices[index + columns + 1];
      const d = vertices[index + columns + 2];
      rasterizeMotionTriangle(source, output, a, b, c);
      rasterizeMotionTriangle(source, output, b, d, c);
    }
  }
  draw.putImageData(output, 0, 0);
  return canvas;
}

function rasterizeMotionTriangle(source, output, a, b, c) {
  const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(det) < .01) return;
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(output.width, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(output.height, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const px = x + .5 - c.x;
      const py = y + .5 - c.y;
      const wa = ((b.y - c.y) * px + (c.x - b.x) * py) / det;
      const wb = ((c.y - a.y) * px + (a.x - c.x) * py) / det;
      const wc = 1 - wa - wb;
      if (Math.min(wa, wb, wc) < -.001) continue;
      const sx = Math.min(source.width - 1, Math.max(0, Math.floor((wa * a.u + wb * b.u + wc * c.u) * source.width)));
      const sy = Math.min(source.height - 1, Math.max(0, Math.floor((wa * a.v + wb * b.v + wc * c.v) * source.height)));
      const src = (sy * source.width + sx) * 4;
      if (!source.data[src + 3]) continue;
      const dst = (y * output.width + x) * 4;
      for (let channel = 0; channel < 4; channel++) output.data[dst + channel] = source.data[src + channel];
    }
  }
}
