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

// Calcule le territoire par flood fill.
// Retourne owner[x][y] = 'X' | 'O' | null (neutre)
function computeTerritory(board, size) {
  const owner = Array.from({ length: size }, () => new Array(size).fill(null));
  const visited = new Set();
  for (let sx = 0; sx < size; sx++) {
    for (let sy = 0; sy < size; sy++) {
      const k0 = sx * size + sy;
      if (board[sx][sy] !== '.' || visited.has(k0)) continue;
      const region = [];
      const borders = new Set();
      const queue = [[sx, sy]];
      while (queue.length) {
        const [x, y] = queue.shift();
        const k = x * size + y;
        if (visited.has(k)) continue;
        visited.add(k);
        region.push([x, y]);
        for (const [nx, ny] of getNeighbors(x, y, size)) {
          const c = board[nx][ny];
          if (c === '.') queue.push([nx, ny]);
          else if (c === 'X' || c === 'O') borders.add(c);
        }
      }
      const o = borders.size === 1 ? [...borders][0] : null;
      for (const [x, y] of region) owner[x][y] = o;
    }
  }
  return owner;
}

// Score net du plateau (pierres + territoire) du point de vue de Black
function netScore(board, size, terr) {
  let s = 0;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      const c = board[x][y];
      if (c === 'X') s++;
      else if (c === 'O') s--;
      else if (terr[x][y] === 'X') s++;
      else if (terr[x][y] === 'O') s--;
    }
  return s;
}

// Vrai oeil : toutes les cases orthogonales adjacentes appartiennent au joueur,
// et au plus 1 diagonale est adverse (0 en coin/bord)
function isTrueEye(board, size, x, y, player) {
  if (board[x][y] !== '.') return false;
  const ortho = getNeighbors(x, y, size);
  if (!ortho.every(([nx, ny]) => board[nx][ny] === player)) return false;
  const diags = [];
  if (x > 0 && y > 0)           diags.push(board[x-1][y-1]);
  if (x > 0 && y < size-1)      diags.push(board[x-1][y+1]);
  if (x < size-1 && y > 0)      diags.push(board[x+1][y-1]);
  if (x < size-1 && y < size-1) diags.push(board[x+1][y+1]);
  const bad = diags.filter(c => c !== player).length;
  // Coin (2 ortho voisins) → 0 diag adverse ; bord (3) → ≤1 ; centre (4) → ≤1
  return bad <= (ortho.length < 4 ? 0 : 1);
}

// Compte les yeux approximatifs d'un groupe (libertés ≠ vraies libertés)
function countEyes(board, size, stones, player) {
  let eyes = 0;
  for (const [x, y] of stones) {
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      if (isTrueEye(board, size, nx, ny, player)) eyes++;
    }
  }
  return eyes;
}

function getAllRankedMoves(board, size) {
  const player = 'X', opp = 'O';
  const baseTerr = computeTerritory(board, size);
  const baseScore = netScore(board, size, baseTerr);

  // Pré-scan : libertés uniques des groupes en atari
  const captureKeys = new Set(); // liberté d'un groupe adverse en atari → à jouer
  const escapeKeys  = new Set(); // liberté d'un groupe allié en atari → à jouer
  const seenGroups  = new Set();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const c = board[x][y];
      if (c !== 'X' && c !== 'O') continue;
      const gk = x * size + y;
      if (seenGroups.has(gk)) continue;
      const g = getGroup(board, size, x, y);
      for (const s of g.stones) seenGroups.add(s[0] * size + s[1]);
      if (g.liberties.size !== 1) continue;
      const [lk] = g.liberties;
      if (c === 'O') captureKeys.add(lk);
      else            escapeKeys.add(lk);
    }
  }

  const moves = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!isValid(board, size, x, y, player)) continue;
      // Ne pas remplir ses propres vrais yeux
      if (isTrueEye(board, size, x, y, player)) continue;

      const k = x * size + y;
      const after = simulateMove(board, size, x, y, player);
      const afterTerr = computeTerritory(after, size);
      const delta = netScore(after, size, afterTerr) - baseScore;

      let score = delta * 100;
      let reason = delta > 0 ? 'territoire +' + delta : 'expansion';

      // Capture urgente
      if (captureKeys.has(k)) {
        score += 5000;
        reason = 'capture';
      }

      // Fuite atari
      if (escapeKeys.has(k)) {
        score += 2000;
        if (reason === 'expansion') reason = 'escape atari';
      }

      // Self-atari sans capture → très mauvais
      const ng = getGroup(after, size, x, y);
      if (ng && ng.liberties.size === 1 && !captureKeys.has(k)) {
        score -= 1200;
        reason = 'self-atari!';
      }

      // Mettre l'adversaire en atari après le coup
      for (const [nx, ny] of getNeighbors(x, y, size)) {
        if (after[nx] && after[nx][ny] === opp) {
          const eg = getGroup(after, size, nx, ny);
          if (eg && eg.liberties.size === 1) {
            score += 400;
            if (reason === 'expansion') reason = 'menace atari';
          }
        }
      }

      // Pénalité si on joue dans notre propre territoire déjà acquis
      if (baseTerr[x][y] === player && !captureKeys.has(k) && !escapeKeys.has(k)) {
        score -= 600;
      }

      // Bonus : créer ou consolider un oeil dans ses groupes
      if (ng) {
        const eyesAfter = countEyes(after, size, ng.stones, player);
        if (eyesAfter >= 2) score += 300;
        else if (eyesAfter === 1) score += 100;
      }

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
  return 'ABCDEFGHJKLMN'[x] + (y + 1);
}

function printBoard(ns, board, size) {
  const cols = 'ABCDEFGHJKLMN';
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
