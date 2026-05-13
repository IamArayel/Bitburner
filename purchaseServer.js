/** @param {NS} ns */
export async function main(ns) {
    // Désactiver les logs par défaut pour plus de clarté
    ns.disableLog("ALL");

    // Capacité RAM maximale possible pour un serveur
    const maxRam = ns.cloud.getRamLimit();
    const costPerServer = ns.cloud.getServerCost(maxRam);
    const availableMoney = ns.getServerMoneyAvailable("home");
    
    const currentServersCount = ns.cloud.getServerNames().length;
    const maxServersLimit = ns.cloud.getServerLimit();
    const availableSlots = maxServersLimit - currentServersCount;

    if (availableSlots <= 0) {
        ns.tprint("Vous avez déjà atteint la limite maximale de serveurs achetés (" + maxServersLimit + ").");
        return;
    }

    // Calculer le maximum qu'on peut s'offrir et acheter
    const maxAffordable = Math.floor(availableMoney / costPerServer);
    const maxToBuy = Math.min(availableSlots, maxAffordable);

    const choices = [];
    if (availableSlots >= 1 && maxAffordable >= 1) choices.push("x1");
    if (availableSlots >= 10 && maxAffordable >= 10) choices.push("x10");
    if (maxToBuy > 0) choices.push("MAX (" + maxToBuy + ")");
    choices.push("Annuler");

    if (maxToBuy === 0) {
        ns.tprint(`Fonds insuffisants pour acheter un serveur de ${ns.format.number(maxRam)} GB.`);
        ns.tprint(`Coût: ${ns.format.number(costPerServer)} $, Disponible: ${ns.format.number(availableMoney)} $`);
        return;
    }

    const promptMsg = `Achat de serveurs MAX RAM (${ns.format.ram(maxRam * 1e9)})\n` +
                      `Coût unitaire: ${ns.format.number(costPerServer)} $\n` +
                      `Argent disponible: ${ns.format.number(availableMoney)} $\n` +
                      `Emplacements libres: ${availableSlots} / ${maxServersLimit}\n` +
                      `Combien voulez-vous en acheter ?`;

    const choice = await ns.prompt(promptMsg, {
        type: "select",
        choices: choices
    });

    let numToBuy = 0;
    if (choice === "x1") numToBuy = 1;
    else if (choice === "x10") numToBuy = 10;
    else if (choice && choice.startsWith("MAX")) numToBuy = maxToBuy;
    else {
        ns.tprint("Achat annulé.");
        return;
    }

    let purchased = 0;
    for (let i = 0; i < numToBuy; i++) {
        // Trouver le prochain nom de serveur disponible (ex: pserv-0, pserv-1, etc.)
        let index = 0;
        while (ns.serverExists("pserv-" + index)) {
            index++;
        }
        
        const serverName = `pserv-${index}`;
        const result = ns.cloud.purchaseServer(serverName, maxRam);
        
        if (result) {
            purchased++;
        } else {
            ns.tprint(`Échec de l'achat du serveur ${serverName}`);
            break;
        }
    }

    if (purchased > 0) {
        ns.tprint(`Achat réussi de ${purchased} serveur(s) avec ${ns.format.ram(maxRam * 1e9)} RAM.`);
    }
}
