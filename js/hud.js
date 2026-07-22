import { TERRAINS, ROUGE, BLEU } from "./config.js";
import { etat, ravitaillement } from "./etat.js";

const elFiche = document.getElementById("fiche");
const elJournal = document.getElementById("journal");
const elCptR = document.getElementById("cptRouge");
const elCptB = document.getElementById("cptBleu");

export function journal(txt){
  const l = document.createElement("div");
  l.innerHTML = `<span style="opacity:.5">J${String(etat.jour).padStart(3,"0")}</span> ${txt}`;
  elJournal.prepend(l);
  while (elJournal.children.length > 60) elJournal.lastChild.remove();
}

export function majCompteurs(){
  const t = c => etat.unites.filter(u => u.camp === c).reduce((s,u) => s+u.force, 0);
  elCptR.firstChild.nodeValue = t(ROUGE).toLocaleString("fr-FR");
  elCptB.firstChild.nodeValue = t(BLEU).toLocaleString("fr-FR");
}

export function ficheVide(){ elFiche.innerHTML = '<span class="vide">Corps sélectionné : aucun.</span>'; }

export function ficheUnite(u){
  const prov = etat.prov;
  const r = ravitaillement(u);
  const o = etat.ordres.find(x => x.unite === u.id);
  elFiche.innerHTML = `
    <div style="font-weight:700;letter-spacing:.1em">${u.nom} · corps d'armée</div>
    <div style="font-family:'Share Tech Mono',monospace">${u.force.toLocaleString("fr-FR")} hommes</div>
    <div style="font-size:12px;letter-spacing:.2em;color:var(--os-faible);margin-top:4px">MORAL</div>
    <div class="jauge"><i style="width:${u.moral}%;background:${u.moral>55?"#8fc47a":u.moral>28?"#e0a53c":"#d0503f"}"></i></div>
    <div style="font-size:12px;letter-spacing:.2em;color:var(--os-faible)">RAVITAILLEMENT</div>
    <div class="jauge"><i style="width:${Math.round(r*100)}%;background:${r>0?"#e0a53c":"#d0503f"}"></i></div>
    <div>${r === 0 ? "<b style='color:#d0503f'>Coupé de l'arrière</b>"
      : Math.round(r*100)+" % · terrain "+TERRAINS[prov[u.prov].terrain].nom
        + (prov[u.prov].debit < 0.85 ? ` · <b style="color:var(--ambre)">axe saturé (${Math.round(prov[u.prov].debit*100)} %)</b>` : "")}</div>
    ${o ? `<div style="color:var(--ambre)">${
      o.transmis
        ? `En marche — prochaine province dans ${Math.max(0, o.arrive - etat.jour)} j`
        : `Ordre en transmission — reçu dans ${Math.max(0, o.transmisLe - etat.jour)} j`
    }${o.chemin.length - o.idx > 1 ? ` · étape ${o.idx+1}/${o.chemin.length}` : ""}</div>` : ""}`;
}

export function ficheProv(p){
  const camp = p.proprio === ROUGE ? "Fédération" : p.proprio === BLEU ? "Alliance" : "neutre";
  elFiche.innerHTML = `
    <div style="font-weight:700;letter-spacing:.1em">Province ${p.id} · ${camp}</div>
    <div>${TERRAINS[p.terrain].nom}${p.ville ? " · nœud routier" : ""}${p.depot ? " · <b>dépôt</b>" : ""}${p.qg ? " · <b>QG</b>" : ""}</div>
    <div style="font-size:12px;letter-spacing:.2em;color:var(--os-faible);margin-top:4px">RAVITAILLEMENT REÇU</div>
    <div class="jauge"><i style="width:${Math.round(p.supply*100)}%;background:#e0a53c"></i></div>
    <div style="font-size:12px;letter-spacing:.2em;color:var(--os-faible)">TRANSIT ${Math.round(p.charge*12)}k / ${Math.round(p.cap*12)}k</div>
    <div class="jauge"><i style="width:${Math.min(100,Math.round(p.charge/Math.max(p.cap,.01)*100))}%;background:${p.congestion<0.7?"#d0503f":p.congestion<0.95?"#e0a53c":"#8fc47a"}"></i></div>
    <div>Défense ×${TERRAINS[p.terrain].def.toFixed(2)}</div>`;
}
