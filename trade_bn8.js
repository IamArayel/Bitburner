/**
 * trade_bn8.js — Trading boursier sans 4S Market Data / 4S TIX API.
 *
 * BN8 (Ghost of Wall Street) bloque les revenus passifs à 0 : la bourse est
 * la seule source d'argent. Avant d'avoir les $25B du 4S Market Data, les
 * fonctions ns.stock.getForecast() et ns.stock.getVolatility() sont
 * indisponibles (accès TIX seul). On reconstruit donc nos propres
 * estimations à partir de l'historique de prix observé (ask/bid), technique
 * éprouvée par la communauté (cf. stratégies "no 4S" du subreddit r/Bitburner
 * et du script stockHist.js/stockBB2.js) :
 *   - "forecast" estimé = proportion de hausses sur les derniers ticks
 *   - "volatilité" estimée = écart-type des variations de prix par tick
 * Contrairement à une liste de volatilités codée en dur depuis le code
 * source du jeu (fragile d'une version à l'autre), l'estimation empirique
 * s'adapte automatiquement à la version installée.
 * L'historique est persisté sur disque pour survivre à un redémarrage du script.
 */

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    const COMMISSION        = 100_000;
    const SLEEP_TIME         = 6000;
    const HISTORY_FILE       = "data/stock_history_bn8.txt";
    const HISTORY_LEN        = 40;   // ~4 min de données à 6s/tick
    const MIN_SAMPLES        = 15;   // nb mini de ticks avant de faire confiance à l'estimation
    const KEEP_CASH_RATIO    = 0.10; // 10% de cash toujours gardé en réserve
    const MAX_POSITIONS      = 6;    // diversification : une estimation "maison" est plus bruitée qu'un vrai forecast

    const LONG_BUY_FORECAST  = 0.62;
    const LONG_SELL_FORECAST = 0.54;
    const SHORT_OPEN_FORECAST  = 0.38;
    const SHORT_CLOSE_FORECAST = 0.46;

    const symbols = ns.stock.getSymbols();
    const canShort = hasShortAccess(ns);

    ns.ui.resizeTail(520, 460);

    const history = loadHistory(ns, HISTORY_FILE, symbols);

    let totalPnl = 0;
    ns.atExit(() => {
        saveHistory(ns, HISTORY_FILE, history);
        ns.tprint(`[TRADE_BN8] PnL total réalisé : $${ns.format.number(totalPnl, 2)}`);
        clearOverview();
    });

    while (true) {
        const cash = ns.getServerMoneyAvailable("home");
        const data = {};

        for (const sym of symbols) {
            const ask = ns.stock.getAskPrice(sym);
            const bid = ns.stock.getBidPrice(sym);
            const mid = (ask + bid) / 2;

            const hist = history[sym];
            hist.push(mid);
            if (hist.length > HISTORY_LEN) hist.shift();

            const { forecast, vol, samples } = estimate(hist);

            data[sym] = {
                pos: ns.stock.getPosition(sym),
                maxShares: ns.stock.getMaxShares(sym),
                ask, bid, forecast, vol, samples,
            };
        }

        let loopPnl = 0;
        loopPnl += sellBadLongs(ns, symbols, data, COMMISSION, LONG_SELL_FORECAST, MIN_SAMPLES);
        if (canShort) {
            loopPnl += sellBadShorts(ns, symbols, data, COMMISSION, SHORT_CLOSE_FORECAST, MIN_SAMPLES);
        }

        const keepCash = Math.max(1_000_000, cash * KEEP_CASH_RATIO);
        buyBestLongs(ns, symbols, data, cash, COMMISSION, LONG_BUY_FORECAST, keepCash, MAX_POSITIONS, MIN_SAMPLES);
        if (canShort) {
            openBestShorts(ns, symbols, data, cash, COMMISSION, SHORT_OPEN_FORECAST, keepCash, MAX_POSITIONS, MIN_SAMPLES);
        }

        totalPnl += loopPnl;

        const unrealized = calcUnrealized(symbols, data);
        const invested   = calcInvested(symbols, data);
        printDashboard(ns, symbols, data, totalPnl, unrealized, loopPnl, MIN_SAMPLES);
        updateOverview(ns, totalPnl, invested, cash);
        saveHistory(ns, HISTORY_FILE, history);

        await ns.sleep(SLEEP_TIME);
    }
}

// ─── Estimation forecast / volatilité sans 4S ──────────────────────────────

/** @param {number[]} hist @returns {{forecast:number, vol:number, samples:number}} */
function estimate(hist) {
    if (hist.length < 2) return { forecast: 0.5, vol: 0, samples: 0 };

    const returns = [];
    for (let i = 1; i < hist.length; i++) {
        returns.push((hist[i] - hist[i - 1]) / hist[i - 1]);
    }

    let ups = 0, downs = 0;
    for (const r of returns) {
        if (r > 0) ups++;
        else if (r < 0) downs++;
    }
    const decisive = ups + downs;
    const forecast = decisive > 0 ? ups / decisive : 0.5;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const vol = Math.sqrt(variance);

    return { forecast, vol, samples: returns.length };
}

