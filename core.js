// 공통 도구: API, 화면 틀, 라우터, 토스트, 모달, 순위 표시
export const state = { me: null, collapsed: false, team: {} };

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 배포판: 서버 주소는 config.js의 API_BASE, 로그인은 토큰(localStorage)
export const API_BASE = (window.API_BASE || '').replace(/\/$/, '');
export const auth = { get: () => localStorage.getItem('bc_token'), set: (t) => (t ? localStorage.setItem('bc_token', t) : localStorage.removeItem('bc_token')) };
export async function api(path, { method = 'GET', body, raw, headers = {}, quiet } = {}) {
  const opt = { method, headers: { ...headers }, credentials: API_BASE ? 'omit' : 'same-origin' };
  const tk = auth.get(); if (tk) opt.headers.authorization = 'Bearer ' + tk;
  if (raw !== undefined) opt.body = raw;
  else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['content-type'] = 'application/json'; }
  let r;
  try { r = await fetch(API_BASE + '/api' + path, opt); }
  catch (e) { const er = new Error('서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); if (!quiet) toast(er.message, 'err'); throw er; }
  let j = null;
  try { j = await r.json(); } catch { j = {}; }
  if (j && j.token) auth.set(j.token);
  if (r.status === 401 && path !== '/login' && path !== '/me') { auth.set(null); state.me = null; navigate('/login'); throw new Error(j.error || '로그인이 필요해요.'); }
  if (!r.ok) { const e = new Error(j.error || `오류 (${r.status})`); e.status = r.status; if (!quiet) toast(e.message, 'err'); throw e; }
  return j;
}

const TZ = 'Asia/Seoul';
const parts = (s, o) => { const p = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour12: false, ...o }).formatToParts(new Date(s)); return (t) => p.find((x) => x.type === t)?.value; };
export const fmt = {
  date(s) { if (!s) return '-'; const g = parts(s, { year: 'numeric', month: '2-digit', day: '2-digit' }); return `${g('year')}.${g('month')}.${g('day')}`; },
  dt(s) { if (!s) return '-'; const g = parts(s, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); return `${g('month')}.${g('day')} ${g('hour')}:${g('minute')}`; },
  hm(s) { if (!s) return '-'; const g = parts(s, { hour: '2-digit', minute: '2-digit' }); return `${g('hour')}:${g('minute')}`; },
  full(s) { if (!s) return '-'; const g = parts(s, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); return `${g('year')}.${g('month')}.${g('day')} ${g('hour')}:${g('minute')}`; },
  wd(s) { return ['일', '월', '화', '수', '목', '금', '토'][new Date(new Date(s).getTime() + 9 * 3600e3).getUTCDay()]; },
  rel(s) { if (!s) return '-'; const m = Math.round((Date.now() - new Date(s)) / 60000); if (m < 0) { const f = -m; if (f < 60) return `${f}분 뒤`; const h = Math.round(f / 60); return h < 24 ? `${h}시간 뒤` : `${Math.round(h / 24)}일 뒤`; } if (m < 1) return '방금'; if (m < 60) return `${m}분 전`; const h = Math.round(m / 60); if (h < 24) return `${h}시간 전`; const d = Math.round(h / 24); if (d < 8) return `${d}일 전`; return fmt.date(s); },
  n(v) { return Number(v || 0).toLocaleString('ko-KR'); },
  today(offset = 0) { return new Date(Date.now() + 9 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10); }
};

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 4200 : 2600);
}

export function modal({ title, body = '', actions = [{ label: '닫기', value: null }], wide = false, onMount }) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="닫기">${ICON.x}</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
    back.querySelector('[data-x]').onclick = () => close(null);
    back.querySelectorAll('[data-i]').forEach((b) => {
      b.onclick = async () => {
        const a = actions[Number(b.dataset.i)];
        if (a.onClick) { try { const r = await a.onClick(back, close); if (r === false) return; } catch (e) { return; } }
        close(a.value);
      };
    });
    $('#modal-root').appendChild(back);
    onMount?.(back, close);
    back.querySelector('input,textarea,select')?.focus();
  });
}
export const confirmBox = (title, text, okLabel = '확인', danger = false) =>
  modal({ title, body: `<p style="margin:0;color:var(--secondary);font-size:15px;line-height:1.6">${text}</p>`, actions: [{ label: '취소', value: false }, { label: okLabel, value: true, primary: !danger, danger }] });
export const formData = (root) => Object.fromEntries(new FormData(root.querySelector('form')));

