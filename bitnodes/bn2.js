/**
 * BN2 — Rise of the Underworld
 * Mécanique clé : créer un Gang pour revenus + territoire
 * Spécifique à BN2 : pas de seuil de karma pour créer le gang (contrairement aux
 * autres bitnodes avec SF2), il suffit d'avoir rejoint une faction criminelle.
 * SF4 possédé → Singularity toujours dispo pour automatiser crimes/faction.
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchOnce, launchCore, tryRoot, printFinalConditions } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";
const GANG_FACTION = "Slum Snakes"; // faction criminelle la plus accessible
const FACTION_KARMA_REQUIRED = -9; // karma requis pour l'invitation Slum Snakes
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
    const inFaction = player.factions.includes(GANG_FACTION);
    if (!inGang) {
      if (!inFaction) {
        const invited = ns.singularity.checkFactionInvitations();
        if (invited.includes(GANG_FACTION)) {
          try { ns.singularity.joinFaction(GANG_FACTION); } catch {}
        } else if (karma > FACTION_KARMA_REQUIRED) {
          try { ns.singularity.commitCrime("Mug Someone", false); } catch {}
        }
      } else {
        try { ns.gang.createGang(GANG_FACTION); } catch {}
      }
    } else {
      manageGang(ns);
    }

    ns.clearLog();
    ns.print("=== BN2 : Rise of the Underworld ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(player.money)}`);
    ns.print(`Karma  : ${karma.toFixed(0)} (invitation ${GANG_FACTION} à ${FACTION_KARMA_REQUIRED})`);

    if (inGang) {
      const info = ns.gang.getGangInformation();
      ns.print(`Gang   : ${info.faction} — Power: ${info.power.toFixed(0)}`);
      ns.print(`Territoire: ${(info.territory * 100).toFixed(1)}%  Membres: ${ns.gang.getMemberNames().length}/${MAX_MEMBERS}`);
    } else if (inFaction) {
      ns.print(`Gang   : Non créé — membre de ${GANG_FACTION}, création en cours`);
    } else {
      ns.print(`Gang   : Non créé — ${karma > FACTION_KARMA_REQUIRED ? "commits des crimes pour l'invitation" : "invitation en attente"}`);
    }

    printFinalConditions(ns, FINAL);

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
