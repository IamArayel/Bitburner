/** @param {NS} ns **/
export async function main(ns) {
    ns.ui.openTail();

    // Commission facturée par ordre (achat OU vente) ; on compte x2 par position
    // car chaque position a été ouverte (achat) et sera fermée (vente) = 2 ordres
    const COMMISSION = 100_000;

    // Durée d'attente entre chaque cycle : le marché Bitburner tick toutes les ~6 s
    const SLEEP_TIME = 6000;

    // Seuil de forecast en dessous duquel on vend une position LONG :
    // forecast < 0.5 signifie que le prix a plus de chances de baisser que de monter,
    // inutile de conserver la position plus longtemps
    const LONG_EXIT  = 0.50;

    // Seuil de forecast au-dessus duquel on ferme une position SHORT :
    // forecast > 0.5 signifie que le prix a plus de chances de monter,
    // ce qui jouerait contre notre short
    const SHORT_EXIT = 0.50;

    // Liste codée en dur pour éviter ns.stock.getSymbols() qui coûte 2 GB de RAM.
    // Les symboles sont fixes dans Bitburner, donc cette liste ne change jamais.
    const symbols = [
        "ECP","MGCP","BLD","CLRK","OMTK","FSIG","KGI","FLCM","STM","DCOMM",
        "HLS","VITA","ICRS","UNL","AERO","OMN","SLRS","GPH","NVMD","WDS",
        "LXO","RHOC","APHE","SYSC","CTK","NTLK","OMGA","FNS","SGC"
    ];

    // Accumule le profit/perte réalisé sur toute la session
    let totalPnl = 0;
    ns.print("=== LIQUIDATION — vente au meilleur taux ===");

    while (true) {
        // Nombre de positions encore ouvertes ce cycle
        let holdings = 0;
        // Profit/perte réalisé pendant ce seul cycle (pour le log de fin de boucle)
        let loopPnl  = 0;

        for (const sym of symbols) {
            // getPosition retourne [longShares, longAvgPrice, shortShares, shortAvgPrice]
            const [longShares, longAvg, shortShares, shortAvg] = ns.stock.getPosition(sym);

            // Aucune position sur ce titre : on passe au suivant
            if (longShares === 0 && shortShares === 0) continue;
            holdings++;

            // forecast ∈ [0, 1] : probabilité que le prix monte au prochain tick
            const forecast = ns.stock.getForecast(sym);

            // --- Position LONG ---
            // On vend dès que la tendance passe baissière (forecast < 50 %)
            // pour éviter de perdre des gains accumulés
            if (longShares > 0 && forecast < LONG_EXIT) {
                const price = ns.stock.sellStock(sym, longShares);
                if (price > 0) {
                    // Profit = (prix de vente − prix d'achat moyen) × quantité − commissions
                    const pnl = (price - longAvg) * longShares - 2 * COMMISSION;
                    loopPnl += pnl; totalPnl += pnl;
                    ns.print(`SELL LONG  ${sym} | ${ns.format.number(longShares)} | PnL $${ns.format.number(pnl, 2)}`);
                }
            }

            // --- Position SHORT ---
            // On ferme dès que la tendance redevient haussière (forecast > 50 %)
            // car un short perd de la valeur quand le prix monte
            if (shortShares > 0 && forecast > SHORT_EXIT) {
                const price = ns.stock.sellShort(sym, shortShares);
                if (price > 0) {
                    // Profit = (prix d'ouverture du short − prix de clôture) × quantité − commissions
                    const pnl = (shortAvg - price) * shortShares - 2 * COMMISSION;
                    loopPnl += pnl; totalPnl += pnl;
                    ns.print(`CLOSE SHORT ${sym} | ${ns.format.number(shortShares)} | PnL $${ns.format.number(pnl, 2)}`);
                }
            }
        }

        // Plus aucune position ouverte : la liquidation est terminée, on quitte
        if (holdings === 0) {
            ns.tprint(`SUCCESS Liquidation terminée. PnL total : $${ns.format.number(totalPnl, 2)}`);
            return;
        }

        // Affiche le bilan du cycle uniquement si des ventes ont eu lieu
        if (loopPnl !== 0)
            ns.print(`[PNL] Boucle $${ns.format.number(loopPnl, 2)} | Total $${ns.format.number(totalPnl, 2)}`);

        await ns.sleep(SLEEP_TIME);
    }
}
