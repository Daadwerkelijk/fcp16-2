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
function saveCustomOef(oef)        { localStorage.setItem('fcp_oef',          JSON.stringify(oef)); }
function saveCategories(cats)      { localStorage.setItem('fcp_cats',         JSON.stringify(cats)); }
function saveWedstrijden(wed)      { localStorage.setItem('fcp_wed',          JSON.stringify(wed)); }
function saveAanwezigheid(aanw)    { localStorage.setItem('fcp_aanw',         JSON.stringify(aanw)); }
function saveCustomWeken(weken)    { localStorage.setItem('fcp_custom_weken', JSON.stringify(weken)); }

// ─── SUPABASE LOAD ALL ───
async function loadFromSupabase() {
  const [pl, lu, sn, oe, ca, wd, pr, aanw] = await Promise.all([
    sbFetch('players?select=*&order=created_at'),
    sbFetch('lineup?select=*'),
    sbFetch('session_notes?select=*'),
    sbFetch('custom_oef?select=*&order=created_at'),
    sbFetch('categories?select=*&order=sort_order'),
    sbFetch('wedstrijden?select=*&order=created_at'),
    sbFetch('principes?select=*&order=sort_order'),
    sbFetch('aanwezigheid?select=*')
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
    sn.forEach(r => { notes[r.note_key] = r.content; });
    result.sessionNotes = notes; saveSessionNotes(notes);
  }
  if (oe && !oe._error) {
    const oef = oe.map(o => ({ ...o, desc: o.desc || o.beschrijving || '', stappen: o.stappen || [], pr: [] }));
    result.customOef = oef; saveCustomOef(oef);
  }
  if (ca && !ca._error && ca.length) {
    const cats = ca.map(c => c.naam);
    result.categories = cats; saveCategories(cats);
  }
  if (wd && !wd._error) {
    const wedstrijden = wd.map(w => ({
      ...w,
      ratings: typeof w.ratings === 'string' ? JSON.parse(w.ratings || '{}') : (w.ratings || {}),
      motm: w.motm || null,
    }));
    result.wedstrijden = wedstrijden; saveWedstrijden(wedstrijden);
  }
  if (pr && !pr._error && pr.length) { result.principes = pr; }
  if (aanw && !aanw._error) {
    const aanwObj = {};
    aanw.forEach(r => {
      if (!aanwObj[r.training_key]) aanwObj[r.training_key] = {};
      aanwObj[r.training_key][r.player_id] = r.aanwezig;
    });
    result.aanwezigheid = aanwObj; saveAanwezigheid(aanwObj);
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

// ─── FORMATIES ───
const FORMATIES = {
  '4222': { label:'4-2-2-2', pos:[
    {id:'GK',   label:'GK',   role:'keeper', x:50, y:88},
    {id:'LB',   label:'LB',   role:'back',   x:14, y:72},
    {id:'CB_L', label:'CB-L', role:'cb',     x:36, y:75},
    {id:'CB_R', label:'CB-R', role:'cb',     x:64, y:75},
    {id:'RB',   label:'RB',   role:'back',   x:86, y:72},
    {id:'VM_L', label:'VM-L', role:'dm',     x:36, y:57},
    {id:'VM_R', label:'VM-R', role:'dm',     x:64, y:57},
    {id:'AM_L', label:'AM-L', role:'am',     x:22, y:38},
    {id:'AM_R', label:'AM-R', role:'am',     x:78, y:38},
    {id:'ST_L', label:'ST-L', role:'st',     x:14, y:16},
    {id:'ST_R', label:'ST-R', role:'st',     x:86, y:16},
  ]},
  '4231': { label:'4-2-3-1', pos:[
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
  '442': { label:'4-4-2 ruit', pos:[
    {id:'GK',   label:'GK',   role:'keeper', x:50, y:88},
    {id:'LB',   label:'LB',   role:'back',   x:14, y:72},
    {id:'CB_L', label:'CB-L', role:'cb',     x:36, y:75},
    {id:'CB_R', label:'CB-R', role:'cb',     x:64, y:75},
    {id:'RB',   label:'RB',   role:'back',   x:86, y:72},
    {id:'LM',   label:'LM',   role:'dm',     x:14, y:52},
    {id:'CM_A', label:'CM-A', role:'dm',     x:50, y:40},
    {id:'CM_V', label:'CM-V', role:'am',     x:50, y:60},
    {id:'RM',   label:'RM',   role:'dm',     x:86, y:52},
    {id:'ST_L', label:'ST-L', role:'st',     x:35, y:18},
    {id:'ST_R', label:'ST-R', role:'st',     x:65, y:18},
  ]},
};

const POS_LABELS = { keeper:'Keeper', back:'Back', cb:'Centrale back', dm:'Middenveld', am:'Aanvallend midden', st:'Spits' };
const ALL_POS_OPTS = ['Keeper','LB','RB','CB-L','CB-R','VM-L','VM-R','AM-L','AM-R','ST-L','ST-R','DM-L','DM-R','LAM','CAM','RAM','CF','LM','CM-L','CM-R','RM'];

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
const SKILL_COLORS = {
  'Ontwikkel punt': { bg:'#3a1000', c:'#f07040' },
  'Voldoende':      { bg:'#1a2800', c:'#a8e040' },
  'Goed':           { bg:'#0a2010', c:'#60d080' },
  'Zeer goed':      { bg:'#003818', c:'#40f090' },
};

// ─── UTILITIES ───
function genId() { return 'i' + Date.now() + Math.random().toString(36).slice(2, 6); }

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function sortedPlayers(players) {
  return [...players].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
}

function formatDatumShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const mnd = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return d.getDate() + ' ' + mnd[d.getMonth()];
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
function initManifest() {
  const manifest = {
    name:'FCP 16-2', short_name:'FCP 16-2', display:'standalone',
    background_color:'#0a1200', theme_color:'#0a1200', start_url:'index.html',
    icons:[{ src:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%230a1200'/><text x='50' y='65' font-size='50' text-anchor='middle' fill='%23a8e040'>⚽</text></svg>", sizes:'192x192', type:'image/svg+xml' }]
  };
  const el = document.getElementById('manifest-link');
  if (el) el.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type:'application/json' }));
}

const BUILTIN_OEF=[
  {id:'b01',cat:'opwarmen',title:'Passeer-estafette namen leren',duur:'10–15 min',spelers:'12–18',pr:['P6'],url:'',desc:'Tweetallen op 10m. Naam noemen bij ontvangst.',stappen:['Tweetallen op 10m','Pas en loop','Naam passeur noemen','Zwakke voet dubbel','Na 5 min: 15m'],tip:'Namen leren. Luchtig houden.'},
  {id:'b02',cat:'opwarmen',title:'Rondo met positie-herstel',duur:'10 min',spelers:'12–18',pr:['P4','P6'],url:'',desc:'5+1. Na verovering positie herpakken.',stappen:['Cirkel 8m, 5 vs 1','Max 2 touch','Na verovering: bezitter druk'],tip:'Reflex, niet straf.'},
  {id:'b03',cat:'opwarmen',title:'Rondo VM+2 omhoog',duur:'10 min',spelers:'14–16',pr:['P5','P6'],url:'',desc:'VM verlaat cirkel naar hogere positie.',stappen:['Cirkel 10m, 7 vs 2','VM stapt uit na 3 passes','Cirkel vult aan'],tip:'VM blijft niet statisch.'},
  {id:'b04',cat:'opwarmen',title:'Tikspel met smal kanaal',duur:'10 min',spelers:'12–16',pr:['P2','P6'],url:'',desc:'Smal veld 30x12m. Langs de middenas.',stappen:['Veld 30x12m, 2 tikkers','Langs middenas blijven'],tip:'Smalheid dwingt verticaal denken.'},
  {id:'b05',cat:'opwarmen',title:'Tikspel gepakt = twee persen',duur:'10 min',spelers:'12–16',pr:['P4'],url:'',desc:'Bij tikken: samen persen.',stappen:['20x20m, 2 tikkers','Als gepakt: samen persen'],tip:'Counterpressing als opwarm.'},
  {id:'b06',cat:'opwarmen',title:'Positie activatie eigen plek',duur:'10 min',spelers:'14–18',pr:['P6'],url:'',desc:'Korte passes door het systeem.',stappen:['Eigen positie','Keeper → backs → VM → AM → ST'],tip:'Goed voor lichte training.'},
  {id:'b07',cat:'opwarmen',title:'Loosening keeper warming-up',duur:'15 min',spelers:'alle',pr:['P6'],url:'',desc:'Rustige opwarm. Keeper apart.',stappen:['Veldspelers: 2 rondjes','Keeper: sprongen + stappen','Keeper: laag + hoge ballen'],tip:'Keeper heeft andere opwarm nodig.'},
  {id:'b08',cat:'opwarmen',title:'Favoriete rondo van de groep',duur:'10 min',spelers:'12–18',pr:['P6'],url:'',desc:'Spelers kiezen zelf.',stappen:['Vraag de groep','Groep leidt warming-up'],tip:'Eigenaarschap.'},
  {id:'b09',cat:'conditie',title:'Shuttle runs met bal',duur:'15 min',spelers:'alle',pr:['P6'],url:'',desc:'5-10-15m, terugloop met bal.',stappen:['Kegels op 5, 10 en 15m','Sprint heen, terugloop met bal','4 series'],tip:'Basisconditie met bal.'},
  {id:'b10',cat:'conditie',title:'Loopladder + smalle sprints',duur:'12 min',spelers:'alle',pr:['P2'],url:'',desc:'Loopladder dan sprint door smal kanaal.',stappen:['Loopladder 6m','Sprint kanaal 2m x 20m'],tip:'Smalheid: leer rechtdoor.'},
  {id:'b11',cat:'conditie',title:'Interval passing sprint',duur:'15 min',spelers:'12–16',pr:['P6'],url:'',desc:'A past naar B, sprint naar kegel.',stappen:['A en B op 15m','A past → sprint','6 herhalingen'],tip:'Wedstrijdritme.'},
  {id:'b12',cat:'conditie',title:'Duurloop met tempowisseling',duur:'15 min',spelers:'alle',pr:['P6'],url:'',desc:'3 rondjes rustig, op signaal sprint.',stappen:['Rustig 3 rondjes','Op fluit: 20m sprint'],tip:'Duurvermogen.'},
  {id:'b13',cat:'conditie',title:'Interval pressing blok',duur:'15 min',spelers:'12–16',pr:['P4','P5'],url:'',desc:'3 min positiespel, op signaal druk.',stappen:['6 spelers 20x15m','3 min positiespel','Op fluit: 2 worden inpikkers'],tip:'Counterpressing als conditie.'},
  {id:'b14',cat:'conditie',title:'4x4 min positiespel hoge intensiteit',duur:'20 min',spelers:'12–16',pr:['P4','P5'],url:'',desc:'4 blokken van 4 min, 1 min rust.',stappen:['Veld 20x15m','4 min, 1 min rust, 4x'],tip:'Gebruik pas in maand 2.'},
  {id:'b15',cat:'conditie',title:'Intensiteitsblok 3x5\'',duur:'20 min',spelers:'14–18',pr:['P1'],url:'',desc:'3x5 min op 70%, daarna 2 min vol.',stappen:['5 min op 70%','2 min max','Herhaal 3x'],tip:'Tempowisseling.'},
  {id:'b16',cat:'techniek',title:'Driehoek A-B-C doorlopen',duur:'15 min',spelers:'12–18',pr:['P6','P1'],url:'',desc:'A→B→C, C loopt door naar positie A.',stappen:['Driehoek kegels op 8m','A past naar B','B past naar C, B loopt naar A'],tip:'Basis 4-2-2-2.'},
  {id:'b17',cat:'techniek',title:'Aannemen onder lichte druk',duur:'15 min',spelers:'12–16',pr:['P6'],url:'',desc:'A ontvangt, B druk, C vrij.',stappen:['A midden, B op 3m, C op 8m','A: draai of kaats naar C'],tip:'Hardop zeggen wat je ziet.'},
  {id:'b18',cat:'techniek',title:'AM in smal kanaal ontvangen',duur:'15 min',spelers:'12–16',pr:['P2','P6'],url:'',desc:'AM in smal kanaal. Kegels op 3m.',stappen:['AM centraal op 25m','Aanspeler op 15m','Ontvangen in kanaal'],tip:'Oplossing altijd verticaal of terug.'},
  {id:'b19',cat:'techniek',title:'Derde-man combinatie back',duur:'15 min',spelers:'12–16',pr:['P3','P6'],url:'',desc:'Back speelt op VM, loopt diep.',stappen:['Back start met bal','Kort op VM, back loopt door','AM trekt centrum'],tip:'Trigger: touch van VM.'},
  {id:'b20',cat:'techniek',title:'Afwerken na combinatie via AM',duur:'15 min',spelers:'14–16',pr:['P2','P5'],url:'',desc:'ST en AM combineren, VM loopt mee.',stappen:['Aanspeler geeft op AM','AM combineert met ST','VM loopt mee omhoog'],tip:'VM meeloopt = veld veroverd.'},
  {id:'b21',cat:'techniek',title:'1v1 afronden + rebound',duur:'15 min',spelers:'12–18',pr:['P6'],url:'',desc:'Aanvaller vs verdediger, keeper op doel.',stappen:['Aanvaller en verdediger op 20m','2e aanvaller pakt rebound'],tip:'Keeper: positie na schot.'},
  {id:'b22',cat:'techniek',title:'Afwerken na derde-man back',duur:'15 min',spelers:'14–16',pr:['P3'],url:'',desc:'Back loopt diep. Beide kanten.',stappen:['Back start met bal','Past op VM, loopt diep','VM speelt diep'],tip:'Backs herhalen dit spontaan.'},
  {id:'b23',cat:'positiespel',title:'Rondo ruimte creëren',duur:'15 min',spelers:'12–16',pr:['P1','P6'],url:'',desc:'4+2 op 15x15m. Altijd driehoek.',stappen:['15x15m, 4 vs 2','Stop bij twee naast elkaar'],tip:'Ruimte = doel.'},
  {id:'b24',cat:'positiespel',title:'4-2-2-2 posities stilstaand',duur:'20 min',spelers:'14–18',pr:['P6'],url:'',desc:'Per positie zone en beweging.',stappen:['Eigen positie','Trainer loopt systeem door'],tip:'Vroeg in maand 1.'},
  {id:'b25',cat:'positiespel',title:'3-zones opbouw',duur:'20 min',spelers:'14–18',pr:['P1','P6'],url:'',desc:'Bal mag niet terug over zonegrens.',stappen:['3 horizontale zones','Terugspelen = balverlies'],tip:'Eerst flexibel.'},
  {id:'b26',cat:'positiespel',title:'Opbouw keeper + backs',duur:'20 min',spelers:'14–18',pr:['P1','P3'],url:'',desc:'Keeper uit via backs, VM, AM, ST.',stappen:['Keeper start','VM vraagt bal','VM → AM → ST'],tip:'Begin zonder tegenstander.'},
  {id:'b27',cat:'positiespel',title:'Opbouw VM omhoog schuiven',duur:'20 min',spelers:'14–18',pr:['P1','P5'],url:'',desc:'Na 2e pas schuift VM 10m omhoog.',stappen:['Keeper uit via backs','Back → VM','VM schuift 10m op'],tip:'Golf, niet anker.'},
  {id:'b28',cat:'positiespel',title:'Backs derde-man run triggeren',duur:'20 min',spelers:'14–18',pr:['P3','P1'],url:'',desc:'Touch van VM triggert diepterun back.',stappen:['Back past op VM','AM trekt centraal','Back maakt diepterun'],tip:'Trigger = touch.'},
  {id:'b29',cat:'positiespel',title:'Smalle aanval via centraal kanaal',duur:'20 min',spelers:'14–18',pr:['P2','P5'],url:'',desc:'Aanval via 3 centrale banen.',stappen:['3 centrale banen actief','AM en ST centraal'],tip:'Smalheid dwingt creativiteit.'},
  {id:'b30',cat:'positiespel',title:'Centrale zone beheersen',duur:'20 min',spelers:'14–16',pr:['P1','P5'],url:'',desc:'VM als draaipunt, max 2 touch.',stappen:['Vak 30x20m','VM max 2 touch','8 passes = punt'],tip:'Simpel, snel, direct.'},
  {id:'b31',cat:'positiespel',title:'Geduldig circuleren tot opening',duur:'20 min',spelers:'14–18',pr:['P1','P6'],url:'',desc:'Punt na 6+ passes.',stappen:['Teams van 7','Punt na 6+ passes'],tip:'Ruimte door geduld.'},
  {id:'b32',cat:'positiespel',title:'Overbezetting flank creëren',duur:'20 min',spelers:'14–18',pr:['P3','P1'],url:'',desc:'AM trekt centrum, back steekt door.',stappen:['AM naar centrum','Back steekt door'],tip:'Beweging AM = signaal.'},
  {id:'b33',cat:'positiespel',title:'3 aanvalsvarianten kiezen',duur:'25 min',spelers:'14–18',pr:['P2','P3'],url:'',desc:'Teams kiezen per aanval.',stappen:['Bespreek 3 varianten','Teams kiezen'],tip:'Laat spelers beslissen.'},
  {id:'b34',cat:'positiespel',title:'Wat als tegenstander hoog druk zet?',duur:'20 min',spelers:'14–18',pr:['P1','P6'],url:'',desc:'Keeper + backs uitspelen onder druk.',stappen:['Keeper + backs vs 3 drukkers','VM als noodoptie'],tip:'Geen paniek.'},
  {id:'b35',cat:'counterpressing',title:'Pressing trigger herkennen',duur:'15 min',spelers:'12–16',pr:['P4'],url:'',desc:'3 triggers stilstaand bespreken.',stappen:['3 triggers op veld','Demo met 4 spelers'],tip:'Collectief signaal.'},
  {id:'b36',cat:'counterpressing',title:'5 sec counterpressing reflex',duur:'15 min',spelers:'12–16',pr:['P4','P6'],url:'',desc:'Trainer telt. Druk bij 3.',stappen:['Positiespel 5+2','Trainer telt','Druk bij 3'],tip:'Gaat om de gewoonte.'},
  {id:'b37',cat:'counterpressing',title:'2v2+1 counterpressing na verlies',duur:'15 min',spelers:'12–16',pr:['P4'],url:'',desc:'Na verovering: direct terugdrukken.',stappen:['Veld 15x10m','Verovering: aanvallers worden drukkers'],tip:'Neutraal = superioriteit.'},
  {id:'b38',cat:'counterpressing',title:'Groepspressing vanuit AM',duur:'20 min',spelers:'14–18',pr:['P4','P5'],url:'',desc:'AM lokt, VM sluit aan.',stappen:['4-2-2-2 op half veld','AM lokt','VM sluit aan'],tip:'VM wacht op signaal.'},
  {id:'b39',cat:'counterpressing',title:'Hoge pressing als blok',duur:'20 min',spelers:'14–18',pr:['P4','P5'],url:'',desc:'Alle linies max 10m uit elkaar.',stappen:['Start op 40m lijn tegenstander','Max 10m alle linies'],tip:'Één uitvaller breekt systeem.'},
  {id:'b40',cat:'partijvorm',title:'Partijspel vrij observeren',duur:'25 min',spelers:'14–18',pr:['P6'],url:'',desc:'Vrij. Trainers observeren.',stappen:['Teams van 7','Geen regels'],tip:'Wat doet het team zonder sturing?'},
  {id:'b41',cat:'partijvorm',title:'Partijspel bonus driehoek',duur:'25 min',spelers:'14–18',pr:['P1','P6'],url:'',desc:'Extra punt na 3-passes driehoek.',stappen:['Extra punt na driehoek'],tip:'Bonuspunt = thema.'},
  {id:'b42',cat:'partijvorm',title:'Partijspel pressing punt',duur:'25 min',spelers:'14–18',pr:['P4'],url:'',desc:'Extra punt voor verovering binnen 5 sec.',stappen:['Extra punt: verovering binnen 5 sec'],tip:'Pressing even belangrijk.'},
  {id:'b43',cat:'partijvorm',title:'Partijspel punt voor opbouw via backs',duur:'25 min',spelers:'14–18',pr:['P3','P1'],url:'',desc:'Extra punt na opbouw via keeper + backs.',stappen:['Extra punt na opbouw'],tip:'Beloont Como patroon.'},
  {id:'b44',cat:'partijvorm',title:'Partijspel centraal kanaal bonus',duur:'25 min',spelers:'14–18',pr:['P2','P6'],url:'',desc:'Dubbel punt via centraal kanaal.',stappen:['Dubbel punt via 2 centrale banen'],tip:'Spelers ontdekken het zelf.'},
  {id:'b45',cat:'partijvorm',title:'Backs-als-aanvallers partijvorm',duur:'25 min',spelers:'14–18',pr:['P3','P1'],url:'',desc:'Bonuspunt als back aanvallende zone bereikt.',stappen:['Bonuspunt: back bereikt aanvallende zone'],tip:'Backs herhalen het spontaan.'},
  {id:'b46',cat:'partijvorm',title:'Wedstrijdsimulatie 2x15\'',duur:'40 min',spelers:'14–18',pr:['P1','P4'],url:'',desc:'Twee helften 15 min.',stappen:['Geen stoppage','Rust: spelers benoemen 1 punt'],tip:'1 thema bij rust.'},
  {id:'b47',cat:'partijvorm',title:'Wedstrijdsimulatie 2x20\' spelers analyseren',duur:'50 min',spelers:'14–18',pr:['P1','P4','P5'],url:'',desc:'Spelers leiden nabespreking.',stappen:['Geen stoppage','Rust: spelers analyseren'],tip:'Laten analyseren vergroot begrip.'},
  {id:'b48',cat:'partijvorm',title:'Intern toernooi 4v4 smal veld',duur:'30 min',spelers:'12–18',pr:['P2','P6'],url:'',desc:'Klein toernooi 20x10m.',stappen:['3-4 teams van 4','Veld 20x10m'],tip:'Goed voor einde maand 1 en begin maand 3.'},
  {id:'b49',cat:'partijvorm',title:'Partijspel spelers coachen zichzelf',duur:'30 min',spelers:'14–18',pr:['P6','P1'],url:'',desc:'Trainers zwijgen volledig.',stappen:['Trainers zwijgen','Na 15 min: stop'],tip:'Bewijs of systeem erin zit.'}
];