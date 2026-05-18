/**
 * add-password-darknet.js — Enregistre manuellement un mot de passe darknet.
 *
 * Usage :
 *   run add-password-darknet.js <hostname> <password>
 *   run add-password-darknet.js --list
 *   run add-password-darknet.js --delete <hostname>
 *
 * Le fichier est synchronisé vers darkweb automatiquement.
 */

const PW_FILE = "darknet-passwords.json";

/** @param {NS} ns */
export async function main(ns) {
  const args = ns.args;

  if (args[0] === "--list" || args.length === 0) {
    const db = load(ns);
    const entries = Object.entries(db);
    if (entries.length === 0) {
      ns.tprint("Aucun mot de passe enregistré.");
    } else {
      ns.tprint(`=== ${entries.length} mot(s) de passe ===`);
      for (const [host, pw] of entries) {
        ns.tprint(`  ${host.padEnd(30)} → "${pw}"`);
      }
    }
    return;
  }

  if (args[0] === "--delete") {
    const host = String(args[1] ?? "");
    if (!host) { ns.tprint("Usage: run add-password-darknet.js --delete <hostname>"); return; }
    const db = load(ns);
    if (host in db) {
      delete db[host];
      save(ns, db);
      ns.tprint(`Supprimé : ${host}`);
    } else {
      ns.tprint(`${host} n'est pas dans la base.`);
    }
    return;
  }

  if (args.length < 2) {
    ns.tprint("Usage : run add-password-darknet.js <hostname> <password>");
    ns.tprint("        run add-password-darknet.js --list");
    ns.tprint("        run add-password-darknet.js --delete <hostname>");
    return;
  }

  const host     = String(args[0]);
  const password = String(args[1]);

  const db = load(ns);
  db[host] = password;
  save(ns, db);

  ns.tprint(`✅ ${host} → "${password}"`);
  ns.tprint(`Synchronisé. Le seed/crawler l'utilisera au prochain cycle.`);
}

/** @param {NS} ns @returns {Record<string, string>} */
function load(ns) {
  try {
    const raw = ns.read(PW_FILE);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Sauvegarde sur home ET propage vers darkweb (où tourne le seed).
 * @param {NS} ns @param {Record<string, string>} db */
function save(ns, db) {
  const json = JSON.stringify(db, null, 2);
  ns.write(PW_FILE, json, "w");
  // Propager vers darkweb pour que le seed y accède immédiatement
  ns.scp(PW_FILE, "darkweb");
}

/** @param {AutocompleteData} data */
export function autocomplete(data) {
  return ["--list", "--delete"];
}
