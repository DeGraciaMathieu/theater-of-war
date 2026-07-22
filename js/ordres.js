import { TERRAINS, BLEU } from "./config.js";
import { etat, ennemiSur, unitesDe, ravitaillement } from "./etat.js";
import { distQG } from "./logistique.js";
import { combat } from "./combat.js";
import { journal } from "./hud.js";

// Itinéraire jusqu'à une province quelconque. Traverser du terrain ennemi
// reste possible mais coûte cher : l'état-major préfère les axes tenus.
export function cheminVers(u, cible){
  const prov = etat.prov;
  const dist = new Float32Array(prov.length).fill(Infinity);
  const par = new Int16Array(prov.length).fill(-1);
  const vus = new Uint8Array(prov.length);
  dist[u.prov] = 0;
  while (true){
    let c = -1, bd = Infinity;
    for (let i = 0; i < prov.length; i++)
      if (!vus[i] && dist[i] < bd){ bd = dist[i]; c = i; }
    if (c === -1 || c === cible) break;
    vus[c] = 1;
    for (const v of prov[c].voisins){
      const pv = prov[v];
      const cout = TERRAINS[pv.terrain].cout
                 * (pv.proprio === u.camp ? 1 : 2.5)
                 * (ennemiSur(v, u.camp) ? 2 : 1);
      if (dist[c] + cout < dist[v]){ dist[v] = dist[c] + cout; par[v] = c; }
    }
  }
  if (dist[cible] === Infinity) return null;
  const chemin = [];
  for (let c = cible; c !== u.prov && c !== -1; c = par[c]) chemin.unshift(c);
  return chemin.length && chemin.length <= 12 ? chemin : null;
}

export const marche = provId => Math.max(1, Math.round(TERRAINS[etat.prov[provId].terrain].cout));

// Estimation partagée entre l'aperçu (survol) et l'ordre réel, pour qu'ils
// affichent exactement le même nombre de jours.
export function estimerOrdre(u, chemin){
  const rav = ravitaillement(u);
  const latence = Math.max(1, Math.round(1 + distQG(u)/4 + (rav < 0.4 ? 2 : 0)));
  let marches = 0;
  for (const p of chemin) marches += marche(p);
  return { latence, marches, total: latence + marches };
}

export function donnerOrdre(u, cible){
  if (cible === u.prov) return;
  annulerOrdre(u);
  const chemin = cheminVers(u, cible);
  if (!chemin) return;
  const { latence } = estimerOrdre(u, chemin);
  etat.ordres.push({ unite:u.id, chemin, idx:0, transmis:false,
                     transmisLe: etat.jour + latence,
                     arrive: etat.jour + latence + marche(chemin[0]) });
  if (u.camp === BLEU)
    journal(`<b>${u.nom}</b> → ${chemin.length} province${chemin.length>1?"s":""}, transmission ${latence} j`);
}

export function annulerOrdre(u){ etat.ordres = etat.ordres.filter(o => o.unite !== u.id); }

export function executerOrdres(){
  const prov = etat.prov, ordres = etat.ordres;
  for (let i = ordres.length - 1; i >= 0; i--){
    const o = ordres[i];
    const u = etat.unites.find(x => x.id === o.unite);
    if (!u){ ordres.splice(i,1); continue; }
    if (etat.jour < o.arrive) continue;

    let etape = o.chemin[o.idx];
    // le front a bougé sous les pieds du corps : on recalcule l'itinéraire
    if (!prov[u.prov].voisins.includes(etape)){
      const neuf = cheminVers(u, o.chemin[o.chemin.length-1]);
      if (!neuf){ ordres.splice(i,1); continue; }
      o.chemin = neuf; o.idx = 0; etape = neuf[0];
      o.arrive = etat.jour + marche(etape);
      continue;
    }

    const cible = prov[etape];
    const def = unitesDe(etape).filter(x => x.camp !== u.camp);
    let passe = true;

    if (def.length) passe = combat(u, def, cible);
    else {
      u.prov = etape;
      if (cible.proprio !== u.camp){
        cible.proprio = u.camp;
        if (cible.depot) journal(`<b>Dépôt de ${etape} pris</b> par ${u.nom}.`);
      }
    }

    if (!passe){ ordres.splice(i,1); continue; }   // repoussé : l'ordre tombe
    o.idx++;
    if (o.idx >= o.chemin.length) ordres.splice(i,1);
    else o.arrive = etat.jour + marche(o.chemin[o.idx]);
  }
}
