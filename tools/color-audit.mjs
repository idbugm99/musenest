import fs from "node:fs";
import path from "node:path";

const ROOTS = ["themes"]; // add more roots if needed
const EXTS = new Set([".css",".scss",".sass",".less",".html",".hbs",".jsx",".tsx",".js",".ts"]);
const RE = {
  hex: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
  rgb: /rgba?\([^)]*\)/g,
  hsl: /hsla?\([^)]*\)/g,
  cssVar: /var\(--[a-z0-9\-]+\)/gi,
  tw: /\b(?:bg|text|border|from|via|to|ring|outline)-([a-z]+)-(\d{2,3})\b/g,
  grad: /linear-gradient\([^)]*\)/g
};

const HINTS = [
  "btn","button","link","nav","header","footer","card","badge","chip","alert",
  "table","tag","hero","pill","banner","toast","tooltip","modal","input","select"
];

const results = [];

function scanFile(fp){
  const rel = fp;
  const theme = rel.split(path.sep)[1] || "unknown";
  const txt = fs.readFileSync(fp, "utf8");
  const lines = txt.split(/\r?\n/);
  const add = (m, line, type, extra={}) => {
    results.push({
      theme,
      file: rel,
      line,
      type,
      raw: m,
      usage: guessUsage(lines[line-1]),
      ...extra
    });
  };
  const run = (regex, type) => {
    lines.forEach((lineStr, idx) => {
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(lineStr)) !== null) add(m[0], idx+1, type);
    });
  };
  run(RE.hex, "hex");
  run(RE.rgb, "rgb");
  run(RE.hsl, "hsl");
  run(RE.cssVar, "cssVar");
  run(RE.grad, "gradient");
  lines.forEach((lineStr, idx) => {
    let m;
    RE.tw.lastIndex = 0;
    while ((m = RE.tw.exec(lineStr)) !== null) {
      add(m[0], idx+1, "tailwind", { twColor: `${m[1]}-${m[2]}` });
    }
  });
}

function guessUsage(line){
  const lo = line.toLowerCase();
  for (const h of HINTS) if (lo.includes(h)) return h;
  if (/\bhover\b/.test(lo)) return "hover";
  if (/\bfocus\b/.test(lo)) return "focus";
  return "unknown";
}

function walk(dir){
  for (const ent of fs.readdirSync(dir, { withFileTypes:true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(fp);
    else if (EXTS.has(path.extname(ent.name))) scanFile(fp);
  }
}

for (const r of ROOTS) if (fs.existsSync(r)) walk(r);

fs.mkdirSync("reports", { recursive:true });
fs.writeFileSync("reports/color-inventory.json", JSON.stringify(results, null, 2));
console.log(`Wrote reports/color-inventory.json with ${results.length} entries`);