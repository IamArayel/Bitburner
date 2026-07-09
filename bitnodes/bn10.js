/**
 * BN10 — Digital Carbon
 * Mécanique clé : Sleeves — clones qui travaillent en parallèle
 * Synchroniser les sleeves, réduire le choc, puis les affecter aux meilleures tâches
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot, printFinalConditions } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const numSleeves = ns.sleeve.getNumSleeves();

    launchCore(ns, 300);

    // --- Gestion des Sleeves ---
    for (let i = 0; i < numSleeves; i++) {
      manageSleeve(ns, i, hack);
    }

    ns.clearLog();
    ns.print("=== BN10 : Digital Carbon ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(player.money)}`);
    ns.print(`Sleeves: ${numSleeves}`);

    for (let i = 0; i < numSleeves; i++) {
      const sl = ns.sleeve.getSleeve(i);
      const task = ns.sleeve.getTask(i);
      const taskName = task ? `${task.type}${task.crimeType ? " (" + task.crimeType + ")" : ""}` : "Idle";
      ns.print(`  [${i}] Sync:${sl.sync.toFixed(0)}% Choc:${sl.shock.toFixed(0)}% → ${taskName}`);
    }

    printFinalConditions(ns, FINAL);

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(30_000);
  }
}

/** @param {NS} ns @param {number} i @param {number} hack */
function manageSleeve(ns, i, hack) {
  const sl = ns.sleeve.getSleeve(i);
  const task = ns.sleeve.getTask(i);

  // 1. Synchronisation prioritaire si < 100%
  if (sl.sync < 100) {
    if (!task || task.type !== "SYNCHRONIZE") {
      ns.sleeve.setToSynchronize(i);
    }
    return;
  }

  // 2. Récupération du choc si > 0%
  if (sl.shock > 0) {
    if (!task || task.type !== "RECOVERY") {
      ns.sleeve.setToShockRecovery(i);
    }
    return;
  }

  // 3. Tâche optimale selon index
  if (i === 0) {
    // Sleeve 0 : crimes pour argent (Homicide = meilleur ratio $)
    if (!task || task.crimeType !== "Homicide") {
      ns.sleeve.setToCommitCrime(i, "Homicide");
    }
  } else if (i === 1) {
    // Sleeve 1 : crimes pour karma (gang possible)
    if (!task || task.crimeType !== "Mug Someone") {
      ns.sleeve.setToCommitCrime(i, "Mug Someone");
    }
  } else if (i < 4) {
    // Sleeves 2-3 : farm XP hacking (si hack level bas)
    if (hack < 1000) {
      if (!task || task.type !== "WORK") {
        try { ns.sleeve.setToUniversityCoursework(i, "Rothman University", "Algorithms"); } catch {}
      }
    } else {
      if (!task || task.crimeType !== "Homicide") {
        ns.sleeve.setToCommitCrime(i, "Homicide");
      }
    }
  } else {
    // Sleeves 4+ : crimes homicide
    if (!task || task.crimeType !== "Homicide") {
      ns.sleeve.setToCommitCrime(i, "Homicide");
    }
  }
}
