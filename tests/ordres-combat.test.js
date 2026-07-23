import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU } from "../js/config.js";
import { calculerSupply } from "../js/logistique.js";
import { donnerOrdre, executerOrdres } from "../js/ordres.js";
import { combat, attrition } from "../js/combat.js";
import { iaRouge } from "../js/ia.js";

test("un ordre suit latence de transmission puis marche, étape par étape", () => {
  carteRuban();
  calculerSupply();
  const u = poserCorps(BLEU, 0, 12000);
  donnerOrdre(u, 2);

  assert.equal(etat.ordres.length, 1);
  const o = etat.ordres[0];
  assert.ok(o.transmisLe > etat.jour, "la transmission prend au moins un jour");

  etat.jour = o.transmisLe; o.transmis = true;
  etat.jour = o.arrive;
  executerOrdres();
  assert.equal(u.prov, 1, "première étape franchie");

  etat.jour = o.arrive;
  executerOrdres();
  assert.equal(u.prov, 2, "objectif atteint");
  assert.equal(etat.ordres.length, 0, "l'ordre accompli disparaît");
});

test("entrer dans une province ennemie vide la conquiert", () => {
  carteRuban();
  calculerSupply();
  const u = poserCorps(BLEU, 2, 12000);
  donnerOrdre(u, 3);
  const o = etat.ordres[0];
  etat.jour = o.transmisLe; o.transmis = true;
  etat.jour = o.arrive;
  executerOrdres();

  assert.equal(u.prov, 3);
  assert.equal(etat.prov[3].proprio, BLEU);
});

test("combat : la supériorité nette perce et fait décrocher le défenseur", () => {
  carteRuban();
  calculerSupply();
  const att = poserCorps(BLEU, 2, 30000, 95);
  const def = poserCorps(ROUGE, 3, 5000, 50);

  const passe = combat(att, [def], etat.prov[3]);

  assert.equal(passe, true, "percée attendue à ce rapport de forces");
  assert.equal(att.prov, 3);
  assert.equal(etat.prov[3].proprio, BLEU);
  assert.equal(def.prov, 4, "le défenseur décroche vers l'arrière ami");
  assert.equal(etat.batailles.length, 1);
  // l'axe d'assaut part de la province d'origine de l'attaquant, pas du lieu
  assert.equal(etat.batailles[0].xa, etat.prov[2].cx);
  assert.equal(etat.batailles[0].ya, etat.prov[2].cy);
  assert.ok(att.force < 30000 && def.force < 5000, "les deux camps subissent des pertes");
});

test("le terrain défend : le même assaut perce en plaine mais est repoussé en montagne", () => {
  // le ratio de combat est déterministe (seule l'intensité des pertes est
  // tirée) : à 2 contre 1, la plaine cède (ratio ≈ 0.67) et la montagne
  // (défense ×1.85) tient (ratio ≈ 0.52) — des deux côtés du seuil de percée
  carteRuban();
  calculerSupply();
  const att = poserCorps(BLEU, 2, 20000, 90);
  const def = poserCorps(ROUGE, 3, 10000, 90);
  assert.equal(combat(att, [def], etat.prov[3]), true);
  assert.equal(etat.prov[3].proprio, BLEU);

  carteRuban();
  etat.prov[3].terrain = 3;              // montagne
  const u = poserCorps(BLEU, 2, 20000, 90);
  poserCorps(ROUGE, 3, 10000, 90);
  calculerSupply();
  donnerOrdre(u, 3);
  const o = etat.ordres[0];
  etat.jour = o.transmisLe; o.transmis = true;
  etat.jour = o.arrive;
  executerOrdres();

  assert.equal(u.prov, 2, "l'attaquant repoussé reste sur sa province");
  assert.equal(etat.prov[3].proprio, ROUGE);
  assert.equal(etat.ordres.length, 0, "l'ordre repoussé tombe");
  assert.ok(u.force < 20000, "être repoussé coûte des hommes");
});

test("attrition : bien ravitaillé un corps se renforce, coupé il s'érode", () => {
  carteRuban();
  const nourri = poserCorps(BLEU, 0, 10000, 50);
  calculerSupply();
  attrition();
  assert.ok(nourri.force > 10000, "à ravitaillement plein, les renforts arrivent");
  assert.ok(nourri.moral > 50, "le moral dérive vers le palier logistique haut");

  carteRuban();
  etat.prov[1].proprio = ROUGE;          // isole la province 2
  const coupe = poserCorps(BLEU, 2, 10000, 90);   // moral haut : pas de capitulation
  calculerSupply();
  attrition();
  assert.ok(coupe.force < 10000, "coupé de l'arrière, le corps s'érode");
  assert.ok(coupe.moral < 90, "le moral d'un corps coupé s'effondre vers 0");
  assert.ok(etat.unites.includes(coupe), "tant que le moral tient, pas de capitulation");
});

test("l'IA rouge attaque la province bleue voisine la plus faiblement tenue", () => {
  carteRuban();
  // deux voisines bleues pour exercer le choix : la 1 (faible) via une route
  // ajoutée, la 2 (forte) — l'état-major rouge doit viser la faible
  etat.prov[3].voisins.push(1); etat.prov[1].voisins.push(3);
  const rouge = poserCorps(ROUGE, 3, 20000);
  poserCorps(BLEU, 2, 20000);
  poserCorps(BLEU, 1, 3000);
  calculerSupply();

  // l'IA passe son tour 35 % du temps : on boucle, l'inertie prolongée est
  // impossible (0.35^60) — invariant robuste au tirage
  for (let n = 0; n < 60 && !etat.ordres.length; n++) iaRouge();

  assert.equal(etat.ordres.length, 1);
  const o = etat.ordres[0];
  assert.equal(o.unite, rouge.id);
  assert.equal(o.chemin[o.chemin.length-1], 1, "cible attendue : la voisine la plus faible");
  iaRouge();
  assert.equal(etat.ordres.length, 1, "un corps déjà commandé ne reçoit pas de second ordre");
});

test("attrition : un corps coupé et démoralisé capitule", () => {
  carteRuban();
  etat.prov[1].proprio = ROUGE;          // isole la province 2
  const u = poserCorps(BLEU, 2, 10000, 10);
  calculerSupply();

  attrition();
  assert.ok(!etat.unites.includes(u), "le corps encerclé sans moral capitule");
});
