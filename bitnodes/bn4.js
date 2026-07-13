/**
 * BN4 — The Singularity
 * Mécanique clé : API Singularity disponible dès le début (coût RAM réduit)
 * Automatise : achats programmes, factions, augmentations, soft-reset
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { rootAllServers, launchOnce, tryRoot, getConnectPath, printFinalConditions } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

// Programmes darkweb par ordre de priorité
const PROGRAMS = [
  "BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe",
  "HTTPWorm.exe", "SQLInject.exe", "AutoLink.exe", "Formulas.exe",
];

// Factions hacking par réputation croissante
const HACK_FACTIONS = [
  "CyberSec", "NiteSec", "The Black Hand", "BitRunners",
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const money = player.money;

    rootAllServers(ns);
    launchOnce(ns, "utils/deploy-hgw-all.js");

    if (hack < 300 && !ns.scriptRunning("xp-manager.js", "home")) {
      ns.run("xp-manager.js");
    }

    // Acheter programmes sur darkweb
    for (const prog of PROGRAMS) {
      if (!ns.fileExists(prog, "home")) {
        try { ns.singularity.purchaseProgram(prog); } catch {}
      }
    }

    // Rejoindre factions disponibles
    const invited = ns.singularity.checkFactionInvitations();
    for (const faction of invited) {
      try { ns.singularity.joinFaction(faction); } catch {}
    }

    // Travailler pour une faction hacking si réputation insuffisante
    const focus = await manageFactionWork(ns, hack);

    // Acheter toutes les augmentations abordables
    const augsBought = buyAugmentations(ns, money);

    // Installer les augments si on en a ≥ 5 non installés et hack ≥ 500
    const owned = ns.singularity.getOwnedAugmentations(false);
    const installed = ns.singularity.getOwnedAugmentations(true).length;
    if (owned.length - installed >= 5 && hack >= 500) {
      ns.print("\n>>> Installation des augmentations + soft-reset...");
      ns.singularity.installAugmentations("bitnodes/bn4.js");
      return;
    }

    // Endgame
    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      await connectAndBackdoor(ns, FINAL);
    }

    ns.clearLog();
    ns.print("=== BN4 : The Singularity ===");
    ns.print(`Hack       : ${hack} / 3000`);
    ns.print(`Money      : $${ns.format.number(money)}`);
    ns.print(`Augments   : ${installed} installées / ${owned.length} possédées`);
    ns.print(`Focus      : ${focus}`);
    printFinalConditions(ns, FINAL);

    await ns.sleep(20_000);
  }
}

/** Travaille pour la faction hacking la plus avancée accessible.
 * @param {NS} ns @param {number} hack @returns {string} */
async function manageFactionWork(ns, hack) {
  const factions = ns.getPlayer().factions;
  // Choisir la faction la plus avancée déjà rejointe
  let best = null;
  for (const f of HACK_FACTIONS.slice().reverse()) {
    if (factions.includes(f)) { best = f; break; }
  }
  if (!best) return "Aucune faction hacking rejointe";

  const rep = ns.singularity.getFactionRep(best);
  const repNeeded = 200_000; // seuil pour les meilleures augments
  if (rep < repNeeded) {
    try { ns.singularity.workForFaction(best, "Hacking Contracts", false); } catch {}
    return `Travaille pour ${best} (${ns.format.number(rep)} / ${ns.format.number(repNeeded)} rep)`;
  }
  return `${best} — réputation suffisante`;
}

/** Achète toutes les augmentations abordables depuis les factions rejointes.
 * @param {NS} ns @param {number} money @returns {number} */
function buyAugmentations(ns, money) {
  let bought = 0;
  const factions = ns.getPlayer().factions;
  const owned = new Set(ns.singularity.getOwnedAugmentations(false));

  for (const faction of factions) {
    const augs = ns.singularity.getFactionAugmentations(faction)
      .filter(a => !owned.has(a))
      .sort((a, b) => ns.singularity.getAugmentationPrice(b) - ns.singularity.getAugmentationPrice(a));

    for (const aug of augs) {
      const price = ns.singularity.getAugmentationPrice(aug);
      if (price < money * 0.5) {
        try {
          ns.singularity.purchaseAugmentation(faction, aug);
          bought++;
          owned.add(aug);
        } catch {}
      }
    }
  }
  return bought;
}

/** Navigue jusqu'à la cible et installe le backdoor.
 * @param {NS} ns @param {string} target */
async function connectAndBackdoor(ns, target) {
  const path = getConnectPath(ns, target);
  if (!path.length) return;
  for (const node of path.slice(1)) {
    try { ns.singularity.connect(node); } catch { return; }
  }
  try {
    await ns.singularity.installBackdoor();
    ns.print(`Backdoor installé sur ${target}!`);
  } catch {}
  ns.singularity.connect("home");
}
