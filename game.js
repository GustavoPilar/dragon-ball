const canvas = document.querySelector('#arena');
const context = canvas.getContext('2d');
const meter = document.querySelector('#ki');
const kiValue = document.querySelector('#ki-value');
const status = document.querySelector('#status');
const fullscreen = document.querySelector('#fullscreen');
const pause = document.querySelector('#pause');
const pauseMenu = document.querySelector('#pause-menu');
const restart = document.querySelector('#restart');
const pickUp = document.querySelector('#pick-up');
const seedSlot = document.querySelector('#seed-slot');
const seedCount = document.querySelector('#seed-count');
const landscape = matchMedia('(orientation: landscape)');
const buttons = [...document.querySelectorAll('[data-action]')];
const jumpButton = document.querySelector('[data-action="jump"]');
const joystick = document.querySelector('#joystick');
const game = document.querySelector('#game');
const enemyHealthTemplate = document.querySelector('#enemy-health-template');
const defeat = document.querySelector('#defeat');
const gokuHealth = document.querySelector('#goku-health');
const combatNotice = document.querySelector('#combat-notice');

const keys = new Map([
  ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
  ['ArrowUp', 'up'], ['ArrowDown', 'down'],
  ['Space', 'jump'],
  ['KeyZ', 'punch'], ['KeyX', 'kick'], ['KeyC', 'charge'], ['KeyV', 'blast'],
  ['KeyB', 'beam'],
]);
const heldInputs = new Map();
const walkSpeed = 320;
const flightSpeed = 380;
const verticalFlightSpeed = 1; // Viewport heights per second.
const chargeSpeed = 40;
const blastCost = 10;
const beamCost = 40;
const beamDuration = 2;
const beamChargeDuration = 0.85;
const flightKiMinimum = 10;
const criticalHealth = 25;
const attackFrameTime = 0.085;
const doubleTapTime = 350;
const jumpDuration = 0.65;
const stick = { pointerId: null, x: 0, y: 0 };
const playerCombat = { health: 100, reaction: null };
const enemies = [];
const blasts = [];
let beam = null;
let noticeTime = 0;
const maxEnemies = 6;
const defeatFallTime = 0.85;
const defeatBlinkTime = 0.72;
let spawnTime = 2.5;
let spawnInterval = 5;
let spawnSide = 1;
const seed = { position: 0.27 + Math.random() * 0.46, altitude: null, delay: 2.8, collected: false };
let seedsInInventory = 0;
let itemAction = null;
const pickupDuration = 1.05;
const eatDuration = 0.8;

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

function showNotice(message) {
  combatNotice.textContent = message;
  combatNotice.hidden = false;
  noticeTime = 1.5;
}

function flightRestriction() {
  if (playerCombat.health <= criticalHealth) return 'Goku está ferido demais para voar.';
  if (ki < flightKiMinimum) return 'Carregue pelo menos 10% de ki para voar.';
  return '';
}

function setFlying(enabled) {
  flying = enabled;
  liftingOff = enabled;
  jumpButton.setAttribute('aria-pressed', String(enabled));
}

function triggerJump(now) {
  if (now - lastJumpPress <= doubleTapTime) {
    lastJumpPress = -Infinity;
    const restriction = flying ? '' : flightRestriction();
    if (restriction) {
      showNotice(restriction);
      return;
    }
    setFlying(!flying);
    jumpElapsed = null;
    return;
  }
  lastJumpPress = now;
  if (!flying && airborneHeight === 0 && jumpElapsed === null) jumpElapsed = 0;
}

function press(input, action) {
  if (pauseMenu.open || !landscape.matches || !sprites || !playerCombat.health || heldInputs.has(input)) return;
  heldInputs.set(input, action);
  if (itemAction) return;
  if (action === 'beam' || action === 'blast') {
    tryKiAttack(action);
    syncButtons();
    return;
  }
  if (beam) {
    syncButtons();
    return;
  }
  if (action === 'jump' && !playerCombat.reaction) triggerJump(performance.now());
  if ((action === 'punch' || action === 'kick') && !playerCombat.reaction && !attack && !active('charge')) {
    attack = { name: action, elapsed: 0 };
  }
  syncButtons();
}

