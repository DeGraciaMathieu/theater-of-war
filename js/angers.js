import { RW, RH, NB_PROV } from "./config.js";
import { etat, alea } from "./etat.js";
import { genererCarte, reinitialiser, creerProvince, rasteriserVoronoi, installerTheatre } from "./carte.js";
import { journal } from "./hud.js";

// ---- zone : bounding box autour d'Angers ------------------------------------
const BBOX = { s:47.446, w:-0.598, n:47.505, e:-0.512 };

const MIROIRS = [
  "/api/overpass",                                    // proxy Vercel (évite CORS), 404 en local
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function requeteOverpass(){
  const bb = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}`;
  return `[out:json][timeout:30];(
    way["natural"="water"](${bb});
    way["waterway"="riverbank"](${bb});
    way["waterway"="river"](${bb});
    way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${bb});
    way["landuse"~"^(forest|residential|industrial|commercial|farmland|meadow)$"](${bb});
    way["natural"="wood"](${bb});
  );out geom;`;
}

export async function genererAngers(){
  journal("Interrogation d'OpenStreetMap (Angers)…");
  let data = null;
  for (const url of MIROIRS){
    try{
      const rep = await fetch(url, { method:"POST",
        headers:{ "Content-Type":"text/plain" }, body: requeteOverpass() });
      if (!rep.ok) throw new Error("HTTP " + rep.status);
      data = await rep.json();
      break;
    }catch(e){ /* miroir suivant */ }
  }
  if (!data){
    journal("<b>Overpass injoignable</b> — repli sur une carte procédurale.");
    genererCarte();
    return;
  }
  construire(data);
}

// ---- OSM → provinces au format du jeu ---------------------------------------
function construire(data){
  const eaux = [], landuse = [], routes = [], rivieres = [];
  for (const el of data.elements){
    if (!el.geometry || el.geometry.length < 2) continue;
    const pts = el.geometry.map(g => proj(g.lat, g.lon));
    const t = el.tags || {};
    if (t.natural === "water" || t.waterway === "riverbank") eaux.push(pts);
    else if (t.waterway === "river") rivieres.push(pts);
    else if (t.highway) routes.push({ rang: rangRoute(t.highway), pts });
    else if (t.landuse || t.natural === "wood")
      landuse.push({ type: t.landuse || t.natural, poly: pts });
  }

  // masque d'eau : polygones pleins + rivières linéaires épaissies
  const eauMask = new Uint8Array(RW*RH);
  for (const poly of eaux) remplirPolygone(poly, eauMask);
  for (const r of rivieres) traceLarge(r, eauMask, 3);

  reinitialiser();
  const prov = etat.prov;

  // semis de provinces sur la terre ferme uniquement (meilleur candidat)
  const sites = [];
  let essais = 0;
  while (sites.length < NB_PROV && essais < NB_PROV*40){
    essais++;
    let best = null, bd = -1;
    for (let k = 0; k < 10; k++){
      const p = { x: alea()*RW, y: alea()*RH };
      if (eauMask[(p.y|0)*RW + (p.x|0)]) continue;
      let d = Infinity;
      for (const s of sites) d = Math.min(d, (s.x-p.x)**2 + (s.y-p.y)**2);
      if (d > bd){ bd = d; best = p; }
    }
    if (best) sites.push(best);
  }

  sites.forEach((s, i) => {
    let terrain = terrainDepuisLanduse(s.x, s.y, landuse);
    // proximité de l'eau → berges (sauf en ville)
    if (terrain !== 7 && prochEau(s.x, s.y, eauMask) < 10) terrain = 6;
    prov.push(creerProvince(i, s.x, s.y, terrain, false));
  });

  rasteriserVoronoi(eauMask);
  relierPonts(routes);

  // les grands axes routiers jouent le rôle des nœuds routiers du procédural
  for (const p of prov){
    let rang = 0;
    for (const r of routes){
      for (let i = 0; i < r.pts.length-1; i++){
        if (distSeg(p.cx, p.cy, r.pts[i][0], r.pts[i][1], r.pts[i+1][0], r.pts[i+1][1]) < 16){
          rang = Math.max(rang, r.rang); break;
        }
      }
    }
    p.ville = rang >= 3;
  }

  installerTheatre();
  journal(`Angers — ${eaux.length} plans d'eau, ${routes.length} routes · données © OpenStreetMap.`);
}

