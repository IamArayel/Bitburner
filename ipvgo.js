// Précalcul de la décroissance d'influence : 0.65^d pour d=0..24
const DECAY = Array.from({ length: 25 }, (_, i) => Math.pow(0.65, i));

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
  ns.ui.openTail();

  let myPassed = false;
  let turn = 0;
  const boardHistory = new Set();

  while (true) {
    const state = ns.go.getGameState();
    if (state.currentPlayer === 'None') break;

    const board = ns.go.getBoardState();
    boardHistory.add(board.join(''));
    const sz = board.length;
    if (verbose) printBoard(ns, board, sz, true);

    let result = null;

    if (cheat && ns.go.cheatSuccessChance() >= 0.55) {
      try { result = await doCheat(ns, board, sz, boardHistory); } catch (_) { result = null; }
    }

    if (!result) {
      const best    = findBestMove(board, sz, boardHistory);
      const ranked  = getAllRankedMoves(board, sz, boardHistory);
      const candidates = best
        ? [best, ...ranked.filter(m => !(m.x === best.x && m.y === best.y))]
        : ranked;

      let moved = false;
      for (const m of candidates.slice(0, 10)) {
        try {
          result = await ns.go.makeMove(m.x, m.y);
          boardHistory.add(ns.go.getBoardState().join(''));
          ns.print(`T${++turn} ${toGoCoord(m.x, m.y)} [${m.reason}] score=${m.score}`);
          myPassed = false;
          moved = true;
          break;
        } catch (_) {
          boardHistory.add(simulateMove(board, sz, m.x, m.y, 'X').join(''));
        }
      }
      if (!moved) {
        result = await ns.go.passTurn();
        ns.print(`T${++turn} PASS`);
        if (myPassed) break;
        myPassed = true;
      }
    }

    if (result?.type === 'gameOver') break;

    const oppResult = await ns.go.opponentNextTurn(false);
    if (!oppResult || oppResult.type === 'gameOver') break;
    boardHistory.add(ns.go.getBoardState().join(''));
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

  const moves = getAllRankedMoves(board, size, new Set());
  if (moves.length === 0) {
    ns.tprint('>> PASSER LE TOUR');
  } else {
    const top = moves.slice(0, 5);
    ns.tprint('>> TOP COUPS :');
    for (const m of top) ns.tprint(`   ${toGoCoord(m.x, m.y)} score=${m.score} [${m.reason}]`);
    ns.tprint(`>> JOUER : ${toGoCoord(top[0].x, top[0].y)} — ${top[0].reason}`);
  }
}

// ===== PRIMITIVES =====

function getNeighbors(x, y, size) {
  const n = [];
  if (x > 0)      n.push([x - 1, y]);
  if (x < size-1) n.push([x + 1, y]);
  if (y > 0)      n.push([x, y - 1]);
  if (y < size-1) n.push([x, y + 1]);
  return n;
}

// '#' compte comme liberté dans getGroup pour éviter de fausses captures en simulation
function getGroup(board, size, sx, sy) {
  const player = board[sx][sy];
  if (player !== 'X' && player !== 'O') return null;
  const stones = [], liberties = new Set(), visited = new Set();
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const k = x * size + y;
    if (visited.has(k)) continue;
    visited.add(k);
    if (board[x][y] !== player) continue;
    stones.push([x, y]);
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      const c = board[nx][ny];
      if (c === '.' || c === '#') liberties.add(nx * size + ny);
      else if (c === player) queue.push([nx, ny]);
    }
  }
  return { player, stones, liberties };
}

function getGroupMut(b, size, sx, sy) {
  const player = b[sx][sy];
  const stones = [], liberties = new Set(), visited = new Set();
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const k = x * size + y;
    if (visited.has(k)) continue;
    visited.add(k);
    if (b[x][y] !== player) continue;
    stones.push([x, y]);
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      const c = b[nx][ny];
      if (c === '.' || c === '#') liberties.add(nx * size + ny);
      else if (c === player) queue.push([nx, ny]);
    }
  }
  return { player, stones, liberties };
}

