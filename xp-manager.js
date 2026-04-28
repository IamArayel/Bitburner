/** @param {NS} ns **/
export async function main(ns) {
    const workerScript = "xp-worker.js";
    //const target = "joesguns"; // Serveur cible pour l'XP (faible niveau = rapide)
    const target = "n00dles"; // Serveur cible pour l'XP (faible niveau = rapide)


    // On récupère la liste de tous les serveurs
    let servers = ["home"];
    for (let i = 0; i < servers.length; i++) {
        let neighbors = ns.scan(servers[i]);
        for (let next of neighbors) {
            if (!servers.includes(next)) servers.push(next);
        }
    }

    for (const host of servers) {
        // 1. On tente de rooter le serveur
        if (host !== "home") {
            await tryRoot(ns, host);
        }

        if (ns.hasRootAccess(host)) {
            // 2. On calcule la RAM disponible (en gardant de la place sur 'home')
            let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
            if (host === "home") availableRam -= 27; // Réserve de sécurité sur home

            const scriptRam = ns.getScriptRam(workerScript);
            const threads = Math.floor(availableRam / scriptRam);

            if (threads > 0) {
                ns.killall(host); // Optionnel : nettoie le serveur avant
                await ns.scp(workerScript, host);
                ns.exec(workerScript, host, threads, target);
                ns.tprint(`🚀 [${host}] lancé avec ${threads} threads.`);
            }
        }
    }
}

async function tryRoot(ns, host) {
    let ports = 0;
    if (ns.fileExists("BruteSSH.exe")) { ns.brutessh(host); ports++; }
    if (ns.fileExists("FTPCrack.exe")) { ns.ftpcrack(host); ports++; }
    if (ns.fileExists("relaySMTP.exe")) { ns.relaysmtp(host); ports++; }
    if (ns.fileExists("HTTPWorm.exe")) { ns.httpworm(host); ports++; }
    if (ns.fileExists("SQLInject.exe")) { ns.sqlinject(host); ports++; }
    if (ports >= ns.getServerNumPortsRequired(host)) {
        ns.nuke(host);
    }
}