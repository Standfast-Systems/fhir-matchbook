import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCOPE,
  DEFAULT_VIEW,
  addedBy,
  applyScope,
  countBy,
  inFocus,
  isPublished,
  matches,
  paginate,
  pickRelease,
  regionOf,
  sortGuides,
} from '../src/core/scope.ts';
import { inside, vennLayout } from '../src/core/venn.ts';
import type { Guide, Release } from '../src/core/types.ts';

const rel = (version: string, status: string | null, fhir: Release['fhir'] = ['R4']): Release => ({
  version,
  status,
  fhir,
  url: `https://example.org/${version}`,
  label: `v${version}`,
});

const guide = (over: Partial<Guide> = {}): Guide => ({
  id: 'x',
  name: 'X',
  use: 'generic',
  bucket: 'b',
  family: null,
  familyRank: 0,
  domains: [],
  group: 'g',
  parties: ['provider'],
  blurb: '',
  curated: false,
  start: 0,
  country: null,
  knownPublisher: true,
  withdrawn: false,
  releases: [],
  ...over,
});

test('published means a real release status, not 0.x, not a -ballot version', () => {
  assert.equal(isPublished(rel('1.0.0', 'trial-use')), true);
  assert.equal(isPublished(rel('7.4.0', 'release')), true);
  assert.equal(isPublished(rel('1.0.0', 'ballot')), false);
  assert.equal(isPublished(rel('1.0.0-ballot', 'trial-use')), false);
  assert.equal(isPublished(rel('0.2.0', 'trial-use')), false);
  assert.equal(isPublished(rel('1.0.0', 'unlisted')), false);
  // No package-list.json: a plain npm release counts.
  assert.equal(isPublished(rel('1.0.0', null)), true);
});

test('a published R4 release beats a newer ballot even with drafts on', () => {
  const g = guide({ releases: [rel('4.0.0-ballot', 'ballot'), rel('3.0.0', 'trial-use')] });
  assert.equal(pickRelease(g, DEFAULT_SCOPE)?.version, '3.0.0');
  assert.equal(pickRelease(g, { ...DEFAULT_SCOPE, drafts: true })?.version, '3.0.0');
});

test("the publisher's current release wins when it qualifies, else the next best", () => {
  const current = (r: Release) => ({ ...r, current: true });
  const marked = guide({
    releases: [
      rel('2.1.0', 'trial-use'),
      current(rel('2.0.0', 'trial-use')),
      rel('1.0.0', 'trial-use'),
    ],
  });
  assert.equal(pickRelease(marked, DEFAULT_SCOPE)?.version, '2.0.0');
  // A ballot marked current doesn't qualify: the newest published R4 release is used instead.
  const ballot = guide({
    releases: [current(rel('7.0.0-ballot', 'ballot')), rel('6.0.0', 'trial-use')],
  });
  assert.equal(pickRelease(ballot, DEFAULT_SCOPE)?.version, '6.0.0');
  // So is an R5 edition marked current.
  const r5 = guide({
    releases: [current(rel('7.4.0', 'release', ['R5'])), rel('5.5.0', 'release')],
  });
  assert.equal(pickRelease(r5, DEFAULT_SCOPE)?.version, '5.5.0');
});

test('toggles bring in ballot-only and R5-only guides', () => {
  const ballot = guide({ releases: [rel('1.0.0-ballot', 'ballot')] });
  const r5 = guide({ releases: [rel('1.0.0', 'trial-use', ['R5'])] });
  assert.equal(pickRelease(ballot, DEFAULT_SCOPE), null);
  assert.equal(pickRelease(ballot, { ...DEFAULT_SCOPE, drafts: true })?.version, '1.0.0-ballot');
  assert.equal(pickRelease(r5, DEFAULT_SCOPE), null);
  assert.equal(pickRelease(r5, { ...DEFAULT_SCOPE, r5: true })?.version, '1.0.0');
});

test('R4B counts as R4; R3 never counts', () => {
  assert.ok(pickRelease(guide({ releases: [rel('1.1.0', 'trial-use', ['R4B'])] }), DEFAULT_SCOPE));
  const r3 = guide({ releases: [rel('1.0.0', 'trial-use', ['R3'])] });
  assert.equal(pickRelease(r3, { drafts: true, r5: true }), null);
});

