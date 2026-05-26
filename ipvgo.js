/** @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([
    ['auto', false],
    ['new', false],
    ['cheat', false],
    ['opponent', 'Slum Snakes'],
    ['size', 7],
    ['verbose', false],
    ['help', false],
  ]);

  if (flags.help) {
    ns.tprint('run ipvgo.js [--auto] [--new [--opponent "Slum Snakes"] [--size 7]] [--cheat] [--verbose]');
    ns.tprint('Sans flag    : conseil sur la partie en cours');
    ns.tprint('--auto       : joue automatiquement la partie en cours');
    ns.tprint('--auto --new : démarre une nouvelle partie puis joue');
    ns.tprint('Adversaires : Illuminati, Daedalus, ECorp, MegaCorp, NiteSec, The Black Hand,');
    ns.tprint('  BitRunners, Slum Snakes, Tetrads, The Syndicate, ???, No AI');
    return;
  }

  if (flags.auto) {
    await autoPlay(ns, flags['new'], flags.opponent, flags.size, flags.cheat, flags.verbose);
  } else {
    advise(ns);
  }
}

// ===== BOUCLE DE JEU =====

async function autoPlay(ns, startNew, opponent, size, cheat, verbose) {
  if (startNew) {
    ns.go.resetBoardState(opponent, size);
    ns.tprint(`IPvGO nouvelle partie vs ${opponent} (${size}x${size})${cheat ? ' [TRICHE]' : ''}`);
  } else {
    const s = ns.go.getGameState();
    ns.tprint(`IPvGO reprise partie en cours${cheat ? ' [TRICHE]' : ''} (score B:${s.blackScore} W:${s.whiteScore})`);
  }

  let myPassed = false;
  let turn = 0;

  while (true) {
    const state = ns.go.getGameState();
    if (state.currentPlayer === 'None') break;

    const board = ns.go.getBoardState();
    const sz = board.length;
    if (verbose) printBoard(ns, board, sz);

    let result = null;

    if (cheat && ns.go.cheatSuccessChance() >= 0.55) {
      result = await doCheat(ns, board, sz);
    }

    if (!result) {
      const move = findBestMove(board, sz);
      if (!move) {
        result = await ns.go.passTurn();
        ns.tprint(`T${++turn} PASS (B:${state.blackScore} W:${state.whiteScore})`);
        if (myPassed) break;
        myPassed = true;
      } else {
        result = await ns.go.makeMove(move.x, move.y);
        ns.tprint(`T${++turn} ${toGoCoord(move.x, move.y)} [${move.reason}] score=${move.score}`);
        myPassed = false;
      }
    }

    if (result?.type === 'gameOver') break;

    const oppResult = await ns.go.opponentNextTurn(false);
    if (!oppResult || oppResult.type === 'gameOver') break;
    if (oppResult.type === 'pass' && myPassed) break;
    if (oppResult.type !== 'pass') myPassed = false;
  }

  const final = ns.go.getGameState();
  const won = final.blackScore > final.whiteScore;
  ns.tprint(`=== FIN : B=${final.blackScore} W=${final.whiteScore} ${won ? '✓ VICTOIRE' : '✗ DÉFAITE'} ===`);
}

function advise(ns) {
  const board = ns.go.getBoardState();
  const state = ns.go.getGameState();
  const size = board.length;

  printBoard(ns, board, size);
  ns.tprint(`Score B:${state.blackScore} W:${state.whiteScore} | Tour: ${state.currentPlayer}`);

  const moves = getAllRankedMoves(board, size);
  if (moves.length === 0) {
    ns.tprint('>> PASSER LE TOUR');
  } else {
    const top = moves.slice(0, 5);
    ns.tprint('>> TOP COUPS :');
    for (const m of top) {
      ns.tprint(`   ${toGoCoord(m.x, m.y)} score=${m.score} [${m.reason}]`);
    }
    ns.tprint(`>> JOUER : ${toGoCoord(top[0].x, top[0].y)} — ${top[0].reason}`);
  }
}

// ===== NOYAU IA =====

function getNeighbors(x, y, size) {
  const n = [];
  if (x > 0) n.push([x - 1, y]);
  if (x < size - 1) n.push([x + 1, y]);
  if (y > 0) n.push([x, y - 1]);
  if (y < size - 1) n.push([x, y + 1]);
  return n;
}

// Trouve le groupe connecté depuis (sx,sy) dans un plateau string[]
function getGroup(board, size, sx, sy) {
  const player = board[sx][sy];
  if (player !== 'X' && player !== 'O') return null;
  const stones = [];
  const liberties = new Set();
  const visited = new Set();
  const queue = [[sx, sy]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const k = x * size + y;
    if (visited.has(k)) continue;
    visited.add(k);
    if (board[x][y] !== player) continue;
    stones.push([x, y]);
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      const c = board[nx][ny];
      if (c === '.') liberties.add(nx * size + ny);
      else if (c === player) queue.push([nx, ny]);
    }
  }
  return { player, stones, liberties };
}

// Simule un coup et retourne le nouveau plateau string[]
function simulateMove(board, size, x, y, player) {
  const b = board.map(col => col.split(''));
  b[x][y] = player;
  const opp = player === 'X' ? 'O' : 'X';
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (b[nx][ny] === opp) {
      const g = getGroupMut(b, size, nx, ny);
      if (g.liberties.size === 0) {
        for (const [sx, sy] of g.stones) b[sx][sy] = '.';
      }
    }
  }
  return b.map(col => col.join(''));
}

// getGroup pour plateau char[][] (après simulateMove interne)
function getGroupMut(b, size, sx, sy) {
  const player = b[sx][sy];
  const stones = [];
  const liberties = new Set();
  const visited = new Set();
  const queue = [[sx, sy]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const k = x * size + y;
    if (visited.has(k)) continue;
    visited.add(k);
    if (b[x][y] !== player) continue;
    stones.push([x, y]);
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      const c = b[nx][ny];
      if (c === '.') liberties.add(nx * size + ny);
      else if (c === player) queue.push([nx, ny]);
    }
  }
  return { player, stones, liberties };
}

// Vérifie si le coup est légal (pas suicide sans capture)
function isValid(board, size, x, y, player) {
  if (board[x][y] !== '.') return false;
  const opp = player === 'X' ? 'O' : 'X';
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    const c = board[nx][ny];
    if (c === '.') return true;
    if (c === player) {
      const g = getGroup(board, size, nx, ny);
      if (g.liberties.size > 1) return true;
    }
    if (c === opp) {
      const g = getGroup(board, size, nx, ny);
      if (g.liberties.size === 1) return true; // capture → légal
    }
  }
  return false;
}

function scoreMove(board, size, x, y) {
  const player = 'X';
  const opp = 'O';
  const neighbors = getNeighbors(x, y, size);
  let score = 0;
  let reason = 'expand';

  // Priorité 1 : capturer des pierres adverses
  let captured = 0;
  for (const [nx, ny] of neighbors) {
    if (board[nx][ny] === opp) {
      const g = getGroup(board, size, nx, ny);
      if (g.liberties.size === 1) captured += g.stones.length;
    }
  }
  if (captured > 0) {
    score += 5000 + captured * 200;
    reason = `capture ${captured}`;
  }

  // Priorité 2 : sauver ses propres groupes en atari
  let endangered = 0;
  for (const [nx, ny] of neighbors) {
    if (board[nx][ny] === player) {
      const g = getGroup(board, size, nx, ny);
      if (g.liberties.size === 1) endangered += g.stones.length;
    }
  }
  if (endangered > 0) {
    score += 2000 + endangered * 100;
    if (reason === 'expand') reason = `save ${endangered}`;
  }

  // Priorité 3 : mettre l'adversaire en atari
  let threatened = 0;
  for (const [nx, ny] of neighbors) {
    if (board[nx][ny] === opp) {
      const g = getGroup(board, size, nx, ny);
      if (g.liberties.size === 2) threatened += g.stones.length;
    }
  }
  if (threatened > 0) {
    score += 400 + threatened * 30;
    if (reason === 'expand') reason = 'atari threat';
  }

  // Analyse après le coup
  const after = simulateMove(board, size, x, y, player);
  const ng = getGroup(after, size, x, y);
  const libs = ng ? ng.liberties.size : 0;

  // Pénalité self-atari (sauf capture)
  if (captured === 0 && libs <= 1) {
    score -= 1500;
    reason = 'self-atari!';
  } else {
    score += libs * 20;
  }

  // Adjacence aux propres pierres (expansion)
  for (const [nx, ny] of neighbors) {
    if (board[nx][ny] === player) score += 40;
    if (board[nx][ny] === opp) score -= 15;
  }

  // Contrôle du centre
  const center = (size - 1) / 2;
  const dist = Math.abs(x - center) + Math.abs(y - center);
  score += (size - dist) * 8;

  // Légère pénalité pour les coins (peu de libertés)
  if ((x === 0 || x === size - 1) && (y === 0 || y === size - 1)) score -= 60;

  // Bonus si on empiète sur territoire adverse
  score += countNearbyTerritory(board, size, x, y, opp) * 25;

  return { score, reason };
}

// Compte les voisins d'un certain camp dans un rayon de 2
function countNearbyTerritory(board, size, cx, cy, target) {
  let count = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (board[nx][ny] === target) count++;
    }
  }
  return count;
}

function getAllRankedMoves(board, size) {
  const moves = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!isValid(board, size, x, y, 'X')) continue;
      const { score, reason } = scoreMove(board, size, x, y);
      moves.push({ x, y, score, reason });
    }
  }
  moves.sort((a, b) => b.score - a.score);
  return moves;
}

function findBestMove(board, size) {
  const moves = getAllRankedMoves(board, size);
  return moves.length > 0 ? moves[0] : null;
}

// ===== TRICHE =====

async function doCheat(ns, board, size) {
  const moves = getAllRankedMoves(board, size);
  if (moves.length < 1) return null;

  const m1 = moves[0];
  // Recalcule le plateau après le premier coup pour le deuxième
  const after = simulateMove(board, size, m1.x, m1.y, 'X');
  const moves2 = getAllRankedMoves(after, size).filter(m => !(m.x === m1.x && m.y === m1.y));

  if (moves2.length > 0) {
    const m2 = moves2[0];
    ns.tprint(`TRICHE: ${toGoCoord(m1.x, m1.y)} + ${toGoCoord(m2.x, m2.y)}`);
    return await ns.go.cheatPlayTwoMoves(m1.x, m1.y, m2.x, m2.y);
  }
  return null;
}

// ===== AFFICHAGE =====

function toGoCoord(x, y) {
  return 'ABCDEFGHIJKLMNOPQRS'[x] + (y + 1);
}

function printBoard(ns, board, size) {
  const cols = 'ABCDEFGHIJKLMNOPQRS';
  let header = '   ';
  for (let x = 0; x < size; x++) header += cols[x] + ' ';
  ns.tprint(header);
  for (let y = size - 1; y >= 0; y--) {
    const rowLabel = String(y + 1).padStart(2, ' ');
    let row = rowLabel + ' ';
    for (let x = 0; x < size; x++) {
      const c = board[x][y];
      row += (c === 'X' ? '●' : c === 'O' ? '○' : c === '#' ? '▪' : '·') + ' ';
    }
    ns.tprint(row);
  }
}
