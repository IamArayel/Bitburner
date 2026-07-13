/**
 * utils/darknet-crawler.js — Explorateur BFS du Dark Net (BN5)
 *
 * Prérequis : DarkscapeNavigator.exe
 *   → terminal : `buy DarkscapeNavigator.exe` (TOR requis)
 *   → ou acheter à Chongqing
 *
 * Lancer depuis home : run utils/darknet-crawler.js
 * Traverse le réseau darknet en BFS via connectToSession — pas de spread.
 *
 * Fichiers :
 *   darknet-passwords.json  — dictionnaire par modelId (éditable)
 *   darknet-sessions.json   — cache auto { serveur → mot de passe }
 */

const DICT_FILE    = "darknet-passwords.json";
const SESSION_FILE = "darknet-sessions.json";

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.dnet) {
    ns.tprint("ERREUR : ns.dnet indisponible. Achetez DarkscapeNavigator.exe d'abord.");
    return;
  }

  ns.disableLog("ALL");
  ns.ui.openTail();
  if (!ns.read(SESSION_FILE)) ns.write(SESSION_FILE, "{}", "w");
  if (!ns.read(DICT_FILE))    ns.write(DICT_FILE,    "{}", "w");

  while (true) {
    try { await tick(ns); }
    catch (e) { ns.print(`[ERR global] ${e}`); }
    await ns.sleep(5_000);
  }
}

// ─── Boucle principale — BFS ─────────────────────────────────────────────

/** @param {NS} ns */
async function tick(ns) {
  const dict    = loadDict(ns);
  const visited = new Set();
  const queue   = [...ns.dnet.probe()];

  ns.print(`[BFS] ${queue.length} nœud(s) initial(aux) depuis ${ns.getHostname()}`);

  while (queue.length > 0) {
    const target = queue.shift();
    if (visited.has(target)) continue;
    visited.add(target);

    try {
      const details = ns.dnet.getServerDetails(target);
      ns.print(`[NODE] ${target}  online=${details.isOnline}  session=${details.hasSession}  modèle=${details.modelId}`);

      if (!details.isOnline) continue;

      const pw = await gainAccess(ns, target, details, dict);
      if (pw === null) continue;

      await ns.dnet.connectToSession(target, pw);
      await exploitNode(ns, target);

      const neighbors = ns.dnet.probe();
      ns.print(`[NAV] ${target} → ${neighbors.length} voisin(s)`);
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push(n);
      }
    } catch (e) {
      ns.print(`[ERR] ${target}: ${e}`);
    }
  }
}

// ─── Accès à un serveur ───────────────────────────────────────────────────

/**
 * Tente d'obtenir une session sur target. Retourne le mot de passe ou null.
 * @param {NS} ns @param {string} target @param {object} details @param {Record<string,string[]>} dict
 * @returns {Promise<string|null>}
 */
async function gainAccess(ns, target, details, dict) {
  // Session déjà active : retrouver le mot de passe sans ré-authentifier
  if (details.hasSession) {
    const sessions = loadSessions(ns);
    if (sessions[target] !== undefined) return sessions[target];
    // Fallback : premier candidat du dictionnaire pour ce modèle
    const candidates = [...(dict[details.modelId] ?? []), ...(dict["_global"] ?? [])];
    if (candidates.length) { saveSession(ns, target, candidates[0]); return candidates[0]; }
    return "";
  }

  // 1. Cache de session
  const sessions = loadSessions(ns);
  if (sessions[target] !== undefined) {
    const r = await ns.dnet.authenticate(target, sessions[target]);
    if (r.success) {
      ns.print(`[AUTH✓] ${target} (session cache)`);
      return sessions[target];
    }
    ns.print(`[STALE] ${target} — cache expiré`);
    delete sessions[target];
    ns.write(SESSION_FILE, JSON.stringify(sessions, null, 2), "w");
  }

  // 2. Dictionnaire par modèle
  const dictPw = await tryDictionary(ns, target, details.modelId, dict);
  if (dictPw !== null) {
    ns.print(`[AUTH✓] ${target} — dict "${details.modelId}" : "${dictPw}"`);
    saveSession(ns, target, dictPw);
    return dictPw;
  }

  // 3. Solveur algorithmique
  const pw = await solve(ns, target, details);
  if (pw !== null) {
    ns.print(`[AUTH✓] ${target} — résolu : "${pw}"`);
    saveSession(ns, target, pw);
    return pw;
  }

  ns.print(`[FAIL] ${target} — modèle "${details.modelId}" non résolu`);
  return null;
}

