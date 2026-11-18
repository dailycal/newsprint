/**
 * /search-dates.json: what the /search page needs to answer a search for a date, beyond our own
 * issues' text (which is in the search index): the dates of our issues ("YYYY-MM-DD"), each issue
 * only the UC Berkeley Library has ("YYYY-MM-DD": its library record ID), and every month with an
 * issue here or at the library ("YYYY-MM"). Loaded only when a search looks like a date.
 */
import type { APIRoute } from "astro";
import { getAllIssues } from "../lib/issues.mjs";

export const GET: APIRoute = () => {
  const issues = getAllIssues();
  const library = Object.fromEntries(
    issues.filter((issue) => !issue.id).map((issue) => [issue.iso, Number(issue.library)]),
  );
  const ours = issues.filter((issue) => issue.id).map((issue) => issue.iso);
  const months = [...new Set(issues.map((issue) => issue.iso.slice(0, 7)))];
  return new Response(JSON.stringify({ ours, library, months }), {
    headers: { "Content-Type": "application/json" },
  });
};
