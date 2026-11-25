const opponents = (name, ...forms) => ({ name, forms });
const form = (sprite, name, health, style = 'balanced', hero) => ({ sprite, name, health, style, hero });
const power = (sprite, name, round = 0, phase = 0) => ({ sprite, name, round, phase });
const level = (id, title, environment, hero, encounters = [], powers = []) =>
  ({ id, title, environment, hero, encounters, powers, playable: true });

const heroNames = {
  goku: 'Goku', piccoloCape: 'Piccolo', piccolo: 'Piccolo', piccoloNail: 'Piccolo', krillin: 'Kuririn',
  kidGohan: 'Gohan', teenGohan: 'Gohan', adultGohan: 'Gohan', ultimateGohan: 'Gohan',
  trunks: 'Trunks', vegeta: 'Vegeta', majinVegeta: 'Majin Vegeta', gotenks: 'Gotenks',
  vegito: 'Vegetto', tien: 'Tenshinhan', yamcha: 'Yamcha', goten: 'Goten', videl: 'Videl',
};
const powerUsers = {
  kaioken: 'goku', gokuSsj: 'goku', gokuSsj2: 'goku', gokuSsj3: 'goku',
  trunksSsj: 'trunks', vegetaSsj: 'vegeta', teenSsj: 'teenGohan', teenSsj2: 'teenGohan',
  adultSsj2: 'adultGohan', gotenksSsj: 'gotenks', gotenksSsj3: 'gotenks', superVegito: 'vegito',
  piccoloKami: 'piccolo', gotenSsj: 'goten',
  krillinPotential: 'krillin', kidPotential: 'kidGohan',
  vegetaGrade2: 'vegeta', trunksGrade2: 'trunks', trunksGrade3: 'trunks',
  teenFull: 'teenGohan', gokuFull: 'goku', vegetaSsj2: 'vegeta',
};

