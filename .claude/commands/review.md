---
description: Revue complète des changements en cours — conventions, tests, maintenabilité, cohérence système
---

Fais une revue complète des changements en cours de ce dépôt.

## Périmètre

1. Lis `CLAUDE.md` (les conventions y font foi).
2. Récupère le périmètre : `git diff`, `git diff --cached`, `git status`, `git log --oneline -5`.
3. **S'il n'y a aucun changement (diffs vides, pas de fichier non suivi), dis-le et arrête-toi là.**

## Vérifications, point par point

**Conventions (CLAUDE.md)**
- État de jeu uniquement dans l'objet `etat` (`js/etat.js`) — aucun `let` d'état au niveau module.
- Logique (`logistique`, `ordres`, `combat`, `ia`, `carte`, `angers`) sans accès DOM hors `journal()`.
- Pas de logique métier dans `rendu.js` / `hud.js` / `interaction.js`.
- Constantes d'équilibrage dans `config.js`, pas en dur.
- Aléatoire via `alea()`, jamais `Math.random()`.
- `etat.sale = true` posé pour tout changement visible de la carte.
- Français (code, commentaires, textes UI), terminologie du domaine respectée.
- Aucune dépendance npm ajoutée, pas de build introduit.

**Couverture de tests**
- Chaque comportement nouveau ou modifié a un test macro dans `tests/` (cf. mapping du skill `testing`).
- Les tests sont des invariants robustes à l'aléatoire, pas des détails d'implémentation.

**Maintenabilité**
- Couplage : les dépendances entre modules suivent le sens documenté dans le skill `architecture` (pas de nouvel import logique → DOM, pas de cycle).
- Responsabilité unique : chaque fonction fait une chose ; signaler les fonctions qui mélangent calcul et affichage.
- Duplication : signaler toute formule ou constante dupliquée (ex. la latence doit rester dans `estimerOrdre` seul).
- Complexité/longueur : signaler les fonctions devenues difficiles à suivre.
- Nommage : français, cohérent avec l'existant (`calculerX`, `dessinerX`, `ficheX`…).
- Magic values : tout chiffre de gameplay hors `config.js` est une violation.

**Cohérence système**
- Intégration : le changement passe par les points d'extension existants (`donnerOrdre` pour l'IA, `etat.batailles` pour l'affichage des combats, `voisins` pour la topologie…).
- Forme de l'état : les nouveaux champs suivent la forme des existants (initialisés dans `etat`/`creerProvince`/`creerUnite`, purgés dans `detruire` s'ils référencent des corps).
- Patterns : boutons câblés comme `bReset`/`bAngers`, fiches comme `ficheUnite`, etc.

## Finaliser

1. Lance `npm test` et rapporte le résultat réel.
2. Rapport structuré : une ligne par item ci-dessus avec statut **OK / VIOLATION / N/A** (+ fichier:ligne pour chaque violation).
3. Verdict global : prêt à commiter, ou liste ordonnée des corrections à faire.
