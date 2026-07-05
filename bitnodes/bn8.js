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

    launchCore(ns, 300, false); // pas de pserv : argent du hacking = 0 en BN8, tout doit aller à la bourse

    // --- Marché boursier ---
    const hasTix = ns.stock.hasTixApiAccess();
    const has4s = ns.stock.has4SDataTixApi();

    if (!hasTix && money >= TIX_COST) {
      try { ns.stock.purchaseTixApi(); } catch {}
    }

    if (hasTix && !has4s && money >= WSAPI_COST) {
      try { ns.stock.purchase4SMarketDataTixApi(); } catch {}
    }

    // Avant le 4S : forecast/volatilité estimés depuis l'historique (API indisponible)
    // Après le 4S : bascule sur le trader classique (forecast/volatilité fournis par le jeu)
    if (hasTix && !has4s) {
      launchOnce(ns, "trade_bn8.js");
    } else if (hasTix && has4s) {
      if (ns.scriptRunning("trade_bn8.js", "home")) ns.scriptKill("trade_bn8.js", "home");
      launchOnce(ns, "stockTrader.js");
    }

    ns.clearLog();
    ns.print("=== BN8 : Ghost of Wall Street ===");
    ns.print(`Hack     : ${hack} / 3000`);
    ns.print(`Money    : $${ns.format.number(money)}`);
    ns.print(`TIX API  : ${hasTix ? "OK" : `Non ($${ns.format.number(TIX_COST)} requis)`}`);
    ns.print(`4S Data  : ${has4s ? "OK" : `Non ($${ns.format.number(WSAPI_COST)} requis)`}`);
    let traderStatus = "Inactif";
    if (ns.scriptRunning("stockTrader.js", "home")) traderStatus = "stockTrader (4S)";
    else if (ns.scriptRunning("trade_bn8.js", "home")) traderStatus = "trade_bn8 (estimé)";
    ns.print(`Trader   : ${traderStatus}`);

    if (hasTix) {
      const portfolio = getPortfolioValue(ns);
      ns.print(`Portfolio: $${ns.format.number(portfolio)}`);
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
