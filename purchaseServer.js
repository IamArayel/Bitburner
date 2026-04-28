/** @param {NS} ns */
export async function main(ns) {
  // ns.purchaseServer("$Pi", 1024); // buy server
  ns.upgradePurchasedServer("$Pi", (1024*2));
}