function tryKiAttack(action) {
  const isBeam = action === 'beam';
  if (playerCombat.reaction) {
    showNotice('Espere o Goku se recuperar para disparar.');
    return;
  }
  if (beam || attack) {
    showNotice('Espere o ataque atual terminar para disparar.');
    return;
  }
  if (ki < (isBeam ? beamCost : blastCost)) {
    showNotice(isBeam ? 'O Kamehameha custa 40% de ki.' : 'A esfera custa 10% de ki.');
    return;
  }
  combatNotice.hidden = true;
  noticeTime = 0;
  if (isBeam) {
    beam = { direction: facing, elapsed: -beamChargeDuration, targets: new WeakSet() };
    addKi(-beamCost);
    lastJumpPress = -Infinity;
  } else {
    attack = { name: action, elapsed: 0 };
  }
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

pause.addEventListener('click', () => {
  pauseMenu.showModal();
  game.classList.add('paused');
  heldInputs.clear();
  resetStick();
  syncButtons();
});
pauseMenu.addEventListener('cancel', (event) => event.preventDefault());
restart.addEventListener('click', () => location.reload());

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

function addKi(amount) {
  const next = Math.max(0, Math.min(100, ki + amount));
  if (Math.floor(next) !== Math.floor(ki)) {
    meter.value = Math.floor(next);
    kiValue.textContent = meter.value + '%';
  }
  ki = next;
  enforceFlightRestriction();
}

function updateHealthMeter() {
  gokuHealth.value = playerCombat.health;
  document.querySelector('#goku-health-value').textContent = playerCombat.health + '/' + gokuHealth.max;
}

function canUseItem() {
  return landscape.matches && !pauseMenu.open && playerCombat.health && !playerCombat.reaction &&
    !itemAction && !attack && !beam;
}

function canPickUp(width, size) {
  return canUseItem() && !seed.collected && seed.altitude === 0 && airborneHeight <= 8 * size &&
    Math.abs(x - seed.position * width) <= 48 * size;
}

pickUp.addEventListener('click', () => {
  const size = Math.min(1.42, canvas.clientHeight * 0.37 / 150);
  if (!canPickUp(canvas.clientWidth, size)) return;
  seed.collected = true;
  itemAction = { type: 'pickup', elapsed: 0 };
  pickUp.hidden = true;
  lastJumpPress = -Infinity;
});

seedSlot.addEventListener('click', () => {
  if (!seedsInInventory || !canUseItem()) return;
  itemAction = { type: 'eat', elapsed: 0 };
  seedSlot.disabled = true;
  lastJumpPress = -Infinity;
});

function updateSeed(dt, width, floor, size) {
  if (!seed.collected && playerCombat.health) {
    seed.delay -= dt;
    if (seed.delay <= 0) {
      seed.altitude ??= floor + 20;
      seed.altitude = Math.max(0, seed.altitude - 320 * dt);
    }
  }
  pickUp.hidden = !canPickUp(width, size);
  seedSlot.disabled = !seedsInInventory || !canUseItem();
}

function drawSeed(position, y, scale) {
  context.save();
  context.translate(Math.round(position), Math.round(y));
  context.scale(scale, scale);
  context.fillStyle = '#153d2c';
  context.fillRect(-6, -3, 12, 7);
  context.fillRect(-2, -7, 9, 10);
  context.fillRect(-5, 4, 8, 2);
  context.fillStyle = '#4cba63';
  context.fillRect(-4, -2, 8, 6);
  context.fillRect(0, -5, 5, 7);
  context.fillStyle = '#b7eb77';
  context.fillRect(-3, -1, 6, 2);
  context.fillRect(1, -4, 3, 3);
  context.restore();
}

function updateItemAction(dt, frames) {
  itemAction.elapsed += dt;
  const picking = itemAction.type === 'pickup';
  const finish = picking ? pickupDuration : eatDuration;
  if (itemAction.elapsed >= finish) {
    if (picking) seedsInInventory++;
    else {
      seedsInInventory--;
      playerCombat.health = gokuHealth.max;
      updateHealthMeter();
      addKi(100);
    }
    seedSlot.classList.toggle('occupied', seedsInInventory > 0);
    seedCount.textContent = seedsInInventory || '';
    itemAction = null;
    return null;
  }
  animation = itemAction.type;
  flightAngle = 0;
  return frames[(picking ? 0 : 2) + Number(itemAction.elapsed >= (picking ? 0.23 : 0.32))];
}

function enforceFlightRestriction() {
  if (!flying) return;
  const restriction = flightRestriction();
  if (!restriction) return;
  setFlying(false);
  if (playerCombat.health) showNotice(restriction);
}

function damage(target, amount, direction, altitude) {
  target.health = Math.max(0, target.health - amount);
  target.reaction = { time: 0, direction, altitude };
  if (target === playerCombat) {
    updateHealthMeter();
    facing = -direction;
    enforceFlightRestriction();
  } else {
    target.meter.value = target.health;
    target.facing = -direction;
    if (!target.health) {
      target.meter.remove();
      addKi(20);
    }
  }
}

function inRange(dx, dy, direction, reach, size) {
  return dx * direction >= -8 * size && Math.abs(dx) <= reach * size &&
    Math.abs(dy) <= 49 * size;
}

function resolveAttack(name, size) {
  if (name === 'blast') {
    if (ki < blastCost) return;
    addKi(-blastCost);
    blasts.push({ x: x + facing * 49 * size, altitude: airborneHeight + 96 * size, direction: facing });
    return;
  }
  const isKick = name === 'kick';
  for (const enemy of enemies) {
    const dx = enemy.x - x;
    if (!enemy.health || dx * facing < 0 ||
        !inRange(dx, enemy.altitude - airborneHeight, facing, isKick ? 106 : 88, size)) continue;
    hitEnemy(enemy, isKick ? 30 : 20, facing);
  }
}

function hitEnemy(enemy, amount, direction) {
  damage(enemy, amount, direction, enemy.altitude);
  enemy.attackTime = null;
  enemy.cooldown = 0.4;
}

function updateBlasts(dt, width, size) {
  for (let index = blasts.length - 1; index >= 0; index--) {
    const blast = blasts[index];
    const distance = 640 * dt;
    const radius = 31 * size;
    let target;
    let nearest = distance + radius;
    for (const enemy of enemies) {
      const ahead = (enemy.x - blast.x) * blast.direction;
      const altitude = blast.altitude - enemy.altitude;
      if (enemy.health && ahead >= -radius && ahead <= nearest &&
          altitude >= 12 * size && altitude <= 112 * size) {
        target = enemy;
        nearest = ahead;
      }
    }
    blast.x += blast.direction * distance;
    if (target) hitEnemy(target, 35, blast.direction);
    if (target || blast.x < -radius || blast.x > width + radius) blasts.splice(index, 1);
  }
}

function drawBlast(blast, floor, size) {
  const y = floor - blast.altitude;
  const radius = 14 * size;
  context.fillStyle = '#a4e7ff';
  context.fillRect(blast.x - blast.direction * radius * 2, y - radius / 4,
    blast.direction * radius * 2, radius / 2);
  for (const [scale, color] of [[1, '#2089db'], [0.75, '#76dfff'], [0.47, '#f4fcff']]) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(blast.x, y, radius * scale, 0, Math.PI * 2);
    context.fill();
  }
}

