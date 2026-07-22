// ---- zone : bounding box autour d'Angers ------------------------------------
export const BBOX = { s:47.446, w:-0.598, n:47.505, e:-0.512 };
export const RW = 900, RH = 560;
export const NB_PROV = 200;

// terrains : mêmes rôles que le moteur de jeu (coût marche, débit, défense)
export const TERRAINS = [
  { nom:"plaine",   cout:1.0, def:1.00, debit:5.0, col:[122,132, 84] },
  { nom:"bocage",   cout:1.6, def:1.25, debit:3.6, col:[ 74,104, 58] },
  { nom:"bois",     cout:2.1, def:1.55, debit:2.6, col:[ 52, 84, 48] },
  { nom:"berges",   cout:2.6, def:1.15, debit:2.0, col:[ 78,110,116] },
  { nom:"urbain",   cout:1.2, def:1.35, debit:6.5, col:[150,132,104] },
];
export const T_PLAINE=0, T_BOCAGE=1, T_BOIS=2, T_BERGE=3, T_URBAIN=4;
