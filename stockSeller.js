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

    // Récupère la liste officielle des symboles depuis l'API du jeu.
    // Coûte 2 GB de RAM mais garantit que la liste est toujours correcte.
    const symbols = ns.stock.getSymbols();

    let totalPnl = 0;
    ns.print("=== LIQUIDATION — vente au meilleur taux ===");

    ns.atExit(() => clearOverview());

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
            clearOverview();
            ns.tprint(`SUCCESS Liquidation terminée. PnL total : $${ns.format.number(totalPnl, 2)}`);
            return;
        }

        // Affiche le bilan du cycle uniquement si des ventes ont eu lieu
        if (loopPnl !== 0)
            ns.print(`[PNL] Boucle $${ns.format.number(loopPnl, 2)} | Total $${ns.format.number(totalPnl, 2)}`);

        const remaining = calcRemaining(ns, symbols);
        updateOverview(ns, totalPnl, remaining);

        await ns.sleep(SLEEP_TIME);
    }
}

function calcRemaining(ns, symbols) {
    let total = 0;
    for (const sym of symbols) {
        const [lShares, lAvg, sShares, sAvg] = ns.stock.getPosition(sym);
        if (lShares  > 0) total += (ns.stock.getBidPrice(sym) - lAvg) * lShares;
        if (sShares  > 0) total += (sAvg - ns.stock.getAskPrice(sym)) * sShares;
    }
    return total;
}

function updateOverview(ns, realized, remaining) {
    try {
        const doc   = eval("document");
        const hook0 = doc.getElementById("overview-extra-hook-0");
        const hook1 = doc.getElementById("overview-extra-hook-1");
        if (!hook0 || !hook1) return;
        const color = realized >= 0 ? "#4caf50" : "#f44336";
        hook0.dataset.sellerRealized  = "Liquidation réalisé";
        hook0.dataset.sellerRemaining = "Reste à vendre";
        hook1.dataset.sellerRealized  = `<strong style="color:${color}">$${ns.format.number(realized, 2)}</strong>`;
        hook1.dataset.sellerRemaining = `$${ns.format.number(remaining, 2)}`;
        renderHooks(hook0, hook1);
    } catch (_) {}
}

function clearOverview() {
    try {
        const doc   = eval("document");
        const hook0 = doc.getElementById("overview-extra-hook-0");
        const hook1 = doc.getElementById("overview-extra-hook-1");
        if (!hook0 || !hook1) return;
        for (const k of ["sellerRealized", "sellerRemaining"]) {
            delete hook0.dataset[k];
            delete hook1.dataset[k];
        }
        renderHooks(hook0, hook1);
    } catch (_) {}
}

function renderHooks(hook0, hook1) {
    const keys = Object.keys(hook0.dataset);
    hook0.innerHTML = keys.map(k => hook0.dataset[k]).join("<br>");
    hook1.innerHTML = keys.map(k => hook1.dataset[k] ?? "").join("<br>");
}
