import { RW, RH, TERRAINS, ROUGE, BLEU } from "./config.js";
import { etat, ravitaillement } from "./etat.js";
import { marche } from "./ordres.js";

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

// Trame par terrain : une valeur de clair/sombre par pixel, lisible même sous
// la couleur de camp. Chaque terrain a une signature graphique reconnaissable.
function motifTerrain(t, x, y){
  switch (t){
    case 0: return ((x*5+y*11) % 23 === 0) ? 8 : 0;              // plaine : grain léger
    case 1: return ((x*7 + y*3) % 9 < 2) ? 30 : -10;            // bocage : semis de points
    case 2: return (((x + y) % 8) < 2) ? 34 : -12;              // collines : diagonales /
    case 3: {                                                    // montagne : chevrons ^
      const d = Math.abs(((x*2 + y) % 12) - 6);
      return d < 1.5 ? 46 : (d > 4 ? -22 : 0);
    }
    case 4: {                                                    // marais : lignes d'eau
      const m = y % 5;
      return m < 1 ? -26 : (m === 2 ? 16 : 0);
    }
    case 5: return (((x + y) % 7) < 2) ? 30 : -14;              // bois
    case 6: return (y % 5 < 1) ? -22 : ((y % 5 === 2) ? 14 : 0); // berges
    case 7: return ((x % 6 < 1) || (y % 6 < 1)) ? 22 : -6;       // urbain : trame de rues
    default: return 0;
  }
}

// Le fond ne dépend que de l'état du théâtre : on ne le recalcule qu'au
// changement, pas à chaque frame. 504 000 pixels, ce serait cher pour rien.
function construireFond(){
  const { prov, siteIdx, survol, vueSupply, imgData } = etat;
  const d = imgData.data;
  for (let y = 0; y < RH; y++){
    for (let x = 0; x < RW; x++){
      const i = y*RW + x, s = siteIdx[i];
      if (s < 0){                                 // eau (carte réelle) : infranchissable
        let r = 28, g = 52, b = 74;
        if (((x + y) % 12) < 1){ r += 14; g += 20; b += 26; }  // moiré de surface
        const o = i*4;
        d[o] = r; d[o+1] = g; d[o+2] = b; d[o+3] = 255;
        continue;
      }
      const p = prov[s];
      const t = TERRAINS[p.terrain].col;
      let r = t[0], g = t[1], b = t[2];

      // motif propre à chaque terrain (trame façon carte d'état-major) — appliqué
      // au fond, il reste visible même une fois la couleur de camp posée par-dessus
      const mo = motifTerrain(p.terrain, x, y);
      r += mo; g += mo; b += mo;

      if (vueSupply){
        const v = p.supply;
        r = 26 + v*(p.proprio===ROUGE?210:60);
        g = 26 + v*150;
        b = 26 + v*(p.proprio===BLEU?210:60);
        if (v === 0){ r = 46; g = 20; b = 22; }
        if (p.proprio && p.congestion < 0.9){       // axe qui sature
          const m = Math.min(1, (0.9 - p.congestion) * 1.6);
          r = r*(1-m) + 224*m; g = g*(1-m) + 165*m; b = b*(1-m) + 60*m;
        }
      } else if (p.proprio === ROUGE){              // teinte de camp, pas écrasement
        r = r*0.58 + 190*0.42; g = g*0.58 + 58*0.42; b = b*0.58 + 52*0.42;
      } else if (p.proprio === BLEU){
        r = r*0.58 + 66*0.42;  g = g*0.58 + 112*0.42; b = b*0.58 + 158*0.42;
      }
      // relief : les provinces mal ravitaillées s'assombrissent
      const k = 0.66 + 0.34*(p.proprio ? p.supply : 0.5);
      r *= k; g *= k; b *= k;

      if (s === survol){ r += 42; g += 42; b += 42; }

      // province coupée de l'arrière : hachures ambre, visibles en toute vue
      if (p.proprio && !p.relie && ((x + y) % 18) < 6){
        r = r*0.35 + 224*0.65; g = g*0.35 + 165*0.65; b = b*0.35 + 60*0.65;
      }

      // frontières (un bord d'eau garde sa couleur : le contraste suffit)
      const droite = x+1 < RW ? siteIdx[i+1] : s;
      const bas    = y+1 < RH ? siteIdx[i+RW] : s;
      if (droite !== s || bas !== s){
        const autreIdx = droite !== s ? droite : bas;
        if (autreIdx >= 0){
          if (prov[autreIdx].proprio !== p.proprio){ r = 12; g = 12; b = 12; }
          else { r *= 0.82; g *= 0.82; b *= 0.82; }
        }
      }
      const o = i*4;
      d[o] = r; d[o+1] = g; d[o+2] = b; d[o+3] = 255;
    }
  }
  etat.rasterCtx.putImageData(imgData, 0, 0);
}

