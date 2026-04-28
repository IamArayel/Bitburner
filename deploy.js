// deploy.js
/** @param {NS} ns **/
export async function main(ns) {
  const [host, script, ...args] = ns.args;
  if (!host || !script) return ns.tprint('Usage: run deploy.js <host_cible> <script.js> <target>');

  // 1) copier le script sur la cible
  await ns.scp(script, host); // copie depuis home -> host

  // 2) calculer le nb de threads dispo sur la cible
  const ramFree = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
  const ramPerThread = ns.getScriptRam(script, host);
  const threads = Math.max(1, Math.floor(ramFree / ramPerThread));

  // 3) exécuter sur la cible
  const pid = ns.exec(script, host, threads, ...args);
  if (!pid) ns.tprint('Échec exec (RAM, droits root ou fichier manquant).');
}
