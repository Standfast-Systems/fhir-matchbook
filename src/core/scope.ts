import type { Country, Fhir, Guide, Party, Release, ScopeOptions } from './types.ts';

// Statuses package-list.json uses for real releases. HL7 Terminology, WHO and many IHE guides
// publish as `release`, so the three ballot-level statuses alone would drop them.
const PUBLISHED = new Set([
  'trial-use',
  'normative',
  'informative',
  'release',
  'normative+trial-use',
  'corrected',
  'update',
]);

export const DEFAULT_SCOPE: ScopeOptions = { drafts: false, r5: false };

const isR4 = (f: Fhir) => f === 'R4' || f === 'R4B';
const isR5 = (f: Fhir) => f === 'R5' || f === 'R6';

/** A real release: published status, not 0.x, not a -ballot/-snapshot version. */
export function isPublished(r: Release): boolean {
  if (r.version.startsWith('0.') || r.version.includes('-')) return false;
  // No package-list.json at all: trust a plain semver npm release.
  if (r.status === null) return true;
  return PUBLISHED.has(r.status);
}

/**
 * The release a guide should link to under these options, or null when it's out of scope.
 * A published R4 release always wins, so turning a toggle on never swaps a guide's link for a
 * newer ballot; the toggles only bring in guides that had nothing to show. Within the winning
 * rule, the release the publisher marks current is preferred; if it doesn't qualify (a ballot, an
 * R5 edition), the newest one that does is used instead.
 */
export function pickRelease(g: Guide, o: ScopeOptions): Release | null {
  const live = g.releases.filter((r) => r.status !== 'withdrawn');
  const tiers: ((r: Release) => boolean)[] = [(r) => isPublished(r) && r.fhir.some(isR4)];
  if (o.r5) tiers.push((r) => isPublished(r) && r.fhir.some(isR5));
  if (o.drafts) tiers.push((r) => r.fhir.some(isR4));
  if (o.drafts && o.r5) tiers.push((r) => r.fhir.some(isR5));
  for (const t of tiers) {
    const ok = live.filter(t);
    if (ok.length) return ok.find((r) => r.current) ?? ok[0];
  }
  return null;
}

/** Which scope toggle brought a guide in. */
export type AddedBy = keyof ScopeOptions;

/**
 * What the toggles added, judged by the release the row links to: not a published release means
 * the drafts toggle, not R4 means the R5/R6 toggle (a draft R5 guide counts under both). A guide
 * from the default view never counts, because a published R4 release always wins.
 */
export function addedBy(g: ScopedGuide): Record<AddedBy, boolean> {
  return { drafts: !isPublished(g.release), r5: !g.release.fhir.some(isR4) };
}

/**
 * A Domain or Program (family) pick narrows to all of it, whatever the region; both combine.
 * Region selection is set aside while either is picked.
 */
export function inFocus(g: Guide, family: string | null, domain: string | null): boolean {
  return (!family || g.family === family) && (!domain || g.domains.includes(domain));
}

/** How many guides carry each key, e.g. each domain or family, for the dropdown counts. */
export function countBy(guides: readonly Guide[], keys: (g: Guide) => readonly string[]) {
  const n = new Map<string, number>();
  for (const g of guides) for (const k of keys(g)) n.set(k, (n.get(k) ?? 0) + 1);
  return n;
}

export interface ScopedGuide extends Guide {
  release: Release;
  region: RegionKey;
}

/** US shows US-specific and generic guides; International shows guides strictly for outside it. */
export function inCountry(g: Guide, c: Country): boolean {
  return c === 'intl' ? g.use === 'intl' : g.use !== 'intl';
}

export function applyScope(guides: Guide[], o: ScopeOptions, c: Country): ScopedGuide[] {
  const out: ScopedGuide[] = [];
  for (const g of guides) {
    // Only known publishers: HL7 and its national affiliates, IHE, US agencies, WHO and national
    // health authorities. There is no toggle for others; it only ever added a handful.
    if (g.withdrawn || !g.knownPublisher || !inCountry(g, c)) continue;
    const release = pickRelease(g, o);
    if (release) out.push({ ...g, release, region: regionOf(g.parties) });
  }
  return out;
}

// Regions of the three-circle diagram ---------------------------------------------------------

export type RegionKey = 'all' | 'pt-pr' | 'pr-py' | 'pt-py' | 'pt' | 'pr' | 'py' | 'none';

export interface Region {
  key: RegionKey;
  parties: Party[];
  label: string;
}

