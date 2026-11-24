const canvas = document.querySelector('#arena');
const context = canvas.getContext('2d');
const meter = document.querySelector('#ki');
const kiValue = document.querySelector('#ki-value');
const status = document.querySelector('#status');
const fullscreen = document.querySelector('#fullscreen');
const landscape = matchMedia('(orientation: landscape)');
const buttons = [...document.querySelectorAll('[data-action]')];
const jumpButton = document.querySelector('[data-action="jump"]');
const joystick = document.querySelector('#joystick');

const keys = new Map([
  ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
  ['ArrowUp', 'up'], ['ArrowDown', 'down'],
  ['Space', 'jump'],
  ['KeyZ', 'punch'], ['KeyX', 'kick'], ['KeyC', 'charge'],
]);
const heldInputs = new Map();
const moveSpeed = 240;
const chargeSpeed = 40;
const attackFrameTime = 0.085;
const doubleTapTime = 350;
const jumpDuration = 0.65;
const stick = { pointerId: null, x: 0, y: 0 };

let sprites;
let previousTime;
let x;
let facing = 1;
let ki = 0;
let chargeTime = 0;
let animation = 'idle';
let animationTime = 0;
let attack = null;
let lastJumpPress = -Infinity;
let jumpElapsed = null;
let flying = false;
let airborneHeight = 0;
let liftingOff = false;
let flightAngle = 0;

// Cell boundaries in the supplied review sheets, including the label gutter.
const baseColumns = [223, 463, 697, 932, 1168, 1397];
const chargeColumns = [363, 725, 1086, 1446, 1807, 2171];

async function loadImage(path) {
  const image = new Image();
  image.src = path;
  await image.decode();
  return image;
}

function readRow(image, columns, top, bottom, scale = 1) {
  return columns.slice(0, -1).map((left, index) => {
    const frame = document.createElement('canvas');
    frame.width = columns[index + 1] - left - 6;
    frame.height = bottom - top - 4;
    const frameContext = frame.getContext('2d', { willReadFrequently: true });
    frameContext.drawImage(image, left + 3, top + 2, frame.width, frame.height,
      0, 0, frame.width, frame.height);
    const pixels = frameContext.getImageData(0, 0, frame.width, frame.height);
    for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
      const [red, green, blue] = [pixels.data[pixel], pixels.data[pixel + 1], pixels.data[pixel + 2]];
      // Make the muted navy backdrop transparent while retaining black outlines and blue fabric.
      if (red >= 7 && red <= 32 && green >= 20 && green <= 49 &&
          blue >= 36 && blue <= 72 && green - red >= 11 &&
          green - red <= 27 && blue - green >= 13 && blue - green <= 33) {
        pixels.data[pixel + 3] = 0;
      }
    }
    frameContext.putImageData(pixels, 0, 0);
    return { frame, scale };
  });
}

function active(action) {
  return [...heldInputs.values()].includes(action);
}

function movementVector() {
  if (stick.pointerId !== null) return stick;
  const x = Number(active('right')) - Number(active('left'));
  const y = Number(active('down')) - Number(active('up'));
  const length = Math.max(1, Math.hypot(x, y));
  return { x: x / length, y: y / length };
}

function moveStick(event) {
  if (event.pointerId !== stick.pointerId) return;
  const bounds = joystick.getBoundingClientRect();
  const radius = bounds.width * 0.29;
  const dx = event.clientX - bounds.left - bounds.width / 2;
  const dy = event.clientY - bounds.top - bounds.height / 2;
  const length = Math.hypot(dx, dy);
  const scale = 1 / Math.max(radius, length);
  joystick.style.setProperty('--stick-x', dx * scale * radius + 'px');
  joystick.style.setProperty('--stick-y', dy * scale * radius + 'px');
  stick.x = length < radius * 0.22 ? 0 : dx * scale;
  stick.y = length < radius * 0.22 ? 0 : dy * scale;
}

function resetStick() {
  const { pointerId } = stick;
  stick.pointerId = null;
  stick.x = 0;
  stick.y = 0;
  if (pointerId !== null && joystick.hasPointerCapture(pointerId)) joystick.releasePointerCapture(pointerId);
  joystick.classList.remove('dragging');
  joystick.style.removeProperty('--stick-x');
  joystick.style.removeProperty('--stick-y');
}

