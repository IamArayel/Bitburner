/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const doc   = globalThis["document"];
    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');

    if (!hook0 || !hook1) {
        ns.tprint("ERREUR : hooks HUD introuvables.");
        return;
    }

    ns.atExit(() => {
        delete hook0.dataset.karma;
        delete hook1.dataset.karma;
        renderHooks(hook0, hook1);
    });

    while (true) {
        try {
            hook0.dataset.karma = "Karma";
            hook1.dataset.karma = ns.format.number(ns.heart.break(), 2);
            renderHooks(hook0, hook1);
        } catch (err) {
            ns.print("Erreur HUD : " + String(err));
        }
        await ns.sleep(2000);
    }
}

function renderHooks(hook0, hook1) {
    const keys = Object.keys(hook0.dataset);
    hook0.innerHTML = keys.map(k => hook0.dataset[k]).join('<br>');
    hook1.innerHTML = keys.map(k => hook1.dataset[k] ?? '').join('<br>');
}
