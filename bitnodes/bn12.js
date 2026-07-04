/**
 * BN12 — The Recursion
 * Mécanique clé : accès à tous les Bitnodes précédents — le bitnode actuel
 * est déterminé par tes Source Files. Détecte les mécaniques disponibles
 * et lance le script correspondant ou la meilleure stratégie.
 * Objectif final : backdoor w0r1d_d43m0n (dans chaque sous-bitnode visité)
 */
import { launchCore, launchOnce, tryRoot, getAllServers } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  const available = detectAvailableMechanics(ns);

  ns.print("=== BN12 : The Recursion ===");
  ns.print("Mécaniques détectées :");
  for (const [name, ok] of Object.entries(available)) {
    ns.print(`  ${ok ? "✓" : "✗"} ${name}`);
  }
  ns.print("\nConseil : lance le script BN correspondant à ta situation :");
  if (available.bladeburner) ns.print("  → run bitnodes/bn6.js  (Bladeburner)");
  if (available.gang)        ns.print("  → run bitnodes/bn2.js  (Gang)");
  if (available.corporation) ns.print("  → run bitnodes/bn3.js  (Corp)");
  if (available.sleeves)     ns.print("  → run bitnodes/bn10.js (Sleeves)");
  if (available.stocks)      ns.print("  → run bitnodes/bn8.js  (Stocks)");
  if (available.hacknet)     ns.print("  → run bitnodes/bn9.js  (Hacknet)");
  if (available.singularity) ns.print("  → run bitnodes/bn4.js  (Singularity)");

  ns.print("\nLancement du core + stratégie optimale détectée...");
  await ns.sleep(5_000);

  // Lancer la meilleure stratégie automatiquement
  if (available.bladeburner && available.gang) {
    ns.run("bitnodes/bn6.js");
  } else if (available.gang) {
    ns.run("bitnodes/bn2.js");
  } else if (available.corporation) {
    ns.run("bitnodes/bn3.js");
  } else if (available.sleeves) {
    ns.run("bitnodes/bn10.js");
  } else if (available.stocks) {
    ns.run("bitnodes/bn8.js");
  } else if (available.hacknet) {
    ns.run("bitnodes/bn9.js");
  } else {
    ns.run("bitnodes/bn1.js");
  }
}

/** Vérifie quelles mécaniques sont disponibles dans le bitnode courant.
 * @param {NS} ns */
function detectAvailableMechanics(ns) {
  const check = (fn) => { try { fn(); return true; } catch { return false; } };
  return {
    singularity: check(() => ns.singularity.getOwnedAugmentations(true)),
    gang:        check(() => ns.gang.inGang()),
    corporation: check(() => ns.corporation.hasCorporation()),
    bladeburner: check(() => ns.bladeburner.inBladeburner()),
    stocks:      check(() => ns.stock.hasTixApiAccess()),
    hacknet:     check(() => ns.hacknet.numNodes()),
    sleeves:     check(() => ns.sleeve.getNumSleeves()),
    stanek:      check(() => ns.stanek.activeFragments()),
  };
}
