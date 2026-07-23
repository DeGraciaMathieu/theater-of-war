import "./stub-dom.js";
import test from "node:test";
import assert from "node:assert/strict";
import { etat } from "../js/etat.js";
import { NB_PROV, ROUGE, BLEU, RW, RH, TERRAINS } from "../js/config.js";
import { genererCarte } from "../js/carte.js";

test("genererCarte produit un théâtre jouable", () => {
  genererCarte();

  assert.equal(etat.prov.length, NB_PROV);

  // adjacence symétrique : si a voit b, b voit a
  for (const p of etat.prov)
    for (const v of p.voisins)
      assert.ok(etat.prov[v].voisins.includes(p.id), `adjacence asymétrique ${p.id}↔${v}`);

  // chaque camp a ses 3 dépôts (dont un avancé) et son QG
  for (const camp of [ROUGE, BLEU]){
    const depots = etat.prov.filter(p => p.depot && p.proprio === camp);
    assert.equal(depots.length, 3);
    assert.equal(etat.prov.filter(p => p.qg && p.proprio === camp).length, 1);
    // le dépôt avancé projette le ravitaillement vers le front : au moins un
    // dépôt est nettement plus proche du centre de la carte que le coin de départ
    const auCentre = Math.min(...depots.map(d => Math.hypot(d.x - RW/2, d.y - RH/2)));
    assert.ok(auCentre < 240, `dépôt avancé attendu près du centre, plus proche à ${Math.round(auCentre)}px`);
  }

  // 8 corps par camp (7 au front + 1 réserve), chacun sur une province amie
  for (const camp of [ROUGE, BLEU])
    assert.equal(etat.unites.filter(u => u.camp === camp).length, 8);
  for (const u of etat.unites)
    assert.equal(etat.prov[u.prov].proprio, u.camp);

  // le supply initial est calculé : les alentours des dépôts sont ravitaillés
  assert.ok(etat.prov.some(p => p.supply > 0));
});

test("la carte procédurale contient du bois, sans en être couverte", () => {
  genererCarte();
  const BOIS = TERRAINS.findIndex(t => t.nom === "bois");
  const bois = etat.prov.filter(p => p.terrain === BOIS).length;
  assert.ok(bois > 0, "aucune province de bois");
  // le bois ne remplace que les terres basses du haut du champ de végétation :
  // il ne peut pas dépasser le quantile qui le définit
  assert.ok(bois <= NB_PROV * 0.25, `carte couverte de bois : ${bois} provinces`);
});

test("les nœuds routiers procéduraux portent le terrain urbain", () => {
  genererCarte();
  const URBAIN = TERRAINS.findIndex(t => t.nom === "urbain");
  const villes = etat.prov.filter(p => p.ville);
  assert.ok(villes.length > 0, "aucun nœud routier");
  for (const p of villes) assert.equal(p.terrain, URBAIN);
});
