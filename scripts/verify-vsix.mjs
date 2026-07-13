import { readdir, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import AdmZip from "adm-zip";

const MAX_COMPRESSED_BYTES = 500 * 1024;
const MAX_FILES_EXCLUSIVE = 100;
const forbiddenPatterns = [
  /^extension\/node_modules\/vsce\//u,
  /^extension\/node_modules\/azure-devops-node-api\//u,
  /^extension\/src\/.*\.ts$/u,
  /^extension\/out\/test\//u,
  /^extension\/plan\//u,
  /\.map$/u
];

const vsixPath = await resolveVsixPath(process.argv[2]);
const archive = new AdmZip(vsixPath);
const files = archive.getEntries().filter(entry => !entry.isDirectory);
const paths = files.map(entry => entry.entryName);
const compressedBytes = (await stat(vsixPath)).size;
const uncompressedBytes = files.reduce((total, entry) => total + entry.header.size, 0);
const forbidden = paths.filter(path => forbiddenPatterns.some(pattern => pattern.test(path)));

const manifestEntry = archive.getEntry("extension/package.json");
if (!manifestEntry) {
  fail("extension/package.json is missing");
}
const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
const requiredPaths = [
  "extension/package.json",
  `extension/${String(manifest.main).replace(/^\.\//u, "")}`,
  `extension/${String(manifest.icon).replace(/^\.\//u, "")}`,
  "extension/readme.md",
  "extension/README.en.md",
  "extension/LICENSE.md",
  "extension/changelog.md"
];
const missing = requiredPaths.filter(path => !paths.includes(path));

if (compressedBytes >= MAX_COMPRESSED_BYTES) {
  fail(`compressed size ${compressedBytes} exceeds the < ${MAX_COMPRESSED_BYTES} byte budget`);
}
if (files.length >= MAX_FILES_EXCLUSIVE) {
  fail(`file count ${files.length} exceeds the < ${MAX_FILES_EXCLUSIVE} budget`);
}
if (forbidden.length) {
  fail(`forbidden files found:\n${forbidden.join("\n")}`);
}
if (missing.length) {
  fail(`required files missing:\n${missing.join("\n")}`);
}

console.log(`VSIX verification passed: ${basename(vsixPath)}`);
console.log(`compressed bytes: ${compressedBytes}`);
console.log(`uncompressed bytes: ${uncompressedBytes}`);
console.log(`files: ${files.length}`);

async function resolveVsixPath(argument) {
  if (argument) {
    return resolve(argument);
  }
  const candidates = (await readdir(process.cwd()))
    .filter(path => path.endsWith(".vsix"))
    .map(path => resolve(path));
  if (!candidates.length) {
    fail("no .vsix file found; run npm run package first");
  }
  const details = await Promise.all(candidates.map(async path => ({ path, modified: (await stat(path)).mtimeMs })));
  details.sort((left, right) => right.modified - left.modified);
  return details[0].path;
}

function fail(message) {
  console.error(`VSIX verification failed: ${message}`);
  process.exit(1);
}
