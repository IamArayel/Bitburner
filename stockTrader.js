/** @param {NS} ns **/
export async function main(ns) {
    ns.tail();
    try { ns.setAutoSchedule(false); } catch (_) {}

    // ===== Paramètres généraux =====
    const COMMISSION = 100_000;           // commission par ordre (aller)
    //const KEEP_CASH = 30_000_000_000;  // garder "juste" $30b sur le compte
    //const KEEP_CASH = 100_000_000;         // garder $100m sur le compte
    const KEEP_CASH = 100_000;         // garder $100k sur le compte
    const SLEEP_TIME = 6000;              // tick bourse ~6s

    // ===== Paramètres LONG =====
    const LONG_BUY_FORECAST  = 0.60;      // on achète si forecast >= 0.60
    const LONG_SELL_FORECAST = 0.55;      // on vend si forecast < 0.55

    // ===== Paramètres SHORT =====
    const SHORT_OPEN_FORECAST  = 0.40;    // on ouvre un short si forecast <= 0.40
    const SHORT_CLOSE_FORECAST = 0.45;    // on ferme le short si forecast > 0.45
    const SHORT_MAX_OF_MAXSHARES = 0.02;  // ne pas short plus de 2% du maxShares
    const SHORT_MAX_PORTFOLIO_RATIO = 0.10; // max 10% du cash dispo dans un short
    const SHORT_MAX_LOSS_RATIO = 0.05;    // si le short perd >5% du notionnel -> on ferme

    const symbols = ns.stock.getSymbols();
    const canShort =
        typeof ns.stock.shortStock === "function" &&
        typeof ns.stock.sellShort === "function";

    let totalPnl = 0;

    // récapitulatif à l'arrêt
    ns.atExit(() => {
        ns.tprint(`[STOCK] PnL total réalisé : $${ns.formatNumber(totalPnl, 2)}`);
    });

    while (true) {
        let loopPnl = 0;

        // 1) fermer ce qui n'est plus bon
        loopPnl += sellBadLongs(ns, symbols, COMMISSION, LONG_SELL_FORECAST);
        if (canShort) {
            loopPnl += sellBadShorts(
                ns,
                symbols,
                COMMISSION,
                SHORT_CLOSE_FORECAST,
                SHORT_MAX_LOSS_RATIO
            );
        }

        // 2) ouvrir / renforcer
        await buyBestLong(ns, symbols, COMMISSION, LONG_BUY_FORECAST, KEEP_CASH);
        if (canShort) {
            await openBestShort(
                ns,
                symbols,
                COMMISSION,
                SHORT_OPEN_FORECAST,
                KEEP_CASH,
                SHORT_MAX_OF_MAXSHARES,
                SHORT_MAX_PORTFOLIO_RATIO
            );
        }

        totalPnl += loopPnl;
        ns.print(
            `[PNL] boucle: $${ns.formatNumber(loopPnl, 2)} | total: $${ns.formatNumber(totalPnl, 2)}`
        );

        await ns.sleep(SLEEP_TIME);
    }
}

/**
 * Ferme les positions LONG dont le forecast est passé sous le seuil.
 * Retourne le PnL réalisé.
 */
function sellBadLongs(ns, symbols, commission, sellForecast) {
    let pnl = 0;

    for (const sym of symbols) {
        const [longShares, longAvg] = ns.stock.getPosition(sym);
        if (longShares <= 0) continue;

        const forecast = ns.stock.getForecast(sym);
        if (forecast >= sellForecast) continue;

        // on regarde si ça vaut le coup
        const bid = ns.stock.getBidPrice(sym);
        const gross = bid * longShares;
        const cost = longAvg * longShares;
        const minProfit = 2 * commission;
        const potentialProfit = gross - cost;

        if (potentialProfit > minProfit) {
            const execPrice = ns.stock.sellStock(sym, longShares);
            if (execPrice > 0) {
                const realGross = execPrice * longShares;
                const realized = realGross - cost - minProfit;
                pnl += realized;

                const pct = (realized / cost) * 100;
                ns.print(
                    `SELL LONG ${sym} | qté=${longShares} | PnL=$${ns.formatNumber(
                        realized,
                        2
                    )} (${pct.toFixed(2)}%)`
                );
            }
        } else {
            ns.print(
                `HOLD LONG ${sym} | forecast=${forecast.toFixed(
                    3
                )} mais profit insuffisant pour couvrir la commission`
            );
        }
    }

    return pnl;
}

/**
 * Ferme les positions SHORT soit parce que le forecast remonte,
 * soit parce qu'on dépasse la perte max autorisée.
 * Retourne le PnL réalisé.
 */
