/**
 * BN6 — Bladeburners
 * Mécanique clé : Bladeburner est la voie principale (hacking très nerfé)
 * Monter en rang Bladeburner + gagner assez pour acheter les programmes
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, rootAllServers, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const s = player.skills;

    // Hacking farm minimal pour revenus
    rootAllServers(ns);
    launchOnce(ns, "xp-manager.js --xp");
    //launchOnce(ns, "upgrade-servers.js");

    // Gym pour stats combat si Singularity dispo
    if (!ns.bladeburner.inBladeburner()) {
      const need = s.strength < 100 || s.defense < 100 || s.dexterity < 100 || s.agility < 100;
      if (need && ns.singularity) {
        const stat = s.strength <= s.defense && s.strength <= s.dexterity && s.strength <= s.agility
          ? "Strength" : s.defense <= s.dexterity && s.defense <= s.agility ? "Defense"
          : s.dexterity <= s.agility ? "Dexterity" : "Agility";
        try { ns.singularity.gymWorkout("Powerhouse Gym", stat, false); } catch {}
      }
      if (s.strength >= 100 && s.defense >= 100 && s.dexterity >= 100 && s.agility >= 100) {
        try { ns.bladeburner.joinBladeburnerDivision(); } catch {}
      }
    } else {
      manageBladeburner(ns);
      upgradeBladeburnerSkills(ns);
    }

    ns.clearLog();
    ns.print("=== BN6 : Bladeburners ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(player.money)}`);
    ns.print(`STR ${s.strength}  DEF ${s.defense}  DEX ${s.dexterity}  AGI ${s.agility}`);

    if (ns.bladeburner.inBladeburner()) {
      const rank = ns.bladeburner.getRank();
      const [stam, maxStam] = ns.bladeburner.getStamina();
      const action = ns.bladeburner.getCurrentAction();
      ns.print(`Rang   : ${rank.toFixed(0)}`);
      ns.print(`Stamina: ${stam.toFixed(0)} / ${maxStam.toFixed(0)}`);
      ns.print(`Action : ${action.type} — ${action.name}`);
    } else {
      ns.print("Bladeburner: Non rejoint");
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(20_000);
  }
}

/** @param {NS} ns */
function manageBladeburner(ns) {
  const rank = ns.bladeburner.getRank();
  const current = ns.bladeburner.getCurrentAction();
  const [stamina, maxStamina] = ns.bladeburner.getStamina();

  // Récupération stamina
  if (stamina / maxStamina < 0.4) {
    if (current?.name !== "Hyperbolic Regeneration Chamber") {
      ns.bladeburner.startAction("General", "Hyperbolic Regeneration Chamber");
    }
    return;
  }

  if (rank < 50) {
    // Démarrage : entraînement
    if (current?.name !== "Training") ns.bladeburner.startAction("General", "Training");
    return;
  }

  // Opérations par ordre de préférence
  const ops = [
    { type: "Operations", names: ["Assassination", "Sting Operation", "Undercover Operation", "Investigation"] },
    { type: "Contracts", names: ["Bounty Hunter", "Retirement", "Tracking"] },
  ];

  for (const group of ops) {
    for (const name of group.names) {
      try {
        const remaining = ns.bladeburner.getActionCountRemaining(group.type, name);
        const [minChance] = ns.bladeburner.getActionEstimatedSuccessChance(group.type, name);
        if (remaining > 0 && minChance > 0.55) {
          if (current?.type !== group.type || current?.name !== name) {
            ns.bladeburner.startAction(group.type, name);
          }
          return;
        }
      } catch {}
    }
  }

  // Améliorer la précision des estimations
  if (current?.name !== "Field Analysis") {
    ns.bladeburner.startAction("General", "Field Analysis");
  }
}

/** @param {NS} ns */
function upgradeBladeburnerSkills(ns) {
  const rank = ns.bladeburner.getRank();
  if (rank < 100) return;

  // Priorité : Blade's Intuition (succès) > Cloak (furtivité) > Overclock (vitesse)
  const skills = ["Blade's Intuition", "Cloak", "Overclock", "Short-Circuit", "Digital Observer"];
  for (const skill of skills) {
    try {
      const cost = ns.bladeburner.getSkillUpgradeCost(skill);
      if (ns.bladeburner.getSkillPoints() >= cost) {
        ns.bladeburner.upgradeSkill(skill);
      }
    } catch {}
  }
}
