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
  if (!ns.serverExists(host)) return false;
  if (ns.hasRootAccess(host)) return true;
  if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host);
  if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host);
  if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host);
  if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host);
  if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host);
  return ns.nuke(host);
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

const FINAL_PROGRAMS = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];

/** Affiche les conditions nécessaires pour finaliser le bitnode (backdoor de la cible finale).
 * @param {NS} ns @param {string} target */
export function printFinalConditions(ns, target) {
  const hack = ns.getPlayer().skills.hacking;
  const hackOk = hack >= 3000;
  const owned = FINAL_PROGRAMS.filter(p => ns.fileExists(p, "home"));
  const progOk = owned.length === FINAL_PROGRAMS.length;
  const exists = ns.serverExists(target);
  const rootOk = exists && ns.hasRootAccess(target);
  let backdoorOk = false;
  if (exists) { try { backdoorOk = ns.getServer(target).backdoorInstalled; } catch {} }

  ns.print("");
  ns.print("--- Conditions de fin ---");
  ns.print(`${hackOk ? "✅" : "❌"} Hack ≥ 3000 (${hack})`);
  ns.print(`${progOk ? "✅" : "❌"} 5 programmes (${owned.length}/5)`);
  ns.print(`${rootOk ? "✅" : "❌"} Root sur ${target}`);
  ns.print(`${backdoorOk ? "✅" : "❌"} Backdoor installé`);
}

/** Retourne le numéro du Bitnode actuel.
 * @param {NS} ns @returns {number} */
export function getCurrentBN(ns) {
  return ns.getResetInfo().currentNode;
}

/** Lance les scripts de base communs à tous les bitnodes.
 * @param {NS} ns @param {number} xpThreshold @param {boolean} buyServers achat de pserv (inutile si l'argent du hacking ne rapporte rien, ex. BN8) */
export function launchCore(ns, xpThreshold = 300, buyServers = false) {
  rootAllServers(ns);
  if (buyServers) launchOnce(ns, "upgrade-servers.js");
  const hack = ns.getPlayer().skills.hacking;
  if (hack < xpThreshold) {
    // xp-manager.js se termine dès qu'il a lancé les workers (il ne boucle pas) :
    // scriptRunning("xp-manager.js") est donc quasi toujours faux. Il faut vérifier
    // que les workers eux-mêmes tournent encore, sinon on les tue/relance en boucle
    // à chaque appel de launchCore (toutes les 30s), coupant hack/grow/weaken en cours.
    // Sous le seuil, hgw ne doit jamais tourner : xp-worker garde toute la RAM.
    if (!isXpWorkerDeployed(ns)) ns.run("xp-manager.js");
  } else {
    launchOnce(ns, "deploy-hgw-all.js");
  }
}

/** @param {NS} ns @returns {boolean} */
function isXpWorkerDeployed(ns) {
  return getAllServers(ns).some(h => ns.hasRootAccess(h) && ns.scriptRunning("xp-worker.js", h));
}
