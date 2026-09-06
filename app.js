// ═══════════════════════════════════════════════
// FCP 16-2 — Gedeelde app logica
// ═══════════════════════════════════════════════

// ─── SUPABASE ───
let SB_URL = localStorage.getItem('sb_url') || '';
let SB_KEY  = localStorage.getItem('sb_key')  || '';
let supabaseReady = false;

// ─── AUTH (trainer-login) ───
// Sinds de RLS-herziening (2026-09-04) vereisen alle privétabellen een
// ingelogde sessie (rol authenticated) — de kale anon-sleutel geeft daar
// geen toegang meer toe. AUTH_ACCESS_TOKEN wint dus van SB_KEY in de
// Authorization-header zodra er een (nog geldige) sessie is; de apikey-
// header blijft altijd de anon-sleutel, dat vereist Supabase's REST-API
// sowieso naast de Authorization-header. Zie initAuthGate() verderop.
let AUTH_ACCESS_TOKEN = localStorage.getItem('sb_access_token') || '';
let AUTH_REFRESH_TOKEN = localStorage.getItem('sb_refresh_token') || '';
let AUTH_EXPIRES_AT = parseInt(localStorage.getItem('sb_expires_at'), 10) || 0;
function huidigeAuthToken() {
  const nu = Math.floor(Date.now() / 1000);
  return (AUTH_ACCESS_TOKEN && AUTH_EXPIRES_AT - nu > 0) ? AUTH_ACCESS_TOKEN : SB_KEY;
}

async function sbFetch(path, method = 'GET', body = null) {
  if (!SB_URL || !SB_KEY) return null;
  const opts = {
    method,
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + huidigeAuthToken(),
      'Content-Type': 'application/json',
      // PATCH krijgt ook return=representation, net als POST — alleen zo kunnen we zien
      // of een update daadwerkelijk een rij raakte. Zonder dit antwoordt PostgREST een
      // PATCH standaard met 204 No Content, zelfs als RLS de rij wegfilterde en er dus
      // feitelijk niets is gewijzigd: dat zag er dan uit als een geslaagde opslag terwijl
      // de data nooit is aangepast. Precies dit kostte op 2026-09-05 een trainer een echte
      // wedstrijduitslag + coach-notities, stil, zonder foutmelding, tijdens een RLS-test.
      'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : ''
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + path, opts);
    if (!r.ok) {
      let msg = '';
      try { const j = await r.json(); msg = j.message || j.error || ''; } catch(e) { msg = r.statusText; }
      return { _error: true, status: r.status, message: msg };
    }
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : true;
    // Een PATCH die 0 rijen teruggeeft, raakte niets — meestal RLS die de rij wegfiltert
    // (verkeerde/verlopen rechten) of een inmiddels niet meer bestaand ID. De HTTP-status
    // is dan alsnog 2xx, dus dit moet expliciet gecheckt worden, anders blijft dit stil.
    if (method === 'PATCH' && Array.isArray(data) && data.length === 0) {
      return { _error: true, status: r.status, message: 'Update raakte geen enkele rij (geen toegang of onbekend ID) — niets opgeslagen.' };
    }
    return data;
  } catch(e) {
    return { _error: true, status: 0, message: e.message };
  }
}

// Wrapper om sbFetch die bij een mislukte schrijfactie (PATCH/POST/DELETE) eerst automatisch
// een paar keer opnieuw probeert (een kortstondige hapering herstelt daarmee vanzelf, zonder
// dat de gebruiker er iets van merkt) en pas als dat ook niet lukt een duidelijke, langer
// zichtbare waarschuwing toont — in plaats van de fout stil te negeren. Dat laatste zorgde
// ervoor dat data (bv. wedstrijduitslagen/opmerkingen) na een refresh weer leek te verdwijnen:
// de lokale wijziging leek opgeslagen, maar Supabase had 'm nooit ontvangen, dus bij de
// volgende paginalaad won de oude Supabase-data het weer van de nooit-opgeslagen wijziging.
async function sbWrite(path, method, body, pogingen = 3) {
  let r;
  for (let i = 0; i < pogingen; i++) {
    r = await sbFetch(path, method, body);
    if (!(r && r._error)) return r; // gelukt
    if (i < pogingen - 1) await new Promise(res => setTimeout(res, 700 * (i + 1)));
  }
  showToast('⚠️ Opslaan naar Supabase mislukt na ' + pogingen + ' pogingen: ' + (r.message || ('fout ' + r.status)) + ' — probeer het zo nog eens', 6000);
  return r;
}

// ─── Datalaag: Principes ───
// Enige plek die weet hoe een principe wordt opgeslagen (tabelnaam, veldnamen, methode).
// Doet exact hetzelfde als de eerdere losse aanroep in index-classic.html: zelfde tabel, zelfde
// velden, zelfde foutafhandeling via sbWrite (incl. automatische herhaalpogingen).
async function updatePrincipe(id, velden) {
  return await sbWrite('principes?id=eq.' + id, 'PATCH', velden);
}

// ─── Datalaag: Spelers ───
// createPlayer gebruikt bewust sbFetch (geen automatische herhaling): de aanroeper
// (addPlayer) toont direct een eigen "Opslaan mislukt"-melding zonder wachttijd,
// dat gedrag blijft ongewijzigd t.o.v. de eerdere losse implementatie.
async function createPlayer(p) {
  return await sbFetch('players', 'POST', { id:p.id, naam:p.naam, omschrijving:p.omschrijving, posities:p.posities, opmerkingen:p.opmerkingen, ontwikkeling:p.ontwikkeling });
}
async function deletePlayerRemote(id) {
  return await sbWrite('players?id=eq.' + id, 'DELETE');
}
async function updatePlayer(id, velden) {
  return await sbWrite('players?id=eq.' + id, 'PATCH', velden);
}

// ─── Datalaag: Oefeningen ───
// toSbOef bepaalt welke velden naar Supabase gaan (verhuisd uit oefeningen.html, was daar
// de enige gebruiker van).
function toSbOef(o) {
  return { id:o.id, cat:o.cat, title:o.title, duur:o.duur||'', spelers:o.spelers||'', beschrijving:o.desc||o.beschrijving||'', stappen:o.stappen||[], tip:o.tip||'', url:o.url||'', formaties:o.formaties||[] };
}
// create/updateOefening gebruiken bewust sbFetch (geen automatische herhaling): de
// aanroeper toont zelf een eigen "wordt alleen lokaal bewaard"-melding, dat gedrag
// blijft ongewijzigd t.o.v. de eerdere losse implementatie.
async function createOefening(oef) {
  return await sbFetch('custom_oef', 'POST', toSbOef(oef));
}
async function updateOefening(id, oef) {
  return await sbFetch('custom_oef?id=eq.' + id, 'PATCH', toSbOef(oef));
}
async function deleteOefeningRemote(id) {
  return await sbWrite('custom_oef?id=eq.' + id, 'DELETE');
}

// ─── Datalaag: Categorieën ───
async function createCategorie(naam, sortOrder) {
  return await sbFetch('categories', 'POST', { naam, sort_order: sortOrder });
}
async function renameCategorie(oudeNaam, nieuweNaam) {
  const r1 = await sbWrite('categories?naam=eq.' + encodeURIComponent(oudeNaam), 'PATCH', { naam: nieuweNaam });
  const r2 = await sbWrite('custom_oef?cat=eq.' + encodeURIComponent(oudeNaam), 'PATCH', { cat: nieuweNaam });
  return { r1, r2 };
}
async function deleteCategorieRemote(naam) {
  return await sbFetch('categories?naam=eq.' + encodeURIComponent(naam), 'DELETE');
}

// ─── Datalaag: Basisopstelling ───
async function assignLineupPositie(posId, playerId) {
  await sbFetch('lineup?pos_id=eq.' + posId, 'DELETE');
  if (playerId) return await sbWrite('lineup', 'POST', { pos_id:posId, player_id:playerId });
}
async function clearLineupRemote() {
  return await sbFetch('lineup', 'DELETE');
}

// ─── Datalaag: Afwezigheidsredenen ───
// Was identiek gedupliceerd in team.html en instellingen.html — nu één plek.
async function saveAbsRedenenRemote(lijst) {
  await sbFetch('session_notes?note_key=eq.abs_redenen', 'DELETE');
  return await sbWrite('session_notes', 'POST', { note_key:'abs_redenen', content:JSON.stringify(lijst) });
}

// ─── Datalaag: Wisselredenen ───
// Zelfde patroon als afwezigheidsredenen hierboven — session_notes heeft geen inkomende FK,
// dus DELETE+POST is hier veilig (geen cascade-risico).
async function saveWisselRedenenRemote(lijst) {
  await sbFetch('session_notes?note_key=eq.wissel_redenen', 'DELETE');
  return await sbWrite('session_notes', 'POST', { note_key:'wissel_redenen', content:JSON.stringify(lijst) });
}

// ─── Datalaag: Trainingsaantekeningen & video-URL's ───
async function saveTrainingNoteRemote(nk, val) {
  await sbFetch('session_notes?note_key=eq.' + encodeURIComponent(trainingNoteKey(nk)), 'DELETE');
  return await sbWrite('session_notes', 'POST', { note_key:trainingNoteKey(nk), content:val });
}
async function saveTrainingUrlRemote(key, val) {
  await sbFetch('session_notes?note_key=eq.' + encodeURIComponent(trainingUrlKey(key)), 'DELETE');
  return await sbWrite('session_notes', 'POST', { note_key:trainingUrlKey(key), content:val });
}

// ─── Datalaag: Aanwezigheid ───
async function saveAanwezigheidRemote(nk, spelers, nkData) {
  await sbFetch('aanwezigheid?training_key=eq.' + encodeURIComponent(nk), 'DELETE');
  let succes = true;
  for (const p of spelers) {
    const entry = nkData[p.id] || {};
    const isAfw = entry.afwezig === true;
    const res = await sbFetch('aanwezigheid', 'POST', { id:genId(), training_key:nk, player_id:p.id, aanwezig:!isAfw, reden:entry.reden||'' });
    if (res && res._error) succes = false;
  }
  return succes;
}

// createOefeningQuick gebruikt bewust sbWrite (met herhaalpogingen) — anders dan
// createOefening() uit oefeningen.html (plain sbFetch): dit is een bewust, al langer
// bestaand verschil in gedrag tussen de twee plekken waar een oefening ontstaat, dat
// hier niet stilzwijgend wordt gelijkgetrokken.
async function createOefeningQuick(oef) {
  return await sbWrite('custom_oef', 'POST', toSbOef(oef));
}

// ─── Datalaag: Wedstrijden ───
async function createWedstrijd(w) {
  return await sbFetch('wedstrijden', 'POST', { id:w.id, tegenstander:w.tegenstander, datum:w.datum, iso_date:w.isoDate||'', starttijd:w.starttijd||'', thuis_uit:w.thuis_uit, wed_type:w.wed_type, wed_fase:w.wed_fase, score_eigen:0, score_tegen:0, opmerkingen:'', gespeeld:false });
}
// updateWedstrijd gebruikt sbWrite (met herhaalpogingen) — het gedrag van de meeste
// opslagacties op deze pagina (score, opstelling, wedstrijdgegevens, gespeeld-status).
async function updateWedstrijd(id, velden) {
  return await sbWrite('wedstrijden?id=eq.' + id, 'PATCH', velden);
}
// updateWedstrijdQuiet gebruikt bewust plain sbFetch (geen herhaalpogingen): de
// aanroepers tonen zelf een eigen foutmelding of doen dit stil op de achtergrond,
// dat gedrag blijft ongewijzigd t.o.v. de eerdere losse implementaties.
async function updateWedstrijdQuiet(id, velden) {
  return await sbFetch('wedstrijden?id=eq.' + id, 'PATCH', velden);
}
async function deleteWedstrijdRemote(id) {
  return await sbWrite('wedstrijden?id=eq.' + id, 'DELETE');
}

