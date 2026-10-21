// Joins data/ig-map.yaml (party tags), data/notes.yaml (plain one-liners) and snapshot/registry.json
// (the official registry plus each guide's package-list.json, from `npm run snapshot`) into
// public/data/guides.json for the browser. National and regional cores come from the hand-checked
// data/national-cores.yaml rather than from ig-map.yaml.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { NationalCore, RegistryEntry } from '../src/core/national.ts';
import { DEFAULT_SCOPE, REGIONS, applyScope, countByRegion } from '../src/core/scope.ts';
import type {
  Bucket,
  Dataset,
  Domain,
  Family,
  Fhir,
  Guide,
  Party,
  Release,
  Use,
} from '../src/core/types.ts';

interface MapGuide {
  npm: string;
  name: string;
  realm: string;
  group: string;
  parties?: string[];
}
interface Note {
  name?: string;
  blurb?: string;
  start?: boolean | number;
  /** Universal-realm guide meant strictly for outside the US. */
  intl?: boolean;
}
interface SnapVersion {
  version: string;
  fhir: string[];
  date?: string;
  status?: string;
  sequence?: string;
  path?: string;
  current?: boolean;
}
interface SnapPackage {
  title?: string;
  description?: string;
  canonical?: string;
  packageList: boolean;
  versions: SnapVersion[];
}

const map = parse(readFileSync('data/ig-map.yaml', 'utf8')) as {
  groups: Record<string, { layer: string; label: string }>;
  guides: MapGuide[];
};
const notes = (parse(readFileSync('data/notes.yaml', 'utf8')) ?? {}) as Record<string, Note>;
const familyDefs = parse(readFileSync('data/families.yaml', 'utf8')) as (Family & {
  members?: string[];
  prefixes?: string[];
})[];
const domainDefs = parse(readFileSync('data/domains.yaml', 'utf8')) as (Domain & {
  members: string[];
})[];
const bucketDefs = parse(readFileSync('data/buckets.yaml', 'utf8')) as (Bucket & {
  groups: string[];
})[];
const snap = JSON.parse(readFileSync('snapshot/registry.json', 'utf8')) as {
  generated: string;
  registry: Record<string, RegistryEntry>;
  packages: Record<string, SnapPackage>;
};
const national = parse(readFileSync('data/national-cores.yaml', 'utf8')) as NationalCore[];

// HL7 International, IHE, US federal agencies (ONC/ASTP, CDC, HRSA) and WHO.
const KNOWN =
  /^(hl7\.|ihe\.|who\.|smart\.who\.int\.|gov\.cdc\.|fhir\.cdc\.|fhir\.onc\.|fhir\.astp\.|fhir\.hrsa\.)/;
// WHO SMART Guidelines serve national programs outside the US.
const WHO = /^(who\.|smart\.who\.int\.)/;
function useOf(g: MapGuide, note: Note): Use {
  if (g.realm === 'us') return 'us';
  return note.intl || WHO.test(g.npm) ? 'intl' : 'generic';
}

const PARTY: Record<string, Party> = { Patient: 'patient', Provider: 'provider', Payer: 'payer' };

function fhirOf(v: string): Fhir {
  if (/^4\.0\./.test(v)) return 'R4';
  if (/^4\.3\./.test(v)) return 'R4B';
  if (/^5\.0\./.test(v)) return 'R5';
  if (/^6\./.test(v)) return 'R6';
  if (/^3\.0\./.test(v)) return 'R3';
  if (/^1\.0\./.test(v)) return 'R2';
  return 'other';
}

function semverDesc(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre] = v.split('-', 2);
    return { nums: core.split('.').map((n) => parseInt(n, 10) || 0), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (y.nums[i] ?? 0) - (x.nums[i] ?? 0);
    if (d) return d;
  }
  if (x.pre && !y.pre) return 1;
  if (!x.pre && y.pre) return -1;
  return (y.pre ?? '').localeCompare(x.pre ?? '');
}

