import "./stub-dom.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU } from "../js/config.js";

// Carte en ruban : 6 provinces de plaine en ligne, 0-1-2 bleues, 3-4-5 rouges,
// dépôt + QG aux deux extrémités. Assez petite pour raisonner à la main,
// assez complète pour exercer supply, ordres et combat.
export function carteRuban(){
  etat.prov = []; etat.unites = []; etat.ordres = []; etat.poches = [];
  etat.batailles = []; etat.jour = 1; etat.fini = false; etat.selection = null;
  etat.nextId = 1;
  for (let i = 0; i < 6; i++){
    etat.prov.push({
      id:i, x:i*100+50, y:280, cx:i*100+50, cy:280, px:0,
      terrain:0, proprio: i < 3 ? BLEU : ROUGE, voisins:[], depot:false, qg:false,
      supply:0, ville:false, charge:0, cap:0, congestion:1, debit:0, alerte:false, relie:false,
    });
  }
  for (let i = 0; i < 5; i++){
    etat.prov[i].voisins.push(i+1);
    etat.prov[i+1].voisins.push(i);
  }
  etat.prov[0].depot = true; etat.prov[0].qg = true;
  etat.prov[5].depot = true; etat.prov[5].qg = true;
  return etat;
}

export function poserCorps(camp, provId, force, moral = 90){
  const u = {
    id: etat.nextId++, camp, prov: provId, force, moral, coupe: 0,
    ax: etat.prov[provId].cx, ay: etat.prov[provId].cy,
    nom: (camp === BLEU ? "C." : "K.") + (etat.nextId - 1),
  };
  etat.unites.push(u);
  return u;
}
