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
    note: 'Meglio un ordine completo che due carte giuste: il punteggio è sulle coppie.',
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
    tv: ['Due o tre bombe tra i tavoli', 'Miccia nascosta: solo scintille', 'Scoppio, −300 e nuova bomba'],
    remote: ['Rispondi in 5 secondi', 'Se giusto scegli a chi passarla', 'La miccia perde 3 secondi se sbagli'],
    scoring: [
      { label: 'Passaggio riuscito', value: '+50 (max +500)', tone: 'good' },
      { label: 'Scoppio', value: '−300', tone: 'bad' },
      { label: 'Base round', value: '1000 punti', tone: 'neutral' },
    ],
    note: 'La bomba non torna subito a chi l\'ha passata; la miccia non si resetta mai.',
  },
  SPEED_RUSH: {
    title: 'SPEED RUSH',
    icon: '⚡',
    tv: ['Corsie e traguardo', 'Boost ×2, ×3, ×4 con la catena', 'Classifica al termine'],
    remote: ['Minigiochi rapidi', 'Ogni risposta giusta avanza', 'Ogni errore fa arretrare'],
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
  SCOMMESSA: {
    title: 'LA SCOMMESSA',
    icon: '🎲',
    tv: ['Puntata, poi tre domande con la banca che raddoppia', 'Tra una domanda e l’altra: incassare o rischiare', 'All’ultima domanda si incassa d’ufficio'],
    remote: ['Tocca 100, 200 o 300', 'Rispondi alle tre domande', 'Scegli INCASSA o RISCHIA'],
    scoring: [
      { label: 'Banca incassata', value: '100 → 200 → 400 → 800', tone: 'good' },
      { label: 'Risposta sbagliata', value: 'banca bruciata', tone: 'bad' },
      { label: 'Non risposta', value: 'banca bruciata', tone: 'neutral' },
    ],
    note: 'Non conta solo sapere: conta quando fermarsi. È il round del coraggio.',
  },
  BONUS_ROULETTE: {
    title: 'BONUS ROULETTE',
    icon: '🎰',
    tv: ['Overlay bonus a tutto schermo', 'Il colore vincente resta in TV', 'Premi ai primi tre'],
    remote: ['Scegli un colore', 'Nessun round consumato', 'Il risultato entra in classifica'],
    scoring: [
      { label: '1° / 2° / 3°', value: '+300 / +150 / +75', tone: 'good' },
      { label: 'Colore sbagliato', value: '0', tone: 'neutral' },
      { label: 'Non risposta', value: '0', tone: 'neutral' },
    ],
    note: 'Bonus di intervallo: la serata riparte senza consumare un round della scaletta.',
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
