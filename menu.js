const sagas = sagaLevels;

const launch = new URLSearchParams(location.search);
const training = launch.get('modo') === 'treino';
const selectedLevel = sagas.flatMap((saga) => saga.levels)
  .find((level) => level.playable && level.id === launch.get('fase'));
const playing = training || Boolean(selectedLevel);
const selectedSaga = sagas.find((saga) => saga.levels.includes(selectedLevel));
const bestResults = new Map();

try {
  const saved = JSON.parse(localStorage.getItem('dragon-ball-completed') || '[]');
  if (Array.isArray(saved)) {
    for (const id of saved) {
      bestResults.set(id, { stars: 1, score: 0 });
    }
  }
  const results = JSON.parse(localStorage.getItem('dragon-ball-results') || '{}');
  for (const [id, result] of Object.entries(results)) {
    if (!Number.isInteger(result?.stars) || result.stars < 1 || result.stars > 3 ||
        !Number.isFinite(result.score)) continue;
    bestResults.set(id, result);
  }
} catch {
  // The menus still work when browser storage is unavailable.
}

function recordCompletedLevel(result) {
  if (!selectedLevel) return;
  const id = selectedLevel.id;
  const previous = bestResults.get(id);
  if (previous && (previous.stars > result.stars ||
      previous.stars === result.stars && previous.score >= result.score)) return;
  bestResults.set(id, result);
  try {
    localStorage.setItem('dragon-ball-results', JSON.stringify(Object.fromEntries(bestResults)));
  } catch {
    // Completion remains visible in the current level.
  }
}

function showStars(container, count) {
  const svgNS = 'http://www.w3.org/2000/svg';
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', count + ' de 3 estrelas');
  container.replaceChildren(...[0, 1, 2].map((index) => {
    const icon = document.createElementNS(svgNS, 'svg');
    icon.setAttribute('viewBox', '0 0 32 32');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.toggle('earned', index < count);
    icon.style.setProperty('--star-delay', (0.28 + index * 0.17) + 's');
    const star = document.createElementNS(svgNS, 'path');
    star.setAttribute('d', 'm16 2.5 4.2 8.5 9.4 1.35-6.8 6.62 1.6 9.35L16 23.9l-8.42 4.42 1.61-9.35-6.8-6.62 9.4-1.35z');
    icon.append(star);
    return icon;
  }));
}

function showMenu(screen, saga) {
  for (const [name, id] of [['main', 'main-menu'], ['sagas', 'saga-menu'], ['levels', 'level-menu']]) {
    document.getElementById(id).hidden = screen !== name;
  }
  if (screen === 'levels') {
    const list = document.querySelector('#level-list');
    const heading = document.querySelector('#level-title');
    heading.textContent = saga.title;
    list.replaceChildren(...saga.levels.map((level, index) => {
      const entry = document.createElement(level.playable ? 'a' : 'button');
      entry.textContent = (index + 1) + '. ' + level.title;
      if (level.playable) {
        entry.href = '?fase=' + level.id;
        if (bestResults.has(level.id)) {
          const stars = document.createElement('span');
          stars.classList.add('rating-stars');
          showStars(stars, bestResults.get(level.id).stars);
          entry.append(stars);
        }
      } else {
        entry.type = 'button';
        entry.disabled = true;
        entry.textContent += ' · Em breve';
      }
      return entry;
    }));
    heading.focus();
  } else if (screen === 'sagas') {
    document.querySelector('#saga-title').focus();
  } else {
    document.querySelector('#continue-game').focus();
  }
}

document.body.classList.toggle('playing', playing);
document.querySelector('#menu').hidden = playing;
document.querySelector('#game').hidden = !playing;
if (playing) {
  document.querySelector('#back-to-levels').href = selectedSaga ? '?saga=' + selectedSaga.id : '?';
} else {
  const sagaList = document.querySelector('#saga-list');
  for (const saga of sagas) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = saga.title;
    button.addEventListener('click', () => showMenu('levels', saga));
    sagaList.append(button);
  }
  document.querySelector('#continue-game').addEventListener('click', () => showMenu('sagas'));
  for (const button of document.querySelectorAll('[data-back]')) {
    button.addEventListener('click', () => showMenu(button.dataset.back));
  }
  const returnSaga = sagas.find((saga) => saga.id === launch.get('saga'));
  if (returnSaga) showMenu('levels', returnSaga);
}
