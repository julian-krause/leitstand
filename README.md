# Leitstand

Eine Oberfläche, mit der du viele Claude-Code-Agenten gleichzeitig führst: auf diesem Rechner und auf gemieteten Servern, mit eigener Identität für die Agenten. Umsetzung der Konzepte aus den beiden Videos von Jimmy Denero, siehe [agentic-system-setup.md](agentic-system-setup.md).

**Was du noch anlegen musst** (Postfach, SIM, Karte, Server) steht Schritt für Schritt in [EINRICHTUNG.md](EINRICHTUNG.md).

## Start

```bash
cd ~/Projekte/"agentic system"
npm start
```

Dann <http://127.0.0.1:4747> öffnen. Voraussetzung: Node 20 oder neuer, Python 3 und ein angemeldetes Claude Code. Es gibt keine weiteren Abhängigkeiten.

Dauerhaft laufen lassen (Start bei der Anmeldung, Neustart nach Absturz): `deploy/autostart.sh install`, wieder entfernen mit `deploy/autostart.sh uninstall`.

## Die Bausteine

| Baustein aus den Videos | Im Leitstand |
|---|---|
| No terminals | Alles läuft über Chats in der Oberfläche |
| Lead agents | Ein Lead-Agent je Chat, strikt an sein Projekt gebunden; größere Teile gibt er an Unter-Agenten ab („Crew“) |
| Needs attention | Warteschlange oben; die Leertaste springt zum nächsten Chat, der dich braucht |
| Multiple machines | Reiter „Flotte“: dieser Rechner plus Server per SSH, mit Plätzen je Maschine und Warteschlange |
| Single plan sign-ins | Abo-Tokens einmal hinterlegen, der Leitstand verteilt sie auf alle Maschinen und wechselt bei erreichtem Limit |
| Agent wallets + emails | Eigenes Postfach, SMS-Codes, Karte mit Freigabegrenzen, Tresor für Zugangsdaten, eigener Browser |
| Transcribed meetings | Gespräch im Browser mitschneiden oder Transkript einfügen; der Agent leitet Aufträge ab und wartet auf deine Freigabe |
| Agent team channels | Lead-Agenten verschiedener Projekte schreiben sich (`leitstand tell`); für mehrere Menschen ist der Leitstand nicht gebaut |
| Shared context | Reiter „Seiten“: Markdown-Seiten und CSV-Tabellen, die alle Agenten lesen und fortschreiben |
| Mobile app | Oberfläche passt sich dem Handy an und lässt sich über Tailscale als App ablegen |

Nicht gebaut: Boards (Zeichenfläche), die Design-Bibliothek und die Pull-Request-Spalte.

## So arbeitest du damit

1. **Projekt anlegen:** Name, Maschine, Ordner. Dazu, was die Agenten des Projekts nutzen dürfen: Browser, Postfach, SMS, Karte.
2. **Auftrag geben:** Ziel und gewünschtes Ergebnis beschreiben. Sind alle Plätze belegt, wartet der Auftrag in der Schlange.
3. **Entscheiden:** Der Agent meldet sich, wenn er fertig ist oder dich braucht.

| Der Agent meldet | Deine Knöpfe |
|---|---|
| Entscheidung | die vorgeschlagenen Optionen (empfohlene zuerst) oder „Freigeben“, „Änderungen anfordern“ |
| Erlaubnis | „Erlauben“ (gilt ab dann für das Projekt), „Ablehnen“ |
| Zahlung | „Zahlung freigeben“, „Ablehnen“ |
| Fertig | „Erledigt“, „Nacharbeiten“ |
| Fehler | „Nochmal versuchen“, „Antworten“ |
| Blockiert, Antwort | „Antworten“ |

Überall: „Später“ blendet den Chat für eine Stunde aus, „Nicht mehr nötig“ nimmt ihn aus der Warteschlange.

## Modi

- **Vorsichtig** (Standard): Der Agent darf Dateien im Projektordner ändern. Andere Befehle werden abgelehnt und dir als Erlaubnis-Anfrage vorgelegt.
- **Autonom**: Der Agent führt jeden Befehl ohne Rückfrage aus. Gedacht für eigene Server der Flotte, nicht für den Rechner mit deinen Daten.

## Was die Agenten können: das Kommando `leitstand`

Jeder Agentenlauf hat das Kommando `leitstand`. Es spricht nur mit dem Leitstand und gilt nur für die Dauer des Laufs.

| Kommando | Zweck | Freischaltung je Projekt |
|---|---|---|
| `leitstand wer` | zeigt Adresse, Nummer und Kartengrenzen | immer |
| `leitstand kontext liste / lesen / schreiben` | gemeinsamer Kontext | immer |
| `leitstand tresor liste / zeigen / neu / setzen / 2fa / code / notiz` | Passwortmanager, siehe unten | immer |
| `leitstand tell PROJEKT NACHRICHT` | Nachricht an den Lead-Agenten eines anderen Projekts (höchstens sechs je Stunde und Richtung) | immer |
| `leitstand mail liste / lesen / codes / senden` | Postfach, Bestätigungscodes und -links | Postfach |
| `leitstand sms liste` | empfangene SMS | SMS |
| `leitstand pay anfragen / abrufen` | Zahlung anfragen, Kartendaten nach Freigabe | Karte |

