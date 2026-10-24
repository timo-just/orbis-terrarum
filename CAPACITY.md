> Seit der Cloudflare-Umstellung betrifft dieser Bericht nur noch alte Supabase-Partien. Neue Onlinepartien nutzen Cloudflare. Aktueller Betrieb: [HOSTING.md](HOSTING.md).

# Orbis Terrarum: Onlinebetrieb und Kapazität

Stand: 24. Oktober 2026. Kostenloser Supabase-Tarif vorausgesetzt.

Die Website und Grafiken kommen von GitHub Pages. Supabase prüft Spielzüge und
hält genau einen aktuellen Stand je Online-Raum. Es gibt kein separates
Spielstandarchiv und keine hochgeladenen Sicherungsdateien in Supabase Storage.
Dauerhafte Sicherungen werden als JSON-Datei heruntergeladen.

## Was geändert wurde

- Realtime meldet nur eine neue Versionsnummer, keine Spielerdaten oder Schlüssel.
  Danach liest der Browser den autorisierten Stand. Direkte Aktionen erscheinen
  weiterhin sofort durch die lokale Aktionswarteschlange.
- Bei intakter Verbindung nur eine Kontrollabfrage pro Minute und Gerät;
  vorher ungefähr eine pro Sekunde. Wiederverbinden gleicht den Stand ab.
  Ohne Realtime greift ein Fallback mit 5 Sekunden, im Hintergrund 30 Sekunden.
- Mehrere Benachrichtigungen innerhalb von 120 ms werden zusammengefasst.
- Unveränderte Kontrollabfragen lesen nur Version und Sitzberechtigungen.
- Änderungen übertragen nur betroffene Provinzen und geänderte Felder.
  Bis zu 32 verpasste Revisionen werden zusammengeführt; bei größerer Lücke
  wird ein vollständiger dynamischer Stand nachgeladen. Kartengeometrie wird
  nach der ersten Übertragung nicht erneut zum Browser geschickt.
- Postgres bereitet Zuschauer-Deltas direkt vor. Auch zwischen Datenbank und
  Server werden kleine Änderungen nicht als vollständige Karte übertragen.
- Rückgängig-Daten werden nur an den Spieler geschickt, der sie benutzen darf.
  Bestätigungen bereits bekannter Aktionspakete werden weggelassen.
- Datenbankänderungen bleiben atomar mit Versionsvergleich. Sitzberechtigungen,
  Wiederholschutz und sämtliche Spielregeln bleiben auf dem Server geprüft.

## Speichern und Löschen

Im Online-Menü kann jeder eine Datei herunterladen. Der Gastgeber kann mit
„Datei herunterladen und Online-Raum schließen“ zusätzlich den Raum löschen.
Das betrifft alle Teilnehmer; der alte Einladungslink funktioniert danach nicht
mehr. Ein normaler Klick auf Hauptmenü löscht die Partie nicht.

Zur späteren Fortsetzung: Datei laden, Menü → „Diese Datei online fortsetzen“,
neuen Link teilen. Die Spieler treten in Farbreihenfolge bei. Zum Start wird
die ursprüngliche Spielerzahl benötigt; die Position und der Zug bleiben erhalten.

Beim Erstellen einer neuen Lobby werden Räume entfernt, deren letzte Aktion
mindestens sieben Tage zurückliegt. Das ist eine bedarfsabhängige Bereinigung,
kein stündlicher Löschdienst. Vor längeren Pausen deshalb eine Datei sichern.
Normale Abfragen verlängern diese Frist nicht. Bestehende Browser-Sicherungen
bleiben ladbar; lokale automatische Browserkopien brauchen keinen Supabase-Platz.

## Messergebnisse und Annahmen

`node tools/network-benchmark.mjs` simuliert jeweils 300 gesendete Aktionspakete
mit Gebäuden, Umtausch, Nachschub und Zugwechseln auf 100 Provinzen.
Die Kapazitätsrechnung setzt eine Stunde Laufzeit, ein Gerät/Tab pro Spieler,
funktionierendes Realtime und jeweils eine Zustandsabfrage der anderen Spieler
pro Änderung voraus. Es ist keine gemessene Monatsabrechnung.

| Spieler | Aufrufe vorher | Aufrufe jetzt | Weniger | Browser-Nutzdaten | Vorsichtiges Datenbudget gesamt |
|---|---:|---:|---:|---:|---:|
| 2 | 7.500 | 727 | 90,3 % | 1,00 MB | 19,10 MB |
| 4 | 14.700 | 1.453 | 90,1 % | 1,70 MB | 22,51 MB |
| 6 | 21.900 | 2.179 | 90,1 % | 2,44 MB | 26,48 MB |