// ─── Datalaag: Live-scorebord synchronisatie ───
// Zet de publiek zichtbare basisgegevens van een wedstrijd over naar de losse, geïsoleerde
// live-tabellen — geen speler-ID's, geen beoordelingen/opmerkingen, alleen wat toch al
// bewust openbaar wordt (score, tegenstander, datum, namen uit de opstelling).
// Een lopende live-tracking (status/klok, gezet via de push-knoppen) wordt hier bewust
// nooit overschreven — deze functie raakt alleen de "rustende" gepland/ft-toestand.
async function syncLiveWedstrijd(w, players) {
  const opstelling = [];
  if (w.wed_lineup && players) {
    Object.entries(w.wed_lineup).forEach(([posId, playerId]) => {
      if (!playerId) return;
      const speler = players.find(p => p.id === playerId);
      if (speler) opstelling.push({ pos: posId.replace(/_/g, '-'), naam: speler.naam });
    });
  }
  const bestaandArr = await sbFetch('live_wedstrijden?select=status,helft_start,minuut_offset&id=eq.' + w.id);
  const bestaand = (bestaandArr && bestaandArr[0]) || null;
  const liveStatussen = ['live_1e', 'rust', 'live_2e', 'ft'];
  const status = (bestaand && liveStatussen.includes(bestaand.status)) ? bestaand.status : (w.gespeeld ? 'ft' : 'gepland');
  const payload = {
    tegenstander: w.tegenstander, datum: w.datum, iso_date: w.isoDate || '',
    starttijd: w.starttijd || '', thuis_uit: w.thuis_uit, status,
    score_eigen: w.score_eigen || 0, score_tegen: w.score_tegen || 0,
    formatie: w.formatie || '', opstelling,
    helft_start: bestaand ? bestaand.helft_start : null,
    minuut_offset: bestaand ? bestaand.minuut_offset : 0,
  };
  // BELANGRIJK: nooit DELETE+POST gebruiken om te verversen — live_updates verwijst naar
  // deze rij met ON DELETE CASCADE, dus een DELETE (ook al gevolgd door een nieuwe insert)
  // veegt de hele tijdlijn van deze wedstrijd weg. Daarom hier altijd PATCH als de rij al
  // bestaat, en alleen POST (aanmaken) als hij er nog nooit was.
  if (bestaand) {
    return await sbFetch('live_wedstrijden?id=eq.' + w.id, 'PATCH', payload);
  }
  return await sbFetch('live_wedstrijden', 'POST', { id: w.id, ...payload });
}
async function deleteLiveWedstrijd(id) {
  return await sbFetch('live_wedstrijden?id=eq.' + id, 'DELETE');
}
async function pushLiveScore(id, eigen, tegen) {
  return await sbFetch('live_wedstrijden?id=eq.' + id, 'PATCH', { score_eigen: eigen, score_tegen: tegen });
}

// ─── Datalaag: Live pushacties ───
// Zet de status/klok van een lopende wedstrijd op de publieke pagina. helftStartNu (ISO-string
// of null) en minuutOffset horen bij elkaar: bij start 1e helft helftStartNu=nu, offset=0; bij
// start 2e helft helftStartNu=nu (opnieuw), offset=45; bij rust/einde helftStartNu=null (klok pauzeert).
async function setLiveStatus(id, status, helftStartNu, minuutOffset, scoreEigen, scoreTegen) {
  const payload = { status, helft_start: helftStartNu, minuut_offset: minuutOffset };
  if (scoreEigen !== undefined) payload.score_eigen = scoreEigen;
  if (scoreTegen !== undefined) payload.score_tegen = scoreTegen;
  return await sbFetch('live_wedstrijden?id=eq.' + id, 'PATCH', payload);
}
async function pushLiveUpdate(wedstrijdId, type, tekst, scoreEigen, scoreTegen, minuut) {
  const id = genId();
  const res = await sbFetch('live_updates', 'POST', {
    id, wedstrijd_id: wedstrijdId, type, tekst: tekst || '',
    score_eigen: scoreEigen, score_tegen: scoreTegen, wedstrijd_minuut: minuut,
  });
  return (res && res._error) ? null : id;
}
async function intrekkenLiveUpdate(id) {
  return await sbFetch('live_updates?id=eq.' + id, 'DELETE');
}
async function haalLiveStatus(id) {
  const res = await sbFetch('live_wedstrijden?select=status,helft_start,minuut_offset&id=eq.' + id);
  return (res && res[0]) || null;
}
// Alle gedeelde push-momenten van een wedstrijd, chronologisch — dit is de bron van waarheid
// voor de opmerkingen-tekst bij het sluiten van Live (zie closeLive() in wedstrijden.html),
// omdat dit (in tegenstelling tot de lokale liveNotities) altijd een paginaherlaadbeurt overleeft.
async function haalLiveUpdates(wedstrijdId) {
  const res = await sbFetch('live_updates?select=*&wedstrijd_id=eq.' + wedstrijdId + '&order=created_at.asc');
  return res && !res._error ? res : [];
}

// ─── Datalaag: Wissels (interne registratie, niet publiek) ───
// wissels bevat speler_id's, dus FK naar wedstrijden (de private tabel), niet naar
// live_wedstrijden (bewust naam-only/publiek — zie syncLiveWedstrijd hierboven).
async function registreerWissel(wedstrijdId, spelerId, moment, minuut, reden) {
  const id = genId();
  const res = await sbWrite('wissels', 'POST', {
    id, wedstrijd_id: wedstrijdId, speler_id: spelerId, moment,
    wedstrijd_minuut: minuut, reden: reden || '',
  });
  return (res && res._error) ? null : id;
}
async function updateWisselReden(id, reden) {
  return await sbWrite('wissels?id=eq.' + id, 'PATCH', { reden: reden || '' });
}
async function haalWisselsVoorWedstrijd(wedstrijdId) {
  const res = await sbFetch('wissels?select=*&wedstrijd_id=eq.' + wedstrijdId + '&order=wedstrijd_minuut.asc,created_at.asc');
  return res && !res._error ? res : [];
}
async function haalAlleWissels() {
  const res = await sbFetch('wissels?select=*&order=wedstrijd_minuut.asc,created_at.asc');
  return res && !res._error ? res : [];
}
// Eind-minuut per wedstrijd (uit live_updates, type 'einde') — nodig om de speeltijd van een
// speler die de wedstrijd op het veld heeft uitgespeeld correct af te sluiten (zie berekenSpeeltijd).
async function haalAlleEindeMomenten() {
  const res = await sbFetch('live_updates?select=wedstrijd_id,wedstrijd_minuut&type=eq.einde');
  const map = {};
  if (res && !res._error) res.forEach(r => { map[r.wedstrijd_id] = r.wedstrijd_minuut; });
  return map;
}

// Bepaalt hoeveel minuten een speler heeft gespeeld in één wedstrijd: start vanaf het eerste
// 'erin'-moment (of vanaf minuut 0 als de speler in de basisopstelling stond), tot het
// eerstvolgende 'eruit'-moment, opgeteld over alle periodes op het veld. Gebruikt dezelfde
// helft-lengte als de live-klok (incl. 2e-helft-offset) om de minuut van elk moment correct te
// duiden — die minuten liggen al vast per wissel-rij (wedstrijd_minuut), dus hier alleen optellen.
// Een open periode zonder afsluitend moment telt NIET mee (zie eindMinuut hieronder) — beter een
// gemiste minuut dan een gegokte.
function berekenSpeeltijd(wedstrijdId, spelerId, wedstrijd, wisselsVoorWedstrijd, eindMinuut) {
  const eigenWissels = wisselsVoorWedstrijd
    .filter(w => w.wedstrijd_id === wedstrijdId && w.speler_id === spelerId)
    .sort((a, b) => (a.wedstrijd_minuut||0) - (b.wedstrijd_minuut||0));
  const inBasisopstelling = wedstrijd && wedstrijd.wed_lineup &&
    Object.values(wedstrijd.wed_lineup).includes(spelerId);
  let minuten = 0;
  let veldSinds = inBasisopstelling ? 0 : null;
  eigenWissels.forEach(w => {
    if (w.moment === 'erin') { veldSinds = w.wedstrijd_minuut || 0; }
    else if (w.moment === 'eruit') {
      if (veldSinds != null) { minuten += Math.max(0, (w.wedstrijd_minuut || 0) - veldSinds); }
      veldSinds = null;
    }
  });
  if (veldSinds != null && eindMinuut != null) {
    minuten += Math.max(0, eindMinuut - veldSinds);
  }
  return minuten;
}

// ─── Spelerontwikkeling: gedeelde constanten ───
// Eén canonieke plek voor de 15 vaardigheden + 4-punts-schaal, gebruikt door zowel het
// spelerformulier als de trainersbeoordeling — voorkomt dat beide kanten uit de pas lopen.
const FORM_SKILLS = {
  techniek: ['Balcontrole','Dribbel','Passen van de bal','Schieten op doel'],
  tactiek:  ['Positiespel','Inzicht','Teamplayer'],
  fysiek:   ['Conditie','Explosieve kracht','Duel kracht'],
  mentaal:  ['Gedrag','Motivatie','Aandacht','Discipline','Omgaan met tegenslag'],
};
const SKILL_OPTIES = ['Ontwikkel punt','Voldoende','Goed','Zeer goed'];
// Percentage-positie op de vergelijkingslijn per niveau (2/34/66/98, zelfde 4 stops overal)
const SKILL_NIVEAU_PCT = {'Ontwikkel punt':2, 'Voldoende':34, 'Goed':66, 'Zeer goed':98};

// ─── Datalaag: Spelerontwikkeling ───
async function haalLaatsteSpelerBeoordeling(spelerId) {
  const res = await sbFetch('speler_beoordelingen?select=*&speler_id=eq.' + spelerId + '&order=created_at.desc&limit=1');
  return (res && res[0]) || null;
}
async function haalSpelerBeoordelingenGeschiedenis(spelerId) {
  const res = await sbFetch('speler_beoordelingen?select=*&speler_id=eq.' + spelerId + '&order=created_at.asc');
  return res && !res._error ? res : [];
}
async function haalLaatsteTrainerBeoordeling(spelerId) {
  const res = await sbFetch('trainer_beoordelingen?select=*&speler_id=eq.' + spelerId + '&order=created_at.desc&limit=1');
  return (res && res[0]) || null;
}
async function haalTrainerBeoordelingenGeschiedenis(spelerId) {
  const res = await sbFetch('trainer_beoordelingen?select=*&speler_id=eq.' + spelerId + '&order=created_at.asc');
  return res && !res._error ? res : [];
}
async function nieuweTrainerBeoordeling(spelerId, skills, gedeeldMetSpeler) {
  return await sbFetch('trainer_beoordelingen', 'POST', {
    id: genId(), speler_id: spelerId, skills, gedeeld_met_speler: !!gedeeldMetSpeler,
  });
}
async function intrekkenTrainerBeoordeling(id) {
  return await sbFetch('trainer_beoordelingen?id=eq.' + id, 'DELETE');
}
// Alle beoordelingen van alle spelers in één keer (voor het teambrede Dashboard)
async function haalAlleTrainerBeoordelingen() {
  const res = await sbFetch('trainer_beoordelingen?select=*&order=created_at.asc');
  return res && !res._error ? res : [];
}
async function haalAlleSpelerBeoordelingen() {
  const res = await sbFetch('speler_beoordelingen?select=*&order=created_at.asc');
  return res && !res._error ? res : [];
}

