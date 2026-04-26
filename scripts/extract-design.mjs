// Extract the template HTML and the README (if present) from the Claude design bundle.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const SRC = process.argv[2];
const OUT_DIR = process.argv[3] || "./design-extracted";
if (!SRC) {
  console.error("usage: node extract-design.mjs <bundle.html> [outDir]");
  process.exit(1);
}

const html = fs.readFileSync(SRC, "utf8");

function extractScript(type) {
  const re = new RegExp(
    `<script type="${type.replace(/[/]/g, "\\/")}">([\\s\\S]*?)<\\/script>`,
    "m"
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

const manifestRaw = extractScript("__bundler/manifest");
const templateRaw = extractScript("__bundler/template");
const extRaw = extractScript("__bundler/ext_resources");

if (!manifestRaw || !templateRaw) {
  console.error("missing manifest/template");
  process.exit(2);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(manifestRaw);
const template = JSON.parse(templateRaw); // string of HTML containing UUID refs
const ext = extRaw ? JSON.parse(extRaw) : null;

const uuids = Object.keys(manifest);
console.log(`assets: ${uuids.length}`);

const summary = [];
for (const uuid of uuids) {
  const e = manifest[uuid];
  let bytes = Buffer.from(e.data, "base64");
  if (e.compressed) {
    try { bytes = zlib.gunzipSync(bytes); } catch (err) {
      console.warn(`gunzip failed for ${uuid}:`, err.message);
    }
  }
  const ext = (e.ext || "").replace(/^\./, "") ||
    (e.mime || "").split("/").pop() || "bin";
  const fname = `${uuid}.${ext}`;
  fs.writeFileSync(path.join(OUT_DIR, fname), bytes);
  summary.push({ uuid, name: e.name || "", mime: e.mime || "", size: bytes.length, file: fname });
}

fs.writeFileSync(
  path.join(OUT_DIR, "_manifest.json"),
  JSON.stringify(summary, null, 2)
);
fs.writeFileSync(path.join(OUT_DIR, "_template.html"), template);
if (ext) fs.writeFileSync(path.join(OUT_DIR, "_ext_resources.json"), JSON.stringify(ext, null, 2));

console.log("written to", OUT_DIR);