export function dessiner(){
  const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio||1);
  if (cv.width !== w*dpr || cv.height !== h*dpr){ cv.width = w*dpr; cv.height = h*dpr; }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  if (!etat.siteIdx) return;

  if (etat.sale){ construireFond(); etat.sale = false; }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(etat.rasterCv, 0, 0, w, h);
  // le fond est en cache, mais pions et itinéraires se redessinent chaque frame
  // par-dessus — c'est ce qui rend le glissement fluide sans recalculer 500k pixels

  const prov = etat.prov;
  const sx = w/RW, sy = h/RH;

  // dépôts et QG
  for (const p of prov){
    if (!p.depot && !p.qg) continue;
    const X = p.cx*sx, Y = p.cy*sy;
    ctx.strokeStyle = p.proprio === ROUGE ? "#ffd9d4" : p.proprio === BLEU ? "#d6e8fa" : "#999";
    ctx.lineWidth = 1.6;
    if (p.qg){ ctx.beginPath(); ctx.arc(X,Y,9,0,7); ctx.stroke(); }
    ctx.strokeRect(X-5, Y-5, 10, 10);
    ctx.beginPath(); ctx.moveTo(X-5,Y-5); ctx.lineTo(X+5,Y+5); ctx.stroke();
  }

  // itinéraires
  for (const o of etat.ordres){
    const u = etat.unites.find(x => x.id === o.unite);
    if (!u || u.camp !== BLEU) continue;
    ctx.save();
    ctx.setLineDash(o.transmis ? [] : [4,4]);
    ctx.strokeStyle = o.transmis ? "#e0a53c" : "rgba(224,165,60,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prov[u.prov].cx*sx, prov[u.prov].cy*sy);
    for (let k = o.idx; k < o.chemin.length; k++){
      const q = prov[o.chemin[k]];
      ctx.lineTo(q.cx*sx, q.cy*sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const fin = prov[o.chemin[o.chemin.length-1]];
    ctx.fillStyle = "#e0a53c";
    ctx.beginPath(); ctx.arc(fin.cx*sx, fin.cy*sy, 3.5, 0, 7); ctx.fill();

    // badge de décompte, ancré sur la PROCHAINE étape (le mouvement imminent)
    const prochaine = prov[o.chemin[o.idx]];
    const restProchain = Math.max(0, (o.transmis ? o.arrive : o.transmisLe) - etat.jour);
    const restTotal = Math.max(0, o.arrive - etat.jour)
      + o.chemin.slice(o.idx + 1).reduce((s,p) => s + marche(p), 0);
    const etiq = o.transmis ? `J-${restProchain}` : `⧖ ${restProchain}`;
    ctx.font = "700 11px 'Share Tech Mono', monospace";
    const bw = ctx.measureText(etiq).width + 14;
    let bx = prochaine.cx*sx + 9, by = prochaine.cy*sy - 24;
    if (bx + bw > w) bx = prochaine.cx*sx - 9 - bw;
    if (by < 0) by = prochaine.cy*sy + 9;
    ctx.fillStyle = o.transmis ? "rgba(224,165,60,.92)" : "rgba(14,16,14,.9)";
    ctx.fillRect(bx, by, bw, 17);
    ctx.strokeStyle = "#e0a53c"; ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 17);
    ctx.fillStyle = o.transmis ? "#14100a" : "#e0a53c";
    ctx.textAlign = "left";
    ctx.fillText(etiq, bx + 7, by + 12);
    if (o.chemin.length - o.idx > 1){        // objectif encore à plusieurs sauts
      ctx.fillStyle = "rgba(232,228,214,.8)";
      ctx.font = "10px 'Share Tech Mono', monospace";
      ctx.fillText(`obj. ${restTotal}j`, bx, by - 4);
    }
    ctx.restore();
  }

  // aperçu de l'ordre au survol : tracé projeté + délai en jours
  if (etat.apercu){
    const u = etat.unites.find(x => x.id === etat.selection);
    if (u){
      const ch = etat.apercu.chemin, e = etat.apercu.est;
      ctx.save();
      ctx.setLineDash([2,4]);
      ctx.strokeStyle = "rgba(232,228,214,.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(u.ax*sx, u.ay*sy);
      for (const id of ch) ctx.lineTo(prov[id].cx*sx, prov[id].cy*sy);
      ctx.stroke();
      ctx.setLineDash([]);

      const cible = prov[ch[ch.length-1]];
      const X = cible.cx*sx, Y = cible.cy*sy;
      ctx.strokeStyle = "#e8e4d6"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X, Y, 6, 0, 7); ctx.stroke();

      // encart : transmission puis marche = arrivée
      const l1 = `reçu dans ${e.latence} j`;
      const l2 = `arrivée J${etat.jour + e.total} (+${e.total} j)`;
      ctx.font = "700 11px 'Saira Condensed', sans-serif";
      const w2 = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 16;
      let bx = X + 12, by = Y - 34;
      if (bx + w2 > w) bx = X - 12 - w2;
      if (by < 0) by = Y + 12;
      ctx.fillStyle = "rgba(14,16,14,.9)";
      ctx.fillRect(bx, by, w2, 34);
      ctx.strokeStyle = "#e0a53c"; ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, w2, 34);
      ctx.textAlign = "left";
      ctx.fillStyle = "#e0a53c";
      ctx.fillText(l1, bx + 8, by + 13);
      ctx.fillStyle = "#e8e4d6";
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(l2, bx + 8, by + 27);
      ctx.restore();
    }
  }

  // étiquette de poche — la récompense de la manœuvre, affichée en clair
  for (const po of etat.poches){
    const X = po.cx*sx, Y = po.cy*sy;
    const txt = po.hommes.toLocaleString("fr-FR") + " isolés";
    ctx.font = "700 11px 'Saira Condensed', sans-serif";
    const w = Math.max(96, ctx.measureText(txt).width + 18);
    ctx.fillStyle = "rgba(14,16,14,.82)";
    ctx.fillRect(X - w/2, Y - 24, w, 30);
    ctx.strokeStyle = "#e0a53c"; ctx.lineWidth = 1.5;
    ctx.strokeRect(X - w/2, Y - 24, w, 30);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e0a53c";
    ctx.fillText("POCHE · " + po.corps + " CORPS", X, Y - 12);
    ctx.fillStyle = "#e8e4d6";
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillText(txt, X, Y + 1);
  }

  dessinerBatailles(sx, sy);

  // pions
  for (const u of etat.unites){
    const X = u.ax*sx, Y = u.ay*sy, W = 34, H = 21;
    const rav = ravitaillement(u);
    ctx.fillStyle = u.camp === ROUGE ? "#b02a20" : "#2f5d8a";
    ctx.strokeStyle = etat.selection === u.id ? "#e0a53c" : "rgba(0,0,0,.7)";
    ctx.lineWidth = etat.selection === u.id ? 2.5 : 1;
    ctx.fillRect(X-W/2, Y-H/2, W, H);
    ctx.strokeRect(X-W/2, Y-H/2, W, H);

    if (rav === 0){                       // encerclé : liseré ambre pulsant
      ctx.strokeStyle = (Math.sin(performance.now()/300) > 0) ? "#e0a53c" : "#7a5a20";
      ctx.lineWidth = 2;
      ctx.strokeRect(X-W/2-3, Y-H/2-3, W+6, H+6);
    }
    ctx.fillStyle = "#f2eee2";
    ctx.font = "700 10px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(Math.round(u.force/1000) + "k", X, Y+1);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(X-W/2+2, Y+H/2-5, W-4, 3);
    ctx.fillStyle = u.moral > 55 ? "#8fc47a" : u.moral > 28 ? "#e0a53c" : "#d0503f";
    ctx.fillRect(X-W/2+2, Y+H/2-5, (W-4)*(u.moral/100), 3);
  }

  dessinerLegende(w, h);
}

