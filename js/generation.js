import { RW, RH, NB_PROV, TERRAINS, T_PLAINE, T_BOCAGE, T_BOIS, T_BERGE, T_URBAIN } from "./config.js";
import { etat } from "./etat.js";
import { pip, distSeg, traceLarge } from "./geometrie.js";

const elEtat = document.getElementById("etat");
const elCharge = document.getElementById("charge");
const elStats = document.getElementById("stats");

const alea = (() => { let s = 20260722;
  return () => (s = s*48271 % 2147483647) / 2147483647; })();

// semis de provinces sur la terre ferme uniquement
export function genererProvinces(landuse){
  etat.prov = [];
  const sites=[];
  let essais=0;
  while(sites.length<NB_PROV && essais<NB_PROV*40){
    essais++;
    // échantillonnage best-candidate pour des cellules régulières
    let best=null, bd=-1;
    for(let k=0;k<10;k++){
      const p={x:alea()*RW,y:alea()*RH};
      if(etat.eauMask && etat.eauMask[(p.y|0)*RW+(p.x|0)]) continue;   // pas dans l'eau
      let d=Infinity;
      for(const s of sites) d=Math.min(d,(s.x-p.x)**2+(s.y-p.y)**2);
      if(d>bd){bd=d;best=p;}
    }
    if(best) sites.push(best);
  }

  sites.forEach((s,i)=>{
    let terrain = terrainDepuisLanduse(s.x, s.y, landuse);
    // proximité de l'eau → berges
    if(terrain!==T_URBAIN && prochEau(s.x,s.y)<10) terrain=T_BERGE;
    etat.prov.push({ id:i, x:s.x, y:s.y, cx:s.x, cy:s.y, px:0,
      terrain, voisins:[], routeRang:0, debit:0, franchit:false });
  });

  rasteriser();
  // proximité route → rang logistique de la province
  for(const p of etat.prov){
    let meilleur=0;
    for(const r of etat.routes){
      for(let i=0;i<r.pts.length-1;i++){
        if(distSeg(p.cx,p.cy,r.pts[i][0],r.pts[i][1],r.pts[i+1][0],r.pts[i+1][1])<16){
          meilleur=Math.max(meilleur,r.rang); break;
        }
      }
    }
    p.routeRang=meilleur;
  }
  calculerDebit();
}

function terrainDepuisLanduse(x,y,landuse){
  for(const l of landuse){
    if(pip(x,y,l.poly)){
      switch(l.type){
        case "forest": case "wood":      return T_BOIS;
        case "residential": case "industrial": case "commercial": return T_URBAIN;
        case "farmland":                 return T_PLAINE;
        case "meadow":                   return T_BOCAGE;
      }
    }
  }
  return T_BOCAGE; // hors zone décrite : bocage par défaut (campagne angevine)
}

function prochEau(x,y){
  if(!etat.eauMask) return 999;
  for(let rad=1;rad<=12;rad++)
    for(let a=0;a<8;a++){
      const px=(x+Math.cos(a/8*6.28)*rad)|0, py=(y+Math.sin(a/8*6.28)*rad)|0;
      if(px>=0&&py>=0&&px<RW&&py<RH&&etat.eauMask[py*RW+px]) return rad;
    }
  return 999;
}

// rasterisation Voronoï + adjacence (rivière = frontière franchissable notée)
function rasteriser(){
  const prov = etat.prov, eauMask = etat.eauMask;
  const CELL=52, GW=Math.ceil(RW/CELL), GH=Math.ceil(RH/CELL);
  const cases=Array.from({length:GW*GH},()=>[]);
  prov.forEach(p=>{
    const gx=Math.min(GW-1,(p.x/CELL)|0), gy=Math.min(GH-1,(p.y/CELL)|0);
    cases[gy*GW+gx].push(p.id);
  });
  const siteIdx = etat.siteIdx = new Int16Array(RW*RH).fill(-1);
  for(let y=0;y<RH;y++){
    const gy=Math.min(GH-1,(y/CELL)|0);
    for(let x=0;x<RW;x++){
      if(eauMask && eauMask[y*RW+x]){ siteIdx[y*RW+x]=-1; continue; }  // eau
      const gx=Math.min(GW-1,(x/CELL)|0);
      let best=-1,bd=Infinity;
      for(let ry=2;ry<=5&&best===-1;ry++)
        for(let cy=Math.max(0,gy-ry);cy<=Math.min(GH-1,gy+ry);cy++)
          for(let cx=Math.max(0,gx-ry);cx<=Math.min(GW-1,gx+ry);cx++)
            for(const id of cases[cy*GW+cx]){
              const d=(prov[id].x-x)**2+(prov[id].y-y)**2;
              if(d<bd){bd=d;best=id;}
            }
      if(best===-1) for(let i=0;i<prov.length;i++){
        const d=(prov[i].x-x)**2+(prov[i].y-y)**2; if(d<bd){bd=d;best=i;}
      }
      siteIdx[y*RW+x]=best;
      if(best>=0){ const p=prov[best]; p.cx+=x; p.cy+=y; p.px++; }
    }
  }
  for(const p of prov){ p.cx=p.cx/(p.px+1); p.cy=p.cy/(p.px+1); }

  // adjacence : deux provinces voisines ; si séparées par de l'eau → franchissement
  const vus=new Set();
  for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){
    const a=siteIdx[y*RW+x]; if(a<0) continue;
    for(const [dx,dy] of [[1,0],[0,1]]){
      const nx=x+dx,ny=y+dy; if(nx>=RW||ny>=RH) continue;
      let b=siteIdx[ny*RW+nx];
      if(b===a) continue;
      if(b<0){                                   // on longe de l'eau : cherche l'autre rive
        continue;
      }
      const k=a<b?a*1e4+b:b*1e4+a;
      if(!vus.has(k)){ vus.add(k); prov[a].voisins.push(b); prov[b].voisins.push(a); }
    }
  }
  // franchissements de rivière : provinces séparées uniquement par de l'eau,
  // reliées seulement là où une route traverse (les ponts)
  detecterPonts();
}

