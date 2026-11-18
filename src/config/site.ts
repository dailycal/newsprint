// Site-wide constants: names, descriptions and links used by the layout and SEO tags. Change them
// here rather than in individual pages.

/**
 * A search of the UC Berkeley Library's Daily Cal collection (by its collection facet), through
 * the text of its scans when there's a query.
 */
export function librarySearchUrl(query: string): string {
  const params = new URLSearchParams({
    ln: "en",
    p: query,
    sf: "title",
    so: "a",
    rg: "10",
    c: "Digital Collections",
    of: "hb",
    fti: query ? "1" : "0", // full text
    fct__2: "Daily Cal", // the Daily Cal collection
  });
  return `https://digicoll.lib.berkeley.edu/search?${params}`;
}

export const site = {
  /** Used in <title>s, og:site_name and the JSON-LD. */
  name: "The Daily Californian Archive",
  /** The newspaper itself, as the publication every issue belongs to. */
  newspaper: "The Daily Californian",
  /** Default meta description. */
  description:
    "An online archive of historical issues of the Daily Californian, UC Berkeley's independent student newspaper, with the full text of every page.",
  contactEmail: "online@dailycal.org",
  githubUrl: "https://github.com/dailycal/newsprint",
  mainSiteUrl: "https://www.dailycal.org",
  donateUrl: "https://givebutter.com/w68cQv",
  /** UC Berkeley Library's digitized Daily Californian collection. */
  libraryUrl: librarySearchUrl(""),
  /** The year the Daily Californian started printing; the homepage's grid starts here. */
  firstYear: 1871,
};
