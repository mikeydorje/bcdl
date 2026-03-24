#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const csvPath = process.argv[2];

if (!csvPath) {
  console.error("Usage: node scripts/import-codes.js <path-to-csv>");
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(csvPath, "utf-8");
const lines = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

if (lines.length === 0) {
  console.error("CSV file is empty.");
  process.exit(1);
}

// Skip header if first line looks like a header
let startIndex = 0;
if (/^code$/i.test(lines[0])) {
  startIndex = 1;
}

const codes = lines.slice(startIndex);

if (codes.length === 0) {
  console.error("No codes found in CSV.");
  process.exit(1);
}

if (codes.length > 100) {
  console.error(`Too many codes (${codes.length}). Maximum is 100.`);
  process.exit(1);
}

const codePattern = /^[a-zA-Z0-9-]+$/;
for (const code of codes) {
  if (!codePattern.test(code)) {
    console.error(`Invalid code: "${code}" — must be alphanumeric or hyphens only.`);
    process.exit(1);
  }
}

const now = new Date().toISOString();
const entries = codes.map((code) => ({
  key: `available:${code}`,
  value: now,
}));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-codes-"));
const tmpFile = path.join(tmpDir, "codes.json");

try {
  fs.writeFileSync(tmpFile, JSON.stringify(entries, null, 2));
  console.log(`Importing ${codes.length} code(s)...`);
  execSync(`npx wrangler kv bulk put "${tmpFile}" --binding CODES --remote`, {
    stdio: "inherit",
  });
  console.log("Import complete.");
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