test('withdrawn guides and unknown publishers always drop out', () => {
  const ok = [rel('1.0.0', 'trial-use')];
  const guides = [
    guide({ id: 'a', releases: ok }),
    guide({ id: 'b', releases: ok, withdrawn: true }),
    guide({ id: 'c', releases: ok, knownPublisher: false }),
  ];
  assert.deepEqual(
    applyScope(guides, DEFAULT_SCOPE, 'us').map((g) => g.id),
    ['a'],
  );
  const all = applyScope(guides, { drafts: true, r5: true }, 'us');
  assert.deepEqual(
    all.map((g) => g.id),
    ['a'],
  );
});

test('US shows US and generic guides; International shows only non-US ones', () => {
  const ok = [rel('1.0.0', 'trial-use')];
  const guides = [
    guide({ id: 'us', use: 'us', releases: ok }),
    guide({ id: 'generic', use: 'generic', releases: ok }),
    guide({ id: 'intl', use: 'intl', releases: ok }),
  ];
  assert.deepEqual(
    applyScope(guides, DEFAULT_SCOPE, 'us').map((g) => g.id),
    ['us', 'generic'],
  );
  assert.deepEqual(
    applyScope(guides, DEFAULT_SCOPE, 'intl').map((g) => g.id),
    ['intl'],
  );
});

test('regions', () => {
  assert.equal(regionOf(['patient', 'provider', 'payer']), 'all');
  assert.equal(regionOf(['payer', 'provider']), 'pr-py');
  assert.equal(regionOf(['patient']), 'pt');
  assert.equal(regionOf([]), 'none');
});

test('start-here guides sort first', () => {
  const ok = [rel('1.0.0', 'trial-use')];
  const scoped = applyScope(
    [
      guide({ id: 'a', name: 'Alpha', releases: ok }),
      guide({ id: 'z', name: 'Zulu', releases: ok, start: 1 }),
      guide({ id: 's', name: 'Sierra', releases: ok, start: 2 }),
    ],
    DEFAULT_SCOPE,
    'us',
  );
  assert.deepEqual(
    sortGuides(scoped, 'start').map((g) => g.id),
    ['z', 's', 'a'],
  );
  assert.deepEqual(
    sortGuides(scoped, 'name').map((g) => g.id),
    ['a', 's', 'z'],
  );
});

test('group by family keeps reading order and puts loners last', () => {
  const ok = [rel('1.0.0', 'trial-use')];
  const scoped = applyScope(
    [
      guide({ id: 'bulk', name: 'Bulk Data', releases: ok }),
      guide({ id: 'pas', name: 'PAS', releases: ok, family: 'davinci', familyRank: 3 }),
      guide({ id: 'mhd', name: 'MHD', releases: ok, family: 'ihe' }),
      guide({ id: 'crd', name: 'CRD', releases: ok, family: 'davinci', familyRank: 1 }),
      guide({ id: 'core', name: 'US Core', releases: ok, start: 1 }),
      guide({ id: 'dtr', name: 'DTR', releases: ok, family: 'davinci', familyRank: 2 }),
    ],
    DEFAULT_SCOPE,
    'us',
  );
  assert.deepEqual(
    sortGuides(scoped, 'family', ['davinci', 'ihe']).map((g) => g.id),
    ['crd', 'dtr', 'pas', 'mhd', 'core', 'bulk'],
  );
});

test('search matches word starts in name, one-liner and group, not package ids', () => {
  const g = guide({
    id: 'hl7.fhir.us.davinci-dtr',
    name: 'Da Vinci Documentation Templates (DTR)',
    blurb: "Fills in the payer's documentation questionnaire inside the EHR.",
    group: 'Coverage & prior authorization',
  });
  assert.ok(matches(g, 'prior auth'));
  assert.ok(matches(g, 'DTR'));
  assert.ok(matches(g, 'questionn'));
  assert.ok(matches(g, ''));
  assert.ok(!matches(g, 'us'), 'the .us. in the package id is not searched');
  assert.ok(!matches(g, 'emplates'), 'matches the start of words only');
  assert.ok(!matches(g, 'prior payment'), 'every word has to match');
  const core = guide({ name: 'US Core', blurb: 'The baseline US profiles, used everywhere.' });
  assert.ok(matches(core, 'US'));
  assert.ok(
    !matches(guide({ name: 'X', blurb: 'Widely used.' }), 'us'),
    'short words match whole words',
  );
});