function applyBeam(width, size) {
  const origin = beamOrigin(width, size);
  const range = Math.abs(origin.end - origin.x);
  for (const enemy of enemies) {
    const ahead = (enemy.x - origin.x) * beam.direction;
    const altitude = origin.altitude - enemy.altitude;
    if (!enemy.health || beam.targets.has(enemy) || (enemy.x - x) * beam.direction < 0 ||
        ahead < -32 * size || ahead > range ||
        altitude < -5 * size || altitude > 125 * size) continue;
    beam.targets.add(enemy);
    hitEnemy(enemy, 75, beam.direction);
  }
}

function beamOrigin(width, size) {
  const end = beam.direction > 0 ? width : 0;
  const hand = x + beam.direction * 52 * size;
  return {
    x: Math.max(0, Math.min(width, hand)),
    altitude: airborneHeight + 89 * size,
    end,
  };
}

function drawBeam(width, floor, size) {
  const origin = beamOrigin(width, size);
  const y = floor - origin.altitude;
  const fade = Math.min(1, (beamDuration - beam.elapsed) / 0.22);
  const radius = (17 + 2 * Math.sin(beam.elapsed * 48)) * size * fade;
  for (const [scale, color] of [[1.35, '#b0eaff'], [1, '#138bff'], [0.67, '#75dcff'], [0.36, '#faffff']]) {
    const band = radius * scale;
    context.fillStyle = color;
    context.fillRect(origin.x, y - band, origin.end - origin.x, band * 2);
    context.beginPath();
    context.arc(origin.x, y, band, 0, Math.PI * 2);
    context.fill();
  }
}

