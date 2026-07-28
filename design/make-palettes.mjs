// Generate palette variations of punk-marker. Layout is frozen: only colour
// (and, for the inverted set, the paper/ink polarity) changes.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const base = readFileSync(path.join(dir, "punk-marker.html"), "utf8");

// Accent must stay legible as type on black: all of these clear 7:1 on #000.
const LIGHT = [
  { slug: "pal-safety", accent: "#FF6A13", name: "Safety orange" },
  { slug: "pal-acid", accent: "#8BFF1F", name: "Acid green" },
  { slug: "pal-shock", accent: "#FF3E9A", name: "Shock pink" },
  { slug: "pal-cyan", accent: "#22E3F0", name: "Electric cyan" },
  { slug: "pal-flare", accent: "#FF4B3E", name: "Flare red" },
  { slug: "pal-amber", accent: "#FFB454", name: "Amber" },
  { slug: "pal-violet", accent: "#C77DFF", name: "Violet" },
  { slug: "pal-mint", accent: "#3DFFC0", name: "Mint" },
  { slug: "pal-bone", accent: "#F2F0EA", name: "Bone (no colour)" },
];

// Inverted: the sheet goes black, paper ink goes light. Same structure.
const DARK = [
  { slug: "pal-dark-marker", accent: "#F2E51B", name: "Dark stock, marker" },
  { slug: "pal-dark-cyan", accent: "#22E3F0", name: "Dark stock, cyan" },
  { slug: "pal-dark-flare", accent: "#FF4B3E", name: "Dark stock, flare" },
];

function withAccent(src, accent, title) {
  return src
    .replace(/--marker:#F2E51B;/, `--marker:${accent};`)
    .replace(/<title>[^<]*<\/title>/, `<title>AudioDeck - ${title}</title>`);
}

// Flip to a dark stock by appending an override layer, so the base sheet is
// never string-surgeried. Every rule that hard-codes black or paper is
// restated here for the dark polarity.
const DARK_OVERRIDE = `
/* ---------- dark stock override ---------- */
:root{
  --ink:#EFEDE6;
  --paper:#15150F;
  --sheet:#1F1F18;
  --dead:#2A2A22;
  --dead-ink:#A8A498;
}
body{background:#000;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.09) 0 2px,transparent 2px 9px)}
.shell{border-color:var(--ink)}
.appbar{background:#000;border-bottom-color:var(--marker)}
.brand{border-right-color:var(--ink)}
.mark{border-color:var(--ink)}
.mark i{background:var(--ink)}
.wordmark{color:var(--ink)}
.tab{color:var(--ink)}
.tab:hover::after{background:var(--ink)}
.tab[aria-selected="true"]{background:var(--ink);color:var(--paper)}
.tab[aria-selected="true"]::after{background:var(--paper)}
main{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.045) 0 1px,transparent 1px 4px)}
.blockhead h2{background:var(--ink);color:var(--paper)}
.blockhead .bar{background:var(--ink)}
.rows{border-color:var(--ink)}
.row{--fg:var(--ink);border-bottom-color:var(--ink)}
.row.inuse{--bg:#000;--fg:var(--marker)}
.row.manual{--bg:#000;--fg:var(--marker)}
.row.manual .rank{color:var(--marker)}
.row.offline{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.09) 0 3px,transparent 3px 11px)}
.add{border-color:var(--ink);color:var(--ink)}
.add:hover{background:var(--ink);color:var(--paper)}
.legend{color:var(--ink)}
.legend i{background:#000}
.legend i.man{border-color:var(--ink)}
.legend .hint{color:var(--dead-ink)}
.setlist{border-color:var(--ink)}
.setrow{--fg:var(--ink);color:var(--ink)}
.setrow+.setrow{border-top-color:var(--ink)}
.setrow:hover{background:#26261D}
.setlabel span{color:var(--dead-ink)}
.setrow select{border-color:var(--ink);background:var(--paper);color:var(--ink)}
.setrow select option{background:#1F1F18;color:var(--ink)}
.setrow select:hover{background:var(--ink);color:var(--paper)}
.about{background:var(--ink);color:var(--paper)}
.about-d{background:var(--paper)}
.sw{color:var(--ink)}
`;

function invert(src) {
  return src.replace("</style>", `${DARK_OVERRIDE}</style>`);
}

const made = [];
for (const v of LIGHT) {
  const out = withAccent(base, v.accent, v.slug);
  writeFileSync(path.join(dir, `${v.slug}.html`), out, "utf8");
  made.push(v.slug);
}
for (const v of DARK) {
  const out = withAccent(invert(base), v.accent, v.slug);
  writeFileSync(path.join(dir, `${v.slug}.html`), out, "utf8");
  made.push(v.slug);
}
console.log("wrote:", made.join(", "));
