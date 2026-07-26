---
name: ordres-combat
description: "Use when tu travailles sur le mouvement, les ordres, la latence de transmission, le combat, le moral, l'attrition ou l'IA rouge (js/ordres.js, js/combat.js, js/ia.js)."
auto_invoke: true
---

# Ordres, combat, IA

## Concepts → implémentation

| Concept | Implémentation |
|---|---|
| Ordre | `{ unite, chemin, idx, transmis, transmisLe, arrive }` dans `etat.ordres` — créé par `donnerOrdre` (`js/ordres.js`) |
| Itinéraire | `cheminVers(u, cible)` : Dijkstra, coût `TERRAINS.cout × (ami ? 1 : 2.5) × (ennemi présent ? 2 : 1)`, 12 provinces max |
| Latence de transmission | `estimerOrdre` : `round(1 + distQG/4 + (ravitaillement < 0.4 ? 2 : 0))` — partagée entre l'aperçu au survol et l'ordre réel : ne jamais dupliquer la formule |
| Marche | `marche(provId)` = `max(1, round(cout du terrain))` jours par province |
| Exécution | `executerOrdres` (appelée par `tour()`) : re-pathfinding si le front a bougé, combat si défenseurs, conquête si vide |
| Combat | `combat(att, defs, lieu)` (`js/combat.js`) : puissance = `force × moral/100 × (0.35 + 0.65×ravitaillement)`, défense × `TERRAINS.def` |
| Percée | `ratio > 0.58` → défenseurs décrochent vers l'arrière ami le mieux ravitaillé, sinon `detruire` ; l'attaquant prend la province |
| Pertes | Intensité `0.06 + alea()×0.07`, réparties selon le ratio ; événement poussé dans `etat.batailles` (affichage) |
| Moral | Dérive vers un palier logistique (`attrition`) : `0` si coupé, sinon `18 + 78×ravitaillement` — la coupure tue, pas le temps |
| Capitulation | `ravitaillement === 0` et `moral < 20` → `detruire` |
| Dissolution | `nettoyer` (privé) : force < 2000 → repli vers l'arrière `relie` si force ≥ 900, sinon anéanti |
| IA rouge | `iaRouge` (`js/ia.js`) : « opportuniste », évalue le théâtre chaque tour en 4 temps — (1) défendre un dépôt/QG menacé en rappelant la réserve la plus proche, (2) masser les corps de contact sur la province bleue la plus vulnérable si le ratio de combat estimé passe le seuil, (3) seuil abaissé face à une cible coupée ou débordée, (4) acheminer les réserves d'arrière vers le front. Réglages dans `IA` de `config.js`. Passe toujours par `donnerOrdre` |
| Séquence d'un jour | `tour()` (`js/tour.js`) : supply → IA → transmissions → exécution → attrition → supply → fin de partie |

## Ajouter une règle de mouvement ou de combat

1. Constantes dans `js/config.js` ; état nouveau dans `etat` (`js/etat.js`).
2. Mouvement : toucher `cheminVers`/`executerOrdres` — attention, `estimerOrdre` doit rester la source unique du délai affiché ET appliqué.
3. Combat : toucher `combat()` ; si l'issue change, vérifier `executerOrdres` (valeur de retour `passe`) et l'événement `etat.batailles` (les champs sont lus par `dessinerBatailles` dans `rendu.js`).
4. Moral/attrition : `attrition()` ; le palier est la seule dérive autorisée — pas d'érosion « au temps ».
5. IA : uniquement `ia.js` ; elle passe par `donnerOrdre` comme le joueur, jamais par mutation directe.
6. Tests : `tests/ordres-combat.test.js` (carte-ruban) — latence puis marche, conquête, percée, capitulation. Le combat est déterministe au ratio près : tester des rapports de forces nets.

## Pièges connus

- `detruire` filtre `etat.unites` ET `etat.ordres` : toute nouvelle collection référençant des corps doit y être purgée aussi.
- Un ordre repoussé (`passe === false`) tombe ; ne pas le faire persister sans décision de design.
- `u.coupe` sert uniquement à journaliser la bascule en poche (`detecterPoches`) — ne pas le réutiliser comme état de jeu.