// Herbruikbare foutmelding voor een mislukte Supabase-verbindingstest (het resultaat van
// sbFetch('players?limit=1&select=id')) — gebruikt door initSupabase() zelf, en door V2's
// eigen koppel-scherm (index.html/Interface V2), zodat beide dezelfde, al beproefde boodschappen
// tonen zonder de mapping op twee plekken te onderhouden.
function sbVerbindingsfout(test) {
  const s = test?.status || 0;
  return s === 0   ? '❌ Netwerkfout — controleer de URL'
       : s === 401 || s === 403 ? '❌ Ongeldige API key'
       : s === 404 ? '❌ Tabellen niet gevonden — SQL nog niet uitgevoerd?'
       : '❌ Fout ' + s + ': ' + (test?.message || '');
}

async function initSupabase(statusElId) {
  SB_URL = localStorage.getItem('sb_url') || '';
  SB_KEY  = localStorage.getItem('sb_key')  || '';
  const banner  = document.getElementById('config-banner');
  const syncBar = document.getElementById('sync-bar');
  const msgEl   = document.getElementById('sync-msg');

  if (!SB_URL || !SB_KEY) {
    if (banner)  banner.style.display  = 'block';
    if (syncBar) syncBar.style.display = 'none';
    return false;
  }
  if (banner)  banner.style.display  = 'none';
  if (syncBar) { syncBar.style.display = 'flex'; syncBar.className = 'sync-bar sync-loading'; }
  if (msgEl)   msgEl.textContent = 'Verbinden...';
  const sb_url_el = document.getElementById('sb-url');
  const sb_key_el = document.getElementById('sb-key');
  if (sb_url_el) sb_url_el.value = SB_URL;
  if (sb_key_el) sb_key_el.value = SB_KEY;

  const test = await sbFetch('players?limit=1&select=id');
  if (!test || test._error) {
    if (syncBar) syncBar.className = 'sync-bar sync-err';
    supabaseReady = false;
    if (msgEl) msgEl.textContent = sbVerbindingsfout(test);
    return false;
  }
  if (syncBar) syncBar.className = 'sync-bar sync-ok';
  if (msgEl)   msgEl.textContent = '✓ Verbonden met Supabase';
  supabaseReady = true;
  return true;
}

function saveSupabaseConfig() {
  const url = document.getElementById('sb-url').value.trim();
  const key = document.getElementById('sb-key').value.trim();
  if (!url || !key) { showToast('Vul URL en key in'); return; }
  SB_URL = url; SB_KEY = key;
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  initSupabase().then(ok => { if (ok && typeof onSupabaseReady === 'function') onSupabaseReady(); });
}

function resetSupabaseConfig() {
  const sb_url_el = document.getElementById('sb-url');
  const sb_key_el = document.getElementById('sb-key');
  if (sb_url_el) sb_url_el.value = SB_URL;
  if (sb_key_el) sb_key_el.value = SB_KEY;
  const banner  = document.getElementById('config-banner');
  const syncBar = document.getElementById('sync-bar');
  if (banner)  banner.style.display  = 'block';
  if (syncBar) syncBar.style.display = 'none';
}

// ─── STATE (localStorage) ───
function loadState() {
  return {
    players:      JSON.parse(localStorage.getItem('fcp_players')      || '[]'),
    lineup:       JSON.parse(localStorage.getItem('fcp_lineup')       || '{}'),
    sessionNotes: JSON.parse(localStorage.getItem('fcp_snotes')       || '{}'),
    customOef:    JSON.parse(localStorage.getItem('fcp_oef')          || '[]'),
    categories:   JSON.parse(localStorage.getItem('fcp_cats')         || JSON.stringify(['opwarmen','conditie','techniek','positiespel','counterpressing','partijvorm'])),
    wedstrijden:  JSON.parse(localStorage.getItem('fcp_wed')          || '[]'),
    aanwezigheid: JSON.parse(localStorage.getItem('fcp_aanw')         || '{}'),
    customWeken:  JSON.parse(localStorage.getItem('fcp_custom_weken') || '[]'),
    formatie:     localStorage.getItem('fcp_formatie') || '4222',
    absRedenen:   JSON.parse(localStorage.getItem('fcp_abs_redenen')  || '["Ziek","Geblesseerd","Leren","Feest","Anders","Onbekend"]'),
    wisselRedenen: JSON.parse(localStorage.getItem('fcp_wissel_redenen') || '["Te laat","Moe","Tactisch","Minder goed","Blessure tijdens wedstrijd","Gedrag"]'),
  };
}

function savePlayers(players)      { localStorage.setItem('fcp_players',      JSON.stringify(players)); }
function saveLineup(lineup)        { localStorage.setItem('fcp_lineup',       JSON.stringify(lineup)); }
function saveSessionNotes(notes)   { localStorage.setItem('fcp_snotes',       JSON.stringify(notes)); }

// Gedeelde sleutel-opbouw voor de session_notes-tabel, die als generieke opslag dient voor
// meerdere soorten data (trainingsaantekeningen, video-URL's, spelerformulieren, instellingen).
// Elke soort krijgt een eigen prefix zodat ze structureel nooit kunnen botsen — dit is de
// ENIGE plek die deze prefixen kent, zodat een nieuwe soort data hier bewust bij moet komen
// in plaats van dat iedere pagina zelf een sleutel verzint.
function trainingNoteKey(nk)  { return 'training-note:' + nk; }
function trainingUrlKey(key)  { return 'training-url:' + key; }
function stripNoteKeyPrefix(key) {
  if (key.startsWith('training-note:')) return key.slice('training-note:'.length);
  if (key.startsWith('training-url:'))  return key.slice('training-url:'.length);
  return key;
}
function saveCustomOef(oef)        { localStorage.setItem('fcp_oef',          JSON.stringify(oef)); }
function saveCategories(cats)      { localStorage.setItem('fcp_cats',         JSON.stringify(cats)); }
function saveWedstrijden(wed)      { localStorage.setItem('fcp_wed',          JSON.stringify(wed)); }
function saveAanwezigheid(aanw)    { localStorage.setItem('fcp_aanw',         JSON.stringify(aanw)); }
function saveCustomWeken(weken)    { localStorage.setItem('fcp_custom_weken', JSON.stringify(weken)); }
async function syncCustomWeken(weken) {
  saveCustomWeken(weken);
  if (!supabaseReady) return;
  await sbFetch('custom_weken?id=eq.singleton', 'DELETE');
  await sbFetch('custom_weken', 'POST', { id:'singleton', data: JSON.stringify(weken) });
}

// ─── SUPABASE LOAD ALL ───
async function loadFromSupabase() {
  const [pl, lu, sn, oe, ca, wd, pr, aanw, cw, cf] = await Promise.all([
    sbFetch('players?select=*&order=created_at'),
    sbFetch('lineup?select=*'),
    sbFetch('session_notes?select=*'),
    sbFetch('custom_oef?select=*&order=created_at'),
    sbFetch('categories?select=*&order=sort_order'),
    sbFetch('wedstrijden?select=*&order=created_at'),
    sbFetch('principes?select=*&order=sort_order'),
    sbFetch('aanwezigheid?select=*'),
    sbFetch('custom_weken?id=eq.singleton&select=*'),
    sbFetch('custom_formaties?select=*&order=created_at'),
  ]);
  const result = {};
  if (pl && !pl._error) { result.players = pl; savePlayers(pl); }
  if (lu && !lu._error) {
    const lineup = {};
    lu.forEach(r => { lineup[r.pos_id] = r.player_id; });
    result.lineup = lineup; saveLineup(lineup);
  }
  if (sn && !sn._error) {
    const notes = {};
    // 'training-note:' en 'training-url:' zijn een opslag-detail (voorkomt botsing met
    // andere soorten data in dezelfde tabel) — de rest van de app blijft gewoon de kale
    // sleutel ('cw0_1') gebruiken, dus hier strippen we de prefix meteen bij het inlezen.
    sn.forEach(r => { notes[stripNoteKeyPrefix(r.note_key)] = r.content; });
    result.sessionNotes = notes; saveSessionNotes(notes);
    // absRedenen laden als die in session_notes staan
    if (notes['abs_redenen']) {
      try {
        const redenen = JSON.parse(notes['abs_redenen']);
        if (Array.isArray(redenen)) { result.absRedenen = redenen; localStorage.setItem('fcp_abs_redenen', JSON.stringify(redenen)); }
      } catch(e) {}
    }
    if (notes['wissel_redenen']) {
      try {
        const redenen = JSON.parse(notes['wissel_redenen']);
        if (Array.isArray(redenen)) { result.wisselRedenen = redenen; localStorage.setItem('fcp_wissel_redenen', JSON.stringify(redenen)); }
      } catch(e) {}
    }
    if (notes['team_config']) {
      try {
        const cfg = JSON.parse(notes['team_config']);
        if (cfg && cfg.naam) { result.teamConfig = cfg; localStorage.setItem('fcp_team_config', JSON.stringify(cfg)); }
      } catch(e) {}
    }
    if (notes['spelvorm']) {
      const sv = parseInt(notes['spelvorm'], 10);
      if (sv) { result.spelvorm = sv; localStorage.setItem('fcp_spelvorm', String(sv)); }
    }
  }
  if (oe && !oe._error) {
    const oef = oe.map(o => ({
      ...o,
      desc: o.desc || o.beschrijving || '',
      stappen: o.stappen || [],
      pr: [],
      formaties: Array.isArray(o.formaties) ? o.formaties : (typeof o.formaties === 'string' && o.formaties ? JSON.parse(o.formaties) : []),
    }));
    result.customOef = oef; saveCustomOef(oef);
  }
  if (ca && !ca._error && ca.length) {
    const cats = ca.map(c => c.naam);
    result.categories = cats; saveCategories(cats);
  }
  if (wd && !wd._error) {
    const wedstrijden = wd.map(w => ({
      ...w,
      isoDate:    w.iso_date || w.isoDate || '',
      ratings:    typeof w.ratings === 'string' ? JSON.parse(w.ratings || '{}') : (w.ratings || {}),
      motm:       w.motm || null,
      gespeeld:   w.gespeeld || false,
      afwezig:    typeof w.afwezig === 'string' ? JSON.parse(w.afwezig || '[]') : (w.afwezig || []),
      aanwezig:   typeof w.aanwezig === 'string' ? JSON.parse(w.aanwezig || '[]') : (w.aanwezig || []),
      wed_lineup: typeof w.wed_lineup === 'string' ? JSON.parse(w.wed_lineup || '{}') : (w.wed_lineup || {}),
    }));
    result.wedstrijden = wedstrijden; saveWedstrijden(wedstrijden);
  }
  if (pr && !pr._error && pr.length) { result.principes = pr; }
  if (aanw && !aanw._error) {
    const aanwObj = {};
    aanw.filter(r => r.training_key && r.training_key !== '[object Object]' && r.training_key.length < 20).forEach(r => {
      if (!aanwObj[r.training_key]) aanwObj[r.training_key] = {};
      // Ondersteuning voor oud formaat (boolean) en nieuw formaat ({afwezig, reden})
      if (typeof r.aanwezig === 'boolean') {
        aanwObj[r.training_key][r.player_id] = { afwezig: !r.aanwezig, reden: r.reden || '' };
      } else {
        aanwObj[r.training_key][r.player_id] = r.aanwezig;
      }
    });
    result.aanwezigheid = aanwObj;
    // Opschonen - verwijder corrupte keys (te lang of object Object)
    Object.keys(aanwObj).forEach(k => {
      if (k.length > 20 || k.includes('[object') || k.startsWith('{')) delete aanwObj[k];
    });
    localStorage.setItem('fcp_aanw', JSON.stringify(aanwObj));
  }
  if (cw && !cw._error && cw.length) {
    const weken = typeof cw[0].data === 'string' ? JSON.parse(cw[0].data) : cw[0].data;
    result.customWeken = weken; saveCustomWeken(weken);
  }
  if (cf && !cf._error) {
    const eigenFormaties = cf.map(f => ({
      ...f,
      posities: typeof f.posities === 'string' ? JSON.parse(f.posities || '[]') : (f.posities || []),
    }));
    result.customFormaties = eigenFormaties;
    saveCustomFormatiesLijst(eigenFormaties);
    FORMATIES = loadFormaties();
  }
  return result;
}

