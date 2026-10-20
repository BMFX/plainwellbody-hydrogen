// Validates the storefront's plain-string GraphQL queries (the section queries in
// app/lib/content.ts, pages.ts and collections.ts, too deep for gql.tada's type checker)
// against the Storefront API schema, using the Shopify AI Toolkit validator.
//
//   node scripts/shopify/validate-queries.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { HYDROGEN } from "./admin.mjs";

const FILES = ["app/lib/content.ts", "app/lib/pages.ts", "app/lib/collections.ts"];
const QUERIES = ["SITE_CONTENT_QUERY", "PAGE_QUERY", "HOME_PAGE_QUERY", "COLLECTION_SECTIONS_QUERY"];
const VALIDATOR = path.join(HYDROGEN, ".agents/skills/shopify/scripts/validate.mjs");
const VERSION = "2026-10";

if (!existsSync(VALIDATOR)) {
  console.log("Skipped the section query check: the Shopify AI Toolkit isn't installed (.agents/skills/shopify).");
  process.exit(0);
}

// Collect every string constant: `const NAME = \`...\`` and `const NAME = [A, B].join("\n")`.
const raw = {};
for (const file of FILES) {
  const source = readFileSync(path.join(HYDROGEN, file), "utf8");
  for (const m of source.matchAll(/const (\w+)(?:: string)? = `([\s\S]*?)`;/g)) raw[m[1]] = m[2];
  for (const m of source.matchAll(/const (\w+)(?:: string)? = \[([\w\s,]+)\]\.join\("\\n"\);/g)) {
    raw[m[1]] = m[2]
      .split(",")
      .map((name) => `\${${name.trim()}}`)
      .join("\n");
  }
}

function expand(name, seen = []) {
  if (!(name in raw)) throw new Error(`Unknown constant ${name}`);
  if (seen.includes(name)) throw new Error(`Cycle: ${[...seen, name].join(" → ")}`);
  return raw[name].replace(/\$\{(\w+)\}/g, (_, inner) => expand(inner, [...seen, name]));
}

const dir = mkdtempSync(path.join(tmpdir(), "pw-queries-"));
let failed = 0;
for (const name of QUERIES) {
  const file = path.join(dir, `${name}.graphql`);
  writeFileSync(file, expand(name));
  let result;
  try {
    result = JSON.parse(execFileSync("node", [VALIDATOR, "--api", "storefront-graphql", "--version", VERSION, "--file", file, "--json"], { encoding: "utf8" }));
  } catch (error) {
    result = JSON.parse(error.stdout || "{}");
  }
  if (result.success) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name}\n${JSON.stringify(result.responses ?? result, null, 2).slice(0, 3000)}`);
  }
}
process.exit(failed ? 1 : 0);
