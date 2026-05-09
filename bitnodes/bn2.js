/**
 * BN2 — Rise of the Underworld
 * Mécanique clé : créer un Gang (karma ≤ −54 000) pour revenus + territoire
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { rootAllServers, getBestTarget, launchOnce, launchCore, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";
const GANG_FACTION = "Slum Snakes"; // faction criminelle la plus accessible
const KARMA_REQUIRED = -54_000;
const MAX_MEMBERS = 12;

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const karma = player.karma ?? 0;
    const inGang = ns.gang.inGang();

    launchCore(ns, 300);

    // --- Gestion du gang ---
    if (!inGang) {
      if (karma > KARMA_REQUIRED) {
        // Essayer les crimes automatiquement si Singularity dispo
        if (ns.singularity) {
          try { ns.singularity.commitCrime("Mug Someone", false); } catch {}
        }
      } else {
        try {
          ns.gang.createGang(GANG_FACTION);
        } catch {
          // Pas encore membre de la faction — karma ok mais facton à rejoindre
        }
      }
    } else {
      manageGang(ns);
    }

    ns.clearLog();
    ns.print("=== BN2 : Rise of the Underworld ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(player.money)}`);
    ns.print(`Karma  : ${karma.toFixed(0)} / ${KARMA_REQUIRED}`);

    if (inGang) {
      const info = ns.gang.getGangInformation();
      ns.print(`Gang   : ${info.faction} — Power: ${info.power.toFixed(0)}`);
      ns.print(`Territoire: ${(info.territory * 100).toFixed(1)}%  Membres: ${ns.gang.getMemberNames().length}/${MAX_MEMBERS}`);
    } else {
      ns.print(`Gang   : Non créé — ${karma > KARMA_REQUIRED ? "commits des crimes!" : "karma OK, rejoins " + GANG_FACTION}`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(30_000);
  }
}

/** @param {NS} ns */
function manageGang(ns) {
  const info = ns.gang.getGangInformation();
  const members = ns.gang.getMemberNames();

  // Recruter jusqu'au maximum
  if (members.length < MAX_MEMBERS) {
    try { ns.gang.recruitMember(`Membre${members.length + 1}`); } catch {}
  }

  for (const name of members) {
    const m = ns.gang.getMemberInformation(name);
    let task;

    if (m.str < 200 || m.def < 200 || m.agi < 200) {
      task = "Train Combat";
    } else if (info.territory < 0.95 && info.power > 300) {
      task = "Territory Warfare";
    } else {
      task = "Traffick Illegal Arms";
    }

    if (m.task !== task) ns.gang.setMemberTask(name, task);
  }

  // Activer la guerre territoriale si puissance suffisante
  ns.gang.setTerritoryWarfare(info.territory < 1.0 && info.power > 500);
}
