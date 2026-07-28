# Théâtre — wargame opérationnel

Wargame de logistique en navigateur : le joueur (Alliance, bleu) commande des corps
d'armée sur une carte de provinces procédurale contre l'IA (Fédération, rouge), où le
ravitaillement décide de tout.

**Vanilla JS (modules ES natifs), HTML, CSS.** Aucune dépendance, aucun build, aucun
framework.

## Lancer le projet

Les modules ES imposent un serveur HTTP (ouvrir `index.html` en `file://` casse les
imports). Depuis la racine du dépôt :

```bash
python3 -m http.server
```

Puis ouvrir <http://localhost:8000> dans le navigateur.

- Pas de build ni de rechargement à chaud : après une modification, rafraîchir la page.
- Port déjà pris ? `python3 -m http.server 8123` (ou tout autre port).
- Les règles du jeu sont sur `regles.html` (page autonome).

## Tests

```bash
npm test
```

équivaut à `node --test "tests/*.test.js"` (le glob est obligatoire). Les tests tournent
sous Node avec un stub DOM (`tests/stub-dom.js`) et ne couvrent que la logique.

## Structure

Le détail de l'architecture, des conventions de code et des modules est dans
[`CLAUDE.md`](CLAUDE.md).
