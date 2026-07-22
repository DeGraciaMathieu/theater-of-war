---
name: logistique
description: "Use when tu travailles sur le ravitaillement : supply, débit, congestion, provinces coupées (relie), poches, portée des dépôts (js/logistique.js)."
auto_invoke: true
---

# Logistique

Cœur du jeu : `calculerSupply()` (`js/logistique.js`), appelée 2× par tour (`tour.js`) et à la génération (`installerTheatre`). Tout est recalculé from scratch à chaque appel, par camp.

## Concepts → implémentation

| Concept | Implémentation |
|---|---|
| Source de ravitaillement | Province avec `depot: true`, amie et libre d'ennemis (`ennemiSur`) — `dist = 0` au départ du Dijkstra |
| Distance logistique | Dijkstra sur `voisins`, coût `TERRAINS[terrain].cout × (ville ? 0.55 : 1)` ; corridor exclusivement ami et sans ennemi |
| Portée | `PORTEE = 15` (`js/config.js`) : supply de base `√(max(0, 1 - dist/PORTEE))` — courbe douce : le milieu de portée reste vivable, zéro au-delà de `PORTEE` |
| Demande (`charge`) | Chaque corps remonte `force / 12000` le long des `parent[]` du Dijkstra jusqu'au dépôt |
| Capacité (`cap`) | `TERRAINS[].debit × (ville ? 2.2 : 1) × (depot ? 3 : 1)` |
| Congestion | `min(1, cap / charge)` — locale à la province |
| Débit (`debit`) | Goulot de la chaîne : `min(congestion, debit du parent)`, propagé dans l'ordre du Dijkstra |
| Supply final | `√(1 - dist/PORTEE) × debit`, ou `0` si `!relie` |
| Coupée (`relie`) | `relie = dist < Infinity` — distinct de « trop loin » (relie mais supply 0) |
| Poche | `detecterPoches` : composante connexe de provinces `!relie` d'un camp, avec des corps dedans ; journalisée à la bascule (`u.coupe`) |
| Alerte de saturation | `alerterSaturation` : camp BLEU, `congestion < 0.6` et `charge > 0.5` |
| Distance au QG | `distQG(u)` (BFS en provinces amies) — sert à la latence des ordres (`ordres.js`) |
| Axe d'un corps | `axeRavitaillement(u)` : remontée de `etat.arbreSupply[camp]` (parents du Dijkstra, conservés par `calculerSupply`) jusqu'au dépôt + `goulot` (maillon de congestion minimale, `null` si rien ne sature ou corps coupé) |
| Portée d'un dépôt | `porteeDepuis(depotId)` : Dijkstra mono-source, `Set` des provinces à `dist < PORTEE` — la zone d'action affichée au survol |

Consommateurs du supply : `ravitaillement(u)` (`js/etat.js`) → puissance de combat (`combat.js`), palier de moral et attrition (`attrition`), latence des ordres (`estimerOrdre`), teintes de la carte et axe du corps sélectionné (`rendu.js`, vue Ravitaillement), portée de dépôt au survol (`interaction.js`).

## Modifier la logistique

1. Toute constante nouvelle va dans `js/config.js` (comme `PORTEE`), pas en dur dans la formule.
2. Respecter l'ordre des 3 passes de `calculerSupply` (commentées `// 1.`, `// 2.`, `// 3.`) : demande → congestion/goulot → supply final. Le goulot exige l'ordre de visite du Dijkstra (`ordre[]`).
3. Un nouvel attribut logistique de province : l'ajouter dans `creerProvince` (`js/carte.js`) et le réinitialiser en début de passe comme `charge`/`congestion`/`debit`.
4. Vérifier l'impact sur `detecterPoches` et `alerterSaturation` (elles lisent `relie`, `congestion`, `charge`).
5. Tests : `tests/logistique.test.js` sur la carte-ruban (`tests/outils.js`) — décroissance avec la distance, coupure, poche, dépôt occupé.
