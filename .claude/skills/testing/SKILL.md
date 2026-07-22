---
name: testing
description: "Use when tu dois lancer la suite de tests, écrire un nouveau test, ou décider quoi tester après un changement."
auto_invoke: true
---

# Tests

**Commande : `node --test tests/`** (ou `npm test`). Runner natif de Node ≥ 18, zéro dépendance. La suite doit être verte avant de déclarer une tâche terminée — le hook Stop (`scripts/run-tests.sh`) la relance de toute façon.

## Philosophie

- **Tests macro** : on vérifie le comportement fonctionnel (« un corps coupé capitule », « la percée fait décrocher le défenseur »), jamais les détails d'implémentation (pas d'assertion sur des valeurs internes précises, pas de mock de fonction).
- L'aléatoire (`alea()` graine sur `Date.now`) impose des **invariants robustes** : rapports de forces nets, propriétés structurelles (symétrie d'adjacence, comptages), jamais d'égalité sur un résultat qui dépend du tirage.
- Le DOM est neutralisé par `tests/stub-dom.js` — **à importer en première ligne de tout fichier de test**, sinon les imports du jeu plantent sous Node.
- La fixture de référence est la **carte-ruban** (`carteRuban()` dans `tests/outils.js`) : 6 provinces de plaine en ligne, dépôt+QG aux extrémités — on peut y calculer supply et chemins de tête. `poserCorps(camp, prov, force, moral)` ajoute un corps.

## Fichier de test → périmètre couvert

| Fichier | Couvre |
|---|---|
| `tests/generation.test.js` | `genererCarte` : nombre de provinces, symétrie d'adjacence, 3 dépôts + 1 QG + 8 corps par camp, supply initial |
| `tests/logistique.test.js` | `calculerSupply` : décroissance avec la distance, coupure (`relie`), poches, dépôt occupé par l'ennemi |
| `tests/ordres-combat.test.js` | Latence puis marche étape par étape, conquête d'une province vide, percée avec décrochage, capitulation par attrition |

Non couvert (assumé) : `rendu.js`, `hud.js`, `interaction.js`, `main.js` (affichage/DOM), `angers.js` (dépend du réseau — sa logique partagée est couverte via `carte.js`), `osm/`.

## Où placer un nouveau test

1. Le comportement relève d'un périmètre existant → compléter le fichier correspondant du tableau.
2. Nouveau sous-système → nouveau fichier `tests/<domaine>.test.js`, squelette : `import "./stub-dom.js";` puis `node:test` + `node:assert/strict` + `carteRuban`/`poserCorps`.
3. Si la carte-ruban ne suffit pas (eau, ponts…), construire la mini-carte à la main dans le test — ne pas complexifier la fixture commune.
4. Piloter le temps à la main comme dans `ordres-combat.test.js` : poser `etat.jour`, appeler `executerOrdres`/`attrition` directement plutôt que de boucler sur `tour()`.
5. Lancer `node --test tests/` et vérifier le vert avant de conclure.
