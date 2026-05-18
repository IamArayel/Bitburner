/**
 * darknet-seed.js — Script ultra-léger de propagation darknet
 *
 * Conçu pour tourner sur des serveurs avec peu de RAM (comme darkweb).
 * Son seul rôle : s'authentifier + déployer le crawler complet.
 * Le crawler complet (darknet-crawler.js) gère l'exploitation.
 *
 * Lancer manuellement sur darkweb :
 *   connect darkweb
 *   run darknet-seed.js
 *   home
 */

const SEED    = "darknet-seed.js";
const CRAWLER = "darknet-crawler.js";
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
  if (d.modelId === "ZeroLogon") return "";
  return null;
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
