import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU } from "../js/config.js";
import { calculerSupply } from "../js/logistique.js";
import { donnerOrdre, executerOrdres } from "../js/ordres.js";
import { combat, attrition } from "../js/combat.js";

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
  assert.ok(att.force < 30000 && def.force < 5000, "les deux camps subissent des pertes");
});

test("attrition : un corps coupé et démoralisé capitule", () => {
  carteRuban();
  etat.prov[1].proprio = ROUGE;          // isole la province 2
  const u = poserCorps(BLEU, 2, 10000, 10);
  calculerSupply();

  attrition();
  assert.ok(!etat.unites.includes(u), "le corps encerclé sans moral capitule");
});