// ─── DEFAULT PRINCIPES ───
const DEFAULT_PRINCIPES = [
  { id:'p1', code:'P1', naam:'Ruimte voor bezit',
    beschrijving:'Balbezit is een middel, niet het doel. FCP circuleert geduldig totdat de verdediging beweegt en er echte ruimte ontstaat.',
    voorbeeld:'Zes passes breed om de verdediging te laten schuiven, daarna plots diep op de vrijgekomen speler.',
    kleur_bg:'#0a1e10', kleur_border:'#1a5030', kleur_text:'#70e890' },
  { id:'p2', code:'P2', naam:'Smalle kanalen AM-ers',
    beschrijving:'De AM-ers spelen centraal in smalle verticale kanalen. Ze trekken naar binnen om ruimte te creëren voor de backs.',
    voorbeeld:'AM ontvangt in het centrum, draait en speelt direct diep op ST of kaatst terug op VM.',
    kleur_bg:'#160e28', kleur_border:'#3a2060', kleur_text:'#a080f8' },
  { id:'p3', code:'P3', naam:'Derde-man back',
    beschrijving:'De back is de derde man in een combinatie. Back speelt op VM, AM trekt naar binnen, back maakt de diepterun.',
    voorbeeld:'Rechtsback past op VM. AM trekt centraal. VM speelt diep op de doorgelopen back.',
    kleur_bg:'#241400', kleur_border:'#603010', kleur_text:'#f0a040' },
  { id:'p4', code:'P4', naam:'Counterpressing reflex',
    beschrijving:'Direct na balverlies wordt collectief druk gezet binnen 3-5 seconden. Een reflex die getraind wordt.',
    voorbeeld:'AM verliest bal, naastgelegen spelers sluiten direct af. Groepsbeweging, geen individuele actie.',
    kleur_bg:'#240010', kleur_border:'#601030', kleur_text:'#f04070' },
  { id:'p5', code:'P5', naam:'VM-ers meebewegen omhoog',
    beschrijving:'De dubbele VM fungeert niet als statisch schild. Als het veld veroverd is, schuift de VM mee omhoog.',
    voorbeeld:'Na opbouw via backs schuift VM mee omhoog als derde pasoptie voor de AM.',
    kleur_bg:'#001828', kleur_border:'#104060', kleur_text:'#40a8f0' },
  { id:'p6', code:'P6', naam:'Simpel + direct',
    beschrijving:'Technische complexiteit is nooit het doel. 1 of 2 touch, driehoekjes vormen, doorlopen na de pas.',
    voorbeeld:'Ontvangen, aannemen, doorspelen, doorlopen. De eenvoudigste oplossing is bijna altijd de juiste.',
    kleur_bg:'#101800', kleur_border:'#304010', kleur_text:'#a8e040' },
];

