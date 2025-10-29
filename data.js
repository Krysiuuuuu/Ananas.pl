export const SUBFORUMS = [
  { id: 'random', title: 'Random', desc: 'Dowolne tematy', icon: '🎲' },
  { id: 'polska', title: 'Polska', desc: 'Sprawy krajowe', icon: '🇵🇱' },
  { id: 'zagranica', title: 'Zagranica', desc: 'Wiadomości ze świata', icon: '🌍' },
  { id: 'sztuka', title: 'Sztuka', desc: 'Rysunki, zdjęcia, opowieści', icon: '🎨' },
  { id: 'zwierzeta', title: 'Zwierzęta', desc: 'Pupile i nie tylko', icon: '🐾' },
  { id: 'sport', title: 'Sport', desc: 'Drużyny, mecze, wyniki', icon: '⚽' },
  { id: 'gry', title: 'Komputery / Gry', desc: 'Pytania, recenzje, memy', icon: '🕹️' },
  { id: 'jedzenie', title: 'Jedzenie', desc: 'Przepisy i zdjęcia potraw', icon: '🍲' }
];

// Seed example threads for each subforum
const THREADS = {
  random: [
    { id: 'random-1', title: 'Powitalny temat', body: 'Siema. Co dzisiaj robicie?', created: Date.now() - 1000*60*60, replies: [] },
  ],
  polska: [
    { id: 'polska-1', title: 'Ostatnie wydarzenia', body: 'Dyskusja o polityce lokalnej.', created: Date.now() - 1000*60*60*5, replies: [] },
  ],
  zagranica: [],
  sztuka: [
    { id: 'sztuka-1', title: 'Pokaż swoje rysunki', body: 'Wrzuć link lub opis.', created: Date.now() - 1000*60*60*24, replies: [] },
  ],
  zwierzeta: [
    { id: 'zwierzeta-1', title: 'Jak opiekować się kotem?', body: 'Mam 2-miesięcznego kotka...', created: Date.now() - 1000*60*30, replies: [] }
  ],
  sport: [],
  gry: [],
  jedzenie: []
};

// Persistence key
const STORAGE_KEY = 'wyzywka_threads_v1';

// Load saved threads (merge with seeded THREADS structure)
function loadSavedThreads(seed) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const saved = JSON.parse(raw);
    // ensure all keys exist from seed
    Object.keys(seed).forEach(k => { if (!saved[k]) saved[k] = seed[k]; });
    return saved;
  } catch (e) { return seed; }
}

// Replace THREADS with loaded data so imports keep same reference
const _loaded = loadSavedThreads(THREADS);
/* Ensure every thread is explicitly marked public (private: false) so threads are visible to everyone */
Object.keys(_loaded).forEach(k => {
  (_loaded[k]||[]).forEach(t => { if (t && typeof t.private === 'undefined') t.private = false; });
});
Object.keys(THREADS).forEach(k => delete THREADS[k]);
Object.assign(THREADS, _loaded);

/* NEW: create a Proxy around THREADS so any mutation triggers saveThreadsToStorage automatically.
   This ensures threads created from any page (including per-subforum assets) are persisted. */
