/** corp-manager.js — Automatise la Corporation (Agriculture → expansion)
 * Usage : run corp-manager.js [seuil_invest1] [seuil_invest2]
 *   seuil_invest1 : offre min. pour accepter le round 1 (défaut $210B)
 *   seuil_invest2 : offre min. pour accepter le round 2 (défaut $5T)
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();
  ns.ui.resizeTail(600, 540);

  const CORP    = "MegaCorp";
  const DIV     = "Agriculture";
  const CITIES  = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"];
  const SLEEP   = 5_000;
  const INVEST1 = Number(ns.args[0]) || 210e9;
  const INVEST2 = Number(ns.args[1]) || 5e12;

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  if (!ns.corporation.hasCorporation()) {
    try   { ns.corporation.createCorporation(CORP, false); }
    catch { ns.corporation.createCorporation(CORP, true);  }
  }

  if (!ns.corporation.getCorporation().divisions.includes(DIV)) {
    try { ns.corporation.expandIntoIndustry("Agriculture", DIV); } catch {}
  }

  // ── Boucle principale ─────────────────────────────────────────────────────
  while (true) {
    const corp  = ns.corporation.getCorporation();
    const funds = corp.funds;

    try { setupCities(ns, DIV, CITIES);                } catch (e) { ns.print(`[cities]   ${e}`); }
    try { manageOffices(ns, DIV, CITIES, funds);       } catch (e) { ns.print(`[offices]  ${e}`); }
    try { manageWarehouses(ns, DIV, CITIES, funds);    } catch (e) { ns.print(`[wh]       ${e}`); }
    try { manageRealEstate(ns, DIV, CITIES, funds);    } catch (e) { ns.print(`[re]       ${e}`); }
    try { manageSales(ns, DIV, CITIES);                } catch (e) { ns.print(`[sales]    ${e}`); }
    try { manageLevelUpgrades(ns, funds);              } catch (e) { ns.print(`[lvlup]    ${e}`); }
    try { manageUnlocks(ns, funds);                    } catch (e) { ns.print(`[unlocks]  ${e}`); }
    try { manageAdVert(ns, DIV, funds);                } catch (e) { ns.print(`[advert]   ${e}`); }
    try { manageResearch(ns, DIV);                     } catch (e) { ns.print(`[research] ${e}`); }
    try { checkInvestment(ns, corp, INVEST1, INVEST2); } catch (e) { ns.print(`[invest]   ${e}`); }

    printDashboard(ns, corp, DIV, CITIES);
    await ns.sleep(SLEEP);
  }
}

// ── Expansion géographique ────────────────────────────────────────────────────
function setupCities(ns, div, cities) {
  const divCities = ns.corporation.getDivision(div).cities;
  for (const city of cities) {
    if (!divCities.includes(city)) {
      try { ns.corporation.expandCity(div, city); } catch {}
    }
    if (!ns.corporation.hasWarehouse(div, city)) {
      try { ns.corporation.purchaseWarehouse(div, city); } catch {}
    }
  }
}

// ── Gestion des bureaux ───────────────────────────────────────────────────────
const ALL_JOBS = [
  "Operations", "Engineer", "Business", "Management", "Research & Development",
];

/** Guide : démarrer avec Ops + Engineer + Management (pas Business).
 *  Quand toutes les recherches sont faites, redistribuer les R&D vers Ops. */
function getJobAssign(size, rdDone = false) {
  if (size <= 3) {
    return { "Operations": 1, "Engineer": 1, "Business": 0,
             "Management": 1, "Research & Development": 0 };
  }
  const eng  = Math.max(1, Math.round(size * 0.20));
  const bus  = Math.max(1, Math.round(size * 0.10));
  const mgmt = Math.max(1, Math.round(size * 0.20));
  const rnd  = rdDone ? 0 : Math.max(0, Math.round(size * 0.25));
  const ops  = Math.max(1, size - eng - bus - mgmt - rnd);
  return { "Operations": ops, "Engineer": eng, "Business": bus,
           "Management": mgmt, "Research & Development": rnd };
}

function manageOffices(ns, div, cities, funds) {
  const rdDone = RESEARCH_PRIORITY.every(r => {
    try { return ns.corporation.hasResearched(div, r); } catch { return false; }
  });

  for (const city of cities) {
    let office;
    try { office = ns.corporation.getOffice(div, city); } catch { continue; }

    const target = funds > 1e12  ? 30
                 : funds > 200e9 ? 15
                 : funds > 30e9  ? 9
                 :                  3;

    if (office.size < target) {
      try {
        ns.corporation.expandOffice(div, city, target - office.size);
        office = ns.corporation.getOffice(div, city);
      } catch {}
    }

    const assign = getJobAssign(office.size, rdDone);
    for (const job of ALL_JOBS) {
      try { ns.corporation.setAutoJobAssignment(div, city, job, assign[job] ?? 0); } catch {}
    }
  }
}

