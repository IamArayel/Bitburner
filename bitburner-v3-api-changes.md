# Bitburner v3.0.0 — Breaking API Changes

Source: GitHub releases (v2.8.0 + v3.0.0)

---

## Formatting (`ns.format.*`)

> PR #1635 — "Moved formatting functions to their own interface"

| Ancien (supprimé) | Nouveau |
|---|---|
| `ns.formatNumber(n)` | `ns.format.number(n)` |
| `ns.formatRam(n)` | `ns.format.ram(n)` |
| `ns.tFormat(ms)` | `ns.format.time(ms)` |
| `ns.nFormat(n, fmt)` | **supprimé** (utiliser `ns.format.number`) |

---

## Tail / UI (`ns.ui.*`)

> v2.8.0 PR #1935 — "Move tail-related APIs to ns.ui namespace"
> v3.0.0 PR #2143 — "Remove deprecated tail-related APIs"

| Ancien (supprimé) | Nouveau |
|---|---|
| `ns.tail()` | `ns.ui.openTail()` |
| `ns.closeTail(pid?)` | `ns.ui.closeTail(pid?)` |
| `ns.moveTail(x, y, pid?)` | `ns.ui.moveTail(x, y, pid?)` |
| `ns.resizeTail(w, h, pid?)` | `ns.ui.resizeTail(w, h, pid?)` |

Nouvelles APIs ajoutées en v2.8.0 :
- `ns.ui.renderTail(pid?)`
- `ns.ui.setTailFontSize(size, pid?)`
- `ns.ui.getGameInfo()` (inclut `versionNumber`)

---

## Hacknet (`ns.hacknet.*`)

> PR #2502 — "Remove RAM cost of hacknet namespace and set RAM cost of each hacknet API"

| Ancien | Nouveau |
|---|---|
| `ns.hacknet.upgradeCores(i, n)` | `ns.hacknet.upgradeCore(i, n)` |
| `ns.hacknet.upgradeCores(i, n)` | `ns.hacknet.upgradeCore(i, n)` ← seul vrai changement |

RAM cost supprimé sur le namespace, ajouté par fonction individuelle.

---

## Serveurs achetés → Cloud (`ns.cloud.*`)

> PR #2367 — "Move and rename purchased server functions to cloud API"

| Ancien | Nouveau |
|---|---|
| `ns.purchaseServer(name, ram)` | `ns.cloud.purchaseServer(name, ram)` |
| `ns.deleteServer(host)` | `ns.cloud.deleteServer(host)` |
| `ns.getPurchasedServers()` | `ns.cloud.getPurchasedServers()` |
| `ns.getPurchasedServerCost(ram)` | `ns.cloud.getPurchasedServerCost(ram)` |
| `ns.getPurchasedServerUpgradeCost(host, ram)` | `ns.cloud.getPurchasedServerUpgradeCost(host, ram)` |
| `ns.upgradePurchasedServer(host, ram)` | `ns.cloud.upgradePurchasedServer(host, ram)` |
| `ns.getPurchasedServerLimit()` | `ns.cloud.getPurchasedServerLimit()` |
| `ns.getPurchasedServerMaxRam()` | `ns.cloud.getPurchasedServerMaxRam()` |

---

## Stock (`ns.stock.*`)

> PR #2351 — "Rename 'TIX' interface to 'Stock'"

| Ancien | Nouveau |
|---|---|
| `ns.tix.*` | `ns.stock.*` |

---

## Divers

| Ancien | Nouveau |
|---|---|
| `ns.gang.getOtherGangInformation()` | `ns.gang.getAllGangInformation()` |
| `ns.sleeve.setAutoJobAssignment(...)` | `ns.sleeve.setJobAssignment(...)` |
| `ns.getServer()` | Retourne un nouveau type (PR #2746) |
| Serveur `darkweb` | Remplacé par serveur darknet (nouvelle mécanique) |

---

## API Server

> PR #2084 — Complètement supprimé en v3.0.0.

---

## NS1 Scripts

> PR #2083 — Support supprimé. Tous les scripts doivent être en NS2 (JS/TS).

---

## Fuzzy matching

> PR #2091 — Supprimé. Les noms de paramètres doivent être exacts.

---

## Fichier de migration généré par le jeu

Au lancement avec une save v2, le jeu génère automatiquement :
```
APIBreakInfo-3.0.0.txt
```
Ce fichier liste les scripts affectés par les breaking changes.
