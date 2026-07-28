# PRD — Scénarios asymétriques

## Objectif

Aujourd'hui chaque partie démarre sur un dispositif rigoureusement symétrique : les
deux camps reçoivent la même composition (`ARMEE`), le même nombre de dépôts et un
partage du théâtre quasi équilibré. Résultat : la posture de départ est toujours la
même (deux fronts miroir qui se poussent). On veut pouvoir décrire des **scénarios**
où le dispositif initial est déséquilibré — attaquant en supériorité pressé par le
temps, défenseur retranché en infériorité, tête de pont à réduire — pour que la
question stratégique change d'une partie à l'autre. Le joueur reste l'Alliance (BLEU).

## Existant technique

- **`js/theatres.js`** — catalogue `THEATRES`. Chaque entrée porte aujourd'hui
  `{ id, nom, description, disponible, generer }`. `generer` pointe sur `genererCarte`.
  Le clic d'accueil (`interaction.js:101`) appelle `t.generer()`.
- **`js/carte.js › genererCarte()`** — génère les provinces puis appelle
  `installerTheatre()`.
- **`js/carte.js › installerTheatre()`** — partage initial du théâtre :
  `t = (p.x/RW)*0.62 + (1 - p.y/RH)*0.38; p.proprio = t > 0.5 ? ROUGE : BLEU`.
  Puis `poserBase(ROUGE, RW*0.86, RH*0.16)` et `poserBase(BLEU, RW*0.14, RH*0.84)`.
- **`js/carte.js › poserBase(camp, x, y)`** — pose **2 dépôts d'arrière** espacés,
  **1 dépôt avancé**, marque le **QG** (`tries[0].qg = camp`), puis crée les corps :
  `ARMEE.front` corps au contact (force tirée dans `forceFront`) et `ARMEE.reserve`
  corps en réserve à mi-profondeur (force dans `forceReserve`). Nombre de dépôts et
  composition **codés en dur / lus depuis la constante partagée**.
- **`js/config.js › ARMEE`** = `{ front:6, forceFront:[11000,24000], reserve:3,
  forceReserve:[14000,20000], moral:[88,98] }`. **Une seule table pour les deux camps.**
- **`js/etat.js › alea()`** — tirages de force/moral/placement, graine-able.

Point d'extension : `poserBase` et le partage de `installerTheatre` sont les deux
seuls endroits qui matérialisent l'asymétrie voulue. Aucun ne lit la page.

## Comportement

### Structure de configuration

Chaque entrée de `THEATRES` peut porter un champ optionnel `setup` :

```js
setup: {
  partage: 0.62,          // seuil du gradient de partage (défaut 0.5 → symétrique-ish)
  rouge: { front, forceFront, reserve, forceReserve, depots },
  bleu:  { front, forceFront, reserve, forceReserve, depots },
}
```

