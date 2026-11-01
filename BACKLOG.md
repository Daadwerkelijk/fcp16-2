# Backlog fcp16-2

Wat bewust nog niet gebouwd is, plus genomen besluiten zodat ze niet
opnieuw ter discussie komen. Bijgewerkt 2026-11-01.

## Op de backlog

- **Kernprincipes** — stond in de oude startpagina: principe-raster,
  detailvenster en bewerkvenster (naam/beschrijving/voorbeeld), eigen
  `principes`-tabel in Supabase. Ontbreekt sinds Interface V2. Geen
  prioriteit of planning.
- **Speler-ontwikkeling over het seizoen** — grafiek per vaardigheid met
  speler- en trainerlijn door het seizoen. Mockup:
  `mockups/mockup-speler-ontwikkeling.html`. Deels gedekt door wat er al
  is (trendpijlen per vaardigheid en de Geschiedenis-tijdlijn), maar de
  seizoensgrafiek zelf is niet gebouwd.
- **Positie vastleggen bij elke wissel** — een wissel (`wissels`) slaat nu
  geen positie op en de opgeslagen opstelling wordt achteraf
  overschreven, waardoor "wie stond wanneer op welke positie" niet
  betrouwbaar te reconstrueren is. Idee: bij elke wissel en positieruil de
  positie meeschrijven, plus de startopstelling apart bewaren. Nodig voor
  een analyse per minuut/positie na fase 2 (aanleiding: analyse fase 1,
  2026-10-18).
- **Wedstrijdverslag delen via WhatsApp** — knop op het wedstrijdscherm,
  zelfde `wa.me`-patroon als de opstelling/training-deelknoppen. Vóór de
  wedstrijd: "Volg live" met link; na afloop: eindstand (+ rust),
  doelpunten met minuut en een link naar
  `live.html?wedstrijd=<id>` (deeplink bestaat al). Alleen wat ook op de
  live-pagina staat — geen cijfers, MOTM of minuten per speler (open
  vraag: MOTM wel of niet). Later eventueel een korte trainersnoot
  vooraf in te typen. Geen afbeelding/pdf-export. (2026-11-01)
- **Teamoverzicht per vaardigheid/thema** — aanvulling op de
  seizoensgrafiek hierboven: vaardigheden van het hele team naast elkaar,
  gegroepeerd per thema, om te zien waar het team als geheel zwak is en
  dat terug te laten komen in de trainingsplanning. Data is er al
  (spelerformulier). Inspiratie: "Player development" van TouchTight.
  (2026-11-01)
- **Training kiezen op focus/thema** — trainingen of oefeningen filteren
  op thema, focus en duur. Alleen nuttig met een eigen
  oefeningenbibliotheek die bijgehouden wordt. Inspiratie: "The Gaffer"
  van TouchTight. Lage prioriteit. (2026-11-01)
- **Bekeken maar afgeraden** (TouchTight, 2026-11-01) — geanimeerde
  spelsituaties als GIF/MP4 ("Coach Studio": veel werk, weinig winst
  naast de formatie-editor) en club-curriculum/rollen/compliance (bedoeld
  voor clubs, niet voor één team; rollenhiërarchie bewust niet).
  Beschikbaarheid in realtime ("Dugout") is er al via afwezigheid in
  Supabase. Staat hier zodat het niet opnieuw onderzocht hoeft te worden;
  nog geen definitief besluit.

## Besloten

- **Wedstrijdvideo / videomomenten** (link + tijdstip per doelpunt of
  moment, naar "Replay" van TouchTight) — wordt niet gebruikt, niet
  bouwen (2026-11-01).
- **Spelersnamen op het publieke live-scorebord** (`live.html`,
  `live_wedstrijden`/`live_updates`) — mogen blijven (2026-10-18).
- **Eigen URL per trainingsblok** (naast de URL van de oefening) —
  vervallen, wordt niet gebouwd (2026-10-18).

## Mockups

Nieuwe mockups komen in `mockups/`. Is een mockup gebouwd, dan gaat hij
weg; staat hij nog op de backlog, dan blijft hij hier.
