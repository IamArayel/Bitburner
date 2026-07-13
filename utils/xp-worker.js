/** @param {NS} ns **/
export async function main(ns) {
  const target = ns.args[0] ?? "n00dles";
  const mode   = ns.args[1] ?? "xp"; // "xp" ou "money"

  // En mode XP : tolère sécurité haute + serveur vide → spam hack pour XP pur
  // En mode money : cycle strict, maintient serveur optimal avant de hacker
  const secMargin  = mode === "xp" ? 5    : 1;
  const moneyRatio = mode === "xp" ? 0.05 : 0.75;

  if (ns.getPlayer().skills.hacking < ns.getServerRequiredHackingLevel(target)) return;

  while (true) {
    if (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target) + secMargin) {
      await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target) * moneyRatio) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}
