const sagas = [
  {
    id: 'saiyajin', title: 'Saga Saiyajin', levels: [
      { id: 'raditz', title: 'A chegada de Raditz', playable: true },
      { id: 'treinamento', title: 'O treinamento com o Senhor Kaio' },
      { id: 'nappa', title: 'O ataque de Nappa' },
      { id: 'vegeta', title: 'O duelo contra Vegeta' },
    ],
  },
  {
    id: 'freeza', title: 'Saga Freeza', levels: [
      { id: 'namek', title: 'As Esferas de Namek', playable: true },
      { id: 'ginyu', title: 'As Forças Especiais Ginyu' },
      { id: 'freeza', title: 'O confronto com Freeza' },
    ],
  },
  {
    id: 'androids-cell', title: 'Saga Androids/Cell', levels: [
      { id: 'trunks', title: 'O aviso de Trunks' },
      { id: 'androids', title: 'A chegada dos Androids' },
      { id: 'cell', title: 'A ascensão de Cell' },
      { id: 'jogos-de-cell', title: 'Os Jogos de Cell' },
    ],
  },
  {
    id: 'majin-buu', title: 'Saga Majin Buu', levels: [
      { id: 'torneio', title: 'O Torneio de Artes Marciais' },
      { id: 'babidi', title: 'A magia de Babidi' },
      { id: 'majin-buu', title: 'O despertar de Majin Buu' },
      { id: 'kid-buu', title: 'A batalha final contra Kid Buu' },
    ],
  },
];

const launch = new URLSearchParams(location.search);
const training = launch.get('modo') === 'treino';
const selectedLevel = sagas.flatMap((saga) => saga.levels)
  .find((level) => level.playable && level.id === launch.get('fase'));
const playing = training || Boolean(selectedLevel);
const selectedSaga = sagas.find((saga) => saga.levels.includes(selectedLevel));
const completedLevels = new Set();

try {
  const saved = JSON.parse(localStorage.getItem('dragon-ball-completed') || '[]');
  if (Array.isArray(saved)) for (const id of saved) completedLevels.add(id);
} catch {
  // The menus still work when browser storage is unavailable.
}

function recordCompletedLevel() {
  if (!selectedLevel) return;
  completedLevels.add(selectedLevel.id);
  try {
    localStorage.setItem('dragon-ball-completed', JSON.stringify([...completedLevels]));
  } catch {
    // Completion remains visible in the current level.
  }
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
        if (completedLevels.has(level.id)) entry.textContent += ' · Concluída';
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
