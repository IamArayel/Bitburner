/** @param {NS} ns **/
export async function main(ns) {
    const start = "home";
    ns.disableLog("ALL");
    ns.tail(); 

    const programs = [
        { name: "BruteSSH.exe", price: 500e3 },
        { name: "FTPCrack.exe", price: 1.5e6 },
        { name: "relaySMTP.exe", price: 5e6 },
        { name: "HTTPWorm.exe", price: 30e6 },
        { name: "SQLInject.exe", price: 250e6 }
    ];

    /** @type {Record<string, string>} */
    const parent = {};
    const visited = new Set([start]);
    const queue = [start];

    ns.print("--- Démarrage de l'Auto-Manager (Root + Backdoor + Achats) ---");

    // --- PHASE 1 : ACHAT DES PROGRAMMES ---
    for (const prog of programs) {
        if (!ns.fileExists(prog.name, "home")) {
            if (ns.getServerMoneyAvailable("home") >= prog.price) {
                if (ns.singularity.purchaseProgram(prog.name)) {
                    ns.tprint(`🛒 Acheté : ${prog.name}`);
                }
            }
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
            const rooted = await tryRoot(ns, host);

            // Tentative de Backdoor
            if (rooted) {
                if (!serverInfo.backdoorInstalled && ns.getHackingLevel() >= serverInfo.requiredHackingSkill) {
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
    }
    ns.tprint("🚀 Cycle terminé.");
}

/**
 * Tente d'ouvrir les ports avec ce qu'on a en stock
 */
async function tryRoot(ns, host) {
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