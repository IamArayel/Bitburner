/**
 * BN1 — Source Genesis
 * Stratégie standard : farm HGW → upgrade serveurs → hack 3000 → backdoor w0r1d_d43m0n
 */
import { rootAllServers, getBestTarget, launchOnce, launchCore, tryRoot, printFinalConditions } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const money = player.money;

    launchCore(ns, 300);

    const phase =
      hack < 300 ? "Early — Farm XP (n00dles)" :
      hack < 1000 ? "Mid — HGW sur meilleure cible" :
      hack < 3000 ? "Late — Max farm + programmes" :
      "ENDGAME";

    ns.clearLog();
    ns.print("=== BN1 : Source Genesis ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(money)}`);
    ns.print(`Cible  : ${getBestTarget(ns)}`);
    ns.print(`Phase  : ${phase}`);

    // Achat programmes si possible
    if (hack >= 50 && money > 500_000 && !ns.fileExists("BruteSSH.exe", "home")) {
      ns.print(">> Connectez-vous à darkweb et achetez BruteSSH.exe");
    }

    printFinalConditions(ns, FINAL);

    if (hack >= 3000) {
      const rooted = tryRoot(ns, FINAL);
      if (rooted) {
        ns.print(`\n>>> Root OK — Lancement backdoor ${FINAL}...`);
        launchOnce(ns, "auto-backdoor.js");
      } else {
        ns.print(`\n>>> Hack 3000 OK, mais manque des programmes pour rooter ${FINAL}`);
        ns.print("    Achetez les 5 programmes depuis darkweb.");
      }
    }

    await ns.sleep(30_000);
  }
}