## Tresor: der Passwortmanager der Agenten

Damit du dich nirgends selbst anmelden und keine Passwörter weiterreichen musst.

- **Neues Konto:** Der Agent holt sich mit `leitstand tresor neu NAME BENUTZER ADRESSE` zuerst ein erzeugtes Passwort (24 Zeichen) und meldet sich erst danach damit an. So geht kein Passwort verloren.
- **Zwei-Faktor-Anmeldung:** Der Agent speichert den Einrichtungsschlüssel der Authenticator-App (`leitstand tresor 2fa NAME`), der Leitstand erzeugt die Codes selbst (`leitstand tresor code NAME`). Dein Handy wird dafür nicht gebraucht.
- **Passwortwechsel:** Das vorherige Passwort bleibt als Rückfall gespeichert.
- **Sichtbarkeit:** Ein Zugang gilt für ein Projekt oder für alle. Was ein Agent anlegt, sieht zunächst nur sein Projekt. Agenten können nur eigene Zugänge ändern und nichts löschen.
- **Reiter „Tresor“:** suchen, Benutzer, Passwort und 2FA-Code kopieren, bearbeiten, löschen, eigene Zugänge eintragen. Zu jedem Zugang steht, welches Projekt ihn zuletzt geholt hat.

Im Tresor steht nur, was Agenten anlegen oder du von Hand einträgst. Aus deinem Schlüsselbund oder Browser wird nichts übernommen.

## Sicherheit

- Der Server hört nur auf `127.0.0.1`. Fremde Hostnamen werden abgelehnt; Schreibzugriffe brauchen einen Header, den andere Webseiten nicht setzen können. Von außen geht es nur über eine von dir eingetragene Adresse plus Zugangskennwort.
- Server der Flotte erreichen über einen SSH-Tunnel nur den Port für das Kommando `leitstand` (4748), und jede Anfrage dort braucht das Token eines laufenden Agenten. Die Steuerung der Oberfläche ist von den Servern aus nicht erreichbar, und der Leitstand steht nie offen im Netz.
- Auf diesem Rechner kann jedes Programm, das unter deinem Benutzer läuft, die Oberfläche auf Port 4747 ansprechen. Ein autonomer Agent auf diesem Rechner könnte sich so selbst etwas freigeben. Autonome Projekte gehören deshalb auf Server.
- Auf Servern arbeiten die Agenten als Nutzer `agent`. Die Anmeldung als root und per Kennwort ist abgeschaltet, die Firewall lässt nur SSH durch. `agent` darf dort allerdings `sudo` ohne Kennwort: Der Server gehört den Agenten.
- Kennwörter, Tokens, Kartendaten und der Tresor liegen verschlüsselt in `data/secrets.enc` (AES-256-GCM). Die Oberfläche bekommt sie nur auf ausdrücklichen Klick („Anzeigen“, „Kopieren“). Der Schlüssel liegt als Datei in `data/keys/tresor.key`: Das schützt die einzelne Datei, nicht gegen jemanden, der den ganzen Ordner `data/` kopiert. Mit `LEITSTAND_KEYCHAIN=1` vor dem ersten Start legt der Leitstand den Schlüssel stattdessen in den Schlüsselbund des Macs.
- Ein Passwort, das ein Agent aus dem Tresor holt, steht danach im Sitzungsprotokoll dieses Agenten auf seiner Maschine.
- Die Agenten starten mit `--setting-sources project,local`: Deine Hooks laufen für sie nicht. Deine Plugins und Skills sind trotzdem geladen. Deine persönliche `~/.claude/CLAUDE.md` bekommt ein Projekt nur, wenn du dort „Meine CLAUDE.md“ anhakst.
- Abo-Tokens liegen auf jedem Server in `~/.leitstand/tokens/`. Ein autonomer Agent auf diesem Server kann sie lesen. Wer einen Server abgibt, entfernt vorher das Konto im Leitstand oder löscht den Server.

## Aufbau

| Datei | Zweck |
|---|---|
| `server.js` | HTTP-Server, Schnittstelle der Oberfläche, Zugriffsschutz |
| `lib/runs.js` | Warteschlange, Verteilung auf Maschinen und Konten, Start und Überwachung der Agenten |
| `lib/agent.js` | Auftrag an den Lead-Agenten, Auswertung seiner Status-Meldung |
| `lib/identity.js` | Postfach, SMS, Karte, Agent-zu-Agent, Schnittstelle für `leitstand` |
| `lib/vault.js` | Passwortmanager: Zugänge, erzeugte Passwörter, 2FA-Codes |
| `lib/hetzner.js`, `lib/bootstrap.js` | Server erstellen, Ersteinrichtung |
| `lib/pages.js`, `lib/store.js` | gemeinsamer Kontext, Zustand und Geheimnisse |
| `bin/leitstand` | Kommando der Agenten |
| `tools/mailbox.py` | IMAP und SMTP |
| `public/` | Oberfläche |
| `data/` | Zustand, Geheimnisse, SSH-Schlüssel, Kontext (nicht weitergeben) |

Umgebungsvariablen: `LEITSTAND_PORT` (Standard 4747), `LEITSTAND_DATA` (Datenordner), `LEITSTAND_CLAUDE` (Pfad zu `claude`).
