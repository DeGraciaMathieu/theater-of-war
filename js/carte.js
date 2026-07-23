import { RW, RH, NB_PROV, ROUGE, BLEU, AVANCE_DEPOT } from "./config.js";
import { etat, alea } from "./etat.js";
import { calculerSupply } from "./logistique.js";
import { journal, majCompteurs } from "./hud.js";

export function genererCarte(){
  reinitialiser();
  const prov = etat.prov;

  // sites répartis par échantillonnage « meilleur candidat » (fronts lisibles)
  const sites = [];
  for (let i = 0; i < NB_PROV; i++){
    let best = null, bestD = -1;
    for (let k = 0; k < 12; k++){
      const p = { x: alea() * RW, y: alea() * RH };
      let d = Infinity;
      for (const s of sites) d = Math.min(d, (s.x-p.x)**2 + (s.y-p.y)**2);
      if (d > bestD){ bestD = d; best = p; }
    }
    sites.push(best);
  }

  // bruit de valeur : beaucoup de bosses courtes et marquées, sinon tout se
  // moyenne vers la plaine
  const champBosses = () => {
    const bosses = [];
    for (let i = 0; i < 26; i++)
      bosses.push({ x: alea()*RW, y: alea()*RH,
                    r: (28 + alea()*70)*(RW/420), a: (alea()*2-1)*1.5 });
    return sites.map(s => {
      let h = 0;
      for (const b of bosses){
        const d = Math.hypot(s.x-b.x, s.y-b.y);
        if (d < b.r) h += b.a * (1 - d/b.r);
      }
      return h;
    });
  };
  const hauteurs = champBosses();
  // second champ indépendant du relief : le bois est un couvert des terres
  // basses (plaine/bocage), pas une altitude de plus
  const vegetation = champBosses();
  // seuils par quantiles → répartition à peu près maîtrisée quelle que soit la carte
  const q = (vals, f) => {
    const tri = [...vals].sort((a,b) => a-b);
    return tri[Math.floor(f * (tri.length-1))];
  };
  const sMarais = q(hauteurs, 0.15), sBocage = q(hauteurs, 0.35),
        sColl = q(hauteurs, 0.72), sMont = q(hauteurs, 0.9);
  const sBois = q(vegetation, 0.8);

  sites.forEach((s, i) => {
    const h = hauteurs[i];
    let t = 0;                                  // plaine par défaut
    if (h >= sMont) t = 3;                       // montagne (sommets)
    else if (h >= sColl) t = 2;                  // collines
    else if (h <= sMarais) t = 4;                // marais (creux)
    else if (h <= sBocage) t = 1;                // bocage
    if (t <= 1 && vegetation[i] >= sBois) t = 5; // bois (futaies des terres basses)
    prov.push(creerProvince(i, s.x, s.y, t, alea() < 0.13));
  });

  rasteriserVoronoi(null);
  installerTheatre();
}

export function reinitialiser(){
  etat.prov = []; etat.unites = []; etat.ordres = [];
  etat.jour = 1; etat.fini = false; etat.selection = null;
}

export function creerProvince(id, x, y, terrain, ville){
  return {
    id, x, y, cx:x, cy:y, px:0,
    terrain, proprio:0, voisins:[], depot:false, qg:false,
    supply:0, ville,
    charge:0, cap:0, congestion:1, debit:0, alerte:false, relie:false,
  };
}

