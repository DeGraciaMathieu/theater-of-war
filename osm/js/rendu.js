import { RW, RH, TERRAINS, T_PLAINE, T_BOCAGE, T_BOIS, T_BERGE, T_URBAIN } from "./config.js";
import { etat } from "./etat.js";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

// ---- motifs de terrain ------------------------------------------------------
function motif(t,x,y){
  switch(t){
    case T_PLAINE: return ((x*5+y*11)%23===0)?8:0;
    case T_BOCAGE: return ((x*7+y*3)%9<2)?26:-8;
    case T_BOIS:   return (((x+y)%7)<2)?30:-14;
    case T_BERGE:  return (y%5<1)?-22:((y%5===2)?14:0);
    case T_URBAIN: return ((x%6<1)||(y%6<1))?22:-6;   // trame de rues
    default: return 0;
  }
}

function construireFond(){
  const { prov, siteIdx, survol, vueDebit, imgData } = etat;
  const d=imgData.data;
  for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){
    const i=y*RW+x, s=siteIdx[i];
    let r,g,b;
    if(s<0){                                    // eau
      r=28; g=52; b=74;
      if(((x+y)%12)<1){ r+=14; g+=20; b+=26; }  // moiré de surface
    }else{
      const p=prov[s], t=TERRAINS[p.terrain].col, mo=motif(p.terrain,x,y);
      r=t[0]+mo; g=t[1]+mo; b=t[2]+mo;
      if(vueDebit){
        const v=Math.min(1,p.debit/9);
        r=26+v*60; g=26+v*150; b=26+v*80;
        if(p.routeRang>=3){ r=r*0.5+224*0.5; g=g*0.5+165*0.5; b=b*0.5+60*0.5; }
      }
      if(s===survol){ r+=40; g+=40; b+=40; }
      // frontières
      const dr=x+1<RW?siteIdx[i+1]:s, ba=y+1<RH?siteIdx[i+RW]:s;
      if(dr!==s||ba!==s){
        const autre = (dr!==s?dr:ba);
        if(autre<0){ /* bord d'eau : garder */ }
        else { r*=0.8; g*=0.8; b*=0.8; }
      }
    }
    const o=i*4; d[o]=r; d[o+1]=g; d[o+2]=b; d[o+3]=255;
  }
  etat.rasterCtx.putImageData(imgData,0,0);
}

export function dessiner(){
  const w=cv.clientWidth,h=cv.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(cv.width!==w*dpr||cv.height!==h*dpr){cv.width=w*dpr;cv.height=h*dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  if(!etat.siteIdx){ requestAnimationFrame(dessiner); return; }
  if(etat.sale){ construireFond(); etat.sale=false; }
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(etat.rasterCv,0,0,w,h);
  const sx=w/RW, sy=h/RH;

  // routes réelles par-dessus
  for(const r of etat.routes){
    ctx.strokeStyle = r.rang>=3 ? "rgba(224,165,60,.85)" : "rgba(224,165,60,.4)";
    ctx.lineWidth = r.rang>=3 ? 2.4 : 1.2;
    ctx.beginPath();
    r.pts.forEach(([x,y],k)=> k?ctx.lineTo(x*sx,y*sy):ctx.moveTo(x*sx,y*sy));
    ctx.stroke();
  }
  // ponts (provinces reliées par franchissement)
  for(const p of etat.prov){
    if(!p.franchit) continue;
    ctx.fillStyle="#e0a53c";
    ctx.beginPath(); ctx.arc(p.cx*sx,p.cy*sy,2.6,0,7); ctx.fill();
  }

  dessinerLegende(w,h);
  requestAnimationFrame(dessiner);
}

function dessinerLegende(w,h){
  const items=[T_PLAINE,T_BOCAGE,T_BOIS,T_BERGE,T_URBAIN];
  const lh=17,pad=8,cw=26,sh=13;
  const bh=15+items.length*lh+pad, bw=138, x0=8, y0=Math.max(8,h-bh-8);
  ctx.save();
  ctx.fillStyle="rgba(14,16,14,.88)"; ctx.fillRect(x0,y0,bw,bh);
  ctx.strokeStyle="#3a423a"; ctx.lineWidth=1; ctx.strokeRect(x0,y0,bw,bh);
  ctx.fillStyle="#8d9088"; ctx.font="700 9px 'Saira Condensed',sans-serif"; ctx.textAlign="left";
  ctx.fillText(etat.vueDebit?"DÉBIT LOGISTIQUE":"TERRAIN · COÛT MARCHE",x0+pad,y0+11);
  items.forEach((t,k)=>{
    const yy=y0+15+k*lh;
    const col=TERRAINS[t].col;
    for(let py=0;py<sh;py++)for(let px=0;px<cw;px++){
      const mo=motif(t,px,py);
      ctx.fillStyle=`rgb(${Math.max(0,col[0]+mo)},${Math.max(0,col[1]+mo)},${Math.max(0,col[2]+mo)})`;
      ctx.fillRect(x0+pad+px,yy+py,1,1);
    }
    ctx.strokeStyle="#0e100e"; ctx.strokeRect(x0+pad,yy,cw,sh);
    ctx.fillStyle="#e8e4d6"; ctx.font="11px 'Saira Condensed',sans-serif";
    ctx.fillText(`${TERRAINS[t].nom} ×${Math.max(1,Math.round(TERRAINS[t].cout))}`,x0+pad+cw+7,yy+10);
  });
  ctx.restore();
}
