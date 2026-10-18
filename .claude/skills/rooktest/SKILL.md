---
name: rooktest
description: Gebruik dit na een grotere wijziging (nieuwe feature,
  architectuurwijziging, Supabase-wijziging, of vlak vóór een deploy/push)
  om de kernflows echt in de browser te doorlopen — het woord "rooktest",
  "smoke test", of een voorstel om tests/rooktest.md te doorlopen.
---

# Rooktest

Doel: bevestigen dat het gewone, verwachte pad nog gewoon werkt — het
derde been naast `monkey` (chaos/crash) en `tdd` (pure logica). Dit
vervangt `tests/rooktest.md` niet, dit ís de uitvoering ervan: lees dat
bestand voor de actuele kernflows en vink 'm ook daadwerkelijk af, i.p.v.
'm alleen voor te stellen en er verder niets mee te doen.

## Welk doelwit
- Zijn de wijzigingen in de **echte productiepagina's** (index.html,
  wedstrijden.html, live.html, selectie.html, opstelling.html,
  trainen.html, ...): draai de kernflows daar, met een lokale testserver
  en verzonnen dummy-data — nooit met echte spelersgegevens (zie de
  privacyregel in CLAUDE.md).
- Zijn de wijzigingen in **prototype-v2.html**: loop dezelfde kernflows
  langs via de bijbehorende schermen van het prototype, en vervang de
  bestandsnamen hieronder door de overeenkomstige schermen/functies. De
  "Live pushen"-flow is dan niet van toepassing — dat is in het prototype
  een bewuste lokale simulatie, geen echte Supabase-realtime.
- Startservertje: zelfde HttpListener-patroon als bij `monkey`, poort
  8934, in de projectroot. Sluit tabblad(en) en server na afloop weer af.

## Uitvoering
Lees eerst `tests/rooktest.md` voor de op dat moment geldende kernflows en
aandachtspunten — dat bestand is de bron van waarheid, niet deze skill.
Loop daarna elke regel af:

1. **Per kernflow**: voer 'm écht uit met de Chrome-tools (geen
   `javascript_exec`-kortere-weg voor de kernhandeling zelf — een rooktest
   bevestigt dat een mens er ook doorheen komt, dus klik/typ zoals een
   trainer dat zou doen). Herlaad daarna de pagina en controleer dat het
   resultaat er nog staat.
2. **Live pushen** (alleen bij de echte app): open twee tabbladen naast
   elkaar — één waar de wijziging gebeurt, één die 'm zou moeten
   ontvangen. Voer de actie uit in het eerste tabblad en controleer in het
   tweede, zonder handmatig te verversen, dat de wijziging aankomt.
3. **Console-errors**: na elke flow `read_console_messages` met
   `onlyErrors:true` — pas nadat de pagina al een keer vers geladen is in
   deze sessie, anders mist de eerste laadfout.
4. **Aandachtspunten uit rooktest.md** (viewport/scroll, PWA-versie, etc.):
   apart afvinken, niet overslaan omdat de kernflows al goed gingen.

## Na afloop
- Testdata weer opruimen (localStorage-sleutels terugzetten/verwijderen),
  tabbladen sluiten, server afsluiten.
- Vul het "Resultaat"-veld van `tests/rooktest.md` niet automatisch in
  (dat is een handmatig afvinkdocument voor de gebruiker) — rapporteer in
  plaats daarvan zelf kort: welke flows getest zijn, wat werkte, en wat
  niet. Bij een gevonden probleem: niet ongevraagd fixen — meld het, net
  als bij `monkey` en `architectuur-check`, en laat de gebruiker beslissen
  of dat nu of later wordt opgelost.
- Pas ná een schone rooktest (of na expliciete bevestiging dat gevonden
  problemen acceptabel zijn) toestemming vragen voor commit/push, zoals
  CLAUDE.md voorschrijft.