function label(v: SnapVersion): string {
  // Only published pages live under /STUn; ballots carry the STU they're heading for in `sequence`.
  const stu = /\/STU(\d+(?:\.\d+)*)\/?$/i.exec(v.path ?? '')?.[1];
  return stu ? `STU ${stu}` : `v${v.version}`;
}

function cleanName(n: string): string {
  return n
    .replace(/�/g, '')
    .replace(/\bDavinci\b/g, 'Da Vinci')
    .replace(/,?\s*(Release \d+.*|STU\s*\d.*)$/i, '')
    .replace(/\s+(FHIR\s+)?(Implementation Guide|IG)(:.*)?$/i, '')
    .trim();
}

function fallbackBlurb(p: SnapPackage, name: string, groupLabel: string): string {
  const d = (p.description ?? '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(\w+) \1\b/gi, '$1') // "The The MedMorph"
    .trim();
  const first = d.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] ?? '';
  if (first.length < 25 || first.toLowerCase().startsWith(name.toLowerCase().slice(0, 20))) {
    return `${groupLabel}.`;
  }
  if (first.length <= 180) return first.replace(/([^.!?])$/, '$1.');
  return first.slice(0, 177).replace(/\s+\S*$/, '') + '…';
}

function releasesOf(id: string, p: SnapPackage): Release[] {
  return p.versions
    .map((v) => ({
      version: v.version,
      status: v.status ?? (p.packageList ? 'unlisted' : null),
      fhir: [...new Set(v.fhir.flatMap((f) => f.split(/[|,;]\s*/)).map(fhirOf))],
      date: v.date,
      url: v.path ?? p.canonical ?? `https://packages.fhir.org/${id}`,
      label: label(v),
      ...(v.current ? { current: true } : {}),
    }))
    .sort((a, b) => semverDesc(a.version, b.version));
}

const errors: string[] = [];
const warnings: string[] = [];
const guides: Guide[] = [];
const ids = new Set(map.guides.map((g) => g.npm));
const coreIds = new Set(national.map((n) => n.ig));
for (const id of Object.keys(notes))
  if (!ids.has(id) && !coreIds.has(id))
    errors.push(`notes.yaml: ${id} is neither in ig-map.yaml nor a national core`);

// Each visible ig-map group sits in exactly one bucket.
const bucketOf = new Map<string, string>();
for (const b of bucketDefs) {
  for (const g of b.groups) {
    if (!map.groups[g]) errors.push(`buckets.yaml: ${b.id} lists unknown group ${g}`);
    if (bucketOf.has(g))
      errors.push(`buckets.yaml: group ${g} is in ${bucketOf.get(g)} and ${b.id}`);
    bucketOf.set(g, b.id);
  }
}
for (const [g, def] of Object.entries(map.groups)) {
  if (def.layer !== 'hidden' && !bucketOf.has(g))
    errors.push(`buckets.yaml: group ${g} has no bucket`);
}

// A guide belongs to at most one family; members keep their listed order.
const familyOf = new Map<string, { id: string; rank: number }>();
const join = (id: string, family: string, rank: number) => {
  if (familyOf.has(id))
    errors.push(`families.yaml: ${id} is in ${familyOf.get(id)!.id} and ${family}`);
  familyOf.set(id, { id: family, rank });
};
for (const f of familyDefs) {
  (f.members ?? []).forEach((id, i) => {
    if (!ids.has(id))
      errors.push(`families.yaml: ${f.id} lists ${id}, which is not in ig-map.yaml`);
    join(id, f.id, i + 1);
  });
  for (const p of f.prefixes ?? []) for (const id of ids) if (id.startsWith(p)) join(id, f.id, 0);
}

// Clinical domains, hand-assigned (data/domains.yaml); a guide can be in several.
const domainsOf = new Map<string, string[]>();
for (const dm of domainDefs) {
  for (const id of dm.members) {
    if (!ids.has(id) && !coreIds.has(id))
      errors.push(`domains.yaml: ${dm.id} lists ${id}, which is not in ig-map.yaml`);
    domainsOf.set(id, [...(domainsOf.get(id) ?? []), dm.id]);
  }
}

