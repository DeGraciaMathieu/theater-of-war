// Stub DOM minimal : permet d'importer les modules du jeu sous Node.
// hud.js, tour.js, carte.js… touchent document au chargement ; ici on ne
// teste que la logique, l'affichage est neutralisé.
function fauxContexte(){
  return {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w*h*4), width: w, height: h }),
    putImageData(){},
  };
}

function fauxElement(){
  return {
    textContent: "", innerHTML: "", disabled: false,
    style: {}, children: [],
    firstChild: { nodeValue: "" },
    parentElement: { hidden: true },      // overlay d'accueil réputé fermé

    setAttribute(){}, addEventListener(){}, prepend(){},
    getContext: fauxContexte,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 560 }),
  };
}

globalThis.document = {
  getElementById: () => fauxElement(),
  createElement: () => fauxElement(),
};
