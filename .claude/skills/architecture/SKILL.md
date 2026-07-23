---
name: architecture
description: "Use when tu dois comprendre l'organisation du projet, localiser où vit une responsabilité, ou décider où placer du nouveau code avant d'implémenter."
auto_invoke: true
---

# Architecture du projet

App statique sans build : `index.html` charge `js/main.js` en module ES ; tout le reste est importé en cascade. Une seule page, un seul canvas, pas de routeur.

## Modules (js/)

| Module | Rôle | Dépend de |
|---|---|---|
| `config.js` | Constantes d'équilibrage : `RW`/`RH`, `NB_PROV`, `PORTEE`, `AVANCE_DEPOT`, `AVANCE_MAX`, `ROUGE`/`BLEU`, `TERRAINS` (0-4 procédural, 5-7 Angers) | — |
| `etat.js` | Objet `etat` (tout l'état mutable) + `alea()` + requêtes `ennemiSur`, `unitesDe`, `ravitaillement` | — |
| `carte.js` | Génération procédurale + briques partagées : `creerProvince`, `rasteriserVoronoi(eauMask)`, `installerTheatre`, `poserBase` | logistique, hud |
| `angers.js` | Carte réelle : Overpass → provinces (eau, ponts, terrains OSM, `ville`), repli sur `genererCarte` | carte, hud |
| `logistique.js` | `calculerSupply` (Dijkstra), congestion, `detecterPoches`, `distQG` | hud (journal) |
| `ordres.js` | `cheminVers`, `marche`, `estimerOrdre`, `donnerOrdre`, `executerOrdres` | logistique, combat, hud |
| `combat.js` | `combat`, `attrition` (+ `detruire`/`nettoyer` privés) | hud (journal) |
| `ia.js` | `iaRouge` : ordres du camp rouge | ordres |
| `tour.js` | `tour` (séquence d'un jour), `avancerJusquEvenement` (avance rapide jusqu'à une décision), `verifierFin` — touche `#date`, `#bStep`, `#bAuto` | logistique, ia, ordres, combat, hud |
| `rendu.js` | `dessiner` : fond raster en cache (`etat.sale`), pions, itinéraires, axes de supply, batailles, légende | ordres (marche), logistique (axeRavitaillement) |
| `hud.js` | `journal`, `majCompteurs`, `ficheUnite`/`ficheProv`/`ficheVide` | — |
| `interaction.js` | Souris (survol, sélection, aperçu d'ordre, portée de dépôt) + boutons du HUD | ordres, logistique, hud, carte, angers, tour |
| `main.js` | Boucle `requestAnimationFrame` (animation des pions, cadence auto) + lancement | tous |

Règle de sens des dépendances : la logique ne connaît le DOM qu'à travers `journal()` ; `etat.js` et `config.js` ne dépendent de rien.

Hors jeu : `osm/` = prototype standalone d'origine (ne plus y développer), `tests/` = suite node:test avec `stub-dom.js`, `vercel.json` = proxys Overpass, `scripts/run-tests.sh` = hook de tests.

## Où placer du nouveau code

| Type de changement | Où |
|---|---|
| Nouvelle règle de jeu (supply, combat, mouvement…) | Le module de logique concerné + constantes dans `config.js` + champ d'état dans `etat.js` si besoin |
| Nouvel élément d'état | Champ dans l'objet `etat` (`js/etat.js`), initialisé là — jamais un `let` de module |
| Nouveau visuel sur la carte | `rendu.js` (dans `dessiner` ou `construireFond` ; poser `etat.sale = true` au changement) |
| Nouveau bouton / interaction | `index.html` (markup) + `interaction.js` (câblage) + `hud.js` si fiche/journal |
| Nouveau terrain | Voir procédure du skill `generation-carte` |
| Nouvelle carte réelle | Dupliquer le motif d'`angers.js` — voir `generation-carte` |
| Nouvelle phase du tour | `tour.js` dans `tour()` (ordre des appels = ordre de résolution du jour) |
| Comportement de l'IA | `ia.js` uniquement |
| Nouveau test | `tests/` — voir skill `testing` |
