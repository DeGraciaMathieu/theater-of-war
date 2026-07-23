import { RW, RH, BLEU } from "./config.js";
import { etat, unitesDe } from "./etat.js";
import { cheminVers, estimerOrdre, donnerOrdre, annulerOrdre } from "./ordres.js";
import { porteeDepuis } from "./logistique.js";
import { ficheVide, ficheUnite, ficheProv } from "./hud.js";
import { genererCarte } from "./carte.js";
import { tour, avancerJusquEvenement } from "./tour.js";

const cv = document.getElementById("cv");
const elDate = document.getElementById("date");
const elJournal = document.getElementById("journal");

function provSous(ev){
  const r = cv.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left) / r.width * RW);
  const y = Math.floor((ev.clientY - r.top) / r.height * RH);
  if (x < 0 || y < 0 || x >= RW || y >= RH) return -1;
  return etat.siteIdx[y*RW + x];
}

cv.addEventListener("pointermove", e => {
  const s2 = provSous(e);
  if (s2 !== etat.survol){
    etat.survol = s2; etat.sale = true;
    // survol d'un dépôt : montrer sa zone d'action réelle
    const p = s2 >= 0 ? etat.prov[s2] : null;
    etat.porteeDepot = p && p.depot && p.proprio ? { prov: s2, provs: porteeDepuis(s2) } : null;
  }
  // aperçu de l'ordre projeté vers la province survolée
  etat.apercu = null;
  if (etat.selection !== null && etat.survol >= 0){
    const u = etat.unites.find(x => x.id === etat.selection);
    if (u && etat.survol !== u.prov){
      const ch = cheminVers(u, etat.survol);
      if (ch) etat.apercu = { chemin: ch, est: estimerOrdre(u, ch) };
    }
  }
});
cv.addEventListener("pointerleave", () => {
  if (etat.survol !== -1){ etat.survol = -1; etat.sale = true; }
  etat.apercu = null; etat.porteeDepot = null;
});

cv.addEventListener("pointerdown", e => {
  const id = provSous(e);
  if (id < 0) return;
  const mien = unitesDe(id).find(u => u.camp === BLEU);
  etat.apercu = null;

  if (etat.selection){
    const u = etat.unites.find(x => x.id === etat.selection);
    if (u){
      if (id === u.prov){ annulerOrdre(u); etat.selection = null; ficheUnite(u); return; }
      donnerOrdre(u, id); etat.selection = null; ficheVide(); return;
    }
  }
  if (mien){ etat.selection = mien.id; ficheUnite(mien); }
  else { etat.selection = null; ficheProv(etat.prov[id]); }
});

const bStep = document.getElementById("bStep");
const bAuto = document.getElementById("bAuto");
bStep.onclick = () => { if (!etat.fini && !etat.anim) tour(); };
document.getElementById("bEvent").onclick = () => { if (!etat.fini && !etat.anim) avancerJusquEvenement(); };
// Espace = « Jour suivant » — sauf sur un bouton focalisé, où la touche l'activerait déjà
document.addEventListener("keydown", e => {
  if (e.code !== "Space" || e.repeat || e.target.tagName === "BUTTON") return;
  e.preventDefault();
  if (!etat.fini && !etat.anim) tour();
});
bAuto.onclick = () => {
  etat.auto = !etat.auto;
  bAuto.setAttribute("aria-pressed", etat.auto);
  bAuto.textContent = etat.auto ? "Pause" : "Lecture auto";
};
const bSupply = document.getElementById("bSupply");
bSupply.onclick = () => {
  etat.vueSupply = !etat.vueSupply; etat.sale = true;
  bSupply.setAttribute("aria-pressed", etat.vueSupply);
};
const bCamps = document.getElementById("bCamps");
bCamps.onclick = () => {
  etat.teinteCamps = !etat.teinteCamps; etat.sale = true;
  bCamps.setAttribute("aria-pressed", etat.teinteCamps);
};
document.getElementById("bReset").onclick = () => {
  elJournal.innerHTML = ""; genererCarte();
  etat.auto = false; bAuto.setAttribute("aria-pressed", false); bAuto.textContent = "Lecture auto";
  ficheVide(); elDate.textContent = "JOUR 001";
};
// Accueil : la carte procédurale du démarrage est déjà prête derrière l'overlay
const elAccueil = document.getElementById("accueil");
document.getElementById("bAccueilProcedural").onclick = () => { elAccueil.hidden = true; };
