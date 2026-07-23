---
name: rendu-interaction
description: "Use when tu travailles sur l'affichage (canvas, pions, fond, légende, batailles), le HUD (fiches, journal, compteurs), la souris/boutons ou la boucle d'animation (js/rendu.js, js/hud.js, js/interaction.js, js/main.js)."
auto_invoke: true
---

# Rendu, HUD, interaction, boucle

## Concepts → implémentation

| Concept | Implémentation |
|---|---|
| Fond de carte | `construireFond` (`js/rendu.js`) : raster `RW×RH` dessiné pixel par pixel dans `etat.imgData`, mis en cache dans `etat.rasterCv` |
| Invalidation | `etat.sale = true` → le fond est reconstruit à la frame suivante. **Obligatoire** après tout changement visible (propriétaire, survol, vue, supply…) |
| Eau | `siteIdx[i] < 0` → bleu sombre + moiré ; bord d'eau sans trait de frontière |
| Motifs de terrain | `motifTerrain(t, x, y)` — un `case` par terrain, réutilisé par la légende. Appliqué **après** la teinte de camp et le relief de supply dans `construireFond` : à pleine amplitude, sinon la teinte écrase la signature du terrain |
| Vue Ravitaillement | `etat.vueSupply` (bouton `#bSupply`) : surcouche dans `construireFond` — fond normal conservé, contraste de supply exagéré, rouge si supply nul, ambre si axe saturé |
| Convois | `dessinerConvois` (vue Ravitaillement seulement) : points circulant sur chaque arête de `etat.arbreSupply`, nombre = `charge`, vitesse = `debit` — un axe saturé rampe |
| Axe de ravitaillement | corps sélectionné → tracé vert pointillé vers son dépôt (`axeRavitaillement`), anneau rouge + % sur le goulot — dans `dessiner` |
| Portée de dépôt | survol d'un dépôt (`pointermove`, `interaction.js`) → `etat.porteeDepot` via `porteeDepuis` ; provinces à portée éclaircies dans `construireFond` |
| Pions | Dessinés chaque frame dans `dessiner` : position animée `u.ax`/`u.ay`, force en k, jauge de moral, liseré pulsant si encerclé |
| Animation d'un jour | `main.js` : `etat.anim` 0→1 sur `DUREE_ANIM = 480 ms` (ease in-out), départ `u.dx`/`u.dy` posé par `tour()` |
| Lecture auto | `main.js` : un `tour()` toutes les 260 ms si `etat.auto`, en laissant finir les marqueurs de bataille |
| Marqueurs de bataille | `dessinerBatailles` : lit `etat.batailles` (rempli par `combat()`, avec `xa`/`ya` = origine de l'assaut) — trait d'assaut animé, halo, éclats, lames fébriles, cartouche de pertes opaque jusqu'au dernier quart ; progression `b.t` sur `DUREE_BATAILLE = 2400 ms` (`main.js`) |
| Itinéraires + badges | Dans `dessiner` : tracé de `o.chemin`, badge « J-n » sur la prochaine étape, « obj. nj » si plusieurs sauts |
| Aperçu d'ordre | `etat.apercu` posé par `pointermove` (`interaction.js`), dessiné en pointillés avec latence + date d'arrivée |
| Fiches | `ficheUnite` / `ficheProv` / `ficheVide` (`js/hud.js`) → `#fiche` |
| Journal | `journal(txt)` (`js/hud.js`) : préfixe J-jour, 60 lignes max — seule sortie autorisée de la logique |
| Compteurs d'effectifs | `majCompteurs` → `#cptRouge` / `#cptBleu` |
| Sélection / ordre à la souris | `pointerdown` (`interaction.js`) : corps bleu → sélection ; province → ordre ; sa propre case → annulation |
| Boutons | `#bStep`, `#bEvent` (avance rapide `avancerJusquEvenement`), `#bAuto`, `#bSupply`, `#bCamps`, `#bReset`, `#bAngers` — câblés dans `interaction.js` |
| Teinte de camps | `etat.teinteCamps` (bouton `#bCamps`, actif par défaut) : coupe la surimpression rouge/bleu dans `construireFond` — le terrain apparaît nu, les frontières et le relief de supply restent |
| Ombre de front | `distanceAuFront()` (chamfer L1 sur le raster, recalculé à chaque `construireFond`) : dégradé de couleur de camp sur `OMBRE_FRONT` px de chaque côté du front — toujours visible, y compris teinte de camps coupée |

## Ajouter un élément visuel sur la carte

1. Statique (dépend de l'état des provinces) → dans `construireFond`, et poser `etat.sale = true` là où l'état change.
2. Animé ou par-dessus (pions, tracés, étiquettes) → dans `dessiner`, après le `drawImage` du fond ; coordonnées × `sx`/`sy` (échelle canvas), jamais en pixels raster bruts.
3. Ne jamais calculer de règle de jeu ici : lire `etat`, appeler la logique.

## Ajouter un bouton ou une interaction

1. `index.html` : le `<button id="…">` dans le bloc `.cmd`.
2. `interaction.js` : câblage (`getElementById` local), état pressé via `aria-pressed`.
3. Si l'action est asynchrone (cf. `bAngers`) : désactiver le bouton pendant l'attente, resets journal/auto/date comme `bReset`.
4. Texte utilisateur en français, style télégraphique du HUD existant.
