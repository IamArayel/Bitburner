/** @param {NS} ns **/
export async function main(ns) {
    ns.tail();

    const COMMISSION                 = 100_000;
    const KEEP_CASH                  = 100_000;
    const SLEEP_TIME                 = 6000;
    const LONG_BUY_FORECAST          = 0.60;
    const LONG_SELL_FORECAST         = 0.55;
    const SHORT_OPEN_FORECAST        = 0.40;
    const SHORT_CLOSE_FORECAST       = 0.45;
    const SHORT_MAX_OF_MAXSHARES     = 0.02;
    const SHORT_MAX_PORTFOLIO_RATIO  = 0.10;
    const SHORT_MAX_LOSS_RATIO       = 0.05;

    const symbols = ns.stock.getSymbols();
    const canShort =
        typeof ns.stock.shortStock === "function" &&
        typeof ns.stock.sellShort  === "function";

    ns.ui.resizeTail(480, 420);

    let totalPnl = 0;
    ns.atExit(() => {
        ns.tprint(`[STOCK] PnL total réalisé : $${ns.formatNumber(totalPnl, 2)}`);
        clearOverview();
    });

    while (true) {
        // Pré-fetch unique par tick : évite de rappeler les mêmes getters
        // dans chaque sous-fonction (~467 → ~200 appels NS par boucle).
        const cash = ns.getServerMoneyAvailable("home");
        const data = {};
        for (const sym of symbols) {
            data[sym] = {
                pos:       ns.stock.getPosition(sym),
                forecast:  ns.stock.getForecast(sym),
                vol:       ns.stock.getVolatility(sym),
                maxShares: ns.stock.getMaxShares(sym),
                ask:       ns.stock.getAskPrice(sym),
                bid:       ns.stock.getBidPrice(sym),
            };
        }

        let loopPnl = 0;
        loopPnl += sellBadLongs(ns, symbols, data, COMMISSION, LONG_SELL_FORECAST);
        if (canShort) {
            loopPnl += sellBadShorts(ns, symbols, data, COMMISSION, SHORT_CLOSE_FORECAST, SHORT_MAX_LOSS_RATIO);
        }
        buyBestLong(ns, symbols, data, cash, COMMISSION, LONG_BUY_FORECAST, KEEP_CASH);
        if (canShort) {
            openBestShort(ns, symbols, data, cash, COMMISSION, SHORT_OPEN_FORECAST, KEEP_CASH, SHORT_MAX_OF_MAXSHARES, SHORT_MAX_PORTFOLIO_RATIO);
        }

        totalPnl += loopPnl;

        const unrealized = calcUnrealized(symbols, data);
        printDashboard(ns, symbols, data, totalPnl, unrealized, loopPnl);
        updateOverview(ns, totalPnl, unrealized);

        await ns.sleep(SLEEP_TIME);
    }
}

function sellBadLongs(ns, symbols, data, commission, sellForecast) {
    let pnl = 0;
    for (const sym of symbols) {
        const { pos, forecast, bid } = data[sym];
        const [longShares, longAvg] = pos;
        if (longShares <= 0) continue;
        if (forecast >= sellForecast) continue;

        const cost          = longAvg * longShares;
        const potentialProfit = bid * longShares - cost;
        const minProfit     = 2 * commission;

        if (potentialProfit > minProfit) {
            const execPrice = ns.stock.sellStock(sym, longShares);
            if (execPrice > 0) {
                const realized = execPrice * longShares - cost - minProfit;
                pnl += realized;
                ns.print(
                    `SELL LONG ${sym} | qté=${longShares} | PnL=$${ns.formatNumber(realized, 2)} (${((realized / cost) * 100).toFixed(2)}%)`
                );
            }
        } else {
            ns.print(`HOLD LONG ${sym} | forecast=${forecast.toFixed(3)} profit insuffisant pour couvrir la commission`);
        }
    }
    return pnl;
}

function sellBadShorts(ns, symbols, data, commission, closeForecast, maxLossRatio) {
    let pnl = 0;
    for (const sym of symbols) {
        const { pos, forecast, ask } = data[sym];
        const shortShares    = pos[2];
        const shortAvgPrice  = pos[3];
        if (shortShares <= 0) continue;

        const unrealized = (shortAvgPrice - ask) * shortShares;
        const notional   = shortAvgPrice * shortShares;
        const lossRatio  = unrealized < 0 ? Math.abs(unrealized) / notional : 0;

        if (forecast > closeForecast || lossRatio > maxLossRatio) {
            const execPrice = ns.stock.sellShort(sym, shortShares);
            if (execPrice > 0) {
                const realized = (shortAvgPrice - execPrice) * shortShares - 2 * commission;
                pnl += realized;
                ns.print(
                    `CLOSE SHORT ${sym} | qté=${shortShares} | PnL=$${ns.formatNumber(realized, 2)} (${((realized / notional) * 100).toFixed(2)}%)`
                );
            }
        }
    }
    return pnl;
}

