/** @param {NS} ns **/
export async function main(ns) {
    const start = "home";
    ns.disableLog("ALL");
    ns.ui.openTail();

    // purchaseProgram retourne false si déjà possédé ou fonds insuffisants → pas besoin de prix ni de pré-check
    const programs = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];

    /** @type {Record<string, string>} */
    const parent = {};
    const visited = new Set([start]);
    const queue = [start];

    ns.print("--- Démarrage de l'Auto-Manager (Root + Backdoor + Achats) ---");

    // --- PHASE 1 : ACHAT DES PROGRAMMES ---
    for (const prog of programs) {
        if (!ns.fileExists(prog, "home") && ns.singularity.purchaseProgram(prog)) {
            ns.tprint(`🛒 Acheté : ${prog}`);
        }
    }

    // --- PHASE 2 : EXPLORATION ET BACKDOOR ---
    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = ns.scan(current);

        for (const host of neighbors) {
            if (visited.has(host)) continue;
            visited.add(host);
            parent[host] = current;
            queue.push(host);

            const serverInfo = ns.getServer(host);
            
            // On ignore nos serveurs achetés
            if (serverInfo.purchasedByPlayer) continue;

            // Tentative de Root
            const rooted = tryRoot(ns, host);

            // Tentative de Backdoor
            if (rooted && !serverInfo.backdoorInstalled && ns.getHackingLevel() >= serverInfo.requiredHackingSkill) {
                ns.print(`Cible : ${host}. Connexion...`);

                const path = buildPath(parent, host);
                for (const step of path) {
                    ns.singularity.connect(step);
                }

                await ns.singularity.installBackdoor();
                ns.singularity.connect("home");
                ns.tprint(`✅ Backdoor installé : ${host}`);
            }
        }
    }
    ns.tprint("🚀 Cycle terminé.");
}

/**
 * Tente d'ouvrir les ports avec ce qu'on a en stock
 */
function tryRoot(ns, host) {
    if (ns.hasRootAccess(host)) return true;

    let portsOpened = 0;
    if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(host); portsOpened++; }
    if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(host); portsOpened++; }
    if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(host); portsOpened++; }
    if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(host); portsOpened++; }
    if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(host); portsOpened++; }

    if (portsOpened >= ns.getServerNumPortsRequired(host)) {
        ns.nuke(host);
        return true;
    }
    return false;
}

function buildPath(parent, target) {
    const path = [];
    let curr = target;
    while (curr !== "home") {
        path.unshift(curr);
        curr = parent[curr];
    }
    return path;
}