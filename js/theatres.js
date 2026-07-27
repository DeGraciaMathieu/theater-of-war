import { genererCarte } from "./carte.js";

// Catalogue des théâtres proposés à l'accueil. Ajouter un théâtre = une entrée
// ici, avec sa fonction `generer`. Les théâtres à thème (procédural thématisé,
// ex. Ukraine) viendront à la suite, chacun avec sa propre génération ;
// `disponible:false` = affiché mais pas encore jouable.
export const THEATRES = [
  {
    id: "procedural",
    nom: "Carte procédurale",
    description: "Un théâtre généré aléatoirement",
    disponible: true,
    generer: genererCarte,
  },
  {
    id: "ukraine",
    nom: "Ukraine",
    description: "Bientôt disponible",
    disponible: false,
    generer: null,
  },
];