joystick.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || stick.pointerId !== null || !sprites || !landscape.matches) return;
  event.preventDefault();
  stick.pointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  joystick.classList.add('dragging');
  moveStick(event);
});
joystick.addEventListener('pointermove', moveStick);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  joystick.addEventListener(type, (event) => {
    if (event.pointerId === stick.pointerId) resetStick();
  });
}

function syncButtons() {
  for (const button of buttons) button.classList.toggle('pressed', active(button.dataset.action));
}

function triggerJump(now) {
  if (now - lastJumpPress <= doubleTapTime) {
    flying = !flying;
    liftingOff = flying;
    jumpButton.setAttribute('aria-pressed', String(flying));
    jumpElapsed = null;
    lastJumpPress = -Infinity;
    return;
  }
  lastJumpPress = now;
  if (!flying && airborneHeight === 0 && jumpElapsed === null) jumpElapsed = 0;
}

function press(input, action) {
  if (!landscape.matches || !sprites || heldInputs.has(input)) return;
  heldInputs.set(input, action);
  if (action === 'jump') triggerJump(performance.now());
  if ((action === 'punch' || action === 'kick') && !attack && !active('charge')) {
    attack = { name: action, elapsed: 0 };
  }
  syncButtons();
}

function release(input) {
  heldInputs.delete(input);
  syncButtons();
}

function resetInputs() {
  heldInputs.clear();
  resetStick();
  attack = null;
  lastJumpPress = -Infinity;
  chargeTime = 0;
  previousTime = undefined;
  syncButtons();
}

for (const button of buttons) {
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    press(event.pointerId, button.dataset.action);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(event, ({ pointerId }) => release(pointerId));
  }
  button.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) press(event.code, button.dataset.action);
  });
}

window.addEventListener('keydown', (event) => {
  const action = keys.get(event.code);
  if (!action) return;
  event.preventDefault();
  if (!event.repeat) press(event.code, action);
});
window.addEventListener('keyup', (event) => release(event.code));
window.addEventListener('blur', resetInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) resetInputs();
});
landscape.addEventListener('change', resetInputs);

fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    }
  } catch {
    // The portrait gate still applies on browsers that limit full screen or orientation locking.
  }
});

function update(dt, width, height, size) {
  const { x: horizontal, y: vertical } = movementVector();
  const looking = Math.abs(vertical) > Math.abs(horizontal);
  const direction = !flying && looking ? 0 : horizontal;
  if (jumpElapsed !== null) {
    jumpElapsed += dt;
    if (jumpElapsed >= jumpDuration) jumpElapsed = null;
  }
  const jumpProgress = jumpElapsed === null ? 0 : jumpElapsed / jumpDuration;
  if (jumpElapsed !== null) {
    airborneHeight = 4 * (height * 0.13) * jumpProgress * (1 - jumpProgress);
  } else if (flying) {
    if (vertical) liftingOff = false;
    if (liftingOff) {
      airborneHeight = Math.min(height * 0.18, airborneHeight + height * dt * 0.8);
      if (airborneHeight >= height * 0.18) liftingOff = false;
    }
    airborneHeight = Math.max(height * 0.035, Math.min(height * 0.27,
      airborneHeight - vertical * height * dt * 0.65));
    x += direction * moveSpeed * dt;
    if (Math.abs(direction) > 0.12) facing = Math.sign(direction);
  } else {
    airborneHeight = Math.max(0, airborneHeight - height * 0.8 * dt);
  }
  let next = 'idle';
  let frameIndex = 0;

  if (attack) {
    attack.elapsed += dt;
    if (attack.elapsed >= sprites[attack.name].length * attackFrameTime) attack = null;
  }

  if (attack) {
    next = attack.name;
    frameIndex = Math.floor(attack.elapsed / attackFrameTime);
  } else if (active('charge')) {
    next = 'charge';
    chargeTime += dt;
    ki = Math.min(100, ki + chargeSpeed * dt);
    frameIndex = chargeTime < 0.45 ? Math.floor(chargeTime / 0.15)
      : 3 + Math.floor(chargeTime / 0.12) % 2;
    const percent = Math.floor(ki);
    meter.value = percent;
    kiValue.textContent = percent + '%';
  } else {
    if (!flying && direction) {
      facing = Math.sign(direction);
      x += direction * moveSpeed * dt;
    }
    if (flying) {
      next = direction || vertical ? 'fly' : 'hover';
    } else if (jumpElapsed !== null || airborneHeight > 0) {
      next = 'jump';
      frameIndex = jumpElapsed === null ? 3 : Math.floor(jumpProgress * sprites.jump.length);
    } else if (direction) {
      next = 'walk';
    } else if (looking) {
      next = vertical < 0 ? 'lookUp' : 'lookDown';
    }
  }

  if (next !== 'charge') chargeTime = 0;
  animationTime = animation === next ? animationTime + dt : 0;
  animation = next;
  if (next === 'idle' || next === 'walk') {
    frameIndex = Math.floor(animationTime * (next === 'walk' ? 10 : 4)) % sprites[next].length;
  }
  if (next === 'fly') frameIndex = 2 + Math.floor(animationTime * 8) % 2;
  if (next === 'hover') frameIndex = Math.floor(animationTime * 4) % 2 === 0 ? 0 : 4;
  flightAngle = next === 'fly' ? Math.atan2(vertical, Math.abs(direction)) : 0;
  const padding = Math.min(width / 2, 120 * size);
  x = Math.max(padding, Math.min(width - padding, x));
  return sprites[next === 'hover' ? 'fly' : next][frameIndex];
}

