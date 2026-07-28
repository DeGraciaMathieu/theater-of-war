# PRD — Modificateurs de carte à l'accueil

## Objectif

La carte procédurale est toujours générée avec les mêmes réglages : 220 provinces,
mêmes proportions de terrain (fixées par quantiles), 13 % de villes. Deux parties
diffèrent par le tirage, jamais par la « forme » du théâtre. On veut donner au joueur,
à l'accueil, quelques **réglages** (taille du théâtre, biais de terrain, densité de
villes) qui changent le caractère de la carte avant de lancer — un petit théâtre nerveux
ou un vaste front logistique, une carte de plaine ouverte ou un massif montagneux.

## Existant technique

- **`js/carte.js › genererCarte()`** — génère tout en dur :
  - `NB_PROV` sites (échantillonnage meilleur candidat) ;
  - deux champs de bosses (`champBosses`) pour relief et végétation ;
  - seuils de terrain par **quantiles fixes** : `q(hauteurs, 0.15)` marais,
    `0.35` bocage, `0.72` collines, `0.9` montagne, `q(vegetation, 0.8)` bois ;
  - villes : `const ville = alea() < 0.13`.
- **`js/config.js`** — `NB_PROV = 220`, `RW = 900`, `RH = 560`. Les seuils de terrain
  ne sont **pas** dans config (ils sont codés dans `genererCarte`).
- **`js/theatres.js`** — `generer: genererCarte` (appelé sans argument).
- **`js/interaction.js:94-102`** — construit l'accueil : un `<button>` par théâtre,
  `b.onclick = () => { t.generer(); elAccueil.hidden = true; }`.
- **`index.html`** — bloc `.accueil` / `.accueil-boite` / `#accueilChoix`. Pas de
  contrôle de réglage.
- **`js/etat.js › alea()`** — graine-able ; tout le tirage en dépend.

Point d'extension : `genererCarte` doit accepter un objet de paramètres surchargeant
les valeurs codées ; l'accueil doit exposer ces paramètres et les passer au clic.

## Comportement

### Paramètres de génération

`genererCarte(opts)` accepte un objet optionnel :

```js
opts = {
  nbProv,          // nombre de provinces (défaut NB_PROV = 220)
  biaisTerrain,    // "plaine" | "equilibre" | "montagneux" (défaut "equilibre")
  densiteVilles,   // "rare" | "normal" | "dense" (défaut "normal")
}
```

- `opts` **absent / champs absents** ⇒ valeurs actuelles exactes. **Non-régression.**
- **`nbProv`** — presets exposés à l'accueil :
  - *Petit* ≈ 140 · *Moyen* = 220 (défaut) · *Grand* ≈ 300.
- **`biaisTerrain`** — décale les quantiles de relief (le reste de l'algo inchangé) :
  - *plaine* : seuils collines/montagne relevés (moins de reliefs), marais/bocage
    ~inchangés → théâtre ouvert, fort débit ;
  - *équilibré* : quantiles actuels (0.15 / 0.35 / 0.72 / 0.9) ;
  - *montagneux* : seuils collines/montagne abaissés → plus de terrain défensif et de
    goulots logistiques.
- **`densiteVilles`** — remplace le seuil `0.13` :
  - *rare* ≈ 0.07 · *normal* = 0.13 · *dense* ≈ 0.20.

Les presets (valeurs numériques) sont regroupés — proposition : constantes dédiées
dans `config.js` (`PRESETS_CARTE`) pour respecter « pas de magic value de gameplay
enfouie dans la logique ».

### Accueil

- Le bloc d'accueil du **théâtre procédural** expose trois sélecteurs (segmented
  buttons ou `<select>`) : Taille, Terrain, Villes, avec le défaut pré-sélectionné.
- Les réglages **n'apparaissent que pour le théâtre procédural** ; les autres théâtres
  du catalogue (indisponibles, ou futurs théâtres à géométrie fixe) n'affichent pas de
  réglage.
- Au clic « Lancer », l'accueil lit les sélecteurs et appelle
  `t.generer({ nbProv, biaisTerrain, densiteVilles })`.

### Déroulé nominal

1. Le joueur ajuste (ou non) les trois réglages.
2. Clic ⇒ `genererCarte(opts)` traduit les presets en valeurs (nbProv, quantiles,
   seuil ville) et génère.
3. `installerTheatre()` inchangé (partage, bases, supply). La suite du jeu ignore
   totalement les réglages : ils n'agissent qu'à la génération.