function drawBeamFocus(width, height, floor, size) {
  const progress = 1 + beam.elapsed / beamChargeDuration;
  const handY = floor - airborneHeight - 70 * size;
  const shade = context.createRadialGradient(x, handY, 25 * size, x, handY, 220 * size);
  shade.addColorStop(0, 'rgba(12, 25, 52, ' + (progress * 0.25) + ')');
  shade.addColorStop(1, 'rgba(12, 25, 52, ' + (progress * 0.62) + ')');
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
}

function drawBeamCharge(floor, size) {
  const progress = 1 + beam.elapsed / beamChargeDuration;
  const handX = x - beam.direction * 30 * size;
  const handY = floor - airborneHeight - 70 * size;
  for (let index = 0; index < 16; index++) {
    const travel = (progress * 2.4 + index / 16) % 1;
    const angle = index * 2.4 + travel * 0.7;
    const distance = (1 - travel) * 110 * size;
    const px = handX + Math.cos(angle) * distance;
    const py = handY + Math.sin(angle) * distance * 0.72;
    context.fillStyle = index % 2 ? '#75dcff' : '#faffff';
    context.fillRect(Math.round(px), Math.round(py), (2 + 2 * travel) * size, (2 + 2 * travel) * size);
  }
  const radius = (3 + progress * 10) * size;
  for (const [scale, color] of [[1, '#138bff'], [0.7, '#75dcff'], [0.45, '#faffff']]) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(handX, handY, radius * scale, 0, Math.PI * 2);
    context.fill();
  }
}

function boundedX(position, width, padding) {
  const edge = Math.min(width / 2, padding);
  return Math.max(edge, Math.min(width - edge, position));
}

function react(actor, dt, floorHeight, move) {
  const reaction = actor.reaction;
  reaction.time += dt;
  const duration = actor.health ? 0.32 : defeatFallTime;
  const progress = Math.min(1, reaction.time / duration);
  if (progress < 1) move(reaction.direction * (actor.health ? 105 : 160) * dt * (1 - progress));
  const arc = 4 * progress * (1 - progress);
  const altitude = actor.health ? reaction.altitude + floorHeight * 0.035 * arc
    : reaction.altitude * (1 - progress) + floorHeight * 0.18 * arc;
  if (progress === 1 && actor.health) actor.reaction = null;
  const frameIndex = actor.health ? (progress < 0.48 ? 0 : 1)
    : (progress === 1 ? 4 : Math.min(3, Math.floor(progress * 4)));
  const blinkElapsed = reaction.time - defeatFallTime;
  const finished = !actor.health && blinkElapsed >= defeatBlinkTime;
  const visible = !finished && (actor.health || blinkElapsed < 0 ||
    Math.floor(blinkElapsed / 0.09) % 2 === 0);
  return { altitude, frameIndex, finished, visible };
}

