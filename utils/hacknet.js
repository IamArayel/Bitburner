/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.ui.openTail();

    const flags = ns.flags([
        ['budget', 0.9],
        ['sleep', 2000],
        ['once', false],
        ['dry', false],
    ]);

    const LEVEL_NS = [1, 5, 10, 25, 50];
    const RAM_NS   = [1, 2, 3];
    const CORE_NS  = [1, 2, 3];

    const lf = l => l * Math.pow(1.035, l - 1);
    const rf = r => Math.pow(r, 0.3);
    const cf = c => (c + 5) / 6;

    function fmt(n) {
        if (n >= 1e15) return (n/1e15).toFixed(2) + 'q';
        if (n >= 1e12) return (n/1e12).toFixed(2) + 't';
        if (n >= 1e9)  return (n/1e9).toFixed(2)  + 'b';
        if (n >= 1e6)  return (n/1e6).toFixed(2)  + 'm';
        if (n >= 1e3)  return (n/1e3).toFixed(2)  + 'k';
        return n.toFixed(2);
    }
    function fmtTime(ms) {
        const s = Math.floor(ms / 1000);
        if (s >= 3600) return `${Math.floor(s/3600)}h${Math.floor((s%3600)/60)}m`;
        if (s >= 60)   return `${Math.floor(s/60)}m${s%60}s`;
        return `${s}s`;
    }

    function getMult() {
        if (ns.hacknet.numNodes() === 0) return null;
        const s = ns.hacknet.getNodeStats(0);
        return s.production / (lf(s.level) * rf(s.ram) * cf(s.cores));
    }

    while (true) {
        const money  = ns.getServerMoneyAvailable('home');
        const budget = money * flags.budget;
        const n      = ns.hacknet.numNodes();
        const max    = ns.hacknet.maxNumNodes();
        const mult   = getMult();

        // First node: no ROI comparison needed
        if (n === 0) {
            const cost = ns.hacknet.getPurchaseNodeCost();
            ns.clearLog();
            ns.print(`No nodes. First node: ${fmt(cost)}`);
            if (cost <= budget && !flags.dry) ns.hacknet.purchaseNode();
            if (flags.once) break;
            await ns.sleep(flags.sleep);
            continue;
        }

        const candidates = [];

        // New node
        if (n < max) {
            const cost = ns.hacknet.getPurchaseNodeCost();
            if (cost <= budget) {
                const gain = mult * lf(1) * rf(1) * cf(1);
                candidates.push({ label: 'NEW NODE       ', type: 'node', i: -1, n: 0, cost, gain });
            }
        }

        // Upgrades per node
        for (let i = 0; i < n; i++) {
            const s   = ns.hacknet.getNodeStats(i);
            const cur = s.production;

            for (const k of LEVEL_NS) {
                const cost = ns.hacknet.getLevelUpgradeCost(i, k);
                if (!isFinite(cost) || cost > budget) continue;
                const gain = cur * (lf(s.level + k) / lf(s.level) - 1);
                candidates.push({ label: `Node${i} lvl +${k}`.padEnd(15), type: 'level', i, n: k, cost, gain });
            }

            for (const k of RAM_NS) {
                const cost = ns.hacknet.getRamUpgradeCost(i, k);
                if (!isFinite(cost) || cost > budget) continue;
                const gain = cur * (rf(s.ram * Math.pow(2, k)) / rf(s.ram) - 1);
                candidates.push({ label: `Node${i} ram +${k}`.padEnd(15), type: 'ram', i, n: k, cost, gain });
            }

            for (const k of CORE_NS) {
                const cost = ns.hacknet.getCoreUpgradeCost(i, k);
                if (!isFinite(cost) || cost > budget) continue;
                const gain = cur * (cf(s.cores + k) / cf(s.cores) - 1);
                candidates.push({ label: `Node${i} core+${k}`.padEnd(15), type: 'core', i, n: k, cost, gain });
            }
        }

        candidates.sort((a, b) => b.gain / b.cost - a.gain / a.cost);

        ns.clearLog();
        ns.print(`Money: ${fmt(money)}  Budget: ${fmt(budget)}  Nodes: ${n}/${max}`);
        ns.print('─'.repeat(65));
        ns.print(`${'Upgrade'.padEnd(16)} ${'Cost'.padStart(9)} ${'Gain/s'.padStart(9)} ${'Payback'.padStart(12)}`);

        for (const c of candidates.slice(0, 8)) {
            const payback = fmtTime(Math.ceil(c.cost / c.gain) * 1000);
            ns.print(`${c.label} ${fmt(c.cost).padStart(9)} ${fmt(c.gain).padStart(9)} ${payback.padStart(12)}`);
        }

        const best = candidates[0];
        if (best) {
            ns.print('─'.repeat(65));
            ns.print(`BUYING: ${best.label.trim()}`);
            if (!flags.dry) {
                switch (best.type) {
                    case 'node':  ns.hacknet.purchaseNode();              break;
                    case 'level': ns.hacknet.upgradeLevel(best.i, best.n); break;
                    case 'ram':   ns.hacknet.upgradeRam(best.i, best.n);   break;
                    case 'core':  ns.hacknet.upgradeCore(best.i, best.n); break;
                }
            }
        } else {
            ns.print('Nothing affordable right now.');
        }

        if (flags.once) break;
        await ns.sleep(flags.sleep);
    }
}
