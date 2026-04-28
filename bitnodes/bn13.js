/**
 * BN13 — They're Lunatics
 * Mécanique clé : Stanek's Gift — placer et charger des fragments pour des bonus massifs
 * Les fragments chargés améliorent hack, combat, argent, etc.
 * Objectif final : backdoor w0r1d_d43m0n
 */
import { launchCore, launchOnce, tryRoot } from "bitnodes/utils.js";

const FINAL = "w0r1d_d43m0n";

// Placement optimal des fragments (ID, row, col, rotation)
// Priorité : fragment 1 (hack multiplier), 6 (hack xp), 5 (money), 25 (booster)
const FRAGMENT_LAYOUT = [
  { id: 1,  row: 0, col: 0, rot: 0 },  // Hacking speed
  { id: 6,  row: 0, col: 3, rot: 0 },  // Hacking XP
  { id: 5,  row: 3, col: 0, rot: 0 },  // Money gain
  { id: 25, row: 3, col: 3, rot: 0 },  // Booster (amplificateur)
  { id: 7,  row: 6, col: 0, rot: 0 },  // Hacking chance
  { id: 28, row: 6, col: 3, rot: 0 },  // Booster 2
];

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.tail();

  // Placer les fragments au démarrage
  placeFragments(ns);

  while (true) {
    const player = ns.getPlayer();
    const hack = player.skills.hacking;

    launchCore(ns, 300);

    // Charger tous les fragments actifs
    await chargeFragments(ns);

    ns.clearLog();
    ns.print("=== BN13 : They're Lunatics ===");
    ns.print(`Hack   : ${hack} / 3000`);
    ns.print(`Money  : $${ns.formatNumber(player.money)}`);

    const frags = ns.stanek.activeFragments();
    ns.print(`Fragments actifs: ${frags.length}`);
    for (const f of frags) {
      ns.print(`  [${f.id}] (${f.x},${f.y}) charge: ${f.numCharge} | bonus: x${f.highestCharge.toFixed(2)}`);
    }

    if (hack >= 3000 && tryRoot(ns, FINAL)) {
      ns.print(`\n>>> Backdoor ${FINAL}...`);
      launchOnce(ns, "auto-backdoor.js");
    }

    await ns.sleep(30_000);
  }
}

/** @param {NS} ns */
function placeFragments(ns) {
  const active = new Set(ns.stanek.activeFragments().map(f => f.id));
  const w = ns.stanek.giftWidth();
  const h = ns.stanek.giftHeight();

  for (const { id, row, col, rot } of FRAGMENT_LAYOUT) {
    if (active.has(id)) continue;
    if (row >= h || col >= w) continue;
    try {
      ns.stanek.placeFragment(row, col, rot, id);
    } catch {
      // Fragment non compatible avec la position — essayer d'autres positions
    }
  }
}

/** @param {NS} ns */
async function chargeFragments(ns) {
  const frags = ns.stanek.activeFragments().filter(f => f.id < 100); // Exclure les boosters
  for (const f of frags) {
    try {
      // Charger plusieurs fois pour maximiser le bonus
      for (let i = 0; i < 10; i++) {
        await ns.stanek.chargeFragment(f.x, f.y);
      }
    } catch {}
  }
}
