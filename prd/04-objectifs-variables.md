# PRD — Objectifs de victoire variables

## Objectif

La condition de victoire est aujourd'hui unique et implicite : prendre le QG adverse
ou raser ses trois dépôts. Toutes les parties se jouent donc sur le même tempo — une
poussée frontale jusqu'à l'effondrement logistique ennemi. On veut pouvoir attribuer à
un scénario un **objectif** différent (prendre une province-clé désignée, tenir une
échéance, contrôler la majorité du théâtre) pour changer la nature de la partie sans
toucher au moteur de simulation.

## Existant technique

- **`js/tour.js › verifierFin()`** — appelée à chaque `tour()`. Logique actuelle :
  - QG rouge capturé par BLEU ⇒ **victoire** ; QG bleu capturé par ROUGE ⇒ **défaite** ;
  - `dr === 0` (plus aucun dépôt rouge) ou plus aucune unité rouge ⇒ **victoire** ;
  - `db === 0` ou plus aucune unité bleue ⇒ **défaite**.
  - Pose `etat.fini = true`, coupe l'auto, désactive les boutons, écrit dans `journal()`.
- **`js/tour.js › boucleAvance()`** — l'avance rapide s'arrête sur événement
  (`etat.fini`, combat, corps perdu, poche, etc.). Une échéance de temps n'est pas un
  motif d'arrêt aujourd'hui.
- **`js/etat.js`** — `etat.jour` (compteur), `etat.prov` (chaque province a `proprio`,
  `depot`, `qg`), `etat.unites`. Pas de champ d'objectif ni de jour-limite.
- **`js/carte.js › poserBase()`** — marque `depot` et `qg` sur les provinces. C'est ici
  qu'une province-cible pourrait être désignée à la génération.
- **`js/hud.js › journal()`** — seul canal de message ; `installerTheatre()` écrit déjà
  « Objectif : prendre les 3 dépôts adverses. » à l'ouverture.

Point d'extension : `verifierFin()` est le **seul** juge de fin. Tout objectif se
ramène à un test évalué là, plus l'ajout d'un motif d'arrêt d'échéance dans
`boucleAvance()`.

## Comportement

### Structure de configuration

Chaque entrée de `THEATRES` peut porter un champ optionnel `objectif` :

```js
objectif: {
  type: "capture" | "tenir" | "majorite",
  // selon le type :
  jourLimite: 40,     // "tenir" et "majorite" : échéance
  seuil: 0.6,         // "majorite" : part de provinces à détenir
  // "capture" : la cible est une province marquée à la génération (voir ci-dessous)
}
```

- `objectif` **absent** ⇒ condition actuelle exacte (capture QG / réduction des
  dépôts, symétrique pour les deux camps). **Non-régression garantie.**
- L'objectif est décrit **du point de vue du joueur (Alliance/BLEU)**. La condition de
  défaite reste la symétrie : la Fédération applique la condition par défaut (prendre
  le QG bleu / raser les dépôts bleus), sauf mention contraire du type.

### Types d'objectif

**`capture` — prendre une province-cible désignée.**
- À la génération, une province ennemie est marquée `cible: BLEU` (l'Alliance doit la
  prendre). Choix de la cible : le **dépôt avancé** rouge par défaut (déjà « un objectif
  à défendre » selon le commentaire de `poserBase`), ou une province explicitement
  désignée par le scénario.
- Victoire dès que `provCible.proprio === BLEU`. Généralise le QG actuel (le QG est le
  cas particulier `cible = QG`).
- Défaite : condition par défaut (QG bleu tombé) — asymétrie assumée, le joueur a un
  objectif ponctuel, il perd s'il s'effondre.

**`tenir` — tenir jusqu'à une échéance.**
- Victoire de l'Alliance si `etat.jour >= jourLimite` **et** son QG et au moins un
  dépôt tiennent encore.
- Défaite si le QG bleu tombe / plus de dépôts bleus **avant** l'échéance (conditions
  actuelles), ou si une province-cible désignée à défendre est prise par ROUGE.
- **`boucleAvance()` doit s'arrêter à l'échéance** : nouveau motif « échéance atteinte »
  quand `etat.jour >= jourLimite`, pour ne pas dépasser la fin en avance rapide.

**`majorite` — contrôler la majorité du théâtre.**
- Victoire de l'Alliance si, à l'échéance `jourLimite`, elle détient
  `bleues / total >= seuil` des provinces (`total` = provinces non-eau).
- À l'échéance, si le seuil n'est pas atteint ⇒ défaite (ou match nul selon décision,
  cf. Risques).
- Contrôle intermédiaire : pas de victoire anticipée (la majorité peut fluctuer) — le
  juge ne tranche qu'à `jourLimite`. Arrêt d'avance rapide à l'échéance comme `tenir`.