function buyBestLong(ns, symbols, data, cash, commission, minForecast, cashToKeep) {
    const investable = cash - cashToKeep;
    if (investable <= commission) return;

    let bestSym = null, bestScore = -Infinity, bestMaxShares = 0;
    for (const sym of symbols) {
        const { pos, forecast, vol, maxShares } = data[sym];
        if (pos[0] > 0.5 * maxShares) continue;
        if (forecast < minForecast) continue;
        const score = vol * 2 * (forecast - 0.5);
        if (score > bestScore) {
            bestScore = score; bestSym = sym; bestMaxShares = maxShares;
        }
    }

    if (!bestSym) return;
    const qty = Math.min(Math.floor((investable - commission) / data[bestSym].ask), bestMaxShares);
    if (qty <= 0) return;

    const execPrice = ns.stock.buyStock(bestSym, qty);
    if (execPrice > 0) {
        ns.print(`BUY LONG ${bestSym} | qté=${qty} | coût≈$${ns.formatNumber(execPrice * qty + commission, 2)}`);
    }
}

function openBestShort(ns, symbols, data, cash, commission, maxForecast, cashToKeep, maxOfMaxShares, portfolioRatio) {
    let bestSym = null, bestScore = -Infinity, bestMaxShares = 0;
    for (const sym of symbols) {
        const { pos, forecast, vol, maxShares } = data[sym];
        if (pos[2] > 0.5 * maxShares) continue;
        if (forecast > maxForecast) continue;
        const score = vol * 2 * (0.5 - forecast);
        if (score > bestScore) {
            bestScore = score; bestSym = sym; bestMaxShares = maxShares;
        }
    }

    if (!bestSym) return;
    const investable = Math.max(0, cash - cashToKeep);
    const qty = Math.min(
        Math.floor(bestMaxShares * maxOfMaxShares),
        Math.floor(investable * portfolioRatio / data[bestSym].bid)
    );
    if (qty <= 0) return;

    const execPrice = ns.stock.shortStock(bestSym, qty);
    if (execPrice > 0) {
        ns.print(`OPEN SHORT ${bestSym} | qté=${qty} | prix≈$${ns.formatNumber(execPrice, 2)}`);
    }
}

// ─── Affichage ────────────────────────────────────────────────────────────────

function calcUnrealized(symbols, data) {
    let total = 0;
    for (const sym of symbols) {
        const [longShares, longAvg, shortShares, shortAvg] = data[sym].pos;
        if (longShares  > 0) total += (data[sym].bid - longAvg)  * longShares;
        if (shortShares > 0) total += (shortAvg - data[sym].ask) * shortShares;
    }
    return total;
}

function fmt(ns, n) {
    const s = ns.formatNumber(n, 2);
    return (n >= 0 ? "+" : "") + "$" + s;
}

function printDashboard(ns, symbols, data, realized, unrealized, loopPnl) {
    ns.clearLog();
    const total = realized + unrealized;
    const sep   = "─".repeat(52);
    const time  = new Date().toLocaleTimeString();

    ns.print(`${sep}`);
    ns.print(`  STOCK TRADER                         ${time}`);
    ns.print(`${sep}`);
    ns.print(`  PnL réalisé  ${fmt(ns, realized).padStart(14)}  (boucle: ${fmt(ns, loopPnl)})`);
    ns.print(`  PnL latent   ${fmt(ns, unrealized).padStart(14)}`);
    ns.print(`  PnL total    ${fmt(ns, total).padStart(14)}`);

    let hasPos = false;
    for (const sym of symbols) {
        const { pos, bid, ask, forecast } = data[sym];
        const [lShares, lAvg, sShares, sAvg] = pos;

        if (lShares > 0) {
            if (!hasPos) { ns.print(`${sep}`); ns.print(`  POSITIONS`); }
            hasPos = true;
            const pnl = (bid - lAvg) * lShares;
            const pct = ((bid / lAvg - 1) * 100).toFixed(1);
            ns.print(`  LONG  ${sym.padEnd(5)} f=${forecast.toFixed(3)}  ${fmt(ns, pnl).padStart(12)}  (${pct}%)`);
        }
        if (sShares > 0) {
            if (!hasPos) { ns.print(`${sep}`); ns.print(`  POSITIONS`); }
            hasPos = true;
            const pnl = (sAvg - ask) * sShares;
            const pct = ((sAvg / ask - 1) * 100).toFixed(1);
            ns.print(`  SHORT ${sym.padEnd(5)} f=${forecast.toFixed(3)}  ${fmt(ns, pnl).padStart(12)}  (${pct}%)`);
        }
    }
    if (!hasPos) { ns.print(`${sep}`); ns.print(`  Aucune position ouverte.`); }
    ns.print(`${sep}`);

    ns.ui.setTailTitle(`Stock Trader | Total: ${fmt(ns, total)}`);
}

function updateOverview(ns, realized, unrealized) {
    try {
        const doc   = eval("document");
        const hook0 = doc.getElementById("overview-extra-hook-0");
        const hook1 = doc.getElementById("overview-extra-hook-1");
        if (!hook0 || !hook1) return;
        const total = realized + unrealized;
        const color = total >= 0 ? "#4caf50" : "#f44336";
        hook0.innerHTML = "Stock réalisé<br>Stock latent<br>Stock total";
        hook1.innerHTML = [
            `$${ns.formatNumber(realized, 2)}`,
            `$${ns.formatNumber(unrealized, 2)}`,
            `<strong style="color:${color}">$${ns.formatNumber(total, 2)}</strong>`,
        ].join("<br>");
    } catch (_) {}
}

function clearOverview() {
    try {
        const doc = eval("document");
        const h0  = doc.getElementById("overview-extra-hook-0");
        const h1  = doc.getElementById("overview-extra-hook-1");
        if (h0) h0.innerHTML = "";
        if (h1) h1.innerHTML = "";
    } catch (_) {}
}
