/** @param {NS} ns **/
export async function main(ns) {
  const workerScript = "utils/xp-worker.js";
  const mode         = (ns.args[0] ?? "xp").toLowerCase(); // ajouter "xp" ou "money" suivant le but des workers
  const HOME_RESERVE = 32; // GB réservés sur home pour autres scripts

  if (!ns.fileExists(workerScript, "home")) {
    ns.tprint(`ERREUR: ${workerScript} introuvable sur home`);
    return;
  }

  const target = pickTarget(ns, mode);
  ns.tprint(`[xp-manager] mode=${mode} | cible=${target}`);

  const servers = getAllRooted(ns);
  for (const host of servers) {
    await ns.scp(workerScript, host);

    for (const proc of ns.ps(host)) {
      if (proc.filename === workerScript) ns.kill(proc.pid);
    }

    const reserve   = host === "home" ? HOME_RESERVE : 0;
    const freeRam   = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - reserve;
    const scriptRam = ns.getScriptRam(workerScript, host);
    const threads   = Math.floor(freeRam / scriptRam);
    if (threads < 1) continue;

    const pid = ns.exec(workerScript, host, threads, target, mode);
    ns.tprint(pid > 0 ? `[${host}] ${threads}t → ${target}` : `[${host}] ERREUR lancement`);
  }
}

/** Sélectionne la meilleure cible selon le mode et le niveau de hack du joueur. */
function pickTarget(ns, mode) {
  const hackLvl = ns.getPlayer().skills.hacking;

  const candidates = [
    // XP early — hack req 1, idéal pour débuter avant d'avoir des outils
    { h: "n00dles",        req: 1,    money: 1.75e6  },
    // Money/XP early — meilleur argent disponible dès le niveau 1
    { h: "foodnstuff",     req: 1,    money: 2e9     },
    // Money early-mid — bon ratio argent/sécurité dès hack 10
    { h: "joesguns",       req: 10,   money: 2.5e9   },
    // XP/money early-mid — accessible rapidement, decent money
    { h: "harakiri-sushi", req: 40,   money: 4e9     },
    // Money mid — gros volume dès hack 100
    { h: "phantasy",       req: 100,  money: 24.7e9  },
    // Money mid — meilleur choix mid-game, bon ratio
    { h: "silver-helix",   req: 150,  money: 45.5e9  },
    // Money mid-late — transition vers le late game
    { h: "global-pharm",   req: 300,  money: 1.75e12 },
    // Money late — excellent late game
    { h: "clarkinc",       req: 600,  money: 24e12   },
    // Money end-game — top tier avant les mega-corps
    { h: "omnitek",        req: 900,  money: 46e12   },
    // Money end-game max — meilleur rendement absolu
    { h: "ecorp",          req: 1000, money: 217e12  },
  ];

  const reachable = candidates.filter(c =>
    ns.serverExists(c.h) &&
    ns.hasRootAccess(c.h) &&
    hackLvl >= ns.getServerRequiredHackingLevel(c.h)
  );

  if (reachable.length === 0) return "n00dles";

  if (mode === "money") {
    // Argent max disponible
    return reachable.sort((a, b) => b.money - a.money)[0].h;
  } else {
    // XP = serveur le plus difficile hackable (req le plus élevé = plus d'XP)
    return reachable.sort((a, b) => b.req - a.req)[0].h;
  }
}

function getAllRooted(ns) {
  const seen  = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    for (const n of ns.scan(queue.shift())) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return [...seen].filter(s => ns.hasRootAccess(s) && !s.startsWith("hacknet-server-"));
}
