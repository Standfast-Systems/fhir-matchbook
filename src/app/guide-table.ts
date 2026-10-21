import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { paginate, type ScopedGuide, type SortKey } from '../core/scope';
import { PARTIES, type Domain, type Family, type Party } from '../core/types';

const PAGE_SIZE = 12;
const STATUS: Record<string, { text: string; tone: 'good' | 'ok' | 'warn' | 'plain' }> = {
  normative: { text: 'Normative', tone: 'good' },
  'normative+trial-use': { text: 'Normative + trial use', tone: 'good' },
  'trial-use': { text: 'Trial use', tone: 'ok' },
  informative: { text: 'Informative', tone: 'plain' },
  release: { text: 'Release', tone: 'ok' },
  update: { text: 'Update', tone: 'ok' },
  corrected: { text: 'Corrected', tone: 'ok' },
  ballot: { text: 'Ballot', tone: 'warn' },
  draft: { text: 'Draft', tone: 'warn' },
  preview: { text: 'Preview', tone: 'warn' },
  'qa-preview': { text: 'Preview', tone: 'warn' },
  unlisted: { text: 'Unlisted', tone: 'warn' },
};
const PARTY_NAME: Record<Party, string> = {
  patient: 'Patient',
  provider: 'Provider',
  payer: 'Payer',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'app-guide-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view().total) {
      <table>
        <thead>
          <tr>
            <th scope="col">Guide</th>
            <th scope="col">Who builds to it</th>
            <th scope="col">Maturity</th>
            <th scope="col">Published</th>
            <th scope="col"><span class="visually-hidden">Links</span></th>
          </tr>
        </thead>
        <tbody>
          @for (g of view().items; track g.id) {
            @if (
              sort() === 'family' && ($index === 0 || view().items[$index - 1].family !== g.family)
            ) {
              <tr class="group">
                <th colspan="5" scope="colgroup">
                  @if (g.family && families().get(g.family); as f) {
                    <span class="fam">{{ f.label }}</span>
                    <span class="fam-blurb">— {{ f.blurb }}</span>
                  } @else {
                    <span class="fam">Other guides</span>
                  }
                </th>
              </tr>
            }
            <tr>
              <td class="guide">
                <div class="title">
                  <a [href]="g.release.url" target="_blank" rel="noopener">{{ g.name }}</a>
                  @if (g.start) {
                    <span class="tag start">Start here</span>
                  }
                  @if (g.country) {
                    <span class="tag country">{{ g.country }}</span>
                  }
                  @if (g.use === 'generic') {
                    <span class="tag" title="Not US-specific: used in the US and elsewhere"
                      >universal</span
                    >
                  }
                  <!-- Program and domain tags are shortcuts for the dropdowns: click to show all of it. -->
                  @if (g.family && families().get(g.family); as f) {
                    <button
                      type="button"
                      class="tag family"
                      [attr.title]="'Show all ' + f.label + ' guides'"
                      (click)="familyChange.emit(f.id)"
                    >
                      <svg class="funnel" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M2 3h12l-4.6 5.4V13l-2.8 1.4V8.4z" /></svg
                      >{{ f.label }}
                    </button>
                  }
                  @for (id of g.domains; track id) {
                    @if (domains().get(id); as d) {
                      <button
                        type="button"
                        class="tag domain"
                        [attr.title]="'Show all ' + d.label + ' guides'"
                        (click)="domainChange.emit(d.id)"
                      >
                        <svg class="funnel" viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M2 3h12l-4.6 5.4V13l-2.8 1.4V8.4z" /></svg
                        >{{ d.label }}
                      </button>
                    }
                  }
                </div>
                <div class="blurb">{{ g.blurb }}</div>
              </td>
              <td class="parties">
                @for (p of parties; track p) {
                  <span
                    class="dot"
                    [class]="p"
                    [class.off]="!g.parties.includes(p)"
                    [attr.title]="partyName[p]"
                  ></span>
                }
                <span class="party-text">{{ partyText(g) }}</span>
              </td>
              <td class="maturity">
                <span class="label">{{ g.release.label }}</span>
                <span class="status" [class]="status(g).tone">{{ status(g).text }}</span>
                @if (!isR4(g)) {
                  <span class="status warn">{{ g.release.fhir.join('/') }}</span>
                }
              </td>
              <td class="date">{{ month(g.release.date) }}</td>
              <td class="links">
                <a [href]="g.release.url" target="_blank" rel="noopener">Official page ↗</a>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <nav class="pager" aria-label="Pages">
        <span class="range">{{ view().from }}–{{ view().to }} of {{ view().total }}</span>
        @if (view().pages > 1) {
          <span class="pages">
            <button
              type="button"
              [disabled]="view().page === 1"
              (click)="pageChange.emit(view().page - 1)"
              aria-label="Previous page"
            >
              ‹
            </button>
            @for (p of pageList(); track $index) {
              @if (p === 0) {
                <span class="gap">…</span>
              } @else {
                <button
                  type="button"
                  [class.on]="p === view().page"
                  [attr.aria-current]="p === view().page ? 'page' : null"
                  (click)="pageChange.emit(p)"
                >
                  {{ p }}
                </button>
              }
            }
            <button
              type="button"
              [disabled]="view().page === view().pages"
              (click)="pageChange.emit(view().page + 1)"
              aria-label="Next page"
            >
              ›
            </button>
          </span>
        }
      </nav>
    } @else {
      <p class="empty"><ng-content /></p>
    }
  `,
  styleUrl: './guide-table.scss',
})
export class GuideTable {
  readonly rows = input.required<ScopedGuide[]>();
  readonly page = input.required<number>();
  readonly sort = input.required<SortKey>();
  readonly pageChange = output<number>();
  readonly families = input<ReadonlyMap<string, Family>>(new Map());
  /** A row's family chip was clicked: show that whole family. */
  readonly familyChange = output<string>();
  readonly domains = input<ReadonlyMap<string, Domain>>(new Map());
  /** A row's domain tag was clicked: show every guide in that domain. */
  readonly domainChange = output<string>();

  protected readonly parties = PARTIES;
  protected readonly partyName = PARTY_NAME;
  protected readonly view = computed(() => paginate(this.rows(), this.page(), PAGE_SIZE));

  /** Page numbers with 0 standing in for a gap: 1 … 4 5 6 … 10 */
  protected readonly pageList = computed(() => {
    const { page, pages } = this.view();
    const want = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
    const out: number[] = [];
    for (const p of [...want].sort((a, b) => a - b)) {
      if (out.length && p - out[out.length - 1] > 1) out.push(0);
      out.push(p);
    }
    return out;
  });

  protected status(g: ScopedGuide) {
    const s = g.release.status;
    return s === null
      ? { text: 'Published', tone: 'ok' }
      : (STATUS[s] ?? { text: s, tone: 'plain' });
  }

  protected isR4(g: ScopedGuide): boolean {
    return g.release.fhir.some((f) => f === 'R4' || f === 'R4B');
  }

  protected partyText(g: ScopedGuide): string {
    if (!g.parties.length) return 'Other';
    if (g.parties.length === 3) return 'Everyone';
    return g.parties.map((p) => PARTY_NAME[p]).join(' + ');
  }

  protected month(date?: string): string {
    const m = /^(\d{4})-(\d{2})/.exec(date ?? '');
    // Publishers without a version list publish no date; say so rather than leave a dash.
    return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : 'date not published';
  }
}
