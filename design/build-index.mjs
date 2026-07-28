// Rebuild the gallery index from a declared list, so adding rounds stays cheap.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const dir = "C:/Users/Admin/Documents/Claude/Github/AudioDeck/design/mockups";

const ENTRIES = [
  ["wc-merged.html", "One strip (no extra row)", "claude", "window", "Window controls at the far right of the tab bar, split by an amber rule. Costs no vertical space."],
  ["wc-slimtop.html", "Slim caption above", "claude", "window", "A 34px caption strip over the tabs: small wordmark left, controls right, hairline amber between."],
  ["wc-statusbar.html", "Caption with live status", "claude", "window", "The strip earns its height: AUTO ON plus the current output device beside the controls."],
  ["wc-bigkeys.html", "Oversized keys", "claude", "window", "Blunt 56px square keys flush to the window edge, with a knurled grip marking the drag zone."],
  ["wc-plate.html", "Engraved nameplate", "claude", "window", "Centred riveted plate with the wordmark; controls sunk into a machined pocket at the right."],
  ["wc-leftlights.html", "Left cluster", "claude", "window", "Controls move to the left as three punk squares, colour coded on hover only."],
  ["wc-stencil.html", "Stencil controls", "claude", "window", "Stencil-cut glyphs with bridges and overspray; hover fills solid, close fills red."],
  ["wc-ticket.html", "Perforated caption", "claude", "window", "Ticket edge with a dashed tear line and the controls boxed in their own stub."],
  ["wc-tape.html", "Label tape caption", "claude", "window", "Embossed tape with the name punched in; controls as punched cells in the same language."],
  ["wc-marquee.html", "Marquee caption", "claude", "window", "Bulb-edged strip with the controls in their own small bulb-framed plate."],

  ["tb-faceplate.html", "Hardware faceplate", "claude", "titlebar", "Rack panel: corner screws, engraved brand plate, amber status LED, machined tab buttons."],
  ["tb-vu.html", "Live VU strip", "claude", "titlebar", "Segmented L/R meters animate in the spare space with a scale and a peak readout."],
  ["tb-masthead.html", "Newspaper masthead", "claude", "titlebar", "Broadsheet nameplate with edition dateline and double rules; tabs ride the lower rule."],
  ["tb-barcode.html", "Product barcode", "claude", "titlebar", "Printed label with barcode and serial, boxed model code, stamped label-plate tabs."],
  ["tb-marquee.html", "Cinema marquee", "claude", "titlebar", "Bulb-ringed marquee frame with a slow chase; tabs are smaller marquee plates."],
  ["tb-twotier.html", "Two tier bar", "claude", "titlebar", "Brand and status on top, tab strip in its own band below, split by an amber rule."],
  ["tb-ticket.html", "Ticket stub", "claude", "titlebar", "Perforated bottom edge, dashed tear lines between sections, rotated AUDIO ONE stub."],
  ["tb-stencil.html", "Spray stencil", "claude", "titlebar", "Stencil-cut wordmark with letter bridges and overspray; crate-label tabs."],
  ["tb-slap.html", "Sticker slap", "claude", "titlebar", "Brand and tabs are individually rotated stickers with keylines and peeled corners."],
  ["tb-console.html", "Console strip", "claude", "titlebar", "Channel-strip controls: level bar, switch graphic and interval readout with micro labels."],

  ["tw-slanted.html", "Slanted sticker rows", "claude", "shape", "Rows and nav plates skew alternately so the stack reads as slapped-on stickers; type is counter-skewed to stay square."],
  ["tw-hardshadow.html", "Hard offset shadows", "claude", "shape", "Flat unblurred shadow blocks under the row stack, section plates and add button; the in-use row casts amber."],
  ["tw-notched.html", "Notched corners", "claude", "shape", "Every box has chamfered corners, so shapes read as cut card rather than plain rectangles."],
  ["tw-outline.html", "Detached rows", "claude", "shape", "The continuous stack breaks into separate fully outlined boxes with gaps between them."],
  ["tw-bigrank.html", "Oversized rank numerals", "claude", "shape", "Rank digits scale up until they optically bleed past the slab edges, becoming the loudest element."],
  ["tw-tagbadge.html", "Angled tag badges", "claude", "detail", "State badges become small rotated price tags with a notched edge; counters match."],

  ["tw-tallbar.html", "Tall title bar", "claude", "nav", "Bar height roughly doubles, logomark and wordmark scale up, tabs sit on the baseline, amber build tag added."],
  ["tw-invbar.html", "Inverted title bar", "claude", "nav", "Light plate with dark lettering, amber active tab, amber rule kept. Body untouched."],
  ["tw-compact.html", "Compact density", "claude", "density", "Everything tightened about a fifth: rows, rank slab, nav, type scale. Denser pro-tool feel."],
  ["tw-addbutton.html", "Add affordance restyle", "claude", "detail", "The add control becomes a compact left-aligned amber plate with a boxed plus, instead of a full-width bar."],

  ["tw-settings-cards.html", "Settings as cards", "claude", "settings", "Settings page only: each setting becomes a bordered card in a two-column grid."],
  ["tw-settings-table.html", "Settings as a table", "claude", "settings", "Settings page only: dense two-column table with hairline rules and right-aligned controls."],
  ["tw-settings-nav.html", "Settings with side nav", "claude", "settings", "Settings page only: narrow left sub-nav switching between Automation, Startup, Names and About."],

  ["cx-stacked-brand.html", "Stacked brand bar", "codex", "nav", "Logomark and wordmark stack at the left of a taller bar; the tab strip starts further right."],
  ["cx-icon-tabs.html", "Icons in the nav", "codex", "nav", "Each nav label gains a small flat geometric glyph in the same language as the device icons."],
  ["cx-ticket-rows.html", "Ticket edge rows", "codex", "shape", "A perforated line of notches separates the rank slab from the row body, like a torn ticket stub."],
  ["cx-rule-heavy.html", "Heavier rules", "codex", "shape", "Double rules under section headers, thicker shell border and dividers. Same layout, more weight."],
  ["cx-soft-edges.html", "Softened edges", "codex", "shape", "The gentler variant: small corner radius, lighter rules, punk type and amber accent kept."],
  ["cx-devices-rich.html", "Richer devices page", "codex", "content", "Devices page only: ten plus endpoints grouped into Playback and Recording, several disabled or remembered."],
];

const rows = ENTRIES.filter(([f]) => existsSync(path.join(dir, f)));
const missing = ENTRIES.filter(([f]) => !existsSync(path.join(dir, f))).map(([f]) => f);

const js = rows
  .map(([file, name, by, kind, desc]) =>
    `  { file: ${JSON.stringify(file)}, name: ${JSON.stringify(name)}, by: ${JSON.stringify(by)}, kind: ${JSON.stringify(kind)},\n    desc: ${JSON.stringify(desc)} },`,
  )
  .join("\n");

const indexPath = path.join(dir, "index.html");
const src = readFileSync(indexPath, "utf8");
const out = src.replace(/const MOCKUPS = \[[\s\S]*?\n\];/, `const MOCKUPS = [\n${js}\n];`);
writeFileSync(indexPath, out, "utf8");

console.log(`index rebuilt with ${rows.length} entries`);
if (missing.length) console.log("missing (skipped):", missing.join(", "));