const sagaLevels = [
  {
    id: 'saiyajin', title: 'Saga Saiyajin', levels: [
      level('raditz', 'A chegada de Raditz', 'raditz-field', 'goku', [
        opponents('Raditz', form('raditz', '', 360)),
      ]),
      level('gohan-oozaru', 'Gohan e a lua cheia', 'canyon', 'piccoloCape', [
        opponents('Gohan', form('kidGohan', 'Base', 85, 'swift'), form('gohanApe', 'Oozaru', 165, 'brute')),
      ]),
      level('treinamento', 'O treinamento com o Senhor Kaio', 'kaio', 'goku', [
        opponents('Senhor Kaio', form('kaio', 'Treino', 120, 'swift')),
      ], [power('kaioken', 'Kaioken')]),
      level('saibamans', 'O ataque dos Saibamans', 'canyon', 'yamcha', [
        opponents('Saibaman', form('saibaman', '', 70, 'swift')),
        { ...opponents('Saibaman', form('saibaman', '', 85, 'swift')), hero: 'tien' },
        { ...opponents('Saibaman', form('saibaman', '', 100, 'brute')), hero: 'krillin' },
      ]),
      level('nappa', 'O ataque de Nappa', 'canyon', 'piccoloCape', [
        opponents('Nappa', form('nappa', 'Avanço', 190, 'brute'), form('nappa', 'Força total', 140, 'ranged')),
      ]),
      level('vegeta', 'O duelo contra Vegeta', 'canyon', 'goku', [
        opponents('Vegeta', form('vegeta', 'Saiyajin', 210, 'ranged'), form('greatApe', 'Oozaru', 240, 'brute')),
      ], [power('kaioken', 'Kaioken')]),
    ],
  },
  {
    id: 'freeza', title: 'Saga Freeza', levels: [
      level('namek', 'As Esferas de Namek', 'namek', 'krillin', [],
        [power('krillinPotential', 'Potencial liberado', 1)]),
      level('dodoria-zarbon', 'Os soldados de elite de Freeza', 'namek', 'vegeta', [
        opponents('Dodoria', form('dodoria', '', 150, 'brute')),
        opponents('Zarbon', form('zarbon', 'Forma inicial', 160), form('zarbonMonster', 'Transformado', 180, 'brute')),
      ]),
      level('ginyu', 'As Forças Especiais Ginyu', 'namek', 'kidGohan', [
        opponents('Guldo', form('guldo', '', 100, 'ranged')),
        { ...opponents('Recoome', form('recoome', '', 155, 'brute')), hero: 'goku' },
        { ...opponents('Burter', form('burter', '', 120, 'swift')), hero: 'goku' },
        { ...opponents('Jeice', form('jeice', '', 125, 'ranged')), hero: 'goku' },
        { ...opponents('Capitão Ginyu', form('ginyu', 'Corpo original', 150),
          form('ginyuGoku', 'Corpo de Goku', 125, 'swift', 'kidGohan')), hero: 'goku' },
      ], [power('kidPotential', 'Potencial liberado'), power('kaioken', 'Kaioken', 1)]),
      level('freeza', 'O confronto com Freeza', 'namek', 'goku', [
        opponents('Freeza',
          form('freeza1', 'Primeira forma', 110, 'ranged', 'kidGohan'),
          form('freeza2', 'Segunda forma', 135, 'brute', 'piccoloNail'),
          form('freeza3', 'Terceira forma', 150, 'swift', 'piccoloNail'),
          form('freeza4', 'Forma final', 190, 'swift'),
          form('freeza100', 'Poder máximo', 210, 'ranged')),
      ], [power('gokuSsj', 'Super Saiyajin', 0, 3)]),
    ],
  },
  {
    id: 'androids-cell', title: 'Saga Androids/Cell', levels: [
      level('trunks', 'O aviso de Trunks', 'city', 'trunks', [
        opponents('Mecha Freeza', form('mechaFreeza', '', 220, 'ranged')),
        opponents('Rei Cold', form('kingCold', '', 180, 'brute')),
      ], [power('trunksSsj', 'Super Saiyajin')]),
      level('androids', 'A chegada dos Androids', 'city', 'vegeta', [
        opponents('Android 19', form('android19', '', 135, 'brute')),
        { ...opponents('Android 20', form('android20', '', 165, 'ranged')), hero: 'piccolo' },
        { ...opponents('Android 18', form('android18', '', 180, 'swift')), hero: 'vegeta' },
        { ...opponents('Android 17', form('android17', '', 200, 'swift')), hero: 'piccolo' },
      ], [power('vegetaSsj', 'Super Saiyajin')]),
      level('cell', 'A ascensão de Cell', 'city', 'piccolo', [
        opponents('Cell', form('cell1', 'Imperfeito', 165, 'swift'), form('cell2', 'Semiperfeito', 200, 'brute'),
          form('cell3', 'Perfeito', 245, 'ranged')),
      ], [power('piccoloKami', 'Fusão com Kami', 0, 1)]),
      level('sala-do-tempo', 'A Sala do Tempo', 'time-chamber', 'goku', [
        opponents('Gohan', form('teenGohan', 'Base', 105), form('teenFull', 'Super Saiyajin dominado', 145, 'swift')),
      ], [power('gokuSsj', 'Super Saiyajin'), power('gokuFull', 'Super Saiyajin dominado', 0, 1)]),
      level('trunks-contra-cell', 'O poder de Super Vegeta e Trunks', 'cell-ring', 'vegeta', [
        opponents('Cell', form('cell2', 'Semiperfeito', 190, 'brute')),
        { ...opponents('Cell', form('cell3', 'Perfeito', 255, 'swift')), hero: 'trunks' },
      ], [power('vegetaSsj', 'Super Saiyajin'), power('vegetaGrade2', 'Super Saiyajin grau 2'),
        power('trunksSsj', 'Super Saiyajin', 1), power('trunksGrade2', 'Super Saiyajin grau 2', 1),
        power('trunksGrade3', 'Super Saiyajin grau 3', 1)]),
      level('jogos-de-cell', 'Os Jogos de Cell', 'cell-ring', 'teenGohan', [
        opponents('Cell Jr.', form('cellJr', '', 80, 'swift')),
        opponents('Cell Jr.', form('cellJr', '', 90, 'swift')),
        opponents('Cell', form('cell3', 'Perfeito', 215), form('cellSuper', 'Super Perfeito', 270, 'ranged')),
      ], [power('teenSsj', 'Super Saiyajin'), power('teenFull', 'Super Saiyajin dominado', 1),
        power('teenSsj2', 'Super Saiyajin 2', 2)]),
    ],
  },
  {
    id: 'majin-buu', title: 'Saga Majin Buu', levels: [
      level('torneio', 'O Torneio de Artes Marciais', 'tournament', 'videl', [
        opponents('Spopovich', form('spopovich', '', 155, 'brute')),
        { ...opponents('Trunks', form('trunksKid', 'Base', 95, 'swift'), form('trunksKidSsj', 'Super Saiyajin', 100, 'swift')), hero: 'goten' },
        { ...opponents('Android 18', form('android18', '', 170, 'swift')), hero: 'goten' },
      ], [power('gotenSsj', 'Super Saiyajin', 1)]),
      level('babidi', 'A magia de Babidi', 'canyon', 'vegeta', [
        opponents('Pui Pui', form('pui', '', 125)),
        { ...opponents('Yakon', form('yakon', '', 160, 'brute')), hero: 'goku' },
        { ...opponents('Dabura', form('dabura', '', 220, 'ranged')), hero: 'adultGohan' },
      ], [power('vegetaSsj', 'Super Saiyajin'), power('gokuSsj', 'Super Saiyajin', 1), power('adultSsj2', 'Super Saiyajin 2', 2)]),
      level('majin-vegeta', 'O duelo contra Majin Vegeta', 'canyon', 'goku', [
        opponents('Majin Vegeta', form('majinVegeta', '', 310, 'swift')),
      ], [power('gokuSsj', 'Super Saiyajin'), power('gokuSsj2', 'Super Saiyajin 2')]),
      level('majin-buu', 'O despertar de Majin Buu', 'canyon', 'majinVegeta', [
        opponents('Majin Buu', form('fatBuu', 'Majin Buu', 180, 'brute'), form('evilBuu', 'Buu Maligno', 185, 'swift')),
      ]),
      level('fusao', 'Gotenks e a Sala do Tempo', 'ruins', 'gotenks', [
        opponents('Super Buu', form('superBuu', '', 345, 'brute')),
      ], [power('gotenksSsj', 'Super Saiyajin'), power('gotenksSsj3', 'Super Saiyajin 3')]),
      level('super-buu', 'As absorções de Super Buu', 'ruins', 'ultimateGohan', [
        opponents('Super Buu', form('buutenks', 'Gotenks absorvido', 210, 'swift'),
          form('buucolo', 'Piccolo absorvido', 190, 'ranged'), form('buuhan', 'Gohan absorvido', 255, 'brute')),
        { ...opponents('Super Buu', form('buuBuff', 'Buu musculoso', 260, 'brute')), hero: 'vegito' },
      ], [power('superVegito', 'Super Vegetto', 1)]),
      level('kid-buu', 'A batalha final contra Kid Buu', 'ruins', 'goku', [
        opponents('Kid Buu', form('kidBuu', 'Despertar', 195, 'swift'), form('kidBuu', 'Caos total', 310, 'ranged')),
        { ...opponents('Kid Buu', form('kidBuu', 'Resistência final', 145, 'swift')), hero: 'vegeta' },
      ], [power('gokuSsj', 'Super Saiyajin'), power('gokuSsj2', 'Super Saiyajin 2'), power('gokuSsj3', 'Super Saiyajin 3'),
        power('vegetaSsj', 'Super Saiyajin', 1), power('vegetaSsj2', 'Super Saiyajin 2', 1)]),
    ],
  },
];

