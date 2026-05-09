/**
 * BN3 — Corporatocracy
 * Mécanique clé : créer et développer une Corporation pour revenus massifs
 * En BN3, selfFund=false utilise les fonds de démarrage du bitnode (~$150B)
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";
const CORP_NAME = "MegaCorp";
const CITIES = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;

    launchCore(ns, 300);

    // --- Gestion de la corporation ---
    if (!ns.corporation.hasCorporation()) {
      try {
        // false = utilise les fonds initiaux du bitnode en BN3
        ns.corporation.createCorporation(CORP_NAME, false);
        ns.print(`Corporation "${CORP_NAME}" créée!`);
      } catch (e) {
        ns.print(`Impossible de créer la corp: ${e.message ?? e}`);
      }
    } else {
      manageCorp(ns);
    }

    ns.clearLog();
    ns.print("=== BN3 : Corporatocracy ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.formatNumber(player.money)}`);

    if (ns.corporation.hasCorporation()) {
      const corp = ns.corporation.getCorporation();
      ns.print(`Corp   : ${corp.name} (${corp.public ? "Publique" : "Privée"})`);
      ns.print(`Revenue: $${ns.formatNumber(corp.revenue)}/s`);
      ns.print(`Divisions: ${corp.divisions.length > 0 ? corp.divisions.join(", ") : "aucune"}`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(60_000);
  }
}

/** @param {NS} ns */
function manageCorp(ns) {
  const corp = ns.corporation.getCorporation();

  // Étape 1 : Ouvrir la division Agriculture dans toutes les villes
  if (!corp.divisions.includes("Agriculture")) {
    try { ns.corporation.expandIntoIndustry("Agriculture", "Agriculture"); } catch {}
    return;
  }

  // Acheter entrepôts + embaucher dans chaque ville (Agriculture)
  for (const city of CITIES) {
    try {
      if (!ns.corporation.hasWarehouse("Agriculture", city)) {
        ns.corporation.purchaseWarehouse("Agriculture", city);
      }
      // Agrandir entrepôt si moins de 300 taille
      const wh = ns.corporation.getWarehouse("Agriculture", city);
      if (wh.size < 300) ns.corporation.upgradeWarehouse("Agriculture", city, 1);
    } catch {}

    // Embaucher des employés
    try {
      const office = ns.corporation.getOffice("Agriculture", city);
      if (office.numEmployees < 9) {
        ns.corporation.expandOffice("Agriculture", city, 9 - office.numEmployees);
      }
      // Répartition emplois Agriculture
      ns.corporation.setAutoJobAssignment("Agriculture", city, "Operations", 2);
      ns.corporation.setAutoJobAssignment("Agriculture", city, "Engineer", 2);
      ns.corporation.setAutoJobAssignment("Agriculture", city, "Business", 1);
      ns.corporation.setAutoJobAssignment("Agriculture", city, "Management", 2);
      ns.corporation.setAutoJobAssignment("Agriculture", city, "Research & Development", 2);
    } catch {}

    // Vendre nourriture et plantes
    try {
      ns.corporation.sellMaterial("Agriculture", city, "Food", "MAX", "MP");
      ns.corporation.sellMaterial("Agriculture", city, "Plants", "MAX", "MP");
    } catch {}
  }

  // Étape 2 : Division Chimie après Agriculture rentable
  if (!corp.divisions.includes("Chimie") && corp.revenue > 1_000_000) {
    try { ns.corporation.expandIntoIndustry("Chemical", "Chimie"); } catch {}
  }

  // Passer en public quand revenus > $20M/s
  if (!corp.public && corp.revenue > 20_000_000) {
    try {
      ns.corporation.goPublic(0);
      ns.corporation.issueDividends(0.1);
    } catch {}
  }
}
