import type { APIRoute } from "astro";

// Generates robots.txt at build time, so the Sitemap line always matches the `site` configured in
// astro.config.mjs. /search pages are noindex (their results are the issue pages themselves).
export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("/sitemap-index.xml", site);

  const body = `User-agent: *
Disallow: /search
Disallow: /pagefind/
Allow: /

Sitemap: ${sitemapURL.href}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
  });
};
