---
name: prd
description: "Use when l'utilisateur veut spécifier une fonctionnalité avant de la coder : produire un PRD. N'implémente rien."
user_invocable: true
---

# Workflow : rédiger un PRD

Document de spécification uniquement — **aucune implémentation, aucun fichier de code modifié**.

## 1. Explorer l'existant technique

Lire le code réel (via les skills `architecture` et de domaine) pour établir ce qui existe déjà : modules concernés, état disponible dans `etat`, constantes de `config.js`, formules en place (supply, combat, latence), points d'extension identifiés. Cette section se remplit par la lecture du code, pas en interrogeant l'utilisateur.

## 2. Poser les décisions produit

Uniquement les questions que le code ne tranche pas, via questions cliquables (AskUserQuestion) : comportement attendu, valeurs d'équilibrage, priorités, ce qui est hors-scope. Pas de question dont la réponse est dans le dépôt.

## 3. Rédiger le PRD

Format fixe, en français, terminologie du jeu :

```markdown
# PRD — <titre>

## Objectif
<le problème joueur / l'intention, en 2-3 phrases>

## Existant technique
<ce que le code fait déjà, fichiers et fonctions réels à l'appui>

## Comportement
<spécification précise, règles chiffrées, déroulé nominal>

## Hors-scope
<ce qu'on ne fait explicitement pas>

## Impacts par couche
| Couche | Impact |
|---|---|
| config.js / etat.js | <constantes, nouveaux champs d'état> |
| logique (logistique/ordres/combat/ia/carte/angers) | <règles> |
| rendu / hud / interaction / index.html | <visuels, boutons, fiches> |
| tests/ | <tests macro à prévoir> |

## Critères d'acceptation
<liste vérifiable, du point de vue du joueur>

## Tests
<les tests macro qui matérialiseront les critères>

## Risques & questions ouvertes
<équilibrage incertain, interactions douteuses, décisions reportées>
```

Livrer le PRD dans la conversation (ou dans un fichier si demandé) et s'arrêter là.
