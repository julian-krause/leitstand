# Einrichtung: was du anlegst und wo du es einträgst

Stand der Recherche: 14.11.2026. Der Leitstand ist für alle Punkte fertig gebaut; es fehlen nur noch deine Konten. Reihenfolge nach Nutzen: Mit Schritt 1 und 5 laufen viele Agenten parallel, mit 2 bis 4 bekommen sie ihre eigene Identität.

| Schritt | Was | Kosten | Dauer |
|---|---|---|---|
| 1 | Claude-Abo-Token | dein Abo | 5 min |
| 2 | Postfach (mailbox.org) | 3 €/Monat | 10 min |
| 3 | Telefonnummer (Prepaid-SIM im Alt-Handy) | ca. 10 € einmalig | 30 min |
| 4 | Karte mit Limit (Revolut) | 0 € | 15 min |
| 5 | Server | ab 37 €/Monat | 15 min |
| 6 | Zugriff vom Handy (Tailscale) | 0 € | 5 min |

## 1. Claude-Abo-Token

Damit Agenten auch auf Servern über dein Abo laufen.

1. Im Terminal: `claude setup-token`, im Browser anmelden.
2. Das angezeigte Token kopieren (gilt ein Jahr).
3. Leitstand → **Flotte** → „Konto hinzufügen“ → Name und Token eintragen.

Für weitere Abos den Schritt mit dem jeweiligen Konto wiederholen. Der Leitstand verteilt die Agenten auf das am wenigsten ausgelastete Konto und wechselt, wenn eines am Limit ist.

**Wichtig für 50 Agenten:** Der Engpass sind die Abo-Limits (5 Stunden und 7 Tage), nicht die Server. Ein einzelnes Abo trägt keine 50 Agenten im Dauerbetrieb; der Mann aus dem Video nennt fünf Pläne für rund 1.400 $ im Monat. Fang mit deinem Abo an und nimm weitere dazu, sobald unter „Flotte“ regelmäßig „am Limit“ steht.

## 2. Postfach: mailbox.org Standard

3 €/Monat bei jährlicher Zahlung. IMAP und SMTP mit App-Kennwort, ohne Browser-Anmeldung. Ausweichlösung: Fastmail Individual (5 €/Monat).