function simulateMove(board, size, x, y, player) {
  const b = board.map(col => col.split(''));
  b[x][y] = player;
  const opp = player === 'X' ? 'O' : 'X';
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (b[nx][ny] === opp) {
      const g = getGroupMut(b, size, nx, ny);
      if (g.liberties.size === 0) for (const [sx, sy] of g.stones) b[sx][sy] = '.';
    }
  }
  return b.map(col => col.join(''));
}

// Le jeu n'accepte '#' que comme liberté pour les groupes existants, pas pour le check suicide
function isValid(board, size, x, y, player) {
  if (board[x][y] !== '.') return false;
  const opp = player === 'X' ? 'O' : 'X';
  const sk = x * size + y;
  for (const [nx, ny] of getNeighbors(x, y, size)) {
    const c = board[nx][ny];
    if (c === '.') return true;
    if (c === '#') continue;
    if (c === player) {
      const g = getGroup(board, size, nx, ny);
      const dots = [...g.liberties].filter(k => board[Math.floor(k/size)][k%size] === '.');
      if (dots.length > 1) return true;
      if (dots.length === 1 && dots[0] !== sk) return true;
    }
    if (c === opp) {
      const g = getGroup(board, size, nx, ny);
      const dots = [...g.liberties].filter(k => board[Math.floor(k/size)][k%size] === '.');
      if (dots.length === 1 && dots[0] === sk) return true;
    }
  }
  return false;
}

// Libertés '.' uniquement (pour l'atari et le self-atari)
function dotLibCount(board, size, g) {
  let n = 0;
  for (const lk of g.liberties) if (board[Math.floor(lk/size)][lk%size] === '.') n++;
  return n;
}

// Retourne captureKeys et escapeKeys (index '.' unique de groupes en atari)
function getAtariInfo(board, size, player) {
  const opp = player === 'X' ? 'O' : 'X';
  const captureKeys = new Set(), escapeKeys = new Set(), seen = new Set();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const c = board[x][y];
      if (c !== 'X' && c !== 'O') continue;
      const k = x * size + y;
      if (seen.has(k)) continue;
      const g = getGroup(board, size, x, y);
      for (const [sx, sy] of g.stones) seen.add(sx * size + sy);
      const dots = [...g.liberties].filter(lk => board[Math.floor(lk/size)][lk%size] === '.');
      if (dots.length !== 1) continue;
      if (c === opp) captureKeys.add(dots[0]);
      else           escapeKeys.add(dots[0]);
    }
  }
  return { captureKeys, escapeKeys };
}

function computeInfluence(board, size) {
  const inf = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const c = board[x][y];
      if (c !== 'X' && c !== 'O') continue;
      const v = c === 'X' ? 1 : -1;
      for (let dx = 0; dx < size; dx++) {
        const ddx = Math.abs(x - dx);
        for (let dy = 0; dy < size; dy++) {
          inf[dx][dy] += v * DECAY[ddx + Math.abs(y - dy)];
        }
      }
    }
  }
  return inf;
}