function makeAutoSaving(target) {
  // helper: ensure a thread object has private:false
  const ensurePublic = (t) => {
    try { if (t && typeof t === 'object' && typeof t.private === 'undefined') t.private = false; } catch (e) {}
  };

  // wrap arrays so methods like push/unshift/splice and direct index sets mark threads public and save
  function wrapArray(arr, parentKey) {
    const arrayHandler = {
      set(a, prop, value) {
        // if setting an index (numeric), ensure thread is public
        if (!isNaN(prop)) ensurePublic(value);
        const res = Reflect.set(a, prop, value);
        try { saveThreadsToStorage(); } catch (e) {}
        return res;
      },
      get(a, prop) {
        const v = Reflect.get(a, prop);
        // intercept mutating methods
        if (typeof v === 'function' && ['push','unshift','splice'].includes(prop)) {
          return function(...args) {
            // normalize items being added (push/unshift get items, splice may have items starting at index 2)
            const items = (prop === 'splice') ? args.slice(2) : args;
            items.forEach(ensurePublic);
            const res = Array.prototype[prop].apply(a, args);
            try { saveThreadsToStorage(); } catch (e) {}
            return res;
          };
        }
        return v;
      }
    };
    return new Proxy(arr, arrayHandler);
  }

  const handler = {
    set(obj, prop, value) {
      try {
        // If setting a whole array, ensure each thread is public and wrap it
        if (Array.isArray(value)) {
          value.forEach(ensurePublic);
          value = wrapArray(value, prop);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          // If assigning an object of arrays, ensure nested arrays threads are public and wrap them
          Object.entries(value).forEach(([k, v]) => {
            if (Array.isArray(v)) {
              v.forEach(ensurePublic);
              value[k] = wrapArray(v, k);
            }
          });
        }
      } catch (e) {}
      const res = Reflect.set(obj, prop, value);
      try { saveThreadsToStorage(); } catch (e) {}
      return res;
    },
    deleteProperty(obj, prop) {
      const res = Reflect.deleteProperty(obj, prop);
      try { saveThreadsToStorage(); } catch (e) {}
      return res;
    }
  };

  // Wrap any existing arrays on the target so future pushes are proxied
  Object.keys(target).forEach(k => {
    try {
      if (Array.isArray(target[k])) target[k] = wrapArray(target[k], k);
    } catch (e) {}
  });

  return new Proxy(target, handler);
}

// export proxied THREADS so other modules mutate the proxied object (keeps same reference)
const THREADS_PROXY = makeAutoSaving(THREADS);
export { THREADS_PROXY as THREADS };

export function saveThreadsToStorage() {
  try {
    // Ensure every thread is explicitly public before persisting
    try {
      Object.keys(THREADS).forEach(k => {
        (THREADS[k] || []).forEach(t => {
          if (t && t.private !== false) t.private = false;
        });
      });
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(THREADS));
  } catch (e) {}
}

/* Expose helper so bots/LLMs can post replies programmatically.
   Usage: postBotMessage('polska','polska-1','Hello from bot','Assistant') */
export function postBotMessage(subforumId, threadId, text, author = 'Bot') {
  // AI has been disabled — this function is now a no-op.
  // Returning false prevents any UI code from assuming an AI reply was posted.
  return false;
}
if (typeof window !== 'undefined') window.postBotMessage = postBotMessage;
if (typeof window !== 'undefined') window.saveThreadsToStorage = saveThreadsToStorage;

// Helper to get current user name (used by thread pages)
export function getCurrentUserName() {
  try { const u = localStorage.getItem('wyzywka_user'); return (u && String(u).trim()) ? String(u).trim() : 'Anon'; } catch(e) { return 'Anon'; }
}

// Format an author label with >>> followed by an 8-digit number before the username.
export function formatAuthor(name){
  try {
    // Persist a global sequential counter to localStorage so numbers are strictly increasing across the platform.
    const KEY = 'wyzywka_author_counter_v1';
    let cur = parseInt(localStorage.getItem(KEY), 10);
    if (!Number.isFinite(cur) || cur < 10000000) cur = 10000000; // start at 10000000 if missing or invalid
    cur = cur + 1;
    try { localStorage.setItem(KEY, String(cur)); } catch(e){}
    const nm = (name && String(name).trim()) ? String(name).trim() : 'Anon';
    return `>>>${String(cur).padStart(8,'0')} ${nm}`;
  } catch(e){
    return `>>>00000000 ${name || 'Anon'}`;
  }
}
if (typeof window !== 'undefined') window.formatAuthor = formatAuthor;

/* NEW: helper to check visibility — currently all threads are public (visible to everyone) */
export function isThreadVisible(thread) {
  try { return thread && thread.private !== true; } catch (e) { return true; }
}
if (typeof window !== 'undefined') window.isThreadVisible = isThreadVisible;