// ─── FORMATIES LIBRARY ───
// Standaard formaties - uitbreidbaar via instellingen
const FORMATIES_BUILTIN = {
  '4222': { label:'4-2-2-2', spelvorm:11, pos:[
    {id:'GK',   label:'GK',   role:'keeper', x:50, y:88},
    {id:'LB',   label:'LB',   role:'back',   x:14, y:72},
    {id:'CB_L', label:'CB-L', role:'cb',     x:36, y:75},
    {id:'CB_R', label:'CB-R', role:'cb',     x:64, y:75},
    {id:'RB',   label:'RB',   role:'back',   x:86, y:72},
    {id:'VM_L', label:'VM-L', role:'dm',     x:36, y:53},
    {id:'VM_R', label:'VM-R', role:'dm',     x:64, y:53},
    {id:'AM_L', label:'AM-L', role:'am',     x:24, y:36},
    {id:'AM_R', label:'AM-R', role:'am',     x:76, y:36},
    {id:'ST_L', label:'ST-L', role:'st',     x:14, y:16},
    {id:'ST_R', label:'ST-R', role:'st',     x:86, y:16},
  ]},
  '14231': { label:'4-2-3-1', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'LB',  label:'LB',  role:'back',   x:14, y:72},
    {id:'CB_L',label:'CB-L',role:'cb',     x:36, y:75},
    {id:'CB_R',label:'CB-R',role:'cb',     x:64, y:75},
    {id:'RB',  label:'RB',  role:'back',   x:86, y:72},
    {id:'DM_L',label:'DM-L',role:'dm',     x:38, y:57},
    {id:'DM_R',label:'DM-R',role:'dm',     x:62, y:57},
    {id:'LAM', label:'LAM', role:'am',     x:18, y:38},
    {id:'CAM', label:'CAM', role:'am',     x:50, y:38},
    {id:'RAM', label:'RAM', role:'am',     x:82, y:38},
    {id:'CF',  label:'CF',  role:'st',     x:50, y:16},
  ]},
  '433a': { label:'4-3-3 (punt achter)', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'LB',  label:'LB',  role:'back',   x:14, y:72},
    {id:'CB_L',label:'CB-L',role:'cb',     x:36, y:75},
    {id:'CB_R',label:'CB-R',role:'cb',     x:64, y:75},
    {id:'RB',  label:'RB',  role:'back',   x:86, y:72},
    {id:'CM_L',label:'CM-L',role:'dm',     x:22, y:52},
    {id:'CM_C',label:'CM-C',role:'dm',     x:50, y:60},
    {id:'CM_R',label:'CM-R',role:'dm',     x:78, y:52},
    {id:'LW',  label:'LW',  role:'am',     x:14, y:28},
    {id:'ST',  label:'ST',  role:'st',     x:50, y:16},
    {id:'RW',  label:'RW',  role:'am',     x:86, y:28},
  ]},
  '352': { label:'3-5-2 (punt voor)', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'CB_L',label:'CB-L',role:'cb',     x:26, y:75},
    {id:'CB_C',label:'CB-C',role:'cb',     x:50, y:78},
    {id:'CB_R',label:'CB-R',role:'cb',     x:74, y:75},
    {id:'LWB', label:'LWB', role:'back',   x:10, y:55},
    {id:'CM_L',label:'CM-L',role:'dm',     x:32, y:55},
    {id:'CM_C',label:'CM-C',role:'dm',     x:50, y:60},
    {id:'CM_R',label:'CM-R',role:'dm',     x:68, y:55},
    {id:'RWB', label:'RWB', role:'back',   x:90, y:55},
    {id:'ST_L',label:'ST-L',role:'st',     x:36, y:22},
    {id:'ST_R',label:'ST-R',role:'st',     x:64, y:22},
  ]},
  '13421': { label:'3-4-2-1', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'CB_L',label:'CB-L',role:'cb',     x:26, y:75},
    {id:'CB_C',label:'CB-C',role:'cb',     x:50, y:78},
    {id:'CB_R',label:'CB-R',role:'cb',     x:74, y:75},
    {id:'LM',  label:'LM',  role:'dm',     x:10, y:57},
    {id:'CM_L',label:'CM-L',role:'dm',     x:36, y:60},
    {id:'CM_R',label:'CM-R',role:'dm',     x:64, y:60},
    {id:'RM',  label:'RM',  role:'dm',     x:90, y:57},
    {id:'AM_L',label:'AM-L',role:'am',     x:36, y:38},
    {id:'AM_R',label:'AM-R',role:'am',     x:64, y:38},
    {id:'CF',  label:'CF',  role:'st',     x:50, y:16},
  ]},
  '442v': { label:'4-4-2 vlak', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'LB',  label:'LB',  role:'back',   x:14, y:72},
    {id:'CB_L',label:'CB-L',role:'cb',     x:36, y:75},
    {id:'CB_R',label:'CB-R',role:'cb',     x:64, y:75},
    {id:'RB',  label:'RB',  role:'back',   x:86, y:72},
    {id:'LM',  label:'LM',  role:'dm',     x:14, y:52},
    {id:'CM_L',label:'CM-L',role:'dm',     x:38, y:55},
    {id:'CM_R',label:'CM-R',role:'dm',     x:62, y:55},
    {id:'RM',  label:'RM',  role:'dm',     x:86, y:52},
    {id:'ST_L',label:'ST-L',role:'st',     x:36, y:20},
    {id:'ST_R',label:'ST-R',role:'st',     x:64, y:20},
  ]},
  '442r': { label:'4-4-2 ruit', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'LB',  label:'LB',  role:'back',   x:14, y:72},
    {id:'CB_L',label:'CB-L',role:'cb',     x:36, y:75},
    {id:'CB_R',label:'CB-R',role:'cb',     x:64, y:75},
    {id:'RB',  label:'RB',  role:'back',   x:86, y:72},
    {id:'LM',  label:'LM',  role:'dm',     x:14, y:52},
    {id:'CM_A',label:'CM-A',role:'dm',     x:50, y:40},
    {id:'CM_V',label:'CM-V',role:'am',     x:50, y:60},
    {id:'RM',  label:'RM',  role:'dm',     x:86, y:52},
    {id:'ST_L',label:'ST-L',role:'st',     x:36, y:20},
    {id:'ST_R',label:'ST-R',role:'st',     x:64, y:20},
  ]},
  '532': { label:'5-3-2', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'LWB', label:'LWB', role:'back',   x:8,  y:68},
    {id:'CB_L',label:'CB-L',role:'cb',     x:28, y:75},
    {id:'CB_C',label:'CB-C',role:'cb',     x:50, y:78},
    {id:'CB_R',label:'CB-R',role:'cb',     x:72, y:75},
    {id:'RWB', label:'RWB', role:'back',   x:92, y:68},
    {id:'CM_L',label:'CM-L',role:'dm',     x:28, y:52},
    {id:'CM_C',label:'CM-C',role:'dm',     x:50, y:55},
    {id:'CM_R',label:'CM-R',role:'dm',     x:72, y:52},
    {id:'ST_L',label:'ST-L',role:'st',     x:36, y:22},
    {id:'ST_R',label:'ST-R',role:'st',     x:64, y:22},
  ]},
  '433b': { label:'4-3-3 (punt voor)', spelvorm:11, pos:[
    {id:'GK',  label:'GK',  role:'keeper', x:50, y:88},
    {id:'LB',  label:'LB',  role:'back',   x:14, y:72},
    {id:'CB_L',label:'CB-L',role:'cb',     x:36, y:75},
    {id:'CB_R',label:'CB-R',role:'cb',     x:64, y:75},
    {id:'RB',  label:'RB',  role:'back',   x:86, y:72},
    {id:'CM_L',label:'CM-L',role:'dm',     x:36, y:55},
    {id:'CM_C',label:'CM-C',role:'am',     x:50, y:45},
    {id:'CM_R',label:'CM-R',role:'dm',     x:64, y:55},
    {id:'LW',  label:'LW',  role:'am',     x:14, y:28},
    {id:'ST',  label:'ST',  role:'st',     x:50, y:16},
    {id:'RW',  label:'RW',  role:'am',     x:86, y:28},
  ]},

  // ─── Kleinere spelvormen (4/6/7/8/9-tegen-9) ───
  // x/y-percentages in dezelfde coördinatenstijl als de 11-tegen-11-systemen
  // hierboven (x=50 midden, y=88 bij eigen doel, y=16 bij doel tegenstander).
  'sv4_22': { label:'2-2', spelvorm:4, pos:[
    {id:'ACHT_L',label:'ACHT-L',role:'back', x:30, y:65},
    {id:'ACHT_R',label:'ACHT-R',role:'back', x:70, y:65},
    {id:'VOOR_L',label:'VOOR-L',role:'st',   x:30, y:30},
    {id:'VOOR_R',label:'VOOR-R',role:'st',   x:70, y:30},
  ]},

  'sv6_212': { label:'2-1-2', spelvorm:6, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:30, y:68},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:70, y:68},
    {id:'MID',  label:'MID',   role:'dm',     x:50, y:48},
    {id:'AANV_L',label:'AANV-L',role:'st',    x:32, y:22},
    {id:'AANV_R',label:'AANV-R',role:'st',    x:68, y:22},
  ]},
  'sv6_131': { label:'1-3-1', spelvorm:6, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF',  label:'DEF',   role:'cb',     x:50, y:68},
    {id:'MID_L',label:'MID-L', role:'dm',     x:25, y:45},
    {id:'MID_C',label:'MID-C', role:'dm',     x:50, y:48},
    {id:'MID_R',label:'MID-R', role:'dm',     x:75, y:45},
    {id:'AANV', label:'AANV',  role:'st',     x:50, y:20},
  ]},
  'sv6_221': { label:'2-2-1', spelvorm:6, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:30, y:68},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:70, y:68},
    {id:'MID_L',label:'MID-L', role:'dm',     x:30, y:42},
    {id:'MID_R',label:'MID-R', role:'dm',     x:70, y:42},
    {id:'AANV', label:'AANV',  role:'st',     x:50, y:18},
  ]},

  'sv7_321': { label:'3-2-1', spelvorm:7, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:25, y:68},
    {id:'DEF_C',label:'DEF-C', role:'cb',     x:50, y:72},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:75, y:68},
    {id:'MID_L',label:'MID-L', role:'dm',     x:32, y:44},
    {id:'MID_R',label:'MID-R', role:'dm',     x:68, y:44},
    {id:'AANV', label:'AANV',  role:'st',     x:50, y:18},
  ]},
  'sv7_231': { label:'2-3-1', spelvorm:7, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:32, y:68},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:68, y:68},
    {id:'MID_L',label:'MID-L', role:'dm',     x:20, y:46},
    {id:'MID_C',label:'MID-C', role:'dm',     x:50, y:48},
    {id:'MID_R',label:'MID-R', role:'dm',     x:80, y:46},
    {id:'AANV', label:'AANV',  role:'st',     x:50, y:18},
  ]},
  'sv7_222': { label:'2-2-2', spelvorm:7, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:32, y:68},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:68, y:68},
    {id:'MID_L',label:'MID-L', role:'dm',     x:30, y:44},
    {id:'MID_R',label:'MID-R', role:'dm',     x:70, y:44},
    {id:'AANV_L',label:'AANV-L',role:'st',    x:35, y:18},
    {id:'AANV_R',label:'AANV-R',role:'st',    x:65, y:18},
  ]},

  'sv8_331': { label:'3-3-1', spelvorm:8, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:22, y:70},
    {id:'DEF_C',label:'DEF-C', role:'cb',     x:50, y:74},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:78, y:70},
    {id:'MID_L',label:'MID-L', role:'dm',     x:22, y:46},
    {id:'MID_C',label:'MID-C', role:'dm',     x:50, y:48},
    {id:'MID_R',label:'MID-R', role:'dm',     x:78, y:46},
    {id:'AANV', label:'AANV',  role:'st',     x:50, y:18},
  ]},
  'sv8_232': { label:'2-3-2', spelvorm:8, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:30, y:70},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:70, y:70},
    {id:'MID_L',label:'MID-L', role:'dm',     x:20, y:46},
    {id:'MID_C',label:'MID-C', role:'dm',     x:50, y:48},
    {id:'MID_R',label:'MID-R', role:'dm',     x:80, y:46},
    {id:'AANV_L',label:'AANV-L',role:'st',    x:35, y:18},
    {id:'AANV_R',label:'AANV-R',role:'st',    x:65, y:18},
  ]},
  'sv8_322': { label:'3-2-2', spelvorm:8, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:22, y:70},
    {id:'DEF_C',label:'DEF-C', role:'cb',     x:50, y:74},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:78, y:70},
    {id:'MID_L',label:'MID-L', role:'dm',     x:32, y:44},
    {id:'MID_R',label:'MID-R', role:'dm',     x:68, y:44},
    {id:'AANV_L',label:'AANV-L',role:'st',    x:35, y:18},
    {id:'AANV_R',label:'AANV-R',role:'st',    x:65, y:18},
  ]},

  'sv9_332': { label:'3-3-2', spelvorm:9, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:22, y:72},
    {id:'DEF_C',label:'DEF-C', role:'cb',     x:50, y:76},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:78, y:72},
    {id:'MID_L',label:'MID-L', role:'dm',     x:22, y:48},
    {id:'MID_C',label:'MID-C', role:'dm',     x:50, y:50},
    {id:'MID_R',label:'MID-R', role:'dm',     x:78, y:48},
    {id:'AANV_L',label:'AANV-L',role:'st',    x:35, y:18},
    {id:'AANV_R',label:'AANV-R',role:'st',    x:65, y:18},
  ]},
  'sv9_341': { label:'3-4-1', spelvorm:9, pos:[
    {id:'GK',    label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L', label:'DEF-L', role:'back',   x:22, y:72},
    {id:'DEF_C', label:'DEF-C', role:'cb',     x:50, y:76},
    {id:'DEF_R', label:'DEF-R', role:'back',   x:78, y:72},
    {id:'MID_L', label:'MID-L', role:'dm',     x:15, y:46},
    {id:'MID_CL',label:'MID-CL',role:'dm',     x:40, y:48},
    {id:'MID_CR',label:'MID-CR',role:'dm',     x:60, y:48},
    {id:'MID_R', label:'MID-R', role:'dm',     x:85, y:46},
    {id:'AANV',  label:'AANV',  role:'st',     x:50, y:18},
  ]},
  'sv9_233': { label:'2-3-3', spelvorm:9, pos:[
    {id:'GK',   label:'GK',    role:'keeper', x:50, y:88},
    {id:'DEF_L',label:'DEF-L', role:'back',   x:32, y:70},
    {id:'DEF_R',label:'DEF-R', role:'back',   x:68, y:70},
    {id:'MID_L',label:'MID-L', role:'dm',     x:22, y:46},
    {id:'MID_C',label:'MID-C', role:'dm',     x:50, y:48},
    {id:'MID_R',label:'MID-R', role:'dm',     x:78, y:46},
    {id:'AANV_L',label:'AANV-L',role:'st',    x:25, y:18},
    {id:'AANV_C',label:'AANV-C',role:'st',    x:50, y:15},
    {id:'AANV_R',label:'AANV-R',role:'st',    x:75, y:18},
  ]},
};

// ─── Datalaag: Zelfgemaakte (sleepbare) formaties ───
// Zelfde patroon als custom_oef: lokale array-cache (fcp_custom_formaties) +
// Supabase-tabel custom_formaties, samengevoegd getoond met de vaste FORMATIES_BUILTIN.
function loadCustomFormaties() {
  return JSON.parse(localStorage.getItem('fcp_custom_formaties') || '[]');
}
function saveCustomFormatiesLijst(lijst) {
  localStorage.setItem('fcp_custom_formaties', JSON.stringify(lijst));
}
function toSbFormatie(f) {
  return { id:f.id, titel:f.titel, spelvorm:f.spelvorm, posities:f.posities || [] };
}
async function createFormatie(f) {
  return await sbFetch('custom_formaties', 'POST', toSbFormatie(f));
}
async function updateFormatie(id, f) {
  return await sbFetch('custom_formaties?id=eq.' + id, 'PATCH', toSbFormatie(f));
}
async function deleteFormatieRemote(id) {
  return await sbWrite('custom_formaties?id=eq.' + id, 'DELETE');
}
// Rol per positie wordt bij het slepen bewaard als grove indeling
// (verdediger/midden/aanval/keeper — zie formatie-editor.html) en hier vertaald
// naar dezelfde role-waarden als de vaste systemen, zodat POS_LABELS (hieronder)
// zonder aanpassing ook voor eigen systemen werkt. .label wordt niet apart
// opgeslagen (staat niet in de tabel) maar afgeleid uit .id, precies zoals de
// editor dat id al koos (bv. "DEF_L" -> "DEF-L").
const ROL_NAAR_ROLE = { verdediger:'back', midden:'dm', aanval:'st', keeper:'keeper' };
function normaliseerCustomFormatie(f) {
  const pos = (f.posities || []).map(p => ({
    id: p.id, label: p.id.replace(/_/g, '-'), role: ROL_NAAR_ROLE[p.rol] || 'dm', x: p.x, y: p.y,
  }));
  return { label: f.titel, spelvorm: f.spelvorm, pos, eigen: true };
}
// Laad gebruikersformaties uit localStorage
function loadFormaties() {
  const eigen = {};
  loadCustomFormaties().forEach(f => { eigen[f.id] = normaliseerCustomFormatie(f); });
  return { ...FORMATIES_BUILTIN, ...eigen };
}
// Filtert een formaties-object op spelvorm. Formaties zonder spelvorm-veld
// (bv. oudere eigen formaties) worden als 11-tegen-11 behandeld, zodat
// bestaande gebruikers niets merken totdat ze zelf een spelvorm kiezen.
function formatiesVoorSpelvorm(alle, spelvorm) {
  const sv = spelvorm || 11;
  const gefilterd = {};
  Object.entries(alle).forEach(([key, f]) => {
    if ((f.spelvorm || 11) === sv) gefilterd[key] = f;
  });
  return gefilterd;
}

// Backwards compat - FORMATIES verwijst nu naar de geladen set
let FORMATIES = loadFormaties();