- `setup` **absent** ⇒ comportement actuel exact (symétrie, `ARMEE` pour les deux,
  2 dépôts d'arrière + 1 avancé, partage `0.62/0.38`). **Non-régression garantie.**
- Chaque sous-objet de camp **surcharge** les champs fournis ; les champs absents
  retombent sur `ARMEE`. `depots` = nombre de **dépôts d'arrière** (défaut 2) ; le
  dépôt avancé (1) et le QG (1) restent systématiques — ce sont des invariants du
  moteur logistique et de la condition de victoire.
- `partage` déplace le seuil du gradient existant : `> 0.5` donne plus de territoire
  à la Fédération (front avancé côté Alliance), `< 0.5` l'inverse.

### Déroulé nominal

1. `t.generer()` reçoit le `setup` du théâtre (ou `undefined`).
2. `installerTheatre(setup)` applique `setup.partage` au gradient, puis appelle
   `poserBase(ROUGE, …, setup?.rouge)` et `poserBase(BLEU, …, setup?.bleu)`.
3. `poserBase(camp, x, y, cfg)` lit `cfg.front ?? ARMEE.front`, etc., et pose
   `cfg.depots ?? 2` dépôts d'arrière.

### Scénarios livrés (catalogue initial)

| Scénario | partage | Alliance (BLEU) | Fédération (ROUGE) | Intention |
|---|---|---|---|---|
| **Percée** | 0.55 | 8 corps front, forces hautes, 2 dépôts | 4 front / 2 réserve, 1 dépôt d'arrière | Le joueur attaque en supériorité, peu de profondeur ennemie à percer avant que l'IA se réorganise |
| **Tenir la ligne** | 0.45 | 4 front / 3 réserve, forces basses, 3 dépôts | 8 corps, forces hautes | Le joueur défend en infériorité, doit tenir ses dépôts |
| **Rencontre** | 0.50 | symétrique mais réserve nulle (0) | idem | Tout est déjà au contact, pas de masse de manœuvre |

Valeurs exactes à figer en équilibrage (voir Risques). Chaque scénario est une
entrée `THEATRES` supplémentaire avec `disponible:true` et un `setup`.

## Hors-scope

- **Le joueur ne peut pas incarner la Fédération.** `joueur = BLEU` reste un invariant
  (rendu, journal, IA, compteurs en dépendent). Décision explicitement reportée.
- **Objectifs de victoire** : traités par le PRD #4. Ici la condition reste la capture
  du QG / réduction des dépôts. Un scénario asymétrique peut se jouer avec l'objectif
  par défaut.
- **Taille / terrain de la carte** : traités par le PRD #5.
- Pas de tempérament d'IA par scénario (idée annexe, autre PRD).

## Impacts par couche

| Couche | Impact |
|---|---|
| `config.js` / `etat.js` | `ARMEE` devient le **fallback** (défauts) et non plus l'unique source. Aucun nouveau champ d'`etat` : le `setup` est consommé à la génération, pas stocké. |
| logique (`carte.js`) | `installerTheatre(setup)` et `poserBase(camp, x, y, cfg)` paramétrés. Le calcul du partage lit `setup.partage`. Aucune autre logique touchée (supply, combat, IA restent aveugles au setup). |
| `theatres.js` | Nouvelles entrées de catalogue portant `setup`. Les `generer` passent leur `setup` à la génération. |
| rendu / hud / interaction / index.html | Néant côté logique. Éventuellement afficher le nom du scénario dans le journal d'ouverture (déjà fait par `journal()` dans `installerTheatre`). |
| `tests/` | Tests macro : setup asymétrique ⇒ bons nombres de corps/dépôts par camp ; `setup` absent ⇒ dispositif identique à l'actuel (non-régression). |

## Critères d'acceptation

- Lancer « Percée » : l'Alliance a strictement plus de corps au contact que la
  Fédération, et la Fédération a moins de dépôts d'arrière.
- Lancer « Tenir la ligne » : l'Alliance démarre en infériorité de puissance totale.
- Lancer la « Carte procédurale » (sans `setup`) : dispositif rigoureusement identique
  à l'actuel (même nombre de corps et de dépôts par camp qu'avant le changement).
- Chaque camp conserve toujours exactement 1 QG et 1 dépôt avancé, quel que soit le
  scénario.

## Tests

- `setup` de test avec `bleu.front = 8, rouge.front = 3` ⇒ compter les corps de
  chaque camp au contact après génération.
- `setup` avec `rouge.depots = 1` ⇒ compter `prov.filter(depot && proprio===ROUGE)`
  = 1 (arrière) + 1 (avancé) = 2 dépôts, plus le QG.
- Absence de `setup` ⇒ 6 corps front + 3 réserve par camp, 3 dépôts par camp (comme
  aujourd'hui).
- Graine fixe + même `setup` ⇒ dispositif reproductible.

## Risques & questions ouvertes

- **Équilibrage.** Les fourchettes de force par scénario sont à régler au jeu ; le PRD
  fixe la mécanique, pas les chiffres définitifs. Risque qu'un scénario asymétrique
  soit trivialement gagné/perdu — à valider en playtest.
- **Placement des corps quand `front` dépasse le nombre de provinces de contact.**
  `poserBase` boucle déjà `i < ARMEE.front && i < front.length` : un `front` élevé sur
  un petit front sera silencieusement tronqué. Décider si on `log()` la troncature
  (cohérence avec la convention « pas de cap silencieux »).
- **`reserve = 0`** (scénario Rencontre) : vérifier que la boucle de placement de
  réserve et l'IA d'acheminement (`ia.js` étape 3) se comportent bien sans réserve.
- **Interaction avec le PRD #4** : un scénario « Tenir la ligne » n'a de sens qu'avec
  l'objectif « tenir X jours ». Les deux PRD sont livrables séparément mais le catalogue
  final gagnera à coupler setup et objectif dans la même entrée.
