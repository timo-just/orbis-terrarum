# Orbis Terrarum: dauerhafter Onlinebetrieb

Die Umstellung vom 24.10.2026 ist eingerichtet:

- Spieladresse: https://timo-just.github.io/orbis-terrarum/
- Dauerhafter Spielserver und alternative Spieladresse:
  https://orbis-terrarum.timo-just.workers.dev/
- Server-API: https://orbis-terrarum.timo-just.workers.dev/api
- Konfiguration: `cloudflare/wrangler.production.jsonc` im lokalen Gesamtprojekt.

Neue Online-Lobbys verwenden Cloudflare Durable Objects mit SQLite und direkten
WebSockets. Offlinepartien und heruntergeladene Dateien benötigen keinen Server.
Für die kostenlose workers.dev-Adresse ist keine eigene Domain erforderlich.

Vorhandene Supabase-Einladungslinks bleiben unterstützt: Wird ein alter Raum
bei Cloudflare nicht gefunden, versucht der Client einmalig den bisherigen
Supabase-Server und bleibt für diese Partie dort. Neue Räume werden dabei
nicht mehr auf Supabase angelegt. Alte Räume werden nicht automatisch kopiert.
Für einen Wechsel Datei herunterladen und als neue Cloudflare-Lobby öffnen.
Supabase erst abschalten, wenn die alten Partien gesichert oder beendet sind.

Jeder aktive Cloudflare-Raum hält einen aktuellen, wiederverbindbaren Spielstand.
Dateisicherungen werden auf das Gerät heruntergeladen. Der Gastgeber kann
den Raum danach schließen; der alte Link ist dann ungültig. Der Ablaufalarm
entfernt inaktive Cloudflare-Räume nach sieben Tagen ohne Spieländerung.

## Aktualisierungen veröffentlichen

Im Gesamtprojekt `D:\Orbis_Terrarum`:

```powershell
npx --yes --package=node@22 --package=wrangler@4 wrangler deploy --config cloudflare/wrangler.production.jsonc
```

Falls die Anmeldung abgelaufen ist, zuvor mit demselben Cloudflare-Konto anmelden:

```powershell
npx --yes --package=node@22 --package=wrangler@4 wrangler login
```

Änderungen am Browserclient außerdem im GitHub-Pages-Repository veröffentlichen.
Die Konfigurationsdatei `online-config.mjs` enthält ausschließlich öffentliche
Serveradressen. Keine Cloudflare-Zugriffsschlüssel in GitHub oder Spielstände kopieren.

## Kontrolle

Im Cloudflare-Dashboard unter **Workers & Pages → orbis-terrarum → Metrics**
stehen die Worker-Anfragen. Die Durable-Objects- und SQLite-Nutzung zusätzlich
in der Durable-Objects-Ansicht prüfen. Die Kontingente gelten für die entsprechenden Produkte jeweils für alle Anwendungen desselben Kontos.
Der Messendpunkt des Prototyps ist im regulären Betrieb ausgeschaltet.

Die Prototyp-Messung ergab eine SQL-Schreibzeile je bestätigtem Aktionspaket.
Bei durchschnittlich 300 Paketen pro Partie erscheint ein Startbudget von
5.000 gleichmäßig verteilten Partien pro Monat plausibel; die reine
Schreibkontingent-Rechnung liegt mit Zuschlägen bei etwa 9.300–9.500/30 Tage.
Das ist keine Zusage oder gemessene Monatsabrechnung. Tageslimits, aktive
Cloud-Laufzeit und die tatsächliche Aktionszahl müssen beobachtet werden.
Ausführliche Messberichte befinden sich im lokalen Ordner `cloudflare/README.md`
und unter `build/cloudflare-*.json`.
