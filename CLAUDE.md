# fcp16-2

Trainersapp voor FC Purmerend JO16-2 (seizoen 2026/2027). Statische PWA:
vanilla HTML/CSS/JS, geen build-tool. Optionele Supabase-koppeling voor
gedeelde/realtime data tussen de trainers.

## Structuur

**Sinds 2026-09-06 is Interface V2 de standaard-app op `index.html`** (was
`prototype-v2.html`). De vorige/klassieke interface is hernoemd naar
`index-classic.html` en blijft volledig intact als rollback-scenario — zie
"Rollback" hieronder. Beide delen dezelfde Supabase-database, `app.js` en
localStorage-sleutels; het is puur een andere schil.

- `index.html` — **Interface V2** (start/agenda/team/inzicht/instellingen,
  in één bestand, eigen `ui-v2.css`). Dit is nu de primaire app.
- `index-classic.html` — de klassieke interface (start/kernprincipes),
  bewaard als rollback-optie, niet meer de standaard-ingang.
- `opstelling.html` — veldopstelling per formatie (klassiek)
- `selectie.html` — spelersbeheer + skills inladen (Excel) (klassiek)
- `trainen.html` — trainingsschema, oefeningen per sessie, aanwezigheid (klassiek)
- `wedstrijden.html` — resultaten, cijfers, MOTM, ranking (klassiek)
- `team.html` — teamoverzicht speler-skills (klassiek)
- `oefeningen.html` — oefeningenbibliotheek (klassiek)
- `live.html` — publieke live-scorebord/wedstrijdweergave; laadt bewust
  geen `app.js`, heeft een eigen (minimale) Supabase-config en een eigen
  kopie van `fieldRoleClass`. **Bevestigd bewust zo** (2026-08-28): dit is
  de publieke pagina en moet onafhankelijk van `app.js` blijven werken —
  het dubbele onderhoud (key/`fieldRoleClass` op 2 plekken) is een
  geaccepteerd nadeel, niet iets om te "fixen".
- `instellingen.html` — app-instellingen (o.a. thema) (klassiek; V2 heeft
  zijn eigen instellingen-scherm binnen `index.html`)
- `spelerformulier.html` — invulformulier voor spelersbeoordeling (15
  vaardigheden × 4 niveaus), gedeeld door beide interfaces via een
  gedeelde link (token + su/sk-parameters). **Bevestigd** (2026-08-28): dit
  wordt in de praktijk echt een paar keer per seizoen per speler
  bijgehouden — geen administratie die blijft liggen, dus prima om hier
  later op voort te bouwen (bijv. trendgrafieken).
- `handleiding.html` — gebruikershandleiding (klassiek)
- `check.html` — health check / diagnosepagina (Supabase-verbinding e.d.),
  gestyled met V2-ontwerptaal (`ui-v2.css`)
- `landscape-test.html` — devtool om landscape-layout te testen, geen
  onderdeel van de trainersflow
- `app.js` — gedeelde logica (auth, Supabase-datalaag, trainer_profielen,
  klassieke desktop-sidebar/nav)
- `style.css` — opmaak klassieke interface
- `ui-v2.css` — opmaak Interface V2 (`index.html`, `check.html`)
- `manifest.json`, `sw.js` — PWA-installatie en offline gebruik (`sw.js`
  cachet zowel `index.html` als `index-classic.html`; versienummer ophogen
  bij elke wijziging, zie hieronder)

## Rollback (Interface V2, 2026-09-06)

Mocht Interface V2 problemen geven: `index-classic.html` is de volledige,
werkende vorige interface, nog steeds bereikbaar en functioneel — alleen
niet meer de standaard-ingang op `/`. Voor een echte terugval naar de oude
situatie staat er een branch `backup-voor-v2-2026-09-06` op GitHub die het
laatste commit vóór deze omwisseling vastlegt; `main` daarnaartoe
terugzetten (force-push, altijd eerst expliciet afstemmen) herstelt de
oude `index.html`. De branch `v2-klaar-voor-main` bevat het volledige
V2-werk zoals het gemerged is, voor referentie.

**Let op:** `schema.html` staat nog in de repo maar lijkt dode code —
geen enkele pagina linkt er meer naartoe (alle nav-balken linken naar
`trainen.html`, dat een nieuwere nav gebruikt). Voordat dit bestand
verwijderd wordt: even bevestigen dat het echt niet meer gebruikt wordt.

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
- Stel na een grotere wijziging (nieuwe feature, architectuurwijziging,
  Supabase-wijziging, deploy) voor om `tests/rooktest.md` te doorlopen:
  een vaste checklist van kernflows (wedstrijd opslaan, live pushen,
  speler toevoegen, opstelling maken, training plannen) om handmatig af
  te vinken in de echte app.
- Bij twijfel of onduidelijkheid: stel een gerichte vraag in plaats van
  te gokken. Kies bij kleine, voor de hand liggende keuzes gewoon een
  redelijke aanname en meld die kort, in plaats van er telkens naar te
  vragen.

### Privacy
- Sla nooit namen, geboortedata, telefoonnummers of andere persoonlijke
  spelersgegevens op buiten de app zelf (dus ook niet in documentatie,
  logs, of commit-berichten).

## Sessiebeheer

### Context en compact
- Stel na het afronden van een duidelijk afgebakende taak (een bugfix,
  een feature, een sessie zoals de opzet van deze werkwijze-afspraken)
  proactief voor om /compact te draaien, in plaats van te wachten tot
  de context vanzelf vol raakt. Vraag er niet steeds naar tussendoor,
  alleen op een natuurlijk eindpunt.
- Geef bij dat voorstel altijd een korte, concrete /compact-instructie
  mee die aansluit bij wat er nog moet gebeuren, bijvoorbeeld:
  "/compact Focus on de openstaande taken en welke bestanden gewijzigd zijn".
- Als de gebruiker aangeeft dat het volgende onderwerp niets meer met
  het huidige te maken heeft, stel dan /clear voor in plaats van /compact.
- Belangrijke, blijvende afspraken (werkwijze, testconventies,
  architectuurkeuzes) horen thuis in CLAUDE.md zelf, niet alleen ergens
  in het gesprek — dat overleeft een /compact wél volledig.