## Hors-scope

- **Régénérer sans repasser par l'accueil** (bouton « nouvelle carte » en jeu) :
  amélioration séparée.
- **Champ de graine partageable** : idée connexe (rejouabilité), PRD distinct.
- **Réglage fin par curseur continu** : on s'en tient à 3 presets par axe (lisibilité,
  équilibrage maîtrisé).
- **Réglages pour les théâtres à géométrie fixe** (Ukraine, OSM) : ils définiront leur
  propre carte ; ce PRD ne concerne que le procédural.
- Modifier le dispositif des armées ou l'objectif : PRD #3 et #4.

## Impacts par couche

| Couche | Impact |
|---|---|
| `config.js` / `etat.js` | Nouvel objet `PRESETS_CARTE` (valeurs de nbProv, décalages de quantiles, seuils de ville par preset). Pas de nouvel état persistant : `opts` est consommé à la génération. |
| logique (`carte.js`) | `genererCarte(opts)` : `nbProv` remplace `NB_PROV` dans la boucle de sites ; les quantiles de terrain deviennent fonction de `biaisTerrain` ; le seuil ville devient fonction de `densiteVilles`. `rasteriserVoronoi` / `installerTheatre` inchangés. |
| `theatres.js` | L'entrée procédurale signale qu'elle accepte des réglages (ex. flag `reglable: true`) pour que l'accueil sache afficher les sélecteurs. |
| rendu / hud / interaction / index.html | `index.html` : markup des 3 sélecteurs dans `.accueil-boite`. `interaction.js` : lire les sélecteurs et les passer à `t.generer(opts)`. `css/style.css` : style des sélecteurs. |
| `tests/` | `genererCarte({ nbProv: 140 })` ⇒ `etat.prov.length === 140`. `biaisTerrain: "montagneux"` ⇒ part de provinces montagne/collines strictement supérieure à `"plaine"`. `densiteVilles: "dense"` ⇒ plus de villes que `"rare"`. Non-régression : `genererCarte()` sans arg ⇒ 220 provinces, distribution actuelle. |

## Critères d'acceptation

- À l'accueil, le théâtre procédural montre trois réglages ; les autres non.
- « Petit » génère nettement moins de provinces que « Grand » (front continu préservé
  dans les deux cas).
- « Montagneux » produit visiblement plus de collines/montagnes que « Plaine ».
- « Dense » produit visiblement plus de villes que « Rare ».
- Lancer sans rien changer donne une carte statistiquement identique à l'actuelle
  (220 provinces, mêmes proportions par défaut).

## Tests

- `genererCarte({ nbProv: 140 })` puis `genererCarte({ nbProv: 300 })` ⇒ comparer
  `etat.prov.length`.
- `biaisTerrain` « montagneux » vs « plaine » ⇒ comparer le compte de provinces de
  terrain 2 (collines) + 3 (montagne).
- `densiteVilles` « dense » vs « rare » ⇒ comparer `prov.filter(p => p.ville).length`.
- Graine fixe + mêmes `opts` ⇒ carte reproductible (même distribution).
- `genererCarte()` sans argument ⇒ 220 provinces, seuils actuels.

## Risques & questions ouvertes

- **Bornes basses.** Un `nbProv` trop faible peut casser la continuité du front ou le
  placement des bases (`poserBase` suppose assez de provinces de contact et d'espacement
  entre dépôts, calibrés en `RW/420`). Fixer un plancher sûr (≈ 120) et le valider.
- **Espacement des dépôts dépendant de la densité.** `poserBase` espace les dépôts en
  pixels (`45*(RW/420)`) ; avec peu de provinces, deux dépôts d'arrière distincts
  peuvent devenir introuvables. À vérifier aux bornes.
- **Décalage des quantiles.** Déplacer un seuil peut vider une catégorie (ex. plus de
  marais en « plaine »). Choisir des décalages modérés et tester la présence de chaque
  terrain.
- **Coût de rastérisation.** `rasteriserVoronoi` parcourt 504 000 pixels quel que soit
  `nbProv` : « Grand » ne coûte pas plus cher au raster, mais plus de sites par bucket.
  Vérifier que 300 provinces restent fluides.
- **UI de l'accueil.** Trois sélecteurs ajoutent de la charge visuelle ; valider que
  l'accueil reste lisible et que les défauts sont évidents (un joueur qui ignore les
  réglages doit pouvoir lancer d'un clic).