test('national cores sort by country, after start-here guides', () => {
  const ok = [rel('1.0.0', 'trial-use')];
  const scoped = applyScope(
    [
      guide({ id: 'uk', name: 'UK Core', use: 'intl', country: 'UK', releases: ok }),
      guide({ id: 'other', name: 'Another guide', use: 'intl', releases: ok }),
      guide({ id: 'at', name: 'Austrian Core', use: 'intl', country: 'AT', releases: ok }),
      guide({ id: 'ipa', name: 'IPA', use: 'intl', start: 1, releases: ok }),
      guide({ id: 'au', name: 'AU Core', use: 'intl', country: 'AU', releases: ok }),
    ],
    DEFAULT_SCOPE,
    'intl',
  );
  assert.deepEqual(
    sortGuides(scoped, 'start').map((g) => g.id),
    ['ipa', 'at', 'au', 'uk', 'other'],
  );
});

test('what a toggle added goes by the linked release', () => {
  const both = { drafts: true, r5: true };
  const [published, ballot, r5, draftR5] = applyScope(
    [
      guide({ id: 'p', releases: [rel('2.0.0-ballot', 'ballot'), rel('1.0.0', 'trial-use')] }),
      guide({ id: 'b', releases: [rel('1.0.0-ballot', 'ballot')] }),
      guide({ id: 'r', releases: [rel('1.0.0', 'trial-use', ['R5'])] }),
      guide({ id: 'd', releases: [rel('0.1.0', 'draft', ['R5'])] }),
    ],
    both,
    'us',
  );
  assert.deepEqual(addedBy(published), { drafts: false, r5: false });
  assert.deepEqual(addedBy(ballot), { drafts: true, r5: false });
  assert.deepEqual(addedBy(r5), { drafts: false, r5: true });
  assert.deepEqual(addedBy(draftR5), { drafts: true, r5: true });
});

test('domain and program picks combine, across regions', () => {
  const pacio = guide({ family: 'pacio', domains: ['post-acute'], parties: ['provider'] });
  const loner = guide({ domains: ['post-acute', 'infectious'], parties: ['patient', 'provider'] });
  const mcode = guide({ family: 'codex', domains: ['oncology'] });
  assert.ok(inFocus(pacio, 'pacio', null));
  assert.ok(inFocus(loner, null, 'post-acute'));
  assert.ok(inFocus(pacio, 'pacio', 'post-acute'));
  assert.ok(!inFocus(loner, 'pacio', 'post-acute'), 'both picks apply');
  assert.ok(!inFocus(mcode, 'pacio', null));
  const n = countBy([pacio, loner, mcode], (g) => g.domains);
  assert.deepEqual(Object.fromEntries(n), { 'post-acute': 2, infectious: 1, oncology: 1 });
});

test('paginate clamps the page', () => {
  const p = paginate([1, 2, 3, 4, 5], 9, 2);
  assert.deepEqual([p.page, p.pages, p.from, p.to, p.items], [3, 3, 5, 5, [5]]);
  assert.deepEqual(paginate([], 1, 10).from, 0);
});

test('the default view is US, starting on the centre', () => {
  assert.equal(DEFAULT_VIEW.country, 'us');
  assert.deepEqual(DEFAULT_VIEW.regions, ['all']);
  assert.deepEqual(DEFAULT_VIEW.scope, DEFAULT_SCOPE);
});

test('the Other circle stands apart from the three party circles', () => {
  const { circles, other } = vennLayout();
  for (const c of circles) {
    assert.ok(Math.hypot(c.x - other.x, c.y - other.y) > c.r + other.r + 20, c.party);
  }
});

test('every Venn label sits inside its own region', () => {
  const { circles, regions } = vennLayout();
  const want: Record<string, string[]> = {
    all: ['patient', 'provider', 'payer'],
    'pt-pr': ['patient', 'provider'],
    'pr-py': ['provider', 'payer'],
    'pt-py': ['patient', 'payer'],
    pt: ['patient'],
    pr: ['provider'],
    py: ['payer'],
  };
  for (const r of regions) {
    const got = circles.filter((c) => inside(c, r.label)).map((c) => c.party);
    assert.deepEqual(got.sort(), [...want[r.key]].sort(), r.key);
    assert.match(r.path, /^M [-\d.]+ [-\d.]+ (A [^A]+){3}Z$/);
  }
});
