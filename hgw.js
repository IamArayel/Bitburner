// file: hgw.js
/** @param {NS} ns **/
export async function main(ns) {
  const target = ns.args[0];
  if (!target || !ns.serverExists(target)) {
    ns.tprint("Usage: run hgw_optimized.js <target>");
    return;
  }

  ns.disableLog("ALL");

  const minSec = ns.getServerMinSecurityLevel(target);
  const maxMoney = ns.getServerMaxMoney(target);

  while (true) {
    // 1) Sécurité minimale
    while (ns.getServerSecurityLevel(target) > minSec) {
      await ns.weaken(target);
    }

    // 2) Argent maximal
    while (ns.getServerMoneyAvailable(target) < maxMoney * 0.95) {
      await ns.grow(target);
    }

    // 3) Hack contrôlé (~10%)
    await ns.hack(target);

    // 4) Correction sécurité post-hack
    await ns.weaken(target);
  }
}
