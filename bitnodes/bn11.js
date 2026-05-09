/**
 * BN11 — The Big Crash
 * Mécanique clé : le marché boursier s'effondre — les actions partent à la hausse
 * puis s'effondrent. Utiliser les positions SHORT pendant la chute.
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";
const TIX_COST = 5_000_000_000;

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const money = player.money;

    launchCore(ns, 300);

    const hasTix = ns.stock.hasTIXAPIAccess();
    const has4s = ns.stock.has4SDataTIXAPI();

    if (!hasTix && money >= TIX_COST) {
      try { ns.stock.purchaseTix(); } catch {}
    }
    if (hasTix && !has4s && money >= 25_000_000_000) {
      try { ns.stock.purchase4SMarketDataTixApi(); } catch {}
    }

    if (hasTix && has4s) {
      // En BN11 : le stockTrader standard fonctionne (positions short activées)
      launchOnce(ns, "stockTrader.js");
    }

    ns.clearLog();
    ns.print("=== BN11 : The Big Crash ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.format.number(money)}`);
    ns.print(`TIX    : ${hasTix ? "OK" : "Non"}`);
    ns.print(`4S     : ${has4s ? "OK" : "Non"}`);

    if (hasTix && has4s) {
      const market = analyzeMarket(ns);
      ns.print(`Marché : ${market.state} (${market.rising} hausse / ${market.falling} baisse)`);
      ns.print(`Portfolio: $${ns.format.number(market.portfolioValue)}`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Vente positions + Backdoor ${FINAL}...`);
      launchOnce(ns, "stockSeller.js");
      await ns.sleep(5_000);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(30_000);
  }
}

/** @param {NS} ns @returns {{ state: string, rising: number, falling: number, portfolioValue: number }} */
function analyzeMarket(ns) {
  let rising = 0, falling = 0, portfolioValue = 0;
  try {
    for (const sym of ns.stock.getSymbols()) {
      const forecast = ns.stock.getForecast(sym);
      if (forecast > 0.5) rising++;
      else falling++;
      const [long, , avgLong] = ns.stock.getPosition(sym);
      if (long > 0) portfolioValue += long * ns.stock.getBidPrice(sym);
    }
  } catch {}

  const state = falling > rising ? "CRASH EN COURS" : rising > falling ? "Récupération" : "Neutre";
  return { state, rising, falling, portfolioValue };
}
