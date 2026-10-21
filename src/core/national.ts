// National and regional core guides come from a hand-checked list (data/national-cores.yaml), not
// from the registry's own "National Base" tagging, which points at the wrong package for several
// countries. The registry still decides whether a listed guide exists for Matchbook.

/** The part of an official registry entry (fhir-ig-list.json) Matchbook keeps. */
export interface RegistryEntry {
  npm: string;
  name: string;
  category: string;
  /** Lowercase country or region code from the registry: au, ch, gb, eu, ... */
  country: string;
  withdrawn: boolean;
}

/** One row of data/national-cores.yaml. */
export interface NationalCore {
  /** The label the row shows and sorts by: AT, AU, EU, UK, ... */
  country: string;
  /** npm package id. */
  ig: string;
}