// ---------- 아이콘 ----------
const sv = (d, extra = '') => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  logo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  home: sv('<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'),
  inbox: sv('<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5 5h14l1 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z"/>'),
  building: sv('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>'),
  key: sv('<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l2 2"/>'),
  blog: sv('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  chart: sv('<path d="M4 19h16M7 15l4-4 3 3 5-6"/>'),
  camera: sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  logout: sv('<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>'),
  panel: sv('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 4v16M15 10l-2 2 2 2"/>'),
  x: sv('<path d="M6 6l12 12M18 6 6 18"/>'),
  refresh: sv('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>', 'width="15" height="15"'),
  image: sv('<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m20 15-4.5-4.5L6 20"/>', 'width="22" height="22"'),
  check: sv('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'width="16" height="16" stroke-width="2.4"'),
  arrow: sv('<path d="M5 12h14M13 6l6 6-6 6"/>', 'width="16" height="16" stroke-width="2.2"'),
  plus: sv('<path d="M12 5v14M5 12h14"/>', 'width="14" height="14" stroke-width="2.2"'),
  trash: sv('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', 'width="14" height="14"'),
  search: sv('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>', 'width="18" height="18" stroke-width="2.4"'),
  folder: sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 'width="16" height="16"'),
  info: sv('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 'width="16" height="16"')
};

// ---------- 라우터 ----------
const HASH = !!window.__PREVIEW || !!window.HASH_ROUTER;
// 배포판: 화면의 /api/files/... 사진 주소를 서버 주소로 바꿈
if (API_BASE) {
  const fixImg = (el) => { const list = el.matches?.('img[src^="/api/files/"]') ? [el] : [...(el.querySelectorAll?.('img[src^="/api/files/"]') || [])]; for (const n of list) n.setAttribute('src', API_BASE + n.getAttribute('src')); };
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fixImg(n); }).observe(document.documentElement, { childList: true, subtree: true });
}
const curUrl = () => (HASH ? new URL(location.hash.slice(1) || '/', 'http://preview.local') : new URL(location.href));
export const curPath = () => curUrl().pathname;
const routes = [];
export function route(pattern, handler, opts = {}) { routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler, opts }); }
export function navigate(path, replace = false) {
  if (HASH) {
    if (location.hash === '#' + path) return render();
    if (replace) location.replace('#' + path); else location.hash = path;
    return;
  }
  if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
  render();
}
const home = () => (state.me?.role === 'admin' ? '/admin' : '/my/order');
export async function render() {
  const url = curUrl();
  const path = url.pathname;
  if (!state.me && path !== '/login' && path !== '/setup') {
    try { const r = await api('/me', { quiet: true }); state.me = r.user; }
    catch { return navigate('/login', true); }
  }
  if (state.me?.role === 'client' && state.me.needs_profile && path !== '/my/business' && path !== '/login') return navigate('/my/business', true);
  if (path === '/' || path === '') return navigate(home(), true);
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      if (r.opts.admin && state.me?.role !== 'admin') return navigate('/my', true);
      window.scrollTo(0, 0);
      try { await r.handler({ params: m.groups || {}, query: url.searchParams }); }
      catch (e) { console.error(e); const main = $('#main'); if (main) main.insertAdjacentHTML('beforeend', `<div class="card empty"><h3>화면을 불러오지 못했어요</h3><p>${esc(e.message)}</p></div>`); }
      return;
    }
  }
  navigate(home(), true);
}
window.addEventListener(HASH ? 'hashchange' : 'popstate', render);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link], [data-href]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (e.target.closest('a[href^="http"]') && !a.matches('[data-href]')) return;
  const href = a.getAttribute('data-href') || a.getAttribute('href');
  if (!href || /^https?:/.test(href)) return;
  e.preventDefault();
  navigate(href);
});

