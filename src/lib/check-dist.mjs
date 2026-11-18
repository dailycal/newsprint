/**
 * Checks the built site against Cloudflare's limits at the end of `astro build`, so the build fails
 * instead of the deploy: 25 MiB per static asset, and 20,000 files per Worker on the free plan.
 * It also checks that data/ didn't end up in dist/ (the CSV and OCR text are build inputs only).
 * Runs last, after the search index and redirects are written.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ASSET_SIZE = 25 * 1024 * 1024;
const MAX_FILES = 20_000;

const mib = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

/** @returns {import("astro").AstroIntegration} */
export default function checkDist() {
  return {
    name: "check-dist",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = readdirSync(root, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => join(entry.parentPath, entry.name))
          .map((path) => ({ path: relative(root, path), size: statSync(path).size }));

        const problems = [];
        const tooBig = files.filter(({ size }) => size > MAX_ASSET_SIZE);
        if (tooBig.length) {
          problems.push(
            `Over Cloudflare's ${mib(MAX_ASSET_SIZE)} limit per file:\n${tooBig
              .map(({ path, size }) => `  ${path} (${mib(size)})`)
              .join("\n")}`,
          );
        }
        if (files.length > MAX_FILES) {
          problems.push(
            `${files.length} files is over Cloudflare's limit of ${MAX_FILES} per Worker.`,
          );
        }
        const leaked = files.filter(({ path }) =>
          /\.(csv|txt\.gz|tar\.gz)$|_issue\.txt$/.test(path),
        );
        if (leaked.length) {
          problems.push(
            `Build inputs shouldn't be deployed:\n${leaked.map((f) => `  ${f.path}`).join("\n")}`,
          );
        }
        if (problems.length) throw new Error(problems.join("\n\n"));

        const total = files.reduce((sum, { size }) => sum + size, 0);
        logger.info(`dist/ has ${files.length} files (${mib(total)}), within Cloudflare's limits.`);
      },
    },
  };
}
