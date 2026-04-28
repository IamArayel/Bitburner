// auto-root-list-backdoors.js

/** @param {NS} ns **/
export async function main(ns) {
    const start = "home";
    ns.disableLog("scan");

    /** @type {Record<string, string>} */
    const parent = {};
    const visited = new Set([start]);
    const queue = [start];

    /** @type {string[]} */
    const needBackdoor = [];

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = ns.scan(current);

        for (const host of neighbors) {
            if (visited.has(host)) continue;
            visited.add(host);
            parent[host] = current;
            queue.push(host);

            // 1) on essaie de root le serveur découvert
            const rooted = await tryRoot(ns, host);
            // 2) si on a root et que ce n'est pas un serveur spécial, on le marque pour backdoor manuel
            if (rooted && host !== "home") {
                needBackdoor.push(host);
            }
        }
    }

    // affichage des chemins à backdoor
    ns.print("=== SERVEURS À BACKDOOR MANUELLEMENT ===");
    for (const host of needBackdoor) {
        const path = buildPath(parent, host);
        ns.tprint("             =================");
        ns.tprint(`                  ${host}:`);
        ns.tprint("             -----------------");
        ns.tprint(`connect ${["home", ...path].join(" ; connect ")} ; backdoor`);
    }
    ns.tprint("Exploration + root terminés.");
}

/**
 * Essaie d’ouvrir tous les ports possibles puis de nuke.
 * Retourne true si root obtenu.
 */
async function tryRoot(ns, host) {
    if (host === "home") return false;
    if (ns.hasRootAccess(host)) {
        ns.print(`[ROOT] ${host} déjà root.`);
        return true;
    }

    let portsOpened = 0;

    if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(host); portsOpened++; }
    if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(host); portsOpened++; }
    if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(host); portsOpened++; }
    if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(host); portsOpened++; }
    if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(host); portsOpened++; }

    const required = ns.getServerNumPortsRequired(host);
    if (portsOpened >= required) {
        ns.nuke(host);
        ns.print(`[ROOT] ${host} rooté.`);
        return true;
    } else {
        ns.print(`[ROOT] ${host} : ${portsOpened}/${required} ports ouverts, pas de nuke.`);
        return false;
    }
}

/**
 * Reconstruit le chemin home -> ... -> host à partir de la map des parents.
 */
function buildPath(parent, target) {
    const path = [target];
    while (parent[path[0]] && parent[path[0]] !== "home") {
        path.unshift(parent[path[0]]);
    }
    return path;
}
