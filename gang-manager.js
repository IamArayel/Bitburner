/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.ui.resizeTail(520, 400);

    // Garder une réserve de cash avant d'acheter de l'équipement
    const KEEP_CASH  = ns.args[0] ?? 1_000_000_000; // défaut $1b, overridable en arg
    const SLEEP_TIME = 10_000;

    if (!ns.gang.inGang()) {
        ns.tprint("[GANG] Pas de gang actif. Arrêt.");
        return;
    }

    // L'équipement disponible ne change jamais en cours de partie → fetch une seule fois
    const allEquip = ns.gang.getEquipmentNames()
        .map(name => ({ name, type: ns.gang.getEquipmentType(name), cost: ns.gang.getEquipmentCost(name) }))
        .sort((a, b) => a.cost - b.cost); // du moins cher au plus cher

    while (true) {
        const members   = ns.gang.getMemberNames();
        const cash      = ns.getServerMoneyAvailable("home");
        let   budget    = Math.max(0, cash - KEEP_CASH);
        let   bought    = 0;
        let   spent     = 0;

        // Pré-fetch des possessions de chaque membre
        const owned = {};
        for (const m of members) {
            const info = ns.gang.getMemberInformation(m);
            owned[m]   = new Set([...info.upgrades, ...info.augmentations]);
        }

        // Acheter du moins cher au plus cher pour maximiser le nombre d'items achetés
        for (const eq of allEquip) {
            if (eq.cost > budget) continue;

            for (const m of members) {
                if (owned[m].has(eq.name)) continue;
                if (eq.cost > budget)      continue;

                if (ns.gang.purchaseEquipment(m, eq.name)) {
                    owned[m].add(eq.name);
                    budget -= eq.cost;
                    spent  += eq.cost;
                    bought++;
                }
            }
        }

        // Coût total restant pour tout équiper tout le monde
        let pendingCost = 0;
        for (const m of members) {
            for (const eq of allEquip) {
                if (!owned[m].has(eq.name)) pendingCost += eq.cost;
            }
        }

        printDashboard(ns, members, owned, allEquip, cash, bought, spent, pendingCost);
        await ns.sleep(SLEEP_TIME);
    }
}

function printDashboard(ns, members, owned, allEquip, cash, bought, spent, pending) {
    ns.clearLog();
    const sep   = "─".repeat(54);
    const time  = new Date().toLocaleTimeString();
    const total = allEquip.length;

    ns.print(sep);
    ns.print(`  GANG MANAGER                        ${time}`);
    ns.print(sep);
    ns.print(`  Cash dispo   : $${ns.format.number(cash, 2)}`);
    if (bought > 0) {
        ns.print(`  Acheté       : ${bought} item(s) (-$${ns.format.number(spent, 2)})`);
    }
    ns.print(`  Reste total  : $${ns.format.number(pending, 2)}`);
    ns.print(sep);
    ns.print(`  MEMBRES (${members.length})`);

    for (const m of members) {
        const count = owned[m].size;
        const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        const bar   = progressBar(pct, 18);
        ns.print(`  ${m.padEnd(18)} ${bar} ${String(pct).padStart(3)}%  (${count}/${total})`);
    }

    // Détail par catégorie pour le premier membre incomplet (aperçu rapide)
    const incomplete = members.find(m => owned[m].size < total);
    if (incomplete) {
        ns.print(sep);
        ns.print(`  PROCHAINS ACHATS (${incomplete})`);
        const missing = allEquip
            .filter(eq => !owned[incomplete].has(eq.name))
            .slice(0, 5); // top 5 les moins chers
        for (const eq of missing) {
            ns.print(`  [${eq.type.padEnd(11)}] ${eq.name.padEnd(24)} $${ns.format.number(eq.cost, 2)}`);
        }
    }

    ns.print(sep);
    ns.ui.setTailTitle(`Gang Manager | Reste: $${ns.format.number(pending, 2)}`);
}

function progressBar(pct, width) {
    const filled = Math.round((pct / 100) * width);
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}