// ---------- 화면 틀 ----------
export const TEAM_NAV = [
  { key: 'writer', no: 1, label: '원고 작성팀', path: '/admin/team/writer' },
  { key: 'image', no: 2, label: '이미지 취합팀', path: '/admin/team/image' },
  { key: 'draft', no: 3, label: '임시저장·검수팀', path: '/admin/team/draft' },
  { key: 'publish', no: 4, label: '발행팀', path: '/admin/team/publish' },
  { key: 'perf', no: 5, label: '성과팀', path: '/admin/team/perf' },
  { key: 'report', no: 6, label: '보고팀', path: '/admin/team/report' },
  { key: 'brief', no: 7, label: '대표 브리핑팀', path: '/admin/team/brief' }
];
const ADMIN_NAV = [
  { path: '/admin', label: '전체 현황', icon: 'home', exact: true },
  { path: '/admin/orders', label: '광고주 접수', icon: 'inbox' },
  { group: '7개 팀' },
  ...TEAM_NAV.map((t) => ({ ...t, team: true })),
  { group: '기준 정보' },
  { path: '/admin/clients', label: '업체 · 가이드', icon: 'building' },
  { path: '/admin/keywords', label: '키워드', icon: 'key' },
  { path: '/admin/blogs', label: '블로그 계정', icon: 'blog' },
  { path: '/admin/settings', label: '설정 · 연결', icon: 'gear' },
  { group: '광고주 화면 미리보기' },
  { path: '/my/order', label: '접수하기', icon: 'plus' },
  { path: '/my', label: '발행 현황', icon: 'chart', exact: true }
];
const CLIENT_NAV = [
  { path: '/my/order', label: '접수하기', icon: 'plus' },
  { path: '/my/orders', label: '접수 내역', icon: 'inbox' },
  { path: '/my', label: '발행 현황', icon: 'chart', exact: true },
  { path: '/my/captures', label: '노출 캡쳐', icon: 'camera' },
  { path: '/my/business', label: '업체 정보', icon: 'building' }
];

export function layout({ crumbs = [], wide = false }) {
  const me = state.me;
  const isAdmin = me.role === 'admin';
  const nav = isAdmin ? ADMIN_NAV : CLIENT_NAV;
  const path = curPath();
  const activeOf = (n) => (n.exact ? path === n.path : path === n.path || path.startsWith(n.path + '/'));
  const initial = (me.name || me.login_id || '?').trim().charAt(0).toUpperCase();
  $('#app').innerHTML = `
  <div class="shell ${state.collapsed ? 'collapsed' : ''}" id="shell">
    <aside class="sidebar" aria-label="메뉴">
      <a class="brand" href="/" data-link>
        <span class="brand-mark">${ICON.logo}</span>
        <span><div class="brand-name">블로그 발행센터</div><div class="brand-sub">TAMBLE</div></span>
      </a>
      <nav class="nav">
        ${nav.map((n) => n.group ? `<div class="nav-group">${esc(n.group)}</div>`
          : `<button data-href="${n.path}" class="${activeOf(n) ? 'active' : ''}">${n.team ? `<span class="team-no">${n.no}</span>` : ICON[n.icon]}<span>${esc(n.label)}</span>${n.team && state.team[n.key] ? `<span class="cnt">${state.team[n.key]}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="side-foot">
        <span class="avatar">${esc(initial)}</span>
        <div class="who"><b>${esc(me.name || me.login_id)}</b><span>${isAdmin ? '관리자' : '광고주'} · ${esc(me.login_id)}</span></div>
        <button class="icon-btn" id="logout" title="로그아웃" aria-label="로그아웃">${ICON.logout}</button>
      </div>
    </aside>
    <div class="content">
      <header class="topbar">
        <button class="icon-btn" id="toggle-side" aria-label="메뉴 접기">${ICON.panel}</button>
        <div class="crumbs">${[isAdmin ? '관리자' : '광고주', ...crumbs].map((c, i, a) => i === a.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)}</span><span>›</span>`).join('')}</div>
      </header>
      <main class="main ${wide ? 'wide' : ''}" id="main"></main>
    </div>
  </div>`;
  $('#logout').onclick = async () => { await api('/logout', { method: 'POST' }).catch(() => {}); auth.set(null); state.me = null; navigate('/login'); };
  $('#toggle-side').onclick = () => {
    if (window.innerWidth <= 760) $('#shell').classList.toggle('open');
    else { state.collapsed = !state.collapsed; $('#shell').classList.toggle('collapsed', state.collapsed); }
  };
  return $('#main');
}

export async function refreshTeamCounts() {
  if (state.me?.role !== 'admin') return;
  try { const o = await api('/overview', { quiet: true }); state.team = o.team; } catch {}
}

// ---------- 표시 도우미 ----------
const M_TAG = { 기획: 'gray', 작성중: 'orange', 수정요청: 'red', 원고완료: 'blue', 이미지완료: 'blue', 임시저장: 'purple', 검수완료: 'green', 발행대기: 'orange', 발행완료: 'green', 보류: 'gray' };
export const mTag = (s) => `<span class="tag ${M_TAG[s] || 'gray'}">${esc(s)}</span>`;
const R_TAG = { 발송완료: 'green', 실패: 'red', '번호 없음': 'red', '연결 전(미리보기)': 'gray', '보고 꺼짐': 'gray' };
export const rTag = (s) => `<span class="tag ${R_TAG[s] || 'gray'}">${esc(s)}</span>`;
export const kwChip = (k1, k2) => `<span class="kw-chip">#${esc([k1, k2].filter(Boolean).join(', '))}</span>`;
export const probBar = (p) => `<div class="prob"><div class="prob-bar"><i style="width:${p}%;background:${p >= 60 ? 'var(--success)' : p >= 35 ? 'var(--warn)' : 'var(--danger)'}"></i></div><b>${p}%</b></div>`;

