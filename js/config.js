export const RW = 900, RH = 560;          // résolution du raster de provinces
export const NB_PROV = 220;
export const PORTEE = 15;                 // budget de coût logistique depuis un dépôt
export const ROUGE = 1, BLEU = 2;

// « debit » = capacité de transit, en points de ravitaillement (1 pt ≈ 12 000 hommes)
export const TERRAINS = [
  { nom:"plaine",   cout:1.0, def:1.00, debit:5.0, col:[122,132, 84] },
  { nom:"bocage",   cout:1.6, def:1.25, debit:3.6, col:[ 74,104, 58] },
  { nom:"collines", cout:2.1, def:1.45, debit:3.0, col:[150,128, 74] },
  { nom:"montagne", cout:3.2, def:1.85, debit:1.8, col:[136,120,110] },
  { nom:"marais",   cout:2.6, def:1.15, debit:2.2, col:[ 78,110,116] },
];
