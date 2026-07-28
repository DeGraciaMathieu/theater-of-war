import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU } from "../js/config.js";
import { calculerSupply } from "../js/logistique.js";
import { executerOrdres } from "../js/ordres.js";
import { iaRouge } from "../js/ia.js";

// Remplace l'adjacence du ruban par un graphe posé à la main (arêtes symétriques).
function relier(aretes){
  for (const p of etat.prov) p.voisins = [];
  for (const [a, b] of aretes){ etat.prov[a].voisins.push(b); etat.prov[b].voisins.push(a); }
}

test("logistique offensive : à défense égale, l'IA vise la province dont la chute coupe l'arrière bleu", () => {
  carteRuban();
  // prov3 (rouge) touche deux cibles bleues de même garnison : prendre la 1
  // isole la 2 (poche), prendre la 2 ne coupe rien — l'IA doit choisir la 1
  etat.prov[3].voisins.push(1); etat.prov[1].voisins.push(3);
  poserCorps(ROUGE, 3, 20000);
  poserCorps(BLEU, 2, 8000);
  poserCorps(BLEU, 1, 8000);
  calculerSupply();

  iaRouge();

  assert.equal(etat.iaAxe.prov, 1, "l'axe se fixe sur la coupure, pas sur l'égale faiblesse");
});

test("axe d'effort persistant : l'IA ne bascule pas vers une cible devenue plus tentante", () => {
  carteRuban();
  etat.prov[3].voisins.push(1); etat.prov[1].voisins.push(3);
  poserCorps(ROUGE, 3, 20000);
  poserCorps(BLEU, 2, 8000);
  poserCorps(BLEU, 1, 8000);
  calculerSupply();

  iaRouge();
  const axe = etat.iaAxe.prov;
  assert.equal(axe, 1);

  // la cible hors-axe s'effondre : un état-major sans mémoire y courrait
  const autre = etat.unites.find(u => u.camp === BLEU && u.prov === 2);
  autre.force = 300;
  iaRouge();

  assert.equal(etat.iaAxe.prov, axe, "l'axe tient tant qu'il reste valide");
});

test("enveloppement : l'IA coupe la liaison d'un saillant pour le réduire en poche plutôt que l'assaut frontal", () => {
  carteRuban();
  // prov2 = pointe du saillant, quasi encerclée (voisins 4,5 rouges), reliée à
  // l'arrière (dépôt 0) par la seule prov1. Couper prov1 met prov2 en poche.
  relier([[0,1],[1,2],[1,3],[2,4],[2,5],[3,4],[4,5]]);
  etat.prov[2].terrain = 3;                          // pointe en montagne : imprenable de face
  const perceur = poserCorps(ROUGE, 3, 30000, 95);   // au contact de la liaison prov1
  poserCorps(ROUGE, 4, 4000);                         // trop faibles pour percer la pointe
  poserCorps(ROUGE, 5, 4000);
  poserCorps(BLEU, 1, 3000, 60);                      // la liaison, faiblement tenue
  poserCorps(BLEU, 2, 20000, 90);                     // la pointe, retranchée
  calculerSupply();
  assert.equal(etat.prov[2].relie, true, "la pointe est ravitaillée avant la manœuvre");

  iaRouge();
  assert.equal(etat.iaAxe.prov, 1, "l'IA vise la liaison, pas la pointe défendue");

  // exécuter l'assaut sur la liaison, puis vérifier que la pointe tombe en poche
  const o = etat.ordres.find(x => x.unite === perceur.id);
  assert.ok(o, "le perceur est bien engagé sur la liaison");
  etat.jour = o.transmisLe; o.transmis = true;
  etat.jour = o.arrive;
  executerOrdres();
  assert.equal(etat.prov[1].proprio, ROUGE, "la liaison est prise");

  calculerSupply();
  assert.equal(etat.prov[2].relie, false, "la pointe est désormais coupée de l'arrière");
  assert.ok(etat.poches.some(po => po.provs.includes(2)), "elle forme une poche");
});

test("désengorgement : une réserve évite le front saturé et prend l'axe libre", () => {
  carteRuban();
  // prov2 et prov3 sont deux fronts rouges au contact du bleu (prov1) ; prov4
  // porte la réserve. prov2 est le plus proche mais saturé → cap sur prov3.
  relier([[0,1],[1,2],[1,3],[2,4],[3,4]]);
  etat.prov[2].proprio = ROUGE; etat.prov[3].proprio = ROUGE; etat.prov[4].proprio = ROUGE;
  etat.prov[3].x = 250; etat.prov[3].y = 120;   // éloigne le front libre : sans congestion, l'IA irait au plus proche
  const reserve = poserCorps(ROUGE, 4, 12000);
  calculerSupply();
  etat.prov[2].congestion = 0.3;                // front saturé
  etat.prov[3].congestion = 1;

  for (let n = 0; n < 60 && !etat.ordres.some(o => o.unite === reserve.id); n++) iaRouge();

  const o = etat.ordres.find(o => o.unite === reserve.id);
  assert.ok(o, "la réserve est acheminée");
  assert.equal(o.chemin[o.chemin.length-1], 3, "elle contourne le front saturé vers l'axe libre");
});

test("posture prudente : en infériorité au contact, l'IA renonce aux assauts d'opportunité hors de son axe", () => {
  // A=prov1 (axe, coupe prov2), B=prov2 (opportunité gagnable via R2). Une masse
  // bleue sur A rend la Fédération inférieure au contact → elle ne touche pas B.
  const construire = () => {
    carteRuban();
    relier([[0,1],[1,2],[1,3],[2,4],[3,5],[4,5]]);
    poserCorps(ROUGE, 3, 12000);          // R1, au contact de A
    poserCorps(ROUGE, 4, 12000);          // R2, au contact de B
    poserCorps(BLEU, 1, 3000, 50);        // A, faible
    poserCorps(BLEU, 2, 3000, 50);        // B, faible et gagnable
  };
  const viseB = () => etat.ordres.some(o => o.chemin[o.chemin.length-1] === 2);

  construire();
  const masse = poserCorps(BLEU, 1, 80000, 90);   // écrase le rapport de forces global
  calculerSupply();
  iaRouge();
  assert.equal(viseB(), false, "inférieure, l'IA ne saisit pas l'opportunité hors-axe");
  assert.equal(etat.iaAxe.prov, 1, "elle garde bien son axe malgré la prudence");

  // sans la masse bleue, la même opportunité est saisie : c'est bien la posture qui décidait
  construire();
  calculerSupply();
  iaRouge();
  assert.equal(viseB(), true, "à forces comparables, l'opportunité est prise");
});
