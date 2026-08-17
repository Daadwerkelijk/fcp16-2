// ═══════════════════════════════════════════════
// FCP 16-2 — Gedeelde app logica
// ═══════════════════════════════════════════════

// ─── SUPABASE ───
let SB_URL = localStorage.getItem('sb_url') || '';
let SB_KEY  = localStorage.getItem('sb_key')  || '';
let supabaseReady = false;

async function sbFetch(path, method = 'GET', body = null) {
  if (!SB_URL || !SB_KEY) return null;
  const opts = {
    method,
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
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
    if (ct.includes('json')) return await r.json();
    return true;
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
// Doet exact hetzelfde als de eerdere losse aanroep in index.html: zelfde tabel, zelfde
// velden, zelfde foutafhandeling via sbWrite (incl. automatische herhaalpogingen).
async function updatePrincipe(id, velden) {
  return await sbWrite('principes?id=eq.' + id, 'PATCH', velden);
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
    const s = test?.status || 0;
    const msg = s === 0   ? '❌ Netwerkfout — controleer de URL'
              : s === 401 || s === 403 ? '❌ Ongeldige API key'
              : s === 404 ? '❌ Tabellen niet gevonden — SQL nog niet uitgevoerd?'
              : '❌ Fout ' + s + ': ' + (test?.message || '');
    if (msgEl) msgEl.textContent = msg;
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
  const [pl, lu, sn, oe, ca, wd, pr, aanw, cw] = await Promise.all([
    sbFetch('players?select=*&order=created_at'),
    sbFetch('lineup?select=*'),
    sbFetch('session_notes?select=*'),
    sbFetch('custom_oef?select=*&order=created_at'),
    sbFetch('categories?select=*&order=sort_order'),
    sbFetch('wedstrijden?select=*&order=created_at'),
    sbFetch('principes?select=*&order=sort_order'),
    sbFetch('aanwezigheid?select=*'),
    sbFetch('custom_weken?id=eq.singleton&select=*'),
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
    if (notes['team_config']) {
      try {
        const cfg = JSON.parse(notes['team_config']);
        if (cfg && cfg.naam) { result.teamConfig = cfg; localStorage.setItem('fcp_team_config', JSON.stringify(cfg)); }
      } catch(e) {}
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
  '4222': { label:'4-2-2-2', pos:[
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
  '14231': { label:'4-2-3-1', pos:[
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
  '433a': { label:'4-3-3 (punt achter)', pos:[
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
  '352': { label:'3-5-2 (punt voor)', pos:[
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
  '13421': { label:'3-4-2-1', pos:[
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
  '442v': { label:'4-4-2 vlak', pos:[
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
  '442r': { label:'4-4-2 ruit', pos:[
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
  '532': { label:'5-3-2', pos:[
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
  '433b': { label:'4-3-3 (punt voor)', pos:[
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
};

// Laad gebruikersformaties uit localStorage
function loadFormaties() {
  const custom = JSON.parse(localStorage.getItem('fcp_custom_formaties') || '{}');
  return { ...FORMATIES_BUILTIN, ...custom };
}
function saveCustomFormatie(key, formatie) {
  const custom = JSON.parse(localStorage.getItem('fcp_custom_formaties') || '{}');
  custom[key] = formatie;
  localStorage.setItem('fcp_custom_formaties', JSON.stringify(custom));
}
function deleteCustomFormatie(key) {
  const custom = JSON.parse(localStorage.getItem('fcp_custom_formaties') || '{}');
  delete custom[key];
  localStorage.setItem('fcp_custom_formaties', JSON.stringify(custom));
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
    r.setProperty('--blauw',    '#2B5CE6');
    r.setProperty('--groen',    '#1B7A4B');
    r.setProperty('--goud',     '#B8860B');
    r.setProperty('--rood',     '#C62828');
    r.setProperty('--card-shadow', '0 1px 3px rgba(43,31,160,.06),0 1px 2px rgba(0,0,0,.04)');
  }

  localStorage.setItem('fcp_thema', key);
}
// Thema direct toepassen bij laden
applyThema(loadThema());

// ─── TEAM INSTELLINGEN ───
function loadTeamInstellingen() {
  return JSON.parse(localStorage.getItem('fcp_team_config') || '{"naam":"FCP 16-2","subtitel":"Seizoen 2026/2027","trainer":"Stefan & Onno"}');
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

// ─── SCHEMA DATA ───
const SCHEMA_DATES  = {1:'2026-08-03',2:'2026-08-10',3:'2026-08-17',4:'2026-08-24',5:'2026-08-31',6:'2026-09-07',7:'2026-09-14',8:'2026-09-21',9:'2026-09-28',10:'2026-10-05',11:'2026-10-12',12:'2026-10-19'};
const SCHEMA_WEEKNR = {1:32,2:33,3:34,4:35,5:36,6:37,7:38,8:39,9:40,10:41,11:42,12:43};
const FASES = {
  m1:{ label:'Augustus 2026',   sub:'Wk 32–35 · Voorbereiding · systeem · conditie', tagbg:'#241400', tagc:'#f0a040' },
  m2:{ label:'September 2026',  sub:'Wk 36–39 · Seizoen gestart · automatismen',      tagbg:'#0a1e10', tagc:'#70e890' },
  m3:{ label:'Oktober 2026',    sub:'Wk 40–43 · Verfijnen · spelers als leiders',     tagbg:'#001828', tagc:'#40a8f0' },
};
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
const CAT_DOT  = { opwarmen:'#f0a040', conditie:'#a8e040', techniek:'#40a8f0', positiespel:'#70e890', counterpressing:'#f04070', partijvorm:'#a080f8' };
const CAT_BG   = { opwarmen:{bg:'#241400',c:'#f0a040'}, conditie:{bg:'#101800',c:'#a8e040'}, techniek:{bg:'#001828',c:'#40a8f0'}, positiespel:{bg:'#0a1e10',c:'#70e890'}, counterpressing:{bg:'#240010',c:'#f04070'}, partijvorm:{bg:'#160e28',c:'#a080f8'} };

// ─── SKILLS ───
const SKILL_CATS = [
  { cat:'Techniek', skills:['Balcontrole','Dribbel','Passen van de bal','Schieten op doel'] },
  { cat:'Tactiek',  skills:['Positiespel','Inzicht','Teamplayer'] },
  { cat:'Fysiek',   skills:['Conditie','Explosieve kracht','Duel kracht'] },
  { cat:'Mentaal',  skills:['Gedrag','Motivatie','Aandacht','Discipline','Omgaan met tegenslag'] },
];
const SKILL_LEVELS = ['Ontwikkel punt','Voldoende','Goed','Zeer goed'];

// ─── POSITIE BADGES ───
function getRolBadges(posities) {
  if (!posities || !posities.length) return '';
  const ROLE_MAP = {
    'GK':'keeper','LB':'back','CB-L':'cb','CB-R':'cb','RB':'back',
    'VM-L':'dm','VM-R':'dm','AM-L':'am','AM-R':'am','ST-L':'st','ST-R':'st','CF':'st'
  };
  const rollen = new Set();
  posities.forEach(p => {
    const r = ROLE_MAP[p];
    if (r === 'keeper') rollen.add('K');
    else if (r === 'back' || r === 'cb') rollen.add('V');
    else if (r === 'dm' || r === 'am') rollen.add('M');
    else if (r === 'st') rollen.add('A');
  });
  const stijl = {
    'K': 'background:#E6F1FB;color:#0C447C;border:1px solid #B5D4F4',
    'V': 'background:#EAF3DE;color:#27500A;border:1px solid #C0DD97',
    'M': 'background:#EEEDFE;color:#3C3489;border:1px solid #CECBF6',
    'A': 'background:#FAECE7;color:#712B13;border:1px solid #F5C4B3',
  };
  return ['K','V','M','A'].filter(r => rollen.has(r))
    .map(r => `<span style="${stijl[r]};font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px">${r}</span>`)
    .join('');
}
const SKILL_COLORS = {
  'Ontwikkel punt': { bg:'#FFEBEE', c:'#C62828' },
  'Voldoende':      { bg:'#FFF3E0', c:'#E65100' },
  'Goed':           { bg:'#F1F8E9', c:'#558B2F' },
  'Zeer goed':      { bg:'#E8F5E9', c:'#1B5E20' },
};

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
function splitSpelersVoorPositie(players, pos, lineup) {
  const posLabel = pos.label.replace('-', '').toLowerCase();
  const matched = [], onbezet = [], bezet = [];
  sortedPlayers(players).forEach(p => {
    const posities = (p.posities || []).map(x => x.toLowerCase().replace('-', ''));
    const isMatch = posities.includes(posLabel) || posities.includes(pos.label.toLowerCase());
    const elders = Object.entries(lineup || {}).find(([k, v]) => v === p.id && k !== pos.id);
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
  const page = window.location.pathname.split('/').pop() || 'index.html';
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

// ─── LANDSCAPE RESPONSIVE ───
function isLandscape() {
  // Touch-apparaat check: telefoon/tablet heeft coarse pointer, laptop niet
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  return isTouch && window.innerWidth > window.innerHeight;
}

function applyLandscape() {
  const ls = isLandscape();
  document.body.classList.toggle('is-landscape', ls);

  // Nav: voeg klasse toe zodat CSS hem links zet
  const nav = document.querySelector('.nav');
  if (nav) nav.classList.toggle('nav-landscape', ls);

  // Alle content containers: ruimte voor linker nav
  document.querySelectorAll('.form-wrap, .home-hero, .page-header').forEach(el => {
    el.style.marginLeft = '';  // CSS regelt dit via body.is-landscape
  });
}

// Draai bij laden en bij oriëntatie wijziging
window.addEventListener('DOMContentLoaded', applyLandscape);
window.addEventListener('resize', applyLandscape);
window.addEventListener('orientationchange', function(){ setTimeout(applyLandscape, 150); });
if (screen.orientation) screen.orientation.addEventListener('change', function(){ setTimeout(applyLandscape, 150); });

// ─── DESKTOP SIDEBAR PANEL ───
function initDesktopPanel() {
  const existing = document.getElementById('desktop-panel');
  if (existing) existing.remove();
  if (window.innerWidth < 1100) return;

  const panel = document.createElement('div');
  panel.id = 'desktop-panel';
  panel.style.cssText = [
    'width:220px',
    'flex-shrink:0',
    'padding:48px 0 0',
    'font-family:\'DM Sans\',sans-serif',
  ].join(';');

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const links = [
    ['index.html','Start'],
    ['opstelling.html','Opstelling'],
    ['selectie.html','Selectie'],
    ['wedstrijden.html','Wedstrijden'],
    ['trainen.html','Trainen'],
    ['oefeningen.html','Oefeningen'],
    ['team.html','Dashboard'],
    ['instellingen.html','Instellingen'],
  ];

  panel.innerHTML = `
    <div style="font-size:26px;font-weight:800;color:#fff;margin-bottom:2px">FCP <span style="opacity:.4">16-2</span></div>
    <div style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:28px">Seizoen 2026/2027</div>
    <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Navigatie</div>
    ${links.map(([href, label]) => {
      const active = page === href || (href === 'index.html' && (page === '' || page === '/'));
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

// Landscape trigger
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

window.addEventListener('DOMContentLoaded', () => {
  initDesktopPanel();
  applyLandscape();
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
