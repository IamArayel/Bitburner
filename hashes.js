/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');

    const doc   = eval('document');
    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');

    if (!hook0 || !hook1) {
        ns.tprint("ERREUR : hooks HUD introuvables.");
        return;
    }

    ns.atExit(() => {
        delete hook0.dataset.hashes;
        delete hook1.dataset.hashes;
        renderHooks(hook0, hook1);
    });

    while (true) {
        if (ns.hacknet.numNodes() > 0) {
            const hashes   = ns.hacknet.numHashes();
            const capacity = ns.hacknet.hashCapacity();
            const ratio    = capacity > 0 ? hashes / capacity : 0;
            const color    = ratio > 0.8 ? '#f44336' : ratio > 0.5 ? '#ff9800' : '#4caf50';

            hook0.dataset.hashes = 'Hashes';
            hook1.dataset.hashes = `<span style="color:${color}">${ns.format.number(hashes, 2)} / ${ns.format.number(capacity, 2)}</span>`;
        } else {
            delete hook0.dataset.hashes;
            delete hook1.dataset.hashes;
        }
        renderHooks(hook0, hook1);
        await ns.sleep(1000);
    }
}

function renderHooks(hook0, hook1) {
    const keys = Object.keys(hook0.dataset);
    hook0.innerHTML = keys.map(k => hook0.dataset[k]).join('<br>');
    hook1.innerHTML = keys.map(k => hook1.dataset[k] ?? '').join('<br>');
}