// 순위 칸 (통합탭 초록 / 블로그탭 남색, 10위 밖은 회색)
export function rankCell(t) {
  if (!t) return '<td class="rk-td"><span class="faint">-</span></td>';
  let v, cls = t.tab === '통합' ? 'g' : 'b', d = '—';
  if (!t.checks) { v = '측정 전'; cls = 'off'; }
  else if (t.last_error && t.last_rank == null) { v = '확인 실패'; cls = 'err'; }
  else if (t.last_rank == null) { v = '권외'; cls = 'off'; }
  else { v = `${t.last_rank}위`; if (t.last_rank > 10) cls = 'off'; }
  if (t.checks === 1) d = '첫 측정';
  else if (t.checks > 1 && t.prev_rank != null && t.last_rank != null && t.prev_rank !== t.last_rank) {
    const diff = t.prev_rank - t.last_rank;
    d = diff > 0 ? `<span class="up">▲${diff}</span>` : `<span class="down">▼${-diff}</span>`;
  } else if (t.checks > 1 && t.prev_rank == null && t.last_rank != null) d = '<span class="up">NEW</span>';
  return `<td class="rk-td"><button class="rk-btn" data-track="${t.id}" title="${esc(t.last_error || '순위 기록 보기')}"><div class="rk-kw">${esc(t.keyword)}</div><div class="rk-v ${cls}">${v}</div><div class="rk-d">${d}</div></button></td>`;
}

export function rankTable(posts, { showClient = true, actions = false } = {}) {
  if (!posts.length) return '<div class="empty"><h3>아직 발행된 글이 없어요</h3><p>발행팀이 글을 올리면 여기서 순위를 확인할 수 있어요.</p></div>';
  const find = (p, slot, tab) => p.tracks.find((t) => t.slot === slot && t.tab === tab);
  return `<div class="table-wrap"><table class="tbl rank-tbl">
    <thead><tr><th>제목 · 자동 키워드</th>${showClient ? '<th>업체 · 블로그</th>' : ''}<th class="c g">통합탭</th><th class="c b">블로그탭</th><th class="c g">통합탭 ⊙</th><th class="c b">블로그탭 ⊙</th>${actions ? '<th></th>' : ''}</tr></thead>
    <tbody>${posts.map((p) => `<tr>
      <td class="title-cell"><a href="${esc(p.url)}" target="_blank" rel="noopener" class="t-link">${esc(p.title)}</a><div class="mt8">${kwChip(p.keyword1 || p.tracks[0]?.keyword, p.keyword2)}</div><div class="sub">${fmt.full(p.published_at)} 공개${p.views != null ? ` · 조회 ${fmt.n(p.views)}` : ''}</div></td>
      ${showClient ? `<td><div>${esc(p.client)}</div><div class="sub">${esc(p.blog_name || '')}</div></td>` : ''}
      ${rankCell(find(p, 1, '통합'))}${rankCell(find(p, 1, '블로그'))}${rankCell(find(p, 2, '통합'))}${rankCell(find(p, 2, '블로그'))}
      ${actions ? `<td class="nowrap"><button class="btn sm" data-check="${p.id}">${ICON.refresh} 순위 확인</button></td>` : ''}
    </tr>`).join('')}</tbody></table></div>
    <p class="meta mt12">⊙ = 대표 서브 키워드 (참고용) · 통합탭은 네이버 모바일 통합검색 첫 화면에서 광고(파워링크·파워컨텐츠)를 빼고 센 순서, 블로그탭은 네이버 검색 API 기준이에요. 10위 밖은 회색으로 보여요.</p>`;
}