function spawnEnemy(dt, width, height, size) {
  if (!playerCombat.health) return;
  spawnTime -= dt;
  if (spawnTime > 0 || enemies.length >= maxEnemies) return;
  const meter = enemyHealthTemplate.content.firstElementChild.cloneNode(true);
  game.append(meter);
  enemies.push({
    meter, health: meter.max, reaction: null, gone: false,
    x: spawnSide > 0 ? width - 55 * size : 55 * size,
    altitude: height * 0.12, facing: -spawnSide, attackTime: null, cooldown: 0,
  });
  spawnSide *= -1;
  spawnTime = spawnInterval;
  spawnInterval = Math.max(2.4, spawnInterval * 0.9);
}

function updateEnemy(enemy, dt, width, height, size) {
  enemy.x = boundedX(enemy.x, width, 52 * size);
  if (enemy.reaction) {
    const result = react(enemy, dt, height, (dx) => {
      enemy.x = boundedX(enemy.x + dx, width, 52 * size);
    });
    enemy.altitude = result.altitude;
    enemy.gone = result.finished;
    return result.visible ? sprites.enemyHit[result.frameIndex] : null;
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
      damage(playerCombat, 15, enemy.facing, airborneHeight);
      attack = null;
      jumpElapsed = null;
      lastJumpPress = -Infinity;
      chargeTime = 0;
      if (!playerCombat.health) {
        setFlying(false);
        blasts.length = 0;
        beam = null;
        itemAction = null;
        combatNotice.hidden = true;
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
  const travelDirection = Math.sign(dx);
  let travel = Math.min(gap, 145 * dt);
  for (const ahead of enemies) {
    const spacing = (ahead.x - enemy.x) * travelDirection;
    if (ahead !== enemy && ahead.health && spacing >= 0 && spacing < Math.abs(dx) &&
        Math.abs(ahead.altitude - enemy.altitude) < 30 * size) {
      travel = Math.min(travel, Math.max(0, spacing - 29 * size));
    }
  }
  enemy.x += travelDirection * travel;
  const altitudeTarget = Math.max(height * 0.018, airborneHeight);
  const rise = altitudeTarget - enemy.altitude;
  enemy.altitude += Math.sign(rise) * Math.min(Math.abs(rise), height * 0.47 * dt);
  return sprites.enemy[gap > 4 || Math.abs(rise) > 8 ? 1 : 0];
}

function update(dt, width, height, size) {
  if (noticeTime > 0) {
    noticeTime -= dt;
    if (noticeTime <= 0) combatNotice.hidden = true;
  }
  const outfit = playerCombat.health <= criticalHealth ? sprites.shirtless
    : playerCombat.health <= 60 ? sprites.torn : null;
  if (beam?.elapsed < 0) {
    facing = beam.direction;
    flightAngle = 0;
    animation = 'beamCharge';
    return (outfit?.beam ?? sprites.beam)[0];
  }
  if (playerCombat.reaction) {
    const result = react(playerCombat, dt, height, (dx) => {
      x = boundedX(x + dx, width, 120 * size);
    });
    airborneHeight = result.altitude;
    flightAngle = 0;
    animation = playerCombat.health ? 'hurt' : 'defeated';
    if (result.finished) defeat.hidden = false;
    return result.visible ? (outfit?.gokuHit ?? sprites.gokuHit)[result.frameIndex] : null;
  }
  if (itemAction) {
    const pose = updateItemAction(dt, outfit?.item ?? sprites.item);
    if (pose) return pose;
  }
  const { x: horizontal, y: vertical } = beam ? { x: 0, y: 0 } : movementVector();
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
  if (beam) {
    facing = beam.direction;
    flightAngle = 0;
    animation = 'beam';
    return (outfit?.beam ?? sprites.beam)[1];
  }
  let next = 'idle';
  let frameIndex = 0;

  if (attack) {
    const before = attack.elapsed;
    attack.elapsed += dt;
    const impact = attackFrameTime * 2;
    if (before < impact && attack.elapsed >= impact) resolveAttack(attack.name, size);
    if (attack.elapsed >= sprites[attack.name].length * attackFrameTime) attack = null;
  }

  if (attack) {
    next = attack.name;
    frameIndex = Math.floor(attack.elapsed / attackFrameTime);
  } else if (active('charge')) {
    next = 'charge';
    chargeTime += dt;
    addKi(chargeSpeed * dt);
    frameIndex = chargeTime < 0.45 ? Math.floor(chargeTime / 0.15)
      : 3 + Math.floor(chargeTime / 0.12) % 2;
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
  const frames = outfit?.[next] ?? sprites[next === 'hover' ? 'fly' : next];
  return frames[frameIndex];
}

function render(time) {
  requestAnimationFrame(render);
  if (pauseMenu.open || !landscape.matches || document.hidden) return;
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
  if (beam) {
    beam.elapsed += dt;
    if (beam.elapsed >= beamDuration) beam = null;
  }
  const playerFrame = update(dt, width, height, size);
  const focusing = beam?.elapsed < 0;
  game.classList.toggle('beam-focus', focusing);
  if (!focusing) {
    updateSeed(dt, width, floor, size);
    updateBlasts(dt, width, size);
    spawnEnemy(dt, width, height, size);
    if (beam) applyBeam(width, size);
  }

  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#e5e9ef';
  context.fillRect(0, floor, width, 1);
  context.imageSmoothingEnabled = false;
  if (!seed.collected && seed.altitude !== null) {
    drawSeed(seed.position * width, floor - seed.altitude - 7 * size, size * 1.35);
  }
  for (const enemy of enemies) {
    if (!focusing) enemy.frame = updateEnemy(enemy, dt, width, height, size);
    const frame = enemy.frame;
    if (!frame) continue;
    const baseline = floor - enemy.altitude;
    if (enemy.health) {
      const barY = Math.max(2, baseline - frame.frame.height * frame.scale * size - 13);
      enemy.meter.style.transform = 'translate(' + Math.round(enemy.x) + 'px, ' + Math.round(barY) + 'px) translateX(-50%)';
    }
    drawFighter(frame, enemy.x, baseline, enemy.facing, size);
  }
  for (let index = enemies.length - 1; index >= 0; index--) {
    if (enemies[index].gone) enemies.splice(index, 1);
  }
  for (const blast of blasts) drawBlast(blast, floor, size);
  if (focusing) drawBeamFocus(width, height, floor, size);
  if (playerFrame) drawFighter(playerFrame, x, floor - airborneHeight, facing, size, flightAngle);
  if (itemAction?.type === 'pickup' && animation === 'pickup' && itemAction.elapsed >= 0.23) {
    const hover = Math.sin(itemAction.elapsed * 10) * 4 * size;
    const handHeight = playerFrame.frame.height * playerFrame.scale;
    drawSeed(x - facing * 19 * size, floor - airborneHeight - (handHeight + 15) * size + hover, size * 1.55);
  }
  if (focusing) drawBeamCharge(floor, size);
  else if (beam) drawBeam(width, floor, size);
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

function lookPose({ frame, scale }, angle, neckX = 122, neckY = 53) {
  const pose = document.createElement('canvas');
  pose.width = frame.width;
  pose.height = frame.height;
  const draw = pose.getContext('2d');
  draw.imageSmoothingEnabled = false;
  // The first idle frame is cut at the neck so the feet and torso stay planted.
  const bodyHeight = frame.height - neckY;
  draw.drawImage(frame, 0, neckY, frame.width, bodyHeight, 0, neckY, frame.width, bodyHeight);
  draw.translate(neckX, neckY);
  draw.rotate(angle);
  draw.drawImage(frame, 0, 0, frame.width, neckY + 3, -neckX, -neckY, frame.width, neckY + 3);
  return [{ frame: pose, scale }];
}

function readOutfit(image, top) {
  const rowHeight = image.height / 4;
  const movement = [0, 256, 512, 768, 982, 1260, 1536];
  const actions = [0, 256, 512, 747, 994, 1240, 1536];
  const [idle, stepA, stepB, jump, fly, hurt] =
    readRow(image, movement, top, top + rowHeight, 1, true);
  const [guard, punch, kick, blast, charge, down] =
    readRow(image, actions, top + rowHeight, top + 2 * rowHeight, 1, true);
  const scale = 142 / idle.frame.height;
  for (const pose of [idle, stepA, stepB, jump, fly, hurt, guard, punch, kick, blast, charge, down]) {
    pose.scale = scale;
  }
  const neckX = idle.frame.width * 0.62;
  const neckY = idle.frame.height * 0.29;
  return {
    idle: [idle, idle, idle, idle, idle],
    walk: [stepA, stepA, stepB, stepB, stepA],
    lookUp: lookPose(idle, -0.24, neckX, neckY),
    lookDown: lookPose(idle, 0.24, neckX, neckY),
    jump: [guard, jump, jump, jump, guard],
    fly: [idle, fly, fly, fly, idle],
    hover: [idle, idle, idle, idle, idle],
    punch: [guard, guard, punch, guard, guard],
    kick: [guard, guard, kick, guard, guard],
    blast: [guard, guard, blast, blast, guard],
    charge: [idle, charge, charge, charge, charge],
    gokuHit: [hurt, hurt, hurt, down, down],
  };
}

async function start() {
  try {
    const [base, charge, combat, damaged, kame, senzu] = await Promise.all([
      loadImage('assets/goku-base.png'), loadImage('assets/goku-ki.png'), loadImage('assets/combat.png'),
      loadImage('assets/goku-damaged.png'), loadImage('assets/goku-kamehameha.png'),
      loadImage('assets/goku-senzu.png'),
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
    const punch = readRow(base, baseColumns, 833, 963);
    for (const frame of gokuHit) frame.scale = gokuScale;
    const beamPoses = [0, 1, 2].map((row) => {
      const top = Math.round(kame.height * row / 3);
      const bottom = Math.round(kame.height * (row + 1) / 3);
      const frames = readRow(kame, [0, Math.round(kame.width / 2), kame.width], top, bottom, 1, true);
      const scale = 142 / frames[0].frame.height;
      for (const pose of frames) pose.scale = scale;
      return frames;
    });
    const itemColumns = Array.from({ length: 5 }, (_, index) => Math.round(senzu.width * index / 4));
    const itemPoses = [0, 1, 2].map((row) => {
      const top = Math.round(senzu.height * row / 3);
      const bottom = Math.round(senzu.height * (row + 1) / 3);
      const frames = readRow(senzu, itemColumns, top, bottom, 1, true);
      const scale = 142 / frames[2].frame.height;
      for (const pose of frames) pose.scale = scale;
      return frames;
    });
    sprites = {
      idle,
      beam: beamPoses[0],
      item: itemPoses[0],
      enemy: enemyFrames,
      enemyHit,
      gokuHit,
      torn: { ...readOutfit(damaged, 0), beam: beamPoses[1], item: itemPoses[1] },
      shirtless: { ...readOutfit(damaged, damaged.height / 2), beam: beamPoses[2], item: itemPoses[2] },
      lookUp: lookPose(idle[0], -0.24),
      lookDown: lookPose(idle[0], 0.24),
      walk: readRow(base, baseColumns, 159, 298),
      jump: readRow(base, baseColumns, 426, 566),
      fly: readRow(base, baseColumns, 694, 833),
      punch,
      blast: [punch[0], punch[1], punch[2], punch[2], punch[4]],
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
