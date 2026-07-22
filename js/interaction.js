import { RW, RH, TERRAINS } from "./config.js";
import { etat } from "./etat.js";
import { chargerOSM } from "./osm.js";
import { genererProcedural } from "./generation.js";

const cv = document.getElementById("cv");
const elFiche = document.getElementById("fiche");
const elCharge = document.getElementById("charge");

function provSous(ev){
  const r=cv.getBoundingClientRect();
  const x=Math.floor((ev.clientX-r.left)/r.width*RW);
  const y=Math.floor((ev.clientY-r.top)/r.height*RH);
  if(x<0||y<0||x>=RW||y>=RH||!etat.siteIdx) return -1;
  return etat.siteIdx[y*RW+x];
}

cv.addEventListener("pointermove",e=>{ const s=provSous(e); if(s!==etat.survol){etat.survol=s;etat.sale=true;} });
cv.addEventListener("pointerdown",e=>{
  const id=provSous(e);
  if(id<0){ elFiche.innerHTML='<span class="vide">De l\'eau — infranchissable hors des ponts.</span>'; return; }
  const p=etat.prov[id];
  const dm=Math.max(1,Math.round(TERRAINS[p.terrain].cout));
  elFiche.innerHTML=
    `<div style="font-weight:700;letter-spacing:.1em">Province ${p.id} · ${TERRAINS[p.terrain].nom}</div>`+
    `<div>coût de marche ×${dm} · défense ×${TERRAINS[p.terrain].def.toFixed(2)}</div>`+
    `<div style="font-size:10px;letter-spacing:.2em;color:var(--os-faible);margin-top:5px">DÉBIT LOGISTIQUE</div>`+
    `<div class="jauge"><i style="width:${Math.min(100,p.debit/9*100)}%;background:#e0a53c"></i></div>`+
    `<div>${p.debit.toFixed(1)} pts${p.routeRang>=3?' · <b style="color:var(--ambre)">sur grand axe</b>':p.routeRang?' · route secondaire':''}</div>`+
    `<div>${p.franchit?'<b style="color:var(--ambre)">relié par un pont</b> — coupez-le pour isoler la rive':`${p.voisins.length} provinces voisines`}</div>`;
});

document.getElementById("bTerrain").onclick=()=>{ etat.vueDebit=false; etat.sale=true;
  document.getElementById("bTerrain").setAttribute("aria-pressed",true);
  document.getElementById("bDebit").setAttribute("aria-pressed",false); };
document.getElementById("bDebit").onclick=()=>{ etat.vueDebit=true; etat.sale=true;
  document.getElementById("bDebit").setAttribute("aria-pressed",true);
  document.getElementById("bTerrain").setAttribute("aria-pressed",false); };
document.getElementById("bRecharge").onclick=()=>{ etat.siteIdx=null; chargerOSM(); };
document.getElementById("bProc").onclick=()=>{ etat.siteIdx=null; elCharge.style.display="none"; genererProcedural(); };
