// Refreshes snapshot/registry.json straight from the official FHIR IG registry and each guide's
// published version list (package-list.json). Matchbook keeps no registry of its own: a guide
// appears only if the registry lists it.
//
//   npm run snapshot
//
// Guides fetched: everything in data/ig-map.yaml and data/national-cores.yaml that the registry
// lists. Each release keeps the publisher's "current" flag, so rows can link the release the
// publisher calls current. A guide with no reachable package-list.json falls
// back to the editions the registry itself lists, which carry no status or date.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { NationalCore, RegistryEntry } from '../src/core/national.ts';

const REGISTRY = 'https://raw.githubusercontent.com/FHIR/ig-registry/master/fhir-ig-list.json';
const CONCURRENCY = 8;

interface RegistryGuide {
  name: string;
  category?: string;
  'npm-name': string;
  description?: string;
  country?: string;
  canonical?: string;
  withdrawn?: unknown;
  editions?: { 'ig-version': string; 'fhir-version'?: string[]; url?: string }[];
}
interface PackageListEntry {
  version: string;
  current?: boolean;
  fhirversion?: string;
  date?: string;
  status?: string;
  sequence?: string;
  path?: string;
}

async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'follow' });
      if (r.status === 404) return null;
      if (r.ok) return (await r.json()) as T;
    } catch {
      // timeout, network error or a page that isn't JSON: retry once, then give up
    }
  }
  return null;
}

const list = await getJson<{ guides: RegistryGuide[] }>(REGISTRY);
if (!list) throw new Error(`Couldn't read the registry at ${REGISTRY}`);

const registry: Record<string, RegistryEntry> = {};
for (const g of list.guides) {
  if (!g['npm-name']) continue;
  registry[g['npm-name']] = {
    npm: g['npm-name'],
    name: g.name,
    category: g.category ?? '',
    country: (g.country ?? '').toLowerCase(),
    withdrawn: Boolean(g.withdrawn),
  };
}
const byNpm = new Map(list.guides.map((g) => [g['npm-name'], g]));

const map = parse(readFileSync('data/ig-map.yaml', 'utf8')) as { guides: { npm: string }[] };
const national = parse(readFileSync('data/national-cores.yaml', 'utf8')) as NationalCore[];
const wanted = new Set([...map.guides.map((g) => g.npm), ...national.map((n) => n.ig)]);
const missing = [...wanted].filter((id) => !byNpm.has(id));

async function releasesFor(g: RegistryGuide) {
  const canonical = g.canonical?.replace(/\/$/, '');
  const pl = canonical
    ? await getJson<{ list?: PackageListEntry[] }>(`${canonical}/package-list.json`)
    : null;
  const entries = (pl?.list ?? []).filter((e) => e.version && e.version !== 'current');
  if (entries.length) {
    // Some version lists leave out the FHIR version; fall back to what the registry's editions say.
    const editionFhir = [...new Set((g.editions ?? []).flatMap((e) => e['fhir-version'] ?? []))];
    return {
      packageList: true,
      versions: entries.map((e) => ({
        version: e.version,
        fhir: e.fhirversion ? e.fhirversion.split(/[|,;]\s*/).filter(Boolean) : editionFhir,
        date: e.date?.slice(0, 10),
        status: e.status,
        sequence: e.sequence,
        path: e.path,
        current: e.current === true || undefined,
      })),
    };
  }
  return {
    packageList: false,
    versions: (g.editions ?? []).map((e) => ({
      version: e['ig-version'],
      fhir: e['fhir-version'] ?? [],
      path: e.url,
    })),
  };
}

const ids = [...wanted].filter((id) => byNpm.has(id)).sort();
const packages: Record<string, unknown> = {};
let next = 0;
let fallbacks = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < ids.length) {
      const g = byNpm.get(ids[next++])!;
      const { packageList, versions } = await releasesFor(g);
      if (!packageList) fallbacks++;
      packages[g['npm-name']] = {
        title: g.name,
        description: g.description,
        canonical: g.canonical,
        packageList,
        versions,
      };
    }
  }),
);

const sorted = Object.fromEntries(
  Object.keys(packages)
    .sort()
    .map((k) => [k, packages[k]]),
);
writeFileSync(
  'snapshot/registry.json',
  JSON.stringify(
    { generated: new Date().toISOString(), source: REGISTRY, registry, packages: sorted },
    null,
    1,
  ) + '\n',
);
console.log(
  `snapshot: ${Object.keys(packages).length} guides (${fallbacks} from registry editions, no package-list.json); registry has ${list.guides.length}`,
);
if (missing.length) console.warn(`not in the registry, so not listed: ${missing.join(', ')}`);
