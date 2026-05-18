/**
 * darknet-crawler.js — Explorateur auto-répliquant du Dark Net (BN5)
 *
 * Prérequis : DarkscapeNavigator.exe
 *   → terminal : `buy DarkscapeNavigator.exe` (TOR requis)
 *   → ou acheter à Chongqing
 *
 * Lancer depuis home : run darknet-crawler.js [--tail]
 * Le script se copie lui-même sur chaque serveur darknet découvert.
 * 
 * Copier le script dans darkweb : scp darknet-crawler.js darkweb
 *
 * Mots de passe sauvegardés dans : darknet-passwords.json
 * (synchronisé vers home après chaque découverte)
 *
 * Pour ajouter un nouveau type de serveur : ajouter un case dans solve()
 * avec le modelId trouvé dans les logs.
 */

const SCRIPT  = "darknet-crawler.js";
const PW_FILE = "darknet-passwords.json";

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.dnet) {
    ns.tprint("ERREUR : ns.dnet indisponible. Achetez DarkscapeNavigator.exe d'abord.");
    return;
  }

  ns.disableLog("ALL");
  if (ns.getHostname() === "home") {
    ns.ui.openTail();
    // Initialiser le fichier de mots de passe s'il n'existe pas encore
    if (!ns.read(PW_FILE)) ns.write(PW_FILE, "{}", "w");
  }

  while (true) {
    try { await tick(ns); }
    catch (e) { ns.print(`[ERR global] ${e}`); }
    await ns.sleep(5_000);
  }
}

// ─── Boucle principale ────────────────────────────────────────────────────

/** @param {NS} ns */
async function tick(ns) {
  await exploitSelf(ns);

  const nearby = ns.dnet.probe();
  ns.print(`[PROBE] ${nearby.length} serveur(s) visible(s) depuis ${ns.getHostname()}`);

  for (const target of nearby) {
    try { await handleServer(ns, target); }
    catch (e) { ns.print(`[ERR] ${target}: ${e}`); }
  }
}

// ─── Gestion d'un serveur voisin ─────────────────────────────────────────

/** @param {NS} ns @param {string} target */
async function handleServer(ns, target) {
  const details = ns.dnet.getServerDetails(target);

  ns.print(`[INFO] ${target}  online=${details.isOnline}  connecté=${details.isConnectedToCurrentServer}  session=${details.hasSession}  modèle=${details.modelId}`);

  if (!details.isOnline || !details.isConnectedToCurrentServer) {
    ns.print(`[SKIP] ${target} — hors ligne ou non connecté`);
    return;
  }

  // Session déjà active → propager directement
  if (details.hasSession) {
    await spreadTo(ns, target);
    return;
  }

  // Tenter avec un mot de passe mémorisé
  const db = loadPasswords(ns);
  if (db[target] !== undefined) {
    ns.print(`[TRY]  ${target} — mot de passe mémorisé : "${db[target]}"`);
    const r = await ns.dnet.authenticate(target, db[target]);
    if (r.success) {
      ns.print(`[AUTH✓] ${target} (mot de passe connu)`);
      await spreadTo(ns, target);
      return;
    }
    // Serveur probablement redémarré → supprimer le vieux mot de passe
    ns.print(`[STALE] Mot de passe expiré pour ${target}, nouvelle tentative de crack`);
    delete db[target];
    ns.write(PW_FILE, JSON.stringify(db, null, 2), "w");
  }

  // Chercher le mot de passe
  const password = await solve(ns, target, details);
  if (password !== null) {
    ns.print(`[AUTH✓] ${target} — mot de passe trouvé : "${password}"`);
    savePassword(ns, target, password);
    await spreadTo(ns, target);
  } else {
    ns.print(`[FAIL] ${target} — mot de passe non trouvé. Utilisez : run add-password-darknet.js ${target} <motdepasse>`);
  }
}

// ─── Résolution de mot de passe ───────────────────────────────────────────

/**
 * Tente de trouver le mot de passe selon le modelId du serveur.
 * Retourne le mot de passe si trouvé, null sinon.
 * @param {NS} ns
 * @param {string} target
 * @param {object} details
 * @returns {Promise<string|null>}
 */
