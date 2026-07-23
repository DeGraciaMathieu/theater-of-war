import { TERRAINS, BLEU, SEUIL_PERCEE } from "./config.js";
import { etat, alea, ennemiSur, unitesDe, ravitaillement } from "./etat.js";
import { journal } from "./hud.js";

export function combat(att, defs, lieu){
  const t = TERRAINS[lieu.terrain];
  const pAtt = att.force * (att.moral/100) * (0.35 + 0.65*ravitaillement(att));
  const pDef = defs.reduce((s,d) => s + d.force * (d.moral/100)
                * (0.35 + 0.65*ravitaillement(d)), 0) * t.def;

  const ratio = pAtt / (pAtt + pDef);
  const intensite = 0.06 + alea()*0.07;

  const fAtt0 = att.force, fDef0 = defs.reduce((s,d) => s + d.force, 0);
  att.force = Math.round(att.force * (1 - intensite*(1-ratio)*1.2));
  att.moral -= (1-ratio) * 13;
  for (const d of defs){
    d.force = Math.round(d.force * (1 - intensite*ratio*1.2));
    d.moral -= ratio * 13;
  }
  const perteAtt = fAtt0 - att.force;
  const perteDef = fDef0 - defs.reduce((s,d) => s + d.force, 0);

  const perce = ratio > SEUIL_PERCEE;
  etat.batailles.push({                // événement affiché pendant l'animation du jour
    prov: lieu.id, x: lieu.cx, y: lieu.cy,
    // origine de l'assaut : att.prov est encore la province de départ ici,
    // l'attaquant n'entre dans lieu qu'en cas de percée — l'axe sert au rendu
    xa: etat.prov[att.prov].cx, ya: etat.prov[att.prov].cy,
    campAtt: att.camp, perce,
    perteAtt, perteDef, t: 0,
  });

  if (perce){
    // les défenseurs décrochent vers une province amie ravitaillée
    for (const d of defs){
      const repli = etat.prov[d.prov].voisins
        .filter(v => etat.prov[v].proprio === d.camp && !ennemiSur(v, d.camp))
        .sort((a,b) => etat.prov[b].supply - etat.prov[a].supply)[0];
      if (repli !== undefined){ d.prov = repli; d.moral -= 6; }
      else { detruire(d, "anéanti, sans ligne de repli"); }
    }
    if (unitesDe(lieu.id).every(x => x.camp === att.camp || false)){
      att.prov = lieu.id; lieu.proprio = att.camp;
    }
    if (att.camp === BLEU) journal(`<b>${att.nom}</b> enfonce ${lieu.id} — ${perteDef.toLocaleString("fr-FR")} pertes ennemies, ${perteAtt.toLocaleString("fr-FR")} des nôtres.`);
    nettoyer();
    return true;
  } else if (att.camp === BLEU){
    journal(`<b>${att.nom}</b> repoussé sur ${lieu.id} — ${perteAtt.toLocaleString("fr-FR")} pertes.`);
  }
  nettoyer();
  return false;
}

function detruire(u, raison){
  etat.unites = etat.unites.filter(x => x.id !== u.id);
  etat.ordres = etat.ordres.filter(o => o.unite !== u.id);
  journal(`<b>${u.nom}</b> ${raison}.`);
}

function nettoyer(){
  const prov = etat.prov;
  for (const u of [...etat.unites]){
    if (u.force >= 2000) continue;
    // un corps exsangue tente d'abord de décrocher vers l'arrière ravitaillé ;
    // il ne se dissout que s'il est acculé — et jamais sans une ligne de journal
    const repli = prov[u.prov].voisins
      .filter(v => prov[v].proprio === u.camp && !ennemiSur(v, u.camp) && prov[v].relie)
      .sort((a,b) => prov[b].supply - prov[a].supply)[0];
    if (repli !== undefined && u.force >= 900){
      u.prov = repli; u.moral = Math.max(u.moral, 25);
      if (u.camp === BLEU) journal(`<b>${u.nom}</b> laminé, décroche sur ${repli}.`);
    } else {
      detruire(u, "anéanti");
    }
  }
}

export function attrition(){
  for (const u of [...etat.unites]){
    const r = ravitaillement(u);
    // le moral dérive vers un palier imposé par la logistique, il ne s'effondre
    // pas tout seul : c'est la coupure du ravitaillement qui tue, pas le temps
    const palier = r === 0 ? 0 : 18 + 78*r;
    u.moral += (palier - u.moral) * (u.moral > palier ? 0.09 : 0.05);
    u.moral = Math.max(0, Math.min(100, u.moral));

    if (r < 0.7) u.force = Math.round(u.force * (1 - (0.7-r)*0.012));
    else u.force = Math.round(u.force * 1.003);

    if (r === 0 && u.moral < 20){ detruire(u, "capitule, encerclé"); }
  }
  nettoyer();
}
