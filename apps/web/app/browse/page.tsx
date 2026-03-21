import Link from "next/link";
import type { ContentCard, HomeFeedResponse } from "@flyhigh/contracts";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { BrowseSessionNote } from "./browse-session-note";
import { BrowseCatalogExperience } from "./browse-catalog-experience";

type CatalogResponse = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  items: ContentCard[];
};

type TagsResponse = {
  tags: Array<{ tag: string; count: number }>;
};

type AuthorsResponse = {
  authors: Array<{ author: string; count: number }>;
};

type SearchParamValue = string | string[] | undefined;

type BrowseParams = {
  q?: SearchParamValue;
  type?: SearchParamValue;
  access?: SearchParamValue;
  tag?: SearchParamValue;
  author?: SearchParamValue;
  sort?: SearchParamValue;
  page?: SearchParamValue;
};

function first(value: SearchParamValue): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function normalizeType(value: string): string {
  const v = value.trim().toLowerCase();
  return ["all", "film", "series", "episode", "trailer", "bonus"].includes(v) ? v : "all";
}

function normalizeAccess(value: string): string {
  const v = value.trim().toLowerCase();
  return ["all", "premium", "free"].includes(v) ? v : "all";
}

function normalizeSort(value: string): string {
  const v = value.trim().toLowerCase();
  return ["featured", "newest", "title", "author"].includes(v) ? v : "featured";
}

function buildBrowseHref(next: { q?: string; type?: string; access?: string; tag?: string; author?: string; sort?: string; page?: number }) {
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.type && next.type !== "all") params.set("type", next.type);
  if (next.access && next.access !== "all") params.set("access", next.access);
  if (next.tag && next.tag !== "all") params.set("tag", next.tag);
  if (next.author && next.author !== "all") params.set("author", next.author);
  if (next.sort && next.sort !== "featured") params.set("sort", next.sort);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

async function getCatalog(filters: {
  q: string;
  type: string;
  access: string;
  tag: string;
  author: string;
  sort: string;
  page: number;
  limit: number;
}): Promise<CatalogResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.access !== "all") params.set("access", filters.access);
  if (filters.tag !== "all") params.set("tag", filters.tag);
  if (filters.author !== "all") params.set("author", filters.author);
  if (filters.sort !== "featured") params.set("sort", filters.sort);
  params.set("limit", String(filters.limit));
  params.set("offset", String((filters.page - 1) * filters.limit));

  try {
    const response = await fetch(`${apiUrl}/v1/content/catalog?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load catalog");
    return response.json();
  } catch {
    return { total: 0, limit: filters.limit, offset: 0, hasMore: false, items: [] };
  }
}

async function getTags(): Promise<TagsResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/content/tags`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load tags");
    return response.json();
  } catch {
    return { tags: [] };
  }
}

async function getBrowseRows(): Promise<HomeFeedResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/content/home`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load browse rows");
    return response.json();
  } catch {
    return { featured: null, featuredItems: [], rows: [] };
  }
}

async function getAuthors(): Promise<AuthorsResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/content/authors`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load authors");
    return response.json();
  } catch {
    return { authors: [] };
  }
}

