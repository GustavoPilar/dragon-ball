const namekRoute = {
  width: 6200,
  ceiling: 1120,
  start: 860,
  walls: [
    [1000, 1280, 164, 220], [1430, 1570, 0, 360], [2050, 2470, 223, 275],
    [2680, 2850, 0, 505], [3060, 3420, 355, 420], [3610, 3790, 290, 725],
    [3950, 4350, 570, 630], [4560, 4780, 0, 365], [5090, 5500, 736, 800],
    [5570, 5740, 210, 430],
  ],
  balls: [[1165, 238], [1780, 20], [2310, 295], [3250, 440], [4190, 650], [5370, 820], [5870, 20]],
  patrols: [
    { trigger: 1090, positions: [[1060, 70], [1250, 250], [1320, 113]] },
    { trigger: 2310, positions: [[1910, 40], [2330, 320], [2510, 170]] },
    { trigger: 3860, positions: [[3340, 457], [3860, 485]] },
    { trigger: 5300, positions: [[5050, 490], [5520, 600], [5835, 55]] },
  ],
};

const campaignTerrain = [
  [390, 690, 185, 240], [900, 1010, 0, 170], [1210, 1530, 306, 365],
  [2760, 3110, 205, 270], [3240, 3380, 0, 455], [3540, 3950, 490, 565],
];
const canyonTerrain = [
  [470, 620, 0, 280], [760, 1080, 355, 410], [1220, 1520, 210, 270],
  [2800, 3150, 245, 310], [3190, 3320, 105, 535], [3460, 3900, 480, 550],
];
const rooftopTerrain = [
  [360, 725, 230, 286], [865, 1030, 0, 145], [1310, 1640, 375, 432],
  [2680, 3030, 148, 220], [3180, 3590, 365, 425], [3720, 3820, 185, 570],
];

function terrainFloor(walls, x, altitude, halfWidth = 0) {
  let floor = 0;
  for (const [left, right, , top] of walls) {
    if (x + halfWidth > left && x - halfWidth < right && altitude + .015 >= top) {
      floor = Math.max(floor, top);
    }
  }
  return floor;
}

function safeTerrainAltitude(walls, x, altitude, halfWidth, height) {
  for (const [left, right, bottom, top] of walls) {
    if (x + halfWidth > left && x - halfWidth < right && altitude < top && altitude + height > bottom) {
      altitude = top;
    }
  }
  return altitude;
}

function moveInTerrain(walls, x, feet, nextX, nextFeet, half, bodyHeight) {
  let targetX = nextX;
  for (const [left, right, bottom, top] of walls) {
    if (feet >= top || feet + bodyHeight <= bottom) continue;
    if (nextX > x && x + half <= left && targetX + half > left) targetX = left - half;
    if (nextX < x && x - half >= right && targetX - half < right) targetX = right + half;
  }

  let targetFeet = Math.max(0, nextFeet);
  for (const [left, right, bottom, top] of walls) {
    if (targetX + half <= left || targetX - half >= right) continue;
    if (feet >= top && targetFeet < top) targetFeet = top;
    if (feet + bodyHeight <= bottom && targetFeet + bodyHeight > bottom) {
      targetFeet = bottom - bodyHeight;
    }
  }
  return { x: targetX, altitude: targetFeet };
}

function closestTerrainHit(walls, x, y, targetX, targetY) {
  let limit = 1;
  for (const [left, right, bottom, top] of walls) {
    const dx = targetX - x;
    const dy = targetY - y;
    if ((!dx && (x <= left || x >= right)) || (!dy && (y <= bottom || y >= top))) continue;
    const t1 = dx ? (left - x) / dx : -Infinity;
    const t2 = dx ? (right - x) / dx : Infinity;
    const t3 = dy ? (bottom - y) / dy : -Infinity;
    const t4 = dy ? (top - y) / dy : Infinity;
    const enter = Math.max(0, Math.min(t1, t2), Math.min(t3, t4));
    const exit = Math.min(limit, Math.max(t1, t2), Math.max(t3, t4));
    if (enter < exit) limit = enter;
  }
  return limit;
}

