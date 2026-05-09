// network-scan.js

/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0]; // Le serveur cible (optionnel)
    
    // Liste pour garder une trace des serveurs visités
    let serverList = [];
    // Set pour éviter les boucles infinies
    let visited = new Set();
    
    // Fonction récursive pour scanner le réseau
    function scanNetwork(current, path) {
        visited.add(current);
        serverList.push({ name: current, path: path });

        const neighbors = ns.scan(current);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                // On ajoute le voisin au chemin actuel
                scanNetwork(neighbor, [...path, neighbor]);
            }
        }
    }

    // Lancement du scan depuis 'home'
    scanNetwork("home", ["home"]);

    // --- MODE 1 : Recherche de chemin vers une cible ---
    if (target) {
        const found = serverList.find(s => s.name === target);
        if (!found) {
            ns.tprint(`ERREUR: Le serveur '${target}' est introuvable.`);
            return;
        }
        
        // Génération de la chaîne de connexion
        let connectString = "";
        for (let i = 1; i < found.path.length; i++) {
            connectString += `connect ${found.path[i]}; `;
        }
        
        ns.tprint("\n--- CHEMIN TROUVÉ ---");
        ns.tprint(`Serveur : ${target}`);
        ns.tprint(`Chemin  : ${found.path.join(" -> ")}`);
        ns.tprint(`Commande: home; ${connectString}`);
        
        // Copie automatique dans le presse-papier (si activé dans les options)
        // ns.writePort(1, connectString); 
        return;
    }

    // --- MODE 2 : Tableau global du réseau ---
    
    // On retire 'home' et les serveurs achetés de la liste pour la clarté
    // Si vous voulez tout voir, commentez la ligne suivante.
    serverList = serverList.filter(s => !s.name.startsWith("home") && !s.name.startsWith("pserv-"));

    // Récupération des stats pour chaque serveur
    let displayList = serverList.map(s => {
        const server = ns.getServer(s.name);
        return {
            name: s.name,
            root: server.hasAdminRights ? "OUI" : "NON",
            level: server.requiredHackingSkill,
            money: server.moneyMax,
            ram: server.maxRam,
            path: s.path
        };
    });

    // Tri par argent maximum (décroissant)
    displayList.sort((a, b) => b.money - a.money);

    // Affichage formaté
    ns.tprint("\n--- RÉSEAU COMPLET (Trié par Argent Max) ---");
    ns.tprint(
        "SERVEUR".padEnd(20) + 
        "ROOT".padEnd(6) + 
        "LVL".padEnd(6) + 
        "RAM".padEnd(8) + 
        "ARGENT MAX"
    );
    ns.tprint("-".repeat(60));

    for (const s of displayList) {
        // On affiche uniquement les serveurs qui ont de l'argent ou de la RAM
        if (s.money > 0 || s.ram > 0) {
            let moneyStr = ns.format.number(s.money);
            let ramStr = ns.format.ram(s.ram);
            
            // Coloration conditionnelle simple via symboles
            let prefix = s.root === "OUI" ? "✓ " : "X ";
            
            ns.tprint(
                prefix + s.name.padEnd(18) + 
                s.root.padEnd(6) + 
                s.level.toString().padEnd(6) + 
                ramStr.padEnd(8) + 
                moneyStr
            );
        }
    }
}