async function solve(ns, target, details) {
  ns.print(`[SOLVE] ${target}  modèle="${details.modelId}"  hint="${details.passwordHint}"`);

  switch (details.modelId) {

    case "ZeroLogon": {
      // Mot de passe toujours vide
      const r = await ns.dnet.authenticate(target, "");
      return r.success ? "" : null;
    }

    // ── Ajoutez vos cases ici au fil des découvertes ──────────────────────
    //
    // Exemple : si vous voyez modelId="HintIsPassword" avec hint="h4ck3r"
    // case "HintIsPassword": {
    //   const r = await ns.dnet.authenticate(target, details.passwordHint);
    //   return r.success ? details.passwordHint : null;
    // }
    //
    // Exemple : brute-force numérique 4 chiffres
    // case "PIN4": {
    //   for (let i = 0; i <= 9999; i++) {
    //     const pin = String(i).padStart(4, "0");
    //     const r = await ns.dnet.authenticate(target, pin);
    //     if (r.success) return pin;
    //   }
    //   return null;
    // }
    //
    // ─────────────────────────────────────────────────────────────────────

    default: {
      ns.print(`[?] Modèle non supporté : "${details.modelId}"`);
      ns.print(`    Hint : ${details.passwordHint}`);
      ns.print(`    → Ajoutez un case dans solve() une fois le mécanisme compris`);

      // Heartbleed : lire les logs du serveur pour des indices
      // (peut révéler des mots de passe d'autres serveurs en clair !)
      try {
        const hb = await ns.dnet.heartbleed(target, { peek: true });
        if (hb?.logs?.length) {
          ns.print(`[HEARTBLEED] Logs de ${target} :`);
          hb.logs.slice(-8).forEach(l => ns.print(`  ${l}`));
        }
      } catch {}

      return null;
    }
  }
}

// ─── Propagation ─────────────────────────────────────────────────────────

/**
 * Copie le crawler + la base de mots de passe sur le serveur cible,
 * puis lance le crawler là-bas.
 * @param {NS} ns @param {string} target
 */
async function spreadTo(ns, target) {
  // darkweb = marketplace TOR classique, pas un nœud darknet exploitable
if (target === "darkweb") {
    //ns.print(`[SKIP SPREAD] ${target} est le dark web classique, pas un nœud darknet`);
    return;
  }

  // Copier les fichiers un par un (le scp en tableau échoue si un fichier est absent)
  const scriptOk = await ns.scp(SCRIPT, target);
  if (!scriptOk) {
    ns.print(`[SPREAD FAIL] Impossible de copier ${SCRIPT} vers ${target}`);
    return;
  }
  if (ns.fileExists(PW_FILE)) await ns.scp(PW_FILE, target);

  const pid = ns.exec(SCRIPT, target, { preventDuplicates: true });
  if (pid > 0) {
    ns.print(`[SPREAD] → ${target} (pid ${pid})`);
  } else {
    ns.print(`[SPREAD WARN] scp OK mais exec échoué sur ${target} (RAM insuffisante ?)`);
  }
}

// ─── Exploitation du serveur courant ─────────────────────────────────────

/** @param {NS} ns */
async function exploitSelf(ns) {
  const host = ns.getHostname();

  // Stasis link : stabilise ce serveur (empêche déplacement/extinction)
  // et permet exec à distance depuis home en cas de crash
  try {
    const limit   = ns.dnet.getStasisLinkLimit();
    const stasied = ns.dnet.getStasisLinkedServers();
    if (!stasied.includes(host) && stasied.length < limit) {
      ns.dnet.setStasisLink();
      ns.print(`[STASIS] Lien appliqué sur ${host} (${stasied.length + 1}/${limit})`);
    }
  } catch {}

  // Libérer la RAM bloquée par le propriétaire original
  // (révèle souvent des fichiers .cache à la fin)
  try {
    for (let i = 0; i < 50; i++) {
      const freed = await ns.dnet.memoryReallocation();
      if (!freed) break;
    }
  } catch {}

  // Ouvrir les fichiers .cache (argent, programmes, clés d'accès bourse...)
  const caches = ns.ls(host, ".cache");
  for (const f of caches) {
    try {
      const result = await ns.dnet.openCache(f);
      ns.tprint(`[CACHE] ${host}/${f} → ${JSON.stringify(result)}`);
    } catch {}
  }

  // Phishing : argent + XP Charisma (plus efficace avec un haut niveau de charisme)
  try {
    await ns.dnet.phishingAttack();
  } catch {}
}

// ─── Persistance des mots de passe ───────────────────────────────────────

/** @param {NS} ns @returns {Record<string, string>} */
function loadPasswords(ns) {
  try {
    const raw = ns.read(PW_FILE);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/**
 * Sauvegarde un mot de passe localement ET synchronise vers home.
 * @param {NS} ns @param {string} host @param {string} password
 */
function savePassword(ns, host, password) {
  const db = loadPasswords(ns);
  db[host] = password;
  const json = JSON.stringify(db, null, 2);
  ns.write(PW_FILE, json, "w");
  try { ns.scp(PW_FILE, "home"); } catch {} // best-effort sync vers home
}

// ─── Autocomplétion terminal ──────────────────────────────────────────────

/** @param {AutocompleteData} data */
export function autocomplete(data) {
  return ["--tail"];
}