// ─── Vente ──────────────────────────────────────────────────────────────

function sellBadLongs(ns, symbols, data, commission, sellForecast, minSamples) {
    let pnl = 0;
    for (const sym of symbols) {
        const { pos, forecast, bid, samples } = data[sym];
        const [longShares, longAvg] = pos;
        if (longShares <= 0) continue;
        if (samples < minSamples) continue;
        if (forecast >= sellForecast) continue;

        const cost = longAvg * longShares;
        const potentialProfit = bid * longShares - cost;
        const minProfit = 2 * commission;
        if (potentialProfit <= minProfit) continue;

        const execPrice = ns.stock.sellStock(sym, longShares);
        if (execPrice > 0) {
            const realized = execPrice * longShares - cost - minProfit;
            pnl += realized;
            ns.print(`SELL LONG ${sym} | qté=${longShares} | PnL=$${ns.format.number(realized, 2)}`);
        }
    }
    return pnl;
}

function sellBadShorts(ns, symbols, data, commission, closeForecast, minSamples) {
    let pnl = 0;
    for (const sym of symbols) {
        const { pos, forecast, samples } = data[sym];
        const shortShares = pos[2];
        const shortAvgPrice = pos[3];
        if (shortShares <= 0) continue;
        if (samples < minSamples) continue;
        if (forecast <= closeForecast) continue;

        const execPrice = ns.stock.sellShort(sym, shortShares);
        if (execPrice > 0) {
            const realized = (shortAvgPrice - execPrice) * shortShares - 2 * commission;
            pnl += realized;
            ns.print(`CLOSE SHORT ${sym} | qté=${shortShares} | PnL=$${ns.format.number(realized, 2)}`);
        }
    }
    return pnl;
}

// ─── Achat ──────────────────────────────────────────────────────────────

function buyBestLongs(ns, symbols, data, cash, commission, minForecast, keepCash, maxPositions, minSamples) {
    const openPositions = symbols.filter(s => data[s].pos[0] > 0).length;
    let slots = maxPositions - openPositions;
    if (slots <= 0) return;

    const candidates = symbols
        .filter(sym => {
            const { pos, forecast, maxShares, samples } = data[sym];
            return samples >= minSamples && pos[0] <= 0 && forecast >= minForecast && maxShares > 0;
        })
        .map(sym => ({ sym, score: data[sym].vol * 2 * (data[sym].forecast - 0.5) }))
        .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return;

    const investable = Math.max(0, cash - keepCash);
    if (investable <= commission) return;
    const budgetPerSlot = investable / Math.min(slots, candidates.length);

    for (const { sym } of candidates) {
        if (slots <= 0) break;
        const { ask, maxShares } = data[sym];
        const qty = Math.min(Math.floor((budgetPerSlot - commission) / ask), maxShares);
        if (qty <= 0) continue;

        const execPrice = ns.stock.buyStock(sym, qty);
        if (execPrice > 0) {
            slots--;
            ns.print(`BUY LONG ${sym} | qté=${qty} | coût≈$${ns.format.number(execPrice * qty + commission, 2)}`);
        }
    }
}

function openBestShorts(ns, symbols, data, cash, commission, maxForecast, keepCash, maxPositions, minSamples) {
    const openPositions = symbols.filter(s => data[s].pos[2] > 0).length;
    let slots = maxPositions - openPositions;
    if (slots <= 0) return;

    const candidates = symbols
        .filter(sym => {
            const { pos, forecast, maxShares, samples } = data[sym];
            return samples >= minSamples && pos[2] <= 0 && forecast <= maxForecast && maxShares > 0;
        })
        .map(sym => ({ sym, score: data[sym].vol * 2 * (0.5 - data[sym].forecast) }))
        .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return;

    const investable = Math.max(0, cash - keepCash);
    if (investable <= commission) return;
    const budgetPerSlot = investable / Math.min(slots, candidates.length);

    for (const { sym } of candidates) {
        if (slots <= 0) break;
        const { bid, maxShares } = data[sym];
        const qty = Math.min(Math.floor((budgetPerSlot - commission) / bid), maxShares);
        if (qty <= 0) continue;

        const execPrice = ns.stock.buyShort(sym, qty);
        if (execPrice > 0) {
            slots--;
            ns.print(`OPEN SHORT ${sym} | qté=${qty} | prix≈$${ns.format.number(execPrice, 2)}`);
        }
    }
}

