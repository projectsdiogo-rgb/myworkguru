// Gerador de QR codes (modo byte, correção M, versões 1–10). Sem dependências.
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function rsEc(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); g.forEach((c, j) => { ng[j] ^= c; ng[j + 1] ^= gmul(c, EXP[i]); }); g = ng; }
  const r = data.concat(new Array(n).fill(0));
  for (let i = 0; i < data.length; i++) { const c = r[i]; if (c) for (let j = 1; j < g.length; j++) r[i + j] ^= gmul(g[j], c); }
  return r.slice(data.length);
}
// versão: [ec por bloco, [[nº blocos, dados por bloco], ...], posições de alinhamento]
const SPEC = {
  1: [10, [[1, 16]], []], 2: [16, [[1, 28]], [6, 18]], 3: [26, [[1, 44]], [6, 22]], 4: [18, [[2, 32]], [6, 26]],
  5: [24, [[2, 43]], [6, 30]], 6: [16, [[4, 27]], [6, 34]], 7: [18, [[4, 31]], [6, 22, 38]], 8: [22, [[2, 38], [2, 39]], [6, 24, 42]],
  9: [22, [[3, 36], [2, 37]], [6, 26, 46]], 10: [26, [[4, 43], [1, 44]], [6, 28, 50]]
};
const VERINFO = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3 };
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];
function fmtBits(mask) { const d = (0 << 3) | mask; let v = d << 10; for (let i = 14; i >= 10; i--) if (v & (1 << i)) v ^= 0x537 << (i - 10); return ((d << 10) | v) ^ 0x5412; }
export function qrMatrix(text) {
  const data = Array.from(new TextEncoder().encode(text));
  let v, ecn, blocks, al, cap;
  for (v = 1; v <= 10; v++) { [ecn, blocks, al] = SPEC[v]; cap = blocks.reduce((a, [n, k]) => a + n * k, 0); const cc = v < 10 ? 8 : 16; if (4 + cc + 8 * data.length <= cap * 8) break; }
  if (v > 10) throw new Error("Texto demasiado longo para o QR");
  const ccBits = v < 10 ? 8 : 16;
  let bits = "0100" + data.length.toString(2).padStart(ccBits, "0") + data.map(b => b.toString(2).padStart(8, "0")).join("");
  bits += "0".repeat(Math.min(4, cap * 8 - bits.length)); bits += "0".repeat((8 - (bits.length % 8)) % 8);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8), 2));
  for (let i = 0; cw.length < cap; i++) cw.push(i % 2 ? 0x11 : 0xEC);
  const bl = []; let p = 0; blocks.forEach(([n, k]) => { for (let j = 0; j < n; j++) { bl.push(cw.slice(p, p + k)); p += k; } });
  const ecs = bl.map(b => rsEc(b, ecn)); const out = [];
  const maxK = Math.max(...bl.map(b => b.length));
  for (let i = 0; i < maxK; i++) bl.forEach(b => { if (i < b.length) out.push(b[i]); });
  for (let i = 0; i < ecn; i++) ecs.forEach(e => out.push(e[i]));
  const size = 17 + 4 * v, M = Array.from({ length: size }, () => new Array(size).fill(null));
  const set = (r, c, val) => { M[r][c] = val; };
  const finder = (r0, c0) => { for (let r = -1; r < 8; r++) for (let c = -1; c < 8; c++) { const rr = r0 + r, cc = c0 + c; if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue; const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4); set(rr, cc, on ? 1 : 0); } };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 ? 0 : 1); set(i, 6, i % 2 ? 0 : 1); }
  al.forEach(r => al.forEach(c => { if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) return; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0); }));
  set(4 * v + 9, 8, 1);
  for (let i = 0; i < 9; i++) { if (M[8][i] === null) M[8][i] = 0; if (M[i][8] === null) M[i][8] = 0; }
  for (let i = 0; i < 8; i++) { if (M[8][size - 1 - i] === null) M[8][size - 1 - i] = 0; if (M[size - 1 - i][8] === null) M[size - 1 - i][8] = 0; }
  if (VERINFO[v]) { const vi = VERINFO[v]; for (let i = 0; i < 18; i++) { const b = (vi >> i) & 1, a = Math.floor(i / 3), c = size - 11 + (i % 3); set(a, c, b); set(c, a, b); } }
  const bitstr = out.map(b => b.toString(2).padStart(8, "0")).join("");
  const pos = []; let up = true;
  for (let c = size - 1; c > 0; c -= 2) { if (c === 6) c--; for (let k = 0; k < size; k++) { const r = up ? size - 1 - k : k; for (const cc of [c, c - 1]) if (M[r][cc] === null) pos.push([r, cc]); } up = !up; }
  const c1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const c2 = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]];
  const build = (mi) => {
    const G = M.map(row => row.slice());
    pos.forEach(([r, c], k) => { let b = k < bitstr.length ? +bitstr[k] : 0; if (MASKS[mi](r, c)) b ^= 1; G[r][c] = b; });
    const f = fmtBits(mi);
    for (let i = 0; i < 15; i++) { const b = (f >> (14 - i)) & 1; G[c1[i][0]][c1[i][1]] = b; G[c2[i][0]][c2[i][1]] = b; }
    G[4 * v + 9][8] = 1; return G;
  };
  const penalty = (G) => {
    const n = G.length; let p = 0;
    const lines = G.concat(G[0].map((_, c) => G.map(r => r[c])));
    for (const L of lines) {
      let run = 1;
      for (let i = 1; i < n; i++) { if (L[i] === L[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } }
      if (run >= 5) p += run - 2;
      const s = L.join(""); p += 40 * ((s.match(/10111010000/g) || []).length + (s.match(/00001011101/g) || []).length);
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (G[r][c] === G[r + 1][c] && G[r][c] === G[r][c + 1] && G[r][c] === G[r + 1][c + 1]) p += 3;
    const dark = G.reduce((a, r) => a + r.reduce((x, y) => x + y, 0), 0); p += 10 * Math.floor(Math.abs(Math.floor(dark * 100 / (n * n)) - 50) / 5);
    return p;
  };
  let best = 0, bp = Infinity; for (let m = 0; m < 8; m++) { const pp = penalty(build(m)); if (pp < bp) { bp = pp; best = m; } }
  return build(best);
}
export function qrSvg(text, opts = {}) {
  const G = qrMatrix(text), n = G.length, b = opts.border ?? 4, s = n + 2 * b;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (G[r][c]) d += `M${c + b} ${r + b}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"${opts.size ? ` width="${opts.size}" height="${opts.size}"` : ""} role="img" aria-label="QR code"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