// ── Gestion des entrepôts ─────────────────────────────────────────────────────
function manageWarehouses(ns, div, cities, funds) {
  for (const city of cities) {
    if (!ns.corporation.hasWarehouse(div, city)) continue;
    const wh = ns.corporation.getWarehouse(div, city);

    const target = funds > 1e12  ? 3000
                 : funds > 200e9 ? 2000
                 : funds > 30e9  ? 1000
                 : funds > 5e9   ? 500
                 :                  300;

    if (wh.size < target) {
      try { ns.corporation.upgradeWarehouse(div, city, 1); } catch {}
    }

    if (ns.corporation.hasUnlock("Smart Supply")) {
      try { ns.corporation.setSmartSupply(div, city, true); } catch {}
    }
  }
}

// ── Real Estate (fort impact sur le multiplicateur de production Agriculture) ──
function manageRealEstate(ns, div, cities, funds) {
  const target = funds > 1e12  ? 10_000
               : funds > 200e9 ?  5_000
               : funds > 30e9  ?  2_000
               :                    500;

  for (const city of cities) {
    if (!ns.corporation.hasWarehouse(div, city)) continue;
    const re = ns.corporation.getMaterial(div, city, "Real Estate").qty;
    try { ns.corporation.buyMaterial(div, city, "Real Estate", re < target ? 50 : 0); } catch {}
  }
}

// ── Vente des matières produites ──────────────────────────────────────────────
function manageSales(ns, div, cities) {
  const hasTA1 = (() => {
    try { return ns.corporation.hasResearched(div, "Market-TA.I"); } catch { return false; }
  })();

  for (const city of cities) {
    if (!ns.corporation.hasWarehouse(div, city)) continue;
    for (const mat of ["Food", "Plants"]) {
      try {
        ns.corporation.sellMaterial(div, city, mat, "MAX", "MP");
        if (hasTA1) ns.corporation.setMaterialMarketTA1(div, city, mat, true);
      } catch {}
    }
  }
}

// ── Upgrades à niveaux ────────────────────────────────────────────────────────
// Smart Factories en priorité : impact immédiat sur toute la productivité
const LEVEL_UPGRADES = [
  "Smart Factories",
  "Smart Storage",
  "Wilson Analytics",
  "ABC SalesBots",
  "Project Insight",
  "Nuoptimal Nootropic Injector Implants",
  "Speech Processor Implants",
  "Neural Accelerators",
  "FocusWires",
  "DreamSense",
];

function manageLevelUpgrades(ns, funds) {
  for (const upg of LEVEL_UPGRADES) {
    try {
      const cost = ns.corporation.getUpgradeLevelCost(upg);
      if (funds > cost * 2) {
        ns.corporation.levelUpgrade(upg);
        return;
      }
    } catch {}
  }
}

// ── Déverrouillages one-time ──────────────────────────────────────────────────
const UNLOCKS = [
  "Smart Supply",
  "Market Research - Demand",
  "Market Data - Competition",
];

function manageUnlocks(ns, funds) {
  for (const unlock of UNLOCKS) {
    try {
      if (!ns.corporation.hasUnlock(unlock)) {
        const cost = ns.corporation.getUnlockCost(unlock);
        if (funds > cost * 2) ns.corporation.purchaseUnlock(unlock);
      }
    } catch {}
  }
}

// ── AdVert ────────────────────────────────────────────────────────────────────
function manageAdVert(ns, div, funds) {
  try {
    const cost = ns.corporation.getHireAdVertCost(div);
    if (funds > cost * 2) ns.corporation.hireAdVert(div);
  } catch {}
}

// ── Recherche ─────────────────────────────────────────────────────────────────
// Ordre per guide : Hi-Tech → Market-TA.I → Self-Correcting → Drones → Overclock
// Market-TA.II volontairement absent (guide : "Useless")
const RESEARCH_PRIORITY = [
  "Hi-Tech R&D Laboratory",
  "Market-TA.I",
  "Self-Correcting Assemblers",
  "Drones",
  "Drones - Assembly",
  "Drones - Transport",
  "Overclock",
];

