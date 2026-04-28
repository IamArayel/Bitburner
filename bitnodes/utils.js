/** Fonctions utilitaires partagées entre tous les scripts bitnode */

/** @param {NS} ns @returns {string[]} */
export function getAllServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    for (const n of ns.scan(queue.shift())) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return [...seen];
}

/** @param {NS} ns @param {string} host @returns {boolean} */
export function tryRoot(ns, host) {
  if (ns.hasRootAccess(host)) return true;
  if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host);
  if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host);
  if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host);
  if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host);
  if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host);
  try { ns.nuke(host); return true; } catch { return false; }
}

/** @param {NS} ns */
export function rootAllServers(ns) {
  for (const s of getAllServers(ns)) tryRoot(ns, s);
}

/** @param {NS} ns @returns {string} */
export function getBestTarget(ns) {
  const hackLvl = ns.getPlayer().skills.hacking;
  return getAllServers(ns)
    .filter(s =>
      !s.startsWith("pserv") && s !== "home" &&
      ns.hasRootAccess(s) &&
      ns.getServerMaxMoney(s) > 0 &&
      ns.getServerRequiredHackingLevel(s) <= hackLvl / 2
    )
    .sort((a, b) =>
      ns.getServerMaxMoney(b) / ns.getServerMinSecurityLevel(b) -
      ns.getServerMaxMoney(a) / ns.getServerMinSecurityLevel(a)
    )[0] ?? "n00dles";
}

/** Lance un script une seule fois si non actif.
 * @param {NS} ns @param {string} script @param {...any} args */
export function launchOnce(ns, script, ...args) {
  if (ns.fileExists(script, "home") && !ns.scriptRunning(script, "home")) {
    ns.run(script, 1, ...args);
  }
}

/** Retourne le chemin de connexion vers un serveur.
 * @param {NS} ns @param {string} target @returns {string[]} */
export function getConnectPath(ns, target) {
  const parent = new Map([["home", null]]);
  const queue = ["home"];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === target) {
      const path = [];
      let node = target;
      while (node !== null) { path.unshift(node); node = parent.get(node); }
      return path;
    }
    for (const n of ns.scan(cur)) {
      if (!parent.has(n)) { parent.set(n, cur); queue.push(n); }
    }
  }
  return [];
}

/** Retourne le numéro du Bitnode actuel.
 * @param {NS} ns @returns {number} */
export function getCurrentBN(ns) {
  return ns.getResetInfo().currentNode;
}

/** Lance les scripts de base communs à tous les bitnodes.
 * @param {NS} ns @param {number} xpThreshold */
export function launchCore(ns, xpThreshold = 300) {
  rootAllServers(ns);
  launchOnce(ns, "deploy-hgw-all.js");
  launchOnce(ns, "upgrade-servers.js");
  const hack = ns.getPlayer().skills.hacking;
  if (hack < xpThreshold && !ns.scriptRunning("xp-manager.js", "home")) {
    ns.run("xp-manager.js");
  }
}