const rosterSheets = [
  ['assets/saiyan-grades.png', [
    'vegetaGrade2', 'trunksGrade2', 'trunksGrade3', 'vegetaSsj2', 'gohanApe', 'teenFull', 'gokuFull', 'ultimateGohan',
  ]],
  ['assets/campaign-extra.png', [
    'zarbonMonster', 'kingCold', 'piccoloNail', 'piccoloKami',
    'teenSsj2Orange', 'gotenSsj', 'trunksKidSsj', 'ginyuGoku',
  ]],
  ['assets/heroes-a.png', [
    'piccoloCape', 'piccolo', 'krillin', 'kidGohan', 'teenGohan', 'teenSsj', 'teenSsj2', 'trunks',
    'trunksSsj', 'adultGohan', 'adultSsj2', 'ultimateGohan',
  ]],
  ['assets/heroes-b.png', [
    'vegeta', 'vegetaSsj', 'majinVegeta', 'gokuSsj2', 'gokuSsj3', 'gotenks', 'gotenksSsj', 'gotenksSsj3',
    'vegito', 'superVegito', 'tien', 'yamcha',
  ]],
  ['assets/saiyans-freeza.png', [
    'kaio', 'saibaman', 'nappa', 'vegeta', 'greatApe', 'guldo', 'recoome', 'burter',
    'jeice', 'ginyu', 'dodoria', 'zarbon',
  ]],
  ['assets/freeza-cell.png', [
    'freeza1', 'freeza2', 'freeza3', 'freeza4', 'freeza100', 'mechaFreeza', 'android19', 'android20',
    'android17', 'android18', 'android16', 'cell1',
  ]],
  ['assets/cell-buu.png', [
    'cell2', 'cell3', 'cellSuper', 'cellJr', 'babidi', 'pui', 'yakon', 'dabura',
    'fatBuu', 'evilBuu', 'superBuu', 'kidBuu',
  ]],
  ['assets/buu-forms.png', [
    'buutenks', 'buucolo', 'buuhan', 'buuBuff', 'spopovich', 'yamu', 'shin', 'videl',
    'goten', 'trunksKid', 'satan', 'android18',
  ]],
];

const backdropAtlases = [
  ['assets/locations-a.png', ['kaio', 'canyon', 'city']],
  ['assets/locations-b.png', ['cell-ring', 'tournament', 'ruins']],
];
