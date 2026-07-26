import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { carteRuban, poserCorps } from "./outils.js";
import { etat } from "../js/etat.js";
import { ROUGE, BLEU, AVANCE_MAX } from "../js/config.js";
import { calculerSupply } from "../js/logistique.js";
import { donnerOrdre } from "../js/ordres.js";
import { tour, avancerJusquEvenement } from "../js/tour.js";

// un corps rouge doit exister, sinon verifierFin déclare la victoire immédiate
// de l'Alliance. On le pose au contact d'un verrou bleu trop fort pour lui :
// l'IA opportuniste le fait tenir sans engager, ce qui garde ces scénarios calmes.

test("l'avance rapide s'arrête quand un corps bleu arrive à destination", () => {
  carteRuban();
  poserCorps(ROUGE, 3, 5000, 40);        // au contact mais trop faible : il tient
  poserCorps(BLEU, 2, 30000, 95);        // verrou bleu que le rouge ne peut percer
  const u = poserCorps(BLEU, 0, 12000);
  calculerSupply();
  donnerOrdre(u, 2);

  const motif = avancerJusquEvenement();

  assert.equal(motif, "corps à destination");
  assert.equal(u.prov, 2);
  assert.ok(!etat.ordres.some(o => o.unite === u.id), "l'ordre du corps arrivé est retiré");
  assert.ok(etat.jour > 1, "des jours ont été enchaînés");
});

test("prendre le dernier dépôt rouge gagne la partie, et le tour s'arrête là", () => {
  carteRuban();
  poserCorps(ROUGE, 5, 10000);
  poserCorps(BLEU, 0, 12000);
  calculerSupply();
  etat.prov[5].proprio = BLEU;           // l'unique dépôt rouge tombe

  tour();
  assert.equal(etat.fini, true, "plus aucun dépôt rouge : victoire");

  const jour = etat.jour;
  tour();
  assert.equal(etat.jour, jour, "une partie finie ne joue plus de jour");
});

test("perdre le dernier dépôt bleu perd la partie", () => {
  carteRuban();
  poserCorps(ROUGE, 5, 10000);
  poserCorps(BLEU, 0, 12000);
  calculerSupply();
  etat.prov[0].proprio = ROUGE;          // l'unique dépôt bleu tombe

  tour();
  assert.equal(etat.fini, true);
});

test("sans événement, l'avance rapide plafonne à AVANCE_MAX jours", () => {
  carteRuban();
  poserCorps(ROUGE, 3, 5000, 40);        // au contact d'un verrou trop fort : inerte
  poserCorps(BLEU, 2, 30000, 95);
  poserCorps(BLEU, 0, 12000);
  calculerSupply();

  const motif = avancerJusquEvenement();

  assert.equal(motif, "rien à signaler");
  assert.equal(etat.jour, 1 + AVANCE_MAX);
});
