import { ROUGE, BLEU, AVANCE_MAX } from "./config.js";
import { etat } from "./etat.js";
import { calculerSupply } from "./logistique.js";
import { iaRouge } from "./ia.js";
import { executerOrdres } from "./ordres.js";
import { attrition } from "./combat.js";
import { journal, majCompteurs, ficheUnite, ficheVide } from "./hud.js";

const elDate = document.getElementById("date");
const bStep = document.getElementById("bStep");
const bAuto = document.getElementById("bAuto");

export function tour(){
  if (etat.fini) return;
  etat.batailles = [];              // les combats de ce jour, pour l'affichage
  // point de départ de l'animation : où chaque pion est actuellement affiché
  for (const u of etat.unites){ u.dx = u.ax; u.dy = u.ay; }
  etat.jour++;
  calculerSupply();
  iaRouge();
  for (const o of etat.ordres) if (!o.transmis && etat.jour >= o.transmisLe) o.transmis = true;
  executerOrdres();
  attrition();
  calculerSupply();
  majCompteurs();
  verifierFin();
  etat.sale = true;
  etat.anim = 0.0001;               // lance le glissement des pions vers leur case
  elDate.textContent = "JOUR " + String(etat.jour).padStart(3,"0");
  if (etat.selection !== null){     // garder le décompte de la fiche à jour
    const sel = etat.unites.find(x => x.id === etat.selection);
    if (sel) ficheUnite(sel); else { etat.selection = null; ficheVide(); }
  }
}

// Avance rapide : enchaîner les jours tant qu'aucune décision n'attend le
// joueur — on saute l'attente (transmission, marche), jamais les décisions.
export function avancerJusquEvenement(){
  const depart = etat.jour;
  const motif = boucleAvance();
  if (etat.jour > depart)
    journal(`<b>Avance</b> J${String(depart).padStart(3,"0")} → J${String(etat.jour).padStart(3,"0")} · ${motif}`);
  return motif;
}

function boucleAvance(){
  if (etat.fini) return "partie terminée";
  for (let n = 0; n < AVANCE_MAX; n++){
    const ordresBleus = etat.ordres
      .filter(o => etat.unites.some(u => u.id === o.unite && u.camp === BLEU))
      .map(o => o.unite);
    const corpsBleus = etat.unites.filter(u => u.camp === BLEU).length;
    const alertes = new Set(etat.prov.filter(p => p.alerte).map(p => p.id));
    const poches = etat.poches.length;

    tour();

    if (etat.fini) return "fin de partie";
    if (etat.batailles.length) return "combat engagé";
    if (etat.unites.filter(u => u.camp === BLEU).length < corpsBleus) return "corps perdu";
    // u.coupe posé ce jour = bascule d'encerclement, même si le nombre de poches n'a pas bougé
    if (etat.poches.length > poches || etat.unites.some(u => u.coupe === etat.jour)) return "poche formée";
    if (ordresBleus.some(id => !etat.ordres.some(o => o.unite === id))) return "corps à destination";
    if (etat.prov.some(p => p.alerte && !alertes.has(p.id))) return "axe saturé";
  }
  return "rien à signaler";
}

function verifierFin(){
  const dr = etat.prov.filter(p => p.depot && p.proprio === ROUGE).length;
  const db = etat.prov.filter(p => p.depot && p.proprio === BLEU).length;
  if (dr === 0 || etat.unites.every(u => u.camp === BLEU)){ etat.fini = true; journal("<b>Victoire de l'Alliance.</b>"); etat.auto = false; }
  else if (db === 0 || etat.unites.every(u => u.camp === ROUGE)){ etat.fini = true; journal("<b>Défaite : le théâtre est perdu.</b>"); etat.auto = false; }
  if (etat.fini){ bStep.disabled = true; bAuto.disabled = true; bAuto.textContent = "Terminé"; }
}
