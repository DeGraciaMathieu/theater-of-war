---
description: Analyse la couverture de tests des changements en cours et propose les tests macro manquants
---

Analyse la couverture de tests des changements en cours.

1. Lis `CLAUDE.md` et le skill `testing` (philosophie macro, mapping fichier → périmètre, fixture carte-ruban).
2. Récupère le périmètre : `git diff`, `git diff --cached`, `git status`, `git log --oneline -5`.
3. **S'il n'y a aucun changement, dis-le et arrête-toi là.**
4. Pour chaque comportement ajouté ou modifié dans le diff, détermine :
   - s'il est couvert par un test existant de `tests/` (cite lequel) ;
   - sinon, propose le test macro manquant : nom du test, fichier cible (selon le mapping), invariant vérifié — en respectant la philosophie (comportement fonctionnel, robuste à l'aléatoire, pas de détail d'implémentation). Ignore rendu/hud/interaction/main et `osm/` (hors périmètre de test assumé).
5. **Présente la liste des tests proposés et attends la validation de l'utilisateur avant d'écrire quoi que ce soit** (questions cliquables si un choix se pose).
6. Une fois validés : écris les tests, puis relance `node --test tests/` jusqu'au vert.
7. Rapport final : couverture par comportement (**OK / MANQUANT→AJOUTÉ / N/A**), résultat réel de la suite, verdict global.
