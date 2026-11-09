import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Stato definitivo dopo un'azione del telefono (risposta inviata, prenotazione
 * registrata): un solo componente per tutti i giochi, così il messaggio e la
 * grafica restano coerenti.
 */
@Component({
  selector: 'app-sent-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sent-state" role="status">
      <span class="sent-icon" aria-hidden="true">{{ icon }}</span>
      <strong class="sent-title">{{ title }}</strong>
      @if (hint) {
        <span class="sent-hint">{{ hint }}</span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .sent-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-align: center;
      padding: 26px 18px;
      background: var(--paper-hi);
      color: var(--coal);
      border: 3px solid var(--coal);
      box-shadow: 8px 8px 0 var(--tomato);
    }
    .sent-icon { font-size: 2.6rem; line-height: 1; }
    .sent-title {
      font-family: var(--font-display);
      font-size: clamp(1.5rem, 8vw, 2.2rem);
      line-height: 1;
      text-transform: uppercase;
    }
    .sent-hint {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      letter-spacing: 0.06em;
      color: rgba(30, 25, 20, 0.75);
    }
  `],
})
export class SentStateComponent {
  @Input() icon = '✅';
  @Input() title = 'RISPOSTA INVIATA';
  @Input() hint = '';
}
