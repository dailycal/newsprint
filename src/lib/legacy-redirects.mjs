/**
 * Writes dist/_redirects at the end of `astro build`: a 301 from every page of the old archive
 * site (newsprint.dailycal.org / archive.dailycal.org, 2016-2019) to its page here, so old links
 * and search results keep working. Cloudflare reads this file.
 *
 * Old issue pages were /issues/1964/11/12/ and month pages /issues/1964/11/; they're
 * /1964/november/12 and /1964/november here. Every rule is static (no `*` or `:placeholder`, which
 * can't turn "11" into "november"), and Cloudflare allows 2,000 static rules, so the build fails if
 * there would be more.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getIssues, monthSlug } from "./issues.mjs";

const MAX_STATIC_REDIRECTS = 2000;
const pad = (n) => String(n).padStart(2, "0");

/** @returns {import("astro").AstroIntegration} */
export default function legacyRedirects() {
  return {
    name: "legacy-redirects",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const rules = [["/issues/", "/#issues"]];
        const months = new Set();
        for (const issue of getIssues()) {
          const { year, month, day } = issue;
          if (!months.has(`${year}-${month}`)) {
            months.add(`${year}-${month}`);
            rules.push([`/issues/${year}/${pad(month)}/`, `/${year}/${monthSlug(month)}`]);
          }
          rules.push([`/issues/${year}/${pad(month)}/${pad(day)}/`, issue.path]);
        }
        if (rules.length > MAX_STATIC_REDIRECTS) {
          throw new Error(
            `${rules.length} redirects is over Cloudflare's limit of ${MAX_STATIC_REDIRECTS} static rules.`,
          );
        }
        const body = `${rules.map(([from, to]) => `${from} ${to} 301`).join("\n")}\n`;
        await writeFile(fileURLToPath(new URL("_redirects", dir)), body);
        logger.info(`Wrote ${rules.length} redirects from the old archive's URLs.`);
      },
    },
  };
}
