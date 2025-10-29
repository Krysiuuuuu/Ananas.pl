import { SUBFORUMS, THREADS } from './data.js';
import { nanoid } from 'nanoid';
import { saveThreadsToStorage } from './data.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const subforumListEl = $('#subforum-list');
const contentEl = $('#content');
const modal = $('#modal');
const modalClose = $('#modal-close');
const modalCancel = $('#modal-cancel');
const newThreadBtn = $('#new-thread-btn');
const searchInput = $('#search');
const threadForm = $('#thread-form');
const threadSubforum = $('#thread-subforum');
const threadTitle = $('#thread-title');
const threadBody = $('#thread-body');

let current = SUBFORUMS[0].id;

// Simple auth (username-only, persisted)
const AUTH_KEY = 'wyzywka_user';
const authPane = document.getElementById('auth-pane');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const currentUserEl = document.getElementById('current-user');
const threadCountEl = document.getElementById('thread-count');

// compute and display total threads across all subforums
function updateThreadCount() {
  try {
    const total = Object.values(THREADS).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
    if (threadCountEl) threadCountEl.textContent = `Wątków: ${total}`;
  } catch (e) {}
}

function refreshAuthUI(){
  const u = localStorage.getItem(AUTH_KEY);
  if (u) { currentUserEl.textContent = u; loginBtn.style.display='none'; logoutBtn.style.display='inline-block'; }
  else { currentUserEl.textContent = ''; loginBtn.style.display='inline-block'; logoutBtn.style.display='none'; }
}

loginBtn.addEventListener('click', ()=>{
  const name = prompt('Podaj nazwę użytkownika (bez hasła):');
  if (!name) return;
  localStorage.setItem(AUTH_KEY, name.trim());
  refreshAuthUI();
});

logoutBtn.addEventListener('click', ()=>{
  localStorage.removeItem(AUTH_KEY);
  refreshAuthUI();
});

refreshAuthUI();
updateThreadCount();

// Render sidebar
function renderSidebar() {
  subforumListEl.innerHTML = '';
  const tpl = $('#subforum-item-tpl');
  SUBFORUMS.forEach(sf => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.sf-icon').textContent = sf.icon;
    node.querySelector('.sf-title').textContent = sf.title;
    node.querySelector('.sf-desc').textContent = sf.desc;
    node.addEventListener('click', () => {
      navigateTo(sf.id);
    });
    subforumListEl.appendChild(node);
  });
}

// Render content (subforum view with threads)
function renderContent(subforumId, highlight = '') {
  const sf = SUBFORUMS.find(s => s.id === subforumId);
  current = subforumId;
  contentEl.innerHTML = `
    <div class="board-header">
      <div>
        <div class="board-title">${sf.title}</div>
        <div class="sf-desc" style="margin-top:4px;color:var(--muted)">${sf.desc}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <div style="font-size:22px">${sf.icon}</div>
        <div>
          <button id="open-new-thread" class="btn">Nowy temat</button>
        </div>
      </div>
    </div>
    <div class="threads" id="threads"></div>
  `;
  document.getElementById('open-new-thread').addEventListener('click', openModalForSubforum);
  populateThreads(subforumId, highlight);
}

// Populate threads list, supports search filter
function populateThreads(subforumId, highlight = '') {
  const threadsEl = document.getElementById('threads');
  const list = THREADS[subforumId] || [];
  const q = (searchInput.value || '').trim().toLowerCase();
  const filtered = list.filter(t => {
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
  }).sort((a,b)=>b.created - a.created);

  if (filtered.length === 0) {
    threadsEl.innerHTML = '<div class="thread-item" style="color:var(--muted)">Brak tematów — rozpocznij pierwszy.</div>';
    return;
  }

  const tpl = $('#thread-item-tpl');
  threadsEl.innerHTML = '';
  filtered.forEach(t => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.thread-title').textContent = t.title;
    node.querySelector('.thread-meta').textContent = `Utworzono: ${new Date(t.created).toLocaleString('pl-PL')}`;

    // show visibility badge (all threads are public)
    const badge = document.createElement('span');
    badge.style.fontSize = '12px';
    badge.style.color = 'var(--muted)';
    badge.style.marginLeft = '8px';
    badge.textContent = (typeof isThreadVisible === 'function' ? (isThreadVisible(t) ? 'Public' : 'Private') : 'Public');
    node.querySelector('.thread-meta').appendChild(badge);

    node.querySelector('.thread-body').textContent = t.body;

    // add "Odpowiedz" button to each thread item so user can reply without opening separately
    const btnWrap = document.createElement('div');
    btnWrap.style.marginTop = '8px';
    btnWrap.style.display = 'flex';
    btnWrap.style.gap = '8px';
    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = 'Otwórz';
    const replyBtn = document.createElement('button');
    replyBtn.className = 'btn';
    replyBtn.textContent = 'Odpowiedz';

    btnWrap.appendChild(openBtn);
    btnWrap.appendChild(replyBtn);
    node.appendChild(btnWrap);

    openBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openThread(t, subforumId);
    });

    replyBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openThread(t, subforumId);
      // after thread opened, focus reply textarea
      setTimeout(() => {
        const ta = document.getElementById('inline-reply-text');
        if (ta) ta.focus();
      }, 150);
    });

    node.addEventListener('click', () => {
      openThread(t, subforumId);
    });
    if (t.id === highlight) node.style.boxShadow = '0 0 0 3px rgba(17,17,17,0.06)';
    threadsEl.appendChild(node);
  });
}