1. Auf [register.mailbox.org](https://register.mailbox.org) ein Konto im Tarif **Standard** anlegen, mit einer Adresse nur für die Agenten.
2. Sofort Guthaben einzahlen (Alle Einstellungen → Vertrag und Zahlung). Der Testaccount blockiert sonst unter anderem Bestätigungscodes.
3. Zahnrad → Alle Einstellungen → Sicherheit → **E-Mail-App-Passwörter**: Name vergeben, IMAP und SMTP anhaken, erzeugen.
4. Leitstand → **Einstellungen** → Postfach:

| Feld | Wert |
|---|---|
| Adresse und Benutzername | die volle Adresse |
| IMAP-Server / Port | `imap.mailbox.org` / 993 |
| SMTP-Server / Port | `smtp.mailbox.org` / 465 |
| App-Kennwort | aus Schritt 3 |

5. „Verbindung testen“ drücken.

Quellen: [Preise](https://mailbox.org/de/preise/), [App-Passwörter](https://kb.mailbox.org/de/privat/sicherheit-privatsphaere/e-mail-app-passwoerter/), [Testaccount](https://kb.mailbox.org/de/privat/ihr-account-bei-mailbox-org/mailbox-org-kostenlos-testen/)

## 3. Telefonnummer: Prepaid-SIM im alten Android-Handy

Viele Dienste lehnen Internet-Nummern bei der Bestätigung ab ([Beispiel OpenAI](https://help.openai.com/en/articles/8983024)). Zuverlässig ist nur eine echte Mobilfunknummer. Twilio vergibt deutsche Mobilnummern nur an Gewerbe mit Nachweis (30 $/Monat), sipgate nur in Business-Tarifen.

1. ALDI-TALK-Starter-Set kaufen (9,99 € inkl. 10 € Guthaben), registrieren, mit Ausweis identifizieren.
2. SIM in ein altes Android-Handy (ab Android 6), dauerhaft an Strom und WLAN. In Google Messages RCS abschalten.
3. Über F-Droid die App [SMS2Email](https://f-droid.org/en/packages/io.github.sms2email.sms2email/) installieren. Als Versand `smtp.mailbox.org`, Port 465, mit einem **eigenen** App-Kennwort aus Schritt 2 eintragen, Ziel ist die Adresse der Agenten.
4. Akku-Optimierung für die App ausschalten, Test-SMS schicken.
5. Leitstand → **Einstellungen** → Telefonnummer: „Weiterleitung ins Postfach“ wählen, Nummer eintragen.

Die Agenten finden Codes dann mit `leitstand mail codes`. Die SIM bleibt 12 Monate aktiv; eine Aufladung von 15 € verlängert um weitere 12.

Hast du später einen Gewerbenachweis für Twilio, trägst du dort Account SID, Auth Token und Nummer ein; der Leitstand fragt die SMS dann direkt ab.

## 4. Karte: Revolut, virtuelle Karte mit Monatslimit

0 € im Tarif Standard. Ausweichlösung: bunq Free mit einem eigenen Unterkonto für die Karte.

1. Revolut-App, Tarif **Standard**, mit Ausweis identifizieren.
2. Nur das Budget der Agenten aufladen. Das Guthaben ist die harte Obergrenze.
3. Karten → neue **virtuelle Karte** anlegen (nicht die Einwegkarte, die taugt nicht für Abos).
4. Karte → Einstellungen → **Ausgabenlimit** einschalten und Monatsbetrag setzen.
5. Leitstand → **Einstellungen** → Karte: Nummer, Ablaufdatum, Prüfziffer, Inhaber, Rechnungsadresse eintragen. Dazu zwei Grenzen:
   - **Ohne Rückfrage bis:** Zahlungen bis zu diesem Betrag gehen sofort durch, etwa 10 €.
   - **Monatsbudget:** Darüber fragt der Leitstand immer, etwa 100 €.

Im Notfall die Karte in der Revolut-App einfrieren. Der Weg in der App stammt aus der englischen Revolut-Hilfe; die deutschen Menünamen können leicht abweichen.

Quellen: [Monatslimit](https://help.revolut.com/en-DE/help/card-payments-withdrawals/getting-started-with-card-payments/changing-card-security-settings/setting-a-monthly-spending-limit/), [virtuelle Karten](https://www.revolut.com/de-DE/cards/virtual-card/)

**Was mit den Kartendaten passiert:** Sie liegen verschlüsselt in `data/secrets.enc` auf diesem Rechner. Ein Agent bekommt sie erst mit einer freigegebenen Zahlung. Danach stehen sie im Sitzungsprotokoll dieses Agenten auf seiner Maschine. Deshalb: eigene Karte, kleines Guthaben, Limit beim Anbieter.

## 5. Server für die Flotte

Faustregel des Leitstands: 1,2 GB Arbeitsspeicher je Agent. Ein wartender Agent braucht rund 200 MB (gemessen), der Rest ist Platz für Tests und Builds. Die Zahl der Plätze je Maschine kannst du unter „Flotte“ ändern.

| Weg | Konfiguration für 50 Agenten | Kosten/Monat | Abrechnung |
|---|---|---|---|
| **A: Contabo** (empfohlen für die Dauerflotte) | 2× Cloud VPS 16 (je 16 vCPU, 64 GB) | ca. 74 € | monatlich |
| **B: Hetzner** (auf Knopfdruck im Leitstand) | 3× `cpx62` (je 16 vCPU, 32 GB) | ca. 466 € brutto | stündlich |

Hetzner ist seit der Preiserhöhung 2026 rund fünfmal teurer und nimmt laut [Statusmeldung](https://status.hetzner.com/incident/0a75c7ae-3377-41dc-aabe-601063724d24) seit Juni Neukunden zeitweise nicht an. Dafür lässt sich dort stundenweise mieten.

### Weg A: Contabo

1. Leitstand → **Flotte** → den öffentlichen Schlüssel kopieren.
2. Bei [contabo.com](https://contabo.com/de/vps/) einen **Cloud VPS 16** mit **Ubuntu 24.04** bestellen und beim Bestellen den Schlüssel als SSH-Key hinterlegen.
3. Sobald die IP-Adresse da ist: Leitstand → **Flotte** → „Maschine per SSH hinzufügen“ → Name, IP, Benutzer `root`.

Der Leitstand richtet den Server dann selbst ein: Nutzer `agent` ohne Root-Anmeldung, SSH nur per Schlüssel, Firewall, Claude Code, Chrome für den Browser der Agenten, deine Abo-Tokens. Das dauert ein paar Minuten; der Status steht in der Maschinen-Karte.

Ob die 37 € brutto oder netto gelten, zeigt Contabo erst im Bestellvorgang.

### Vorhandener Server, auf dem schon etwas läuft

Die Ersteinrichtung über `root` ist für frische Server gedacht: Sie schaltet die root-Anmeldung ab und setzt die Firewall. Für einen Server mit laufenden Diensten nimmst du stattdessen:

```bash
deploy/server-aufnehmen.sh root@adresse name 4
```

Das legt dort nur den Nutzer `leitstand` ohne sudo-Rechte an und hinterlegt den Schlüssel. SSH-Einstellungen, Firewall und Dienste bleiben, wie sie sind. Die letzte Zahl sind die Plätze; lass auf einem geteilten Server Luft für das, was dort schon läuft.

### Weg B: Hetzner

1. Konto bei Hetzner anlegen. Hetzner kann vor der ersten Bestellung eine Ausweiskopie oder Vorauszahlung verlangen.
2. Hetzner Console → Projekt → Sicherheit → API-Tokens → Token mit **Lesen und Schreiben** erzeugen.
3. Leitstand → **Einstellungen** → Hetzner: Token eintragen, Standort wählen (Helsinki ist rund 15 % günstiger).
4. Leitstand → **Flotte** → „Server bei Hetzner erstellen“: Der Dialog zeigt die Typen, die gerade bestellbar sind, mit Preis. Nach deiner Bestätigung wird bestellt und eingerichtet.

Ausgeschaltete Server kosten weiter. Zum Beenden die Maschine unter „Flotte“ entfernen und das Löschen des Servers bestätigen.

### Projekte auf den Servern

Unter **Projekte** ein Projekt anlegen, als Maschine den Server wählen, Ordner etwa `~/projekte/name`. Auf eigenen Servern passt der Modus „Autonom“: Der Agent hat dort seinen eigenen Rechner und kann nichts von dir beschädigen.

## 6. Zugriff vom Handy

Der Leitstand ist nur von diesem Rechner aus erreichbar. Für unterwegs gibst du ihn in deinem privaten Tailscale-Netz frei (Tailscale ist auf diesem Mac schon installiert).

1. Auf diesem Rechner: `tailscale serve --bg 4747`. Der Befehl nennt die Adresse, etwa `mein-mac.tail1234.ts.net`.
2. Leitstand → **Einstellungen** → Zugriff vom Handy: Adresse und ein Kennwort mit mindestens 16 Zeichen eintragen.
3. Auf dem Handy (Tailscale-App an) `https://` plus Adresse öffnen, anmelden, zum Home-Bildschirm hinzufügen.

Der kostenlose Tailscale-Tarif ist laut Preisseite für nicht-kommerzielle Nutzung gedacht.

## Was ich nicht testen konnte

Getestet sind echte Agentenläufe auf diesem Mac: Warteschlange bei vollen Plätzen, Erlaubnis-Anfragen, Kontext, Tresor, Zahlung mit automatischer und manueller Freigabe, Nachrichten zwischen Projekten, Zugriffsschutz. Für den Rest fehlten Konten oder ein Server:

| Baustein | Stand |
|---|---|
| Vorhandenen Server aufnehmen (`deploy/server-aufnehmen.sh`) | am 14.11.2026 mit einem echten Server geprüft: Einrichtung, Tunnel, Abschottung der Steuerung |
| Agenten auf einem Server starten | am 14.11.2026 geprüft: Lauf auf `vps-1` über ein Abo-Token, Kommando `leitstand` durch den Tunnel |
| Ersteinrichtung eines frischen Servers (Nutzer, Firewall, Installation) | ungetestet |
| Hetzner: Typen abfragen, Server erstellen und löschen | nach der aktuellen API-Beschreibung gebaut, ohne Token ungetestet |
| Postfach lesen und senden | nur der Fehlerfall getestet (falscher Server) |
| Twilio-Abfrage | ungetestet |
| Browser der Agenten | ungetestet; das Ausprobieren wurde in meiner Sitzung blockiert |
| Wechsel des Abo-Kontos bei erreichtem Limit | gebaut, aber kein echtes Limit ausgelöst |
| Anmeldung über Tailscale | ungetestet |
| Mitschnitt im Browser | ungetestet |

Rechne beim ersten echten Server und beim ersten Postfach mit Nacharbeit. Sag mir dann, was die Maschinen-Karte oder „Verbindung testen“ meldet.
