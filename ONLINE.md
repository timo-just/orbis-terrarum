# Onlinepartien mit Supabase einrichten

Die Website bleibt unter https://timo-just.github.io/orbis-terrarum/. GitHub Pages liefert die Dateien; eine Supabase Edge Function prüft Züge und speichert Lobby und Partie in Postgres. Der Onlinebetrieb ist erst nach diesen Schritten aktiv. Lokales Spielen benötigt Supabase nicht.

1. Ein Supabase-Projekt erstellen. Im SQL Editor den Inhalt von `supabase/migrations/202610220001_orbis.sql` ausführen.
2. Supabase CLI installieren und anmelden. Im Projektordner ausführen:

   ```powershell
   supabase login
   supabase link --project-ref DEINE_PROJEKT_ID
   supabase functions deploy orbis --no-verify-jwt
   ```

3. Die Funktionsadresse lautet `https://DEINE_PROJEKT_ID.supabase.co/functions/v1/orbis`. In `docs/online-config.mjs` als `ONLINE_URL` eintragen und diese Datei im GitHub-Repository als `online-config.mjs` aktualisieren.

   ```js
   export const ONLINE_URL = 'https://DEINE_PROJEKT_ID.supabase.co/functions/v1/orbis';
   ```

Die Funktion verwendet die automatisch bereitgestellten Server-Variablen `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY`. **Keine Service-Role-Schlüssel ins Frontend oder Repository schreiben.** Es wird kein öffentlicher Supabase-Key im Browser benötigt: Die Funktion authentifiziert die Geräte mit eigenen zufälligen Spielerschlüsseln. `verify_jwt = false` ist dafür absichtlich gesetzt. Unauthentifizierter direkter Datenbankzugriff ist durch RLS und fehlende Grants gesperrt.

## Spielen und Fortsetzen

- Name eintragen und **Online-Lobby erstellen**. Jede Lobby bietet sechs Plätze. Der Server erzeugt dieselbe Karte wie die gewählte Vorschau aus deren Kartenschlüssel und Einstellungen.
- Einladungslink teilen. Jedes beitretende Gerät bekommt eine feste Farbe. Neue Spieler geben vor dem Beitritt ihren Namen ein. Der Gastgeber kann mit zwei bis sechs Teilnehmern starten; leere Plätze werden nicht mitgespielt. Namen lassen sich in der Lobby ändern.
- Alle Geräte zeigen dieselbe Partie; nur das Gerät der aktiven Farbe kann Züge ausführen. Änderungen erscheinen spätestens nach dem nächsten Abgleich (normal etwa 1,5 Sekunden).
- Der Server speichert jede bestätigte Aktion. Später denselben Link im selben Browser öffnen. Die Farbe wird über den lokal gespeicherten Geräteschlüssel wiederhergestellt.
- Für einen Gerätewechsel vorher unter **Lobby / Links** den **persönlichen Fortsetzungslink** sichern. Dieser Link enthält den geheimen Spielerschlüssel und darf nicht mit Gegnern geteilt werden. Der normale Einladungslink enthält ihn nicht. Nach Öffnen eines persönlichen Links entfernt das Spiel den Schlüssel aus der Adresszeile.
- Wer seinen Browser-Speicher löscht und keinen persönlichen Link gesichert hat, kann die Farbe nicht wieder übernehmen. Es gibt keine Konten und keine automatische Rücksetzung fremder Farben.
- Beim Öffnen derselben Farbe auf mehreren Geräten bleiben parallele Zugversuche durch eine Versionsprüfung abgesichert. Ein veralteter Zug wird abgelehnt und der aktuelle Stand geladen.

## Betrieb und Prüfung

Partien liegen dauerhaft in `public.orbis_rooms`. Es ist keine automatische Löschung vorgesehen. Supabase-Verfügbarkeit, Projektpausen und Limits des gewählten Tarifs gelten weiterhin. Für einen größeren öffentlichen Betrieb sollten zusätzlich Anfrage- und Lobby-Limits am Server eingerichtet werden.

Nur die Funktion darf Spielstände schreiben. Sie prüft Farbe, Zug, Startrecht, Aktionsregeln und Versionsnummer; vom Browser wird kein fertiger Spielstand übernommen. Spielerschlüssel werden nur als SHA-256-Hash gespeichert und nicht an andere Teilnehmer ausgegeben.

Das GitHub-Repository enthält das fertige Supabase-Bundle. Im vollständigen lokalen Entwicklungsprojekt nach Änderungen an `docs/engine.mjs`, `docs/world.mjs` oder `server/room-service.mjs` erneut `python tools/prepare-online.py` ausführen und die Funktion neu veröffentlichen. Website und Server müssen dieselben Regeln verwenden.

```powershell
node tools/online-checks.mjs
node tools/web-checks.mjs
python tools/browser-web-check.py
python tools/browser-online-check.py
```

Die lokalen Onlineprüfungen brauchen kein Supabase-Konto. Sie prüfen denselben Serverdienst mit einer lokalen Datenspeicherung. Die tatsächliche Supabase-Installation muss nach Einrichtung separat geprüft werden.

Offizielle Dokumentation: [Edge Functions bereitstellen](https://supabase.com/docs/guides/functions/deploy), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
