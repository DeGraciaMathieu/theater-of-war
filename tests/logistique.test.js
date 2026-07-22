import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU } from "../js/config.js";
import { calculerSupply, axeRavitaillement, porteeDepuis } from "../js/logistique.js";

test("le ravitaillement décroît avec la distance au dépôt", () => {
  carteRuban();
  calculerSupply();
  const [p0, p1, p2] = etat.prov;
  assert.ok(p0.supply > p1.supply && p1.supply > p2.supply);
  for (const p of etat.prov) assert.ok(p.relie, `province ${p.id} devrait être reliée`);
  // courbe douce : à 2 provinces du dépôt on reste bien ravitaillé
  // (√(1-2/15) ≈ 0.93 — la courbe linéaire d'origine donnait 0.87)
  assert.ok(p2.supply > 0.9, `supply attendu > 0.9 à d=2, obtenu ${p2.supply.toFixed(2)}`);
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

test("l'axe de ravitaillement remonte au dépôt et pointe le maillon le plus serré", () => {
  carteRuban();
  const u = poserCorps(BLEU, 2, 240000);   // charge 20 pour 5 de cap en plaine : ça sature
  calculerSupply();
  const axe = axeRavitaillement(u);
  assert.deepEqual(axe.chemin, [2, 1, 0]);
  assert.notEqual(axe.goulot, null);
  const min = Math.min(...axe.chemin.map(i => etat.prov[i].congestion));
  assert.equal(etat.prov[axe.goulot].congestion, min);
  assert.ok(min < 1);
});

test("sans saturation pas de goulot, sans corridor pas d'axe", () => {
  carteRuban();
  const leger = poserCorps(BLEU, 2, 10000);
  calculerSupply();
  assert.equal(axeRavitaillement(leger).goulot, null);
  etat.prov[1].proprio = ROUGE;            // coupe le ruban bleu
  calculerSupply();
  assert.equal(axeRavitaillement(leger), null);
});

test("l'arbre de supply conservé par camp porte la charge des convois", () => {
  carteRuban();
  poserCorps(BLEU, 2, 24000);
  calculerSupply();
  assert.equal(etat.arbreSupply[BLEU][1], 0);
  assert.equal(etat.arbreSupply[BLEU][2], 1);
  assert.equal(etat.arbreSupply[ROUGE][4], 5);
  // la charge suit exactement la chaîne des parents : c'est elle que les convois dessinent
  for (const id of [2, 1, 0]) assert.ok(etat.prov[id].charge > 0);
  assert.equal(etat.prov[4].charge, 0);  // pas de corps rouge : aucun convoi côté Fédération
});

test("la portée d'un dépôt s'arrête au corridor ami", () => {
  carteRuban();
  assert.deepEqual([...porteeDepuis(0)].sort(), [0, 1, 2]);
  poserCorps(ROUGE, 1, 10000);             // un ennemi sur le corridor le ferme
  assert.deepEqual([...porteeDepuis(0)], [0]);
});

test("un dépôt occupé par l'ennemi ne ravitaille plus", () => {
  carteRuban();
  poserCorps(ROUGE, 0, 10000);           // l'ennemi est sur le dépôt bleu
  calculerSupply();
  for (const p of etat.prov.filter(p => p.proprio === BLEU))
    assert.equal(p.relie, false);
});