// short (buyShort/sellShort) requiert BitNode-8 ou SF8 niveau 2 : présentes sur
// ns.stock même sans le prérequis, donc typeof ne suffit pas, il faut vérifier le SF.
function hasShortAccess(ns) {
    if (ns.getResetInfo().currentNode === 8) return true;
    try {
        const sf8 = ns.singularity.getOwnedSourceFiles().find(s => s.n === 8);
        return (sf8?.lvl ?? 0) >= 2;
    } catch {
        return false;
    }
}

// ─── Persistance de l'historique ──────────────────────────────────────────

function loadHistory(ns, file, symbols) {
    let saved = {};
    try {
        const raw = ns.read(file);
        if (raw) saved = JSON.parse(raw);
    } catch { saved = {}; }

    const history = {};
    for (const sym of symbols) history[sym] = Array.isArray(saved[sym]) ? saved[sym] : [];
    return history;
}

function saveHistory(ns, file, history) {
    try { ns.write(file, JSON.stringify(history), "w"); } catch {}
}

// ─── Affichage ────────────────────────────────────────────────────────────

function calcUnrealized(symbols, data) {
    let total = 0;
    for (const sym of symbols) {
        const [longShares, longAvg, shortShares, shortAvg] = data[sym].pos;
        if (longShares > 0) total += (data[sym].bid - longAvg) * longShares;
        if (shortShares > 0) total += (shortAvg - data[sym].ask) * shortShares;
    }
    return total;
}

function calcInvested(symbols, data) {
    let total = 0;
    for (const sym of symbols) {
        const [longShares, longAvg, shortShares, shortAvg] = data[sym].pos;
        total += longShares * longAvg + shortShares * shortAvg;
    }
    return total;
}

function fmt(ns, n) {
    return (n >= 0 ? "+" : "") + "$" + ns.format.number(n, 2);
}

function printDashboard(ns, symbols, data, realized, unrealized, loopPnl, minSamples) {
    ns.clearLog();
    const total = realized + unrealized;
    const sep = "─".repeat(34);
    // const time = new Date().toLocaleTimeString();

    ns.print(sep);
    ns.print(`  TRADE_BN8 (sans 4S — forecast/vol estimés)`);
    ns.print(sep);
    ns.print(`  PnL réalisé  ${fmt(ns, realized).padStart(14)}  (boucle: ${fmt(ns, loopPnl)})`);
    ns.print(`  PnL latent   ${fmt(ns, unrealized).padStart(14)}`);
    ns.print(`  PnL total    ${fmt(ns, total).padStart(14)}`);

    let hasPos = false;
    for (const sym of symbols) {
        const { pos, bid, ask, forecast, samples } = data[sym];
        const [lShares, lAvg, sShares, sAvg] = pos;
        const ready = samples >= minSamples ? "" : " (calibrage...)";

        if (lShares > 0) {
            if (!hasPos) { ns.print(sep); ns.print("  POSITIONS"); }
            hasPos = true;
            const pnl = (bid - lAvg) * lShares;
            ns.print(`  LONG  ${sym.padEnd(5)} f≈${forecast.toFixed(2)}${ready}  ${fmt(ns, pnl).padStart(12)}`);
        }
        if (sShares > 0) {
            if (!hasPos) { ns.print(sep); ns.print("  POSITIONS"); }
            hasPos = true;
            const pnl = (sAvg - ask) * sShares;
            ns.print(`  SHORT ${sym.padEnd(5)} f≈${forecast.toFixed(2)}${ready}  ${fmt(ns, pnl).padStart(12)}`);
        }
    }
    if (!hasPos) { ns.print(sep); ns.print("  Aucune position ouverte."); }
    ns.print(sep);

    ns.ui.setTailTitle(`Trade BN8 | Total: ${fmt(ns, total)}`);
}

function updateOverview(ns, realized, invested, cash) {
    try {
        const doc   = eval("document");
        const hook0 = doc.getElementById("overview-extra-hook-0");
        const hook1 = doc.getElementById("overview-extra-hook-1");
        if (!hook0 || !hook1) return;
        const total = cash + invested;
        const color = realized >= 0 ? "#4caf50" : "#f44336";
        hook0.dataset.traderRealized = "Bénéfice";
        hook0.dataset.traderInvested = "Misé";
        hook0.dataset.traderTotal    = "$ TOTAL";
        hook1.dataset.traderRealized = `<strong style="color:${color}">$${ns.format.number(realized, 2)}</strong>`;
        hook1.dataset.traderInvested = `$${ns.format.number(invested, 2)}`;
        hook1.dataset.traderTotal    = `$${ns.format.number(total, 2)}`;
        renderHooks(hook0, hook1);
    } catch (_) {}
}

function clearOverview() {
    try {
        const doc  = eval("document");
        const hook0 = doc.getElementById("overview-extra-hook-0");
        const hook1 = doc.getElementById("overview-extra-hook-1");
        if (!hook0 || !hook1) return;
        for (const k of ["traderRealized", "traderInvested", "traderTotal"]) {
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