export default async function BrowsePage({ searchParams }: { searchParams?: Promise<BrowseParams> }) {
  const params = (await searchParams) ?? {};
  const q = first(params.q).trim();
  const type = normalizeType(first(params.type));
  const access = normalizeAccess(first(params.access));
  const tag = first(params.tag).trim() || "all";
  const author = first(params.author).trim() || "all";
  const sort = normalizeSort(first(params.sort));
  const page = Math.max(1, Number.parseInt(first(params.page) || "1", 10) || 1);
  const limit = 24;
  const allVideosLimit = 500;

  const [catalog, allVideosCatalog, browseRows, tags, authors] = await Promise.all([
    getCatalog({ q, type, access, tag, author, sort, page, limit }),
    getCatalog({
      q: "",
      type: "all",
      access: "all",
      tag: "all",
      author: "all",
      sort: "featured",
      page: 1,
      limit: allVideosLimit
    }),
    getBrowseRows(),
    getTags(),
    getAuthors()
  ]);

  const totalPages = Math.max(1, Math.ceil((catalog.total || 0) / limit));
  const currentPage = Math.min(page, totalPages);
  const validTagValues = new Set(tags.tags.map((t) => t.tag));
  const selectedTag = tag === "all" || validTagValues.has(tag) ? tag : "all";
  const validAuthorValues = new Set(authors.authors.map((a) => a.author));
  const selectedAuthor = author === "all" || validAuthorValues.has(author) ? author : "all";
  const bannerItem = catalog.items[0] ?? null;
  const rails: Array<{ title: string; items: ContentCard[] }> = [
    { title: "All Videos", items: allVideosCatalog.items },
    ...browseRows.rows
  ].filter((row) => row.items.length > 0);

  return (
    <main className="page page--marketing page--ott-catalog">
      <section className="watch-hero">
        <div className="watch-hero__inner">
          <SiteHeader compact />
          <div className="browse-hero">
            <div>
              <div className="brand">FlyHigh Catalog</div>
              <h1>Browse FlyHigh TV</h1>
              <p className="watch-copy">
                Classic wake films, edits, and originals. Stream instantly.
              </p>
            </div>
            <div className="browse-hero__meta">
              <strong>{catalog.total}</strong>
              <span>Total titles</span>
              <BrowseSessionNote />
            </div>
          </div>
        </div>
      </section>

      <section className="theme:section theme-section--compact">
        <div className="theme-container content">
          <form className="browse-filters-card" method="GET" action="/browse">
            <div className="browse-controls browse-controls--catalog">
              <label>
                Search
                <input name="q" defaultValue={q} placeholder="Title, tags, synopsis..." />
              </label>
              <label>
                Type
                <select name="type" defaultValue={type}>
                  <option value="all">All</option>
                  <option value="film">Film</option>
                  <option value="series">Series</option>
                  <option value="episode">Episode</option>
                  <option value="trailer">Trailer</option>
                  <option value="bonus">Bonus</option>
                </select>
              </label>
              <label>
                Access
                <select name="access" defaultValue={access}>
                  <option value="all">All</option>
                  <option value="premium">Subscriber only</option>
                  <option value="free">Free</option>
                </select>
              </label>
              <label>
                Tag
                <select name="tag" defaultValue={selectedTag}>
                  <option value="all">All tags</option>
                  {tags.tags.map((t) => (
                    <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
                  ))}
                </select>
              </label>
              <label>
                Author
                <select name="author" defaultValue={selectedAuthor}>
                  <option value="all">All authors</option>
                  {authors.authors.map((a) => (
                    <option key={a.author} value={a.author}>{a.author} ({a.count})</option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select name="sort" defaultValue={sort}>
                  <option value="featured">Featured order</option>
                  <option value="newest">Newest year</option>
                  <option value="title">Title A-Z</option>
                  <option value="author">Author A-Z</option>
                </select>
              </label>
            </div>
            <div className="browse-controls__actions browse-controls__actions--catalog">
              <button className="btn btn--primary" type="submit">Apply filters</button>
              <Link className="btn btn--secondary" href="/browse">Reset</Link>
            </div>
          </form>
        </div>
      </section>

      <section className="theme:section theme-section--catalog">
        <div className="theme-container content">
          <div className="browse-summary">
            <p className="card__meta">
              Showing page {currentPage} of {totalPages}. {catalog.total} total titles.
            </p>
            <Link className="btn btn--secondary btn--sm" href="/">Back Home</Link>
          </div>

          {catalog.items.length ? (
            <>
              <BrowseCatalogExperience initialItem={bannerItem} rails={rails} />

              <div className="browse-pagination">
                <a
                  className={`btn btn--secondary ${currentPage <= 1 ? "is-disabled" : ""}`}
                  aria-disabled={currentPage <= 1}
                  href={currentPage <= 1 ? buildBrowseHref({ q, type, access, tag: selectedTag, author: selectedAuthor, sort, page: 1 }) : buildBrowseHref({ q, type, access, tag: selectedTag, author: selectedAuthor, sort, page: currentPage - 1 })}
                >
                  Previous
                </a>
                <div className="card__meta">
                  Showing {catalog.offset + 1}-{catalog.offset + catalog.items.length} of {catalog.total}
                </div>
                <a
                  className={`btn btn--secondary ${!catalog.hasMore ? "is-disabled" : ""}`}
                  aria-disabled={!catalog.hasMore}
                  href={!catalog.hasMore ? buildBrowseHref({ q, type, access, tag: selectedTag, author: selectedAuthor, sort, page: currentPage }) : buildBrowseHref({ q, type, access, tag: selectedTag, author: selectedAuthor, sort, page: currentPage + 1 })}
                >
                  Next
                </a>
              </div>
            </>
          ) : (
            <div className="player-panel browse-empty">
              <p className="card__meta">No titles match your filters.</p>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
