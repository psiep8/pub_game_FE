"""Espansione della banca domande - blocco 8.

Completa le branche Cinema e Serie TV / Serie TV, TV e Spettacolo / Spettacolo,
Lingua e Letteratura / Lingua, Anime e manga / Manga e Gaming e Tecnologia.
"""

from __future__ import annotations

EXTRA_THEMED_QUIZ: dict[str, list[tuple[str, str, list[str], str]]] = {
    "Cinema, Serie TV|Serie TV": [
        ("Quale serie italiana racconta le indagini di un prete di paese?", "Don Matteo", ["Il commissario Montalbano", "Un posto al sole", "La piovra"], "facile"),
        ("Quale serie animata racconta le vicende della famiglia Simpson?", "I Simpson", ["I Griffin", "South Park", "Beavis and Butt-Head"], "facile"),
        ("Quale serie racconta un gruppo di ragazzi in una cittadina con un mondo parallelo?", "Stranger Things", ["Dark", "The OA", "Locke & Key"], "medio"),
        ("Quale serie racconta le indagini di Sherlock Holmes nella Londra moderna?", "Sherlock", ["Elementary", "Luther", "Broadchurch"], "medio"),
        ("Quale serie racconta la vita di una regina d'Inghilterra dal secondo dopoguerra?", "The Crown", ["Victoria", "Downton Abbey", "The Tudors"], "medio"),
        ("Quale serie è ambientata nella tenuta di Downton Abbey all'inizio del Novecento?", "Downton Abbey", ["The Crown", "Poldark", "Belgravia"], "difficile"),
        ("Quale serie spagnola racconta una banda con le maschere di Dalí?", "La casa di carta", ["Élite", "Vis a vis", "Narcos"], "difficile"),
        ("Quale serie antologica racconta storie distopiche autonome?", "Black Mirror", ["American Horror Story", "Fargo", "The Twilight Zone"], "difficile"),
    ],
    "TV e Spettacolo|Spettacolo": [
        ("Quale arte performativa si svolge su un palco davanti al pubblico?", "Il teatro", ["La pittura", "La scultura", "La fotografia"], "facile"),
        ("Come si chiama lo spettacolo con musica e canto in un teatro?", "L'opera lirica", ["Il concerto rock", "La maratona", "Il reading"], "facile"),
        ("Quale premio italiano è dedicato al teatro?", "Il premio Ubu", ["Il David di Donatello", "Il Nastro d'argento", "Il Telegatto"], "medio"),
        ("Quale festival teatrale si tiene ogni anno a Spoleto?", "Il Festival dei Due Mondi", ["Il Festival di Sanremo", "La Biennale di Venezia", "Il festival di Ravello"], "medio"),
        ("Chi ha scritto la commedia Sei personaggi in cerca d'autore?", "Luigi Pirandello", ["Carlo Goldoni", "Eduardo De Filippo", "Dario Fo"], "difficile"),
        ("Quale drammaturgo napoletano è autore di Filumena Marturano?", "Eduardo De Filippo", ["Luigi Pirandello", "Dario Fo", "Carlo Goldoni"], "difficile"),
        ("Quale regista ha fondato il Piccolo Teatro di Milano?", "Giorgio Strehler", ["Luca Ronconi", "Eduardo De Filippo", "Carmelo Bene"], "difficile"),
    ],
    "Lingua e Letteratura|Lingua": [
        ("Quale articolo indeterminativo maschile si usa davanti a 'amico'?", "Un", ["Uno", "Lo", "Il"], "facile"),
        ("Quale parte della frase indica l'azione?", "Il verbo", ["Il nome", "L'aggettivo", "L'avverbio"], "facile"),
        ("Quale tempo verbale esprime un'azione conclusa nel passato?", "Il passato prossimo", ["Il presente", "Il futuro semplice", "L'imperfetto"], "medio"),
        ("Quale complemento risponde alla domanda 'a chi?'", "Il complemento di termine", ["Il complemento oggetto", "Il complemento di luogo", "Il complemento di mezzo"], "medio"),
        ("Quale parola è un pronome personale?", "Lui", ["Bello", "Correre", "Velocemente"], "medio"),
        ("Quale figura retorica ripete una parola all'inizio di più versi?", "L'anafora", ["L'epifora", "Il chiasmo", "L'antitesi"], "difficile"),
        ("Quale caso latino esprime il complemento oggetto?", "L'accusativo", ["Il genitivo", "Il dativo", "Il nominativo"], "difficile"),
        ("Quale tempo verbale indica un'azione futura rispetto al passato?", "Il futuro anteriore", ["Il condizionale passato", "Il trapassato prossimo", "Il congiuntivo imperfetto"], "difficile"),
        ("Quale tipo di proposizione è introdotta da 'benché'?", "Una subordinata concessiva", ["Una coordinata avversativa", "Una subordinata causale", "Una subordinata finale"], "difficile"),
    ],
    "Lingua e Letteratura|Letteratura": [
        ("Quale poeta ha scritto la canzone Italia mia?", "Francesco Petrarca", ["Dante Alighieri", "Giovanni Boccaccio", "Ludovico Ariosto"], "facile"),
    ],
    "Anime e manga|Anime": [
        ("Quale anime del 1995 è stato diretto da Hideaki Anno?", "Neon Genesis Evangelion", ["Akira", "Ghost in the Shell", "Cowboy Bebop"], "difficile"),
        ("Quale studio ha animato Demon Slayer?", "Ufotable", ["Madhouse", "Bones", "MAPPA"], "difficile"),
    ],
    "Anime e manga|Manga": [
        ("Come si chiama il volume che raccoglie i capitoli di un manga?", "Tankobon", ["Artbook", "Fanbook", "Light novel"], "facile"),
        ("Quale manga racconta le avventure di un ninja con una volpe dentro?", "Naruto", ["Bleach", "One Piece", "Fairy Tail"], "facile"),
        ("Quale manga ha come protagonista Son Goku?", "Dragon Ball", ["Naruto", "Bleach", "Yu-Gi-Oh!"], "facile"),
        ("Su quale rivista giapponese viene pubblicato One Piece?", "Weekly Shonen Jump", ["Weekly Young Jump", "Ribon", "Nakayoshi"], "facile"),
        ("Chi ha creato il manga Bleach?", "Tite Kubo", ["Masashi Kishimoto", "Eiichiro Oda", "Yoshihiro Togashi"], "medio"),
        ("Quale manga racconta le vicende di un ragazzo che diventa uno shinigami?", "Bleach", ["Naruto", "One Piece", "Fairy Tail"], "medio"),
        ("Quale rivista pubblica manga per ragazze ed è nota come shōjo?", "Ribon", ["Weekly Shonen Jump", "Big Comic", "Afternoon"], "medio"),
        ("Chi ha creato il manga Hunter x Hunter?", "Yoshihiro Togashi", ["Tite Kubo", "Akira Toriyama", "Naoko Takeuchi"], "medio"),
        ("Quale autore ha creato il manga 20th Century Boys?", "Naoki Urasawa", ["Tsugumi Ohba", "Takehiko Inoue", "Hajime Isayama"], "difficile"),
    ],
    "Gaming e Tecnologia|Gaming": [
        ("Quale gioco è ambientato nel regno di Hyrule?", "The Legend of Zelda", ["Metroid", "Kirby", "Star Fox"], "medio"),
        ("Quale gioco di ruolo ha vinto il premio di gioco dell'anno nel 2023?", "Baldur's Gate 3", ["Starfield", "Diablo IV", "Final Fantasy XVI"], "difficile"),
        ("Quale software house ha sviluppato Dark Souls?", "FromSoftware", ["CD Projekt", "Bethesda", "BioWare"], "difficile"),
    ],
    "Gaming e Tecnologia|Tecnologia": [
        ("Quale dispositivo stampa documenti su carta?", "La stampante", ["Il monitor", "La tastiera", "Il router"], "facile"),
        ("Quale apparecchio collega la rete locale a internet?", "Il router", ["La stampante", "Lo scanner", "Il proiettore"], "facile"),
        ("Quale memoria conserva i dati anche senza alimentazione?", "La memoria di massa", ["La RAM", "La cache", "Il registro"], "facile"),
        ("Quale formato di immagine supporta la trasparenza?", "PNG", ["JPG", "BMP", "TXT"], "medio"),
        ("Quale rete sociale è usata per i contenuti professionali?", "LinkedIn", ["TikTok", "Snapchat", "Discord"], "medio"),
        ("Quale algoritmo di crittografia asimmetrica usa una coppia di chiavi?", "RSA", ["AES", "DES", "MD5"], "difficile"),
    ],
}