function pathHeight(walls, x, feet, targetX, goal, size) {
  const direction = Math.sign(targetX - x);
  let altitude = goal;
  for (const [left, right, bottom, top] of walls) {
    const edge = direction > 0 ? left : right;
    const distance = (edge - x) * direction;
    if (!direction || distance > 155 || distance < -(right - left) - 27 * size ||
        (targetX - edge) * direction <= 0 || goal >= top || feet + 100 * size <= bottom && goal + 100 * size <= bottom) continue;
    altitude = Math.max(altitude, top + 22 * size);
  }
  return altitude;
}

function paintTerrain(draw, walls, leftEdge, width, height, floor, alien) {
  for (const [left, right, bottom, top] of walls) {
    const y = floor - top;
    const thickness = top - bottom;
    if (right < leftEdge || left > leftEdge + width || y > height || y + thickness < 0) continue;
    draw.fillStyle = alien ? '#594762' : '#665443';
    draw.fillRect(left, y, right - left, thickness);
    draw.fillStyle = alien ? '#89719c' : '#9e7857';
    draw.fillRect(left + 5, y + 8, right - left - 10, thickness - 11);
    for (let band = 11; band < thickness - 8; band += 33) {
      for (let edge = left + 9 + band % 17; edge < right - 17; edge += 27) {
        const noise = (edge * 13 + band * 7) % 31;
        const start = y + band + noise % 9;
        const depth = Math.min(11 + noise % 15, Math.max(0, y + thickness - 5 - start));
        draw.fillStyle = alien ? '#ae90bf' : '#ba9367';
        draw.fillRect(edge, start, 7 + noise % 8, depth);
        draw.fillStyle = alien ? '#6b567e' : '#825f4b';
        draw.fillRect(edge + 6, start + Math.min(7, depth), 4, Math.max(0, depth - 7));
      }
    }
    draw.fillStyle = alien ? '#4a8838' : '#597835';
    draw.fillRect(left, y, right - left, 9);
    draw.fillStyle = alien ? '#c0e371' : '#a6bd60';
    draw.fillRect(left, y, right - left, 3);
    draw.fillStyle = alien ? '#6ca747' : '#7c924c';
    for (let edge = left + 5; edge < right - 10; edge += 13) {
      draw.fillRect(edge, y + 5, 5 + edge % 5, 4 + edge % 5);
    }
  }
}

function paintDragonRadar(draw, world, walls, playerX, altitude, balls, enemies) {
  const size = 128;
  draw.clearRect(0, 0, size, size);
  draw.save();
  draw.beginPath();
  draw.arc(64, 64, 60, 0, Math.PI * 2);
  draw.clip();
  draw.fillStyle = '#153e33';
  draw.fillRect(0, 0, size, size);
  draw.strokeStyle = '#35765b';
  draw.lineWidth = 1;
  for (let line = 16; line < size; line += 16) {
    draw.beginPath();
    draw.moveTo(line, 0);
    draw.lineTo(line, size);
    draw.moveTo(0, line);
    draw.lineTo(size, line);
    draw.stroke();
  }
  const radarX = (x) => 14 + x / world.width * 100;
  const radarY = (y) => 92 - y / world.ceiling * 56;
  draw.fillStyle = '#62a780';
  for (const [left, right, bottom, top] of walls) {
    const start = radarY(top);
    draw.fillRect(radarX(left), start, Math.max(2, radarX(right) - radarX(left)), Math.max(2, radarY(bottom) - start));
  }
  draw.fillStyle = '#e98290';
  for (const enemy of enemies) {
    if (enemy.health) draw.fillRect(radarX(enemy.x) - 1, radarY(enemy.altitude) - 1, 3, 3);
  }
  for (const ball of balls) {
    if (ball.found) continue;
    draw.fillStyle = '#ff9d36';
    draw.beginPath();
    draw.arc(radarX(ball.x), radarY(ball.y), 3.5, 0, Math.PI * 2);
    draw.fill();
  }
  draw.fillStyle = '#edfdd5';
  draw.strokeStyle = '#163329';
  draw.lineWidth = 2;
  const px = radarX(playerX);
  const py = radarY(altitude);
  draw.beginPath();
  draw.moveTo(px, py - 5);
  draw.lineTo(px - 4, py + 3);
  draw.lineTo(px + 4, py + 3);
  draw.closePath();
  draw.stroke();
  draw.fill();
  draw.restore();
  draw.strokeStyle = '#b4d7ad';
  draw.lineWidth = 4;
  draw.beginPath();
  draw.arc(64, 64, 60, 0, Math.PI * 2);
  draw.stroke();
}
