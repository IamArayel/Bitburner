/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const maxRam = ns.cloud.getRamLimit();
    const availableMoney = ns.getServerMoneyAvailable("home");

    // Trouver le tier RAM le plus élevé abordable
    let affordableRam = 8;
    while (affordableRam * 2 <= maxRam && ns.cloud.getServerCost(affordableRam * 2) <= availableMoney) {
        affordableRam *= 2;
    }
    if (ns.cloud.getServerCost(affordableRam) > availableMoney) {
        ns.tprint(`Fonds insuffisants pour acheter le moindre serveur.`);
        return;
    }
    const costPerServer = ns.cloud.getServerCost(affordableRam);

    const ownedServers = ns.cloud.getServerNames();
    const maxServersLimit = ns.cloud.getServerLimit();
    let availableSlots = maxServersLimit - ownedServers.length;

    // Si plein, vérifier si on peut remplacer le plus petit
    if (availableSlots <= 0) {
        // Trouver le serveur avec le moins de RAM
        ownedServers.sort((a, b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b));
        const smallestServer = ownedServers[0];
        const smallestRam = ns.getServerMaxRam(smallestServer);

        if (smallestRam >= maxRam) {
            ns.tprint(`Tous les serveurs sont déjà au maximum (${ns.format.ram(maxRam * 1e9)}). Rien à faire.`);
            return;
        }

        if (affordableRam <= smallestRam) {
            ns.tprint(`Le serveur le plus petit (${smallestServer}) a déjà ${ns.format.ram(smallestRam * 1e9)}. Pas intéressant de le remplacer par ${ns.format.ram(affordableRam * 1e9)}.`);
            return;
        }

        const confirmed = await ns.prompt(
            `Slots pleins. Supprimer ${smallestServer} (${ns.format.ram(smallestRam * 1e9)}) pour acheter un serveur à ${ns.format.ram(affordableRam * 1e9)} ?\n` +
            `Coût: ${ns.format.number(costPerServer)} $, Disponible: ${ns.format.number(availableMoney)} $`,
            { type: "boolean" }
        );
        if (!confirmed) {
            ns.tprint("Achat annulé.");
            return;
        }

        ns.killall(smallestServer);
        ns.cloud.deleteServer(smallestServer);
        availableSlots = 1;
    }

    // Calculer le maximum qu'on peut s'offrir et acheter
    const maxAffordable = Math.floor(availableMoney / costPerServer);
    const maxToBuy = Math.min(availableSlots, maxAffordable);

    const choices = [];
    if (availableSlots >= 1 && maxAffordable >= 1) choices.push("x1");
    if (availableSlots >= 10 && maxAffordable >= 10) choices.push("x10");
    if (maxToBuy > 0) choices.push("MAX (" + maxToBuy + ")");
    choices.push("Annuler");

    const promptMsg = `Achat de serveurs (${ns.format.ram(affordableRam * 1e9)} / max ${ns.format.ram(maxRam * 1e9)})\n` +
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
        let index = 0;
        while (ns.serverExists("pserv-" + index)) {
            index++;
        }
        const serverName = `pserv-${index}`;
        const result = ns.cloud.purchaseServer(serverName, affordableRam);
        if (result) {
            purchased++;
        } else {
            ns.tprint(`Échec de l'achat du serveur ${serverName}`);
            break;
        }
    }

    if (purchased > 0) {
        ns.tprint(`Achat réussi de ${purchased} serveur(s) avec ${ns.format.ram(affordableRam * 1e9)} RAM.`);
    }
}
