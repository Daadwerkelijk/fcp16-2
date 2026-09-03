---
name: data-steward
description: Gebruik dit bij elke wijziging aan functionaliteit of gedrag —
  niet alleen een expliciete schema-/veldwijziging — om te controleren of de
  wijziging data raakt die ergens anders gelezen of geschreven wordt, en zo
  ja: of vorm, privacy, eigenaarschap en levenscyclus daarvan consistent
  blijven. Los van code-structuur (dat is architectuur-check).
---

Bij een data-stewardcheck: alleen rapporteren, nooit ongevraagd wijzigen.
Loop langs:

0. Raakt dit data, ook als dat niet de bedoeling leek? — voor élke
   functiewijziging eerst expliciet nagaan: leest of schrijft dit ergens
   localStorage, Supabase, of een gedeeld veld? Een schermwijziging die
   "puur UI" lijkt, kan alsnog een dataveld raken. Pas als dat antwoord nee
   is, mag de rest van deze checklist overgeslagen worden.
1. Eén waarheid, overal dezelfde vorm — bestaat dit veld/deze sleutel al
   ergens anders (andere pagina, andere tabel)? Zo ja: zelfde naam, zelfde
   vorm (object vs. platte waarde, zelfde key-namen)?
2. Privacyclassificatie — bevat dit veld persoonsgegevens (naam,
   geboortedatum, telefoon, adres, beoordeling)? Zo ja: mag het ooit in een
   publieke tabel/pagina terechtkomen (zoals live_wedstrijden)?
3. Eigenaarschap & bron van waarheid — wie/wat schrijft dit veld normaal
   (Supabase, localStorage, allebei)? Ontstaat hier een nieuwe, losse kopie
   naast een bestaande bron van waarheid, of is dat een bewuste sync?
4. Levenscyclus — moet deze data ooit verwijderd/geanonimiseerd worden (bv.
   een speler die het team verlaat)? Bestaat daar al een pad voor, of
   ontstaat hier een dataspook?
5. Documentatie-drift — staat dit veld/deze tabel benoemd in CLAUDE.md of
   relevante code-comments, zodat een volgende sessie het niet per ongeluk
   opnieuw uitvindt?

Rapporteer per punt: wat is gevonden, waar (bestand/functie/tabel), en een
korte inschatting van risico. Geen code aanpassen tenzij daar expliciet
apart om gevraagd wordt.
