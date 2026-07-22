import { BBOX, RW, RH } from "./config.js";
import { etat } from "./etat.js";
import { proj, remplirPolygone, traceLarge } from "./geometrie.js";
import { genererProvinces, genererProcedural, finaliser } from "./generation.js";

const elEtat = document.getElementById("etat");
const elCharge = document.getElementById("charge");
const elChargeTxt = document.getElementById("chargeTxt");

// ---- requête Overpass -------------------------------------------------------
const MIROIRS = [
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

export async function chargerOSM(){
  elCharge.style.display = "flex";
  elEtat.textContent = "chargement…";
  let data = null, err = null;
  for(const url of MIROIRS){
    try{
      elChargeTxt.textContent = `Interrogation d'Overpass (${url.split("/")[2]})…`;
      const rep = await fetch(url, { method:"POST",
        headers:{ "Content-Type":"text/plain" }, body: requeteOverpass() });
      if(!rep.ok) throw new Error("HTTP "+rep.status);
      data = await rep.json();
      break;
    }catch(e){ err = e; }
  }
  if(!data){
    elChargeTxt.textContent = "Overpass injoignable ("+(err?err.message:"?")+"). Bascule sur une carte procédurale.";
    await new Promise(r=>setTimeout(r,1400));
    genererProcedural();
    return;
  }
  construireDepuisOSM(data);
}

// ---- OSM → graphe de provinces ----------------------------------------------
function construireDepuisOSM(data){
  elChargeTxt.textContent = "Transformation des données en provinces…";
  const eaux=[], landuse=[]; etat.routes=[]; etat.rivieres=[];

  for(const el of data.elements){
    if(!el.geometry || el.geometry.length<2) continue;
    const pts = el.geometry.map(g=>proj(g.lat,g.lon));
    const t = el.tags||{};
    if(t.natural==="water"||t.waterway==="riverbank") eaux.push(pts);
    else if(t.waterway==="river") etat.rivieres.push(pts);
    else if(t.highway) etat.routes.push({ rang: rangRoute(t.highway), pts });
    else if(t.landuse||t.natural==="wood")
      landuse.push({ type:t.landuse||t.natural, poly:pts });
  }

  // masque d'eau : rasterisation des polygones d'eau
  etat.eauMask = new Uint8Array(RW*RH);
  for(const poly of eaux) remplirPolygone(poly, etat.eauMask);
  // les rivières linéaires « épaississent » le masque
  for(const r of etat.rivieres) traceLarge(r, etat.eauMask, 3);

  etat.source = `OSM · ${eaux.length} plans d'eau, ${etat.routes.length} routes, ${landuse.length} zones`;
  genererProvinces(landuse);
  finaliser();
}

function rangRoute(h){
  return { motorway:4, trunk:4, primary:3, secondary:2, tertiary:1 }[h] || 1;
}
