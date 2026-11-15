# Agentic System: Setup nach Jimmy Denero

Stand: 14.11.2026

## Quellen

| Video | Länge | Inhalt |
|---|---|---|
| [My Agentic System, Fully Explained + New Industry](https://youtu.be/q6NY3KbYCAs) | 22:23 | Das System selbst: Bausteine, Arbeitsweise, Demo |
| [Tech, Money, Macro: How I Split My Focus to Win With AI](https://youtu.be/-qEkSgfer4o) | 27:39 | Prinzipien hinter dem System, Updates, Geschäft, Makro-Sicht |

**Grundlage dieser Notiz:** die automatischen YouTube-Untertitel beider Videos (Video 1 deutsch übersetzt, Video 2 englisches Original), 28 Standbilder aus dem Demo-Teil von Video 1 (06:30–17:00) und 30 Standbilder über die ganze Länge von Video 2. Gemini war beim Ansehen überlastet, deshalb lokal ausgewertet. Vom Anfang und Ende von Video 1 habe ich keine Bilder gesehen. In Video 1 läuft ein Privatsphäre-Modus, der Namen und viele Inhalte unkenntlich macht.

**Umsetzung:** Der Kern des Systems ist in diesem Ordner als lokale App gebaut, siehe [README.md](README.md).

Der Sprecher nennt bewusst keine Tools, Befehle oder Konfigurationen. Seine Ansage: Das System ist für ihn maßgeschneidert und steht nicht zum Verkauf; man soll die Konzepte übernehmen und selbst bauen (V1 00:30, 07:04).

## Kernidee

Mit Agenten macht der Mensch drei Dinge (V1 14:10–15:10):

1. **Ideen eingeben:** was getan werden soll, was das Ziel ist.
2. **Der Agent arbeitet.**
3. **Informiert werden und entscheiden:** Status aufnehmen, prüfen, freigeben.

Ziel ist, dass der Mensch am Ende fast nur noch Entscheidungen trifft. Das System bringt ihm die Entscheidungen, er sucht sie nicht.

## Die drei Prinzipien (Video 2, 06:05–10:40)

Aus diesen drei Prinzipien leitet er alle Bausteine ab.

### 1. Intention

Jede Anfrage an das System ist eine Absicht. Sie muss klar ins System kommen und dort bis zu einem **fertigen, verwertbaren Zustand** verfolgt werden (Leads, Geld, Website), nicht halb fertig und nicht als „Slop“, den man nacharbeiten muss.

### 2. Attention

Gemeint ist die eigene Aufmerksamkeit, nicht die fremder Leute. Mit vielen Agenten ist sie der Engpass. Jede Ablenkung und jeder verlorene Chat ist verlorene Zeit, weil man dann sucht, statt den Hebel der Agenten zu nutzen. Gegenbild: sechs Claude-Terminals nebeneinander.

### 3. Shared Context

Alles liegt in einem eigenen (proprietären) System, das die Agenten vollständig sehen: Seiten, Tabellen, Gmail, SMS, Chats mit Partnern, Chats der anderen Agenten. Der Wert wächst nicht linear mit der Zahl der Bausteine, sondern überproportional (er zitiert sinngemäß „Wert eines Graphen = Knoten zum Quadrat“). Sechs integrierte Bausteine seien nicht sechsmal besser, sondern um Größenordnungen.

## Bausteine des Systems

### Raus aus dem Terminal (V1 07:04, 08:04)

Eigene Oberfläche statt mehrerer Terminals nebeneinander. Begründung: Terminals plus aufpoppende Browser und Artefakte unterbrechen ständig.

### „Needs Attention“-Panel (V1 08:34–09:35, 14:10–15:10)

Laut ihm der wichtigste Baustein.

- Das System verfolgt, welche Chats fertig sind oder eine Entscheidung brauchen.
- **Leertaste** springt zum nächsten Chat, der Aufmerksamkeit braucht.
- Dort steht alles, was für die Entscheidung nötig ist, inklusive eines **Videos von dem, was sich geändert hat**.
- Bestätigen bzw. Zusammenführen (Merge) direkt aus dieser Ansicht, dann weiter zum nächsten.
- Geplante Verbesserung: Der Agent zeigt nur noch die Informationen, die für eine fundierte Entscheidung nötig sind.

### Lead-Agenten pro Projekt (V1 10:06–11:06)

- Lead-Agenten sind Orchestratoren, die Unter-Agenten losschicken.
- Entscheidend: **pro Projekt isoliert halten**. Ein Lead-Agent über mehrere Projekte bringt die Dinge durcheinander, weil sein Kontext begrenzt ist und er ständig Agenten aussendet.
- Projekte liegen in einer Seitenleiste und lassen sich in Arbeitsbereiche einfügen.
- Kein Claude-Code-Terminal „völlig ungeschützt“ laufen lassen.

### Eigene Identität für den Agenten (V1 07:04–08:04, 11:06–11:37)

Von ihm als „Geheimtipp“ bezeichnet.

- Der Agent hat eine **eigene E-Mail-Adresse**, eine **eigene Telefonnummer** (empfängt 2FA-Codes selbst) und ein **eigenes Wallet mit Karte**.
- Die Karte ist eine Krypto-Karte mit **begrenztem Guthaben**. Kein Zugriff auf die eigene Kreditkarte oder Bankkonten.
- Der Agent kann sich damit selbst bei Diensten anmelden und den Computer bedienen, ohne dass jeder Klick freigegeben werden muss.
- Wenn doch eine Bestätigung nötig ist, erscheint sie im Browser als ein Klick.
- Regel: Aufgabenbereich eng halten, isolieren, innerhalb davon voll autonom arbeiten lassen.
- Dafür sind Risikokontrollen und Einstellungen nötig; welche, sagt er nicht (angekündigt für spätere Videos, V1 06:34).

### Zentraler Posteingang (V1 07:34)

E-Mails, Telegram und iMessage laufen im System zusammen. Auf einen Teil davon hat der Agent bewusst **keinen** Zugriff.

### Meetings (V1 11:37–12:08)

- Eigenes Meeting-Panel (Google Meet nachgebaut) mit Transkription.
- Das Transkript geht direkt an die Lead-Agenten, die daraus Arbeitsaufträge machen.
- Ein Mensch gibt die Aufträge frei und schärft sie nach, dann starten die Agenten direkt nach dem Gespräch.
- Abgrenzung: Notizen-Tools, bei denen man danach per Drag-and-drop weiterreichen muss, erzeugen Reibung.

### Team-Kanäle mit Agenten (V1 15:10–16:42)

- Gruppenchat aus ihm, seinem Partner, seinem Agenten und dem Agenten des Partners.
- Die Agenten halten sich gegenseitig auf dem Laufenden und arbeiten an denselben Dingen.
- **@-Erwähnungen** landen im „Needs Attention“-Panel der erwähnten Person.
- Voraussetzung: volles Vertrauen in den Partner, denn dessen Agent hat Zugriff auf den eigenen Rechner. Er räumt ein, dass ein Red-Teaming das System wohl brechen würde.

### Mehrere Maschinen und Abos (V1 12:40–13:40)

- Zwei Mac minis und ein Mac; geplant ist der Umzug auf Linux in der Cloud.
- Nach eigener Aussage laufen 30 bis 50 Agenten parallel. Ein Teil der Arbeit wird verworfen, die Menge gleiche das aus.
- **Einmal anmelden**, das Abo ist auf allen Maschinen verfügbar.
- Nutzungspanel für die Abos.
- Kosten: etwa 1.400 Dollar pro Monat für Anthropic-Pläne (fünf Pläne inklusive ChatGPT), Opus auf hoher Stufe. Andere Software-Abos hat er gekündigt.

### Eingebaute Arbeitswerkzeuge (V2 05:03–06:05)

Alles liegt im selben System, damit die Agenten darauf zugreifen:

- **Pages:** Notion-Nachbau
- **Boards:** eigenes Whiteboard („unser eigenes Figma“, V1 02:31)
- **Tables:** Airtable-Nachbau
- **Tabellenkalkulation:** Excel-artiges System, das der Agent bedient
- **Design Items:** gespeicherte, wiederverwendbare Design-Bausteine. Vorgehen: Agent eine UI „erschöpfend analysieren“ lassen, Ergebnis speichern. So entstand das UI-Redesign. Er vergleicht das mit einem Dienst, dessen Name in den Untertiteln als „Mob and MCP“ erscheint (vermutlich Mobbin).
- **Mobile App:** vor allem, um abends unterwegs „Needs Attention“ abzuarbeiten

### Lernvideos für sich selbst (V1 05:03–06:04)

Der Agent erstellt Erklärvideos, etwa zu einer neuen Branche (Beispiel Transportunternehmer: was sie tun, wo es wehtut, was sie heute nutzen). Er schaut sie in doppelter Geschwindigkeit, um Entscheidungen der Agenten beurteilen zu können.

## Was auf dem Bildschirm zu sehen ist (Video 1)

### Sein Übersichts-Board (06:36, 10:13–14:30)

Board-Titel „First demo board (work in progress)“. Unter „what people miss“ stehen acht Karten, jede mit App-Screenshot und Einzeiler:

| Karte | Einzeiler auf dem Board |
|---|---|
| No terminals | Everything runs from chat |
| Lead agents | One first mate runs a crew of agents |
| Agent wallets + emails | Agents sign up, pay and get codes themselves |
| Transcribed meetings + recorded chats | With everyone, internally |
| Multiple machines | One fleet across several computers |
| Single plan sign-ins | One subscription signs in every agent |
| Needs attention | Only real decisions reach you, in one place |
| Agent team channels | You, your team and everyone's agents in one channel |

### Aufbau der App (07:02–09:30, 15:41–16:56)

- **Obere Navigation:** Chats, Pages, Roadmap, Captures, Design, Meetings, Messages.
- **Statusleiste oben rechts:** kleine Zähler, unter anderem ein GitHub-Symbol und ein Pull-Request-Zähler.
- **Linke Seitenleiste:** Arbeitsbereiche mit Kanälen im Slack-Stil, oben „Pinned“. Sichtbare Kanalnamen: `dialing`, `first-demo`, `email-outbound`, `funnelrebuild`, `Ofm`, `performance`, `mobileapp`. Farbige Punkte markieren den Status.
- **Kanal-Kopf:** Name, Status-Auswahl (hier „Building“), Feld „Add a purpose“ und eine „Next:“-Zeile mit dem nächsten Schritt.
- **Chat:** Mensch und sein Bot schreiben im selben Kanal (Bot mit „BOT“-Kennzeichen). Der Bot antwortet mit kurzen Stichpunkten, Screenshots und verlinkten Boards.
- **Eingabefeld im Lead-Chat:** „Message your lead“, darunter Anzeige des Kontextverbrauchs („8% · 78k / 1M“) und ein Knopf „Compact“.

### „Needs Attention“-Leiste (07:02, 09:05–09:30)

Schwebende Leiste oben in der Mitte:

- links Arbeitsbereich und Kanal bzw. Titel des Vorgangs (Beispiel: „Personal · Event rules and needs attention“)
- **Approve** und **Request changes**
- **Snooze** mit Tastenkürzel „Space“
- **No longer needed**
- Zähler „5 waiting“ / „3 waiting“ und **Next**

Aufgeklappt zeigt sie die offene Frage des Agenten samt „Reply“-Knopf. In der Freigabe-Ansicht stehen ein kurzes Video der Änderung, Vorher-nachher-Screenshots („Closed“ / „Open: same width“) und Antwortoptionen, eine davon als „Recommended“ markiert. Links daneben ein Inhaltsverzeichnis des Chats.

Die Bots melden sich mit Formulierungen wie „… is ready for your OK“, „Screenshots before it merges“ und „Say ship it and it merges after review“. Die Arbeit läuft also über Pull Requests mit Review und anschließendem Merge und Deploy.

### Wallet (07:42)

Panel „Wallet“: Guthaben, Knöpfe „Top up“ und „Add card“, Netzwerke Ethereum, Solana und Tron, darunter „Cards“ mit einer Karte „Test“ (Default). Unten die Regel „Auto-approve up to … a payment“ mit Link zu den Einstellungen. Zahlungen bis zu einem Betrag laufen also ohne Rückfrage durch.

### Nachrichten (07:55)

Panel „Messages“ mit drei Eingängen: EMAIL (253 neu), ein zweiter Posteingang (69 neu) und MESSAGES (10 neu).

### Einstellungen (auf den Board-Screenshots, klein)

Seiten „Machines“ (Liste der Rechner, Einträge wie `mac-mini-1`, `mac-mini-2`, `studio-1`) und „Claude accounts“ mit einer Liste von Abos und einem ChatGPT-Login. Weitere Menüpunkte sind erkennbar, aber zu klein, um sie sicher zu lesen.

### Beispiel für die Arbeitsweise (15:41–16:56)

Im Kanal `dialing` bauen die Bots einen Telefon-Dialer für den Vertrieb: Rückruf-Banner, Anruflisten, Live-Transkription, Spickzettel mit Reitern „Pains“, „Tools map“, „Tools“ und „Script“. Sein Bot und der Bot des Partners antworten im selben Thread aufeinander.

## Was auf dem Bildschirm zu sehen ist (Video 2)

### Sein Board „How · What · Why“ (02:02–27:33)

Drei Spalten, die auch die drei Themen seines Kanals sind:

| Spalte | Untertitel auf dem Board |
|---|---|
| Technical Leverage · How | Execute and get the most output: efficient tooling, your own software, data and systems |
| Collect & Monetize · What | Collect money at the same time: make what you build pay you, give you a living and have impact |
| Strategic Judgment · Why | See the macro so we don't flip-flop, don't overinvest where it gets wiped, and stay flexible |

### Diagramm „The shared context layer“ (06:46–08:24)

Links „You“, rechts „Your agents“, in der Mitte gestapelte Ebenen „Shared context“ mit Symbolen für Chat, Video, Seite, Tabelle und Benachrichtigung. Oben ein Pfeil vom Menschen zu den Agenten: **Intention, „you ask the system for something“**. Unten ein Pfeil zurück: **Attention, „the system asks you for something“**.

### Neue Oberfläche (05:13, 06:12)

- **Lead-Chat:** Titel mit Kennzeichen „first mate“, daneben „Crew 0“ (Zahl der laufenden Unter-Agenten). Eingabefeld „Message your lead“ mit Modellwahl („Opus 5.5“), Stufe („High“), Kontextanzeige („28 %“) und „Compact“.
- **Leiste im Chat:** „Allow“, „Deny“, „Snooze“ (Leertaste), Zähler, „Next“.
- **Spalte „Needs attention“ rechts:** „6 waiting on you“, umschaltbar zwischen „List“ und „Expanded“ sowie „All“ und „This chat“. Einträge sind entweder Erlaubnis-Anfragen („@… wants permission: Bash: …“ mit „Yes“, „No“, „Snooze 1 hour“) oder Entscheidungsfragen („Merge the demo window for sales calls into the CRM?“).
- **Spalte „Pull requests“** daneben, gruppiert nach „Waiting on you“, „In review“, „Being fixed“.
- **Links:** „New chat“, „Quick chat“, „All unreads“, darunter „Pinned“ und Arbeitsbereiche.
- **Antwortstil des Agenten:** kurze Stichpunkte, Vorher-nachher-Bilder, am Ende eine konkrete Rückfrage.

### Weitere Bereiche (05:36–06:00)

- Kacheln auf dem Board: Mobile app, Pages, Boards, Tables, Roadmap, Design studies, Setup doctor.
- **Design studies:** Galerie mit 39 Einträgen, je ein „design system“ einer bekannten App mit Zahl der Screens. Die Detailansicht hat Zusammenfassung, „Key screens“ und einen „Guide“, wann der Agent diese Vorlage verwenden soll.

### Geschäfts- und Makro-Teil (11:48–27:33)

- **This week in the field:** drei Anrufe (zwei „No-show“, einer „1 vs 4“), „$0 made this week“. Darunter: Cut the fat → Got clear → Build it next week → More calls.
- **Where AI hits, and where the moats are:** Ringe um „AI“. Innen „hit hardest“ (Software, Media; Young people, Tech people, Influencers, Agencies, Freelancers), dann „can use software“, außen „needs the ship“ (physische Branchen). Gestrichelte Linie „AI's reach in 1 year“. Legende: Price → 0 (flooded, commoditized), Margin jump (for whoever implements first), Moats (capital · permits · assets).
- **The real moats:** Physical assets, Licences/permits, Trust in person, Own distribution, Field data, Cash flow, Judgment/speed, Compute/power.
- **Our move:** AI leverage → Traditional → Physical + regulated.
- **Things we know will happen:** Agent to agent (+ security conventions), All integrations, Faster work (more finished tasks come back to you); K-förmige Wirtschaft (mehr Geld für Konzerne, Staaten und „Frontiersmen“, weniger Jobs, Angebot hoch, Nachfrage runter); Consumer awareness; Everything's temporal.

## Sicherheitsregeln aus den Videos

- Agent bekommt eigene Konten, nie die persönlichen.
- Kein Zugriff auf Bankkonten oder die eigene Kreditkarte; Ausgaben nur über eine Karte mit begrenztem Guthaben.
- Private Posteingänge teilweise ausgesperrt.
- Lead-Agenten pro Projekt isoliert.
- Agenten-Zugriff für Dritte nur bei Personen, denen man voll vertraut.
- Er räumt selbst ein, dass Sicherheitsbedenken bestehen und das System einem gezielten Angriff nicht standhielte.

## Geschäftlicher Kontext (kurz)

- Er verkauft individuelle Software- und KI-Lösungen an Unternehmen. Erster Abschluss: Nische Immobilienversicherung, Demo in zwei Stunden gebaut, nachdem ein Branchenkontakt die Schmerzpunkte genannt hatte (V1 04:02).
- Preisrahmen aus einem Verkaufsgespräch: 20.000 bis 35.000 Dollar Projekt plus „ein paar Tausend“ pro Monat; der Preis war nicht der Einwand, sondern fehlendes Branchenwissen (V2 13:42–15:16).
- Empfehlung: das Wort „KI“ gegenüber Firmen vorsichtig einsetzen und das Ergebnis verkaufen (V2 11:39).
- Seine Makro-These: Bei allem Digitalen steigt das Angebot und sinkt die Nachfrage; Apps und SaaS ohne echten Burggraben hält er für aussichtslos. Als Burggräben nennt er physische Anlagen, Lizenzen und Genehmigungen sowie persönliches Vertrauen und Netzwerk (V2 17:18–27:00).

## Was die Videos nicht liefern

- Keine Tool-Namen für E-Mail, Telefonnummer, Krypto-Karte oder Transkription
- Keine Angaben zu Tech-Stack, Architektur, Ordnerstruktur, Befehlen oder Prompts
- Keine konkreten Risikoeinstellungen

Beides kündigt er für spätere Einzelvideos an.

## Stand der Umsetzung

Der Leitstand in diesem Ordner setzt die Bausteine um. Bedienung in [README.md](README.md), was du dafür noch anlegen musst in [EINRICHTUNG.md](EINRICHTUNG.md).

| Baustein | Stand |
|---|---|
| Eigene Oberfläche, Lead-Agenten pro Projekt, Crew | gebaut und getestet |
| „Needs Attention“ mit Leertaste, Freigabe, Erlaubnis, Später | gebaut und getestet |
| Gemeinsamer Kontext (Seiten, Tabellen) | gebaut und getestet |
| Flotte: mehrere Maschinen per SSH, Plätze, Warteschlange | gebaut und getestet, auch mit einem Agentenlauf auf einem echten Server |
| Ein Abo für alle Maschinen, Wechsel bei Limit | Verteilung des Tokens getestet; der Wechsel bei erreichtem Limit ist ohne echtes Limit ungetestet |
| Server auf Knopfdruck (Hetzner) | gebaut, ohne Token ungetestet |
| Agenten-Identität: Postfach, SMS-Codes, Karte mit Grenzen, Tresor | gebaut; Karte und Tresor getestet, Postfach braucht dein Konto |
| Eigener Browser der Agenten | gebaut, ungetestet |
| Gespräche: mitschneiden oder einfügen, Aufträge zur Freigabe | gebaut; Mitschnitt ungetestet |
| Agent zu Agent über Projektgrenzen | gebaut und getestet |
| Zugriff vom Handy | gebaut; Anmeldung über Tailscale ungetestet |
| Boards, Design-Bibliothek, Pull-Request-Spalte | nicht gebaut |