// Open thread view. Per user request: "Make the threads the same url/asset as the subforum, but the subforums are different assets."
// We'll keep the same page but update the hash to /{subforum}/{threadId} and reuse the subforum view (same asset).
function openThread(thread, subforumId) {
  // redirect to a dedicated subforum page with thread hash so each thread has its own page
  location.href = `${subforumId}.html#${thread.id}`;
  return;
}

// Navigation
function navigateTo(subforumId) {
  history.pushState({ subforum: subforumId }, '', `#/${subforumId}`);
  renderContent(subforumId);
}

// AI reply feature removed.

// Modal controls
function openModal() {
  threadSubforum.innerHTML = '';
  SUBFORUMS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    threadSubforum.appendChild(opt);
  });
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  threadTitle.focus();
}

function openModalForSubforum() {
  openModal();
  threadSubforum.value = current;
}

function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  threadForm.reset();
}

// Create thread
threadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const sf = threadSubforum.value;
  const title = threadTitle.value.trim();
  const body = threadBody.value.trim();
  if (!title || !body) return;
  const id = `${sf}-${nanoid(6)}`;
  const t = { id, title, body, created: Date.now(), replies: [], private: false };
  THREADS[sf] = THREADS[sf] || [];
  THREADS[sf].push(t);
  try { saveThreadsToStorage(); } catch (e) {}
  updateThreadCount();
  closeModal();
  navigateTo(sf);
  setTimeout(()=>openThread(t, sf), 120);

  // AI disabled: no automatic bot reply will be posted.
});

// UI events
newThreadBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
searchInput.addEventListener('input', ()=> populateThreads(current));

window.addEventListener('popstate', (ev) => {
  const st = ev.state;
  if (!st) {
    // default
    navigateTo(SUBFORUMS[0].id);
    return;
  }
  if (st.subforum && st.thread) {
    const tlist = THREADS[st.subforum] || [];
    const t = tlist.find(x=>x.id===st.thread);
    if (t) openThread(t, st.subforum);
    else navigateTo(st.subforum);
  } else if (st.subforum) {
    renderContent(st.subforum);
  } else {
    navigateTo(SUBFORUMS[0].id);
  }
});

// Initial render based on hash or default
function initial() {
  renderSidebar();
  const hash = location.hash || '';
  const parts = hash.replace(/^#\//,'').split('/').filter(Boolean);
  if (parts.length === 0) {
    navigateTo(SUBFORUMS[0].id);
    return;
  }
  const [sub, threadId] = parts;
  if (!SUBFORUMS.find(s=>s.id===sub)) {
    navigateTo(SUBFORUMS[0].id);
    return;
  }
  renderContent(sub);
  if (threadId) {
    const t = (THREADS[sub] || []).find(x=>x.id===threadId);
    if (t) openThread(t, sub);
  }
  // ensure count is current on initial load
  updateThreadCount();
}

// small helper to escape HTML when injecting user content
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// Listen for external bot posts and update UI
window.addEventListener('threads-updated', (ev)=>{
  const { subforumId, threadId } = ev.detail || {};
  try { saveThreadsToStorage(); } catch (e) {}
  updateThreadCount();
  if (current === subforumId && location.hash.includes(`/${threadId}`)) {
    const t = (THREADS[subforumId]||[]).find(x=>x.id===threadId);
    if (t) openThread(t, subforumId);
  } else if (current === subforumId) {
    populateThreads(subforumId);
  }
});

// Ensure auth UI reflects persisted login on load (already present) and ensure threads saved before leaving
window.addEventListener('beforeunload', () => {
  try { saveThreadsToStorage(); } catch (e) {}
});

initial();