const POS_LABELS = { keeper:'Keeper', back:'Back', cb:'Centrale back', dm:'Middenveld', am:'Aanvallend midden', st:'Spits' };
const ALL_POS_OPTS = ['Keeper','LB','RB','CB-L','CB-R','VM-L','VM-R','AM-L','AM-R','ST-L','ST-R','DM-L','DM-R','LAM','CAM','RAM','CF','LM','CM-L','CM-R','RM'];

// ─── THEMA'S ───
const THEMAS = {
  licht:      { name:'Licht (standaard)', topbar:'#2B1FA0', accent:'#2B1FA0', bg:'#F2F1FF', white:'#ffffff', text:'#12113A', text2:'#4A4870', text3:'#8B8AB0', border:'#E4E3F5' },
  licht_groen:{ name:'Licht Groen',       topbar:'#1B5E20', accent:'#1B7A4B', bg:'#F1F8F4', white:'#ffffff', text:'#0D2B14', text2:'#2E6645', text3:'#6B9E7A', border:'#D4EBD9' },
  licht_blauw:{ name:'Licht Blauw',       topbar:'#0D47A1', accent:'#1565C0', bg:'#F0F4FF', white:'#ffffff', text:'#0D1B4A', text2:'#2B4EA0', text3:'#6B82CC', border:'#C7D4FC' },
  fcp:        { name:'FCP Purmerend', topbar:'#1a1a1a', accent:'#F5C000', bg:'#111111', white:'#1e1e1e', text:'#F5F5F5', text2:'#CCCCCC', text3:'#888888', border:'#333333' },
  donker:     { name:'Donker',             topbar:'#080c14', accent:'#c8a840', bg:'#080c14', white:'#0e1524', text:'#e8eef8', text2:'#9aaccc', text3:'#5a7090', border:'#1e2e48' },
};

function loadThema() { return localStorage.getItem('fcp_thema') || 'licht'; }
function applyThema(key) {
  const t = THEMAS[key] || THEMAS.licht;
  const r = document.documentElement.style;
  // Topbar
  r.setProperty('--topbar',    t.topbar);
  r.setProperty('--topbar-dark', t.topbar);
  r.setProperty('--accent',    t.accent);
  r.setProperty('--accent2',   t.accent);
  // Achtergronden
  r.setProperty('--bg',        t.bg);
  r.setProperty('--white',     t.white);
  r.setProperty('--bg2',       t.white);
  r.setProperty('--bg3',       t.bg);
  r.setProperty('--bg4',       t.bg);
  // Tekst
  r.setProperty('--text',      t.text);
  r.setProperty('--text2',     t.text2);
  r.setProperty('--text3',     t.text3);
  // Borders
  r.setProperty('--border',    t.border);
  r.setProperty('--border2',   t.border);
  r.setProperty('--line',      t.border);
  r.setProperty('--line2',     t.border);
  // Fonts altijd DM Sans
  r.setProperty('--font-ui',      "'DM Sans',sans-serif");
  r.setProperty('--font-mono',    "'DM Mono',monospace");
  r.setProperty('--font-display', "'DM Sans',sans-serif");
  r.setProperty('--font-weight-title', '700');
  r.setProperty('--title-style', 'normal');
  r.setProperty('--badge-radius', '100px');
  r.setProperty('--card-shadow', '0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)');
  r.setProperty('--r',   '14px');
  r.setProperty('--rsm', '10px');
  // Veld altijd groen
  r.setProperty('--field-bg',     '#1B5E20');
  r.setProperty('--field-border', '#2E7D32');
  // Status bar kleur mee veranderen met thema
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', t.topbar);

  // Dynamische accentkleuren passend bij het thema
  const isDark = ['donker','fcp'].includes(key);
  if (isDark) {
    // Donker thema: lichte tekst op donkere achtergrond
    r.setProperty('--blauw-l',  'rgba(43,92,230,.2)');
    r.setProperty('--blauw-m',  'rgba(43,92,230,.4)');
    r.setProperty('--groen-l',  'rgba(27,122,75,.2)');
    r.setProperty('--groen-m',  'rgba(27,122,75,.4)');
    r.setProperty('--goud-l',   'rgba(184,134,11,.2)');
    r.setProperty('--goud-m',   'rgba(184,134,11,.4)');
    r.setProperty('--rood-l',   'rgba(198,40,40,.2)');
    r.setProperty('--rood-m',   'rgba(198,40,40,.4)');
    r.setProperty('--blauw',    '#7aacff');
    r.setProperty('--groen',    '#6ee0a0');
    r.setProperty('--goud',     '#f0d080');
    r.setProperty('--rood',     '#ff8080');
    r.setProperty('--paars-l',  'rgba(60,52,137,.2)');
    r.setProperty('--paars-m',  'rgba(60,52,137,.4)');
    r.setProperty('--oranje-l', 'rgba(113,43,19,.2)');
    r.setProperty('--oranje-m', 'rgba(113,43,19,.4)');
    r.setProperty('--paars',    '#b8a8ff');
    r.setProperty('--oranje',   '#f0a878');
    r.setProperty('--card-shadow', 'none');
  } else {
    r.setProperty('--blauw-l',  '#EEF2FF');
    r.setProperty('--blauw-m',  '#C7D4FC');
    r.setProperty('--groen-l',  '#E8F5EE');
    r.setProperty('--groen-m',  '#C3E8D2');
    r.setProperty('--goud-l',   '#FFF8E1');
    r.setProperty('--goud-m',   '#FFE082');
    r.setProperty('--rood-l',   '#FFEBEE');
    r.setProperty('--rood-m',   '#FFCDD2');
    r.setProperty('--paars-l',  '#EEEDFE');
    r.setProperty('--paars-m',  '#CECBF6');
    r.setProperty('--oranje-l', '#FAECE7');
    r.setProperty('--oranje-m', '#F5C4B3');
    r.setProperty('--blauw',    '#2B5CE6');
    r.setProperty('--groen',    '#1B7A4B');
    r.setProperty('--goud',     '#B8860B');
    r.setProperty('--rood',     '#C62828');
    r.setProperty('--paars',    '#3C3489');
    r.setProperty('--oranje',   '#712B13');
    r.setProperty('--card-shadow', '0 1px 3px rgba(43,31,160,.06),0 1px 2px rgba(0,0,0,.04)');
  }

  localStorage.setItem('fcp_thema', key);
}
// Thema direct toepassen bij laden
applyThema(loadThema());

// ─── TEAM INSTELLINGEN ───
function loadTeamInstellingen() {
  return JSON.parse(localStorage.getItem('fcp_team_config') || '{"naam":"","subtitel":"","trainer":""}');
}
function saveTeamInstellingen(config) {
  localStorage.setItem('fcp_team_config', JSON.stringify(config));
  // Sync naar Supabase via session_notes
  if (typeof supabaseReady !== 'undefined' && supabaseReady) {
    sbFetch('session_notes?note_key=eq.team_config', 'DELETE').then(() =>
      sbFetch('session_notes', 'POST', { note_key:'team_config', content:JSON.stringify(config) })
    );
  }
}

// ─── SPELVORM ───
// Directe keuze door de trainer (geen afleiding uit leeftijdscategorie —
// de spelregel verschilt per team/divisie, met name bij O13/O14).
const SPELVORM_OPTIES = { 4:'4 tegen 4', 6:'6 tegen 6', 7:'7 tegen 7', 8:'8 tegen 8', 9:'9 tegen 9', 11:'11 tegen 11' };
function loadSpelvorm() {
  return parseInt(localStorage.getItem('fcp_spelvorm'), 10) || 11;
}
function saveSpelvorm(spelvorm) {
  const sv = parseInt(spelvorm, 10) || 11;
  localStorage.setItem('fcp_spelvorm', String(sv));
  // Sync naar Supabase via session_notes, zelfde patroon als team_config
  if (typeof supabaseReady !== 'undefined' && supabaseReady) {
    sbFetch('session_notes?note_key=eq.spelvorm', 'DELETE').then(() =>
      sbFetch('session_notes', 'POST', { note_key:'spelvorm', content:String(sv) })
    );
  }
  return sv;
}

// ─── SCHEMA DATA ───
const SCHEMA_DATES  = {1:'2026-08-03',2:'2026-08-10',3:'2026-08-17',4:'2026-08-24',5:'2026-08-31',6:'2026-09-07',7:'2026-09-14',8:'2026-09-21',9:'2026-09-28',10:'2026-10-05',11:'2026-10-12',12:'2026-10-19'};
const SCHEMA_WEEKNR = {1:32,2:33,3:34,4:35,5:36,6:37,7:38,8:39,9:40,10:41,11:42,12:43};
const PR_TAGS = { P1:{bg:'#0a1e10',c:'#70e890'}, P2:{bg:'#160e28',c:'#a080f8'}, P3:{bg:'#241400',c:'#f0a040'}, P4:{bg:'#240010',c:'#f04070'}, P5:{bg:'#001828',c:'#40a8f0'}, P6:{bg:'#101800',c:'#a8e040'} };
const CAT_STYLES = {
  OPW:{bg:'#241400',c:'#f0a040',label:'opwarmen'},
  CON:{bg:'#101800',c:'#a8e040',label:'conditie'},
  TEC:{bg:'#001828',c:'#40a8f0',label:'techniek'},
  POS:{bg:'#0a1e10',c:'#70e890',label:'positiespel'},
  CPR:{bg:'#240010',c:'#f04070',label:'counterpressing'},
  PAR:{bg:'#160e28',c:'#a080f8',label:'partijvorm'},
  EVA:{bg:'#181818',c:'#888',   label:'evaluatie'},
};
const CAT_BG   = { opwarmen:{bg:'#241400',c:'#f0a040'}, conditie:{bg:'#101800',c:'#a8e040'}, techniek:{bg:'#001828',c:'#40a8f0'}, positiespel:{bg:'#0a1e10',c:'#70e890'}, counterpressing:{bg:'#240010',c:'#f04070'}, partijvorm:{bg:'#160e28',c:'#a080f8'} };

// ─── SKILLS ───
// SKILL_CATS/SKILL_LEVELS zijn vervangen door de gedeelde FORM_SKILLS/SKILL_OPTIES
// (zie hierboven) — was een derde, losse kopie van dezelfde 15 vaardigheden.

