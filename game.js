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
const game = document.querySelector('#game');
const enemyHud = document.querySelector('#enemy-hud');
const defeat = document.querySelector('#defeat');
const healthMeters = {
  goku: document.querySelector('#goku-health'),
  enemy: document.querySelector('#enemy-health'),
};

const keys = new Map([
  ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
  ['ArrowUp', 'up'], ['ArrowDown', 'down'],
  ['Space', 'jump'],
  ['KeyZ', 'punch'], ['KeyX', 'kick'], ['KeyC', 'charge'],
]);
const heldInputs = new Map();
const walkSpeed = 320;
const flightSpeed = 380;
const verticalFlightSpeed = 1; // Viewport heights per second.
const chargeSpeed = 40;
const attackFrameTime = 0.085;
const doubleTapTime = 350;
const jumpDuration = 0.65;
const stick = { pointerId: null, x: 0, y: 0 };
const playerCombat = { health: 100, reaction: null };
const enemy = {
  health: 60, reaction: null, x: null, altitude: 0, facing: -1,
  attackTime: null, cooldown: 0,
};
let spawnTime = 1.5;

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

function readRow(image, columns, top, bottom, scale = 1, combatSheet = false) {
  return columns.slice(0, -1).map((left, index) => {
    const frame = document.createElement('canvas');
    frame.width = columns[index + 1] - left - 6;
    frame.height = bottom - top - 4;
    const frameContext = frame.getContext('2d', { willReadFrequently: true });
    frameContext.drawImage(image, left + 3, top + 2, frame.width, frame.height,
      0, 0, frame.width, frame.height);
    const pixels = frameContext.getImageData(0, 0, frame.width, frame.height);
    let minX = frame.width;
    let minY = frame.height;
    let maxX = -1;
    let maxY = -1;
    for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
      const [red, green, blue] = [pixels.data[pixel], pixels.data[pixel + 1], pixels.data[pixel + 2]];
      // Make the muted navy backdrop transparent while retaining black outlines and blue fabric.
      const navy = red >= 7 && red <= 32 && green >= 20 && green <= 49 &&
          blue >= 36 && blue <= 72 && green - red >= 11 &&
          green - red <= 27 && blue - green >= 13 && blue - green <= 33;
      const magenta = red > 120 && blue > 120 && red - green > 80 && blue - green > 80;
      if (combatSheet ? magenta : navy) {
        pixels.data[pixel + 3] = 0;
      } else if (combatSheet && pixels.data[pixel + 3]) {
        const y = Math.floor(pixel / 4 / frame.width);
        const x = (pixel / 4) % frame.width;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    frameContext.putImageData(pixels, 0, 0);
    if (combatSheet && maxX >= 0) {
      const trimmed = document.createElement('canvas');
      trimmed.width = maxX - minX + 1;
      trimmed.height = maxY - minY + 1;
      trimmed.getContext('2d').drawImage(frame, minX, minY, trimmed.width, trimmed.height,
        0, 0, trimmed.width, trimmed.height);
      return { frame: trimmed, scale };
    }
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
  if (event.button !== 0 || stick.pointerId !== null || !sprites || !landscape.matches || !playerCombat.health) return;
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
  if (!landscape.matches || !sprites || !playerCombat.health || heldInputs.has(input)) return;
  heldInputs.set(input, action);
  if (action === 'jump' && !playerCombat.reaction) triggerJump(performance.now());
  if ((action === 'punch' || action === 'kick') && !playerCombat.reaction && !attack && !active('charge')) {
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
for (const event of ['contextmenu', 'selectstart']) {
  game.addEventListener(event, (event) => event.preventDefault());
}
// Safari can handle pinch gestures independently of pointer events.
for (const event of ['gesturestart', 'gesturechange']) {
  document.addEventListener(event, (event) => event.preventDefault(), { passive: false });
}
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

function damage(target, name, amount, direction, altitude) {
  target.health = Math.max(0, target.health - amount);
  const meter = healthMeters[name];
  meter.value = target.health;
  target.reaction = { time: 0, direction, altitude };
  if (name === 'goku') {
    document.querySelector('#goku-health-value').textContent = target.health + '/' + meter.max;
    facing = -direction;
  } else {
    enemy.facing = -direction;
  }
}

function inRange(dx, dy, direction, reach, size) {
  return dx * direction >= -8 * size && Math.abs(dx) <= reach * size &&
    Math.abs(dy) <= 49 * size;
}

function boundedX(position, width, padding) {
  const edge = Math.min(width / 2, padding);
  return Math.max(edge, Math.min(width - edge, position));
}

function react(actor, dt, floorHeight, move) {
  const reaction = actor.reaction;
  reaction.time += dt;
  const duration = actor.health ? 0.32 : 0.85;
  const progress = Math.min(1, reaction.time / duration);
  if (progress < 1) move(reaction.direction * (actor.health ? 105 : 160) * dt * (1 - progress));
  const arc = 4 * progress * (1 - progress);
  const altitude = actor.health ? reaction.altitude + floorHeight * 0.035 * arc
    : reaction.altitude * (1 - progress) + floorHeight * 0.18 * arc;
  if (progress === 1 && actor.health) actor.reaction = null;
  const frameIndex = actor.health ? (progress < 0.48 ? 0 : 1)
    : (progress === 1 ? 4 : Math.min(3, Math.floor(progress * 4)));
  return { altitude, frameIndex, finished: progress === 1 };
}

function updateEnemy(dt, width, height, size) {
  if (enemy.x === null) {
    spawnTime -= dt;
    if (spawnTime > 0) return;
    enemy.x = width - 55 * size;
    enemy.altitude = height * 0.12;
    enemyHud.hidden = false;
  }
  enemy.x = boundedX(enemy.x, width, 52 * size);
  if (enemy.reaction) {
    const result = react(enemy, dt, height, (dx) => {
      enemy.x = boundedX(enemy.x + dx, width, 52 * size);
    });
    enemy.altitude = result.altitude;
    return sprites.enemyHit[result.frameIndex];
  }

  const dx = x - enemy.x;
  const dy = airborneHeight - enemy.altitude;
  enemy.cooldown = Math.max(0, enemy.cooldown - dt);
  if (!playerCombat.health) {
    enemy.attackTime = null;
    return sprites.enemy[0];
  }
  if (enemy.attackTime !== null) {
    const before = enemy.attackTime;
    enemy.attackTime += dt;
    if (before < 0.43 && enemy.attackTime >= 0.43 && !playerCombat.reaction &&
        inRange(dx, dy, enemy.facing, 76, size)) {
      damage(playerCombat, 'goku', 15, enemy.facing, airborneHeight);
      attack = null;
      jumpElapsed = null;
      lastJumpPress = -Infinity;
      chargeTime = 0;
      if (!playerCombat.health) {
        flying = false;
        liftingOff = false;
        jumpButton.setAttribute('aria-pressed', 'false');
        resetInputs();
      }
    }
    if (enemy.attackTime < 0.43) return sprites.enemy[2];
    if (enemy.attackTime < 0.55) return sprites.enemy[3];
    if (enemy.attackTime < 0.72) return sprites.enemy[4];
    enemy.attackTime = null;
    enemy.cooldown = 0.55;
    return sprites.enemy[0];
  }

  if (Math.abs(dx) > 2) enemy.facing = Math.sign(dx);
  if (inRange(dx, dy, enemy.facing, 65, size) && !enemy.cooldown) enemy.attackTime = 0;
  const gap = Math.max(0, Math.abs(dx) - 48 * size);
  enemy.x += Math.sign(dx) * Math.min(gap, 145 * dt);
  const altitudeTarget = Math.max(height * 0.018, airborneHeight);
  const rise = altitudeTarget - enemy.altitude;
  enemy.altitude += Math.sign(rise) * Math.min(Math.abs(rise), height * 0.47 * dt);
  return sprites.enemy[gap > 4 || Math.abs(rise) > 8 ? 1 : 0];
}

function update(dt, width, height, size) {
  if (playerCombat.reaction) {
    const result = react(playerCombat, dt, height, (dx) => {
      x = boundedX(x + dx, width, 120 * size);
    });
    airborneHeight = result.altitude;
    flightAngle = 0;
    animation = playerCombat.health ? 'hurt' : 'defeated';
    if (result.finished && !playerCombat.health) defeat.hidden = false;
    return sprites.gokuHit[result.frameIndex];
  }
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
      airborneHeight - vertical * height * dt * verticalFlightSpeed));
    x += direction * flightSpeed * dt;
    if (Math.abs(direction) > 0.12) facing = Math.sign(direction);
  } else {
    airborneHeight = Math.max(0, airborneHeight - height * 0.8 * dt);
  }
  let next = 'idle';
  let frameIndex = 0;

  if (attack) {
    const before = attack.elapsed;
    attack.elapsed += dt;
    const impact = attackFrameTime * 2;
    if (before < impact && attack.elapsed >= impact && enemy.x !== null && enemy.health &&
        inRange(enemy.x - x, enemy.altitude - airborneHeight, facing, attack.name === 'kick' ? 106 : 88, size)) {
      damage(enemy, 'enemy', attack.name === 'kick' ? 30 : 20, facing, enemy.altitude);
      enemy.attackTime = null;
      enemy.cooldown = 0.4;
    }
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
      x += direction * walkSpeed * dt;
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
    frameIndex = Math.floor(animationTime * (next === 'walk' ? 13 : 4)) % sprites[next].length;
  }
  if (next === 'fly') frameIndex = 2 + Math.floor(animationTime * 12) % 2;
  if (next === 'hover') frameIndex = Math.floor(animationTime * 4) % 2 === 0 ? 0 : 4;
  flightAngle = next === 'fly' ? Math.atan2(vertical, Math.abs(direction)) : 0;
  x = boundedX(x, width, 120 * size);
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
  const size = Math.min(1.42, height * 0.37 / 150);
  const playerFrame = update(dt, width, height, size);
  const enemyFrame = updateEnemy(dt, width, height, size);

  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#e5e9ef';
  context.fillRect(0, floor, width, 1);
  context.imageSmoothingEnabled = false;
  if (enemyFrame) {
    const baseline = floor - enemy.altitude;
    const barY = Math.max(2, baseline - enemyFrame.frame.height * enemyFrame.scale * size - 13);
    enemyHud.style.transform = 'translate(' + Math.round(enemy.x) + 'px, ' + Math.round(barY) + 'px) translateX(-50%)';
    drawFighter(enemyFrame, enemy.x, baseline, enemy.facing, size);
  }
  drawFighter(playerFrame, x, floor - airborneHeight, facing, size, flightAngle);
}

function drawFighter({ frame, scale }, position, baseline, direction, size, angle = 0) {
  const spriteWidth = frame.width * scale * size;
  const spriteHeight = frame.height * scale * size;
  context.save();
  context.translate(Math.round(position), Math.round(baseline));
  context.scale(direction, 1);
  if (angle) {
    context.translate(0, -spriteHeight * 0.48);
    context.rotate(angle);
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
    const [base, charge, combat] = await Promise.all([
      loadImage('assets/goku-base.png'), loadImage('assets/goku-ki.png'), loadImage('assets/combat.png'),
    ]);
    const idle = readRow(base, baseColumns, 5, 159);
    const combatColumns = Array.from({ length: 6 }, (_, index) => Math.round(index * combat.width / 5));
    const combatRows = Array.from({ length: 4 }, (_, index) => Math.round(index * combat.height / 3));
    const enemyFrames = readRow(combat, combatColumns, combatRows[0], combatRows[1], 1, true);
    const enemyHit = readRow(combat, combatColumns, combatRows[1], combatRows[2], 1, true);
    const gokuHit = readRow(combat, combatColumns, combatRows[2], combatRows[3], 1, true);
    const enemyScale = 108 / enemyFrames[0].frame.height;
    for (const frame of [...enemyFrames, ...enemyHit]) frame.scale = enemyScale;
    const gokuScale = 132 / gokuHit[0].frame.height;
    for (const frame of gokuHit) frame.scale = gokuScale;
    sprites = {
      idle,
      enemy: enemyFrames,
      enemyHit,
      gokuHit,
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
