/**
 * utils/darknet-seed.js — Script ultra-léger de propagation darknet
 *
 * Conçu pour tourner sur des serveurs avec peu de RAM (comme darkweb).
 * Son seul rôle : s'authentifier + déployer le crawler complet.
 * Le crawler complet (utils/darknet-crawler.js) gère l'exploitation.
 *
 * Lancer manuellement sur darkweb :
 *   connect darkweb
 *   run utils/darknet-seed.js
 *   home
 */

const SEED    = "utils/darknet-seed.js";
const CRAWLER = "utils/darknet-crawler.js";
const PW_FILE = "darknet-passwords.json";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    for (const target of ns.dnet.probe()) {
      try { await handle(ns, target); }
      catch (e) { ns.print(`[ERR] ${target}: ${e}`); }
    }
    await ns.sleep(5_000);
  }
}

/** @param {NS} ns @param {string} target */
async function handle(ns, target) {
  const d = ns.dnet.getServerDetails(target);
  if (!d.isOnline || !d.isConnectedToCurrentServer) return;

  if (!d.hasSession) {
    const pw = getPassword(ns, target, d);
    if (pw === null) {
      ns.print(`[?] ${target} modèle="${d.modelId}" hint="${d.passwordHint}" — non supporté`);
      return;
    }
    const r = await ns.dnet.authenticate(target, pw);
    if (!r.success) {
      ns.print(`[FAIL] ${target} — mauvais mot de passe "${pw}"`);
      return;
    }
    ns.print(`[AUTH✓] ${target}`);
    savePassword(ns, target, pw);
  }

  deploy(ns, target);
}

/** Retourne le mot de passe à essayer, ou null si on ne sait pas.
 * @param {NS} ns @param {string} target @param {object} d */
function getPassword(ns, target, d) {
  const db = loadPasswords(ns);
  if (db[target] !== undefined) return db[target];

  const hint = d.passwordHintData ?? d.passwordHint ?? "";

  switch (d.modelId) {
    case "ZeroLogon":   return "";
    case "CloudBlare(tm)": return hint.split("").filter(c => /\d/.test(c)).join("");
    case "BellaCuore":  return String(decodeRoman(hint.trim()) ?? "");
    case "110100100":   return hint.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join("");
    case "MathML":      return String(evalArithmetic(hint) ?? "");
    case "OrdoXenos": {
      const [enc, mask] = hint.split(";");
      if (!enc || !mask) return null;
      return enc.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ parseInt(mask[i] ?? "0", 2))).join("");
    }
    case "OctantVoxel": {
      const [baseStr, encoded] = hint.split(",");
      const base = parseInt(baseStr);
      return base >= 2 && base <= 36 ? String(parseInt(encoded, base)) : null;
    }
    default: return null;
  }
}

function decodeRoman(s) {
  const V = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
  let t = 0, p = 0;
  for (const c of [...s.toUpperCase()].reverse()) { const v = V[c]??0; t += v<p?-v:v; p=v; }
  return t || null;
}

function evalArithmetic(expr) {
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
  try { return Function(`"use strict";return(${expr})`)(); } catch { return null; }
}

/** Copie les scripts et lance le crawler (ou le seed si pas assez de RAM).
 * @param {NS} ns @param {string} target */
function deploy(ns, target) {
  ns.scp(CRAWLER, target);
  ns.scp(SEED, target);
  if (ns.fileExists(PW_FILE)) ns.scp(PW_FILE, target);

  // Essayer d'abord le crawler complet, sinon replier sur le seed
  let pid = ns.exec(CRAWLER, target, { preventDuplicates: true });
  if (pid === 0) {
    pid = ns.exec(SEED, target, { preventDuplicates: true });
    ns.print(`[SEED] → ${target} (seed léger, pas assez de RAM pour le crawler)`);
  } else {
    ns.print(`[SPREAD] → ${target} (crawler complet, pid ${pid})`);
  }
}

/** @param {NS} ns @returns {Record<string, string>} */
function loadPasswords(ns) {
  try { return JSON.parse(ns.read(PW_FILE) || "{}"); }
  catch { return {}; }
}

/** @param {NS} ns @param {string} host @param {string} pw */
function savePassword(ns, host, pw) {
  const db = loadPasswords(ns);
  db[host] = pw;
  ns.write(PW_FILE, JSON.stringify(db), "w");
  try { ns.scp(PW_FILE, "home"); } catch {}
}