// ─── POSITIE BADGES ───
// K/V/M/A en de vaardigheidsniveaus (SKILL_COLORS hieronder) zijn vaste
// categoriekleuren (niet var(--accent) e.d.) zodat ze onderling herkenbaar
// blijven ongeacht thema. In de donkere thema's (donker, fcp) zijn de
// lichte pastelkleuren daaronder echter te fel op een donkere achtergrond
// — vandaar een aparte, donkere variant per categorie, gekozen op basis
// van het actieve thema (zelfde donker-chip-stijl als PR_TAGS/CAT_STYLES).
function isDarkThema() {
  const t = loadThema();
  return t === 'donker' || t === 'fcp';
}
const ROL_STIJL = {
  licht: {
    'K': 'background:#E6F1FB;color:#0C447C;border:1px solid #B5D4F4',
    'V': 'background:#EAF3DE;color:#27500A;border:1px solid #C0DD97',
    'M': 'background:#EEEDFE;color:#3C3489;border:1px solid #CECBF6',
    'A': 'background:#FAECE7;color:#712B13;border:1px solid #F5C4B3',
  },
  donker: {
    'K': 'background:#12283f;color:#7EC8F5;border:1px solid #1F3F5C',
    'V': 'background:#16290d;color:#9EDC7A;border:1px solid #294A1C',
    'M': 'background:#221c40;color:#B8A8F5;border:1px solid #392F66',
    'A': 'background:#3a1c10;color:#F5A17E;border:1px solid #5C3220',
  },
};
function getRolBadges(posities) {
  if (!posities || !posities.length) return '';
  // Moet elke optie uit ALL_POS_OPTS (app.js) dekken. 'Keeper' was hier eerder 'GK',
  // waardoor elke speler met de (echte, selecteerbare) tag 'Keeper' nooit een badge kreeg.
  const ROLE_MAP = {
    'Keeper':'keeper',
    'LB':'back','RB':'back','CB-L':'cb','CB-R':'cb',
    'VM-L':'dm','VM-R':'dm','DM-L':'dm','DM-R':'dm',
    'AM-L':'am','AM-R':'am','LAM':'am','CAM':'am','RAM':'am','LM':'am','RM':'am','CM-L':'am','CM-R':'am',
    'ST-L':'st','ST-R':'st','CF':'st'
  };
  const rollen = new Set();
  posities.forEach(p => {
    const r = ROLE_MAP[p];
    if (r === 'keeper') rollen.add('K');
    else if (r === 'back' || r === 'cb') rollen.add('V');
    else if (r === 'dm' || r === 'am') rollen.add('M');
    else if (r === 'st') rollen.add('A');
  });
  const stijl = ROL_STIJL[isDarkThema() ? 'donker' : 'licht'];
  return ['K','V','M','A'].filter(r => rollen.has(r))
    .map(r => `<span style="${stijl[r]};font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px">${r}</span>`)
    .join('');
}
// Rolkleur (K/V/M/A, zie getRolBadges hierboven) op basis van een veldpositie-label
// (bv. 'CB-L', 'VM-R', 'ST-L'). Gebruikt voor het pil-label onder elke speler op het veld
// in opstelling.html en wedstrijden.html (en, als losse kopie, in live.html dat app.js niet laadt).
function fieldRoleClass(label) {
  if (label === 'GK') return 'rol-keeper';
  if (/^(LB|RB|CB|LWB|RWB|DEF|ACHT)/.test(label)) return 'rol-verdediger';
  if (/^(ST|CF|LW|RW|AANV|VOOR)/.test(label)) return 'rol-aanval';
  return 'rol-midden';
}
const SKILL_COLORS = {
  licht: {
    'Ontwikkel punt': { bg:'#FFEBEE', fg:'#C62828', label:'Ontwikkelpunt' },
    'Voldoende':      { bg:'#FFF3E0', fg:'#E65100', label:'Voldoende' },
    'Goed':           { bg:'#F1F8E9', fg:'#558B2F', label:'Goed' },
    'Zeer goed':      { bg:'#E8F5E9', fg:'#1B5E20', label:'Zeer goed' },
  },
  donker: {
    'Ontwikkel punt': { bg:'#3a1414', fg:'#F57373', label:'Ontwikkelpunt' },
    'Voldoende':      { bg:'#3a2408', fg:'#FFB04D', label:'Voldoende' },
    'Goed':           { bg:'#1c2e10', fg:'#A3D977', label:'Goed' },
    'Zeer goed':      { bg:'#0f2b12', fg:'#6FCF7A', label:'Zeer goed' },
  },
};
// Vaardigheidsniveau-kleur voor het huidige thema (zie isDarkThema hierboven).
function getSkillColor(level) {
  const set = SKILL_COLORS[isDarkThema() ? 'donker' : 'licht'];
  return set[level];
}

// ─── UTILITIES ───
function genId() { return 'i' + Date.now() + Math.random().toString(36).slice(2, 6); }

function safeEncode(str) {
  try { return btoa(unescape(encodeURIComponent(str))); }
  catch(e) { return btoa(str.replace(/[^-]/g, '?')); }
}
function safeDecode(str) {
  try { return decodeURIComponent(escape(atob(str))); }
  catch(e) { return atob(str); }
}

function showToast(msg, duurMs = 2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(() => t.classList.remove('show'), duurMs);
}

function sortedPlayers(players) {
  return [...players].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

// Deelt spelers in voor de positie-kies-modal (opstelling.html & wedstrijden.html):
// 1. passend  — spelers wiens positievoorkeur bij deze plek past
// 2. onbezet  — overige spelers die nog nergens in de huidige opstelling staan
// 3. bezet    — overige spelers die elders al opgesteld staan
// Zoekt de beste "elders al geplaatst"-regel voor een speler in lineup-data. Een speler kan
// meerdere regels hebben (bv. restjes van eerder gebruikte, andere formaties die nooit zijn
// opgeruimd) — geef voorrang aan een regel die bij de HUIDIGE formatie hoort, zodat zo'n
// verouderd restje niet de juiste, actuele toewijzing verdringt.
function vindHuidigeToewijzing(playerId, lineup, geldigePosIds, uitgeslotenPosId) {
  const alleTreffers = Object.entries(lineup || {}).filter(([k, v]) => v === playerId && k !== uitgeslotenPosId);
  return (geldigePosIds ? alleTreffers.find(([k]) => geldigePosIds.includes(k)) : null) || alleTreffers[0];
}

function splitSpelersVoorPositie(players, pos, lineup, geldigePosIds) {
  const posLabel = pos.label.replace('-', '').toLowerCase();
  const matched = [], onbezet = [], bezet = [];
  sortedPlayers(players).forEach(p => {
    const posities = (p.posities || []).map(x => x.toLowerCase().replace('-', ''));
    const isMatch = posities.includes(posLabel) || posities.includes(pos.label.toLowerCase());
    const elders = vindHuidigeToewijzing(p.id, lineup, geldigePosIds, pos.id);
    if (isMatch) matched.push(p);
    else if (elders) bezet.push(p);
    else onbezet.push(p);
  });
  return { matched, onbezet, bezet };
}

function formatDatumShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const mnd = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return d.getDate() + ' ' + mnd[d.getMonth()];
}

function formatDatumVol(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dagen = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const mnd = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  return dagen[d.getDay()] + ' ' + d.getDate() + ' ' + mnd[d.getMonth()];
}

function getISOWeek(dateStr) {
  const d = new Date(dateStr);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const year = tmp.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const weekNr = Math.ceil((((tmp - start) / 86400000) + 1) / 7);
  return 'Week ' + weekNr + ' (' + year + ')';
}

// ─── NAV: markeer actieve pagina ───
function markActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index-classic.html';
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('href') === page || btn.getAttribute('data-page') === page);
  });
}

// ─── SCROLL TOP ───
function initScrollTop() {
  window.addEventListener('scroll', () => {
    const el = document.getElementById('scrollTop');
    if (el) el.classList.toggle('visible', window.scrollY > 300);
  });
}

// ─── MANIFEST ───
function initManifest() { /* manifest.json is statisch, geen actie nodig */ }

const BUILTIN_OEF = []; // Ingebouwde oefeningen verwijderd — gebruik eigen oefeningen via + Nieuw

// ─── DESKTOP SIDEBAR PANEL ───
function initDesktopPanel() {
  const existing = document.getElementById('desktop-panel');
  if (existing) existing.remove();
  // Dit paneel is gestyled voor de klassieke pagina's (donkere sidebar-achtergrond
  // uit style.css) — index.html/Interface V2/live.html laden app.js ook, maar hebben geen
  // sidebar-layout, waardoor dit paneel daar als een onleesbaar wit spookpaneel
  // onderaan de pagina zou verschijnen. body.v2 is de marker van die andere shell.
  if (document.body.classList.contains('v2')) return;
  if (window.innerWidth < 1100) return;

  const panel = document.createElement('div');
  panel.id = 'desktop-panel';
  panel.style.cssText = [
    'width:220px',
    'flex-shrink:0',
    'padding:48px 0 0',
    'font-family:\'DM Sans\',sans-serif',
  ].join(';');

  // Sinds de V2-omwisseling (2026-09-06, zie CLAUDE.md) is index.html V2 en heet
  // de klassieke start-pagina index-classic.html — dit paneel bestaat alleen op
  // klassieke pagina's (v2-guard hierboven), dus "Start" wijst hier naar die naam.
  const page = window.location.pathname.split('/').pop();
  const links = [
    ['index-classic.html','Start'],
    ['opstelling.html','Opstelling'],
    ['selectie.html','Selectie'],
    ['wedstrijden.html','Wedstrijden'],
    ['trainen.html','Trainingen'],
    ['oefeningen.html','Oefeningen'],
    ['team.html','Dashboard'],
    ['instellingen.html','Instellingen'],
  ];

  // Teamnaam/subtitel uit dezelfde instelling als de topbar (applyTeamConfig)
  // lezen i.p.v. hardcoded — zodat een naamswijziging via Instellingen hier ook
  // meteen meekomt, i.p.v. hier los van te raken.
  const cfg = loadTeamInstellingen();
  const cfgDelen = cfg.naam.split(' ');
  const naamHtml = cfgDelen.length > 1
    ? cfgDelen.slice(0, -1).join(' ') + ' <span style="opacity:.4">' + cfgDelen[cfgDelen.length - 1] + '</span>'
    : cfg.naam;

  panel.innerHTML = `
    <div style="font-size:26px;font-weight:800;color:#fff;margin-bottom:2px">${naamHtml}</div>
    <div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:28px">${cfg.subtitel || ''}</div>
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Navigatie</div>
    ${links.map(([href, label]) => {
      const active = page === href;
      return `<a href="${href}" style="display:block;padding:7px 12px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:${active?'600':'400'};color:${active?'#fff':'rgba(255,255,255,.45)'};background:${active?'rgba(255,255,255,.1)':'transparent'};margin-bottom:2px;transition:background .15s"
        onmouseover="this.style.background=this.style.background||'rgba(255,255,255,.05)'"
        onmouseout="this.style.background='${active?'rgba(255,255,255,.1)':'transparent'}'"
      >${label}</a>`;
    }).join('')}
    <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.25);line-height:1.7">
      Draai je telefoon<br>voor landscape modus.
    </div>
  `;

  document.body.appendChild(panel);
}

// ─── LANDSCAPE RESPONSIVE ───
function isLandscape() {
  // Touch-apparaat check: telefoon/tablet heeft coarse pointer, laptop niet
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  return isTouch && window.innerWidth > window.innerHeight;
}

function applyLandscape() {
  const ls = isLandscape();
  document.body.classList.toggle('is-landscape', ls);
  const nav = document.querySelector('.nav');
  if (nav) nav.classList.toggle('nav-landscape', ls);
}