function render(time) {
  requestAnimationFrame(render);
  if (!landscape.matches || document.hidden) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const density = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * density) || canvas.height !== Math.round(height * density)) {
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
  }
  const dt = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.05);
  previousTime = time;
  x ??= width / 2;
  const floor = Math.round(height * 0.71);
  const size = Math.min(1.65, height * 0.43 / 150);
  const { frame, scale } = update(dt, width, height, size);

  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#e5e9ef';
  context.fillRect(0, floor, width, 1);
  context.imageSmoothingEnabled = false;
  const spriteWidth = frame.width * scale * size;
  const spriteHeight = frame.height * scale * size;
  context.save();
  context.translate(Math.round(x), Math.round(floor - airborneHeight));
  context.scale(facing, 1);
  if (flightAngle) {
    context.translate(0, -spriteHeight * 0.48);
    context.rotate(flightAngle);
    context.translate(0, spriteHeight * 0.48);
  }
  context.drawImage(frame, Math.round(-spriteWidth / 2), Math.round(-spriteHeight),
    Math.round(spriteWidth), Math.round(spriteHeight));
  context.restore();
}

function lookPose({ frame, scale }, angle) {
  const pose = document.createElement('canvas');
  pose.width = frame.width;
  pose.height = frame.height;
  const draw = pose.getContext('2d');
  draw.imageSmoothingEnabled = false;
  // The first idle frame is cut at the neck so the feet and torso stay planted.
  const neckX = 122;
  const neckY = 53;
  const bodyHeight = frame.height - neckY;
  draw.drawImage(frame, 0, neckY, frame.width, bodyHeight, 0, neckY, frame.width, bodyHeight);
  draw.translate(neckX, neckY);
  draw.rotate(angle);
  draw.drawImage(frame, 0, 0, frame.width, neckY + 3, -neckX, -neckY, frame.width, neckY + 3);
  return [{ frame: pose, scale }];
}

async function start() {
  try {
    const [base, charge] = await Promise.all([
      loadImage('assets/goku-base.png'), loadImage('assets/goku-ki.png'),
    ]);
    const idle = readRow(base, baseColumns, 5, 159);
    sprites = {
      idle,
      lookUp: lookPose(idle[0], -0.24),
      lookDown: lookPose(idle[0], 0.24),
      walk: readRow(base, baseColumns, 159, 298),
      jump: readRow(base, baseColumns, 426, 566),
      fly: readRow(base, baseColumns, 694, 833),
      punch: readRow(base, baseColumns, 833, 963),
      kick: readRow(base, baseColumns, 963, 1110),
      charge: readRow(charge, chargeColumns, 193, 519, 0.46),
    };
    status.hidden = true;
    requestAnimationFrame(render);
  } catch (error) {
    status.textContent = 'Não foi possível carregar os sprites. Recarregue a página.';
    console.error(error);
  }
}

start();
