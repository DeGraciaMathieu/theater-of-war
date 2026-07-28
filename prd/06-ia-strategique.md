# PRD — IA stratégique (axe d'effort, logistique offensive, enveloppement)

## Objectif

L'IA rouge (`iaRouge`) est purement réactive : elle recalcule tout chaque jour, sans
mémoire ni objectif de long terme, ignore la logistique adverse à l'attaque, et ne
conçoit aucune manœuvre globale. Résultat : elle **oscille** (masse ici aujourd'hui,
là demain, n'aboutit nulle part), s'use en assauts frontaux, et ne menace jamais les
artères de ravitaillement bleues — alors que couper le supply est le cœur du jeu. On
veut une IA qui **choisit un axe d'effort et s'y tient**, qui **frappe les nœuds
logistiques** plutôt que les garnisons brutes, et qui **encercle** un saillant plutôt
que de le prendre de face. Le joueur reste l'Alliance (BLEU).

## Existant technique

- **`js/ia.js › iaRouge()`** — trois temps successifs, appelés une fois par jour :
  1. **Défense** : chaque dépôt/QG rouge dont la menace bleue voisine dépasse
     `couverture × IA.menaceDepot` rappelle la réserve libre la plus proche.
  2. **Attaque** : trie les provinces bleues de contact par vulnérabilité
     (`faible(q) = !q.relie || majorité de voisins rouges`), puis pour **chacune**
     masse les corps rouges voisins du plus fort au plus faible jusqu'à franchir
     `seuil = IA.seuilAttaque − (faible ? IA.bonusFaiblesse : 0)`. Choix de cible
     réévalué intégralement chaque jour → oscillation.
  3. **Acheminement** : chaque réserve libre marche vers la province rouge de contact
     la plus proche (`IA.inertie` en temporise une fraction). Tout converge vers le
     front le plus proche → congestion auto-infligée.
- **Puissance effective** (calquée sur `combat.js`, seule mesure qui compte pour l'IA) :
  `puissance(u) = u.force × (u.moral/100) × (0.35 + 0.65 × ravitaillement(u))`.
- **`js/tour.js:19-20`** — `calculerSupply()` tourne **juste avant** `iaRouge()`.
  L'IA a donc, sans recalcul, tout l'état logistique du jour.
- **État logistique disponible par province** (posé par `logistique.js`) :
  `p.relie` (bool : corridor vers un dépôt), `p.congestion`, `p.debit`, `p.charge`,
  `p.cap`, `p.proprio`, `p.depot`, `p.qg`. Les poches sont dans `etat.poches`
  (composantes connexes de provinces sans corridor).
- **`js/config.js › IA`** = `{ inertie:0.08, seuilAttaque:0.50, bonusFaiblesse:0.22,
  menaceDepot:1.1 }` — tous les leviers d'équilibrage.
- **`js/etat.js`** — tout l'état de jeu ; `alea()` graine-able. Aucun champ d'IA
  persistant aujourd'hui.
- **`js/carte.js › reinitialiser()`** — remet l'état à zéro à chaque génération.

Point d'extension : tout tient dans `iaRouge` (lecture d'`etat`, ordres via
`donnerOrdre`) et dans la constante `IA`. La logistique adverse est **déjà calculée**,
il suffit de la *lire* offensivement. Un seul nouveau champ d'état persistant est
nécessaire (l'axe d'effort mémorisé).

## Comportement

Livraison **en trois phases** ; la phase 1 (axe d'effort) est le socle, les phases 2
et 3 s'y accrochent. Le nouveau comportement **remplace** l'IA actuelle (toujours
actif, y compris carte procédurale) — pas de drapeau ni de fallback sur l'ancienne
logique.

### Phase 1 — Axe d'effort persistant (Schwerpunkt)

Nouvel état : `etat.iaAxe = { prov, depuis } | null` (`prov` = id de la province bleue
ciblée, `depuis` = `etat.jour` de fixation). Initialisé à `null` dans `etat` et remis à
`null` dans `reinitialiser()`.

Au début de l'étape d'attaque :

1. **Validité de l'axe courant.** L'axe est abandonné (repassé à `null`) si l'une des
   conditions tient :
   - la province ciblée n'est plus bleue (capturée, ou passée en poche déjà réduite) ;
   - elle n'est plus au contact d'aucune province rouge (front décollé) ;
   - elle est restée **inattaquable `IA.patienceAxe` jours** d'affilée : même en massant
     tous les corps rouges voisins libres, le ratio ne franchit pas le seuil.
2. **Sélection d'un nouvel axe** (si `null`) : parmi les provinces bleues de contact,
   choisir celle de **score de cible** maximal (voir Phase 2). Mémoriser
   `{ prov, depuis: etat.jour }`.
3. **Concentration.** L'étape d'attaque masse **en priorité sur l'axe** : elle y
   engage les corps rouges voisins comme aujourd'hui (du plus fort au plus faible
   jusqu'au seuil). Les autres provinces de contact ne sont attaquées que si un assaut
   y est **déjà** gagnable sans y détourner de corps de l'axe (opportunités gratuites).

Effet : l'IA cesse d'osciller ; elle pousse un secteur jusqu'à percée ou abandon motivé.

### Phase 2 — Logistique offensive (choix de cible mixte)

Remplace le tri « par vulnérabilité » par un **score de cible** combinant vulnérabilité
et valeur logistique. Pour chaque province bleue de contact `q` :

- **`gainCoupure(q)`** = nombre de provinces bleues qui **perdraient `relie`** si `q`
  tombait. Calcul : sur les `IA.candidatsCoupure` provinces de contact les plus
  faibles seulement (borne de coût), simuler `q.proprio = ROUGE` et recompter
  l'accessibilité bleue vers les dépôts (même parcours que `logistique.js`), puis
  restaurer. Une province qui isole tout un arrière vaut beaucoup plus qu'une province
  isolée.
- **Bonus dépôt avancé** : si `q` est le dépôt avancé bleu (`q.depot`), ajouter
  `IA.bonusDepot` — il projette le ravitaillement au front, le neutraliser l'ampute.
- **Score** = `gainCoupure(q) × IA.poidsCoupure + faible(q) × IA.poidsVuln
  − defense(q)`. La cible d'axe (Phase 1) est le `q` de score max.

**Désengorgement (étape acheminement).** Au lieu d'envoyer toutes les réserves vers le
front rouge le plus proche, répartir : une réserve évite une province rouge de contact
dont la `congestion` dépasse `IA.congestionMax` et vise la suivante par distance. Réduit
la pénalité de débit auto-infligée.

### Phase 3 — Enveloppement

- **Détection de saillant** : une province bleue de contact dont **la majorité stricte
  des voisins** sont rouges (`> voisins.length × IA.seuilSaillant`) est un saillant
  encerclable.
- **Pince** : plutôt qu'un assaut frontal, l'IA ordonne aux corps rouges des **deux
  provinces rouges voisines les plus écartées** de converger sur les provinces bleues
  *adjacentes au saillant qui le relient encore à l'arrière*, pour le transformer en
  **poche** (couper `relie`) — il dépérira par attrition sans combat coûteux
  (`combat.js` inflige déjà l'attrition aux poches). Un saillant vaut alors comme axe
  d'effort à part entière, choisi via le `gainCoupure` de Phase 2.
- **Posture par secteur** : si la puissance rouge totale au contact est inférieure à
  `IA.seuilPosture ×` la puissance bleue au contact, l'IA se limite à l'axe + défense
  (pas d'attaques d'opportunité), pour ne pas se disperser en infériorité.

### Déroulé nominal (après refonte)

1. `calculerSupply()` (déjà là) → état logistique du jour.
2. `iaRouge()` : **valider/choisir l'axe** (Phase 1) via le **score de cible** (Phase 2),
   détecter les **saillants** (Phase 3) ; défendre les dépôts ; masser sur l'axe ;
   récolter les assauts gratuits ; acheminer les réserves en évitant la congestion.
3. Tout passe par `donnerOrdre`, comme aujourd'hui.

## Hors-scope

- **Le joueur reste BLEU** — l'IA ne pilote que ROUGE (invariant du moteur).
- **Tempérament par scénario** (agressif / prudent selon l'entrée `THEATRES`) : le
  comportement livré est unique et toujours actif. Le couplage avec le `setup` du PRD 03
  est une évolution ultérieure.
- **Planification à horizon fixe / arbre de décision** : la mémoire se limite à l'axe
  d'effort courant, pas de plan multi-étapes conditionnel.
- **Latence, combat, supply** : formules inchangées. L'IA lit l'état, ne modifie pas le
  moteur.
- **IA côté bleu / didacticiel** : hors sujet.

## Impacts par couche

| Couche | Impact |
|---|---|
| `config.js` / `etat.js` | `IA` gagne : `patienceAxe`, `poidsCoupure`, `poidsVuln`, `bonusDepot`, `candidatsCoupure`, `congestionMax`, `seuilSaillant`, `seuilPosture`. `etat` gagne **un** champ : `iaAxe` (init `null`, remis à `null` dans `reinitialiser()`). |
| logique (`ia.js`) | Refonte de `iaRouge` : validation/sélection d'axe, score de cible avec `gainCoupure` (mini-parcours d'accessibilité réutilisant la logique de `logistique.js`), concentration sur l'axe, détection de saillant + pince, désengorgement. Aucune autre logique touchée. |
| logique (`logistique.js`) | Éventuel export d'un helper d'accessibilité réutilisable par `ia.js` pour `gainCoupure` (sinon duplication locale d'un BFS/Dijkstra léger). À trancher à l'implémentation. |
| rendu / hud / interaction / index.html | Néant fonctionnel. Option lisible : `journal()` annonce l'axe d'effort choisi / abandonné (« La Fédération concentre son effort sur X »). |
| tests/ | Tests macro : persistance de l'axe sous graine fixe ; `gainCoupure` élevé priorisé ; désengorgement ; réduction en poche d'un saillant. La non-régression de l'ancienne IA **ne s'applique plus** (comportement remplacé) : les tests fixent le nouveau comportement déterministe. |

## Critères d'acceptation

- **Persistance** : sous graine fixe, l'IA attaque la **même province** plusieurs jours
  d'affilée tant qu'elle est valide, au lieu d'en changer chaque jour.
- **Abandon motivé** : quand la cible est capturée ou décolle du front, l'axe est
  refixé le jour suivant (pas de blocage sur une cible morte).
- **Logistique offensive** : à défense comparable, l'IA préfère une province dont la
  chute crée une poche bleue à une province sans valeur de coupure.
- **Enveloppement** : un saillant bleu majoritairement entouré de rouge est réduit en
  poche (perte de `relie`) plutôt que pris par assaut frontal systématique.
- **Désengorgement** : l'IA ne fait pas transiter toutes ses réserves par une même
  province saturée quand un axe voisin est libre.
- Tous les ordres de l'IA passent par `donnerOrdre` ; aucune mutation directe d'unité.

## Tests

- Graine fixe, N tours : l'id de `etat.iaAxe.prov` est stable tant que la province
  reste bleue et au contact (persistance).
- Cible artificielle A (`gainCoupure` élevé, défense moyenne) vs B (`gainCoupure` nul,
  même défense) ⇒ l'axe se fixe sur A.
- Après capture de la province d'axe, `iaAxe` est réévalué (non `null` figé sur une
  province rouge).
- Deux fronts rouges disponibles, l'un saturé (`congestion` haute) : les réserves se
  répartissent au lieu de toutes viser le saturé.
- Saillant bleu construit à la main (majorité de voisins rouges) ⇒ après quelques
  tours, ses provinces de liaison passent en poche.

## Risques & questions ouvertes

- **Coût de `gainCoupure`.** Simuler la coupure = re-parcourir l'accessibilité bleue par
  candidat. Borné à `IA.candidatsCoupure` provinces, mais à surveiller sur grande carte.
  Alternative moins chère à évaluer : proxy structurel (nombre de voisins bleus qui
  n'ont pas d'autre voisin relié) au lieu d'une vraie simulation.
- **Réutilisation vs duplication.** Exporter un helper d'accessibilité de
  `logistique.js` évite la duplication mais élargit son API ; un BFS local dans `ia.js`
  garde la logistique fermée. Décision d'implémentation à cadrer.
- **Équilibrage.** Les poids (`poidsCoupure`, `poidsVuln`, `bonusDepot`) et seuils
  (`patienceAxe`, `seuilSaillant`, `seuilPosture`, `congestionMax`) sont à régler au
  jeu ; le PRD fixe la mécanique, pas les chiffres définitifs. Risque qu'une IA trop
  focalisée sur un axe soit contournée par le flanc — à valider en playtest.
- **Remplacement de l'IA actuelle.** Toutes les parties changent d'équilibrage d'un
  coup (choix « toujours actif »). Les tests d'IA existants décrivant l'ancien
  comportement devront être réécrits, pas seulement complétés.
- **Interaction PRD 03.** Un scénario asymétrique « Tenir la ligne » suppose une IA
  rouge en supériorité qui exploite bien son axe ; le tempérament par scénario (couplage
  `setup` ↔ agressivité) reste un PRD distinct mais gagnera à réutiliser ces leviers.
- **`reserve = 0` (scénario Rencontre, PRD 03).** L'étape d'acheminement désengorgée
  doit rester correcte sans aucune réserve à acheminer.
