// SOVARA "Case Gate Bench": an interactive isometric figure.
// One evidence cartridge rides a rail through six inspection gates (each sets a pin on the
// cartridge), a policy reader sorts it into PASS / HOLD / BLOCK, and only a PASS can be
// approved by a named reviewer's key, which stamps it into the approved-memory cradle.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL = process.env.ANATOMY_SKILL || join(process.env.HOME || "/root", ".claude/skills/anatomy");
const k = await import(pathToFileURL(join(SKILL, "kit/iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(SKILL, "scripts/inline-kit.mjs")).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 780;
const HEIGHT = 470;

// ---- world ---------------------------------------------------------------------------
const PLATE = { x: -208, y: -64, w: 416, d: 128, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const TOP = 3; // rail / pad top: a cartridge sits at z = TOP
const CART = { x: -10, y: -11, w: 20, d: 22, r: 2 };
const CART_H = 7;
const PIN_Y = 6.4;
const PIN_OFF = [0, 1, 2, 3, 4, 5].map((i) => -8.5 + 3.4 * i);
const GATES = ["Rights", "Integrity", "Freshness", "Conflict", "Quarantine", "Replay"];
const GATE_X = [0, 1, 2, 3, 4, 5].map((i) => -126 + 24 * i);
const STOPS = GATE_X.map((x, i) => x - PIN_OFF[i]);
const START = [-164, 0, TOP];
const POLICY_X = 40;
const PRESS_X = 118;
const CRADLE_X = 176;
const BAYS = { HOLD: { c: [74, 46], cap: 3 }, BLOCK: { c: [74, -46], cap: 3 }, PASS: { c: [CRADLE_X, 0], cap: 4 } };
const STACK = CART_H; // one cartridge thick

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [CRADLE_X, 22, 48], [CRADLE_X, -22, 48], [PRESS_X, 20, 50], [PRESS_X, -20, 50], [-190, 0, 24]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 40 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const keyOf = (x, y, z = 0) => k.depthOf([x, y, 0], P) + z * 0.01;

// every drawn thing is an item with a painter's key; the page keeps them sorted
const items = [];
const add = (key, markup, id) => items.push({ key, markup, id });
const group = (id, key, inner) => `<g data-key="${key.toFixed(3)}"${id ? ` data-id="${id}"` : ""}>${inner}</g>`;

// ---- ground: plate, rails, pads ---------------------------------------------------------
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = [...k.corners(PLATE, 24), ...[[-90, -64 + 24], [90, -64 + 24], [-90, 64 - 24], [90, 64 - 24]]];
  const sorted = [...feet].sort((a, b) => keyOf(a[0], a[1]) - keyOf(b[0], b[1]));
  for (const [x, y] of sorted) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H / 2, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near edge, ending before the HOLD bay
  const strip = { x: -192, y: 49, w: 236, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }));
  // far-edge strip with the same ticks, ending before the BLOCK bay
  const strip2 = { x: -192, y: -56, w: 236, d: 7, r: 1 };
  out.push(S(k.slabOf(strip2, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t2 = k.topTicks(strip2.x + 4, strip2.x + strip2.w - 4, 8, 5, strip2.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(t2.minor, { tone: "lo" }), L(t2.major, { tone: "mid" }));
  out.push(D([at([strip2.x + 2, strip2.y + 3.5, 0.6]), at([strip2.x + strip2.w - 2, strip2.y + 3.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

function track() {
  const out = [];
  // sleepers
  for (let x = -160; x <= 148; x += 12) {
    out.push(S(k.slabOf({ x: x - 2.5, y: -14, w: 5, d: 28, r: 0.8 }, 0, 1.2, P, 2), { tone: "lo", crease: "none" }));
  }
  for (const y of [-11, 6]) {
    out.push(S(k.slabOf({ x: -170, y, w: 324, d: 5, r: 1 }, 0, TOP, P, 3, 0.4), { tone: "mid" }));
    out.push(D([-162, -80, 0, 80, 146].map((x) => at([x, y + 2.5, TOP])), { size: 0.4 }));
  }
  // end stops
  out.push(S(k.slabOf({ x: -176, y: -13, w: 5, d: 26, r: 1.2 }, 0, 7, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([-173.5, -8, 7]), at([-173.5, 8, 7])], { size: 0.45 }));
  // sidings that lead to the HOLD and BLOCK bays (grooves in the plate)
  for (const sgn of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const e = t * t * (3 - 2 * t);
      pts.push([56 + 18 * t, sgn * (3 + 43 * e)]);
    }
    out.push(L(k.onTop(pts.map(([x, y]) => [x, y + sgn * 8]), 0, P), { tone: "faint" }));
    out.push(L(k.onTop(pts.map(([x, y]) => [x, y - sgn * 8]), 0, P), { tone: "faint" }));
  }
  return out.join("");
}

function pad(plan, h = TOP) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, 0, h, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(plan, 0, h, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 3), h, P, 5), { tone: "faint" }));
  const sc = k.corners(plan, 3);
  out.push(D(sc.map(([x, y]) => at([x, y, h])), { size: 0.4 }));
  return out.join("");
}

add(-1e6, group(null, -1e6, plate()));
add(-9e5, group(null, -9e5, track()));
const INTAKE = { x: -206, y: -17, w: 40, d: 34, r: 3 };
const HOLD_PAD = { x: 56, y: 30, w: 36, d: 32, r: 3 };
const BLOCK_PAD = { x: 56, y: -62, w: 36, d: 32, r: 3 };
const CRADLE_PAD = { x: 158, y: -22, w: 36, d: 44, r: 3 };
[INTAKE, HOLD_PAD, BLOCK_PAD, CRADLE_PAD].forEach((plan, i) => add(-8e5 + i, group(null, -8e5 + i, pad(plan))));

// ---- cartridge (drawn at the origin, bottom at z = 0) -----------------------------------
function cartridge(withMark = true) {
  const out = [];
  out.push(S(k.slabOf(CART, 0, CART_H, P, 4, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam(CART, 2.6, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CART, 2.2), CART_H, P, 4), { tone: "faint" }));
  const sc = k.corners(CART, 3.4);
  out.push(D(sc.map(([x, y]) => at([x, y, CART_H])), { size: 0.4, tone: "lo" }));
  // printed label (rules stand for text)
  out.push(L(k.lineOnTop([-7, -8.2], [7, -8.2], CART_H, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([-7, -6], [1, -6], CART_H, P), { tone: "lo", free: true }));
  // pin sockets
  out.push(L(PIN_OFF.map((x) => k.ring(x, PIN_Y, 1.9, CART_H, P, 12)).join(""), { tone: "lo" }));
  out.push(L(k.lineOnTop([-9.6, PIN_Y - 3.2], [9.6, PIN_Y - 3.2], CART_H, P), { tone: "faint" }));
  // approval mark (hidden until the press stamps it)
  const mark = L(k.ring(4.2, -1.2, 3.3, CART_H, P, 20), { tone: "lit" }) + L(k.onTop([[2.4, -1.2], [3.8, 0.4], [6.4, -3.2]], CART_H, P), { tone: "lit" });
  out.push(`<g data-part="mark" style="opacity:0">${withMark ? mark : ""}</g>`);
  // pins (rebuilt by the page as they rise)
  out.push(`<g data-part="pins">${pinsSvg([0, 0, 0, 0, 0, 0])}</g>`);
  return out.join("");
}
function pinsSvg(lifts) {
  return PIN_OFF.map((x, i) => {
    const up = lifts[i];
    return S(k.cylinder(x, PIN_Y, 1.25, CART_H, 1.6 + 4.2 * up, P, 14), { tone: up > 0.5 ? "hi" : "mid", lit: up > 0.5 });
  }).join("");
}

// ---- portals: a back half and a front half so the cartridge can pass between ------------
function portal({ x, yp = 18, post = 25, base = 0, lintelZ = 19, lintelH = 4, plinth = 10, id, lamps = "", under = "", r = 2.2 }) {
  const back = [];
  const front = [];
  const mk = (sgn, into) => {
    const y = sgn * yp;
    into.push(S(k.slabOf({ x: x - plinth / 2, y: y - plinth / 2, w: plinth, d: plinth, r: 1.5 }, base, 3, P, 3, 0.4), { tone: "mid" }));
    into.push(D(k.corners({ x: x - plinth / 2, y: y - plinth / 2, w: plinth, d: plinth }, 1.6).map(([cx, cy]) => at([cx, cy, base + 3])), { size: 0.35 }));
    into.push(S(k.cylinder(x, y, r, base + 3, post - base - 3, P, 24), { tone: "mid", crease: "none" }));
    into.push(L([base + 3 + (post - base - 3) * 0.35, base + 3 + (post - base - 3) * 0.7].map((z) => k.sideArc(x, y, r, z, P, 12)).join(""), { tone: "faint" }));
    into.push(S(k.cylinder(x, y, r + 1.1, post, 2, P, 24), { tone: "mid" }));
  };
  mk(-1, back);
  mk(1, front);
  const span = yp - r - 0.2;
  front.push(S(k.slabOf({ x: x - 2.4, y: -span, w: 4.8, d: span * 2, r: 1 }, lintelZ, lintelH, P, 3, 0.4), { tone: "mid" }));
  front.push(L(k.lineOnTop([x - 0.2, -span + 3], [x - 0.2, span - 3], lintelZ + lintelH, P), { tone: "faint" }));
  front.push(D([at([x, -span + 1.6, lintelZ + lintelH]), at([x, span - 1.6, lintelZ + lintelH])], { size: 0.4 }));
  front.push(under, lamps);
  add(keyOf(x, -yp), group(id && id + "-b", keyOf(x, -yp), back.join("")));
  add(keyOf(x, yp), group(id && id + "-f", keyOf(x, yp), front.join("")));
}

// six gates: a feeler hangs over the pin it checks, a lamp on the lintel reports
GATE_X.forEach((x, i) => {
  const lampZ = 23;
  const lamp =
    S(k.cylinder(x, 0, 2.8, lampZ, 2, P, 20), { tone: "lo" }) +
    L(k.ring(x, 0, 1.5, lampZ + 2, P, 14), { tone: "faint" }) +
    `<g data-lamp="${i}"><g class="ok" style="opacity:0">${D([at([x, 0, lampZ + 2])], { size: 1.15, tone: "lit" })}</g><g class="no" style="opacity:0">${L(k.lineOnTop([x - 1.3, -1.3], [x + 1.3, 1.3], lampZ + 2, P) + k.lineOnTop([x - 1.3, 1.3], [x + 1.3, -1.3], lampZ + 2, P), { tone: "mid" })}</g></g>`;
  const feeler = S(k.cylinder(x, PIN_Y, 1.5, 16.6, 2.4, P, 14), { tone: "mid" }) + L(k.ring(x, PIN_Y, 1.5, 16.6, P, 12), { tone: "faint" });
  portal({ x, id: "gate" + i, lamps: lamp, under: feeler });
});

// policy reader: three lamps, PASS / HOLD / BLOCK
{
  const lampZ = 33;
  const icon = {
    PASS: (y) => k.ring(POLICY_X, y, 1.7, lampZ + 2, P, 14),
    HOLD: (y) => k.lineOnTop([POLICY_X - 1.3, y - 0.9], [POLICY_X + 1.3, y - 0.9], lampZ + 2, P) + k.lineOnTop([POLICY_X - 1.3, y + 0.9], [POLICY_X + 1.3, y + 0.9], lampZ + 2, P),
    BLOCK: (y) => k.lineOnTop([POLICY_X - 1.4, y - 1.4], [POLICY_X + 1.4, y + 1.4], lampZ + 2, P) + k.lineOnTop([POLICY_X - 1.4, y + 1.4], [POLICY_X + 1.4, y - 1.4], lampZ + 2, P),
  };
  const ys = { BLOCK: -9, HOLD: 0, PASS: 9 };
  let lamps = "";
  for (const name of ["BLOCK", "HOLD", "PASS"]) {
    const y = ys[name];
    lamps += S(k.cylinder(POLICY_X, y, 3.2, lampZ, 2, P, 20), { tone: "lo" });
    lamps += L(icon[name](y), { tone: "faint" });
    lamps += `<g data-policy="${name}" style="opacity:0">${L(icon[name](y), { tone: "lit" })}</g>`;
  }
  const hangers = [-8, 8].map((o) => S(k.cylinder(POLICY_X + o, PIN_Y, 1.1, 22.4, 28 - 22.4, P, 12), { tone: "mid", crease: "none" })).join("");
  const head = hangers +
    S(k.slabOf({ x: POLICY_X - 11, y: 0.4, w: 22, d: 12, r: 1.5 }, 18.4, 4, P, 3, 0.4), { tone: "mid" }) +
    L(k.onTop(PIN_OFF.map((o) => [POLICY_X + o, PIN_Y]), 22.4, P), { tone: "faint" }) +
    D(PIN_OFF.map((o) => at([POLICY_X + o, PIN_Y, 22.4])), { size: 0.4, tone: "lo" });
  portal({ x: POLICY_X, yp: 20, post: 36, lintelZ: 28, lintelH: 4, plinth: 11, id: "policy", lamps, under: head, r: 2.6 });
}

// approval press (frame only; head and rod are drawn by the page)
const PRESS_LINTEL = 40;
portal({ x: PRESS_X, yp: 21, post: 46, lintelZ: PRESS_LINTEL, lintelH: 5, plinth: 11, id: "press", r: 2.6 });

// the approved-memory cradle
portal({ x: CRADLE_X, yp: 18, post: 44, lintelZ: 40, lintelH: 4, plinth: 10, id: "cradle", base: TOP, r: 2.2,
  lamps: PIN_OFF.length ? "" : "" });

// ---- bays: corner stops ----------------------------------------------------------------
function stops(c, h, id) {
  const [cx, cy] = c;
  for (const [dx, dy] of [[-13.5, -14.2], [13.5, -14.2], [-13.5, 14.2], [13.5, 14.2]]) {
    const x = cx + dx;
    const y = cy + dy;
    const key = keyOf(x, y);
    add(key, group(null, key, S(k.cylinder(x, y, 1.6, TOP, h, P, 14), { tone: "mid" }) + L(k.ring(x, y, 1.6, TOP + h, P, 12), { tone: "faint" })));
  }
}
stops(BAYS.HOLD.c, 5);
stops(BAYS.BLOCK.c, 9);
// a padlock on the BLOCK bay's back stop: BLOCK cannot be overridden
{
  const [cx, cy] = BAYS.BLOCK.c;
  const y = cy - 14.2;
  const body = S(k.slabOf({ x: cx - 4, y: y - 2.2, w: 8, d: 4.4, r: 1 }, 9 + TOP, 5, P, 3, 0.3), { tone: "hi" });
  const shackle = L(k.sideArc(cx, y, 2.6, 17, P, 14), { tone: "mid" });
  const key = keyOf(cx, y, 9);
  add(key, group(null, key, body + shackle + D([at([cx, y + 2.3, 11.5 + TOP])], { size: 0.4, tone: "lo" })));
}

// ---- approval key ------------------------------------------------------------------------
const KEY = { c: [122, 41], z: 10 };
{
  const ped = { x: 112, y: 32, w: 20, d: 18, r: 2 };
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(ped, 0, 6, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.slabOf(ped, 0, 6, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(ped, 2.4).map(([x, y]) => at([x, y, 6])), { size: 0.4 }));
  out.push(S(k.cylinder(KEY.c[0], KEY.c[1], 5.6, 6, 4, P, 32), { tone: "hi" }));
  out.push(L(k.knurl(KEY.c[0], KEY.c[1], 5.6, 6, 10, 28, P), { tone: "lo" }));
  out.push(L(k.ring(KEY.c[0], KEY.c[1], 3.8, 10, P, 28), { tone: "lo" }));
  const ticks = k.radialTicks(KEY.c[0], KEY.c[1], 4.6, 2, 1, 10, [0.9, 1.6], P, 0, Math.PI / 2);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([KEY.c[0], ped.y + ped.d - 2.4], 6, P, "x"), "REVIEWER", { size: 2, tone: "lo", anchor: "middle" }));
  const key = keyOf(118, 41);
  add(key, group("keybase", key, out.join("")));
  add(key + 0.05, group("key", key + 0.05, ""));
}
const keyAt = (turn) => {
  const a = turn * (Math.PI / 2);
  const [cx, cy] = KEY.c;
  const tipx = cx + Math.sin(a) * 7;
  const tipy = cy - Math.cos(a) * 7;
  return S(k.cylinder(cx, cy, 1.3, KEY.z, 1, P, 12), { tone: "mid" }) +
    L(k.lineOnTop([cx, cy], [tipx, tipy], KEY.z + 1.1, P), { tone: "lit" }) +
    L(k.ring(tipx, tipy, 1.5, KEY.z + 1.1, P, 12), { tone: "lit" });
};

// ---- press head ----------------------------------------------------------------------------
const HEAD = { x: PRESS_X - 7, y: -7, w: 14, d: 14, r: 1.5 };
const HEAD_REST = 31;
const HEAD_DOWN = TOP + CART_H + 0.4;
const pressAt = (z) => {
  const rodTo = PRESS_LINTEL;
  const rodFrom = z + 4;
  return S(k.cylinder(PRESS_X, 0, 2.4, rodFrom, Math.max(0.1, rodTo - rodFrom), P, 20), { tone: "mid", crease: "none" }) +
    S(k.slabOf({ ...HEAD }, z, 4, P, 3, 0.4), { tone: "hi" }) +
    L(k.sideSeam({ ...HEAD }, z + 2, P, 3), { tone: "faint" }) +
    L(k.ring(PRESS_X, 0, 3.4, z + 4, P, 20), { tone: "lo" });
};
{
  const key = keyOf(PRESS_X, 0, 40);
  add(key, group("press", key, ""));
}

// ---- intake pile (evidence waiting to be checked) -----------------------------------------
[[-190, 0.6, 0], [-189, -0.8, 1], [-190.5, 0.3, 2]].forEach(([x, dy, n]) => {
  const z = TOP + n * CART_H;
  const key = keyOf(x, dy, z);
  add(key, group(null, key, `<g transform="${k.translateAlong(P, [x, dy, z])}">${cartridge(false)}</g>`));
});

// ---- sort ---------------------------------------------------------------------------------
items.sort((a, b) => a.key - b.key);
const stageBody = items.map((i) => i.markup);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A case gate bench. An evidence cartridge rides a rail through six inspection gates (Rights, Integrity, Freshness, Conflict, Quarantine, Replay); each gate sets one pin on the cartridge when its check holds. A policy reader then lights PASS, HOLD or BLOCK from the pins. A HOLD cartridge goes to the hold bay and a BLOCK cartridge to a padlocked bay. Only a PASS can be approved: a named reviewer turns the key, the press stamps the cartridge, and it is stacked in the approved-memory cradle.",
  body: [`<style>[data-lamp] g,[data-policy],[data-part="mark"]{transition:opacity .28s ease}[data-id="key"]{cursor:pointer}</style>`, ...stageBody],
});

const live = `
const P = ${JSON.stringify(P)};
const GATES = ${JSON.stringify(GATES)};
const STOPS = ${JSON.stringify(STOPS)};
const PIN_Y = ${PIN_Y}, CART_H = ${CART_H}, TOP = ${TOP};
const START = ${JSON.stringify(START)};
const POLICY_X = ${POLICY_X}, PRESS_X = ${PRESS_X};
const BAYS = ${JSON.stringify(BAYS)};
const HEAD_REST = ${HEAD_REST}, HEAD_DOWN = ${HEAD_DOWN};
const PIN_OFF = ${JSON.stringify(PIN_OFF)};
const CART_MARKUP = ${JSON.stringify(cartridge(true))};
const pinsSvg = ${pinsSvg.toString()};
const pressAt = ${pressAt.toString()};
const keyAt = ${keyAt.toString()};
const PRESS_LINTEL = ${PRESS_LINTEL}, KEY_C = ${JSON.stringify(KEY.c)}, KEY_Z = ${KEY.z};
const HEAD = ${JSON.stringify(HEAD)};
const k = { cylinder, slabOf, sideSeam, ring, lineOnTop, onTop };
const S = solidSvg, L = lineSvg;
const KEY = { c: KEY_C, z: KEY_Z };
const KINDS = [
  { name: "complete record", fail: -1, result: "PASS" },
  { name: "stale record", fail: 2, result: "HOLD" },
  { name: "record without permitted use", fail: 0, result: "BLOCK" },
];
const WHY = {
  PASS: "all six checks hold",
  HOLD: "freshness limit exceeded, review needed",
  BLOCK: "no permitted use, cannot be overridden",
};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const keyOf = (x, y, z) => depthOf([x, y, 0], P) + z * 0.01;

// ---- painter's order: items sorted by key, the moving cartridge slotted in ----
const list = [...svg.querySelectorAll("[data-key]")].map((el) => ({ el, key: parseFloat(el.dataset.key) }));
function place(entry) {
  const at = list.indexOf(entry);
  if (at >= 0) list.splice(at, 1);
  let i = list.findIndex((other) => other.key > entry.key);
  if (i < 0) i = list.length;
  const before = list[i] ? list[i].el : null;
  list.splice(i, 0, entry);
  if (entry.el.nextSibling !== before || entry.el.parentNode !== svg) svg.insertBefore(entry.el, before);
}
const NS = "http://www.w3.org/2000/svg";
const mkGroup = (html) => { const g = document.createElementNS(NS, "g"); g.innerHTML = html; return g; };

const cartEl = mkGroup(CART_MARKUP);
const cart = { entry: { el: cartEl, key: 0 }, pins: cartEl.querySelector('[data-part="pins"]'), mark: cartEl.querySelector('[data-part="mark"]') };
cartEl.style.transition = "opacity .3s ease";
svg.appendChild(cartEl);
list.push(cart.entry);
const pressEntry = list.find((e) => e.el.dataset.id === "press");
const keyEntry = list.find((e) => e.el.dataset.id === "key");
const lamp = (i) => svg.querySelector('[data-lamp="' + i + '"]');
const policyLamp = (name) => svg.querySelector('[data-policy="' + name + '"]');
const clones = { PASS: [], HOLD: [], BLOCK: [] };

// ---- model ----
const st = { x: START[0], y: 0, z: TOP, kind: 0, steps: [], at: -1, wait: 0, lift: [0,0,0,0,0,0], liftTo: [0,0,0,0,0,0], lastLift: "", markTo: 0, head: HEAD_REST, headTo: HEAD_REST, turn: 0, turnTo: 0, pressing: 0, text: "", done: true, rest: 0, approve: false };
let nextKind = 0, queued = null, touring = !still.matches, interacted = 0;
let frame = 0, last = 0, visible = false, idleTimer = 0, memory = 0;

function reset(kindIndex) {
  st.kind = kindIndex;
  st.x = START[0]; st.y = 0; st.z = TOP;
  st.lift = [0,0,0,0,0,0]; st.liftTo = [0,0,0,0,0,0];
  st.markTo = 0; cart.mark.style.opacity = 0;
  st.turn = 0; st.turnTo = 0; st.approve = false; st.pressing = 0;
  for (let i = 0; i < 6; i++) { const g = lamp(i); g.querySelector(".ok").style.opacity = 0; g.querySelector(".no").style.opacity = 0; }
  ["PASS","HOLD","BLOCK"].forEach((n) => (policyLamp(n).style.opacity = 0));
  cartEl.style.opacity = 1;
  st.steps = plan(KINDS[kindIndex]);
  st.at = -1; st.done = false; st.wait = 0;
}

function plan(kind) {
  const steps = [];
  GATES.forEach((name, i) => {
    steps.push({ x: STOPS[i], y: 0, z: TOP, hold: 0.62, enter() {
      const ok = i !== kind.fail;
      st.liftTo[i] = ok ? 1 : 0;
      const g = lamp(i);
      g.querySelector(".ok").style.opacity = ok ? 1 : 0;
      g.querySelector(".no").style.opacity = ok ? 0 : 1;
      st.text = "gate " + (i + 1) + "/6 · " + name + (ok ? " holds" : " fails, pin stays down");
    } });
  });
  steps.push({ x: POLICY_X, y: 0, z: TOP, hold: 1.1, enter() {
    policyLamp(kind.result).style.opacity = 1;
    st.text = "policy · " + kind.result + " · " + WHY[kind.result];
  } });
  const bay = BAYS[kind.result];
  const count = clones[kind.result].length;
  const stackZ = TOP + count * CART_H;
  const clear = count > 0 ? stackZ + 2.4 : TOP;
  if (kind.result === "PASS") {
    steps.push({ x: PRESS_X, y: 0, z: TOP, wait: "key", enter() { st.text = "PASS · awaiting the named reviewer · turn the key"; } });
    steps.push({ x: PRESS_X, y: 0, z: TOP, press: true, enter() {} });
    steps.push({ x: bay.c[0] - 26, y: 0, z: clear, hold: 0, enter() { st.text = "approved · to institutional memory"; } });
    steps.push({ x: bay.c[0], y: 0, z: clear, hold: 0, enter() {} });
    steps.push({ x: bay.c[0], y: 0, z: stackZ, hold: 0.9, enter() {}, store: "PASS" });
  } else {
    const sgn = kind.result === "HOLD" ? 1 : -1;
    steps.push({ x: 56, y: 0, z: clear, hold: 0.1, enter() { st.text = kind.result + " · " + (kind.result === "HOLD" ? "paused in the hold bay" : "locked away, kept not deleted"); } });
    steps.push({ x: bay.c[0], y: bay.c[1], z: clear, hold: 0, enter() {} });
    steps.push({ x: bay.c[0], y: bay.c[1], z: stackZ, hold: 0.9, enter() {}, store: kind.result });
  }
  return steps;
}

function store(which) {
  const bay = BAYS[which];
  if (clones[which].length >= bay.cap) {
    clones[which].forEach((entry) => { entry.el.remove(); list.splice(list.indexOf(entry), 1); });
    clones[which] = [];
  }
  const n = clones[which].length;
  const z = TOP + n * CART_H;
  const el = cartEl.cloneNode(true);
  el.setAttribute("transform", translateAlong(P, [bay.c[0], bay.c[1], z]));
  const entry = { el, key: keyOf(bay.c[0], bay.c[1], z) };
  el.dataset.key = entry.key.toFixed(3);
  clones[which].push(entry);
  list.push(entry);
  place(entry);
  if (which === "PASS") memory++;
}

function approve() {
  const step = st.steps[st.at];
  if (step && step.wait === "key" && !st.approve) { st.approve = true; return true; }
  return false;
}

// ---- drawing ----
function draw() {
  cartEl.setAttribute("transform", translateAlong(P, [st.x, st.y, st.z]));
  cart.entry.key = keyOf(st.x, st.y, st.z);
  place(cart.entry);
  const sig = st.lift.map((v) => v.toFixed(2)).join();
  if (sig !== st.lastLift) { cart.pins.innerHTML = pinsSvg(st.lift); st.lastLift = sig; }
  cart.mark.style.opacity = st.markTo;
  pressEntry.el.innerHTML = pressAt(st.head);
  keyEntry.el.innerHTML = keyAt(st.turn);
  const text = st.text + (memory ? "  ·  memory " + memory : "");
  if (readout.textContent !== text) readout.textContent = text;
}

// ---- time ----
const follow = (v, to, dt, tau, calm) => (calm ? to : v + (to - v) * (1 - Math.exp(-dt / tau)));
function advance(dt, calm) {
  // actuators
  for (let i = 0; i < 6; i++) { st.lift[i] = follow(st.lift[i], st.liftTo[i], dt, 0.12, calm); if (Math.abs(st.liftTo[i] - st.lift[i]) < 0.002) st.lift[i] = st.liftTo[i]; }
  st.head = follow(st.head, st.headTo, dt, 0.11, calm); if (Math.abs(st.headTo - st.head) < 0.02) st.head = st.headTo;
  st.turn = follow(st.turn, st.turnTo, dt, 0.12, calm); if (Math.abs(st.turnTo - st.turn) < 0.002) st.turn = st.turnTo;
  if (st.done) return;
  // sequence
  let step = st.steps[st.at];
  const arrived = step && Math.abs(step.x - st.x) < 0.35 && Math.abs(step.y - st.y) < 0.35 && Math.abs(step.z - st.z) < 0.25;
  if (!step || (arrived && step.ready)) {
    if (step && step.hold !== undefined && st.wait > 0) { st.wait -= dt; if (st.wait > 0) return; }
    if (st.at + 1 >= st.steps.length) { st.done = true; st.rest = 0; return; }
    st.at++; step = st.steps[st.at]; step.ready = false; step.fired = false; st.wait = 0;
    if (step.enter && !step.press) step.enter();
  }
  const tau = step.z !== st.z && step.x === st.x ? 0.16 : 0.26;
  st.x = follow(st.x, step.x, dt, tau, calm);
  st.y = follow(st.y, step.y, dt, tau, calm);
  st.z = follow(st.z, step.z, dt, 0.14, calm);
  if (Math.abs(step.x - st.x) < 0.35) st.x = step.x;
  if (Math.abs(step.y - st.y) < 0.35) st.y = step.y;
  if (Math.abs(step.z - st.z) < 0.25) st.z = step.z;
  const here = Math.abs(step.x - st.x) < 0.35 && Math.abs(step.y - st.y) < 0.35 && Math.abs(step.z - st.z) < 0.25;
  if (!here) return;
  if (step.wait === "key") {
    if (st.approve || (touring && (st.wait += dt) > 1.7)) { st.approve = true; step.ready = true; }
    return;
  }
  if (step.press) {
    st.pressing += dt;
    const t = st.pressing;
    if (t < 0.45) { st.turnTo = 1; st.text = "named reviewer approves · key turned"; }
    else if (t < 0.95) { st.headTo = HEAD_DOWN; }
    else if (t < 1.35) { st.markTo = 1; }
    else if (t < 1.8) { st.headTo = HEAD_REST; }
    else { st.turnTo = 0; step.ready = true; }
    return;
  }
  if (!step.fired) {
    step.fired = true; st.wait = step.hold || 0;
    if (step.store) { store(step.store); cartEl.style.opacity = 0; st.text = step.store === "PASS" ? "recorded to institutional memory" : step.store + " · kept in its bay, not deleted"; }
  }
  step.ready = true;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (st.done) {
    st.rest += dt;
    if (queued !== null && st.rest > 0.4) { const q = queued; queued = null; reset(q); }
    else if (touring && st.rest > 1.6) { reset(nextKind); nextKind = (nextKind + 1) % KINDS.length; }
  }
  advance(dt, calm);
  if (calm) for (let n = 0; n < 6; n++) advance(dt, calm);
  draw();
  const busy = !st.done || touring || queued !== null || st.head !== st.headTo || st.turn !== st.turnTo || st.lift.some((v, i) => v !== st.liftTo[i]);
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

// ---- input ----
function pause() { touring = false; clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!still.matches) { touring = true; nextKind = (st.kind + 1) % KINDS.length; run(); } }, 9000); }
function send(index) {
  pause();
  nextKind = (index + 1) % KINDS.length;
  if (st.done) reset(index); else queued = index;
  run();
}
function press() { pause(); const ok = approve(); run(); return ok; }
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("click", (event) => {
  if (press()) return;
  const keyArea = event.target.closest('[data-id="key"],[data-id="keybase"]');
  if (keyArea) return;
  send(st.done ? nextKind : (st.kind + 1) % KINDS.length);
});
stage.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "3") { event.preventDefault(); send(Number(event.key) - 1); return; }
  if (event.key === "Enter" || event.key === " " || event.key === "k" || event.key === "K") { event.preventDefault(); if (!press()) send(nextKind); return; }
  if (event.key === "ArrowRight") { event.preventDefault(); send((st.kind + 1) % KINDS.length); }
  if (event.key === "ArrowLeft") { event.preventDefault(); send((st.kind + KINDS.length - 1) % KINDS.length); }
});
window.__bench = { st, send, press, clones, KINDS };
st.text = "evidence waiting · " + KINDS[0].name;
reset(0); nextKind = 1;
if (still.matches) touring = false;
draw();
if (touring) st.rest = 0.2;
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Case gate bench",
  hint: "Keys 1 2 3 send a case · click or Enter turns the key",
  readout: "evidence waiting · complete record",
  keys: [
    { mark: "lit", label: "Pins and lamps: a gate's check held" },
    { mark: "raised", label: "Evidence cartridge: one traceable case record" },
    { mark: "dim", label: "Six gates, then policy: PASS, HOLD or BLOCK" },
  ],
  caption:
    "One case record travels a governed loop. Each gate sets one pin on the cartridge when its check holds; the policy reader lights PASS, HOLD or BLOCK from the pins; BLOCK cannot be overridden; only a PASS waits for a named reviewer's key, and the approved record joins institutional memory. Illustrative: concept only, no customer outcomes are claimed.",
  body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Case gate bench. Press 1, 2 or 3 to send a complete, stale or unpermitted record through the gates. Press Enter or click to turn the reviewer's key when a record is waiting for approval.">${svg}</div>`,
});

const out = join(HERE, theme === "light" ? "gate-bench-light.html" : "gate-bench.html");
writeFileSync(out, k.pageHtml({ title: "SOVARA case gate bench", theme, body, script: kitScript() + live, width: 880 }));
console.log("wrote", out, "items", items.length);