export const REGIONS: readonly Region[] = [
  { key: 'all', parties: ['patient', 'provider', 'payer'], label: 'All three' },
  { key: 'pt-pr', parties: ['patient', 'provider'], label: 'Patient + Provider' },
  { key: 'pr-py', parties: ['provider', 'payer'], label: 'Provider + Payer' },
  { key: 'pt-py', parties: ['patient', 'payer'], label: 'Patient + Payer' },
  { key: 'pt', parties: ['patient'], label: 'Patient only' },
  { key: 'pr', parties: ['provider'], label: 'Provider only' },
  { key: 'py', parties: ['payer'], label: 'Payer only' },
  { key: 'none', parties: [], label: 'Other' },
];

export const REGION_KEYS = REGIONS.map((r) => r.key);

export function regionOf(parties: readonly Party[]): RegionKey {
  const has = new Set(parties);
  return (
    REGIONS.find((r) => r.parties.length === has.size && r.parties.every((p) => has.has(p)))?.key ??
    'none'
  );
}

export function regionsWith(party: Party): RegionKey[] {
  return REGIONS.filter((r) => r.parties.includes(party)).map((r) => r.key);
}

export function countByRegion(guides: readonly ScopedGuide[]): Record<RegionKey, number> {
  const c = Object.fromEntries(REGION_KEYS.map((k) => [k, 0])) as Record<RegionKey, number>;
  for (const g of guides) c[g.region]++;
  return c;
}

// Table ----------------------------------------------------------------------------------------

export type SortKey = 'start' | 'name' | 'date' | 'family';

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Search over a guide's name, one-liner and topic group, word by word. Every query word has to
 * match: words of three letters or more match the start of a word ("auth" finds "authorization"),
 * shorter ones only a whole word, so "US" finds US Core but not "used" or the ".us." inside
 * package ids, which are no longer searched.
 */
export function matches(g: Guide, query: string): boolean {
  const want = words(query);
  if (!want.length) return true;
  const have = words(`${g.name} ${g.blurb} ${g.group}`);
  return want.every((w) => (w.length <= 2 ? have.includes(w) : have.some((h) => h.startsWith(w))));
}

const rank = (g: Guide) => g.start || Number.MAX_SAFE_INTEGER;

/**
 * `family` groups guides by program family in `families` order (guides in no family last), and
 * keeps each family's reading order so CRD, DTR and PAS sit together in workflow order.
 */
export function sortGuides(
  guides: ScopedGuide[],
  key: SortKey,
  families: readonly string[] = [],
): ScopedGuide[] {
  const byName = (a: ScopedGuide, b: ScopedGuide) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  // National cores read in country order (AT, AU, BD, BE, ...), ahead of guides with no country.
  const byCountry = (a: ScopedGuide, b: ScopedGuide) =>
    a.country && b.country
      ? a.country.localeCompare(b.country)
      : a.country
        ? -1
        : b.country
          ? 1
          : 0;
  const byStart = (a: ScopedGuide, b: ScopedGuide) =>
    rank(a) - rank(b) || byCountry(a, b) || byName(a, b);
  const fam = (g: Guide) => {
    const i = g.family ? families.indexOf(g.family) : -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const cmp: Record<SortKey, (a: ScopedGuide, b: ScopedGuide) => number> = {
    start: byStart,
    name: byName,
    date: (a, b) => (b.release.date ?? '').localeCompare(a.release.date ?? '') || byName(a, b),
    family: (a, b) =>
      fam(a) - fam(b) || (a.family ? a.familyRank - b.familyRank || byName(a, b) : byStart(a, b)),
  };
  return [...guides].sort(cmp[key]);
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: p,
    pages,
    from: slice.length ? start + 1 : 0,
    to: start + slice.length,
    total: items.length,
  };
}

// View state --------------------------------------------------------------------------------------

export interface ViewState {
  country: Country;
  regions: RegionKey[];
  /** "What are you working on?" filter, only while Provider-only is selected. */
  bucket: string | null;
  /** Program (family) pick, from the dropdown or a row's family tag: all of it, any region. */
  family: string | null;
  /** Domain pick, from the dropdown or a row's domain tag: all of it, any region. */
  domain: string | null;
  /** Narrow to what a scope toggle added; only while that toggle is on. */
  added: AddedBy | null;
  scope: ScopeOptions;
  query: string;
  sort: SortKey;
  page: number;
}

/** Where every visit starts: US, the shared foundation, so US Core and friends show straight away. */
export const DEFAULT_VIEW: ViewState = {
  country: 'us',
  regions: ['all'],
  bucket: null,
  family: null,
  domain: null,
  added: null,
  scope: DEFAULT_SCOPE,
  query: '',
  sort: 'start',
  page: 1,
};
