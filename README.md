# FHIR Matchbook

**https://standfast-systems.github.io/fhir-matchbook/**

**Browsr, Mappr, Initializr. Discover, Connect, Build.** One app with three sections, each one usable on its own:

- **[FHIR Browsr](#fhir-browsr)** (`/browsr`): discover the implementation guides that apply to you, by Patient, Provider or Payer, and the FHIR resources they're built from.
- **[FHIR Mappr](#fhir-mappr)** (`/mappr`): describe what you're trying to do and see the guides, resources and patterns that fit.
- **[FHIR Initializr](#fhir-initializr)** (`/initializr`, BETA): get the exact guide versions and starter config for your project.

The home page (`/`) says what each section is for, then gives a newcomer five ideas to know first, what to read first, and where the FHIR community is. Its copy is a draft, checked against the FHIR R4 spec and US Core (the sources are noted in `src/app/landing/landing-page.html`).

Initializr came from [Standfast-Systems/fhir-initializr](https://github.com/Standfast-Systems/fhir-initializr) with its history; its last standalone release is tagged `initializr-v0.2.0` here.

## FHIR Browsr

A way into FHIR for people who are new to it: first the pieces, then the guides.

It opens on **FHIR Resources** (`/browsr/resources`), the building blocks every guide is made of: 24 resources a newcomer meets first, in six groups. Until one is picked, the card explains how the page works, with a made-up Example resource (`src/app/browsr/resource-example.ts`) showing each part of a card. Selecting one opens a card with one plain sentence, its key fields (with every field and the collapsed nested objects a click away), a trimmed official example, and links to the FHIR R4 spec. Each resource has an anchor by its type name (`/browsr/resources#ExplanationOfBenefit`). The names, groups and sentences live in `src/app/browsr/resources-content.ts`.

**Implementation Guides** (`/browsr/guides`) is the way into FHIR's implementation guides. Pick **Patient**, **Provider** or **Payer** on a three-circle diagram and get a table of the guides that side has to build to, with the overlaps you share with the other sides. Each guide gets one plain sentence, its maturity, and a link to its current published page.

It opens on the center of the diagram, the foundation every side shares, with US Core first.

Above the table, **Domain** (oncology, imaging, medications, ...) and **Program** (Da Vinci, CARIN, IHE, ...) dropdowns show every guide in that clinical area or program, across all regions. Only one applies at a time. The domain and program tags on each row are shortcuts for the same filter.

### The rule

A guide is tagged with **every party that has to build to it** (as client or server), not every party that benefits from it. Guides that span parties are the overlaps.

### Default scope

| Rule            | Default                                                                                                                                                                             | Toggle                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Published       | A release with status trial-use, normative, informative or `release` (HL7 Terminology, WHO and many IHE guides use `release`). Ballots, drafts, CI builds and 0.x versions are out. | Include ballots and drafts |
| FHIR R4         | The release targets R4 or R4B.                                                                                                                                                      | Include R5/R6              |
| Known publisher | HL7 International and its national affiliates, IHE, US federal agencies (ONC/ASTP, CDC, HRSA), WHO, and the national health authorities behind national core guides.                | —                          |
| Not withdrawn   | Always out.                                                                                                                                                                         | —                          |

The US view shows US-specific and universal guides. International shows guides meant strictly for use outside the US, including the national and regional core and base guides in `data/national-cores.yaml`. That's a hand-checked list, because the registry's own "National Base" tagging points at the wrong package for several countries. Those guides sit in the center of the diagram, the way US Core does in the US view, labelled with their country. A listed guide the registry doesn't carry is left out until it does.

Each guide links to the release its publisher marks current in `package-list.json`, when that release qualifies (published and R4 by default). Otherwise it links the newest release that does. Turning a toggle on only adds guides that had nothing to show; it never swaps a published link for a newer ballot.

## FHIR Mappr

You say what you're trying to do, and Mappr shows the guides and resources that do it and how they fit together, in plain words. It answers the question between the other two sections: Browsr shows what exists and who builds to it; Initializr gives the exact versions and config; Mappr goes from a task to the pieces.

**Lookup** (`/mappr/lookup`, also `?q=`) is the main page. It runs on rails first, then wider:

1. **Patterns:** the query is matched against the curated patterns. A good hit shows the pattern.
2. **Guides and resources:** if no pattern fits, it matches guides and FHIR resources directly, each with any pattern it belongs to.
3. **No good match:** below the threshold it says so, rather than show the nearest wrong result. "Didn't find it?" opens a pre-filled GitHub issue, which is how new phrasings get found.

Matching is client-side with no backend. Words come first (`src/core/mappr/lookup.ts`): each item's phrasings, title and one-liner, scored by how much of the query they cover, rare words weighing more, with stemming and one-typo tolerance. When the words find nothing, it tries meaning: the query is embedded in the browser with all-MiniLM-L6-v2 (Transformers.js, loaded from Hugging Face's CDN only then) and compared with vectors made from the same texts at build time (`npm run vectors` → `data/mappr/vectors.json`). The spec's acceptance tests are in `test/mappr.test.ts`.

**Patterns** (`/mappr/patterns#<id>`) is the hand-built library, by type: workflows (established ones and gaps), exchanges, data shapes, guide stacks and safeguards. Each pattern shows its stack in plain words (how it moves, what it carries, what it's built on), a walkthrough drawn from its data in the layout of the `learning/` diagrams (people and systems in lanes, steps in order, a one-line takeaway), the resources, why it's solid or what's thin, what to read first, and, where a workflow maps to an Initializr driver, **Open in Initializr** with that driver picked.

A **FHIR release control** (R4 · R4B · R5 · R6 preview) sits on both pages. R4 is the default; switching changes the spec links, flags resources R5 renamed or removed, shows each pattern's "In R5:" note, and limits the wider tier to guides published for that release.

Mappr is US only for now.

## FHIR Initializr

**Start a FHIR project with the implementation guides it needs: pinned, cited, ready to load.**

> **Under construction: v0.2.0, a pre-MVP preview.** The knowledge base is young and the outputs haven't been checked by implementers yet. Use it to explore, not to make compliance or architecture decisions. Corrections are welcome as [issues](https://github.com/Standfast-Systems/fhir-matchbook/issues).

Package tools (SUSHI, Firely Terminal, the FHIR Package Loader) resolve a dependency tree once you know the root IG and version. Nothing tells you which IGs you need in the first place, or which versions a regulation accepts on the date you have to comply. FHIR Initializr does that part, the way [start.spring.io](https://start.spring.io) sets up a Spring project.

Tell it **where** the project is (the US, a country, or nowhere in particular) and **what drives it** (ONC (g)(10), CMS-0057-F, HTI-4 prior authorization…). Where a regulation asks different things of each party, it asks **which side your system is on** (for CMS-0057-F: the payer's APIs, a provider system that calls them, or a member app). Then it asks whether you're building a **FHIR server, client or both** and the **target date**, and returns a scope manifest:

- **IG set:** every guide in scope with its accepted versions on that date, a recommended pin, the requirement strength (required, recommended or optional, never collapsed) and the citation for each.
- **Warnings,** split in two. _Needs action:_ conflicts between drivers (reported with both citations, never silently resolved), a version choice that doesn't qualify, a removed requirement, a driver without its side. _Heads-ups:_ versions that expire soon after your date, multi-version dependencies, FHIR-version mismatches, pins no Inferno suite can test yet, and versions a _proposed_ rule would require. Cards show the first in full and fold the second into one line.
- **Functional surface:** resources, interactions, search parameters and operations at SHALL/SHOULD, merged from each IG's own CapabilityStatements for your side of the exchange. Where a guide publishes none, it says "narrative only" instead of guessing.
- **Test plan:** the Inferno kits and suites that exercise the scope, and whether they support your pinned versions.
- **Files:** `package.json`, a `sushi-config.yaml` dependencies block, the HAPI JPA Starter `implementationguides` block, a draft CapabilityStatement, an Inferno plan, a Markdown report and the JSON manifest.
- **Links** to each IG's version-specific pages, CapabilityStatements, artifacts, Inferno kit and chat.fhir.org stream.

Every pick is yours to change on its card: click another version (accepted or not; the scope warns when it doesn't qualify), or remove a guide. Removed guides are listed under "Removed by you" with a Restore button, and the scope flags a removed requirement.

> Scoping guidance with citations, not a compliance determination.

### What's in the knowledge base (as of 2026-10-21)

| Driver                  | Covers                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ONC (g)(10)**         | 45 CFR 170.315(g)(10) with 170.215 versions and expiry dates, SVAP 2022–2026 (multi-cycle), the EDN2025.06 enforcement discretion through Feb 28, 2026                                                                                                                                                       |
| **ONC (g)(31)–(33)**    | HTI-4 electronic prior authorization (CRD, DTR, PAS, CDS Hooks, Subscriptions Backport), including the FY2027 IPPS rule's no-overlap switch to CRD 2.2.1 / DTR 2.2.0 / PAS 2.2.1 on Oct 1, 2026                                                                                                              |
| **CMS-0057-F**          | Patient Access, Provider Access, Payer-to-Payer, Prior Authorization and Provider Directory APIs; required 170.215 cross-references (still naming the expired US Core 3.1.1 / SMART 1.0.0), the 422.119(c)(4) updated-version flexibility, CMS's recommended IGs, and CMS-0062-P's versions as proposed-only |
| **TEFCA FHIR**          | Facilitated FHIR under QTF v2.1 and the Facilitated FHIR SOP v2.0: US Core 6.1.0 or higher (3.1.1 or higher before March 8, 2026), UDAP/SSRAA 1.1.0 (metadata now, full registration and authorization from Q1 2027), SMART scope syntax, and eCR 2.1.1 for public health pushes                             |
| **SMART app + US Core** | A non-regulatory sanity profile: the versions every certified server must still support                                                                                                                                                                                                                      |

**Where is the project?** Outside the US, Initializr adds the country's national base and core IGs: 21 countries are curated in [data/kb/realms.yaml](data/kb/realms.yaml), because the registry's "National Base" tag is unreliable (Germany's entry is the STU3 package, Japan's id doesn't exist on packages.fhir.org, France and Brazil aren't listed). Another 14 countries have nothing usable yet (R5-only, beta, or not on packages.fhir.org), and the tool says which; they, and projects with no particular country, get HL7's International Patient Access (IPA) and International Patient Summary (IPS) instead. US regulations are ignored outside the US, with a warning.

Plus the same classification of all **277 US and universal-realm guides** that Browsr uses ([data/ig-map.yaml](data/ig-map.yaml)), into foundation, workflow, capability, content and hidden layers, so you can add workflows and content packs by hand.

The project you're scoping lives in a signal store in memory, so a reload starts over; **Copy CLI command** gives you a command that reproduces it.

### CLI

Needs Node 24 (it runs TypeScript directly; no build step for the CLI).

```bash
node cli/initializr.ts scope --driver cms-0057-f@payer --as-of 2027-01-01
```

```bash
node cli/initializr.ts scope --driver onc-g10 --driver onc-epa --out ./scope
```

```bash
node cli/initializr.ts drivers
```

`--driver` takes `id@side:component+component`: the side for a driver that has sides, and optionally some of its components (e.g. `cms-0057-f@payer:prior-auth+provider-access`). `--pin hl7.fhir.us.core@6.1.0` uses that version, accepted or not; `--remove <package>` takes a guide out of the scope. `--format` picks one output (`report`, `package-json`, `sushi-config`, `hapi-yaml`, `capability-statement`, `inferno-plan`, `manifest`); `--out` writes them all.

### How it works

```
 Drivers KB (curated YAML, git)      packages.fhir.org + IG registry + package-list.json
          │                                   │  (snapshot at build time, committed)
          ▼                                   ▼
   Resolver (date-aware)   ◄──────────  Package manifests + CapabilityStatement surface
          │
          ▼
   Scope manifest (JSON) ──► emitters: report · package.json · sushi-config · HAPI yaml · CapabilityStatement · Inferno plan
```

- [data/kb/](data/kb/) is the hand-curated knowledge base: drivers, rules, version windows, citations, test kits. See [docs/kb.md](docs/kb.md).
- [src/core/initializr/](src/core/initializr/) is the resolver and emitters: pure TypeScript shared by the web app, the CLI and the tests.
- [src/app/initializr/](src/app/initializr/) is the Angular front end.

For each IG, every applicable rule contributes the versions it accepts on the target date (or on its in-force date, for obligations that start later). Required rules are intersected; an empty intersection is a conflict, reported with every citation and no pin. Recommended rules narrow the preference without shrinking what's accepted. The pin is the release the publisher marks current in its `package-list.json`, if that's still accepted, and otherwise the newest published R4 release left. Two exceptions, both shown on the card:

- a version you choose on the card wins, even outside the accepted versions (a warning says so, as an error if it's a requirement), so it also covers a version you already run;
- if other IGs in the set depend on an accepted version, Initializr pins that one so the project loads one version instead of two (US Core 7.0.0 rather than 9.0.0 for a CMS-0057-F payer, because PDex, CRD, DTR and PAS depend on 7.0.0).

Rules name the CapabilityStatements for the implementer's part in an IG; each statement's own `rest.mode` decides whether it lands on the "what you serve" or "what you call" side of the surface. This matters for CDS Hooks–based IGs: the EHR, which the CRD guide calls the "CRD Client", is the FHIR _server_.

**Dependency closure** reads each package's own `package.json` (FHIR package dependencies are exact versions), including the version-suffixed wrapper packages HL7 publishes for side-by-side installs (`hl7.fhir.us.core.v610`) and the `alias@npm:package` form. Named for and modeled on [Spring Initializr](https://github.com/spring-io/initializr): a metadata model, version ranges, and emitters as contributors, without its server. Not affiliated with the Spring project or Broadcom.

### Proof of done

Proof of done for each driver: generate the HAPI config, boot the server, load the IGs, run the named Inferno kit. HAPI servers booted from Initializr's unedited `application.yaml` load cleanly and expose every SHALL resource and search parameter in scope: ONC (g)(10) in 58 s (56/56 profiles, 0 gaps), and a 10-IG CMS-0057-F payer scope in 64 s (85/85 profiles, 116 SHALL search parameters, 0 gaps), checked by [scripts/prove-hapi.sh](scripts/prove-hapi.sh). The Inferno runs are still open. Details, and what the runs changed in the emitter, in [proof/README.md](proof/README.md).

## Data

Both sections build from the same files. Nothing is copied between them.

| File                                  | What it is                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/ig-map.yaml`                    | The 277 US and universal-realm guides, their group (and layer), and Browsr's `parties` tags. Hidden groups (legacy, non-FHIR, tooling, unofficial, withdrawn) are dropped.                                                                                                                                                                    |
| `data/notes.yaml`                     | Hand-written display names and one-liners, plus Browsr's `start` ranks for the good first guides. This is the curation file; Initializr shows the same names and one-liners (a curated `short` name in `data/kb/igs.yaml` wins there).                                                                                                        |
| `data/families.yaml`                  | Program families (Da Vinci, CARIN, SMART, IHE, ...): the chip label, the one-line header used when the table is grouped by family, and members in reading order.                                                                                                                                                                              |
| `data/domains.yaml`                   | The 12 clinical domains and the guides in each, hand-assigned (a guide can be in several; most are in none). Transcribed from `matchbook-domain-tags.md`, the product decision.                                                                                                                                                               |
| `data/national-cores.yaml`            | The hand-checked national and regional core guides for Browsr's International view, with their country labels.                                                                                                                                                                                                                                |
| `data/buckets.yaml`                   | The "What are you working on?" chips shown with Provider-only selected. Every ig-map group sits in exactly one bucket.                                                                                                                                                                                                                        |
| `src/app/browsr/resources-content.ts` | The FHIR Resources page: six groups and their 24 resources, with one sentence each.                                                                                                                                                                                                                                                           |
| `data/fhir-resources.json`            | Each resource's fields (from its FHIR R4 definition), which ones are key, and its official R4 example. Generated by `npm run resources`; the key fields are picked in `scripts/resources.ts`.                                                                                                                                                 |
| `data/fhir-resources-r5.json`         | The same from the FHIR R5 spec, for the R5 and R6 (preview) cards, by `npm run resources -- R5`. R5's notes and "How it relates" summaries are in `src/app/browsr/resources-content-r5.ts`. R4B shows R4's cards (see below).                                                                                                                 |
| `data/kb/`                            | Initializr's knowledge base: drivers, realms, sources, test kits, short names and chat streams. See [docs/kb.md](docs/kb.md).                                                                                                                                                                                                                 |
| `data/mappr/patterns/*.yaml`          | Mappr's patterns: type, stack (by package id), resources (by R4 name), the walkthrough's lanes and steps, why it's solid or what's thin, read-first pages, an optional Initializr driver, and the `phrasings:` the lookup searches. Every claim is checked against the guide's own pages or the rule before it ships.                         |
| `data/mappr/wider.yaml`               | Extra phrasings for the lookup's wider tier, by guide package id or resource name.                                                                                                                                                                                                                                                            |
| `data/mappr/vectors.json`             | The lookup's meaning-based vectors, one per searched text, made by `npm run vectors` (the build fails when they're stale).                                                                                                                                                                                                                    |
| `snapshot/registry.json`              | The registry snapshot both sections build from: the official FHIR IG registry's index, each listed guide's releases from its own `package-list.json` (status, date, FHIR version, page; guides with none fall back to the editions the registry lists), and for Initializr the versions on packages.fhir.org with their dependency manifests. |
| `snapshot/packages/`                  | Profiles and CapabilityStatement surfaces for the package versions Initializr reads in depth.                                                                                                                                                                                                                                                 |

`npm run data` builds `public/data/`: Browsr's `guides.json` and `fhir-resources.json`, and Initializr's `kb.json`, `registry.json`, `pkg/` and `index.json`. Browsr's build fails on a note for an unknown guide, and skips (with a warning) any guide the registry no longer lists: the registry is the only source of guides. Initializr's validates the KB against the snapshot and refuses to build on errors. There is no backend, so that JSON is also there for any other client.

### Keeping it current

```bash
npm run snapshot
```

```bash
npm run links
```

```bash
npm run resources
```

- `npm run snapshot` re-reads the IG registry, packages.fhir.org and each guide's `package-list.json`, and each package's own manifest and CapabilityStatements. `npm run links` re-checks every link the snapshot holds. `npm run resources` refreshes `data/fhir-resources.json` from the FHIR R4 spec, and `npm run resources -- R5` refreshes `data/fhir-resources-r5.json` from R5. R4B shows R4's cards: `data/r4b-differences.json` lists where its elements differ, and `npm run resources -- R4B` fails when the spec no longer matches that list (`--write` rewrites it).
- The data is refreshed by hand. A manual workflow ([.github/workflows/refresh.yml](.github/workflows/refresh.yml)) runs the snapshot and the link check and opens a PR listing new versions of the guides the KB cites; a curator decides whether a regulation, SVAP list or agency page accepts them. To open that PR it needs Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".
- Initializr's KB carries an as-of date, every source a `checked` date, and every version window its own `from`/`expires` dates. Review it at least quarterly against new regulations, approved-version lists and IG releases.

## Develop

Needs Node 24.

```bash
npm ci
```

```bash
npm start
```

```bash
npm run test:core
```

```bash
npm run typecheck
```

`npm start` builds the data and serves at http://localhost:4200. `npm run test:core` covers Browsr's scope rules, sorting, diagram geometry and resource data, and Initializr's resolver, emitters and KB.

The app is Angular with signals. Browsr and the home page use no UI library; Initializr uses Angular Material, with its theme in `src/app/initializr/_theme.scss` and its icon font self-hosted (`npm run icons`). `src/core/browsr` and `src/core/initializr` are plain TypeScript, shared by the build scripts, the CLI, the tests and the browser. Browsr's view state (US/International, selected regions, toggles, search, sort, page) lives in a signal-based store, `src/app/browsr/view-store.ts`; it is held in memory, so a reload starts from the default view, and moving between Browsr's two pages keeps it.

Each section is a lazy-loaded Angular route (`src/app/routes.ts`), so Initializr's code only loads on `/initializr`. GitHub Pages has no fallback for single-page apps, so after the build `scripts/pages.ts` writes a copy of `index.html` for each section page (so those URLs load directly, each with its own link-preview tags) and `404.html`. `public/og-image.png` is the link-preview card, drawn by `npm run og-image` (`scripts/og-image.ts`).

## Status

FHIR Matchbook 2.0.0 (2026-10-28) brings Browsr (last standalone release v1.4.4) and Initializr (v0.2.0) together as one app. Open items:

- **Mappr's library beyond the MVP.** Five workflows and one contrast so far; the other established workflows and gaps in the spec, and the other four types, grow from here. Phrasings get Chris's review.
- **Home page copy.** A draft, to be replaced by the review thread's wording.
- **Keeping the data in sync.** Snapshot refreshes are by hand for now (`npm run snapshot`, or the manual refresh workflow); a schedule may come back later.
- **Links between guides and resources, both ways.** Every resource keeps an anchor by its type name (`/browsr/resources#ExplanationOfBenefit`) for this.
- **Trademark wording.** Once HL7 grants permission for the name, change the footers and the license line to HL7's attribution: "FHIR® is the registered trademark of HL7 and is used with the permission of HL7."
- **One rule for names and national cores.** Browsr and Initializr still differ on a few guide names and on some countries' core guides (Initializr's list checks out better).
- **Inferno proof runs.** The second half of Initializr's [proof of done](#proof-of-done): run each driver's named Inferno kit against the HAPI servers. It needs a working Docker.
- **KB review.** The first quarterly review of Initializr's sources, approved-version lists and IG releases is due by January 2027 (KB as of 2026-10-21).
- **More drivers:** for example state Medicaid, VA Lighthouse, CDC/NHSN reporting and CMS digital quality.
- **Other countries' guides.** Outside the US only the national foundation is added; the 160 other-country guides in the IG registry aren't classified yet.
- **An MCP server**, so agents can call Initializr's resolver like any other client of the published JSON.
- **At Initializr's MVP:** trim the remaining "under construction" notices (banner and footer).

## Versioning

[Semantic versioning](https://semver.org). The app's version lives in `package.json` and releases are tagged `vX.Y.Z`. Initializr keeps its own 0.x line until it reaches an MVP: `initializrVersion` in `package.json` (a test keeps its stamp in step), shown in its header and footer and in every file it generates, with releases tagged `initializr-vX.Y.Z`. A release is bumped on its branch, merged to `main` by PR, then tagged on the merge commit with a GitHub release and notes.

## License

Apache 2.0 ([LICENSE](LICENSE)). FHIR® is the registered trademark of HL7. This project isn't affiliated with or endorsed by HL7, ONC or CMS.

A free tool by [Standfast Systems](https://standfastsystems.com).