// Légende des terrains : échantillon de motif + coût de marche, pour que le
// joueur sache lire ce qu'il voit sur la carte
function dessinerLegende(w, h){
  // seulement les terrains de la carte affichée (procédurale ou Angers)
  const items = [...new Set(etat.prov.map(p => p.terrain))].sort((a,b) => a-b);
  const lh = 17, pad = 8, cw = 26, sh = 13;
  const bh = 15 + items.length*lh + pad;
  const bw = 140;
  const x0 = 8, y0 = Math.max(8, h - bh - 8);
  ctx.save();
  ctx.fillStyle = "rgba(14,16,14,.88)";
  ctx.fillRect(x0, y0, bw, bh);
  ctx.strokeStyle = "#3a423a"; ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, bw, bh);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8d9088";
  ctx.font = "700 9px 'Saira Condensed', sans-serif";
  ctx.fillText("TERRAIN · COÛT DE MARCHE", x0+pad, y0+11);

  items.forEach((t, k) => {
    const yy = y0 + 15 + k*lh;
    const col = TERRAINS[t].col;
    for (let py = 0; py < sh; py++)
      for (let px = 0; px < cw; px++){
        const mo = motifTerrain(t, px, py);
        ctx.fillStyle = `rgb(${Math.max(0,col[0]+mo)},${Math.max(0,col[1]+mo)},${Math.max(0,col[2]+mo)})`;
        ctx.fillRect(x0+pad+px, yy+py, 1, 1);
      }
    ctx.strokeStyle = "#0e100e"; ctx.lineWidth = 1;
    ctx.strokeRect(x0+pad, yy, cw, sh);
    ctx.fillStyle = "#e8e4d6";
    ctx.font = "11px 'Saira Condensed', sans-serif";
    ctx.fillText(`${TERRAINS[t].nom} ×${coutMarche(t)}`, x0+pad+cw+7, yy+10);
  });
  ctx.restore();
}
const coutMarche = t => Math.max(1, Math.round(TERRAINS[t].cout));

