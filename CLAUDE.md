# fcp16-2

Trainersapp voor FC Purmerend JO16-2 (seizoen 2026/2027). Statische PWA:
vanilla HTML/CSS/JS, geen build-tool. Optionele Supabase-koppeling voor
gedeelde/realtime data tussen de trainers.

## Structuur

- `index.html` — start / kernprincipes
- `opstelling.html` — veldopstelling per formatie
- `selectie.html` — spelersbeheer + skills inladen (Excel)
- `schema.html` — trainingsschema, oefeningen, aanwezigheid
- `wedstrijden.html` — resultaten, cijfers, MOTM, ranking
- `team.html` — teamoverzicht speler-skills
- `oefeningen.html` — oefeningenbibliotheek
- `app.js` — gedeelde logica
- `style.css` — opmaak
- `manifest.json`, `sw.js` — PWA-installatie en offline gebruik

## Deploy

De app wordt gehost op **GitHub Pages** en gedeployed via **GitHub Actions**:
elke push naar de `main`-branch triggert automatisch een nieuwe deploy.
Er is geen los uploadproces (niet via Netlify of drag-and-drop) — `git push`
naar `main` is voldoende.

Let op: `README.txt` in dit repo beschrijft nog het oude Netlify-uploadproces
en is verouderd op dit punt.

## Werkwijze-afspraken

### Testen, niet aannemen
- Valideer gewijzigde bestanden altijd op syntaxfouten voordat je iets
  "klaar" noemt.
- Test schrijfacties naar Supabase altijd echt: een rij aanmaken/wijzigen,
  het resultaat controleren, en bij een test met bestaande data die
  netjes terugzetten naar de oorspronkelijke waarde.
- Gebruik nooit een "verwijderen en opnieuw aanmaken"-patroon om een rij
  te verversen als er een andere tabel met ON DELETE CASCADE naar die rij
  verwijst — dat veegt gekoppelde data weg. Gebruik dan een update.
- Neem nooit aan dat bestaande code doet wat de naam doet vermoeden —
  lees de code eerst na voordat je een aanname baseert op hoe iets
  "waarschijnlijk" werkt.

### Voordat er iets naar GitHub gaat
- Vraag altijd expliciet toestemming voordat je commit en pusht naar
  GitHub. Leg eerst kort uit wat er gewijzigd is en waarom, en wacht op
  een duidelijk "ja" voordat je pusht.
- Verhoog bij elke wijziging aan `sw.js` het versienummer (CACHE-constante
  bovenaan), zodat de PWA de nieuwe versie ook echt oppikt.

### Na elke wijziging
- Geef een beknopte samenvatting: wat is er veranderd, welke bestanden,
  en — als het relevant is — wat ik zelf in de app zou moeten controleren
  om te bevestigen dat het werkt.
- Bij twijfel of onduidelijkheid: stel een gerichte vraag in plaats van
  te gokken. Kies bij kleine, voor de hand liggende keuzes gewoon een
  redelijke aanname en meld die kort, in plaats van er telkens naar te
  vragen.

### Privacy
- Sla nooit namen, geboortedata, telefoonnummers of andere persoonlijke
  spelersgegevens op buiten de app zelf (dus ook niet in documentatie,
  logs, of commit-berichten).
