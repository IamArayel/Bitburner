/** @param {NS} ns **/
export async function main(ns) {
    const symbols = ns.stock.getSymbols();
    let totalPnl = 0;

    for (const sym of symbols) {
        const [longShares, longAvg, shortShares, shortAvg] = ns.stock.getPosition(sym);

        // Fermer LONG
        if (longShares > 0) {
            const exec = ns.stock.sellStock(sym, longShares);
            if (exec > 0) {
                const gross = exec * longShares;
                const cost  = longAvg * longShares;
                const pnl   = gross - cost - 200_000; // 2 commissions approximatives
                totalPnl += pnl;
                ns.tprint(`CLOSE LONG ${sym} | PnL ≈ $${ns.format.number(pnl, 2)}`);
            }
        }

        // Fermer SHORT
        if (shortShares > 0) {
            const exec = ns.stock.sellShort(sym, shortShares);
            if (exec > 0) {
                // pour un short : (prix_ouverture - prix_fermeture) * qté
                const gross = (shortAvg - exec) * shortShares;
                const pnl   = gross - 200_000; // 2 commissions approximatives
                totalPnl += pnl;
                ns.tprint(`CLOSE SHORT ${sym} | PnL ≈ $${ns.format.number(pnl, 2)}`);
            }
        }
    }

    ns.tprint(`=== RÉCAP RESET BOURSE ===`);
    ns.tprint(`PnL total réalisé sur fermeture forcée : $${ns.format.number(totalPnl, 2)}`);
}
