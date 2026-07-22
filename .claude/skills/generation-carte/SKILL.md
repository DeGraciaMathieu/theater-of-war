---
name: generation-carte
description: "Use when tu travailles sur la génération de carte : provinces, Voronoï, terrains, eau, ponts, carte procédurale (carte.js) ou carte réelle d'Angers (angers.js)."
auto_invoke: true
---

# Génération de carte

Deux origines, un seul format de sortie : des provinces dans `etat.prov` + un raster `etat.siteIdx` (Int16Array `RW×RH`, id de province par pixel, `-1` = eau infranchissable).

## Concepts → implémentation

| Concept | Implémentation |
|---|---|
| Province | Objet créé par `creerProvince(id, x, y, terrain, ville)` — `js/carte.js` |
| Terrain | Index dans `TERRAINS` (`js/config.js`) : 0 plaine, 1 bocage, 2 collines, 3 montagne, 4 marais (procédural) ; 5 bois, 6 berges, 7 urbain (Angers) |
| Découpage en provinces | `rasteriserVoronoi(eauMask)` — Voronoï par buckets + centroïdes + adjacence, `js/carte.js` |
| Adjacence | `p.voisins` (symétrique), construite pixel par pixel ; jamais à travers l'eau |
| Eau | `eauMask` (Uint8Array) construit dans `angers.js` : polygones `natural=water` remplis (`remplirPolygone`) + rivières épaissies (`traceLarge`) |
| Pont | `relierPonts(routes)` (`js/angers.js`) : une route qui franchit l'eau ajoute l'adjacence entre les deux rives |
| Relief procédural | Bruit à bosses + seuils par quantiles dans `genererCarte` (`js/carte.js`) |
| Terrain OSM | `terrainDepuisLanduse` (`js/angers.js`) : forest/wood→bois, residential/industrial/commercial→urbain, farmland→plaine, meadow→bocage ; proximité d'eau→berges |
| Nœud routier (`ville`) | Procédural : `alea() < 0.13` ; Angers : province à < 16 px d'une route de rang ≥ 3 |
| Camps, dépôts, QG, corps initiaux | `installerTheatre` + `poserBase` (`js/carte.js`) : partage NE/SO, 2 dépôts d'arrière + 1 dépôt avancé (à `AVANCE_DEPOT` du chemin coin → centre) + 1 QG + 8 corps par camp |
| Requête Overpass | `chargerOverpass` (`js/angers.js`) : POST `data=` urlencodé, 4 miroirs (2 proxys Vercel + 2 directs), 2 passes |

## Ajouter un nouveau terrain

1. `js/config.js` : ajouter l'entrée `{ nom, cout, def, debit, col }` à la fin de `TERRAINS` (ne jamais réordonner : les index sont des identifiants).
2. `js/rendu.js` : ajouter un `case` dans `motifTerrain` (signature graphique du terrain). La légende suit automatiquement les terrains présents.
3. L'attribuer : seuils de `genererCarte` (`js/carte.js`) pour le procédural, ou `terrainDepuisLanduse` (`js/angers.js`) pour l'OSM.
4. Test : compléter `tests/generation.test.js` si le terrain a une règle d'apparition vérifiable.

## Ajouter une nouvelle carte réelle (autre ville)

1. Dupliquer le motif d'`angers.js` : seule la `BBOX` et le nom changent — la chaîne `chargerOverpass → construire → rasteriserVoronoi(eauMask) → relierPonts → installerTheatre` est déjà générique. Envisager de paramétrer `angers.js` par `BBOX` plutôt que de copier le fichier.
2. `index.html` : ajouter le bouton dans le bloc `.cmd`.
3. `interaction.js` : câbler le bouton sur le modèle de `bAngers` (désactivation pendant le fetch, reset journal/auto/date).
4. Garder le repli `genererCarte()` en cas d'échec Overpass.

## Pièges connus

- Tout passe par `voisins` ensuite (chemins, supply, poches) : une erreur d'adjacence casse le jeu en silence.
- `rasteriserVoronoi` doit être appelée après le remplissage de `etat.prov` et avant `relierPonts`.
- Les serveurs Overpass publics rendent des 406/429/5xx transitoires : ne pas « corriger » en supprimant les retries.