function sellBadShorts(ns, symbols, commission, closeForecast, maxLossRatio) {
    let pnl = 0;

    for (const sym of symbols) {
        const pos = ns.stock.getPosition(sym);
        const shortShares = pos[2];
        const shortAvgPrice = pos[3];
        if (shortShares <= 0) continue;

        const forecast = ns.stock.getForecast(sym);
        const ask = ns.stock.getAskPrice(sym); // prix pour racheter le short

        // perte latente actuelle
        // si le prix actuel (ask) > prix d'ouverture, on perd
        const unrealized = (shortAvgPrice - ask) * shortShares; // peut être négatif
        const notional = shortAvgPrice * shortShares;
        const lossRatio = unrealized < 0 ? Math.abs(unrealized) / notional : 0;

        const shouldCloseByForecast = forecast > closeForecast;
        const shouldCloseByLoss = lossRatio > maxLossRatio;

        if (shouldCloseByForecast || shouldCloseByLoss) {
            const execPrice = ns.stock.sellShort(sym, shortShares);
            if (execPrice > 0) {
                // PnL short = (prix_open - prix_close) * qté - 2 commissions
                const gross = (shortAvgPrice - execPrice) * shortShares;
                const realized = gross - 2 * commission;
                pnl += realized;

                const pct = (realized / notional) * 100;
                ns.print(
                    `CLOSE SHORT ${sym} | qté=${shortShares} | PnL=$${ns.formatNumber(
                        realized,
                        2
                    )} (${pct.toFixed(2)}%)`
                );
            }
        }
    }

    return pnl;
}

/**
 * Ouvre/renforce le meilleur LONG (forecast haut + vol).
 */
async function buyBestLong(ns, symbols, commission, minForecast, cashToKeep) {
    const cash = ns.getServerMoneyAvailable("home");
    const investable = cash - cashToKeep;
    if (investable <= commission) return;

    let bestSym = null;
    let bestScore = -Infinity;

    for (const sym of symbols) {
        const [longShares] = ns.stock.getPosition(sym);
        const maxShares = ns.stock.getMaxShares(sym);
        if (longShares > 0.5 * maxShares) continue; // pas sur-exposé

        const forecast = ns.stock.getForecast(sym);
        if (forecast < minForecast) continue;

        const vol = ns.stock.getVolatility(sym);
        const prob = 2 * (forecast - 0.5);
        const expected = vol * prob;

        if (expected > bestScore) {
            bestScore = expected;
            bestSym = sym;
        }
    }

    if (!bestSym) return;

    const ask = ns.stock.getAskPrice(bestSym);
    const maxSpend = investable - commission;
    const toBuy = Math.floor(maxSpend / ask);
    if (toBuy <= 0) return;

    const maxShares = ns.stock.getMaxShares(bestSym);
    const realQty = Math.min(toBuy, maxShares);
    const execPrice = ns.stock.buyStock(bestSym, realQty);
    if (execPrice > 0) {
        const total = execPrice * realQty + commission;
        ns.print(
            `BUY LONG ${bestSym} | qté=${realQty} | coût≈$${ns.formatNumber(total, 2)}`
        );
    }
}

/**
 * Ouvre un SHORT raisonnable (capé) sur la valeur la plus baissière.
 */
async function openBestShort(
    ns,
    symbols,
    commission,
    maxForecastToShort,
    cashToKeep,
    maxOfMaxShares,
    portfolioRatio
) {
    let bestSym = null;
    let bestScore = -Infinity;

    for (const sym of symbols) {
        const pos = ns.stock.getPosition(sym);
        const shortShares = pos[2];
        const maxShares = ns.stock.getMaxShares(sym);

        // pas plus de 50% déjà shorté
        if (shortShares > 0.5 * maxShares) continue;

        const forecast = ns.stock.getForecast(sym);
        if (forecast > maxForecastToShort) continue;

        const vol = ns.stock.getVolatility(sym);
        const probDown = 2 * (0.5 - forecast);
        const expected = vol * probDown;

        if (expected > bestScore) {
            bestScore = expected;
            bestSym = sym;
        }
    }

    if (!bestSym) return;

    const maxShares = ns.stock.getMaxShares(bestSym);
    const price = ns.stock.getBidPrice(bestSym);

    // 1) cap en % du maxShares
    const capByPercent = Math.floor(maxShares * maxOfMaxShares);

    // 2) cap par “budget” théorique (même si le short n’a pas besoin de cash)
    const cash = ns.getServerMoneyAvailable("home");
    const investable = Math.max(0, cash - cashToKeep);
    const budget = investable * portfolioRatio;
    const capByBudget = Math.floor(budget / price);

    const qty = Math.min(capByPercent, capByBudget);
    if (qty <= 0) return;

    const execPrice = ns.stock.shortStock(bestSym, qty);
    if (execPrice > 0) {
        ns.print(
            `OPEN SHORT ${bestSym} | qté=${qty} | prix≈$${ns.formatNumber(execPrice, 2)}`
        );
    }
}