// ─── Résolution de mot de passe ───────────────────────────────────────────

/** Extrait le texte du message d'une réponse authenticate. */
const rmsg = (r) => r?.message ?? r?.feedback ?? r?.log ?? "";

/**
 * @param {NS} ns
 * @param {string} target
 * @param {object} details
 * @returns {Promise<string|null>}
 */
async function solve(ns, target, details) {
  const hint     = details.passwordHint     ?? "";
  const hintData = details.passwordHintData ?? details.passwordHint ?? "";
  ns.print(`[SOLVE] ${target}  modèle="${details.modelId}"  hint="${hint}"`);

  switch (details.modelId) {

    // ── Mot de passe vide ─────────────────────────────────────────────────
    case "ZeroLogon": {
      const r = await ns.dnet.authenticate(target, "");
      return r.success ? "" : null;
    }

    // ── Mot de passe par défaut (4 mots) ──────────────────────────────────
    case "FreshInstall_1.0": {
      for (const pw of ["admin", "password", "0000", "12345"]) {
        const r = await ns.dnet.authenticate(target, pw);
        if (r.success) return pw;
      }
      return null;
    }

    // ── Echo de vulnérabilité : le mot de passe est dans le message d'erreur
    case "DeskMemo_3.1": {
      const r = await ns.dnet.authenticate(target, "probe");
      if (r.success) return "probe";
      const msg = rmsg(r);
      ns.print(`[ECHO] Réponse : ${msg}`);
      // Cherche un pattern "passcode/password: X" ou "is X"
      const m = msg.match(/(?:passcode|password|pass|code)[:\s]+["']?(\S+?)["']?(?:\s|$)/i)
             ?? msg.match(/\bis\s+["']?(\S+?)["']?\s*$/i);
      if (m) {
        const pw = m[1].replace(/[^a-zA-Z0-9]/g, "");
        const r2 = await ns.dnet.authenticate(target, pw);
        if (r2.success) return pw;
      }
      // Essayer aussi heartbleed
      try {
        const hb = await ns.dnet.heartbleed(target, { peek: true });
        const logs = (hb?.logs ?? []).join("\n");
        const m2 = logs.match(/(?:passcode|password|pass|code)[:\s]+["']?(\S+?)["']?(?:\s|$)/i);
        if (m2) {
          const pw = m2[1].replace(/[^a-zA-Z0-9]/g, "");
          const r3 = await ns.dnet.authenticate(target, pw);
          if (r3.success) return pw;
        }
      } catch {}
      return null;
    }

    // ── Captcha : chiffres noyés dans des caractères parasites ────────────
    case "CloudBlare(tm)": {
      const pw = hintData.split("").filter(c => /\d/.test(c)).join("");
      ns.print(`[CAPTCHA] Chiffres extraits : "${pw}"`);
      const r = await ns.dnet.authenticate(target, pw);
      return r.success ? pw : null;
    }

    // ── Noms de chien (4 possibilités) ────────────────────────────────────
    case "Laika4": {
      for (const pw of ["fido", "spot", "rover", "max"]) {
        const r = await ns.dnet.authenticate(target, pw);
        if (r.success) return pw;
      }
      return null;
    }

    // ── Chiffre romain dans le hint ───────────────────────────────────────
    case "BellaCuore": {
      const num = decodeRoman(hintData.trim());
      if (num === null) { ns.print(`[ROMAN] Échec décodage : "${hintData}"`); return null; }
      ns.print(`[ROMAN] ${hintData} = ${num}`);
      const r = await ns.dnet.authenticate(target, String(num));
      return r.success ? String(num) : null;
    }

    // ── Recherche binaire Higher/Lower ────────────────────────────────────
    case "AccountsManager_4.2": {
      let lo = 0, hi = 10_000_000_000;
      for (let iter = 0; iter < 64 && lo <= hi; iter++) {
        const mid = Math.floor((lo + hi) / 2);
        const r = await ns.dnet.authenticate(target, String(mid));
        if (r.success) return String(mid);
        const msg = rmsg(r).toLowerCase();
        if (msg.includes("higher") || msg.includes("plus")) lo = mid + 1;
        else hi = mid - 1;
      }
      return null;
    }

    // ── Dictionnaire commun (~100 mots) ───────────────────────────────────
    case "TopPass": {
      const dict = ["123456","password","12345678","qwerty","123456789","12345","1234","111111",
        "1234567","dragon","123123","baseball","abc123","football","monkey","letmein","696969",
        "shadow","master","666666","qwertyuiop","123321","mustang","1234567890","michael","654321",
        "superman","1qaz2wsx","7777777","121212","0","qazwsx","123qwe","trustno1","jordan",
        "jennifer","zxcvbnm","asdfgh","hunter","buster","soccer","harley","batman","andrew",
        "tigger","sunshine","iloveyou","2000","charlie","robert","thomas","hockey","ranger",
        "daniel","starwars","112233","george","computer","michelle","jessica","pepper","1111",
        "zxcvbn","555555","11111111","131313","freedom","777777","pass","maggie","159753",
        "aaaaaa","ginger","princess","joshua","cheese","amanda","summer","love","ashley","6969",
        "nicole","chelsea","biteme","matthew","access","yankees","987654321","dallas","austin",
        "thunder","taylor","matrix"];
      for (const pw of dict) {
        const r = await ns.dnet.authenticate(target, pw);
        if (r.success) return pw;
      }
      return null;
    }

    // ── Pays de l'UE (27) ─────────────────────────────────────────────────
    case "EuroZone Free": {
      const countries = ["Austria","Belgium","Bulgaria","Croatia","Republic of Cyprus",
        "Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece","Hungary",
        "Ireland","Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Poland",
        "Portugal","Romania","Slovakia","Slovenia","Spain","Sweden"];
      for (const pw of countries) {
        const r = await ns.dnet.authenticate(target, pw);
        if (r.success) return pw;
      }
      return null;
    }

    // ── Binaire 8 bits séparés par espaces ────────────────────────────────
    case "110100100": {
      const pw = hintData.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join("");
      ns.print(`[BINARY] Décodé : "${pw}"`);
      const r = await ns.dnet.authenticate(target, pw);
      return r.success ? pw : null;
    }

    // ── Conversion base N → base 10 ───────────────────────────────────────
    case "OctantVoxel": {
      const [baseStr, encoded] = hintData.split(",");
      const base = parseFloat(baseStr);
      let pw;
      if (Number.isInteger(base) && base >= 2 && base <= 36) {
        pw = String(parseInt(encoded, base));
      } else {
        pw = String(convertFromFractionalBase(encoded, base));
      }
      ns.print(`[BASE${base}] ${encoded} → "${pw}"`);
      const r = await ns.dnet.authenticate(target, pw);
      return r.success ? pw : null;
    }

    // ── Évaluation d'expression arithmétique ──────────────────────────────
    case "MathML": {
      const result = evalArithmetic(hintData);
      if (result === null) { ns.print(`[MATH] Impossible d'évaluer : "${hintData}"`); return null; }
      ns.print(`[MATH] ${hintData} = ${result}`);
      const r = await ns.dnet.authenticate(target, String(result));
      return r.success ? String(result) : null;
    }

    // ── Déchiffrement XOR ─────────────────────────────────────────────────
    case "OrdoXenos": {
      const [encrypted, mask] = hintData.split(";");
      if (!encrypted || !mask) { ns.print(`[XOR] Format invalide : "${hintData}"`); return null; }
      const pw = encrypted.split("").map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ parseInt(mask[i] ?? "0", 2))
      ).join("");
      ns.print(`[XOR] Déchiffré : "${pw}"`);
      const r = await ns.dnet.authenticate(target, pw);
      return r.success ? pw : null;
    }

    // ── Plus grand facteur premier ────────────────────────────────────────
    case "PrimeTime 2": {
      const num = parseInt(hintData.replace(/[^0-9]/g, ""));
      if (!num) return null;
      const pw = String(largestPrimeFactor(num));
      ns.print(`[PRIME] Facteur(${num}) = ${pw}`);
      const r = await ns.dnet.authenticate(target, pw);
      return r.success ? pw : null;
    }

    // ── Packet sniffer : mot de passe dans les logs heartbleed ────────────
    case "OpenWebAccessPoint": {
      // Attendre que les logs se remplissent (le serveur génère du trafic)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const hb = await ns.dnet.heartbleed(target, { peek: true });
          const logs = (hb?.logs ?? []).join("\n");
          ns.print(`[PACKET] Logs (tentative ${attempt + 1}):\n${logs.slice(-400)}`);
          const m = logs.match(/passcode[:\s]+(\S+)/i)
                 ?? logs.match(/password[:\s]+(\S+)/i)
                 ?? logs.match(/Logging in with passcode[:\s:]+(\S+)/i);
          if (m) {
            const pw = m[1].replace(/[^\w]/g, "");
            const r = await ns.dnet.authenticate(target, pw);
            if (r.success) return pw;
          }
        } catch {}
        await ns.sleep(3_000);
      }
      return null;
    }

    // ── Buffer overflow : dépasser la longueur du buffer ──────────────────
    case "Pr0verFl0": {
      const pwLen = details.passwordLength ?? 8;
      // La chaîne doit être > longueur du password pour écraser le buffer
      for (let len = pwLen + 1; len <= pwLen + 12; len++) {
        const candidate = "A".repeat(len);
        const r = await ns.dnet.authenticate(target, candidate);
        if (r.success) return candidate;
      }
      return null;
    }

    // ── Feedback piment 🌶️ : un piment par position correcte ──────────────
    case "RateMyPix.Auth": {
      const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const peppers = (msg) => (msg.match(/🌶️/g) ?? []).length;

      // Sonder la longueur
      let length = details.passwordLength ?? 0;
      if (!length) {
        for (let l = 1; l <= 12; l++) {
          const r = await ns.dnet.authenticate(target, CHARS[0].repeat(l));
          if (r.success) return CHARS[0].repeat(l);
          if (peppers(rmsg(r)) <= l) { length = l; break; }
        }
        if (!length) length = 6;
      }

      const pw = new Array(length).fill(CHARS[0]);
      let locked = 0;
      for (let pos = 0; pos < length; pos++) {
        for (const c of CHARS) {
          pw[pos] = c;
          const r = await ns.dnet.authenticate(target, pw.join(""));
          if (r.success) return pw.join("");
          if (peppers(rmsg(r)) > locked) { locked++; break; }
        }
      }
      return null;
    }

    // ── Timing attack : index du premier caractère incorrect ──────────────
    case "2G_cellular": {
      const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const mismatchIdx = (msg) => { const m = msg.match(/\b(\d+)\b/); return m ? +m[1] : -1; };
      const length = details.passwordLength ?? 8;
      const pw = [];

      for (let pos = 0; pos < length; pos++) {
        let found = false;
        for (const c of CHARS) {
          const guess = pw.join("") + c + CHARS[0].repeat(length - pos - 1);
          const r = await ns.dnet.authenticate(target, guess);
          if (r.success) return guess;
          if (mismatchIdx(rmsg(r)) > pos) { pw.push(c); found = true; break; }
        }
        if (!found) break;
      }
      if (pw.length === length) {
        const r = await ns.dnet.authenticate(target, pw.join(""));
        if (r.success) return pw.join("");
      }
      return null;
    }

    // ── Mastermind : correct (bonne pos) + close (mauvais pos) ────────────
    case "DeepGreen": {
      const CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
      const parseFb = (msg) => ({
        correct: +(msg.match(/(\d+)\s*correct/i)?.[1] ?? 0),
        close:   +(msg.match(/(\d+)\s*close/i)?.[1]   ?? 0),
      });

      const length = details.passwordLength ?? 6;
      const pw = Array.from({ length }, () => CHARS[0]);

      // Déterminer chaque caractère par élimination (simpliste mais fonctionnel)
      for (let pos = 0; pos < length; pos++) {
        for (const c of CHARS) {
          pw[pos] = c;
          const r = await ns.dnet.authenticate(target, pw.join(""));
          if (r.success) return pw.join("");
          const { correct } = parseFb(rmsg(r));
          if (correct > pos) break; // ce caractère à cette position est correct
        }
      }
      return null;
    }

    // ── Hint trié + déviation RMS ─────────────────────────────────────────
    case "PHP 5.4": {
      const sorted = hintData.trim().split("").sort().join("");
      const isNum  = /^\d+$/.test(sorted);
      ns.print(`[PHP5.4] Caractères triés : "${sorted}" (numérique: ${isNum})`);

      if (isNum && sorted.length <= 8) {
        // Permutations de chiffres (limité à 8 pour éviter explosion)
        const getRms = (msg) => { const m = msg.match(/([\d.]+)/); return m ? +m[1] : Infinity; };
        let bestPw = null, bestRms = Infinity;

        for (const perm of permutations([...sorted])) {
          const candidate = perm.join("");
          const r = await ns.dnet.authenticate(target, candidate);
          if (r.success) return candidate;
          const rms = getRms(rmsg(r));
          if (rms < bestRms) { bestRms = rms; bestPw = candidate; }
          if (rms === 0) return candidate;
        }
        ns.print(`[PHP5.4] Meilleure tentative : "${bestPw}" (RMS ${bestRms})`);
      }
      return null;
    }

    // ── Divisibilité : le mot de passe divise lui-même evenly ─────────────
    case "Factori-Os": {
      try {
        const hb = await ns.dnet.heartbleed(target, { peek: true });
        const logs = (hb?.logs ?? []).join("\n");
        ns.print(`[FACTORI] Logs : ${logs.slice(-300)}`);
        const matches = [...new Set(logs.match(/\b(\d{5,})\b/g) ?? [])];
        for (const candidate of matches) {
          const r = await ns.dnet.authenticate(target, candidate);
          if (r.success) return candidate;
        }
      } catch {}
      return null;
    }

    // ── Triple modulo — CRT (complexe, stub) ─────────────────────────────
    case "BigMo%od": {
      ns.print(`[BIGMO] Hint : "${hint}" — solveur CRT pas encore implémenté.`);
      try {
        const hb = await ns.dnet.heartbleed(target, { peek: true });
        if (hb?.logs?.length) hb.logs.slice(-5).forEach(l => ns.print(`  ${l}`));
      } catch {}
      return null;
    }

    // ── Maximum global : recherche ternaire sur score d'altitude ──────────
    case "KingOfTheHill": {
      const getAlt  = (msg) => { const m = msg.match(/([\d.]+)/); return m ? +m[1] : 0; };
      const length  = details.passwordLength ?? 6;
      let lo = 0, hi = 10 ** length - 1;

      for (let i = 0; i < 120 && hi - lo > 1; i++) {
        const m1 = Math.floor(lo + (hi - lo) / 3);
        const m2 = Math.floor(hi - (hi - lo) / 3);
        const r1 = await ns.dnet.authenticate(target, String(m1));
        if (r1.success) return String(m1);
        const r2 = await ns.dnet.authenticate(target, String(m2));
        if (r2.success) return String(m2);
        if (getAlt(rmsg(r1)) >= getAlt(rmsg(r2))) hi = m2; else lo = m1;
      }
      return null;
    }

    // ── Feedback oui/non par position ─────────────────────────────────────
    case "NIL": {
      const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const isYes = (fb, pos) => (fb.split(",")[pos] ?? "").trim() === "yes";
      const length = details.passwordLength ?? 6;
      const pw = new Array(length).fill(CHARS[0]);

      for (let pos = 0; pos < length; pos++) {
        for (const c of CHARS) {
          pw[pos] = c;
          const r = await ns.dnet.authenticate(target, pw.join(""));
          if (r.success) return pw.join("");
          if (isYes(rmsg(r), pos)) break;
        }
      }
      return null;
    }

    // ── Labyrinthe — nécessite navigation interactive ─────────────────────
    case "(The Labyrinth)": {
      ns.print(`[LABYRINTHE] Ce modèle nécessite une navigation interactive de labyrinthe.`);
      ns.print(`    Utilisez dnet.labreport() / dnet.labradar() pour naviguer manuellement.`);
      return null;
    }

    // ─── Modèle inconnu ──────────────────────────────────────────────────
    default: {
      ns.print(`[?] Modèle non supporté : "${details.modelId}"`);
      ns.print(`    Hint : ${hint}`);
      ns.print(`    HintData : ${hintData}`);
      ns.print(`    → Signalez ce modelId pour qu'un case soit ajouté dans solve()`);
      try {
        const hb = await ns.dnet.heartbleed(target, { peek: true });
        if (hb?.logs?.length) {
          ns.print(`[HEARTBLEED] Logs de ${target} :`);
          hb.logs.slice(-8).forEach(l => ns.print(`  ${l}`));
        }
      } catch {}
      return null;
    }
  }
}

// ─── Dictionnaire ────────────────────────────────────────────────────────

/**
 * Essaie les mots de passe du dictionnaire pour le modèle donné, puis les mots de passe globaux.
 * @param {NS} ns
 * @param {string} target
 * @param {string} modelId
 * @param {Record<string, string[]>} dict
 * @returns {Promise<string|null>}
 */
async function tryDictionary(ns, target, modelId, dict) {
  const candidates = [...new Set([
    ...(dict[modelId]  ?? []),
    ...(dict["_global"] ?? []),
  ])];
  if (candidates.length === 0) return null;
  ns.print(`[DICT] ${target}  modèle="${modelId}"  ${candidates.length} candidat(s)`);
  for (const pw of candidates) {
    const r = await ns.dnet.authenticate(target, pw);
    if (r.success) return pw;
  }
  return null;
}

// ─── Fonctions utilitaires ────────────────────────────────────────────────

/** Décode un chiffre romain vers un entier. */
function decodeRoman(s) {
  const V = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  let total = 0, prev = 0;
  for (const c of [...s.toUpperCase()].reverse()) {
    const v = V[c] ?? 0;
    total += v < prev ? -v : v;
    prev = v;
  }
  return total || null;
}

/** Retourne le plus grand facteur premier de n. */
function largestPrimeFactor(n) {
  let largest = 1;
  for (let d = 2; d * d <= n; d++) {
    while (n % d === 0) { largest = d; n /= d; }
  }
  return n > 1 ? n : largest;
}

/** Évalue une expression arithmétique simple (+ - * / parenthèses). */
function evalArithmetic(expr) {
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
  try { return Function(`"use strict";return(${expr})`)(); } catch { return null; }
}

/** Convertit un entier encodé en base fractionnaire (ex: 5.5) vers base 10. */
function convertFromFractionalBase(encoded, base) {
  const digits = encoded.split("").map(Number);
  return digits.reduce((acc, d, i) => acc + d * (base ** (digits.length - 1 - i)), 0);
}

/** Génère toutes les permutations d'un tableau (max longueur 8 recommandé). */
function* permutations(arr) {
  if (arr.length <= 1) { yield arr; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) yield [arr[i], ...p];
  }
}

// ─── Exploitation d'un nœud (après connectToSession) ─────────────────────

/** @param {NS} ns @param {string} target */
async function exploitNode(ns, target) {
  try {
    const limit   = ns.dnet.getStasisLinkLimit();
    const stasied = ns.dnet.getStasisLinkedServers();
    if (!stasied.includes(target) && stasied.length < limit) {
      ns.dnet.setStasisLink();
      ns.print(`[STASIS] ${target} (${stasied.length + 1}/${limit})`);
    }
  } catch {}

  try {
    for (let i = 0; i < 50; i++) {
      const freed = await ns.dnet.memoryReallocation();
      if (!freed) break;
    }
  } catch {}

  try { await ns.dnet.phishingAttack(); } catch {}
}

// ─── Persistance ─────────────────────────────────────────────────────────

/** @param {NS} ns @returns {Record<string, string[]>} */
function loadDict(ns) {
  try { return JSON.parse(ns.read(DICT_FILE) || "{}"); }
  catch { return {}; }
}

/** @param {NS} ns @returns {Record<string, string>} */
function loadSessions(ns) {
  try { return JSON.parse(ns.read(SESSION_FILE) || "{}"); }
  catch { return {}; }
}

/** @param {NS} ns @param {string} host @param {string} password */
function saveSession(ns, host, password) {
  const db = loadSessions(ns);
  db[host] = password;
  ns.write(SESSION_FILE, JSON.stringify(db, null, 2), "w");
  try { ns.scp(SESSION_FILE, "home"); } catch {}
}

// ─── Autocomplétion terminal ──────────────────────────────────────────────

/** @param {AutocompleteData} data */
export function autocomplete(data) {
  return ["--tail"];
}
