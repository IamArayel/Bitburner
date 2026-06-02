/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog('ALL');
    ns.ui.openTail();

    // City factions: mutually exclusive, never auto-join
    const SKIP = new Set([
        'Sector-12', 'Aevum', 'Volhaven', 'Chongqing', 'New Tokyo', 'Ishima',
    ]);

    const flags = ns.flags([
        ['sleep', 30000],
        ['once', false],
    ]);

    while (true) {
        const invitations = ns.singularity.checkFactionInvitations();

        for (const faction of invitations) {
            if (SKIP.has(faction)) {
                ns.print(`SKIP  ${faction}`);
                continue;
            }
            const ok = ns.singularity.joinFaction(faction);
            ns.print(ok ? `JOIN  ${faction}` : `FAIL  ${faction}`);
        }

        if (!invitations.length) ns.print('No pending invitations.');

        if (flags.once) break;
        await ns.sleep(flags.sleep);
    }
}
