import { BBOX, RW, RH } from "./config.js";

// ---- projection équirectangulaire (correction de latitude) ------------------
export function proj(lat, lon){
  return [ (lon-BBOX.w)/(BBOX.e-BBOX.w)*RW, (BBOX.n-lat)/(BBOX.n-BBOX.s)*RH ];
}

// ---- géométrie --------------------------------------------------------------
export function pip(x, y, poly){
  let dedans=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if(((yi>y)!==(yj>y)) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) dedans=!dedans;
  }
  return dedans;
}

export function distSeg(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0; t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

// rasterisation d'un polygone plein (scanline) dans un masque
export function remplirPolygone(poly, mask){
  let minY=RH, maxY=0;
  for(const [,y] of poly){ minY=Math.min(minY,y); maxY=Math.max(maxY,y); }
  minY=Math.max(0,Math.floor(minY)); maxY=Math.min(RH-1,Math.ceil(maxY));
  for(let y=minY;y<=maxY;y++){
    const nx=[];
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const yi=poly[i][1],yj=poly[j][1];
      if((yi>y)!==(yj>y)){
        const xi=poly[i][0],xj=poly[j][0];
        nx.push(xi+(y-yi)/(yj-yi)*(xj-xi));
      }
    }
    nx.sort((a,b)=>a-b);
    for(let k=0;k+1<nx.length;k+=2){
      const x0=Math.max(0,Math.ceil(nx[k])), x1=Math.min(RW-1,Math.floor(nx[k+1]));
      for(let x=x0;x<=x1;x++) mask[y*RW+x]=1;
    }
  }
}

export function traceLarge(pts, mask, r){
  for(let i=0;i<pts.length-1;i++){
    const [ax,ay]=pts[i],[bx,by]=pts[i+1];
    const n=Math.max(1,Math.hypot(bx-ax,by-ay)|0);
    for(let s=0;s<=n;s++){
      const x=ax+(bx-ax)*s/n|0, y=ay+(by-ay)*s/n|0;
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        const px=x+dx,py=y+dy;
        if(px>=0&&py>=0&&px<RW&&py<RH&&dx*dx+dy*dy<=r*r) mask[py*RW+px]=1;
      }
    }
  }
}
