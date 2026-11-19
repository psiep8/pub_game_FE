/**
 * Palette carta/inchiostro delle Biglie, quella che finisce sulla tela 2D.
 *
 * <p>Stava dentro il componente insieme a tutto il resto: disegno, fisica e
 * interfaccia. Qui è una sola fonte, così anche i moduli di disegno estratti
 * (oggi la griglia del conto alla rovescia, `race-overlay.ts`) usano gli stessi
 * colori del resto della gara. I valori sono quelli di `styles.css`.</p>
 */

/** Inchiostro: bordi pieni, testo, ombre offset. */
export const INK = '#15150f';
/** Carta: superficie dei tabelloni e dello sfondo. */
export const PAPER = '#f1e4c9';
/** Carta chiara: il bianco caldo delle etichette. */
export const PAPER_HI = '#fff8e8';
/** Accento d'allarme: ultimi secondi, countdown vivo. */
export const TOMATO = '#ff4d2e';
/** Accento di passaggio: ostacoli e timbri secondari. */
export const MUSTARD = '#ffc53d';
/** Accento freddo: piste e acqua. */
export const COBALT = '#2f5bff';
/** Accento verde: superficie morbida, ghiaccio, neve. */
export const MINT = '#8be3c4';
/** Accento di via: il «VIA!» della partenza. */
export const ACID = '#d9ff43';
