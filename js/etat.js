// état mutable partagé entre les modules, plus les requêtes élémentaires dessus
export const etat = {
  prov: [], unites: [], ordres: [], poches: [], batailles: [],
  siteIdx: null, imgData: null, rasterCv: null, rasterCtx: null,
  jour: 1, auto: false, vueSupply: false,
  anim: 0,                       // progression 0→1 de l'animation d'un jour
  selection: null, survol: -1, fini: false, sale: true, apercu: null,
  arbreSupply: {},               // parents du Dijkstra de supply, par camp — sert à tracer les axes
  porteeDepot: null,             // { prov, provs } : zone d'action du dépôt survolé
  accu: 0, dernier: 0,
  nextId: 1,
};

export const alea = (() => { let s = Date.now() % 2147483647;
  return () => (s = s * 48271 % 2147483647) / 2147483647; })();

export const ennemiSur = (provId, camp) => etat.unites.some(u => u.prov === provId && u.camp !== camp);
export const unitesDe = provId => etat.unites.filter(u => u.prov === provId);
export const ravitaillement = u => etat.prov[u.prov].proprio === u.camp ? etat.prov[u.prov].supply : 0;