for (const g of map.guides) {
  const group = map.groups[g.group];
  if (!group) {
    errors.push(`ig-map.yaml: ${g.npm} has unknown group ${g.group}`);
    continue;
  }
  if (group.layer === 'hidden') continue; // legacy, non-FHIR, tooling, unofficial, withdrawn
  // The registry is the only source of guides: one it no longer lists drops out.
  const p = snap.packages[g.npm];
  if (!snap.registry[g.npm] || !p) {
    warnings.push(`${g.npm}: not in the registry snapshot, so not listed`);
    continue;
  }
  const note = notes[g.npm] ?? {};
  const parties = (g.parties ?? []).map((x) => PARTY[x]).filter(Boolean);
  const releases = releasesOf(g.npm, p);
  const name = note.name ?? cleanName(g.name);
  guides.push({
    id: g.npm,
    name,
    use: useOf(g, note),
    group: group.label,
    bucket: bucketOf.get(g.group) ?? '',
    family: familyOf.get(g.npm)?.id ?? null,
    familyRank: familyOf.get(g.npm)?.rank ?? 0,
    domains: domainsOf.get(g.npm) ?? [],
    parties,
    blurb: note.blurb ?? fallbackBlurb(p, name, group.label),
    curated: Boolean(note.blurb),
    start: typeof note.start === 'number' ? note.start : note.start ? 50 : 0,
    country: null,
    knownPublisher: KNOWN.test(g.npm),
    withdrawn: snap.registry[g.npm].withdrawn || releases.some((r) => r.status === 'withdrawn'),
    releases,
  });
}

// National and regional cores: every party builds to them, so they sit in the centre, the way
// US Core does in the US view. Their publishers are national HL7 affiliates and health
// authorities, so they count as known. The registry is the only source of guides, so a listed
// core it doesn't carry is skipped. Names and one-liners live in notes.yaml.
const foundation = map.groups['foundation'];
for (const n of national) {
  const e = snap.registry[n.ig];
  const p = snap.packages[n.ig];
  if (!e || !p) {
    warnings.push(`${n.ig} (${n.country}): not in the registry snapshot, so not listed`);
    continue;
  }
  const note = notes[n.ig] ?? {};
  const releases = releasesOf(n.ig, p);
  const name = note.name ?? cleanName(e.name.replace(/[®©]/g, ''));
  guides.push({
    id: n.ig,
    name,
    use: 'intl',
    group: foundation.label,
    bucket: bucketOf.get('foundation') ?? '',
    family: null,
    familyRank: 0,
    domains: domainsOf.get(n.ig) ?? [],
    parties: ['patient', 'provider', 'payer'],
    blurb: note.blurb ?? `${n.country}'s national FHIR profiles that its other guides build on.`,
    curated: Boolean(note.blurb),
    start: 0,
    country: n.country,
    knownPublisher: true,
    withdrawn: e.withdrawn || releases.some((r) => r.status === 'withdrawn'),
    releases,
  });
}

if (warnings.length) console.warn(warnings.join('\n'));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const out: Dataset = {
  generated: new Date().toISOString(),
  snapshot: snap.generated,
  families: familyDefs.map(({ id, label, blurb }) => ({ id, label, blurb })),
  buckets: bucketDefs.map(({ id, label }) => ({ id, label })),
  domains: domainDefs.map(({ id, label }) => ({ id, label })),
  guides,
};
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/guides.json', JSON.stringify(out));

console.log(`guides.json: ${guides.length} guides`);
for (const c of ['us', 'intl'] as const) {
  const scoped = applyScope(guides, DEFAULT_SCOPE, c);
  const counts = countByRegion(scoped);
  const curated = scoped.filter((g) => g.curated).length;
  console.log(
    `  ${c}: ${scoped.length} in default scope (${curated} with hand-written one-liners)`,
  );
  console.log('    ' + REGIONS.map((r) => `${r.label} ${counts[r.key]}`).join(' · '));
}