// Marqueurs de combat : là où le sang a coulé ce jour-là. Un halo bref sur la
// province, et un cartouche opaque au-dessus qui porte le bilan des deux camps.
function dessinerBatailles(sx, sy){
  for (const b of etat.batailles){
    const X = b.x*sx, Y = b.y*sy;
    const k = 1 - b.t;                       // 1 au déclenchement → 0 à la fin
    ctx.save();

    // halo court et net sur le lieu du combat
    const R = 14 + b.t*10;
    const grad = ctx.createRadialGradient(X, Y, 1, X, Y, R);
    const teinte = b.perce ? "224,165,60" : "208,80,63";
    grad.addColorStop(0, `rgba(${teinte},${0.6*k})`);
    grad.addColorStop(1, `rgba(${teinte},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, 7); ctx.fill();

    // pastille d'épées croisées, marque le point de contact
    ctx.fillStyle = `rgba(14,16,14,${0.55 + 0.35*k})`;
    ctx.beginPath(); ctx.arc(X, Y, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,240,224,${0.6 + 0.4*k})`;
    ctx.lineWidth = 2; const s = 4.5;
    ctx.beginPath();
    ctx.moveTo(X-s, Y-s); ctx.lineTo(X+s, Y+s);
    ctx.moveTo(X+s, Y-s); ctx.lineTo(X-s, Y+s);
    ctx.stroke();

    if (b.perteAtt + b.perteDef <= 0){ ctx.restore(); continue; }

    // cartouche opaque au-dessus — c'est lui qui rend les chiffres lisibles
    const bleuPerd  = (b.campAtt === BLEU ? b.perteAtt : b.perteDef).toLocaleString("fr-FR");
    const rougePerd = (b.campAtt === BLEU ? b.perteDef : b.perteAtt).toLocaleString("fr-FR");
    ctx.font = "700 12px 'Share Tech Mono', monospace";
    const wB = ctx.measureText("-"+bleuPerd).width;
    const wR = ctx.measureText("-"+rougePerd).width;
    const gap = 20;                          // place pour les épées au centre
    const cw = wB + wR + gap + 20;
    const ch = 22;
    let cx = X - cw/2;
    const cy = Y - 20 - ch - b.t*10;         // s'élève doucement
    // clamp horizontal dans le canvas
    cx = Math.max(4, Math.min(cx, cv.clientWidth - cw - 4));

    ctx.globalAlpha = Math.min(1, k*1.6);    // reste opaque plus longtemps, s'efface vite en fin
    // tige reliant le cartouche au lieu
    ctx.strokeStyle = `rgba(${teinte},.9)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X, Y-8); ctx.lineTo(cx+cw/2, cy+ch); ctx.stroke();

    ctx.fillStyle = "rgba(10,11,10,.94)";
    roundRect(cx, cy, cw, ch, 3); ctx.fill();
    ctx.strokeStyle = `rgba(${teinte},.95)`; ctx.lineWidth = 1.5;
    roundRect(cx, cy, cw, ch, 3); ctx.stroke();

    const midY = cy + ch/2 + 4;
    ctx.textAlign = "left";
    ctx.fillStyle = "#9dc6ee";
    ctx.fillText("-"+bleuPerd, cx + 8, midY);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff8a7e";
    ctx.fillText("-"+rougePerd, cx + cw - 8, midY);
    // petites épées au centre du cartouche
    const mx = cx + 8 + wB + gap/2, my = cy + ch/2;
    ctx.strokeStyle = "rgba(232,228,214,.85)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx-3, my-3); ctx.lineTo(mx+3, my+3);
    ctx.moveTo(mx+3, my-3); ctx.lineTo(mx-3, my+3);
    ctx.stroke();

    ctx.restore();
  }
}

function roundRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
