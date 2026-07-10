/**
 * BN7 — Bladeburners 2079
 * Mécanique clé : identique à BN6 mais multiplicateurs plus durs
 * Nécessite plus de rang BB et stats plus élevées avant d'entreprendre les opérations
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchOnce, rootAllServers, tryRoot, printFinalConditions } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const s = player.skills;

    rootAllServers(ns);
    launchOnce(ns, "deploy-hgw-all.js");

    if (!ns.bladeburner.inBladeburner()) {
      // Seuil plus élevé qu'en BN6 à cause des multiplicateurs
      const need = s.strength < 200 || s.defense < 200 || s.dexterity < 200 || s.agility < 200;
      if (need && ns.singularity) {
        const lowestKey = ["strength", "defense", "dexterity", "agility"]
          .sort((a, b) => s[a] - s[b])[0];
        const gymStat = { strength: "Strength", defense: "Defense", dexterity: "Dexterity", agility: "Agility" };
        try { ns.singularity.gymWorkout("Powerhouse Gym", gymStat[lowestKey], false); } catch {}
      }
      if (s.strength >= 200 && s.defense >= 200 && s.dexterity >= 200 && s.agility >= 200) {
        try { ns.bladeburner.joinBladeburnerDivision(); } catch {}
      }
    } else {
      manageBladeburner7(ns);
      upgradeSkills(ns);
    }

    ns.clearLog();
    ns.print("=== BN7 : Bladeburners 2079 ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(player.money)}`);
    ns.print(`STR ${s.strength}  DEF ${s.defense}  DEX ${s.dexterity}  AGI ${s.agility}`);

    if (ns.bladeburner.inBladeburner()) {
      const rank = ns.bladeburner.getRank();
      const [stam, maxStam] = ns.bladeburner.getStamina();
      const action = ns.bladeburner.getCurrentAction();
      ns.print(`Rang   : ${rank.toFixed(0)}`);
      ns.print(`Stamina: ${(stam / maxStam * 100).toFixed(0)}%`);
      ns.print(`Action : ${action.type} — ${action.name}`);
    }

    printFinalConditions(ns, FINAL);

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(20_000);
  }
}

/** BN7 : seuils de succès plus stricts (0.65+) vu les multiplicateurs durs.
 * @param {NS} ns */
function manageBladeburner7(ns) {
  const rank = ns.bladeburner.getRank();
  const current = ns.bladeburner.getCurrentAction();
  const [stamina, maxStamina] = ns.bladeburner.getStamina();

  if (stamina / maxStamina < 0.5) {
    if (current.name !== "Hyperbolic Regeneration Chamber") {
      ns.bladeburner.startAction("General", "Hyperbolic Regeneration Chamber");
    }
    return;
  }

  if (rank < 150) {
    if (current.name !== "Training") ns.bladeburner.startAction("General", "Training");
    return;
  }

  const all = [
    { type: "Operations", names: ["Assassination", "Sting Operation", "Undercover Operation", "Investigation"] },
    { type: "Contracts", names: ["Bounty Hunter", "Retirement", "Tracking"] },
  ];

  for (const group of all) {
    for (const name of group.names) {
      try {
        const remaining = ns.bladeburner.getActionCountRemaining(group.type, name);
        const [minChance] = ns.bladeburner.getActionEstimatedSuccessChance(group.type, name);
        if (remaining > 0 && minChance > 0.65) {
          if (current.type !== group.type || current.name !== name) {
            ns.bladeburner.startAction(group.type, name);
          }
          return;
        }
      } catch {}
    }
  }

  // Field Analysis pour améliorer les estimations (essentiel en BN7)
  if (current.name !== "Field Analysis") {
    ns.bladeburner.startAction("General", "Field Analysis");
  }
}

/** @param {NS} ns */
function upgradeSkills(ns) {
  const priority = ["Blade's Intuition", "Cloak", "Overclock", "Short-Circuit", "Digital Observer", "Hyperdrive"];
  for (const skill of priority) {
    try {
      if (ns.bladeburner.getSkillPoints() >= ns.bladeburner.getSkillUpgradeCost(skill)) {
        ns.bladeburner.upgradeSkill(skill);
      }
    } catch {}
  }
}
