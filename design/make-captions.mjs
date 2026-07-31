// Subtle window caption variants. The folder-tab nav bar is untouched in all
// of them: the only change is the OS caption strip above it (or, in one case,
// the controls tucked into the existing bar).

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";
const base = readFileSync(path.join(dir, "tw-folder.html"), "utf8");

const GLYPHS = `
      <button class="wcbtn" type="button" aria-label="Minimize">
        <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="5.5" width="10" height="1.4"/></svg>
      </button>
      <button class="wcbtn" type="button" aria-label="Maximize">
        <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1.4" y="1.4" width="9.2" height="9.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
      </button>
      <button class="wcbtn wcbtn-close" type="button" aria-label="Close">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.6 1.6 L10.4 10.4 M10.4 1.6 L1.6 10.4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      </button>`;

/** Shared caption CSS. Height and extras come from each variant. */
const baseCss = (height, extra) => `
/* ---------- window caption (frameless): the strip Windows would draw ---------- */
.caption{
  display:flex;align-items:center;
  height:${height}px;
  background:#000;
  /* the whole strip is the window drag handle */
  -webkit-app-region:drag;
  user-select:none;
}
.caption .cap-title{
  padding-left:16px;
  font:800 12px/1 var(--ui);letter-spacing:.2em;text-transform:uppercase;
  color:#9d9a8f;
}
.caption .cap-title b{color:var(--marker);font-weight:800}
.wc{display:flex;margin-left:auto;height:100%;-webkit-app-region:no-drag}
.wcbtn{
  width:46px;height:100%;
  display:grid;place-items:center;
  border:0;background:transparent;color:#d8d5cb;
  cursor:pointer;
  transition:background 90ms linear,color 90ms linear;
}
.wcbtn svg{width:12px;height:12px;fill:currentColor}
.wcbtn:hover{background:#2b2b22;color:var(--marker)}
.wcbtn-close:hover{background:#b3000c;color:#fff}
.wcbtn:focus-visible{outline:3px solid var(--marker);outline-offset:-3px}
${extra}`;

const VARIANTS = [
  {
    slug: "cap-bare",
    title: "Bare strip",
    css: baseCss(32, ``),
    markup: `<div class="caption"><div class="wc">${GLYPHS}\n    </div></div>`,
  },
  {
    slug: "cap-title",
    title: "Strip with wordmark",
    css: baseCss(32, ``),
    markup: `<div class="caption"><span class="cap-title">Audio<b>Deck</b></span><div class="wc">${GLYPHS}\n    </div></div>`,
  },
  {
    slug: "cap-hairline",
    title: "Separated by a hairline",
    css: baseCss(32, `.caption{border-bottom:2px solid #2b2b22}\n`),
    markup: `<div class="caption"><span class="cap-title">Audio<b>Deck</b></span><div class="wc">${GLYPHS}\n    </div></div>`,
  },
  {
    slug: "cap-amberline",
    title: "Amber hairline under the strip",
    css: baseCss(32, `.caption{border-bottom:2px solid var(--marker)}\n`),
    markup: `<div class="caption"><span class="cap-title">Audio<b>Deck</b></span><div class="wc">${GLYPHS}\n    </div></div>`,
  },
  {
    slug: "cap-tall",
    title: "Taller strip, bigger targets",
    css: baseCss(40, `.wcbtn{width:54px}\n.wcbtn svg{width:14px;height:14px}\n`),
    markup: `<div class="caption"><span class="cap-title">Audio<b>Deck</b></span><div class="wc">${GLYPHS}\n    </div></div>`,
  },
  {
    slug: "cap-status",
    title: "Strip carrying the live status",
    css: baseCss(
      34,
      `.cap-status{
  display:flex;align-items:center;gap:9px;margin-left:20px;
  font:800 12px/1 var(--ui);letter-spacing:.16em;text-transform:uppercase;color:#9d9a8f;
}
.cap-status i{width:9px;height:9px;background:var(--marker);display:block}
.cap-status em{font-style:normal;color:#d8d5cb}
`,
    ),
    markup: `<div class="caption"><span class="cap-title">Audio<b>Deck</b></span><span class="cap-status"><i aria-hidden="true"></i>Auto on <em>Arctis Nova Pro</em></span><div class="wc">${GLYPHS}\n    </div></div>`,
  },
];

for (const v of VARIANTS) {
  let out = base;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>AudioDeck - ${v.slug}</title>`);
  out = out.replace("</style>", `${v.css}</style>`);
  // The caption sits above the untouched app bar, inside the same shell.
  out = out.replace(/(<div class="shell">\s*)/, `$1\n    ${v.markup}\n    `);
  writeFileSync(path.join(dir, `${v.slug}.html`), out, "utf8");
}

console.log("wrote:", VARIANTS.map((v) => v.slug).join(", "));
