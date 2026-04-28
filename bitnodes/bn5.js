/**
 * BN5 — Artificial Intelligence
 * Mécanique clé : Bladeburner disponible + hacking nerfé
 * Combiner hacking farm + Bladeburner pour stats et revenus
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;

    launchCore(ns, 400);

    // --- Bladeburner ---
    if (!ns.bladeburner.inBladeburner()) {
      // Rejoindre nécessite str/def/dex/agi ≥ 100
      const s = player.skills;
      if (s.strength >= 100 && s.defense >= 100 && s.dexterity >= 100 && s.agility >= 100) {
        try { ns.bladeburner.joinBladeburnerDivision(); } catch {}
      } else {
        // Gym via Singularity si dispo
        if (ns.singularity) {
          try { ns.singularity.gymWorkout("Powerhouse Gym", "strength", false); } catch {}
        }
      }
    } else {
      manageBladeburner(ns);
    }

    ns.clearLog();
    ns.print("=== BN5 : Artificial Intelligence ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.formatNumber(player.money)}`);

    const s = player.skills;
    ns.print(`Combat : STR ${s.strength} / DEF ${s.defense} / DEX ${s.dexterity} / AGI ${s.agility}`);

    if (ns.bladeburner.inBladeburner()) {
      const rank = ns.bladeburner.getRank();
      const action = ns.bladeburner.getCurrentAction();
      ns.print(`BB Rank  : ${rank.toFixed(0)}`);
      ns.print(`BB Action: ${action.type} — ${action.name}`);
    } else {
      ns.print(`Bladeburner: Non rejoint (besoin stats ≥ 100)`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(30_000);
  }
}

/** @param {NS} ns */
function manageBladeburner(ns) {
  const rank = ns.bladeburner.getRank();
  const current = ns.bladeburner.getCurrentAction();

  // Stamina : se reposer si < 50%
  const [stamina, maxStamina] = ns.bladeburner.getStamina();
  if (stamina / maxStamina < 0.5) {
    if (current.name !== "Hyperbolic Regeneration Chamber") {
      ns.bladeburner.startAction("General", "Hyperbolic Regeneration Chamber");
    }
    return;
  }

  if (rank < 100) {
    // Entraînement en début
    if (current.name !== "Training") {
      ns.bladeburner.startAction("General", "Training");
    }
    return;
  }

  // Choisir le meilleur contrat ou opération disponible
  const contracts = ["Bounty Hunter", "Retirement", "Tracking"];
  for (const c of contracts) {
    try {
      const remaining = ns.bladeburner.getActionCountRemaining("Contracts", c);
      const [min, max] = ns.bladeburner.getActionEstimatedSuccessChance("Contracts", c);
      if (remaining > 0 && min > 0.5) {
        if (current.type !== "Contracts" || current.name !== c) {
          ns.bladeburner.startAction("Contracts", c);
        }
        return;
      }
    } catch {}
  }

  // Opérations si rang assez élevé
  if (rank >= 500) {
    const ops = ["Investigation", "Undercover Operation", "Sting Operation"];
    for (const op of ops) {
      try {
        const remaining = ns.bladeburner.getActionCountRemaining("Operations", op);
        const [min] = ns.bladeburner.getActionEstimatedSuccessChance("Operations", op);
        if (remaining > 0 && min > 0.6) {
          if (current.type !== "Operations" || current.name !== op) {
            ns.bladeburner.startAction("Operations", op);
          }
          return;
        }
      } catch {}
    }
  }

  // Fallback : diplo pour améliorer les estimations
  if (current.name !== "Diplomacy") {
    ns.bladeburner.startAction("General", "Diplomacy");
  }
}
