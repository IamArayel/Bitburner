/**
 * BN8 — Ghost of Wall Street
 * Mécanique clé : marché boursier — acheter l'accès TIX + 4S dès que possible
 * Le trading est la source de revenu principale
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";
const TIX_COST = 5_000_000_000;       // $5B
const WSAPI_COST = 25_000_000_000;    // $25B (avec TIX déjà acheté)

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const money = player.money;

    launchCore(ns, 300);

    // --- Marché boursier ---
    const hasTix = ns.stock.hasTIXAPIAccess();
    const has4s = ns.stock.has4SDataTIXAPI();

    if (!hasTix && money >= TIX_COST) {
      try { ns.stock.purchaseTix(); } catch {}
    }

    if (hasTix && !has4s && money >= WSAPI_COST) {
      try { ns.stock.purchase4SMarketDataTixApi(); } catch {}
    }

    // Lancer le trader une fois que les APIs sont disponibles
    if (hasTix && has4s) {
      launchOnce(ns, "stockTrader.js");
    }

    ns.clearLog();
    ns.print("=== BN8 : Ghost of Wall Street ===");
    ns.print(`Hack     : ${hack} / 3000`);
    ns.print(`Money    : $${ns.formatNumber(money)}`);
    ns.print(`TIX API  : ${hasTix ? "OK" : `Non ($${ns.formatNumber(TIX_COST)} requis)`}`);
    ns.print(`4S Data  : ${has4s ? "OK" : `Non ($${ns.formatNumber(WSAPI_COST)} requis)`}`);
    ns.print(`Trader   : ${ns.scriptRunning("stockTrader.js", "home") ? "Actif" : "Inactif"}`);

    if (hasTix) {
      const portfolio = getPortfolioValue(ns);
      ns.print(`Portfolio: $${ns.formatNumber(portfolio)}`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      // Vendre les positions avant la fin du bitnode
      launchOnce(ns, "stockSeller.js");
      await ns.sleep(10_000);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(30_000);
  }
}

/** @param {NS} ns @returns {number} */
function getPortfolioValue(ns) {
  let total = 0;
  try {
    for (const sym of ns.stock.getSymbols()) {
      const [long] = ns.stock.getPosition(sym);
      if (long > 0) total += long * ns.stock.getAskPrice(sym);
    }
  } catch {}
  return total;
}
