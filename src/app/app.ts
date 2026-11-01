import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ReleaseSwitch } from './release-switch';
import { FEEDBACK_URL } from './repo';

/** The header every section shares: FHIR Matchbook, its three sections, and the FHIR release. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReleaseSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly feedback = FEEDBACK_URL;
}
