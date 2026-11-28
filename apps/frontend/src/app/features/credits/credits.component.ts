import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Pagina pubblica dei crediti. È la versione leggibile in sala di
 * `docs/LICENZE.md`: non promette licenze che non abbiamo, dice cosa è nostro,
 * cosa è di terzi e cosa dipende dal locale.
 *
 * TV-first: si apre dalla lobby e dal pannello regia, si legge da lontano.
 */
@Component({
  selector: 'app-credits',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credits.component.html',
  styleUrl: './credits.component.css',
})
export class Credits {
  readonly updated = '28 novembre 2026';
}