function manageResearch(ns, div) {
  try {
    const pts = ns.corporation.getDivision(div).researchPoints;
    for (const res of RESEARCH_PRIORITY) {
      if (!ns.corporation.hasResearched(div, res)) {
        const cost = ns.corporation.getResearchCost(div, res);
        if (pts > cost * 1.5) {
          ns.corporation.research(div, res);
          return;
        }
      }
    }
  } catch {}
}

// ── Offres d'investissement ───────────────────────────────────────────────────
function checkInvestment(ns, corp, thresh1, thresh2) {
  if (corp.public) return;
  try {
    const offer = ns.corporation.getInvestmentOffer();
    if (!offer) return;
    const { funds: amount, round } = offer;
    if ((round === 1 && amount >= thresh1) || (round === 2 && amount >= thresh2)) {
      ns.corporation.acceptInvestmentOffer();
      ns.print(`[INVEST] Round ${round} accepté : +$${ns.format.number(amount, 2)}`);
      ns.toast(`[CORP] Invest R${round} : +$${ns.format.number(amount, 2)}`, "success", 10_000);
    }
  } catch {}
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function printDashboard(ns, corp, div, cities) {
  ns.clearLog();
  const sep    = "─".repeat(62);
  const time   = new Date().toLocaleTimeString();
  const profit = corp.revenue - corp.expenses;

  ns.print(sep);
  ns.print(`  CORP MANAGER                              ${time}`);
  ns.print(sep);
  ns.print(`  ${corp.name}  ${corp.public ? "(PUBLIQUE)" : "(Privée)"}`);
  ns.print(`  Fonds   : $${ns.format.number(corp.funds, 2)}`);
  ns.print(`  Revenue : $${ns.format.number(corp.revenue, 2)}/s`);
  ns.print(`  Profit  : ${profit >= 0 ? "+" : ""}$${ns.format.number(profit, 2)}/s`);

  try {
    const lvls = LEVEL_UPGRADES.slice(0, 4).map(u => {
      const lv = ns.corporation.getUpgradeLevel(u);
      return `${u.split(" ")[0]}:${lv}`;
    }).join("  ");
    ns.print(`  Upgrades: ${lvls}`);
  } catch {}

  try {
    const divInfo = ns.corporation.getDivision(div);
    ns.print(sep);
    ns.print(`  ${div.toUpperCase()}`);
    const ssOk   = ns.corporation.hasUnlock("Smart Supply") ? "SS✓" : "SS✗";
    const ta1Ok  = (() => { try { return ns.corporation.hasResearched(div, "Market-TA.I") ? "TA✓" : "TA✗"; } catch { return "TA✗"; } })();
    const advert = ns.corporation.getHireAdVertCount(div);
    ns.print(`  Awareness:${divInfo.awareness.toFixed(0)}  Pop:${divInfo.popularity.toFixed(0)}  AdVert:${advert}  ${ssOk}  ${ta1Ok}`);
    ns.print(`  Research : ${ns.format.number(divInfo.researchPoints, 1)} pts`);

    const researchDone = RESEARCH_PRIORITY.filter(r => {
      try { return ns.corporation.hasResearched(div, r); } catch { return false; }
    });
    if (researchDone.length > 0) {
      ns.print(`  Recherches (${researchDone.length}/${RESEARCH_PRIORITY.length}) : ${researchDone.map(r => r.split(" ")[0]).join(", ")}`);
    }

    ns.print(sep);
    ns.print("  VILLE        Emp    WH     RE    Food      Plants");
    for (const city of cities) {
      try {
        const off    = ns.corporation.getOffice(div, city);
        const wh     = ns.corporation.getWarehouse(div, city);
        const re     = ns.corporation.getMaterial(div, city, "Real Estate").qty;
        const food   = ns.corporation.getMaterial(div, city, "Food").qty;
        const plants = ns.corporation.getMaterial(div, city, "Plants").qty;
        ns.print(
          `  ${city.slice(0, 9).padEnd(9)}  ${String(off.numEmployees).padStart(2)}/${off.size}  ` +
          `${String(wh.size).padStart(4)}  ` +
          `${ns.format.number(re, 0).padStart(6)}  ` +
          `${ns.format.number(food, 1).padStart(6)}  ${ns.format.number(plants, 1)}`
        );
      } catch {}
    }
  } catch {}

  if (!corp.public) {
    try {
      const offer = ns.corporation.getInvestmentOffer();
      if (offer) {
        ns.print(sep);
        ns.print(`  Offre R${offer.round} : $${ns.format.number(offer.funds, 2)}`);
      }
    } catch {}
  }

  ns.print(sep);
  ns.ui.setTailTitle(`Corp Manager | Rev: $${ns.format.number(corp.revenue, 2)}/s`);
}
