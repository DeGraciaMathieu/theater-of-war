import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU } from "../js/config.js";
import { calculerSupply } from "../js/logistique.js";

test("le ravitaillement décroît avec la distance au dépôt", () => {
  carteRuban();
  calculerSupply();
  const [p0, p1, p2] = etat.prov;
  assert.ok(p0.supply > p1.supply && p1.supply > p2.supply);
  for (const p of etat.prov) assert.ok(p.relie, `province ${p.id} devrait être reliée`);
});

test("une province sans corridor est coupée et forme une poche", () => {
  carteRuban();
  etat.prov[1].proprio = ROUGE;          // coupe le ruban bleu entre 0 et 2
  const isole = poserCorps(BLEU, 2, 10000);
  calculerSupply();

  assert.equal(etat.prov[2].relie, false);
  assert.equal(etat.prov[2].supply, 0);
  assert.equal(etat.poches.length, 1);
  assert.equal(etat.poches[0].camp, BLEU);
  assert.equal(etat.poches[0].hommes, isole.force);
});

test("un dépôt occupé par l'ennemi ne ravitaille plus", () => {
  carteRuban();
  poserCorps(ROUGE, 0, 10000);           // l'ennemi est sur le dépôt bleu
  calculerSupply();
  for (const p of etat.prov.filter(p => p.proprio === BLEU))
    assert.equal(p.relie, false);
});
