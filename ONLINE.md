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
- Spielaktionen erscheinen sofort und werden im Hintergrund geordnet gespeichert. Schnelle Klickfolgen werden gebündelt; währenddessen zeigt die Verbindungsanzeige die ausstehenden Aktionen. Erst bei **gespeichert** ist alles bestätigt. Bei Verbindungsfehlern wird erneut übertragen, ohne eine bestätigte Aktion doppelt auszuführen. Ungültige Aktionen werden anhand des Serverstands korrigiert.
- Für einen Gerätewechsel vorher unter **Menü** den **persönlichen Fortsetzungslink** sichern. Dieser Link enthält den geheimen Spielerschlüssel und darf nicht mit Gegnern geteilt werden. Der normale Einladungslink enthält ihn nicht. Nach Öffnen eines persönlichen Links entfernt das Spiel den Schlüssel aus der Adresszeile.
- Wer seinen Browser-Speicher löscht und keinen persönlichen Link gesichert hat, kann die Farbe nicht wieder übernehmen. Es gibt keine Konten und keine automatische Rücksetzung fremder Farben.
- Beim Öffnen derselben Farbe auf mehreren Geräten bleiben parallele Zugversuche durch eine Versionsprüfung abgesichert. Ein veralteter Zug wird abgelehnt und der aktuelle Stand geladen.

## Betrieb und Prüfung

Partien liegen dauerhaft in `public.orbis_rooms`. Es ist keine automatische Löschung vorgesehen. Supabase-Verfügbarkeit, Projektpausen und Limits des gewählten Tarifs gelten weiterhin. Für einen größeren öffentlichen Betrieb sollten zusätzlich Anfrage- und Lobby-Limits am Server eingerichtet werden.

Nur die Funktion darf Spielstände schreiben. Sie prüft Farbe, Zug, Startrecht, Aktionsregeln und Versionsnummer; vom Browser wird kein fertiger Spielstand übernommen. Spielerschlüssel werden nur als SHA-256-Hash gespeichert und nicht an andere Teilnehmer ausgegeben.

Das GitHub-Repository enthält das fertige Supabase-Bundle. Im vollständigen lokalen Entwicklungsprojekt nach Änderungen an `docs/engine.mjs`, `docs/world.mjs` oder `server/room-service.mjs` erneut `python tools/prepare-online.py` ausführen und die Funktion neu veröffentlichen. Website und Server müssen dieselben Regeln verwenden.

```powershell
node tools/online-checks.mjs
node tools/queue-checks.mjs
node tools/web-checks.mjs
python tools/browser-web-check.py
python tools/browser-online-check.py
```

Die lokalen Onlineprüfungen brauchen kein Supabase-Konto. Sie prüfen denselben Serverdienst mit einer lokalen Datenspeicherung. Die tatsächliche Supabase-Installation muss nach Einrichtung separat geprüft werden.

Offizielle Dokumentation: [Edge Functions bereitstellen](https://supabase.com/docs/guides/functions/deploy), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).


## Online-Synchronisation ab sync-23

Realtime-Broadcast meldet lediglich Revisionen. Zustandsdaten bleiben hinter der Sitzpruefung in der Edge Function. Oeffentliche Kanaele enthalten keine Spielstaende oder Sitzschluessel. Eine Minute Kontrollintervall; bei Ausfall fuenf Sekunden, im Hintergrund dreissig Sekunden.

Beide neuen Migrationen 202610240001_room_cleanup.sql und 202610240002_delta_reads.sql vor der Funktion bereitstellen. Die RPC-Funktionen sind nur fuer service_role freigegeben. Die Funktion liefert dem Browser nur den oeffentlichen Anon-Key fuer Realtime, niemals den Service-Role-Key.

Dateisicherungen und Raumloeschung sowie die Kapazitaetsrechnung stehen in [CAPACITY.md](CAPACITY.md). `node tools/sync-checks.mjs` prueft Deltaaufbau und Dateifortsetzung. `node tools/network-benchmark.mjs` erzeugt die reproduzierbare Verbrauchsschaetzung. Cloud-QA: `python tools/live-sync-check.py`, `python tools/parallel-sync-check.py` und `python tools/browser-online-check.py --cloud` (legt temporaere Raeume an und loescht sie anschliessend).