function computeTerritory(board, size) {
  const owner = Array.from({ length: size }, () => new Array(size).fill(null));
  const visited = new Set();
  for (let sx = 0; sx < size; sx++) {
    for (let sy = 0; sy < size; sy++) {
      const k0 = sx * size + sy;
      if (board[sx][sy] !== '.' || visited.has(k0)) continue;
      const region = [], borders = new Set(), queue = [[sx, sy]];
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

function netScore(board, size, terr) {
  let s = 0;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      const c = board[x][y];
      if      (c === 'X')          s++;
      else if (c === 'O')          s--;
      else if (terr[x][y] === 'X') s++;
      else if (terr[x][y] === 'O') s--;
    }
  return s;
}

function isTrueEye(board, size, x, y, player) {
  if (board[x][y] !== '.') return false;
  const ortho = getNeighbors(x, y, size);
  if (!ortho.every(([nx, ny]) => board[nx][ny] === player || board[nx][ny] === '#')) return false;
  if (!ortho.some(([nx, ny]) => board[nx][ny] === player)) return false;
  const diags = [];
  if (x > 0 && y > 0)           diags.push(board[x-1][y-1]);
  if (x > 0 && y < size-1)      diags.push(board[x-1][y+1]);
  if (x < size-1 && y > 0)      diags.push(board[x+1][y-1]);
  if (x < size-1 && y < size-1) diags.push(board[x+1][y+1]);
  const bad = diags.filter(c => c !== player && c !== '#').length;
  return bad <= (ortho.length < 4 ? 0 : 1);
}

function countEyes(board, size, stones, player) {
  const eyeSet = new Set();
  for (const [x, y] of stones)
    for (const [nx, ny] of getNeighbors(x, y, size))
      if (isTrueEye(board, size, nx, ny, player)) eyeSet.add(nx * size + ny);
  return eyeSet.size;
}

// Évaluation enrichie : territoire + influence + sécurité des groupes
function evaluate(board, size) {
  const terr = computeTerritory(board, size);
  const inf = computeInfluence(board, size);
  let score = netScore(board, size, terr);
  // Territoire contesté : bonus d'influence partielle
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      if (board[x][y] === '.' && terr[x][y] === null)
        score += Math.tanh(inf[x][y] * 0.6) * 0.35;
  const seen = new Set();
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const c = board[x][y];
      if (c !== 'X' && c !== 'O') continue;
      const k = x * size + y;
      if (seen.has(k)) continue;
      const g = getGroup(board, size, x, y);
      for (const [sx, sy] of g.stones) seen.add(sx * size + sy);
      const dl = dotLibCount(board, size, g);
      // Un groupe ancré à '#' est SÛUR (la liberté permanente empêche la capture)
      const hasHash = [...g.liberties].some(lk => board[Math.floor(lk/size)][lk%size] === '#');
      const eyes = countEyes(board, size, g.stones, c);
      let safety;
      if      (eyes >= 2 || hasHash) safety =  g.stones.length * 2;  // groupe vivant/ancré
      else if (dl <= 1)              safety = -g.stones.length * 3;  // en atari
      else if (dl === 2)             safety = -g.stones.length * 0.5;
      else if (eyes === 1)           safety =  g.stones.length * 0.5;
      else                           safety = 0;
      if (c === 'X') score += safety;
      else           score -= safety;
    }
  }
  return score;
}

// ===== ALPHA-BETA NEGAMAX =====

function findBestMove(board, size, boardHistory) {
  const depth = size <= 5 ? 8 : size <= 7 ? 6 : size <= 9 ? 5 : 4;
  const branch = 15;

  const { captureKeys, escapeKeys } = getAtariInfo(board, size, 'X');
  const moves = genMovesAB(board, size, 'X', captureKeys, escapeKeys, branch);
  if (moves.length === 0) return null;

  let bestMove = null, bestVal = -Infinity;
  for (const m of moves) {
    const after = simulateMove(board, size, m.x, m.y, 'X');
    const key = after.join('');
    if (boardHistory.has(key)) continue;
    const ng = getGroup(after, size, m.x, m.y);
    if (ng && dotLibCount(after, size, ng) <= 1 && !captureKeys.has(m.x * size + m.y)) continue;
    boardHistory.add(key);
    const val = -negamax(after, size, depth - 1, -Infinity, Infinity, 'O', boardHistory);
    boardHistory.delete(key);
    if (val > bestVal) { bestVal = val; bestMove = { x: m.x, y: m.y, score: val, reason: m.reason }; }
  }
  return bestMove;
}

