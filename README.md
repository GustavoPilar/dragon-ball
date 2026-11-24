# Dragon Ball

Protótipo web de treino com Goku em forma base. Sirva a pasta localmente com `python3 -m http.server 3000` e abra `http://localhost:3000`.

| Ação | Tela | Teclado |
| --- | --- | --- |
| Andar | Arraste o joystick para os lados | ← ou → |
| Olhar para cima ou para baixo | Arraste o joystick na vertical, no chão | ↑ ou ↓ |
| Pular | Toque em Pular | Espaço |
| Voar ou pousar | Toque duas vezes rapidamente em Pular | Espaço duas vezes rapidamente |
| Mover-se em voo | Arraste o joystick em qualquer direção | Setas |
| Socar | Toque em Soco | Z |
| Chutar | Toque em Chute | X |
| Carregar ki | Segure Ki até 100% | Segure C |
| Disparar uma esfera de ki | Toque em Poder | V |
| Disparar Kamehameha | Toque em Kame | B |
| Virar Super Saiyajin | Toque em SSJ com o ki cheio | T |

O jogo fica disponível com a tela na horizontal. O botão de tela cheia solicita o bloqueio da orientação quando o navegador oferece suporte.

Os Cell Jr. aparecem alternadamente pelos dois lados, em intervalos cada vez menores, e perseguem Goku no chão e no ar. Socos e chutes acertam todos os inimigos próximos à frente. Cada inimigo derrotado com soco ou chute rende 20 pontos de ki, até o limite de 100. As barras vermelhas acompanham os inimigos. Se Goku for derrotado, recarregue a página para recomeçar.

Cada esfera custa 10 pontos de ki. Goku precisa de pelo menos 10% de ki e mais de 25 de vida para voar. O voo não consome ki. Aos 60 pontos de vida, o uniforme se rasga. Aos 25, ele fica sem camisa.

O Kamehameha custa 40 pontos de ki. A arena congela brevemente enquanto Goku concentra energia nas mãos. Depois, o feixe dura dois segundos e causa 75 de dano uma vez por inimigo na trajetória.

Uma Semente dos Deuses cai em um ponto aleatório da arena. Aproxime-se e toque em **Pegar** para guardá-la no inventário. Toque na semente na barra inferior para comê-la e restaurar toda a vida e o ki.

Em Super Saiyajin, Goku se move 25% mais rápido e causa 50% a mais de dano. A forma consome 8 pontos de ki por segundo e termina quando o ki chega a zero. Segurar Ki carrega a barra na forma base.
