/** @param {NS} ns */
export async function main(ns) {
    // Script pour acheter des serveurs de manière interactive

    // Demander la capacité RAM souhaitée
    const ramInput = await ns.prompt("Entrez la capacité RAM du serveur (en GB, puissance de 2, max " + ns.cloud.getRamLimit() + "):", { type: "text" });
    const ram = parseInt(ramInput);
    if (isNaN(ram) || ram <= 0 || (ram & (ram - 1)) !== 0) {
        ns.tprint("Capacité RAM invalide. Doit être une puissance de 2 positive.");
        return;
    }
    if (ram > ns.cloud.getRamLimit()) {
        ns.tprint("Capacité RAM trop élevée. Maximum autorisé: " + ns.cloud.getRamLimit() + " GB");
        return;
    }

    // Demander le nombre de serveurs
    const numInput = await ns.prompt("Combien de serveurs voulez-vous acheter ?", { type: "text" });
    const numServers = parseInt(numInput);
    if (isNaN(numServers) || numServers <= 0) {
        ns.tprint("Nombre de serveurs invalide.");
        return;
    }

    const currentServers = ns.cloud.getServerNames().length;
    const maxServers = ns.cloud.getServerLimit();
    if (currentServers + numServers > maxServers) {
        ns.tprint("Vous ne pouvez pas acheter autant de serveurs. Limite: " + maxServers + ", actuellement: " + currentServers);
        return;
    }

    // Calculer le coût
    const costPerServer = ns.cloud.getServerCost(ram);
    const totalCost = costPerServer * numServers;
    const availableMoney = ns.getServerMoneyAvailable("home");

    // Afficher le coût et demander confirmation
    const confirm = await ns.prompt(`Coût par serveur: ${ns.format.number(costPerServer)} $\nCoût total: ${ns.format.number(totalCost)} $\nArgent disponible: ${ns.format.number(availableMoney)} $\nConfirmer l'achat ?`, { type: "boolean" });

    if (!confirm) {
        ns.tprint("Achat annulé.");
        return;
    }

    if (availableMoney < totalCost) {
        ns.tprint("Pas assez d'argent pour cet achat.");
        return;
    }

    // Acheter les serveurs
    for (let i = 0; i < numServers; i++) {
        const serverName = `pserv-${currentServers + i}`;
        const result = ns.cloud.purchaseServer(serverName, ram);
        if (result) {
            ns.tprint(`Serveur acheté: ${serverName} avec ${ram} GB RAM`);
        } else {
            ns.tprint(`Échec de l'achat du serveur ${serverName}`);
        }
    }
}