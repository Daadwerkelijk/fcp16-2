# FCP 16-2 Trainingsapp — Installatie & Gebruik

## Wat zit er in dit pakket?

```
fcp16-2/
├── index.html        Start / kernprincipes
├── opstelling.html   Veldbezetting per formatie
├── selectie.html     Spelers beheren + skills inladen
├── schema.html       Trainingsschema augustus–oktober 2026
├── wedstrijden.html  Resultaten, cijfers, MOTM, ranking
├── team.html         Team skills overzicht
├── oefeningen.html   Bibliotheek van 49+ oefeningen
├── app.js            Gedeelde logica (niet aanpassen)
├── style.css         Opmaak (niet aanpassen)
└── README.txt        Dit bestand
```

---

## Stap 1 — Online zetten via Netlify (gratis)

1. Ga naar **drop.netlify.com** in je browser
2. Sleep de volledige map `fcp16-2` op de uploadzone
3. Netlify geeft je een URL, bijv. `https://fcp16-2-abc123.netlify.app`
4. Sla deze URL op — dit is de app voor jou en Onno

**Update na aanpassing:**
Ga opnieuw naar drop.netlify.com en sleep de map er opnieuw op.
Netlify herkent je vorige deploy en vraagt of je wilt updaten.

---

## Stap 2 — Supabase koppelen (gratis, voor gedeelde data)

Zonder Supabase werkt de app alleen lokaal (data opgeslagen in de browser).
Met Supabase deel je alles met Onno in realtime.

### 2a. Account aanmaken
1. Ga naar **supabase.com** → Start your project
2. Maak een gratis account en een nieuw project aan
3. Wacht tot het project klaar is (~1 min)

### 2b. SQL uitvoeren
1. Klik links op **SQL Editor**
2. Kopieer de inhoud van `supabase_setup.sql` en plak in de editor
3. Klik **Run** — je ziet "Success"
4. Doe hetzelfde met `supabase_update_v4.sql`

### 2c. Credentials ophalen
1. Ga naar **Project Settings → API**
2. Kopieer de **Project URL** (bijv. `https://xxxx.supabase.co`)
3. Kopieer de **Legacy anon / public key** (begint met `eyJ...`)
   ⚠️ Gebruik de **Legacy** key, niet de nieuwe JWT

### 2d. Koppelen in de app
1. Open de app via je Netlify URL
2. Je ziet bovenin een invulscherm voor Supabase
3. Vul URL en key in → klik **Verbinding opslaan en testen**
4. Je ziet ✓ Verbonden — de app onthoudt dit voortaan

**Onno doet hetzelfde op zijn telefoon** met dezelfde URL en key.
Daarna zien jullie elkaars wijzigingen automatisch.

---

## Stap 3 — Op je thuisscherm installeren (iPhone)

1. Open de app in Safari
2. Tap het **Deel-icoon** (vierkantje met pijl omhoog)
3. Kies **Voeg toe aan beginscherm**
4. Geef het de naam "FCP 16-2" → Voeg toe
5. De app opent nu als een echte app, zonder adresbalk

---

## Gebruik per pagina

### ⚡ Start
- Overzicht statistieken (wedstrijden, spelers, gewonnen)
- Kernprincipes — tap een principe voor uitleg
- Principes zijn bewerkbaar via het potlood-icoon

### 🟢 Opstelling
- Wissel formatie bovenin: 4-2-2-2 / 4-2-3-1 / 4-4-2 ruit
- Tap een positie → kies een speler
- Al-toegewezen spelers zijn grijs en staan vermeld welke positie
- Opstelling wordt bewaard bij wisselen van formatie

### 👥 Selectie
- Speler toevoegen via het formulier bovenin
- Tap een speler om te bewerken: omschrijving, posities, aantekeningen
- **Skills formulier inladen:**
  1. Download het Excel-template van de selectiepagina (of maak zelf aan)
  2. Laat elke speler het formulier invullen: zet een "x" in de kolom van het niveau
  3. Sla op als `[naam].xlsx` (exact de naam van de speler)
  4. Tap **📂 Excel inladen** bij de speler

### 📅 Schema
- Tap een week om te openen, tap een training om blokken te zien
- **✕ op een blok** verwijdert het uit de training
- **URL-veld onder een oefening** — plak een YouTube-link, dan verschijnt ▶️
- **Aanwezigheid** — tap namen om afwezigen te markeren, sla op
- **+ Week** (rechtsboven) — eigen trainingsweek aanmaken:
  1. Kies startdatum → weeknummer verschijnt automatisch
  2. Vul naam in
  3. Voeg oefeningen toe per training via categorie-kiezer
  4. Nieuwe oefening aanmaken → direct toegevoegd aan training én bibliotheek

### 🏆 Wedstrijden
- Wedstrijd toevoegen: tegenstander, datum, thuis/uit
- Open een wedstrijd → vul eindstand in, geef elk speler een cijfer (1–10)
- Tap ⭐ voor Man of the Match
- Onderaan: seizoensranking met gemiddeld cijfer en MOTM-teller

### 📊 Team
- Overzicht van alle speler-skills per categorie
- Tap een scorebalk of niveau-label → ziet welke spelers er op zitten
- **📂 Laad Excel** — noem het bestand exact naar de spelernaam (bijv. `Jesse.xlsx`)

### 📚 Oefeningen
- Filter op categorie via de knoppen bovenin
- 49 ingebouwde oefeningen + eigen oefeningen
- **+ Nieuw** — eigen oefening aanmaken met stappen, tip en video-URL
- Eigen oefeningen zijn bewerkbaar en verwijderbaar
- **⚙️ Categorieën** — categorieën toevoegen of verwijderen

---

## Skills Excel formulier

Het formulier heeft deze indeling (eerste kolom = naam, kolommen 2-5 = niveaus):

| Skill              | Ontwikkel punt | Voldoende | Goed | Zeer goed |
|--------------------|---------------|-----------|------|-----------|
| Balcontrole        |               |     x     |      |           |
| Dribbel            |               |           |  x   |           |
| ...                |               |           |      |           |

Zet een "x" of een willekeurige waarde in de kolom van het niveau.
De app leest de eerste gevulde kolom per rij.

Categorieën: Techniek, Tactiek, Fysiek, Mentaal
Onderaan: "Wens" (seizoendoel) en "Bijzonderheden"

---

## Veelgestelde vragen

**De app vergeet mijn data na refresh**
→ Koppel Supabase (Stap 2). Zonder database slaat de app op in de browser,
  die gewist kan worden. Met Supabase staat alles veilig in de cloud.

**Onno ziet mijn wijzigingen niet**
→ Zorg dat jullie beide dezelfde Supabase URL en key hebben ingevoerd.
→ Ververs de pagina — de app laadt automatisch de laatste data.

**De ✓ Verbonden melding verdwijnt na refresh**
→ Dit is opgelost in de huidige versie. De credentials worden onthouden.
→ Als het toch voorkomt: tap ✏️ Wijzig en sla opnieuw op.

**Kan ik de app ook zonder internet gebruiken?**
→ Ja, de app werkt offline. Wijzigingen worden lokaal opgeslagen.
→ Zodra je weer online bent, synchroniseer je handmatig door de pagina te verversen.

---

## Bestanden bijwerken

Als je een update ontvangt:
1. Vervang de aangepaste bestanden in de map (meestal app.js of een .html bestand)
2. Sleep de volledige map opnieuw op drop.netlify.com
3. Klaar — alle data blijft intact in Supabase

---

Vragen? Stuur een bericht aan de ontwikkelaar.
