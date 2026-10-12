// @ts-check
/**
 * Copy guard (DESIGN.md: "No em dashes or en dashes anywhere in visible copy").
 *
 * content.config.ts already rejects dashes in frontmatter. This integration closes the gaps:
 *  1. astro:build:start  scans every file in src/content (markdown BODY included) and fails the
 *     build with file:line locations.
 *  2. astro:build:done   scans the generated HTML / TXT / XML (visible text, attributes, meta tags
 *     and JSON-LD; module scripts and styles are ignored) and fails the build if any dash slipped
 *     through a component, a page or data.
 * In `astro dev` the source scan only logs warnings.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DASH = /[–—]|&(?:mdash|ndash);|&#(?:8211|8212|x2013|x2014);/i;
const SOURCE_EXT = new Set([".md", ".mdx", ".markdown", ".json", ".yaml", ".yml"]);
const OUTPUT_EXT = new Set([".html", ".txt", ".xml"]);

/** @param {string} dir @param {Set<string>} exts @returns {string[]} */
function walk(dir, exts) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.has(extname(name).toLowerCase())) out.push(full);
  }
  return out;
}

/** @param {string} text @returns {string} */
function snippet(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 90);
}

/** @param {string} contentDir @param {string} root @returns {string[]} */
function scanSources(contentDir, root) {
  /** @type {string[]} */
  const problems = [];
  for (const file of walk(contentDir, SOURCE_EXT)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (DASH.test(line)) problems.push(`${relative(root, file)}:${i + 1}  ${snippet(line)}`);
      });
  }
  return problems;
}

/** @param {string} outDir @returns {string[]} */
function scanOutput(outDir) {
  /** @type {string[]} */
  const problems = [];
  for (const file of walk(outDir, OUTPUT_EXT)) {
    let text = readFileSync(file, "utf8");
    if (file.endsWith(".html")) {
      text = text
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, "");
    }
    const match = DASH.exec(text);
    if (match) {
      const at = match.index;
      problems.push(`${relative(outDir, file)}  ...${snippet(text.slice(Math.max(0, at - 50), at + 40))}...`);
    }
  }
  return problems;
}

const HINT = "Use periods, commas, colons or hyphens instead of em/en dashes (DESIGN.md copy rule).";

/** @returns {import("astro").AstroIntegration} */
export default function copyGuard() {
  /** @type {string} */
  let root = process.cwd();
  /** @type {string} */
  let contentDir = join(root, "src", "content");

  return {
    name: "cantt:copy-guard",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = fileURLToPath(config.root);
        contentDir = join(fileURLToPath(config.srcDir), "content");
      },
      "astro:server:start": ({ logger }) => {
        const problems = scanSources(contentDir, root);
        if (problems.length) logger.warn(`Em/en dashes in content:\n  ${problems.join("\n  ")}\n${HINT}`);
      },
      "astro:build:start": () => {
        const problems = scanSources(contentDir, root);
        if (problems.length) throw new Error(`[copy-guard] Em/en dashes in content:\n  ${problems.join("\n  ")}\n${HINT}`);
      },
      "astro:build:done": ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const problems = scanOutput(outDir);
        if (problems.length) throw new Error(`[copy-guard] Em/en dashes in the built site:\n  ${problems.join("\n  ")}\n${HINT}`);
        logger.info("No em/en dashes in the built pages.");
      },
    },
  };
}
