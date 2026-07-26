import { TERRAINS, ROUGE, BLEU, IA } from "./config.js";
import { etat, alea, unitesDe, ravitaillement } from "./etat.js";
import { donnerOrdre } from "./ordres.js";

// IA rouge « opportuniste » : elle évalue le théâtre puis agit en quatre temps —
// défendre les dépôts menacés, masser sur la province bleue la plus vulnérable,
// fondre sur les faiblesses (coupées, débordées), acheminer les réserves au feu.
// Elle passe toujours par donnerOrdre, comme le joueur ; jamais de mutation directe.
export function iaRouge(){
  const prov = etat.prov;
  const libre = u => !etat.ordres.some(o => o.unite === u.id);
  const rouges = () => etat.unites.filter(u => u.camp === ROUGE && libre(u));

  // puissance effective calquée sur combat.js (force × moral × ravitaillement) :
  // c'est elle, pas la garnison brute, qui dit si un assaut est gagnable
  const puissance = u => u.force * (u.moral/100) * (0.35 + 0.65*ravitaillement(u));
  const garnison = q => unitesDe(q.id).reduce((s,x) => s + puissance(x), 0);
  const defense = q => garnison(q) * TERRAINS[q.terrain].def;
  const auContact = u => prov[u.prov].voisins.some(v => prov[v].proprio === BLEU);
  const distA = (u, q) => Math.hypot(prov[u.prov].x - q.x, prov[u.prov].y - q.y);

  // 1. DÉFENSE — un dépôt/QG rouge dont la menace bleue voisine dépasse sa
  //    couverture rappelle la réserve la plus proche pour le tenir.
  for (const d of prov){
    if (d.proprio !== ROUGE || !(d.depot || d.qg)) continue;
    const menace = d.voisins.map(v => prov[v])
        .filter(q => q.proprio === BLEU).reduce((s,q) => s + garnison(q), 0);
    if (menace === 0) continue;
    const couverture = garnison(d) + d.voisins.map(v => prov[v])
        .filter(q => q.proprio === ROUGE).reduce((s,q) => s + garnison(q), 0);
    if (menace <= couverture * IA.menaceDepot) continue;
    const secours = rouges().filter(u => !auContact(u))
        .sort((a,b) => distA(a,d) - distA(b,d))[0];
    if (secours) donnerOrdre(secours, d.id);
  }

  // 2. ATTAQUE — évaluer chaque province bleue de contact et masser dessus. Le
  //    seuil de ratio chute face à une cible coupée de l'arrière ou débordée
  //    (majorité de voisins rouges) : c'est là que l'opportuniste frappe même
  //    sans supériorité franche. On vise d'abord la plus vulnérable.
  const faible = q => !q.relie
      || q.voisins.filter(v => prov[v].proprio === ROUGE).length > q.voisins.length/2;
  const contact = prov.filter(q => q.proprio === BLEU
      && q.voisins.some(v => prov[v].proprio === ROUGE))
      .sort((a,b) => (faible(b)*1e9 - defense(b)) - (faible(a)*1e9 - defense(a)));
  for (const q of contact){
    const dispo = q.voisins.map(v => prov[v]).filter(r => r.proprio === ROUGE)
        .flatMap(r => unitesDe(r.id)).filter(u => u.camp === ROUGE && libre(u))
        .sort((a,b) => puissance(b) - puissance(a));
    if (!dispo.length) continue;
    const seuil = IA.seuilAttaque - (faible(q) ? IA.bonusFaiblesse : 0);
    const pDef = defense(q);
    // masser du plus fort au plus faible jusqu'à franchir le seuil de ratio
    const assaut = [];
    let pAtt = 0;
    for (const u of dispo){
      assaut.push(u); pAtt += puissance(u);
      if (pAtt / (pAtt + pDef) >= seuil) break;
    }
    if (pAtt / (pAtt + pDef) < seuil) continue;   // même massés, ça ne passe pas : on attend des renforts
    for (const u of assaut) donnerOrdre(u, q.id);
  }

  // 3. ACHEMINEMENT — les corps d'arrière (réserves) marchent vers la province
  //    rouge de contact la plus proche : ils gagnent le front et alimenteront
  //    la concentration au tour suivant. L'inertie évite le pas cadencé.
  const fronts = prov.filter(p => p.proprio === ROUGE
      && p.voisins.some(v => prov[v].proprio === BLEU));
  if (fronts.length){
    for (const u of rouges()){
      if (auContact(u) || alea() < IA.inertie) continue;
      const dest = fronts.slice()
          .sort((a,b) => distA(u,a) - distA(u,b))[0];
      donnerOrdre(u, dest.id);
    }
  }
}
