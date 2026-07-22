import { TERRAINS, ROUGE, BLEU } from "./config.js";
import { etat, alea, unitesDe, ravitaillement } from "./etat.js";
import { donnerOrdre } from "./ordres.js";

export function iaRouge(){
  const prov = etat.prov;
  const libres = etat.unites.filter(u => u.camp === ROUGE && !etat.ordres.some(o => o.unite === u.id));
  for (const u of libres){
    if (alea() < 0.35) continue;
    const p = prov[u.prov];
    // priorité : province bleue voisine faiblement tenue, sinon consolider
    const cibles = p.voisins.map(v => prov[v]).filter(q => q.proprio === BLEU);
    if (cibles.length){
      cibles.sort((a,b) => score(a) - score(b));
      donnerOrdre(u, cibles[0].id);
    } else if (ravitaillement(u) < 0.35){
      const repli = p.voisins.map(v => prov[v])
        .filter(q => q.proprio === ROUGE).sort((a,b) => b.supply - a.supply)[0];
      if (repli) donnerOrdre(u, repli.id);
    } else {
      const avance = p.voisins.map(v => prov[v])
        .filter(q => q.proprio === ROUGE &&
          q.voisins.some(w => prov[w].proprio === BLEU));
      if (avance.length) donnerOrdre(u, avance[(alea()*avance.length)|0].id);
    }
  }
  function score(q){
    const g = unitesDe(q.id).reduce((s,x) => s + x.force*(x.moral/100), 0);
    return g * TERRAINS[q.terrain].def - (q.depot ? 40000 : 0);
  }
}
