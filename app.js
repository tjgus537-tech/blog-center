import { state, $, api, route, navigate, render, ICON } from './core.js';
import { overviewPage, writerPage, imagePage, draftPage, publishPage, perfPage, reportPage, briefPage, manuscriptPage, clientsPage, clientDetailPage, keywordsPage, blogsPage, settingsPage, ordersPage } from './admin.js';
import { myPage, myCapturesPage, orderPage, myOrdersPage, businessPage } from './client.js';

const brand = `<div class="brand"><span class="brand-mark">${ICON.logo}</span><span><div class="brand-name">블로그 발행센터</div><div class="brand-sub">TAMBLE</div></span></div>`;

async function loginPage() {
  const s = await api('/setup', { quiet: true }).catch(() => ({ needed: false }));
  if (s.needed) return navigate('/setup', true);
  $('#app').innerHTML = `<div class="auth-wrap"><form class="auth-card" id="f">
    ${brand}<h1>로그인</h1><p>탬블 블로그 발행센터 · 광고주 ERP</p>
    <input class="input" name="login_id" placeholder="아이디" autocomplete="username" aria-label="아이디" required>
    <input class="input" name="password" type="password" placeholder="비밀번호" autocomplete="current-password" aria-label="비밀번호" required>
    <div class="auth-err" id="err"></div><button class="btn primary">로그인</button></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api('/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)), quiet: true }); state.me = (await api('/me')).user; navigate(r.user.role === 'admin' ? '/admin' : state.me.needs_profile ? '/my/business' : '/my/order', true); }
    catch (err) { $('#err').textContent = err.message; }
  };
}
async function setupPage() {
  const s = await api('/setup', { quiet: true });
  if (!s.needed) return navigate('/login', true);
  $('#app').innerHTML = `<div class="auth-wrap"><form class="auth-card" id="f">${brand}<h1>처음 설정</h1><p>대표님 관리자 계정을 만들어 주세요.</p>
    <input class="input" name="name" placeholder="이름" value="서동현"><input class="input" name="login_id" placeholder="관리자 아이디" required>
    <input class="input" name="password" type="password" placeholder="비밀번호 (8자 이상)" required minlength="8"><div class="auth-err" id="err"></div><button class="btn primary">만들기</button></form></div>`;
  $('#f').onsubmit = async (e) => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(e.target));
    try { await api('/setup', { method: 'POST', body, quiet: true }); const r = await api('/login', { method: 'POST', body, quiet: true }); state.me = r.user; navigate('/admin', true); }
    catch (err) { $('#err').textContent = err.message; }
  };
}

route('/login', loginPage);
route('/setup', setupPage);
route('/admin', overviewPage, { admin: true });
route('/admin/team/writer', writerPage, { admin: true });
route('/admin/team/image', imagePage, { admin: true });
route('/admin/team/draft', draftPage, { admin: true });
route('/admin/team/publish', publishPage, { admin: true });
route('/admin/team/perf', perfPage, { admin: true });
route('/admin/team/report', reportPage, { admin: true });
route('/admin/team/brief', briefPage, { admin: true });
route('/admin/m/:id', manuscriptPage, { admin: true });
route('/admin/clients', clientsPage, { admin: true });
route('/admin/clients/:id', clientDetailPage, { admin: true });
route('/admin/keywords', keywordsPage, { admin: true });
route('/admin/blogs', blogsPage, { admin: true });
route('/admin/settings', settingsPage, { admin: true });
route('/admin/orders', ordersPage, { admin: true });
route('/my', myPage);
route('/my/order', orderPage);
route('/my/orders', myOrdersPage);
route('/my/business', businessPage);
route('/my/captures', myCapturesPage);
render();
