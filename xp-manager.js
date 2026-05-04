/** @param {NS} ns **/
export async function main(ns) {
    const workerScript = "xp-worker.js";
    const target       = "n00dles";
    const HOME_RESERVE = 27;

    const servers = ["home"];
    for (let i = 0; i < servers.length; i++) {
        for (const next of ns.scan(servers[i])) {
            if (!servers.includes(next)) servers.push(next);
        }
    }

    for (const host of servers) {
        if (host !== "home") tryRoot(ns, host);
        if (!ns.hasRootAccess(host)) continue;

        const reserve      = host === "home" ? HOME_RESERVE : 0;
        const availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - reserve;
        const threads      = Math.floor(availableRam / ns.getScriptRam(workerScript));
        if (threads <= 0) continue;

        ns.killall(host);
        await ns.scp(workerScript, host);
        ns.exec(workerScript, host, threads, target);
        ns.tprint(`[${host}] lancé avec ${threads} threads.`);
    }
}

function tryRoot(ns, host) {
    let ports = 0;
    if (ns.fileExists("BruteSSH.exe"))  { ns.brutessh(host);   ports++; }
    if (ns.fileExists("FTPCrack.exe"))  { ns.ftpcrack(host);   ports++; }
    if (ns.fileExists("relaySMTP.exe")) { ns.relaysmtp(host);  ports++; }
    if (ns.fileExists("HTTPWorm.exe"))  { ns.httpworm(host);   ports++; }
    if (ns.fileExists("SQLInject.exe")) { ns.sqlinject(host);  ports++; }
    if (ports >= ns.getServerNumPortsRequired(host)) ns.nuke(host);
}