function detecterPonts(){
  // pour chaque route, marquer les provinces qu'elle relie de part et d'autre d'une eau
  const prov = etat.prov, siteIdx = etat.siteIdx;
  for(const r of etat.routes){
    let prec=-1;
    for(const [x,y] of r.pts){
      const id = (x>=0&&y>=0&&x<RW&&y<RH) ? siteIdx[(y|0)*RW+(x|0)] : -1;
      if(id>=0){
        if(prec>=0 && prec!==id && !prov[id].voisins.includes(prec)){
          prov[id].voisins.push(prec); prov[prec].voisins.push(id);
          prov[id].franchit=true; prov[prec].franchit=true;   // reliés par un pont
        }
        prec=id;
      }
    }
  }
}

// ---- débit logistique (mêmes principes que le jeu) --------------------------
function calculerDebit(){
  for(const p of etat.prov)
    p.debit = TERRAINS[p.terrain].debit
      * (1 + p.routeRang*0.6)                     // une grande route booste le débit
      * (p.terrain===T_URBAIN?1.4:1);
}

// ---- repli procédural (si Overpass échoue) ----------------------------------
export function genererProcedural(){
  etat.source = "procédural (repli)";
  etat.eauMask = new Uint8Array(RW*RH);
  // une « rivière » sinueuse
  etat.rivieres=[]; const rv=[];
  for(let t=0;t<=1;t+=0.02){
    const x=t*RW, y=RH*0.5 + Math.sin(t*7)*90 + (t-0.5)*80;
    rv.push([x,y]);
  }
  etat.rivieres.push(rv); traceLarge(rv, etat.eauMask, 4);
  etat.routes=[{rang:3, pts:[[0,RH*0.3],[RW*0.5,RH*0.45],[RW,RH*0.6]]}];
  etat.prov=[];
  const sites=[]; let e=0;
  while(sites.length<NB_PROV && e<NB_PROV*40){ e++;
    const p={x:alea()*RW,y:alea()*RH};
    if(etat.eauMask[(p.y|0)*RW+(p.x|0)]) continue;
    sites.push(p);
  }
  sites.forEach((s,i)=>{
    let terrain = alea()<0.5?T_BOCAGE:(alea()<0.5?T_BOIS:T_PLAINE);
    if(prochEau(s.x,s.y)<10) terrain=T_BERGE;
    etat.prov.push({id:i,x:s.x,y:s.y,cx:s.x,cy:s.y,px:0,terrain,voisins:[],routeRang:0,debit:0,franchit:false});
  });
  rasteriser();
  for(const p of etat.prov){
    let m=0;
    for(const r of etat.routes) for(let i=0;i<r.pts.length-1;i++)
      if(distSeg(p.cx,p.cy,r.pts[i][0],r.pts[i][1],r.pts[i+1][0],r.pts[i+1][1])<16) m=Math.max(m,r.rang);
    p.routeRang=m;
  }
  calculerDebit();
  finaliser();
}

export function finaliser(){
  etat.rasterCv=document.createElement("canvas");
  etat.rasterCv.width=RW; etat.rasterCv.height=RH;
  etat.rasterCtx=etat.rasterCv.getContext("2d");
  etat.imgData=etat.rasterCtx.createImageData(RW,RH);
  etat.sale=true;
  elCharge.style.display="none";
  elEtat.textContent = etat.source;
  const t=n=>etat.prov.filter(p=>p.terrain===n).length;
  elStats.innerHTML =
    `<div><b>${etat.prov.length}</b> provinces générées</div>`+
    `<div>source : <b>${etat.source.split(" ·")[0]}</b></div>`+
    `<div style="margin-top:4px">plaine <b>${t(0)}</b> · bocage <b>${t(1)}</b> · bois <b>${t(2)}</b></div>`+
    `<div>berges <b>${t(3)}</b> · urbain <b>${t(4)}</b></div>`+
    `<div style="margin-top:4px">routes : <b>${etat.routes.length}</b> axes · ${etat.prov.filter(p=>p.franchit).length} ponts</div>`;
}
