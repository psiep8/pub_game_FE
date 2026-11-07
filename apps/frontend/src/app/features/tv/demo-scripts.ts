/**
 * Copioni delle demo TV.
 *
 * Non sono video preregistrati: sono tre scene animate (TV, remote, punti)
 * che il presentatore commenta dal vivo. Se in futuro arriva un mp4, basta
 * rimettere il tag <video> nell'overlay.
 */
export interface DemoScoreRow {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface DemoScript {
  title: string;
  icon: string;
  tv: string[];
  remote: string[];
  scoring: DemoScoreRow[];
  note: string;
}

export const DEMO_SCRIPTS: Record<string, DemoScript> = {
  QUIZ: {
    title: 'QUIZ',
    icon: '🧠',
    tv: ['Domanda e quattro opzioni', 'Countdown e categoria in alto', 'Risposta corretta al reveal'],
    remote: ['Scegli A, B, C o D', 'Un solo invio per round', 'Il telefono si blocca dopo la scelta'],
    scoring: [
      { label: 'Corretto', value: '+1000 × tempo', tone: 'good' },
      { label: 'Sbagliato', value: '−1000 × tempo', tone: 'bad' },
      { label: 'Non risposta', value: '0', tone: 'neutral' },
    ],
    note: 'Rispondere presto vale di più; il tempo scala anche il malus.',
  },
  IMAGE_BLUR: {
    title: 'INDOVINA CHI',
    icon: '🖼️',
    tv: ['Foto sfocata che si schiarisce', 'Il primo che prenota si ferma', 'Soluzione in TV al reveal'],
    remote: ['Pulsante PRENOTA', 'Risposta a voce', 'L’admin conferma giusto o sbagliato'],
    scoring: [
      { label: 'Corretto', value: '+1000 × tempo', tone: 'good' },
      { label: 'Sbagliato', value: '−1000 × tempo', tone: 'bad' },
      { label: 'Nessuna prenotazione', value: '0', tone: 'neutral' },
    ],
    note: 'La foto si schiarisce: chi aspetta vede meglio ma guadagna meno.',
  },
  MUSIC: {
    title: 'INDOVINA LA CANZONE',
    icon: '🎵',
    tv: ['Quattro manches da 30 secondi', 'Titolo e artista al reveal', 'Countdown tra una manche e l’altra'],
    remote: ['Pulsante PRENOTA', 'Risposta a voce', 'Puoi prenotare in qualsiasi manche'],
    scoring: [
      { label: 'Manche 1–4', value: '+2000 / +1500 / +1000 / +500', tone: 'good' },
      { label: 'Sbagliato', value: '−1000', tone: 'bad' },
      { label: 'Non risposta', value: '0', tone: 'neutral' },
    ],
    note: 'La prima manche è quella che pesa di più: conviene rischiare presto.',
  },
  WHEEL_OF_FORTUNE: {
    title: 'RUOTA DELLA FORTUNA',
    icon: '🎡',
    tv: ['Frase a lettere coperte', 'Le lettere rare si aprono per prime', 'Punteggiatura sempre visibile'],
    remote: ['Pulsante PRENOTA', 'Risposta a voce', 'L’admin conferma la soluzione'],
    scoring: [
      { label: 'Corretto', value: '+1000 × tempo', tone: 'good' },
      { label: 'Sbagliato', value: '−1000 × tempo', tone: 'bad' },
      { label: 'Non risposta', value: '0', tone: 'neutral' },
    ],
    note: 'Il timer è lungo: il rischio è prenotare quando la frase è ancora troppo coperta.',
  },
  TIMELINE: {
    title: 'TIMELINE',
    icon: '🕰️',
    tv: ['Le carte coperte in TV', 'Gli anni compaiono al reveal', 'Classifica delle squadre in tempo reale'],
    remote: ['Trascina le carte in ordine', 'Dal passato al presente', 'Puoi correggere fino all’invio'],
    scoring: [
      { label: 'Coppie corrette', value: '1000 × percentuale', tone: 'good' },
      { label: 'Ordine perfetto', value: '+200', tone: 'good' },
      { label: 'Errore', value: '0', tone: 'neutral' },
      { label: 'Non invio', value: '0', tone: 'neutral' },
    ],
    note: 'Contano le posizioni esatte: da metà classifica in su il round è positivo.',
  },
  TIME_BUZZER: {
    title: 'TIME BUZZER',
    icon: '⏱️',
    tv: ['Tempo bersaglio casuale 5–30 s', 'Cronometro grande', 'Chi è fuori resta bloccato'],
    remote: ['Solo START e STOP', 'Nessun cronometro sul telefono', 'Un tentativo per manche'],
    scoring: [
      { label: 'Più vicino', value: '+300 / +200 / +100 / +50', tone: 'good' },
      { label: 'Errore', value: '0', tone: 'neutral' },
      { label: 'Non preme', value: '0 + eliminato', tone: 'bad' },
    ],
    note: 'Chi non preme prende l’errore massimo ed esce per primo: non conviene stare fermi.',
  },
  BOMBA: {
    title: 'BOMBA',
    icon: '💣',
    tv: ['Una domanda con 2n + n/2 opzioni, quasi tutte vere', 'Bombe nascoste fino alla scelta', 'Turno indicato in grande'],
    remote: ['Scegli solo quando tocca a te', 'La casella falsa costa −200', 'Chi prende una bomba esce dal round'],
    scoring: [
      { label: 'Casella vera', value: '0 · turno dopo', tone: 'good' },
      { label: 'Bomba', value: '−200 e fuori', tone: 'bad' },
      { label: 'Bombe mai scelte', value: 'disarmate', tone: 'neutral' },
    ],
    note: 'Il turno passa sempre, giusta o sbagliata: conta solo evitare le caselle false. Mai sotto zero in classifica.',
  },
  SPEED_RUSH: {
    title: 'SPEED RUSH',
    icon: '⚡',
    tv: ['Corsie e traguardo', 'Boost ×2, ×3, ×4 con la catena', 'Classifica al termine'],
    remote: ['Matematica, colori, bandiere', 'Sinonimi, contrari, traduzioni', 'Ogni risposta giusta avanza'],
    scoring: [
      { label: '1° / 2° / 3°', value: '+1000 / +900 / +800', tone: 'good' },
      { label: 'Errore', value: '0 (corsia indietro)', tone: 'bad' },
      { label: 'Non completa', value: 'punti per posizione', tone: 'neutral' },
    ],
    note: 'La costanza paga più della singola risposta velocissima.',
  },
  AIR_HOCKEY_BATTLE: {
    title: 'AIR HOCKEY BATTLE',
    icon: '🏒',
    tv: ['Due set in parallelo', 'Palla, portieri e domanda', 'Primo a 7 gol'],
    remote: ['Rispondi alla domanda del tuo set', 'Risposta giusta = palla all’avversario', 'Risposta sbagliata = gol subito'],
    scoring: [
      { label: 'Vincitore', value: '+1000', tone: 'good' },
      { label: 'Perdente', value: '+200', tone: 'neutral' },
      { label: 'Risposta sbagliata', value: 'gol per l’avversario', tone: 'bad' },
      { label: 'Non risposta', value: 'gol per l’avversario', tone: 'bad' },
    ],
    note: 'Rispondere in fretta accorcia il tempo dell’avversario: la velocità è un’arma.',
  },
  ARENA: {
    title: 'ARENA BATTLE ROYALE',
    icon: '🏟️',
    tv: ['Cerchio che si chiude', 'Domande rapide per tutti', 'Podio finale'],
    remote: ['Rispondi il prima possibile', 'Risposta corretta = +10', 'Risposta sbagliata = −10'],
    scoring: [
      { label: '1° / 2°', value: '+1000 / +500', tone: 'good' },
      { label: 'Metà bassa / eliminato', value: '−300', tone: 'bad' },
      { label: 'Non risposta durante il gioco', value: '0', tone: 'neutral' },
    ],
    note: 'Il piazzamento finale conta più delle singole risposte: resta dentro al cerchio.',
  },
  BONUS_CAVALLO: {
    title: 'BONUS CAVALLO',
    icon: '🐎',
    tv: ['Otto domande flash della categoria votata', 'Podio del bonus in TV', 'Premi ai primi tre'],
    remote: ['Vota la categoria', 'Tocca la risposta giusta', 'La prima esatta della manche vale +50'],
    scoring: [
      { label: '1° / 2° / 3°', value: '+300 / +150 / +75', tone: 'good' },
      { label: 'Risposta esatta', value: '+100', tone: 'good' },
      { label: 'Errore o non risposta', value: '0', tone: 'neutral' },
    ],
    note: 'Otto domande flash sulla categoria votata: il podio del bonus premia i primi tre.',
  },
  AZZARDO: {
    title: 'AZZARDO',
    icon: '📊',
    tv: ['Quattro manche: celebrità, canzoni, paesi, storia', 'Quattro opzioni numeriche vicinissime', 'Puntata, quota e classifica al reveal'],
    remote: ['Scegli 100, 200 o 300 punti', 'Tocca una delle quattro risposte', 'Vince puntata × quota: ×2, ×3, ×4'],
    scoring: [
      { label: 'Risposta giusta', value: 'puntata × quota', tone: 'good' },
      { label: 'Risposta sbagliata', value: '−100/80/60/40%', tone: 'bad' },
      { label: 'Mai sotto zero', value: 'punti reali', tone: 'neutral' },
    ],
    note: 'Azzardo cresce in tre passaggi: facile ×2, media ×3, difficile ×4. La perdita scende manche dopo manche, dal 100% al 40%.',
  },
  ULTIMA_SPIAGGIA: {
    title: 'ULTIMA SPIAGGIA',
    icon: '🎲',
    tv: ['Una categoria estratta per occorrenza', 'Ogni squadra sceglie un livello 100-500', 'La TV mostra livello e esito per squadra'],
    remote: ['Scegli un livello non ancora consumato', 'Rispondi alla domanda del tuo livello', 'Giusta +livello, sbagliata −metà'],
    scoring: [
      { label: 'Risposta giusta', value: '+100 … +500', tone: 'good' },
      { label: 'Risposta sbagliata', value: '−50 … −250', tone: 'bad' },
      { label: 'Domanda scaduta', value: '−metà del livello', tone: 'neutral' },
    ],
    note: 'Cinque livelli per squadra, consumati tra le occorrenze: la scelta resta bloccata anche nel prossimo Ultima spiaggia, con la nuova categoria.',
  },
  BONUS_BASKET: {
    title: 'BONUS BASKET',
    icon: '🏀',
    tv: ['Countdown bonus', 'Punteggi in diretta', 'Premi ai primi tre'],
    remote: ['Apri /basket dal telefono', 'Trascina e rilascia per tirare', '30 secondi di tiri'],
    scoring: [
      { label: '1° / 2° / 3°', value: '+300 / +150 / +75', tone: 'good' },
      { label: 'Canestro', value: '1 punto bonus', tone: 'good' },
      { label: 'Nessun canestro', value: '0', tone: 'neutral' },
    ],
    note: 'Il punteggio del canestro decide il podio; il presentatore chiude il bonus dall’admin.',
  },
};

export const DEMO_SCENE_COUNT = 3;
