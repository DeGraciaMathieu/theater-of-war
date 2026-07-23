import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU, AVANCE_MAX } from "../js/config.js";
import { calculerSupply } from "../js/logistique.js";
import { donnerOrdre } from "../js/ordres.js";
import { avancerJusquEvenement } from "../js/tour.js";

// le corps rouge posé sur son dépôt (province 5) est inerte : aucune cible
// bleue voisine, aucun axe d'avance — et sans lui verifierFin déclarerait
// la victoire immédiate de l'Alliance

test("l'avance rapide s'arrête quand un corps bleu arrive à destination", () => {
  carteRuban();
  poserCorps(ROUGE, 5, 10000);
  const u = poserCorps(BLEU, 0, 12000);
  calculerSupply();
  donnerOrdre(u, 2);

  const motif = avancerJusquEvenement();

  assert.equal(motif, "corps à destination");
  assert.equal(u.prov, 2);
  assert.equal(etat.ordres.length, 0);
  assert.ok(etat.jour > 1, "des jours ont été enchaînés");
});

test("sans événement, l'avance rapide plafonne à AVANCE_MAX jours", () => {
  carteRuban();
  poserCorps(ROUGE, 5, 10000);
  poserCorps(BLEU, 0, 12000);
  calculerSupply();

  const motif = avancerJusquEvenement();

  assert.equal(motif, "rien à signaler");
  assert.equal(etat.jour, 1 + AVANCE_MAX);
});
