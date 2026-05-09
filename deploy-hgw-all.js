// file: deploy-hgw-all.js
// À lancer depuis home UNE FOIS que hgw.js est sur home
/** @param {NS} ns **/
export async function main(ns) {
  const script = "hgw.js";

  if (!ns.fileExists(script, "home")) {
    ns.tprint(`Erreur : le script ${script} doit exister sur home.`);
    return;
  }

  ns.disableLog("scan");
  ns.disableLog("scp");
  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");

  const visited = new Set(["home"]);
  const queue = ["home"];

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = ns.scan(current);

    for (const host of neighbors) {
      if (visited.has(host)) continue;
      visited.add(host);
      queue.push(host);

      // on tente de rooter
      await tryRoot(ns, host);

      // on déploie seulement si root
      if (ns.hasRootAccess(host)) {
        await deployHgwOn(ns, host, script);
      } else {
        ns.print(`[SKIP] Pas de root sur ${host}, déploiement ignoré.`);
      }
    }
  }

  ns.tprint("Déploiement hgw terminé.");
}

/**
 * Essaie d'ouvrir tous les ports dispo + nuke.
 */
async function tryRoot(ns, host) {
  if (host === "home") return;
  if (ns.hasRootAccess(host)) return;

  let ports = 0;
  if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(host); ports++; }
  if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(host); ports++; }
  if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(host); ports++; }
  if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(host); ports++; }
  if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(host); ports++; }

  const required = ns.getServerNumPortsRequired(host);
  if (ports >= required) {
    if (ns.nuke(host)) {
      ns.print(`[ROOT] ${host} rooté.`);
    } else {
      ns.print(`[ROOT][ERR] ${host} : nuke refusé.`);
    }
  }
}

/**
 * Copie hgw.js et le lance avec le serveur comme cible, sans tuer les scripts existants.
 */
async function deployHgwOn(ns, host, script) {
  // pas besoin de déployer sur home ici, mais on peut le faire aussi
  await ns.scp(script, host);

  // si hgw.js tourne déjà pour cette cible-là, on ne fait rien
  if (ns.isRunning(script, host, host)) {
    ns.print(`[RUNNING] ${script} tourne déjà sur ${host} avec cible ${host}.`);
    return;
  }

  const maxRam = ns.getServerMaxRam(host);
  const usedRam = ns.getServerUsedRam(host);
  const freeRam = maxRam - usedRam;
  const scriptRam = ns.getScriptRam(script, host);

  // certains serveurs n'ont pas de RAM (0) -> on ignore
  if (freeRam < scriptRam || scriptRam === 0) {
    ns.print(`[SKIP] RAM insuffisante sur ${host} (${freeRam.toFixed(2)} GB libres).`);
    return;
  }

  // nb de threads possible (on peut en mettre plus d’un si ça rentre)
  const threads = Math.floor(freeRam / scriptRam);
  if (threads < 1) {
    ns.print(`[SKIP] Impossible de lancer ${script} sur ${host}, pas assez de RAM.`);
    return;
  }

  const pid = ns.exec(script, host, threads, host);
  if (pid === 0) {
    ns.print(`[ERR] Échec du lancement de ${script} sur ${host}.`);
  } else {
    ns.print(`[OK] ${script} lancé sur ${host} avec ${threads} threads, cible=${host}.`);
  }
}