export function sparkline(history, w = 640, h = 150) {
  const pts = [...history].reverse();
  if (!pts.length) return '<div class="empty" style="padding:24px">아직 기록이 없어요.</div>';
  const max = Math.max(10, ...pts.map((p) => p.rank || 0));
  const top = Math.ceil(max / 10) * 10;
  const x = (i) => (pts.length === 1 ? w / 2 : 24 + (i * (w - 48)) / (pts.length - 1));
  const y = (r) => 16 + ((r - 1) / Math.max(1, top - 1)) * (h - 40);
  let path = '', dots = '';
  pts.forEach((p, i) => {
    if (p.rank == null) { dots += `<circle cx="${x(i)}" cy="${h - 10}" r="3" fill="#d1d6db"/>`; return; }
    path += (path && pts[i - 1]?.rank != null ? 'L' : 'M') + x(i) + ' ' + y(p.rank) + ' ';
    dots += `<circle cx="${x(i)}" cy="${y(p.rank)}" r="3.5" fill="#3182f6"><title>${fmt.full(p.checked_at)} · ${p.rank}위</title></circle>`;
  });
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
    <line x1="0" y1="${y(1)}" x2="${w}" y2="${y(1)}" stroke="#f0f2f4"/><text x="2" y="${y(1) - 4}" font-size="10" fill="#8b95a1">1위</text>
    <line x1="0" y1="${y(top)}" x2="${w}" y2="${y(top)}" stroke="#f0f2f4"/><text x="2" y="${y(top) - 4}" font-size="10" fill="#8b95a1">${top}위</text>
    <text x="2" y="${h - 2}" font-size="10" fill="#b0b8c1">권외</text>
    <path d="${path}" fill="none" stroke="#3182f6" stroke-width="2"/>${dots}</svg>`;
}
export async function showHistory(trackId) {
  const r = await api(`/tracks/${trackId}/history`);
  const rows = r.history.map((h) => `<tr><td>${fmt.full(h.checked_at)}</td><td>${h.rank != null ? `<b class="primary">${h.rank}위</b>` : '<span class="faint">권외</span>'}</td><td class="meta">${({ auto: '자동', manual: '수동', agent: '에이전트' })[h.source] || h.source || ''}</td></tr>`).join('');
  await modal({ title: `${r.track.keyword} · ${r.track.tab}탭 순위 기록`, wide: true, body: `<p class="meta" style="margin:0 0 10px">${esc(r.track.title)}</p>${sparkline(r.history)}<div class="table-wrap mt16"><table class="track-tbl"><thead><tr><th>확인 시각</th><th>순위</th><th>방식</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="faint">기록 없음</td></tr>'}</tbody></table></div>` });
}
export function bindRankButtons(root, reload) {
  $$('[data-track]', root).forEach((b) => (b.onclick = () => showHistory(b.dataset.track)));
  $$('[data-check]', root).forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.innerHTML = '<span class="spinner"></span> 확인 중';
    const r = await api(`/posts/${b.dataset.check}/check`, { method: 'POST' }).catch(() => null);
    if (r) toast(`순위 ${r.ok}건 확인${r.err ? ` · 실패 ${r.err}건` : ''}`);
    reload?.();
  }));
}

// 네이버 검색결과 캡쳐 카드 (실제 캡쳐 이미지가 있으면 그걸, 없으면 저장된 정보로 같은 모양을 그림)
export function captureCard(c) {
  const m = c.meta || {};
  const hl = (s) => esc(s).replaceAll(esc(c.keyword), `<b class="hl">${esc(c.keyword)}</b>`);
  const inner = c.file_id ? `<img class="cap-img" src="/api/files/${c.file_id}" alt="${esc(c.keyword)} 검색결과 캡쳐">` : `
    <div class="cap-post">
      <div class="cap-who"><span class="cap-av" style="background:${m.color || '#e8f3ff'}">${esc((m.blog || c.blog_name || 'B').charAt(0))}</span><div><b>${esc(m.blog || c.blog_name || '')}</b><div class="faint">${esc(m.ago || fmt.rel(c.published_at))}</div></div></div>
      <div class="cap-title">${hl(c.title || '')}</div>
      <div class="cap-snip">${hl(m.snippet || '')}</div>
      <div class="cap-thumbs">${(m.thumbs || ['#f2f4f6', '#e5e8eb', '#f2f4f6']).map((t) => `<span style="background:${t}"></span>`).join('')}</div>
      ${m.quote ? `<div class="cap-quote">“ ${hl(m.quote)}</div>` : ''}
    </div>`;
  return `<div class="cap-card">
    <div class="cap-bar"><span class="n">N</span><b>${esc(c.keyword)}</b><span class="s">${ICON.search}</span></div>
    ${inner}
    <div class="cap-foot"><span class="tag ${c.tab === '통합' ? 'green' : 'blue'}">${esc(c.tab)}탭 ${c.rank ? c.rank + '위' : ''}</span><span class="faint">${fmt.dt(c.captured_at)} 캡쳐</span></div>
  </div>`;
}