// Negamax avec élagage alpha-beta et quiescence sur les captures
function negamax(board, size, depth, alpha, beta, player, boardHistory) {
  const opp = player === 'X' ? 'O' : 'X';
  const { captureKeys, escapeKeys } = getAtariInfo(board, size, player);

  if (depth <= 0) {
    const standPat = evaluate(board, size) * (player === 'X' ? 1 : -1);
    // Quiescence : étendre sur les captures immédiates (max 2 niveaux)
    if (depth > -2 && captureKeys.size > 0) {
      let qVal = standPat;
      if (qVal >= beta) return qVal;
      let qAlpha = Math.max(alpha, qVal);
      for (const k of captureKeys) {
        const qx = Math.floor(k / size), qy = k % size;
        const after = simulateMove(board, size, qx, qy, player);
        const key = after.join('');
        if (boardHistory.has(key)) continue;
        const qng = getGroup(after, size, qx, qy);
        if (qng && dotLibCount(after, size, qng) <= 1) continue;
        boardHistory.add(key);
        const cv = -negamax(after, size, depth - 1, -beta, -qAlpha, opp, boardHistory);
        boardHistory.delete(key);
        if (cv > qVal) qVal = cv;
        if (qVal > qAlpha) qAlpha = qVal;
        if (qAlpha >= beta) return qVal;
      }
      return qVal;
    }
    return standPat;
  }

  const branch = size <= 9 ? 12 : 10;
  const moves = genMovesAB(board, size, player, captureKeys, escapeKeys, branch);

  let value = -Infinity;
  for (const m of moves) {
    const after = simulateMove(board, size, m.x, m.y, player);
    const key = after.join('');
    if (boardHistory.has(key)) continue;
    const ng = getGroup(after, size, m.x, m.y);
    if (ng && dotLibCount(after, size, ng) <= 1 && !captureKeys.has(m.x * size + m.y)) continue;
    boardHistory.add(key);
    const childVal = -negamax(after, size, depth - 1, -beta, -alpha, opp, boardHistory);
    boardHistory.delete(key);
    if (childVal > value) value = childVal;
    if (value > alpha)   alpha = value;
    if (alpha >= beta)   break; // élagage
  }

  // Aucun coup légal → passer, évaluer directement
  if (value === -Infinity) {
    const s = evaluate(board, size);
    return player === 'X' ? s : -s;
  }
  return value;
}

// Génère et trie les coups pour alpha-beta
// Priorités : capture(1000) > escape(800) > pre-atari(600) > connect-groups(400) >
//             anchor-hash(300) > corner-area(200) > opp-threat(150) > connect(100) > edge(40)
function genMovesAB(board, size, player, captureKeys, escapeKeys, branch) {
  const opp = player === 'X' ? 'O' : 'X';
  const scored = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x][y] !== '.') continue;
      if (isTrueEye(board, size, x, y, player)) continue;
      const k = x * size + y;
      const isCap = captureKeys.has(k), isEsc = escapeKeys.has(k);
      // Validité rapide
      if (!isCap && !isEsc) {
        let ok = false;
        for (const [nx, ny] of getNeighbors(x, y, size)) {
          const c = board[nx][ny];
          if (c === '.' || c === player) { ok = true; break; }
        }
        if (!ok) continue;
      }
      let pri = 0, reason = 'move';
      if (isCap)      { pri = 1000; reason = 'capture'; }
      else if (isEsc) { pri = 800;  reason = 'escape'; }
      else {
        let ownGroupCount = 0;
        for (const [nx, ny] of getNeighbors(x, y, size)) {
          const c = board[nx][ny];
          if (c === opp) {
            const g = getGroup(board, size, nx, ny);
            const dl = dotLibCount(board, size, g);
            if (dl === 2) { pri = Math.max(pri, 600); reason = 'pre-atari'; }
            else if (dl <= 4) { pri = Math.max(pri, 150); }
          } else if (c === player) {
            ownGroupCount++;
            pri = Math.max(pri, 100);
          } else if (c === '#') {
            // Ancrer son groupe à un nœud permanent = très précieux
            pri = Math.max(pri, 300); if (reason === 'move') reason = 'anchor';
          }
        }
        // Connecter plusieurs de nos groupes = encore mieux
        if (ownGroupCount >= 2) { pri = Math.max(pri, 400); reason = 'connect'; }
        // Valeur stratégique de la case (coins > bords > centre)
        const cx = Math.min(x, size - 1 - x), cy = Math.min(y, size - 1 - y);
        // En Go: point hoshi (2,2) = meilleur opening; coins = mauvais
        if      (cx === 2 && cy === 2)                pri = Math.max(pri, 220); // ★ hoshi
        else if (cx === 3 && cy === 3 && size >= 9)   pri = Math.max(pri, 210); // ★ 4-4
        else if ((cx === 2 && cy >= 2) || (cx >= 2 && cy === 2)) pri = Math.max(pri, 160); // 3ème ligne
        else if ((cx === 3 || cy === 3) && size >= 9) pri = Math.max(pri, 130); // 4ème ligne
        else if (cx === 1 && cy === 1)                pri = Math.max(pri,  90); // diag coin
        else if (cx === 1 || cy === 1)                pri = Math.max(pri,  70); // 2ème ligne
        else if (cx === 0 && cy === 0)                pri = Math.max(pri,  40); // coin exact (faible)
        else if (cx === 0 || cy === 0)                pri = Math.max(pri,  50); // bord
        else                                           pri = Math.max(pri,  80); // intérieur
      }
      scored.push({ x, y, pri, reason });
    }
  }
  scored.sort((a, b) => b.pri - a.pri);
  return scored.slice(0, branch);
}