EXTRA_THEMED_TF: dict[str, list[tuple[str, str, str]]] = {
    "Cinema, Serie TV|Serie TV": [
        ("I Simpson sono una serie animata americana.", "VERO", "facile"),
        ("Don Matteo è ambientato a Milano.", "FALSO", "facile"),
        ("Una serie tv è composta da episodi.", "VERO", "facile"),
        ("Dark è una serie tedesca.", "VERO", "medio"),
        ("I Soprano raccontano le vicende di una famiglia mafiosa del New Jersey.", "VERO", "medio"),
        ("Modern Family è una serie drammatica ambientata in ospedale.", "FALSO", "medio"),
        ("Game of Thrones è tratto dai romanzi di George R. R. Martin.", "VERO", "difficile"),
        ("The Wire racconta il mondo della finanza di Wall Street.", "FALSO", "difficile"),
    ],
    "TV e Spettacolo|Spettacolo": [
        ("Il concerto è uno spettacolo musicale dal vivo.", "VERO", "facile"),
        ("Il teatro greco era all'aperto.", "VERO", "facile"),
        ("Un festival può durare più giorni.", "VERO", "facile"),
        ("Il musical unisce recitazione, canto e danza.", "VERO", "medio"),
        ("La Biennale di Venezia riguarda solo la pittura.", "FALSO", "medio"),
        ("Il palcoscenico è la parte del teatro dove si esibiscono gli attori.", "VERO", "medio"),
        ("Dario Fo ha vinto il premio Nobel per la letteratura.", "VERO", "difficile"),
        ("La Scala è un teatro di opera lirica a Milano.", "VERO", "difficile"),
        ("Il teatro dell'opera di Sydney ha una copertura a forma di vela.", "VERO", "difficile"),
        ("Il festival di Edimburgo è dedicato solo al cinema.", "FALSO", "difficile"),
    ],
    "Lingua e Letteratura|Lingua": [
        ("Il punto fermo chiude una frase.", "VERO", "facile"),
        ("In italiano gli aggettivi non concordano mai con il nome.", "FALSO", "facile"),
        ("Il congiuntivo si usa spesso nelle frasi subordinate.", "VERO", "medio"),
        ("'Qual è' si scrive senza apostrofo.", "VERO", "medio"),
        ("Il predicato nominale è formato dal verbo essere più un nome o un aggettivo.", "VERO", "difficile"),
        ("L'italiano ha sette modi verbali.", "VERO", "difficile"),
        ("Il chiasmo è una figura retorica di suono.", "FALSO", "difficile"),
        ("I verbi transitivi reggono il complemento oggetto.", "VERO", "difficile"),
        ("L'accento circonflesso è usato comunemente nell'italiano moderno.", "FALSO", "difficile"),
    ],
    "Anime e manga|Anime": [
        ("Il film Akira è tratto da un manga di Katsuhiro Otomo.", "VERO", "difficile"),
    ],
    "Anime e manga|Manga": [
        ("Il manga è un fumetto giapponese.", "VERO", "facile"),
        ("Un tankobon raccoglie più capitoli di un manga.", "VERO", "facile"),
        ("In Giappone il manga si legge da sinistra verso destra.", "FALSO", "facile"),
        ("Il termine shonen indica un manga per ragazzi.", "VERO", "facile"),
        ("Il manga viene pubblicato a puntate su riviste prima dei volumi.", "VERO", "medio"),
        ("Il termine seinen indica manga destinati a un pubblico adulto.", "VERO", "medio"),
        ("One Piece è pubblicato su Weekly Shonen Jump.", "VERO", "medio"),
        ("I manga sono sempre a colori.", "FALSO", "medio"),
        ("Naoki Urasawa è l'autore di Monster.", "VERO", "difficile"),
    ],
    "Gaming e Tecnologia|Gaming": [
        ("Tetris è un gioco di puzzle con blocchi che cadono.", "VERO", "medio"),
        ("Il primo videogioco commerciale di grande successo fu Pong.", "VERO", "difficile"),
    ],
    "Gaming e Tecnologia|Tecnologia": [
        ("Il monitor è un dispositivo di output.", "VERO", "facile"),
        ("La tastiera serve a stampare i documenti.", "FALSO", "facile"),
        ("Il backup serve a conservare una copia dei dati.", "VERO", "medio"),
        ("Un firewall filtra il traffico di rete in base a regole.", "VERO", "difficile"),
    ],
}
