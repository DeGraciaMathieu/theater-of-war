// état mutable partagé entre les modules (carte, rendu, interaction)
export const etat = {
  prov: [], siteIdx: null, eauMask: null, routes: [], rivieres: [],
  imgData: null, rasterCv: null, rasterCtx: null,
  survol: -1, vueDebit: false, sale: true,
  source: "—",
};