// ===== HEURISTIQUE (mode conseil + fallback si MCTS vide) =====

function getAllRankedMoves(board, size, boardHistory) {
  const player = 'X', opp = 'O';
  const baseTerr = computeTerritory(board, size);
  const baseScore = netScore(board, size, baseTerr);
  const { captureKeys, escapeKeys } = getAtariInfo(board, size, player);

  const moves = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!isValid(board, size, x, y, player)) continue;
      if (isTrueEye(board, size, x, y, player)) continue;
      const k = x * size + y;
      const after = simulateMove(board, size, x, y, player);
      if (boardHistory && boardHistory.has(after.join(''))) continue;

      // Self-atari → ignoré (sauf si c'est une capture)
      const ng = getGroup(after, size, x, y);
      if (ng && dotLibCount(after, size, ng) <= 1 && !captureKeys.has(k)) continue;

      const delta = netScore(after, size, computeTerritory(after, size)) - baseScore;
      let score = delta * 100;
      let reason = delta > 0 ? `+${delta}` : 'expansion';

      if (captureKeys.has(k))  { score += 5000; reason = 'capture'; }
      if (escapeKeys.has(k))   { score += 2000; if (reason !== 'capture') reason = 'escape'; }

      // Menacer un groupe adverse
      for (const [nx, ny] of getNeighbors(x, y, size)) {
        if (after[nx]?.[ny] === opp) {
          const eg = getGroup(after, size, nx, ny);
          if (eg && dotLibCount(after, size, eg) === 1) {
            score += 400;
            if (reason === 'expansion') reason = 'atari';
          }
        }
      }

      // Pénalité : jouer dans notre propre territoire déjà sécurisé
      if (baseTerr[x][y] === player && !captureKeys.has(k) && !escapeKeys.has(k)) score -= 600;

      // Bonus : créer un œil
      if (ng) {
        const eyes = countEyes(after, size, ng.stones, player);
        if (eyes >= 2) score += 500;
        else if (eyes === 1) score += 150;
      }

      moves.push({ x, y, score, reason });
    }
  }

  moves.sort((a, b) => b.score - a.score);
  return moves;
}

// ===== TRICHE =====

async function doCheat(ns, board, size, boardHistory) {
  const moves = getAllRankedMoves(board, size, boardHistory);
  if (moves.length < 1) return null;
  const m1 = moves[0];
  const after = simulateMove(board, size, m1.x, m1.y, 'X');
  const moves2 = getAllRankedMoves(after, size, boardHistory).filter(m => !(m.x === m1.x && m.y === m1.y));
  if (moves2.length > 0) {
    const m2 = moves2[0];
    ns.print(`TRICHE: ${toGoCoord(m1.x, m1.y)} + ${toGoCoord(m2.x, m2.y)}`);
    return await ns.go.cheatPlayTwoMoves(m1.x, m1.y, m2.x, m2.y);
  }
  return null;
}

// ===== AFFICHAGE =====

function toGoCoord(x, y) { return 'ABCDEFGHJKLMN'[x] + (y + 1); }

function printBoard(ns, board, size, toTail = false) {
  const log = toTail ? s => ns.print(s) : s => ns.tprint(s);
  const cols = 'ABCDEFGHJKLMN';
  let header = '   ';
  for (let x = 0; x < size; x++) header += cols[x] + ' ';
  log(header);
  for (let y = size - 1; y >= 0; y--) {
    const rowLabel = String(y + 1).padStart(2, ' ');
    let row = rowLabel + ' ';
    for (let x = 0; x < size; x++) {
      const c = board[x][y];
      row += (c === 'X' ? '●' : c === 'O' ? '○' : c === '#' ? '▪' : '·') + ' ';
    }
    log(row);
  }
}
