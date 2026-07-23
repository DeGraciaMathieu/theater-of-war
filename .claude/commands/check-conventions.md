---
description: Vérification rapide des conventions du projet sur les changements en cours
---

Vérifie que les changements en cours respectent les conventions du projet.

1. Lis `CLAUDE.md`.
2. Récupère le périmètre : `git diff`, `git diff --cached`, `git status`, `git log --oneline -5`.
3. **S'il n'y a aucun changement, dis-le et arrête-toi là.**
4. Vérifie point par point, uniquement sur les fichiers touchés :
   - état de jeu dans `etat` uniquement, pas de `let` d'état de module ;
   - logique sans DOM (hors `journal()`), pas de métier dans rendu/hud/interaction ;
   - constantes d'équilibrage dans `config.js` ;
   - `alea()` et non `Math.random()` ; `etat.sale = true` si visuel impacté ;
   - français + terminologie du domaine ; pas de dépendance ni de build ajoutés.
5. Cohérence tests/doc : si le comportement a changé, `tests/` suit (mapping du skill `testing`) ; si un périmètre de skill a changé, le `SKILL.md` et la table de `CLAUDE.md` suivent.
6. Lance `npm test` et rapporte le résultat réel.
7. Rapport : un statut **OK / VIOLATION / N/A** par item (fichier:ligne pour les violations), puis verdict global en une phrase.
