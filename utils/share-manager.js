// file: utils/share-manager.js
// Usage :
//   run utils/share-manager.js                       // sans faction, réserve 2 Go
//   run utils/share-manager.js "CyberSec"            // travaille pour la faction si Singularity dispo
//   run utils/share-manager.js "CyberSec" 4 8000     // réserve=4 Go, check toutes 8 s
//
// Comportement :
// - N'impacte PAS vos autres scripts (ne tue que SES PROPRES instances share.js taguées)
// - Maintient autant de threads share() que possible en laissant une réserve fixe de RAM
// - (optionnel) tente de travailler pour la faction fournie (Singularity requis)

const TAG = "--share-home-managed"; // identifie nos propres instances

/** @param {NS} ns **/
export async function main(ns) {
  const faction = ns.args[0] && typeof ns.args[0] === "string" ? ns.args[0] : null;
  const reserveGB = ns.args[1] !== undefined ? Number(ns.args[1]) : 2;     // RAM à laisser libre
  const intervalMs = ns.args[2] !== undefined ? Number(ns.args[2]) : 10000; // période d'ajustement

  if (Number.isNaN(reserveGB) || reserveGB < 0) return void ns.tprint("Paramètre 'reserveGB' invalide.");
  if (Number.isNaN(intervalMs) || intervalMs < 500) return void ns.tprint("Paramètre 'intervalMs' invalide (>= 500).");

  const host = "home";
  const script = "utils/share.js";

  if (!ns.fileExists(script, host)) {
    ns.tprint(`Erreur : ${script} est introuvable sur ${host}. Copiez-le d'abord.`);
    return;
  }

  ns.disableLog("getServerMaxRam");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("sleep");
  ns.ui.openTail();

  // Petite aide si pas de Singularity
  const hasSingularity = typeof ns.singularity?.workForFaction === "function";

  while (true) {
    // 1) Essayer de (re)lancer le "work for faction" si demandé et possible
    if (faction && hasSingularity) {
      tryStartOrMaintainFactionWork(ns, faction);
    } else if (faction && !hasSingularity) {
      ns.print(`[INFO] Singularity indisponible : lancez le travail pour "${faction}" via l'UI (Factions > Work).`);
    }

    // 2) Ajuster le nombre total de threads share() que NOUS contrôlons sur 'home'
    const max = ns.getServerMaxRam(host);
    const used = ns.getServerUsedRam(host);
    const free = Math.max(0, max - used);
    const ramPerThread = ns.getScriptRam(script, host);

    // RAM réellement utilisable : on respecte la réserve
    const usable = Math.max(0, free - reserveGB);
    const desiredThreads = ramPerThread > 0 ? Math.floor(usable / ramPerThread) : 0;

    // Comptage des threads déjà lancés par NOUS (processus share.js avec notre TAG)
    const ourProcs = ns.ps(host).filter(p => p.filename === script && p.args?.includes(TAG));
    const currentThreads = ourProcs.reduce((acc, p) => acc + (p.threads || 0), 0);

    if (desiredThreads > currentThreads) {
      // Lancer des threads supplémentaires (on n'éteint rien d'autre)
      const toLaunch = desiredThreads - currentThreads;
      const pid = ns.exec(script, host, toLaunch, TAG);
      if (pid === 0) {
        ns.print(`[WARN] Impossible de lancer ${toLaunch} threads supplémentaires (RAM fluctuante).`);
      } else {
        ns.print(`[OK] +${toLaunch} threads share() (total géré=${currentThreads + toLaunch}).`);
      }
    } else if (desiredThreads < currentThreads) {
      // Réduire uniquement NOS instances pour libérer de la RAM (ne touche pas aux autres scripts)
      let toKillThreads = currentThreads - desiredThreads;
      for (const proc of ourProcs) {
        if (toKillThreads <= 0) break;
        // Si on tue un proc, on perd tous ses threads ; simple et sûr
        ns.kill(proc.pid);
        toKillThreads -= (proc.threads || 0);
        ns.print(`[OK] -${proc.threads || 0} threads share() (réduction pour respecter la réserve).`);
      }
    } else {
      // Pile-poil
      ns.print(`[KEEP] share() stable : ${currentThreads} threads (réserve ${reserveGB} GB).`);
    }

    await ns.sleep(intervalMs);
  }
}

// Tente de maintenir le "work for faction" (Singularity requis)
function tryStartOrMaintainFactionWork(ns, faction) {
  // Si API dispo, on peut vérifier le travail courant (selon version)
  const canGetWork = typeof ns.singularity.getCurrentWork === "function";
  let workingForFaction = false;

  try {
    if (canGetWork) {
      const w = ns.singularity.getCurrentWork();
      workingForFaction = !!(w && w.type === "FACTION" && w.factionName === faction);
    }
  } catch (_) {
    // fallback si getCurrentWork absent : on essaie simplement de (re)demarrer
  }

  if (!workingForFaction) {
    // "Hacking Contracts" est généralement le meilleur pour la rep
    const ok = ns.singularity.workForFaction(faction, "Hacking Contracts", false);
    if (!ok) {
      ns.print(`[INFO] Impossible de démarrer le travail pour "${faction}" (conditions non remplies ?).`);
    } else {
      ns.print(`[OK] Travail pour la faction "${faction}" démarré (focus=false).`);
    }
  }
}