// rasterisation Voronoï (une fois) + centroïdes + adjacence.
// eauMask (optionnel) : les pixels d'eau ne relèvent d'aucune province (-1),
// deux rives ne deviennent donc jamais voisines par l'eau.
// Grille de buckets : à cette résolution, comparer chaque pixel aux sites
// coûte trop cher. On ne teste que les sites des cases voisines.
export function rasteriserVoronoi(eauMask){
  const prov = etat.prov;
  const CELL = 52;
  const GW = Math.ceil(RW/CELL), GH = Math.ceil(RH/CELL);
  const cases = Array.from({length: GW*GH}, () => []);
  prov.forEach(p => {
    const gx = Math.min(GW-1, (p.x/CELL)|0), gy = Math.min(GH-1, (p.y/CELL)|0);
    cases[gy*GW + gx].push(p.id);
  });

  const siteIdx = etat.siteIdx = new Int16Array(RW * RH);
  for (let y = 0; y < RH; y++){
    const gy = Math.min(GH-1, (y/CELL)|0);
    for (let x = 0; x < RW; x++){
      if (eauMask && eauMask[y*RW + x]){ siteIdx[y*RW + x] = -1; continue; }
      const gx = Math.min(GW-1, (x/CELL)|0);
      let best = -1, bd = Infinity;
      for (let ry = 2; ry <= 4 && best === -1; ry++){        // anneaux élargis
        for (let cy = Math.max(0,gy-ry); cy <= Math.min(GH-1,gy+ry); cy++)
          for (let cx = Math.max(0,gx-ry); cx <= Math.min(GW-1,gx+ry); cx++)
            for (const i of cases[cy*GW+cx]){
              const d = (prov[i].x-x)**2 + (prov[i].y-y)**2;
              if (d < bd){ bd = d; best = i; }
            }
      }
      if (best === -1){                                       // filet de sécurité
        for (let i = 0; i < prov.length; i++){
          const d = (prov[i].x-x)**2 + (prov[i].y-y)**2;
          if (d < bd){ bd = d; best = i; }
        }
      }
      siteIdx[y*RW + x] = best;
      const p = prov[best]; p.cx += x; p.cy += y; p.px++;
    }
  }
  for (const p of prov){ p.cx = p.cx / (p.px+1); p.cy = p.cy / (p.px+1); }

  const vus = new Set();
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++){
    const a = siteIdx[y*RW+x];
    if (a < 0) continue;
    for (const [dx,dy] of [[1,0],[0,1]]){
      const nx = x+dx, ny = y+dy;
      if (nx >= RW || ny >= RH) continue;
      const b = siteIdx[ny*RW+nx];
      if (a === b || b < 0) continue;
      const k = a < b ? a*1e4+b : b*1e4+a;
      if (vus.has(k)) continue;
      vus.add(k);
      prov[a].voisins.push(b); prov[b].voisins.push(a);
    }
  }
}

// Partage du théâtre entre les camps, bases, raster de fond et premier supply :
// tout ce qui suit la construction des provinces, quelle que soit leur origine
// (procédurale ou carte réelle).
export function installerTheatre(){
  const prov = etat.prov;

  // partage initial : Fédération au nord-est, Alliance au sud-ouest
  for (const p of prov){
    const t = (p.x/RW)*0.62 + (1 - p.y/RH)*0.38;
    p.proprio = t > 0.5 ? ROUGE : BLEU;
  }

  poserBase(ROUGE, RW*0.86, RH*0.16);
  poserBase(BLEU,  RW*0.14, RH*0.84);

  etat.rasterCv = document.createElement("canvas");
  etat.rasterCv.width = RW; etat.rasterCv.height = RH;
  etat.rasterCtx = etat.rasterCv.getContext("2d");
  etat.imgData = etat.rasterCtx.createImageData(RW, RH);

  calculerSupply();
  etat.sale = true;
  journal(`Carte générée. ${prov.length} provinces, front continu.`);
  journal(`Objectif : prendre les 3 dépôts adverses.`);
  majCompteurs();
}

function poserBase(camp, x, y){
  const prov = etat.prov;
  const tries = prov.filter(p => p.proprio === camp)
                    .sort((a,b) => Math.hypot(a.x-x,a.y-y) - Math.hypot(b.x-x,b.y-y));
  // 2 dépôts d'arrière espacés + 1 dépôt avancé + 1 QG
  const depots = [];
  for (const p of tries){
    if (depots.length >= 2) break;
    if (depots.every(d => Math.hypot(d.x-p.x, d.y-p.y) > 45*(RW/420))){ p.depot = true; depots.push(p); }
  }
  // dépôt avancé : projette le ravitaillement vers le front tout en restant
  // couvert par le territoire de départ — un objectif à défendre
  const ax = x + AVANCE_DEPOT*(RW/2 - x), ay = y + AVANCE_DEPOT*(RH/2 - y);
  const avant = prov.filter(p => p.proprio === camp && !p.depot)
                    .sort((a,b) => Math.hypot(a.x-ax,a.y-ay) - Math.hypot(b.x-ax,b.y-ay))[0];
  avant.depot = true; depots.push(avant);
  tries[0].qg = true;

  // 7 corps d'armée déployés vers le front
  const front = prov.filter(p => p.proprio === camp &&
      p.voisins.some(v => prov[v].proprio !== camp));
  front.sort(() => alea() - 0.5);
  for (let i = 0; i < 7 && i < front.length; i++){
    creerUnite(camp, front[i].id, Math.round(11000 + alea()*13000));
  }
  creerUnite(camp, depots[0].id, Math.round(14000 + alea()*6000)); // réserve
}

function creerUnite(camp, provId, force){
  etat.unites.push({
    id: etat.nextId++, camp, prov: provId,
    force, moral: 88 + alea()*10, coupe: 0,
    ax: etat.prov[provId].cx, ay: etat.prov[provId].cy,   // position affichée (interpolée)
    nom: (camp === BLEU ? "C." : "K.") + (etat.nextId - 1),
  });
}