### Affichage

- À l'ouverture, `journal()` annonce l'objectif en clair (remplace la ligne
  « Objectif : prendre les 3 dépôts adverses. » selon le type).
- Pour `tenir` / `majorite`, l'échéance figure dans le message (ex. « Tenez jusqu'au
  jour 40 »). Le compteur de jour existant (`#date`) suffit au suivi ; pas de nouveau
  widget d'échéance requis (hors-scope, cf. Risques).

## Hors-scope

- **Objectif « infliger N pertes »** : écarté (nécessiterait un compteur de pertes
  cumulées dans `etat`, absent aujourd'hui).
- **Objectifs multiples / à points** : un seul objectif par scénario.
- **Widget HUD dédié d'échéance / de progression** : le journal + le compteur de jour
  suffisent pour ce PRD. Un bandeau d'objectif permanent est une amélioration séparée.
- **Objectif propre à la Fédération** : l'IA garde la condition par défaut ; on ne
  spécifie pas d'objectif rouge distinct (le joueur est toujours BLEU).

## Impacts par couche

| Couche | Impact |
|---|---|
| `config.js` / `etat.js` | Nouveau champ `etat.objectif` (copié depuis le scénario à la génération, ou `null`). Éventuel champ `cible` sur une province (`creerProvince`). |
| logique (`carte.js`, `tour.js`) | `poserBase()` / `installerTheatre()` marquent la province-cible et posent `etat.objectif`. `verifierFin()` évalue selon `etat.objectif.type` (fallback = logique actuelle). `boucleAvance()` : nouveau motif d'arrêt « échéance atteinte ». |
| rendu / hud / interaction / index.html | `journal()` d'ouverture adapté au type d'objectif. Aucun nouveau bouton. |
| `tests/` | Un test macro par type : `capture` (prendre la cible ⇒ `fini` + victoire), `tenir` (atteindre `jourLimite` intact ⇒ victoire ; perdre le QG avant ⇒ défaite), `majorite` (seuil atteint/non atteint à l'échéance). Non-régression : `objectif` absent ⇒ conditions actuelles. |

## Critères d'acceptation

- Scénario `capture` sur le dépôt avancé rouge : prendre ce dépôt met fin à la partie
  en victoire, même si les autres dépôts rouges tiennent.
- Scénario `tenir` (jourLimite 40) : atteindre le jour 40 avec le QG bleu debout ⇒
  victoire ; l'avance rapide **s'arrête** au jour 40 sans le dépasser.
- Scénario `majorite` (seuil 0.6, jourLimite 30) : détenir ≥ 60 % des provinces au
  jour 30 ⇒ victoire ; sinon défaite. Aucune fin déclenchée avant le jour 30 par le
  seul décompte de provinces.
- Sans `objectif` : conditions de fin identiques à aujourd'hui (QG / dépôts).

## Tests

- `capture` : forcer `provCible.proprio = BLEU`, appeler `tour()`, vérifier
  `etat.fini` et le message de victoire.
- `tenir` : avancer jusqu'à `jourLimite` avec QG intact ⇒ victoire ; retirer le QG
  bleu avant ⇒ défaite. Vérifier que `avancerJusquEvenement()` retourne le motif
  « échéance atteinte » au bon jour.
- `majorite` : construire un état où BLEU détient 60 % / 59 % des provinces à
  l'échéance ⇒ victoire / défaite respectivement.
- Non-régression : `etat.objectif = null` ⇒ suite `verifierFin` actuelle intacte.

## Risques & questions ouvertes

- **Match nul.** `majorite` et `tenir` à l'échéance : faut-il un état « nul » distinct
  de victoire/défaite ? Le moteur ne connaît que victoire/défaite binaire. Proposition :
  échéance non satisfaite = défaite (pas de nul), à confirmer.
- **Double condition simultanée.** Un même `tour()` peut satisfaire l'objectif ET une
  condition de défaut (ex. QG bleu tombe le jour de l'échéance). Fixer la priorité
  d'évaluation (proposition : la défaite l'emporte, cohérent avec l'ordre actuel qui
  teste la capture du QG en premier).
- **Interaction avance rapide.** `AVANCE_MAX = 30` borne le nombre de jours par saut ;
  une échéance à 40 jours nécessitera plusieurs sauts. Le motif « échéance atteinte »
  doit primer sur « rien à signaler » pour éviter de sur-avancer.
- **Cible sur carte OSM** : `angers.js` est débranché ; ne pas s'appuyer sur une cible
  qui suppose la géométrie procédurale.
- **Couplage scénario/objectif.** Un objectif `tenir` n'a de sens qu'avec un dispositif
  défensif (PRD #3). Livrables séparés, mais le catalogue final couplera `setup` et
  `objectif` dans la même entrée de `THEATRES`.