// ─── Auth-functies (login/refresh/uitloggen) — raw fetch naar Supabase's
// eigen Auth-REST-API, zelfde stijl als sbFetch, geen supabase-js SDK nodig. ───
function saveAuthSession(session) {
  AUTH_ACCESS_TOKEN = session.access_token;
  AUTH_REFRESH_TOKEN = session.refresh_token;
  AUTH_EXPIRES_AT = Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
  localStorage.setItem('sb_access_token', AUTH_ACCESS_TOKEN);
  localStorage.setItem('sb_refresh_token', AUTH_REFRESH_TOKEN);
  localStorage.setItem('sb_expires_at', String(AUTH_EXPIRES_AT));
}
function clearAuthSession() {
  AUTH_ACCESS_TOKEN = ''; AUTH_REFRESH_TOKEN = ''; AUTH_EXPIRES_AT = 0;
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  localStorage.removeItem('sb_expires_at');
}
async function signIn(email, wachtwoord) {
  if (!SB_URL || !SB_KEY) return { _error: true, message: 'Geen Supabase-koppeling ingesteld.' };
  try {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: wachtwoord }),
    });
    let j;
    try { j = await r.json(); } catch (e) { return { _error: true, message: 'Kan geen verbinding maken — controleer de Project URL.' }; }
    if (!r.ok) return { _error: true, message: j.error_description || j.msg || 'Inloggen mislukt' };
    saveAuthSession(j);
    return { ok: true };
  } catch (e) { return { _error: true, message: 'Kan geen verbinding maken — controleer de Project URL.' }; }
}
async function refreshAuthSession() {
  if (!SB_URL || !SB_KEY || !AUTH_REFRESH_TOKEN) return false;
  try {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: AUTH_REFRESH_TOKEN }),
    });
    if (!r.ok) { clearAuthSession(); return false; }
    const j = await r.json();
    saveAuthSession(j);
    return true;
  } catch (e) { return false; }
}
function signOut() {
  clearAuthSession();
  location.reload();
}

// ─── Trainer-profielen (invite-only accounts) — trainer_profielen is de enige
// bron van waarheid voor "wie mag erin"; RLS checkt dit zelf ook (self-
// referentiële policy), dit is puur voor de UI (lijst tonen, rol bepalen). ───
let HUIDIGE_GEBRUIKER = null;
async function haalHuidigeGebruiker() {
  if (HUIDIGE_GEBRUIKER) return HUIDIGE_GEBRUIKER;
  if (!SB_URL || !AUTH_ACCESS_TOKEN) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + AUTH_ACCESS_TOKEN } });
    if (!r.ok) return null;
    const j = await r.json();
    HUIDIGE_GEBRUIKER = { id: j.id, email: j.email };
    return HUIDIGE_GEBRUIKER;
  } catch(e) { return null; }
}
async function haalTrainerProfielen() {
  const res = await sbFetch('trainer_profielen?select=*&order=created_at.asc');
  return res && !res._error ? res : [];
}
// Elke actieve trainer mag beheren (uitnodigen/intrekken) — bewust geen
// hoofdtrainer-onderscheid, zelfde regel als de Edge Function en RLS hanteren.
async function magTrainersBeheren() {
  const mij = await haalHuidigeGebruiker();
  if (!mij) return false;
  const lijst = await haalTrainerProfielen();
  const eigen = lijst.find(t => t.user_id === mij.id);
  return !!(eigen && eigen.status === 'actief');
}
// Roept de invite-trainer Edge Function aan (service_role-key blijft server-side,
// nooit in clientcode) — die checkt zelf nogmaals dat de aanroeper een actieve
// trainer is.
async function nodigTrainerUit(naam, email) {
  try {
    const r = await fetch(SB_URL + '/functions/v1/invite-trainer', {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + huidigeAuthToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ naam, email }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { _error: true, message: j.error || ('Fout ' + r.status) };
    return { ok: true };
  } catch(e) { return { _error: true, message: e.message }; }
}
async function trekTrainerIn(userId) {
  return await sbWrite('trainer_profielen?user_id=eq.' + userId, 'PATCH', { status: 'ingetrokken' });
}

// Na een klik op een uitnodigings- of wachtwoord-reset-link stuurt Supabase
// door naar de Site URL met de sessie in het URL-fragment (#access_token=...
// &type=invite). Zonder dit werd dat genegeerd: Supabase had de gebruiker al
// "ingelogd", maar de app wist van niets en toonde gewoon het normale
// inlogscherm — precies het gat dat op 2026-09-04/05 (wachtwoord-reset) en
// 2026-09-06 (invite) tegen de lamp liep, ook nadat de Site URL al gefixt was.
function verwerkAuthHashIndienAanwezig() {
  if (!location.hash || location.hash.length < 2) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const type = params.get('type');
  const accessToken = params.get('access_token');
  if (!accessToken || (type !== 'invite' && type !== 'recovery')) return false;
  saveAuthSession({
    access_token: accessToken,
    refresh_token: params.get('refresh_token') || '',
    expires_in: parseInt(params.get('expires_in'), 10) || 3600,
  });
  // Fragment meteen weghalen — anders blijft het token in de adresbalk staan
  // (zichtbaar, en zou bij een herlaad opnieuw als "net binnengekomen" gelden).
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
// ─── Auth-gate — blokkeert de pagina met een inlogscherm totdat er een
// geldige trainerssessie is. Draait vanuit dezelfde DOMContentLoaded-
// listener als initDesktopPanel() (geen wijziging per pagina nodig). Niet
// actief op body.v2 (nu index.html/Interface V2 — heeft een eigen auth-gate,
// initAuthGateV2(), die dezelfde sessiefuncties hergebruikt) en sowieso niet
// op live.html/spelerformulier.html (laden app.js niet resp. blijven bewust
// zonder login, zie het fix-plan van 2026-09-04). ───
async function initAuthGate() {
  if (document.body.classList.contains('v2')) return;
  if (!SB_URL || !SB_KEY) return; // geen koppeling ingesteld — config-banner vangt dit al af
  if (verwerkAuthHashIndienAanwezig()) { renderWachtwoordInstellen(); return; }
  const nu = Math.floor(Date.now() / 1000);
  if (AUTH_ACCESS_TOKEN && AUTH_EXPIRES_AT - nu > 60) { renderAuthGate(false); return; }
  if (AUTH_REFRESH_TOKEN && await refreshAuthSession()) { renderAuthGate(false); return; }
  renderAuthGate(true);
}
// Toont een wachtwoord-instelscherm i.p.v. het normale inlogscherm — de sessie
// van het invite/recovery-token staat al klaar (verwerkAuthHashIndienAanwezig),
// er hoeft alleen nog een wachtwoord gezet te worden. Na succes: als dit een
// invite was, de eigen trainer_profielen-rij op 'actief' zetten (mag van RLS
// alleen als zelf-activering vanuit 'uitgenodigd', zie trainer_profielen_zelf_
// activeren) zodat de nieuwe trainer meteen ook zelf kan uitnodigen/intrekken.
function renderWachtwoordInstellen() {
  const bestaand = document.getElementById('auth-gate');
  if (bestaand) bestaand.remove();
  const overlay = document.createElement('div');
  overlay.id = 'auth-gate';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-ui)';
  overlay.innerHTML = `
    <div style="width:100%;max-width:320px">
      <div style="font-size:22px;font-weight:800;color:var(--text)">Wachtwoord instellen</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Kies een wachtwoord om je account te activeren.</div>
      <div class="bmodal-label" style="margin-top:0">Nieuw wachtwoord</div>
      <input class="bmodal-input" id="wwi-nieuw" type="password" autocomplete="new-password">
      <div class="bmodal-label">Herhaal wachtwoord</div>
      <input class="bmodal-input" id="wwi-herhaal" type="password" autocomplete="new-password" style="margin-bottom:14px">
      <button id="wwi-submit" class="btn btn-primary">Wachtwoord instellen</button>
      <div id="wwi-fout" style="color:var(--red);font-size:12.5px;margin-top:10px;min-height:16px"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const nieuwEl = document.getElementById('wwi-nieuw');
  const herhaalEl = document.getElementById('wwi-herhaal');
  const foutEl = document.getElementById('wwi-fout');
  const submitEl = document.getElementById('wwi-submit');
  const doOpslaan = async () => {
    const ww = nieuwEl.value;
    if (ww.length < 6) { foutEl.textContent = 'Minstens 6 tekens.'; return; }
    if (ww !== herhaalEl.value) { foutEl.textContent = 'Wachtwoorden komen niet overeen.'; return; }
    submitEl.disabled = true; submitEl.textContent = 'Bezig...';
    try {
      const r = await fetch(SB_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + AUTH_ACCESS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: ww }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        foutEl.textContent = j.msg || j.error_description || 'Opslaan mislukt';
        submitEl.disabled = false; submitEl.textContent = 'Wachtwoord instellen';
        return;
      }
      const mij = await haalHuidigeGebruiker();
      if (mij) await sbFetch('trainer_profielen?user_id=eq.' + mij.id, 'PATCH', { status: 'actief' });
    } catch(e) {
      foutEl.textContent = e.message;
      submitEl.disabled = false; submitEl.textContent = 'Wachtwoord instellen';
      return;
    }
    location.reload();
  };
  submitEl.onclick = doOpslaan;
  herhaalEl.addEventListener('keydown', e => { if (e.key === 'Enter') doOpslaan(); });
  nieuwEl.focus();
}
function renderAuthGate(tonen) {
  const bestaand = document.getElementById('auth-gate');
  if (bestaand) bestaand.remove();
  if (!tonen) return;
  // Gebruikt de bestaande stijl-classes uit style.css (.bmodal-label/.bmodal-input/
  // .btn.btn-primary) i.p.v. eigen kleuren te verzinnen — volgt zo automatisch het
  // thema dat de trainer al gekozen had (licht/donker/fcp/licht_groen/licht_blauw),
  // want applyThema() heeft de --custom-properties allang gezet vóór dit overlay
  // verschijnt.
  const overlay = document.createElement('div');
  overlay.id = 'auth-gate';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-ui)';
  overlay.innerHTML = `
    <div style="width:100%;max-width:320px">
      <div style="font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px">Inloggen</div>
      <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Alleen voor trainers — vul je inloggegevens in.</div>
      <div class="bmodal-label" style="margin-top:0">E-mailadres</div>
      <input class="bmodal-input" id="auth-email" type="email" autocomplete="username">
      <div class="bmodal-label">Wachtwoord</div>
      <input class="bmodal-input" id="auth-wachtwoord" type="password" autocomplete="current-password" style="margin-bottom:14px">
      <button id="auth-submit" class="btn btn-primary">Inloggen</button>
      <div id="auth-fout" style="color:var(--red);font-size:12.5px;margin-top:10px;min-height:16px"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const emailEl = document.getElementById('auth-email');
  const wwEl = document.getElementById('auth-wachtwoord');
  const foutEl = document.getElementById('auth-fout');
  const submitEl = document.getElementById('auth-submit');
  const doLogin = async () => {
    submitEl.disabled = true; submitEl.textContent = 'Bezig...';
    const res = await signIn(emailEl.value.trim(), wwEl.value);
    if (res && res.ok) { location.reload(); return; }
    foutEl.textContent = (res && res.message) || 'Inloggen mislukt';
    submitEl.disabled = false; submitEl.textContent = 'Inloggen';
  };
  submitEl.onclick = doLogin;
  wwEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  emailEl.focus();
}

window.addEventListener('DOMContentLoaded', () => {
  initDesktopPanel();
  applyLandscape();
  initAuthGate();
});
window.addEventListener('resize', () => {
  initDesktopPanel();
  applyLandscape();
});
window.addEventListener('orientationchange', () => { setTimeout(applyLandscape, 150); });
if (typeof screen !== 'undefined' && screen.orientation) {
  screen.orientation.addEventListener('change', () => { setTimeout(applyLandscape, 150); });
}

// Service worker registreren vanaf elke pagina (niet alleen Start), zodat de PWA ook goed werkt
// als iemand voor het eerst op een andere pagina binnenkomt (bv. via een bookmark of gedeelde link).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/fcp16-2/sw.js')
      .catch(e => console.log('SW registratie mislukt:', e));
  });
}
