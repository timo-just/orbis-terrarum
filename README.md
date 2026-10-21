# Orbis Terrarum

Ein rundenbasiertes Gebietseroberungsspiel für **ein bis sechs Menschen an einem Bildschirm**. Die Browser-Version enthält keine KI, kein Training und keine Bewertungsleiste. Ein Spieler ist ein Übungsmodus.

Lokales Spielen läuft vollständig statisch, ohne Build, Konto oder Backend. Das Spiel funktioniert auch unter `/orbis-terrarum/`. Für geräteübergreifende Onlinepartien ist zusätzlich die vorbereitete Supabase-Anbindung nötig; siehe `ONLINE.md` im Repository. Diese ist erst nach Einrichtung des Servers aktiv.

## Bei GitHub Pages hochladen

### Einfacher Weg mit dem ZIP

1. Erstelle auf GitHub ein öffentliches Repository namens **`orbis-terrarum`**.
2. Entpacke `orbis-terrarum.zip`. Lade **den Inhalt** in das Hauptverzeichnis des Repositorys hoch. `index.html` muss direkt dort liegen, nicht in einem zusätzlichen Unterordner.
3. Öffne **Settings → Pages**. Wähle **Deploy from a branch**, den Branch **main** und den Ordner **/(root)**. Speichern.
4. Nach der Veröffentlichung liegt das Spiel unter:

   ```text
   https://timo-just.github.io/orbis-terrarum/
   ```

Du kannst auch einen anderen Repositorynamen verwenden; die relativen Dateipfade funktionieren weiterhin.

### Wenn du das vollständige Entwicklungsprojekt hochlädst

Die fertige Website liegt im Ordner `docs/`. Wähle bei Pages **main → /docs** statt `/(root)`. Android-Projekt, Trainingsstände und Build-Verzeichnisse gehören nicht zum Web-Upload.

