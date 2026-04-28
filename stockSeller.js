/** @param {NS} ns **/
export async function main(ns) {
    ns.tail();
    try { ns.setAutoSchedule(false); } catch (_) {}

    // ===== Paramètres généraux =====
    const COMMISSION = 100_000;           // commission par ordre (aller)
    //const KEEP_CASH = 30_000_000_000;  // garder "juste" $30b sur le compte
    const KEEP_CASH = 100_000_000;        // garder $100m sur le compte
    //const KEEP_CASH = 100_000;         // garder $100k sur le compte
    const SLEEP_TIME = 6000;              // tick bourse ~6s

    // ===== Paramètres LONG =====
    // NOTE: Pour la liquidation, on vend dès que les chances passent sous 50%
    const LONG_EXIT_THRESHOLD = 0.50;

    // ===== Paramètres SHORT =====
    // NOTE: Pour la liquidation, on ferme dès que les chances montent au-dessus de 50%
    const SHORT_EXIT_THRESHOLD = 0.50;

    const symbols = ns.stock.getSymbols();
    let totalPnl = 0;

    ns.print("=== MODE LIQUIDATION OPTIMISÉE ACTIVÉ ===");
    ns.print("Vente au meilleur taux (Forecast flip). Pas de nouveaux achats.");

    // Récapitulatif à l'arrêt
    ns.atExit(() => {
        ns.tprint(`[STOCK] Fin de liquidation. PnL réalisé cette session : $${ns.formatNumber(totalPnl, 2)}`);
    });

    while (true) {
        let holdings = 0;
        let loopPnl = 0;

        // On parcourt tous les symboles pour gérer les positions existantes
        for (const sym of symbols) {
            const pos = ns.stock.getPosition(sym);
            const longShares = pos[0];
            const longAvg = pos[1];
            const shortShares = pos[2];
            const shortAvg = pos[3];

            // Si on ne détient rien sur ce titre, on passe
            if (longShares === 0 && shortShares === 0) continue;

            holdings++; // On compte le nombre de positions actives
            const forecast = ns.stock.getForecast(sym);

            // --- Gestion LONG ---
            if (longShares > 0) {
                // On garde tant que c'est >= 0.5 (tendance haussière ou neutre)
                // On vend si < 0.5 (tendance baissière)
                if (forecast < LONG_EXIT_THRESHOLD) {
                    const sellPrice = ns.stock.sellStock(sym, longShares);
                    if (sellPrice > 0) {
                        const profit = (sellPrice * longShares) - (longAvg * longShares) - (2 * COMMISSION);
                        loopPnl += profit;
                        totalPnl += profit;
                        logTransaction(ns, "SELL LONG", sym, longShares, profit);
                    }
                } else {
                    // Optionnel : Afficher qu'on garde pour maximiser le gain
                    // ns.print(`HOLD LONG ${sym} (${ns.formatNumber(longShares)}) - Forecast: ${forecast.toFixed(3)}`);
                }
            }

            // --- Gestion SHORT ---
            if (shortShares > 0) {
                // On garde tant que c'est <= 0.5 (tendance baissière ou neutre)
                // On ferme si > 0.5 (tendance haussière)
                if (forecast > SHORT_EXIT_THRESHOLD) {
                    const sellPrice = ns.stock.sellShort(sym, shortShares);
                    if (sellPrice > 0) {
                        const profit = (shortAvg * shortShares) - (sellPrice * shortShares) - (2 * COMMISSION);
                        loopPnl += profit;
                        totalPnl += profit;
                        logTransaction(ns, "CLOSE SHORT", sym, shortShares, profit);
                    }
                }
            }
        }

        // Si aucune position n'a été trouvée dans la boucle, on a fini.
        if (holdings === 0) {
            ns.tprint("SUCCESS: Toutes les positions ont été liquidées au meilleur taux.");
            return; // Fin du script
        }

        if (loopPnl !== 0) {
            ns.print(`[PNL] Boucle: $${ns.formatNumber(loopPnl, 2)} | Total: $${ns.formatNumber(totalPnl, 2)}`);
        }

        await ns.sleep(SLEEP_TIME);
    }
}

/**
 * Helper pour l'affichage des logs
 */
function logTransaction(ns, type, sym, shares, profit) {
    const color = profit >= 0 ? "INFO" : "WARN";
    ns.print(`${type} ${sym} | Qté: ${ns.formatNumber(shares)} | PnL: $${ns.formatNumber(profit, 2)}`);
    if (profit > 0) {
        ns.toast(`${type} ${sym}: +$${ns.formatNumber(profit, 2)}`, "success", 4000);
    }
}