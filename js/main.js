import "./interaction.js";
import { dessiner } from "./rendu.js";
import { chargerOSM } from "./osm.js";

requestAnimationFrame(dessiner);
chargerOSM();
