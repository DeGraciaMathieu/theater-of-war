# Théâtre — wargame opérationnel

Wargame de logistique en navigateur : le joueur (Alliance, bleu) commande des corps d'armée sur une carte de provinces procédurale — contre l'IA (Fédération, rouge), où le ravitaillement décide de tout. L'import OSM d'une ville réelle (`js/angers.js`, géocodage Nominatim + Overpass) existe mais est débranché de l'interface pour le moment.

## Stack

- **Vanilla JS (modules ES natifs), HTML, CSS.** Aucune dépendance, aucun build, aucun framework. Le `package.json` ne sert qu'à marquer `"type": "module"` pour Node — ne jamais y ajouter de dépendance sans discussion préalable.
- **Dev** : servir la racine en HTTP (`python3 -m http.server`), ouvrir `index.html`. Pas de rechargement à chaud.
- **Test** : `node --test "tests/*.test.js"` (ou `npm test`) — glob obligatoire, les Node récents n'acceptent plus un dossier en argument. Stub DOM dans `tests/stub-dom.js`.
- **Lint/format** : aucun outil. Les conventions ci-dessous font foi.
- **Prod** : Vercel, site statique. `vercel.json` fournit les proxys Overpass `/api/overpass` et `/api/overpass-kumi` (contournement CORS).

## Conventions de code

- **Tout l'état de jeu vit dans l'objet `etat` de `js/etat.js`.** Jamais de variable d'état de module (`let` au niveau module) ailleurs : un nouvel élément d'état = un nouveau champ de `etat`, initialisé dans l'objet.
- **Séparation des couches.** La logique (`logistique.js`, `ordres.js`, `combat.js`, `ia.js`, `carte.js`, `angers.js`) ne lit jamais la page : son seul effet visible est `journal()` de `hud.js`. Le DOM appartient à `hud.js`, `rendu.js`, `interaction.js`, `tour.js` (chaque module fait ses propres `getElementById`, pas de module « dom » central). **Jamais de logique métier dans `rendu.js`, `hud.js` ou `interaction.js`** : ils lisent `etat` et appellent la logique, ils ne décident rien.
- **Constantes d'équilibrage dans `js/config.js`** (`TERRAINS`, `PORTEE`, `NB_PROV`, `RW`/`RH`) — pas de magic value de gameplay enfouie dans la logique.
- **Nommage et commentaires en français**, terminologie du domaine : province, corps, camp (`ROUGE`/`BLEU` = Fédération/Alliance), ravitaillement (supply), débit, congestion, poche, `relie`, dépôt, QG, latence de transmission, marche, moral, attrition, percée. Messages des commits en anglais.
- **Aléatoire uniquement via `alea()`** (`js/etat.js`), jamais `Math.random()` : le générateur est graine-able.
- **Rendu** : le fond raster (504 000 pixels) n'est reconstruit que si `etat.sale === true` ; tout changement visible de l'état de la carte doit poser `etat.sale = true`, jamais redessiner le fond à chaque frame.
- Style compact du dépôt : commentaires qui expliquent le *pourquoi* (jamais le *quoi*), pas de point-virgule manquant, pas de classe — fonctions et objets nus.
- `osm/` est le prototype standalone d'origine (déjà intégré au jeu via `js/angers.js`) : ne pas y faire évoluer de logique de jeu.

## Comportement

- **Ne jamais déclarer une tâche terminée sans avoir lancé les tests (`npm test`) et vérifié qu'ils passent.**
- **Si une approche échoue après 2 tentatives, reprendre le plan avant de continuer** — ne pas s'enfoncer.
- Avant toute restructuration de code, clarifier la structure cible exacte avec l'utilisateur.
- Implémenter uniquement ce qui est demandé ; noter les idées annexes, ne pas les coder.
- Si un changement modifie le périmètre d'un skill ou une convention ci-dessus, mettre à jour ce fichier et le skill concerné dans le même travail.

## Skills disponibles

| Skill | Périmètre |
|---|---|
| `architecture` | Carte du projet : rôle et dépendances de chaque module, où placer du nouveau code |
| `generation-carte` | `carte.js` + `angers.js` : provinces, Voronoï, eau, ponts, terrains |
| `logistique` | `logistique.js` : supply Dijkstra, congestion, poches, `relie` |
| `ordres-combat` | `ordres.js` + `combat.js` + `ia.js` : chemins, latence, résolution, attrition, IA |
| `rendu-interaction` | `rendu.js` + `hud.js` + `interaction.js` + `main.js` : raster, pions, fiches, boucle |
| `testing` | Lancer et écrire les tests macro (`tests/`) |
| `feature` | Workflow complet d'implémentation d'une fonctionnalité |
| `prd` | Rédiger un PRD (spécification) sans implémenter |