function rangRoute(h){
  return { motorway:4, trunk:4, primary:3, secondary:2, tertiary:1 }[h] || 1;
}

function terrainDepuisLanduse(x, y, landuse){
  for (const l of landuse){
    if (pip(x, y, l.poly)){
      switch (l.type){
        case "forest": case "wood":      return 5;   // bois
        case "residential": case "industrial": case "commercial": return 7; // urbain
        case "farmland":                 return 0;   // plaine
        case "meadow":                   return 1;   // bocage
      }
    }
  }
  return 1; // hors zone décrite : bocage par défaut (campagne angevine)
}

function prochEau(x, y, eauMask){
  for (let rad = 1; rad <= 12; rad++)
    for (let a = 0; a < 8; a++){
      const px = (x + Math.cos(a/8*6.28)*rad)|0, py = (y + Math.sin(a/8*6.28)*rad)|0;
      if (px >= 0 && py >= 0 && px < RW && py < RH && eauMask[py*RW+px]) return rad;
    }
  return 999;
}

// les routes qui franchissent l'eau relient les deux rives : les ponts
function relierPonts(routes){
  const prov = etat.prov, siteIdx = etat.siteIdx;
  for (const r of routes){
    let prec = -1;
    for (const [x,y] of r.pts){
      const id = (x >= 0 && y >= 0 && x < RW && y < RH) ? siteIdx[(y|0)*RW + (x|0)] : -1;
      if (id >= 0){
        if (prec >= 0 && prec !== id && !prov[id].voisins.includes(prec)){
          prov[id].voisins.push(prec); prov[prec].voisins.push(id);
        }
        prec = id;
      }
    }
  }
}

// ---- géométrie --------------------------------------------------------------
// projection équirectangulaire (correction de latitude)
function proj(lat, lon){
  return [ (lon-BBOX.w)/(BBOX.e-BBOX.w)*RW, (BBOX.n-lat)/(BBOX.n-BBOX.s)*RH ];
}

function pip(x, y, poly){
  let dedans = false;
  for (let i = 0, j = poly.length-1; i < poly.length; j = i++){
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi>y) !== (yj>y)) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) dedans = !dedans;
  }
  return dedans;
}

function distSeg(px, py, ax, ay, bx, by){
  const dx = bx-ax, dy = by-ay, l2 = dx*dx+dy*dy;
  let t = l2 ? ((px-ax)*dx+(py-ay)*dy)/l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

// rasterisation d'un polygone plein (scanline) dans un masque
function remplirPolygone(poly, mask){
  let minY = RH, maxY = 0;
  for (const [,y] of poly){ minY = Math.min(minY,y); maxY = Math.max(maxY,y); }
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(RH-1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++){
    const nx = [];
    for (let i = 0, j = poly.length-1; i < poly.length; j = i++){
      const yi = poly[i][1], yj = poly[j][1];
      if ((yi>y) !== (yj>y)){
        const xi = poly[i][0], xj = poly[j][0];
        nx.push(xi+(y-yi)/(yj-yi)*(xj-xi));
      }
    }
    nx.sort((a,b) => a-b);
    for (let k = 0; k+1 < nx.length; k += 2){
      const x0 = Math.max(0, Math.ceil(nx[k])), x1 = Math.min(RW-1, Math.floor(nx[k+1]));
      for (let x = x0; x <= x1; x++) mask[y*RW+x] = 1;
    }
  }
}

function traceLarge(pts, mask, r){
  for (let i = 0; i < pts.length-1; i++){
    const [ax,ay] = pts[i], [bx,by] = pts[i+1];
    const n = Math.max(1, Math.hypot(bx-ax, by-ay)|0);
    for (let s = 0; s <= n; s++){
      const x = ax+(bx-ax)*s/n|0, y = ay+(by-ay)*s/n|0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
        const px = x+dx, py = y+dy;
        if (px >= 0 && py >= 0 && px < RW && py < RH && dx*dx+dy*dy <= r*r) mask[py*RW+px] = 1;
      }
    }
  }
}
