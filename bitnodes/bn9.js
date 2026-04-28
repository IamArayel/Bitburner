/**
 * BN9 — Hacktocracy
 * Mécanique clé : Hacknet Servers (pas de nœuds classiques)
 * Génèrent des hashes → convertis en argent, XP, réductions
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";
const MAX_NODES = 12;
const HASH_TO_MONEY = "Sell for Money";         // 4 hashes = $1M
const HASH_TO_CORP_FUNDS = "Sell for Corporation Funds";
const HASH_TO_REDUCE_MINISEC = "Reduce Minimum Security";
const HASH_TO_INCREASE_MAXMONEY = "Increase Maximum Money";

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;
    const money = player.money;

    launchCore(ns, 300);

    // --- Hacknet Servers ---
    manageHacknet(ns, money);

    // Dépenser les hashes accumulés
    spendHashes(ns);

    ns.clearLog();
    ns.print("=== BN9 : Hacktocracy ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.formatNumber(money)}`);

    const nodeCount = ns.hacknet.numNodes();
    ns.print(`Nodes  : ${nodeCount} / ${MAX_NODES}`);

    if (nodeCount > 0) {
      const stats = ns.hacknet.getNodeStats(0);
      ns.print(`Hashes : ${ns.formatNumber(ns.hacknet.numHashes())} / ${ns.formatNumber(ns.hacknet.hashCapacity())}`);
      ns.print(`Gain   : ${ns.formatNumber(totalHashGain(ns))} h/s`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(20_000);
  }
}

/** @param {NS} ns @param {number} money */
function manageHacknet(ns, money) {
  const count = ns.hacknet.numNodes();

  // Acheter un nouveau nœud si possible
  if (count < MAX_NODES) {
    const cost = ns.hacknet.getPurchaseNodeCost();
    if (money > cost * 2) {
      ns.hacknet.purchaseNode();
      return;
    }
  }

  if (count === 0) return;

  // Trouver le nœud avec le coût d'upgrade le plus faible
  let bestIdx = -1;
  let bestCost = Infinity;

  for (let i = 0; i < count; i++) {
    const stats = ns.hacknet.getNodeStats(i);
    // Niveau en priorité, puis RAM, puis cœurs
    const costs = [
      ns.hacknet.getLevelUpgradeCost(i, 5),
      ns.hacknet.getRamUpgradeCost(i, 1),
      ns.hacknet.getCoreUpgradeCost(i, 1),
    ];
    const min = Math.min(...costs);
    if (min < bestCost) { bestCost = min; bestIdx = i; }
  }

  if (bestIdx >= 0 && money > bestCost * 3) {
    const stats = ns.hacknet.getNodeStats(bestIdx);
    if (ns.hacknet.getLevelUpgradeCost(bestIdx, 5) === bestCost) {
      ns.hacknet.upgradeLevel(bestIdx, 5);
    } else if (ns.hacknet.getRamUpgradeCost(bestIdx, 1) === bestCost) {
      ns.hacknet.upgradeRam(bestIdx, 1);
    } else {
      ns.hacknet.upgradeCore(bestIdx, 1);
    }
  }

  // Upgrade cache si proche de la capacité max
  const hashRatio = ns.hacknet.numHashes() / ns.hacknet.hashCapacity();
  if (hashRatio > 0.8) {
    for (let i = 0; i < count; i++) {
      try {
        const cacheCost = ns.hacknet.getCacheUpgradeCost(i, 1);
        if (money > cacheCost) { ns.hacknet.upgradeCache(i, 1); break; }
      } catch {}
    }
  }
}

/** @param {NS} ns */
function spendHashes(ns) {
  const hashes = ns.hacknet.numHashes();
  const moneyCost = ns.hacknet.hashCost(HASH_TO_MONEY);

  // Vendre les hashes excédentaires en argent (>50% de capacité)
  if (hashes > ns.hacknet.hashCapacity() * 0.5 && hashes >= moneyCost) {
    const times = Math.floor(hashes / moneyCost);
    for (let i = 0; i < times; i++) {
      try { ns.hacknet.spendHashes(HASH_TO_MONEY); } catch { break; }
    }
  }
}

/** @param {NS} ns @returns {number} */
function totalHashGain(ns) {
  let total = 0;
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    total += ns.hacknet.getNodeStats(i).production;
  }
  return total;
}
