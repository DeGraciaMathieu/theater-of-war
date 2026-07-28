import { TERRAINS, ROUGE, BLEU, IA } from "./config.js";
import { etat, alea, ennemiSur, unitesDe, ravitaillement } from "./etat.js";
import { donnerOrdre } from "./ordres.js";
import { journal } from "./hud.js";

// IA rouge « stratège » : elle défend ses dépôts, puis choisit un axe d'effort
// (Schwerpunkt) qu'elle ne lâche que sur condition — en visant d'abord les
// provinces bleues dont la chute coupe le plus d'arrière (logistique offensive
// → poches), pas la garnison la plus faible. Hors de l'axe, elle ne saisit que
// les opportunités déjà gagnables, et s'abstient en infériorité au contact.
// Ses réserves marchent au front en évitant ses propres axes saturés. Elle
// passe toujours par donnerOrdre, comme le joueur ; jamais de mutation directe.
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
  const contactBleu = q => q.proprio === BLEU
      && q.voisins.some(v => prov[v].proprio === ROUGE);
  const faible = q => !q.relie
      || q.voisins.filter(v => prov[v].proprio === ROUGE).length > q.voisins.length/2;

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

  // accessibilité bleue vers les dépôts si la province `exclu` passait au rouge :
  // sert à mesurer combien d'arrière bleu une prise couperait (création de poche)
  const accessibleBleu = exclu => {
    const vus = new Uint8Array(prov.length);
    const file = [];
    for (const p of prov)
      if (p.proprio === BLEU && p.depot && p.id !== exclu && !ennemiSur(p.id, BLEU)){
        vus[p.id] = 1; file.push(p.id);
      }
    while (file.length){
      const c = file.shift();
      for (const v of prov[c].voisins){
        if (vus[v] || v === exclu) continue;
        if (prov[v].proprio !== BLEU || ennemiSur(v, BLEU)) continue;
        vus[v] = 1; file.push(v);
      }
    }
    return vus;
  };
  const gainCoupure = q => {
    const apres = accessibleBleu(q.id);
    let n = 0;
    for (const p of prov)
      if (p.proprio === BLEU && p.id !== q.id && p.relie && !apres[p.id]) n++;
    return n;
  };
  // valeur d'une cible : couper l'arrière prime sur frapper une garnison ;
  // la vulnérabilité et le dépôt avancé pèsent, la défense départage.
  const scoreCible = q => gainCoupure(q) * IA.poidsCoupure
      + (faible(q) ? IA.poidsVuln : 0)
      + (q.depot ? IA.bonusDepot : 0)
      - defense(q);

  // rassemble les corps rouges libres au contact de `q`, du plus fort au plus
  // faible, jusqu'à franchir le seuil de ratio — null si même massés ça ne passe pas
  const masser = q => {
    const dispo = q.voisins.map(v => prov[v]).filter(r => r.proprio === ROUGE)
        .flatMap(r => unitesDe(r.id)).filter(u => u.camp === ROUGE && libre(u))
        .sort((a,b) => puissance(b) - puissance(a));
    if (!dispo.length) return null;
    const seuil = IA.seuilAttaque - (faible(q) ? IA.bonusFaiblesse : 0);
    const pDef = defense(q);
    const assaut = []; let pAtt = 0;
    for (const u of dispo){
      assaut.push(u); pAtt += puissance(u);
      if (pAtt / (pAtt + pDef) >= seuil) break;
    }
    return pAtt / (pAtt + pDef) >= seuil ? assaut : null;
  };

  // 2. AXE D'EFFORT — tenir l'axe courant tant qu'il reste une province bleue de
  //    contact ; en choisir un sinon (plus haute valeur de coupure). On ne
  //    réévalue que sur invalidité : c'est ce qui casse l'oscillation d'un jour
  //    sur l'autre. L'axe est abandonné après trop d'assauts infructueux.
  const contacts = prov.filter(contactBleu);
  let axe = etat.iaAxe && prov[etat.iaAxe.prov] && contactBleu(prov[etat.iaAxe.prov])
      ? etat.iaAxe : null;
  if (!axe && contacts.length){
    // borne de coût : n'évaluer finement (gainCoupure) que les cibles les plus vulnérables
    const prioritaires = contacts.slice()
        .sort((a,b) => (faible(b) - faible(a)) || (defense(a) - defense(b)))
        .slice(0, IA.candidatsCoupure);
    let best = null, meilleur = -Infinity;
    for (const q of prioritaires){
      const s = scoreCible(q);
      if (s > meilleur){ meilleur = s; best = q; }
    }
    if (best){
      axe = { prov: best.id, depuis: etat.jour, blocage: 0 };
      journal(`La Fédération concentre son effort sur la province ${best.id}.`);
    }
  }
  if (axe){
    const assaut = masser(prov[axe.prov]);
    if (assaut){ for (const u of assaut) donnerOrdre(u, axe.prov); axe.blocage = 0; }
    else if (++axe.blocage >= IA.patienceAxe) axe = null;   // inattaquable trop longtemps
  }
  etat.iaAxe = axe;

  // 3. OPPORTUNITÉS — hors de l'axe, ne frapper que ce qui est déjà gagnable
  //    avec les corps restés libres. En infériorité de puissance au contact,
  //    l'IA s'en abstient pour ne pas se disperser (posture prudente).
  const puisRouge = etat.unites
      .filter(u => u.camp === ROUGE && auContact(u)).reduce((s,u) => s + puissance(u), 0);
  const puisBleu = contacts.reduce((s,q) => s + garnison(q), 0);
  if (puisRouge >= IA.seuilPosture * puisBleu)
    for (const q of contacts){
      if (axe && q.id === axe.prov) continue;
      const assaut = masser(q);
      if (assaut) for (const u of assaut) donnerOrdre(u, q.id);
    }

  // 4. ACHEMINEMENT — les corps d'arrière marchent vers la province rouge de
  //    contact la plus proche, en évitant un front déjà saturé quand un autre
  //    est disponible (désengorgement). L'inertie évite le pas cadencé.
  const fronts = prov.filter(p => p.proprio === ROUGE
      && p.voisins.some(v => prov[v].proprio === BLEU));
  if (fronts.length){
    for (const u of rouges()){
      if (auContact(u) || alea() < IA.inertie) continue;
      const tries = fronts.slice().sort((a,b) => distA(u,a) - distA(u,b));
      const dest = tries.find(f => f.congestion >= IA.congestionMin) || tries[0];
      donnerOrdre(u, dest.id);
    }
  }
}
