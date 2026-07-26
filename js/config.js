export const RW = 900, RH = 560;          // résolution du raster de provinces
export const NB_PROV = 220;
export const PORTEE = 15;                 // budget de coût logistique depuis un dépôt
export const AVANCE_DEPOT = 0.6;          // position du dépôt avancé : fraction du chemin coin → centre
export const AVANCE_MAX = 30;             // plafond de l'avance rapide : jamais plus de jours d'un coup
export const ROUGE = 1, BLEU = 2;
export const SEUIL_PERCEE = 0.58;         // part de la puissance totale qu'il faut à l'assaillant pour percer
export const ODDS = [[1,1],[3,2],[2,1],[5,2],[3,1]]; // rapports de forces de la table de résolution (regles.html)

// composition initiale d'un camp : des corps déployés au front + une réserve sur dépôt
export const ARMEE = {
  front: 6,  forceFront: [11000, 24000],   // 2/3 des corps au contact
  reserve: 3, forceReserve: [14000, 20000], // 1/3 en retrait sur le dépôt d'arrière
  moral: [88, 98],
};

// « debit » = capacité de transit, en points de ravitaillement (1 pt ≈ 12 000 hommes)
// 0-4 : terrains de la carte procédurale · 5 bois et 7 urbain : les deux cartes · 6 berges : carte OSM
export const TERRAINS = [
  { nom:"plaine",   cout:1.0, def:1.00, debit:5.0, col:[122,132, 84] },
  { nom:"bocage",   cout:1.6, def:1.25, debit:3.6, col:[ 74,104, 58] },
  { nom:"collines", cout:2.1, def:1.45, debit:3.0, col:[150,128, 74] },
  { nom:"montagne", cout:3.2, def:1.85, debit:1.8, col:[136,120,110] },
  { nom:"marais",   cout:2.6, def:1.15, debit:2.2, col:[ 78,110,116] },
  { nom:"bois",     cout:2.1, def:1.55, debit:2.6, col:[ 52, 84, 48] },
  { nom:"berges",   cout:2.6, def:1.15, debit:2.0, col:[ 78,110,116] },
  { nom:"urbain",   cout:1.2, def:1.35, debit:6.5, col:[150,132,104] },
];
