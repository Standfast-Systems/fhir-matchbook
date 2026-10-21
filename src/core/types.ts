export type Party = 'patient' | 'provider' | 'payer';
export const PARTIES: readonly Party[] = ['patient', 'provider', 'payer'];

export type Use = 'us' | 'generic' | 'intl';

/** The US/International switch. */
export type Country = 'us' | 'intl';

export type Fhir = 'R2' | 'R3' | 'R4' | 'R4B' | 'R5' | 'R6' | 'other';

/** One release of a guide, newest first in Guide.releases. */
export interface Release {
  version: string;
  /**
   * package-list.json status (trial-use, normative, release, ballot, ...). `null` when the guide has
   * no package-list.json at all; `unlisted` when it has one but this version isn't in it.
   */
  status: string | null;
  fhir: Fhir[];
  date?: string;
  /** Official page for this exact version. */
  url: string;
  /** Short maturity label, e.g. "STU 2.2" or "v1.0.0". */
  label: string;
  /** The publisher marks this the current release in its package-list.json. */
  current?: boolean;
}

export interface Guide {
  id: string;
  name: string;
  /**
   * Where the guide applies: US-specific, generic (universal realm, used in the US and elsewhere),
   * or strictly outside the US (WHO programs, IPA, international editions of US guides).
   */
  use: Use;
  group: string;
  /** "What are you working on?" bucket id (data/buckets.yaml). */
  bucket: string;
  /** Program family id (data/families.yaml), or null when the guide isn't in one. */
  family: string | null;
  /** Reading order inside the family; 0 for prefix families, which sort by name. */
  familyRank: number;
  /** Clinical domain ids (data/domains.yaml); most guides have none. */
  domains: string[];
  parties: Party[];
  blurb: string;
  /** True when the one-liner is hand-written; false when it falls back to the registry text. */
  curated: boolean;
  /** Good-first-guide rank for newcomers (1 sorts first); 0 when it isn't one. */
  start: number;
  /** Country or region label (AU, CH, UK, EU, ...) for national and regional cores; else null. */
  country: string | null;
  knownPublisher: boolean;
  withdrawn: boolean;
  releases: Release[];
}

export interface Family {
  id: string;
  label: string;
  /** One line that explains the family: its header when the table is grouped. */
  blurb: string;
}

/** A clinical domain: the clinical area a guide's content is about. */
export interface Domain {
  id: string;
  label: string;
}

export interface Bucket {
  id: string;
  label: string;
}

export interface Dataset {
  generated: string;
  snapshot: string;
  /** In display order. */
  families: Family[];
  /** In display order. */
  buckets: Bucket[];
  domains: Domain[];
  guides: Guide[];
}

export interface ScopeOptions {
  /** Include ballots, drafts and 0.x releases. */
  drafts: boolean;
  /** Include R5 and R6 releases. */
  r5: boolean;
}
