---
name: monkey
description: Gebruik dit wanneer expliciet om monkey testing wordt gevraagd,
  of om te proberen "het systeem stuk te krijgen" met willekeurige,
  onvoorspelbare of rare input — het woord "monkey" of "monkey testing".
---

# Monkey testing

Doel: het systeem laten crashen met domme, chaotische, onvoorspelbare input —
niet de slimme edge-cases die je toch al zou bedenken, maar echte willekeur.
Een crash die je hier vindt mag in een echte trainerssessie nooit gebeuren.

## Doelwit en veiligheid
- Test standaard alleen tegen een lokale testserver met verzonnen
  dummy-data — nooit tegen een bestand dat écht gesynchroniseerde
  spelersgegevens kan bevatten. Wil de gebruiker de productiepagina's zelf
  (index.html, wedstrijden.html, etc.) laten testen, vraag dat expliciet na
  voordat je dat doet.
- Startservertje (zelfde patroon als eerder in de projectsessies), poort
  8934, in de projectroot:
  ```powershell
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:8934/")
  $listener.Start()
  while ($listener.IsListening) {
    $ctx = $listener.GetContext(); $req = $ctx.Request
    $path = $req.Url.LocalPath.TrimStart('/'); if ($path -eq '') { $path = 'index.html' }
    $file = Join-Path (Get-Location) $path; $res = $ctx.Response
    if (Test-Path $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file)
      $res.ContentType = switch ($ext) { '.html'{'text/html'} '.css'{'text/css'} '.js'{'application/javascript'} default{'application/octet-stream'} }
      $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes,0,$bytes.Length)
    } else { $res.StatusCode = 404 }
    $res.OutputStream.Close()
  }
  ```
  Draai als background task, sluit 'm na afloop weer af.
- Als de gebruiker een specifiek scherm of flow meegeeft als argument,
  focus daarop. Zonder argument: loop systematisch alle bereikbare
  schermen van de app langs.
- Houd de console continu in de gaten (`read_console_messages`,
  `onlyErrors:true`) — check na élke golf hieronder, niet pas aan het eind.

## Golf 1 — Kwaadaardige tekstinvoer
Vul elk tekstveld/textarea achtereenvolgens met (willekeurige volgorde,
niet steeds hetzelfde patroon):
- Lege string, alleen spaties, één teken
- Extreem lange string (5000+ tekens)
- Emoji en multi-byte unicode (🔥💥⚽用户)
- `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`
- Quote/backslash-mix: `'"\`` en gecombineerde aanhalingstekens door elkaar
- Ingebedde newlines/tabs midden in de tekst
- RTL-tekst (Arabisch/Hebreeuws)

## Golf 2 — Numerieke en datum-grenswaarden
- Negatief, 0, extreem groot (1e20), decimaal waar een heel getal
  verwacht wordt (bijv. cijfers/leeftijd-velden)
- Tekst in een number-veld plakken, of leeg laten en toch opslaan
- Datums: ver verleden (1900), ver toekomst (2099), een ongeldige datum

## Golf 3 — Rapper en vaker klikken dan bedoeld
- Dubbel- en drieklikken op elke knop, met name two-tap-verwijderknoppen
  (breekt dat de timer? gaat 'ie per ongeluk twee keer af in plaats van
  netjes te bevestigen?)
- Razendsnel door een meerstaps-flow klikken vóórdat een render klaar is
- Twee sheets/modals na elkaar openen zonder de eerste te sluiten
- Annuleren en Opslaan vlak na elkaar aanklikken

## Golf 4 — Onmogelijke app-state via de console
Roep functies rechtstreeks aan via `javascript_exec`, met argumenten die de
UI zelf nooit zou toestaan:
- Een open-scherm-functie met een niet-bestaand ID (bijv. iets als
  `openWedstrijdBewerken('bestaat-niet')`, `toonScherm(null)`,
  `openSpelerBewerken(undefined)` — pas aan naar de echte functienamen)
- Een opslaan-functie aanroepen vóórdat het bijbehorende scherm ooit
  geopend is (dus zonder dat de verwachte globale state gezet is)
- Een vervolgstap van een flow aanroepen terwijl een tussenstap is
  overgeslagen (bijv. een wissel bevestigen zonder dat er een wissel
  gestart is)

## Golf 5 — Corrupte localStorage
Zet via `javascript_exec` bewust foute waarden in de localStorage-sleutels
die de app gebruikt, en herlaad pas daarna de pagina:
- Ongeldige JSON (een afgebroken string)
- Geldige JSON maar de verkeerde vorm (een array waar een object hoort te
  staan, een verplicht veld dat ontbreekt, `null` waar een object
  verwacht wordt)
- Check: crasht het al bij het laden van de pagina, of degradeert het
  netjes (lege staat, geen witte pagina, geen console-error-spam)?

## Golf 6 — Leeg op de bodem
Wis alle relevante data (`localStorage.clear()` of gericht de sleutels van
deze app) en loop dan élk scherm langs. Let specifiek op deel-door-nul in
percentage-/gemiddelde-berekeningen, een `.find()` die `undefined`
teruggeeft gevolgd door een property-toegang daarop, en `NaN`-waarden die
zomaar in de UI verschijnen.

## Golf 7 — Klik-storm
Verzamel via `document.querySelectorAll('button, a, [onclick]')` alle
klikbare elementen op het huidige scherm en klik ze via `javascript_exec`
in willekeurige volgorde en snel na elkaar — niet handmatig één voor één.
Dit is de kern van klassieke monkey testing: écht willekeurig, niet een
vast scenario dat je van tevoren hebt uitgedacht.

## Na elke golf
Noteer een vondst DIRECT wanneer je 'm ziet, niet pas achteraf proberen te
reconstrueren: welke actie precies, de exacte foutmelding/console-tekst,
en hoe je 'm opnieuw kunt opwekken.

## Rapporteren
Alleen rapporteren, nooit ongevraagd fixen — zelfde afspraak als bij een
architectuurcheck. Voor elke crash: bestand/functie, exacte
reproductiestappen, foutmelding, en een korte inschatting van de impact
(crasht het hele scherm, alleen die ene actie, of verliest de gebruiker
stilletjes data zonder dat er een foutmelding verschijnt — dat laatste is
vaak erger dan een zichtbare crash). Ruim na afloop altijd de testdata op
en sluit de testserver weer af.