Das vorsichtige Budget zählt auch unkomprimierte Datenbank→Server-Nutzdaten,
schätzt HTTP-/WebSocket-Overhead hinzu und enthält 20 % Reserve. Supabase muss
diese internen Bytes nicht in exakt dieser Höhe abrechnen; Kompression kann
die tatsächlichen Werte senken. Große Kämpfe, häufiges Neuladen, längere
Undo-Verläufe und Karten mit 200 Provinzen können die Werte erhöhen.

Eine Änderungsantwort an einen Zuschauer hatte im Modell durchschnittlich
560/626/681 Byte bei 2/4/6 Spielern. Eine unveränderte Antwort hat etwa 79 Byte.
Ein realer Cloud-Test mit 40 Provinzen ergab 601 Byte für das Delta gegenüber
53.225 Byte für den vollständigen Stand. Das Wiederöffnen aus einer Datei
wurde am echten Server geprüft; alle QA-Räume wurden anschließend gelöscht.

## Monatliche Partien

Supabase Free bietet 500.000 Funktionsaufrufe, 2 Millionen Realtime-Nachrichten
und 5 GB ungekachten ausgehenden Datenverkehr pro Abrechnungszeitraum.
Diese Kontingente teilen sich alle Projekte derselben Organisation.

| Spieler | Grenze nur nach Aufrufen | Grenze nach vorsichtigem Datenbudget | Vorsichtige Planungszahl |
|---|---:|---:|---:|
| 2 | 687 | 261 | rund 260 einstündige Partien |
| 4 | 344 | 222 | rund 220 einstündige Partien |
| 6 | 229 | 188 | rund 180 einstündige Partien |

Dies gilt für ein vollständig verfügbares Monatskontingent. Bereits angefallene
Nutzung, Tests und andere Projekte müssen abgezogen werden. Die Zahlen der
Zeilen sind Alternativen und können nicht addiert werden. Viele schnelle
Einzelaktionen verbrauchen mehr als dieselbe Anzahl lokal gebündelter Aktionen.
Bei doppelter Dauer und doppelter Aktionszahl sinkt die Anzahl ungefähr auf die Hälfte.
Ein ruhender offener Raum benötigt mit funktionierendem Realtime ungefähr
60 Kontrollaufrufe je Stunde und Gerät, unabhängig von seiner Dateigröße.

## Parallele Partien

Der Free-Tarif erlaubt bis zu 200 gleichzeitige Realtime-Verbindungen und
100 Realtime-Nachrichten pro Sekunde. Ein offener Spieltab benötigt eine Verbindung.

| Spieler je Partie | Rechnerische Verbindungsobergrenze |
|---|---:|
| 2 | 100 parallele Partien |
| 4 | 50 parallele Partien |
| 6 | 33 parallele Partien |

Das sind Tarifobergrenzen, keine zugesicherte Geschwindigkeit oder durchgeführte
Volllastmessung. Weitere Tabs, offene Lobbys, gleichzeitig eintreffende Aktionen
und Datenbankleistung begrenzen die Praxis. Erprobt wurden zehn parallele
Zweispielerräume mit insgesamt 20 WebSocket-Verbindungen und zehn gleichzeitigen
Schreibaktionen. Benachrichtigung inklusive Schreibvorgang: Median 1.250 ms,
Maximum 1.578 ms in diesem kurzen Test. Das prüft den Ablauf, keinen Dauerbetrieb.

Die Monatsgrenze gilt zusätzlich: 100 Zweispielerpartien gleichzeitig für eine
Stunde verbrauchen ungefähr 100 der genannten rund 260 Monats-Partien.

## Ist Speicher ein Engpass?

Im Modell betrug der höchste JSON-Stand etwa 149–150 KB je 100-Provinzen-Raum,
einschließlich begrenzter Synchronisationshistorie. 100 solche aktive Räume
benötigen zusammen etwa 15 MB JSON, zuzüglich Datenbank- und Index-Overhead.
Das sind etwa 3 % des 500-MB-Datenbankkontingents vor Overhead; die tatsächliche
Postgres-Belegung kann durch Kompression und Seitengrößen abweichen.

Das Löschen der Onlinekopie macht das Spiel daher nicht wesentlich schneller.
Die großen Einsparungen kommen von weniger Abfragen und kleineren Übertragungen.
Dateisicherungen verhindern aber ein unbegrenzt wachsendes Archiv alter Partien.
Der separate 1-GB-Dateispeicher bleibt ungenutzt. Löschungen machen Datenbankseiten
wiederverwendbar; die angezeigte physische Datenbankgröße muss nicht sofort sinken.

Quellen: [Kontingente](https://supabase.com/docs/guides/platform/billing-on-supabase),
[Realtime-Grenzen](https://supabase.com/docs/guides/realtime/limits),
[Realtime-Nachrichten](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages),
[ausgehende Daten](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
