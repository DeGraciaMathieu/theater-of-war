import { TERRAINS, PORTEE, ROUGE, BLEU } from "./config.js";
import { etat, ennemiSur } from "./etat.js";
import { journal } from "./hud.js";

export function calculerSupply(){
  const prov = etat.prov;
  for (const p of prov) p.supply = 0;
  for (const camp of [ROUGE, BLEU]){
    const dist = new Float32Array(prov.length).fill(Infinity);
    const parent = new Int16Array(prov.length).fill(-1);
    const ordre = [];
    for (const p of prov){
      if (p.proprio === camp && p.depot && !ennemiSur(p.id, camp)) dist[p.id] = 0;
    }
    // Dijkstra naïf (assez rapide à cette échelle, lisible en proto).
    // Les prédécesseurs forment l'arbre de ravitaillement : c'est lui qui
    // porte ensuite la charge, donc la saturation des axes.
    const vus = new Uint8Array(prov.length);
    while (true){
      let u = -1, bd = Infinity;
      for (let i = 0; i < prov.length; i++)
        if (!vus[i] && dist[i] < bd){ bd = dist[i]; u = i; }
      if (u === -1 || bd === Infinity) break;
      vus[u] = 1; ordre.push(u);
      for (const v of prov[u].voisins){
        const pv = prov[v];
        if (pv.proprio !== camp) continue;      // le corridor doit être ami…
        if (ennemiSur(v, camp)) continue;       // …et libre d'ennemis
        const c = TERRAINS[pv.terrain].cout * (pv.ville ? 0.55 : 1);
        if (dist[u] + c < dist[v]){ dist[v] = dist[u] + c; parent[v] = u; }
      }
    }

    // 1. chaque corps fait remonter sa demande jusqu'au dépôt
    for (const p of prov) if (p.proprio === camp){ p.charge = 0; p.congestion = 1; p.debit = 0; }
    for (const u of etat.unites){
      if (u.camp !== camp) continue;
      const besoin = u.force / 12000;
      let c = u.prov, garde = 0;
      while (c !== -1 && garde++ < prov.length){
        if (prov[c].proprio === camp) prov[c].charge += besoin;
        c = parent[c];
      }
    }

    // 2. congestion locale, puis goulot le long de l'axe (l'ordre de Dijkstra
    //    garantit que le parent est déjà calculé)
    for (const id of ordre){
      const p = prov[id];
      p.cap = TERRAINS[p.terrain].debit * (p.ville ? 2.2 : 1) * (p.depot ? 3 : 1);
      p.congestion = Math.min(1, p.cap / Math.max(0.0001, p.charge));
      const par = parent[id];
      p.debit = par === -1 ? p.congestion : Math.min(p.congestion, prov[par].debit);
    }

    // 3. le ravitaillement reçu = ce que la distance laisse passer,
    //    rogné par le maillon le plus saturé de la chaîne.
    //    Courbe en √ : relève le milieu de portée (le front vit vers d≈9)
    //    sans étendre la portée max — au-delà de PORTEE, c'est toujours zéro.
    for (const p of prov){
      if (p.proprio !== camp) continue;
      // relie = il existe un corridor vers un dépôt. À distinguer de
      // « ravitaillé à 0 % » : trop loin n'est pas coupé.
      p.relie = dist[p.id] < Infinity;
      p.supply = !p.relie ? 0
               : Math.sqrt(Math.max(0, 1 - dist[p.id] / PORTEE)) * p.debit;
    }
  }
  alerterSaturation();
  detecterPoches();
}

// Repérer les poches — composantes connexes de provinces sans corridor,
// avec des troupes dedans. C'est ce qui rend la manœuvre lisible.
function detecterPoches(){
  const prov = etat.prov;
  etat.poches = [];
  const vus = new Uint8Array(prov.length);
  for (const depart of prov){
    if (vus[depart.id] || !depart.proprio || depart.relie) continue;
    const groupe = [], file = [depart.id];
    vus[depart.id] = 1;
    while (file.length){
      const c = file.shift(); groupe.push(c);
      for (const v of prov[c].voisins)
        if (!vus[v] && prov[v].proprio === depart.proprio && !prov[v].relie){
          vus[v] = 1; file.push(v);
        }
    }
    const dedans = etat.unites.filter(u => groupe.includes(u.prov) && u.camp === depart.proprio);
    if (!dedans.length) continue;
    etat.poches.push({
      camp: depart.proprio,
      provs: groupe,
      corps: dedans.length,
      hommes: dedans.reduce((s,u) => s + u.force, 0),
      cx: groupe.reduce((s,i) => s + prov[i].cx, 0) / groupe.length,
      cy: groupe.reduce((s,i) => s + prov[i].cy, 0) / groupe.length,
    });
  }

  // signaler la bascule, pas l'état : une ligne au moment exact de la coupure
  const neufs = [];
  for (const u of etat.unites){
    const coupe = !prov[u.prov].relie && prov[u.prov].proprio === u.camp;
    if (coupe && !u.coupe){ u.coupe = etat.jour; neufs.push(u); }
    else if (!coupe) u.coupe = 0;
  }
  for (const po of etat.poches){
    const dedans = neufs.filter(u => po.provs.includes(u.prov));
    if (!dedans.length) continue;
    const h = dedans.reduce((s,u) => s + u.force, 0);
    const qui = po.camp === ROUGE ? "rouges" : "bleus";
    journal(`<b style="color:#e0a53c">POCHE</b> — ${dedans.length} corps ${qui} coupés, ${h.toLocaleString("fr-FR")} hommes isolés`);
  }
}

// Prévenir le joueur quand un de ses axes commence à céder sous la charge
function alerterSaturation(){
  for (const p of etat.prov){
    if (p.proprio !== BLEU){ p.alerte = false; continue; }
    if (p.congestion < 0.6 && p.charge > 0.5 && !p.alerte){
      p.alerte = true;
      journal(`<b>Axe saturé</b> province ${p.id} · ${Math.round(p.charge*12)}k desservis pour ${Math.round(p.cap*12)}k de capacité`);
    } else if (p.congestion > 0.8) p.alerte = false;
  }
}

export function distQG(u){
  const prov = etat.prov;
  const qg = prov.find(p => p.qg && p.proprio === u.camp);
  if (!qg) return 8;
  const d = new Int16Array(prov.length).fill(-1);
  d[qg.id] = 0; const f = [qg.id];
  while (f.length){
    const c = f.shift();
    if (c === u.prov) return d[c];
    for (const v of prov[c].voisins)
      if (d[v] === -1 && prov[v].proprio === u.camp){ d[v] = d[c]+1; f.push(v); }
  }
  return 12;
}