Die Einstellungen entsprechen der [offiziellen GitHub-Pages-Anleitung](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Lokal spielen

Öffne im entpackten Ordner ein Terminal:

```powershell
python -m http.server 8000
```

Danach im Browser **http://localhost:8000/** öffnen. Im vollständigen Entwicklungsprojekt stattdessen:

```powershell
python -m http.server 8000 --directory docs
```

Die HTML-Datei benötigt wegen der JavaScript-Module einen HTTP-Aufruf; bitte nicht nur per Doppelklick als `file://` öffnen.

## Bedienung

| Aktion | Maus / Tastatur |
| --- | --- |
| Provinz auswählen | Eigene Provinz anklicken |
| Ausgewählte Anzahl erhöhen | Dieselbe Provinz erneut anklicken |
| Alle beweglichen Einheiten auswählen | **Alle** im Einheitenmenü |
| Anzahl fein einstellen | Schieberegler oder **− / +** |
| Einheitentyp wählen | **Soldaten / Reiter / Bogenschützen** |
| Bewegen oder angreifen | Gruppe auswählen, dann direkt verbundene Nachbarprovinz anklicken |
| Zoomen | Mausrad; der Punkt unter dem Mauszeiger bleibt an derselben Stelle |
| Karte verschieben | Mit linker oder rechter Maustaste ziehen |
| Auswahl aufheben | Hintergrund anklicken oder **Esc** |
| Mauer bauen / abreißen | Im Baumenü wählen, dann markierte Kante anklicken |
| Turm bauen / abreißen | Im Baumenü wählen, dann markierte Ecke anklicken |
| Nachschub verteilen | Je Klick auf eine eigene Provinz einen Soldaten setzen |

Auf Touchgeräten sind zusätzlich Zweifinger-Zoom und Verschieben möglich. Im lokalen Modus spielen alle nacheinander am selben Gerät. Nach Servereinrichtung gibt es außerdem Online-Lobbys für zwei bis sechs Geräte mit Einladungslink, fester Farbe und gespeichertem Spielstand. Jede Lobby bietet sechs Plätze; der Gastgeber kann ab zwei Teilnehmern starten. Neue Spieler geben vor dem Beitritt ihren Namen ein und können ihn in der Lobby ändern. Unter **Lobby / Links** kann jeder seinen persönlichen Fortsetzungslink sichern.

## Spielregeln

- Die Farben sind Blau, Rot, Grün, Gelb, Lila und Schwarz. Startprovinzen werden in dieser Reihenfolge gewählt. Die Züge laufen anschließend **umgekehrt**. Jede Startprovinz erhält fünf Soldaten.
- Ab der zweiten Runde gibt es pro Zug einen Nachschubpunkt je eigener Provinz, mit Kaserne zwei. Alle Punkte werden zunächst frei als Soldaten auf eigene Provinzen verteilt. Erst danach sind normale Aktionen erlaubt.
- Soldaten und Bogenschützen bewegen sich einmal, Reiter zweimal pro eigenem Zug. Bereits verbrauchte Einheiten des aktiven Spielers sind grau; Reiter nach dem ersten Schritt halb grau.
- **3 Soldaten → 1 Reiter**, **1 Reiter → 2 Soldaten**, **10 Soldaten → 1 Bogenschütze**, **1 Bogenschütze → 5 Soldaten**. Verbrauchte Bewegung wird beim Umtausch übernommen.
- Reiter und Soldaten sind im Nahkampf gleich stark. Bogenschützen geben keine Nahkampfverteidigung; bei einer Eroberung werden sie vernichtet. Bogenschützen können nur in eigene Provinzen ziehen.
- Jeder Bogenschütze schießt einmal zu Beginn des eigenen Zuges auf einen direkt verbundenen Gegner. Berge blockieren diese Verbindung; Flüsse und Mauern verhindern Beschuss nicht. Mehrere Schützen dürfen dieselbe Provinz treffen.
- Flüsse halbieren einen feindlichen Angriff, Mauern auf der Zielseite ebenfalls. Zusammen bleibt **ein Viertel** der Angriffskraft. Bruchteile werden abgerundet; bei gleicher Angriffskraft und Verteidigung bleibt die Provinz beim Verteidiger.
- **Kaserne: 10 Soldaten.** Erhöht die Produktion dieser Provinz auf zwei Nachschubpunkte. Wird mit der Provinz übernommen.
- **Mauer: 5 Soldaten**, Abriss gibt **2** zurück. Sie liegt auf der Innenseite einer passierbaren Grenze und schützt nur bei Angriffen auf diese Provinz.
- **Grenzturm: 5 Soldaten**, Abriss gibt **2** zurück. Ein Turm je Provinz und Ecke; mehrere Provinzen können an derselben Ecke je einen eigenen Turm haben. Mauern verhindern ihn nicht. Er feuert einmal pro eigenem Zug auf eine gegnerische Provinz an dieser Ecke. Ein Besitzerwechsel hebt die Sperre bis zum nächsten Zug des getroffenen Spielers nicht auf.
- **Fahne verlegen: 10 Soldaten** aus der neuen eigenen Provinz. Nach Eroberung einer Fahne gehen alle übrigen Provinzen und Gebäude dieser Fraktion an den Eroberer. Die Einheiten des besiegten Spielers werden gelöscht, überlebende Angreifer bleiben erhalten.
- Ausgeschiedene Spieler werden übersprungen. Die letzte aktive Fraktion gewinnt. Nach 150 Runden endet eine Partie unentschieden; der Einzelspielermodus bleibt bis dahin spielbar.
- Die Karte besteht aus vollständigen unregelmäßigen Voronoi-Zellen. Seen belegen jeweils ein bis drei Wasserzellen und können zusammenwachsen. Flüsse verlaufen zusammenhängend auf Kanten und enden an Küste oder See. Gebirge sperren Übergänge.

## Speichern

Die Partie wird nach jeder Aktion automatisch im lokalen Speicher dieses Browsers gespeichert. Über **Menü → Gespeicherte Partie fortsetzen** kann sie wieder geöffnet werden. Nach einem Neuladen steht dieselbe Schaltfläche im Startmenü.

Lokale Spielstände bleiben auf diesem Gerät, in diesem Browser und unter derselben Website-Adresse. Im privaten Modus oder bei gesperrtem Browserspeicher ist dauerhaftes Speichern eventuell nicht verfügbar; das Spiel zeigt dies an. Onlinepartien werden dagegen nach jeder bestätigten Aktion auf dem Server gespeichert und synchronisiert. Derselbe Browser findet über den Einladungslink seine Farbe wieder; auf einem anderen Gerät benötigt man den persönlichen Fortsetzungslink. Diesen Link geheim halten.

## Dateien

`index.html` und `style.css` bilden das Overlay, `app.mjs` zeichnet die Karte und verarbeitet Eingaben, `engine.mjs` enthält die Spielregeln, `world.mjs` die Kartengenerierung. `icons.mjs` enthält die Vektorsymbole aus der Android-Version. Alle Dateien müssen gemeinsam hochgeladen werden.

Im vollständigen Entwicklungsprojekt:

```powershell
node tools/web-checks.mjs
python tools/browser-web-check.py
```

Der erste Befehl prüft Regeln und Kartentopologie. Der zweite testet die tatsächliche Bedienung mit einem lokal installierten Chrome oder Edge und dem Python-Modul `websocket-client`. Er legt Screenshots und einen Bericht in `build/web-qa/` ab und beendet seinen Testserver anschließend wieder.
