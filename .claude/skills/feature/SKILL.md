---
name: feature
description: "Use when l'utilisateur demande d'implémenter une fonctionnalité de jeu de bout en bout (règle, visuel, interaction, carte)."
user_invocable: true
---

# Workflow : implémenter une fonctionnalité

Dérouler les étapes dans l'ordre. Ne pas sauter la compréhension ni les tests.

## 1. Comprendre

- Reformuler la demande en une phrase avec la terminologie du jeu (province, corps, supply, poche…).
- Invoquer le skill `architecture` pour localiser les modules touchés ; le skill de domaine concerné pour le détail.
- Poser les questions de clarification **avant de coder**, via questions cliquables :
  - valeurs numériques (coûts, seuils, portées — elles iront dans `config.js`) ;
  - interactions avec l'existant (comment ça se combine avec supply/combat/IA ?) ;
  - cas limites (province d'eau, corps encerclé, partie finie, carte d'Angers vs procédurale).
- Si la demande est une restructuration : clarifier la structure cible exacte avant tout.

## 2. Implémenter

- Respecter `CLAUDE.md` : état dans `etat`, constantes dans `config.js`, logique hors DOM, `etat.sale = true` pour tout changement visible, français.
- Suivre les procédures « Ajouter un … » du skill de domaine concerné.
- Implémenter uniquement le périmètre validé — noter les idées annexes sans les coder.

## 3. Tester

- Ajouter le(s) test(s) macro selon le skill `testing` (carte-ruban, invariants robustes à l'aléatoire).
- `node --test tests/` → corriger jusqu'au vert. Après 2 tentatives infructueuses sur la même erreur, reprendre le plan au lieu d'insister.
- Vérifier aussi à la main dans le navigateur si le visuel est concerné (`python3 -m http.server`).

## 4. Synchroniser la doc

- Si le périmètre d'un skill change (nouveau concept, nouvelle procédure, nouveau fichier) : mettre à jour son `SKILL.md` et la table des skills de `CLAUDE.md`.
- Si une convention nouvelle est née : l'ajouter à `CLAUDE.md`.

## 5. Résumer

Terminer par : fichiers modifiés (avec quoi dedans), tests ajoutés et leur résultat, comportement obtenu, questions restées ouvertes. Proposer `/git-committer` sans l'exécuter de soi-même.
