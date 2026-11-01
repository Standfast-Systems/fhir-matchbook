import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { EMITTERS, TOOL } from '../../core/initializr/index.ts';
import { ProfilePanel } from './profile-panel';
import { Results } from './results';
import { DataStore } from './data-store';
import { ProfileStore } from './profile-store';
import { FEEDBACK_URL, REPO_URL } from '../repo';
import { ReleaseStore } from '../release-store';
import { download, zip } from './zip';

/** The Initializr section: pick drivers, get the guides, download the files. */
@Component({
  selector: 'fi-initializr-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    ProfilePanel,
    Results,
  ],
  templateUrl: './initializr-page.html',
  styleUrl: './initializr-page.scss',
})
export class InitializrPage {
  protected readonly store = inject(ProfileStore);
  protected readonly data = inject(DataStore);
  private readonly snack = inject(MatSnackBar);
  protected readonly repo = REPO_URL;
  /** The feedback form, or GitHub issues until there is one. */
  protected readonly feedback = FEEDBACK_URL ?? `${REPO_URL}/issues`;
  protected readonly tool = TOOL;
  /** The FHIR release from the shared header; Initializr only says it builds R4. */
  protected readonly release = inject(ReleaseStore).release;

  constructor() {
    // A link in can pick drivers, as the CLI writes them: /initializr?driver=cms-0057-f@payer
    // (from a Mappr workflow). They're picked once the knowledge base loads, the way a click would
    // pick them; then the address goes back to the plain page.
    const wanted = inject(ActivatedRoute).snapshot.queryParamMap.getAll('driver');
    if (wanted.length) {
      const once = effect(() => {
        const kb = this.data.kb();
        if (!kb || !this.store.profile()) return;
        untracked(() => {
          for (const w of wanted) {
            const [id, side] = w.split('@');
            if (!this.store.drivers().some((d) => d.id === id)) continue;
            this.store.setDriver(id, true);
            if (side) this.store.setSide(id, side);
          }
        });
        const url = new URL(location.href);
        url.searchParams.delete('driver');
        history.replaceState(history.state, '', url);
        once.destroy();
      });
    }
  }

  protected readonly cli = computed(() => {
    const p = this.store.profile();
    if (!p) return '';
    const parts = ['node cli/initializr.ts scope'];
    if (p.realm !== 'us') parts.push(`--realm ${p.realm}`);
    for (const d of p.drivers)
      parts.push(
        `--driver ${d.id}${d.side ? '@' + d.side : ''}${d.components?.length ? ':' + d.components.join('+') : ''}`,
      );
    parts.push(`--as-of ${p.asOf}`);
    for (const a of p.actors) parts.push(`--actor ${a}`);
    for (const e of p.extras ?? []) parts.push(`--extra ${e}`);
    for (const [k, v] of Object.entries(p.pins ?? {})) parts.push(`--pin ${k}@${v}`);
    for (const r of p.removed ?? []) parts.push(`--remove ${r}`);
    if (p.projectName) parts.push(`--name "${p.projectName.replace(/"/g, '')}"`);
    return parts.join(' ');
  });

  protected downloadAll() {
    const m = this.store.manifest();
    const reg = this.data.registry();
    if (!m || !reg) return;
    const slug =
      (m.profile.projectName || 'fhir-scope')
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, '-')
        .replace(/^-|-$/g, '') || 'fhir-scope';
    const files = EMITTERS.map((e) => ({ name: `${slug}/${e.filename}`, text: e.emit(m, reg) }));
    download(`${slug}-${m.profile.asOf}.zip`, zip(files));
  }

  protected async copyCli() {
    await navigator.clipboard.writeText(this.cli());
    this.snack.open('CLI command copied', undefined, { duration: 1800 });
  }
}
