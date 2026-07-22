import "./interaction.js";
import { etat } from "./etat.js";
import { genererCarte } from "./carte.js";
import { tour } from "./tour.js";
import { dessiner } from "./rendu.js";

const DUREE_ANIM = 480;             // ms d'un jour animé

function boucle(t){
  const dt = t - etat.dernier; etat.dernier = t;
  const prov = etat.prov;

  // marqueurs de combat : progressent sur ~900 ms puis s'effacent
  if (etat.batailles.length){
    for (const b of etat.batailles) b.t = Math.min(1, b.t + dt/900);
    if (etat.batailles.every(b => b.t >= 1) && etat.anim === 0) etat.batailles = [];
  }

  if (etat.anim > 0){               // un jour est en cours d'animation
    etat.anim = Math.min(1, etat.anim + dt / DUREE_ANIM);
    const e = etat.anim < .5 ? 2*etat.anim*etat.anim : 1 - (-2*etat.anim+2)**2/2;   // ease in-out
    for (const u of etat.unites){
      const cx = prov[u.prov].cx, cy = prov[u.prov].cy;
      if (u.dx === undefined){ u.ax = cx; u.ay = cy; continue; }
      u.ax = u.dx + (cx - u.dx) * e;
      u.ay = u.dy + (cy - u.dy) * e;
    }
    if (etat.anim >= 1){ etat.anim = 0; for (const u of etat.unites){ u.ax = prov[u.prov].cx; u.ay = prov[u.prov].cy; } }
  } else {
    for (const u of etat.unites){ u.ax = prov[u.prov].cx; u.ay = prov[u.prov].cy; }
    if (etat.auto && !etat.fini && !etat.batailles.length){   // laisse voir les combats avant d'enchaîner
      etat.accu += dt;
      if (etat.accu > 260){ etat.accu = 0; tour(); }
    }
  }

  dessiner();
  requestAnimationFrame(boucle);
}

genererCarte();
requestAnimationFrame(t => { etat.dernier = t; boucle(t); });
