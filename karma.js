/** @param {NS} ns */
export async function main(ns) {
    // Désactive les logs pour éviter de spammer le terminal de script
    ns.disableLog("ALL");
    ns.clearLog();

    // On utilise globalThis pour accéder au document DOM du jeu
    const doc = globalThis["document"];

    // Les développeurs de Bitburner ont prévu ces "hooks" dans le DOM 
    // spécifiquement pour que les joueurs puissent ajouter des éléments au HUD
    const hook0 = doc.getElementById('overview-extra-hook-0');
    const hook1 = doc.getElementById('overview-extra-hook-1');

    // Vérification de sécurité
    if (!hook0 || !hook1) {
        ns.tprint("ERREUR : Impossible de trouver les hooks du HUD. Êtes-vous sur la bonne version ?");
        return;
    }

    // Fonction de nettoyage exécutée lorsque vous tuez le script
    ns.atExit(() => {
        hook0.innerText = "";
        hook1.innerText = "";
        ns.tprint("HUD Karma désactivé.");
    });

    ns.print("HUD Karma activé. Le script tourne en tâche de fond.");

    // Boucle d'actualisation du HUD
    while (true) {
        try {
            // La fonction ns.heart.break() est la méthode officielle pour lire le Karma
            const karma = ns.heart.break();

            // Affichage dans le HUD
            // hook0 = Colonne des noms/labels
            // hook1 = Colonne des valeurs
            hook0.innerText = "Karma \n";
            hook1.innerText = `${ns.format.number(karma, 2)} \n`;

        } catch (err) {
            ns.print("Erreur de mise à jour du HUD : " + String(err));
        }

        // Met en pause le script pendant 1 seconde avant la prochaine actualisation 
        // (Très important pour ne pas faire planter le jeu)
        await ns.sleep(2000);
    }
}