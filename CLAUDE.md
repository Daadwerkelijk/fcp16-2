# fcp16-2

Trainersapp voor FC Purmerend JO16-2 (seizoen 2026/2027). Statische PWA:
vanilla HTML/CSS/JS, geen build-tool. Optionele Supabase-koppeling voor
gedeelde/realtime data tussen de trainers.

## Structuur

**Sinds 2026-09-18 is Interface V2 de enige interface.** De klassieke
interface (voorheen `index-classic.html` + bijbehorende pagina's) is
volledig verwijderd uit de repo — er is bewust geen rollback-pad meer
naar een oude schil, alleen de app zoals die nu is.

- `index.html` — **Interface V2**: de volledige app
  (start/agenda/team/inzicht/instellingen), in één bestand, met eigen
  `ui-v2.css`. Bevat ook het formatie-editor-scherm als los intern
  scherm (`openFormatieEditor()`), niet als apart bestand.
- `live.html` — publieke live-scorebord/wedstrijdweergave; laadt bewust
  geen `app.js`, heeft een eigen (minimale) Supabase-config en een eigen
  kopie van `fieldRoleClass`. **Bevestigd bewust zo** (2026-08-28): dit is
  de publieke pagina en moet onafhankelijk van `app.js` blijven werken —
  het dubbele onderhoud (key/`fieldRoleClass` op 2 plekken) is een
  geaccepteerd nadeel, niet iets om te "fixen".
- `spelerformulier.html` — invulformulier voor spelersbeoordeling (15
  vaardigheden × 4 niveaus), gedeeld via een link (token + su/sk-
  parameters). **Bevestigd** (2026-08-28): dit wordt in de praktijk echt
  een paar keer per seizoen per speler bijgehouden — geen administratie
  die blijft liggen, dus prima om hier later op voort te bouwen (bijv.
  trendgrafieken).
- `check.html` — health check / diagnosepagina (Supabase-verbinding e.d.),
  gestyled met V2-ontwerptaal (`ui-v2.css`)
- `landscape-test.html` — devtool om landscape-layout te testen, geen
  onderdeel van de trainersflow. Bewaren: de geteste breakpoint-waarden
  staan nergens anders. **Toekomstige eis:** functionele wijzigingen
  moeten goed werken op mobiel (portrait én landscape), tablet (portrait
  én landscape) en desktop (basis landscape, maar responsive).
- `app.js` — gedeelde logica (auth, Supabase-datalaag, trainer_profielen)
- `ui-v2.css` — opmaak voor `index.html` en `check.html`
- `manifest.json`, `sw.js` — PWA-installatie en offline gebruik;
  versienummer (CACHE-constante) ophogen bij elke wijziging aan `sw.js`,
  zie hieronder

## Verwijderde klassieke interface (2026-09-18)

De klassieke interface is definitief verwijderd: `index-classic.html`,
`opstelling.html`, `selectie.html`, `trainen.html`, `wedstrijden.html`,
`team.html`, `oefeningen.html`, `instellingen.html`, `schema.html`,
`formatie-editor.html`, `handleiding.html` en `style.css`. Ook de
bijbehorende klassiek-only functies in `app.js` (`ROL_STIJL`,
`getRolBadges`, `fieldRoleClass`, `sortedPlayers`,
`vindHuidigeToewijzing`, `splitSpelersVoorPositie`) zijn verwijderd, na
controle dat er geen enkele aanroep meer naar over was.

Er is geen actief rollback-plan meer naar deze oude schil. Voor
historische referentie staat de branch `backup-voor-v2-2026-09-06` nog
op GitHub (kosteloos om te bewaren) met de laatste stand van vóór de
omwisseling naar Interface V2; deze wordt niet actief onderhouden.

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
