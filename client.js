// 광고주 ERP: 발행 현황(순위표) + 노출 캡쳐
import { state, $, $$, esc, api, fmt, toast, layout, navigate, rankTable, bindRankButtons, captureCard, ICON } from './core.js';

const cq = () => (state.me.role === 'admin' ? `?client_id=${state.previewClient || 1}` : '');

async function clientPicker(main) {
  if (state.me.role !== 'admin') return;
  const { clients } = await api('/clients');
  state.previewClient ||= clients[0]?.id;
  main.insertAdjacentHTML('afterbegin', `<div class="notice">관리자 미리보기: 광고주가 로그인하면 이렇게 보여요. <select class="select sm" id="pc" style="width:auto;display:inline-block;margin-left:8px">${clients.map((c) => `<option value="${c.id}" ${c.id === Number(state.previewClient) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>`);
  $('#pc').onchange = (e) => { state.previewClient = e.target.value; location.reload(); };
}

export async function myPage({ query } = {}) {
  const main = layout({ crumbs: ['발행 현황'], wide: true });
  const biz = query?.get('biz') || '';
  const r = await api('/my/summary' + qs({ biz }));
  const posts = r.posts;
  const tr = posts.flatMap((p) => p.tracks).filter((t) => t.checks > 0);
  const multi = r.businesses.length > 1;
  main.innerHTML = `<div class="page-head"><h1>발행 현황</h1>${multi ? `<select class="select" id="bz" style="width:auto"><option value="">전체 업체</option>${r.businesses.map((b) => `<option value="${b.id}" ${String(b.id) === biz ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>` : ''}</div>
    <div class="credit-bar"><span>발행권<b>${fmt.n(r.credit.total)}건</b></span><span>발행 완료<b>${fmt.n(r.credit.done)}건</b></span><span>진행 중<b>${fmt.n(r.credit.wip)}건</b></span><span>남은 발행권<b>${fmt.n(r.credit.left)}건</b></span><span>통합탭 10위 안<b>${tr.filter((t) => t.tab === '통합' && t.last_rank && t.last_rank <= 10).length}개 키워드</b></span></div>
    <div class="card"><div class="card-head"><h2>발행 글 ${posts.length}개</h2><span class="meta">매일 2번 순위를 확인해요 · 순위를 누르면 기록이 보여요</span></div>${rankTable(posts, { showClient: multi && !biz })}</div>`;
  const bz = $('#bz'); if (bz) bz.onchange = () => navigate('/my' + (bz.value ? '?biz=' + bz.value : ''));
  await clientPicker(main);
  bindRankButtons(main);
}
const qs = (o = {}) => { const p = new URLSearchParams(); if (state.me.role === 'admin') p.set('client_id', state.previewClient || 1); for (const [k, v] of Object.entries(o)) if (v) p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };

// ================= 업체 정보 (광고주가 직접, 여러 업체) =================
const BIZ_FIELDS = [
  ['name', '업체명', true, '예) 벨르뮤 청주본점'], ['industry', '업종', true, '예) 반영구 · 눈썹문신'], ['region', '지역', true, '예) 청주 흥덕구'], ['contact', '대표 연락처', true, '예) 010-0000-0000'],
  ['address', '주소', false, '글 끝 위치 안내에 써요'], ['place_url', '네이버 플레이스 링크', false, 'https://m.place.naver.com/...'], ['homepage', '예약·홈페이지 링크', false, 'https://'], ['photo_folder', '사진 자료 폴더 (구글 드라이브 링크)', false, '사진을 매번 안 올려도 여기서 골라 써요'],
  ['report_phone', '발행 알림톡 받을 번호', false, '비우면 대표 연락처로 보내요']
];
const BIZ_AREAS = [
  ['intro', '업체 소개', true, '대표 서비스, 차별점, 영업시간, 주차 등', 4], ['keywords', '목표 키워드 (줄마다 하나)', true, '예)\n청주눈썹문신\n청주남자눈썹', 4],
  ['must', '글에 꼭 들어갈 문구 (줄마다 하나)', false, '예) 1:1 맞춤 디자인 상담', 3], ['banned', '쓰면 안 되는 표현', false, '예) 최저가, 부작용 없음', 2], ['tone', '원하는 말투', false, '예) 원장님 1인칭, 친근한 ~요체', 2], ['cta', '글 마무리 안내', false, '예) 네이버 예약으로 상담 잡기', 2]
];
export async function businessPage({ query } = {}) {
  const main = layout({ crumbs: ['업체 정보'] });
  const r = await api('/my/businesses' + qs());
  const first = state.me.needs_profile;
  let editId = query?.get('id') ? Number(query.get('id')) : first ? (r.businesses[0]?.id ?? 'new') : null;
  if (query?.get('new')) editId = 'new';
  const draw = () => {
    const cur = editId === 'new' ? { guide: {} } : r.businesses.find((b) => b.id === editId);
    const val = (k) => (['intro', 'must', 'banned', 'tone', 'cta'].includes(k) ? cur?.guide?.[k] : k === 'keywords' ? (cur?.keywords || []).join('\n') : cur?.[k]) || '';
    main.innerHTML = `<div class="page-head"><h1>업체 정보</h1>${r.can_add && !first ? `<button class="btn primary" id="add">${ICON.plus} 업체 추가</button>` : ''}</div>
      ${first ? '<div class="notice"><b>처음 오셨네요!</b> 발행을 요청하기 전에 업체 정보를 먼저 적어 주세요. 적어주신 내용은 모든 글에 반영돼요. 업체가 여러 개면 저장한 뒤 업체 추가로 더 넣을 수 있어요.</div>' : '<p class="page-desc">업체가 여러 개면 모두 등록해 두고, 발행 요청할 때 골라서 쓰면 돼요.</p>'}
      ${!first && r.businesses.length ? `<div class="biz-list">${r.businesses.map((b) => `<button class="biz-card ${b.id === editId ? 'on' : ''}" data-biz="${b.id}"><b>${esc(b.name)}</b><span>${esc(b.industry || '')} · ${esc(b.region || '')}</span><span class="meta">키워드 ${b.keywords.length}개${b.profile_done ? '' : ' · <span class="danger">정보 입력 필요</span>'}</span></button>`).join('')}</div>` : ''}
      ${cur ? `<form class="q-card" id="bf"><h2 class="q-title">${editId === 'new' ? '새 업체 등록' : esc(cur.name) + ' 정보'}</h2><p class="q-desc"><span class="danger">*</span> 표시는 필수예요.</p>
        <div class="form-grid mt16">${BIZ_FIELDS.map(([k, l, req, ph]) => `<div class="${k === 'photo_folder' ? 'full' : ''}"><label class="label">${l}${req ? ' <span class="danger">*</span>' : ''}</label><input class="input" name="${k}" value="${esc(val(k))}" placeholder="${esc(ph)}"></div>`).join('')}
        ${BIZ_AREAS.map(([k, l, req, ph, rows]) => `<div class="full"><label class="label">${l}${req ? ' <span class="danger">*</span>' : ''}</label><textarea class="textarea" name="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(val(k))}</textarea></div>`).join('')}</div>
        <div class="f-error" id="err"></div><div class="row mt16"><button class="btn primary lg">${first ? '저장하고 발행 요청하러 가기' : '저장'}</button>${editId === 'new' && !first ? '<button type="button" class="btn lg" id="cancel">취소</button>' : ''}</div></form>`
      : r.businesses.length ? '<div class="card empty"><p>업체를 누르면 정보를 보고 고칠 수 있어요.</p></div>' : ''}`;
    $$('[data-biz]').forEach((b) => (b.onclick = () => { editId = Number(b.dataset.biz); draw(); }));
    const add = $('#add'); if (add) add.onclick = () => { editId = 'new'; draw(); };
    const cancel = $('#cancel'); if (cancel) cancel.onclick = () => { editId = null; draw(); };
    const f = $('#bf');
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      try {
        const x = await api('/my/businesses' + (editId === 'new' ? '' : '/' + editId) + qs(), { method: editId === 'new' ? 'POST' : 'PUT', body: d, quiet: true });
        toast('업체 정보를 저장했어요.');
        if (first) { state.me.needs_profile = false; return navigate('/my/order'); }
        navigate(`/my/business?id=${x.id}`);
      } catch (err) { $('#err').textContent = err.message; }
    };
  };
  draw();
  await clientPicker(main);
}

export async function myCapturesPage() {
  const main = layout({ crumbs: ['노출 캡쳐'], wide: true });
  const { captures } = await api('/my/captures' + qs());
  main.innerHTML = `<div class="page-head"><h1>노출 캡쳐</h1></div><p class="page-desc">네이버 검색결과에 노출된 화면을 모아 뒀어요.</p>
    <div class="card">${captures.length ? `<div class="cap-grid">${captures.map(captureCard).join('')}</div>` : '<p class="faint">아직 캡쳐가 없어요.</p>'}</div>`;
  await clientPicker(main);
}

// ================= 접수하기 (BrandLift 접수 흐름을 블로그 발행용으로) =================
const OPT = (name, val, cur, label, sub = '', disabled = false) => `<label class="opt ${cur === val ? 'checked' : ''} ${disabled ? 'disabled' : ''}"><input type="radio" name="${name}" value="${esc(val)}" ${cur === val ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="dot"></span><span>${esc(label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span></label>`;
const DEF = { client_id: null, count_mode: '1건', count: 2, kw_mode: '모두 같은 키워드', keyword: '', keywords: '', subs: '', files: [], thumb: null, photo_used: '', title_mode: '', titles: '', body_mode: '', guide: '', body: '', pub_mode: '맡김', pub_date: '', pub_time: '13:00', request: '' };

export async function orderPage() {
  const main = layout({ crumbs: ['접수하기'] });
  const info = await api('/my/order-info' + qs());
  const KEY = 'blogorder:' + (state.me.role === 'admin' ? 'pv' + (state.previewClient || 1) : state.me.id);
  if (!info.businesses.length) { main.innerHTML = `<div class="page-head"><h1>접수하기</h1></div><div class="card empty"><h3>먼저 업체 정보를 등록해 주세요</h3><p><button class="btn primary mt12" data-href="/my/business">업체 정보 입력하기</button></p></div>`; return; }
  let S = { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) };
  if (!info.businesses.some((b) => b.id === S.client_id)) S.client_id = info.businesses.length === 1 ? info.businesses[0].id : null;
  const bizOf = () => info.businesses.find((b) => b.id === S.client_id) || null;
  const left = info.credit.left;
  let savedAt = null, done = null;
  const save = () => { localStorage.setItem(KEY, JSON.stringify(S)); savedAt = new Date(); const el = $('#saved'); if (el) el.textContent = `자동 저장됨 ${fmt.hm(savedAt)}`; };
  const n = () => (S.count_mode === '여러 건' ? Math.max(2, Number(S.count) || 2) : 1);

  const draw = () => {
    if (done) {
      main.innerHTML = `<div class="page-head"><h1>접수하기</h1></div><div class="card done-card"><div class="check">${ICON.check}</div><h2>자료가 잘 도착했어요</h2><p>블로그 ${done.count}건이 접수됐어요. 원고 작성부터 발행까지 진행 상황은 접수 내역에서 볼 수 있어요.<br>남은 발행권: <b>${done.left}건</b></p><div class="row" style="justify-content:center"><button class="btn" data-href="/my/orders">접수 내역 보기</button><button class="btn primary" id="again">하나 더 접수하기</button></div></div>`;
      $('#again').onclick = () => { done = null; orderPage(); };
      return;
    }
    const N = n(), multi = N > 1;
    const lock = left <= 0;
    const B = bizOf();
    main.innerHTML = `<div class="page-head"><h1>접수하기</h1></div>
      <div class="credit-bar"><span>발행권<b>${fmt.n(info.credit.total)}건</b></span><span>발행 완료<b>${fmt.n(info.credit.done)}건</b></span><span>진행 중<b>${fmt.n(info.credit.wip)}건</b></span><span>남은 발행권<b>${fmt.n(left)}건</b></span><span style="margin-left:auto"><button class="link-btn" data-href="/my/credits">충전 신청 ›</button></span></div>
      ${lock ? '<div class="notice warn">남은 발행권이 없어요. <button class="link-btn" data-href="/my/credits">발행권 충전 신청하기 ›</button></div>' : ''}
      <div class="form-top"><span id="saved">${savedAt ? '자동 저장됨 ' + fmt.hm(savedAt) : '입력하면 자동으로 저장돼요'}</span><button class="link-btn" id="reset">처음부터 다시</button></div>
      <fieldset class="lock" ${lock ? 'disabled' : ''}><form id="of" autocomplete="off">
      <div class="q-card"><div class="q-num">1 / 7</div><h2 class="q-title">어떤 업체로 발행할까요?</h2><p class="q-desc">업체 정보에 등록한 업체 중에서 골라주세요. 그 업체 정보와 가이드로 글을 써요.</p>
        <div class="q-body"><div class="opts">${info.businesses.map((b) => OPT('client_id', String(b.id), String(S.client_id ?? ''), b.name, `${b.industry || ''}${b.region ? ' · ' + b.region : ''}`)).join('')}</div><div><button type="button" class="link-btn" data-href="/my/business?new=1">+ 다른 업체 추가하기</button></div></div></div>
      <div class="q-card"><div class="q-num">2 / 7</div><h2 class="q-title">몇 개의 글을 접수할까요?</h2><p class="q-desc">글 1개당 발행 1건이 사용돼요.</p>
        <div class="q-body"><div class="opts">${OPT('count_mode', '1건', S.count_mode, '1건만 접수할게요')}${OPT('count_mode', '여러 건', S.count_mode, '여러 건 접수할게요')}</div>
        ${multi ? `<div><div class="f-label">몇 건 접수할까요?</div><input class="input" type="number" name="count" min="2" max="${Math.max(2, Math.min(30, left || 30))}" value="${N}" style="max-width:200px"><div class="f-hint">남은 발행권 ${left}건</div></div>` : ''}</div></div>

      <div class="q-card"><div class="q-num">3 / 7</div><h2 class="q-title">메인 키워드를 정해주세요.</h2><p class="q-desc">글 1개당 메인 키워드는 1개예요. 이 키워드로 상위노출 글을 분석해서 쓰고, 발행 후 순위도 이 키워드로 확인해드려요.</p>
        <div class="q-body">
        ${multi ? `<div class="opts">${OPT('kw_mode', '모두 같은 키워드', S.kw_mode, '모두 같은 키워드로')}${OPT('kw_mode', '글마다 다르게', S.kw_mode, '글마다 다른 키워드로')}</div>` : ''}
        ${multi && S.kw_mode === '글마다 다르게' ? `<div><div class="f-label">메인 키워드 <span class="req">줄마다 1개씩, ${N}줄</span></div><textarea class="textarea" name="keywords" rows="${Math.min(8, N + 1)}" placeholder="예)\n청주눈썹문신\n청주남자눈썹">${esc(S.keywords)}</textarea><div class="f-hint" id="kwcnt"></div></div>`
          : `<div><div class="f-label">메인 키워드 <span class="req">(필수, 1개)</span></div><input class="input" name="keyword" list="kwl" value="${esc(S.keyword)}" placeholder="예) 청주눈썹문신"><datalist id="kwl">${(B?.keywords || []).map((k) => `<option value="${esc(k)}">`).join('')}</datalist></div>`}
        <div><div class="f-label">서브 키워드 <span class="req">(선택, 참고용 1~5개, 쉼표로)</span></div><input class="input" name="subs" value="${esc(S.subs)}" placeholder="예) 청주남자눈썹, 청주자연눈썹"><div class="f-hint">본문에 자연스럽게 섞어서 넣어드려요.</div></div>
        </div></div>

      <div class="q-card"><div class="q-num">4 / 7</div><h2 class="q-title">원고에 들어갈 사진을 넣어주세요. (선택)</h2><p class="q-desc">${B?.has_folder ? '사진을 안 주시면 업체 정보에 등록한 사진 자료 폴더에서 골라 쓸게요.' : '사진 없이도 접수할 수 있어요.'}</p>
        <div class="q-body">
          <div><div class="photos-head"><div class="f-label">본문 사진 <span>${S.files.length} / 50</span></div></div>
          <label class="drop ${S.files.length ? 'compact' : ''}" id="drop">${S.files.length ? `<span>사진 더 추가하기</span><span class="meta">JPG, PNG, WEBP, GIF · 장당 20MB</span>` : `${ICON.image}<div>사진을 끌어다 놓거나 눌러서 고르세요</div><div class="meta">JPG, PNG, WEBP, GIF · 장당 20MB · 최대 50장</div>`}<input type="file" id="fileIn" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label>
          <div id="upst"></div>
          ${S.files.length ? `<div class="thumb-help">대표사진(썸네일)으로 쓸 사진을 골라주세요.</div><div class="thumbs">${S.files.map((f, i) => `<div class="thumb ${S.thumb === f.id ? 'is-thumb' : ''}"><div class="thumb-img"><img src="/api/files/${f.file_id}" alt=""><span class="thumb-num">${i + 1}</span><button type="button" class="thumb-x" data-rm="${f.id}" aria-label="삭제">×</button></div><button type="button" class="thumb-pick" data-th="${f.id}">${S.thumb === f.id ? '✓ 대표사진' : '대표사진으로'}</button><div class="thumb-name">${esc(f.name)}</div>${f.used_before ? '<div class="thumb-state" style="color:var(--danger)">⚠ 이미 쓴 사진</div>' : ''}</div>`).join('')}</div>` : ''}</div>
          ${S.files.length ? `<div class="sep"></div><div><div class="f-label">네이버(블로그·카페·플레이스 등)에 올린 적이 있는 사진인가요? <span class="warn">사진을 재사용하면 게시글이 누락될 수 있어요.</span></div><div class="opts">${OPT('photo_used', '모두 처음 사용해요', S.photo_used, '모두 처음 사용해요')}${OPT('photo_used', '사용한 적이 있어요', S.photo_used, '사용한 적이 있어요')}</div></div>` : ''}
        </div></div>

      <div class="q-card"><div class="q-num">5 / 7</div><h2 class="q-title">제목을 정해주세요.</h2>
        <div class="q-body"><div class="opts">${OPT('title_mode', '알아서', S.title_mode, '키워드만 드릴게요. 제목은 알아서')}${OPT('title_mode', '입력한 제목 그대로', S.title_mode, '입력한 제목 그대로 발행해주세요')}</div>
        ${S.title_mode === '입력한 제목 그대로' ? `<div><div class="f-label">제목 ${multi ? `<span class="req">줄마다 1개씩, ${N}줄</span>` : '<span class="req">(필수)</span>'}</div>${multi ? `<textarea class="textarea" name="titles" rows="${Math.min(8, N + 1)}">${esc(S.titles)}</textarea>` : `<input class="input" name="titles" value="${esc(S.titles)}" placeholder="메인 키워드를 제목 앞쪽에 넣으면 좋아요">`}</div>` : ''}</div></div>

      <div class="q-card"><div class="q-num">6 / 7</div><h2 class="q-title">원고를 어떻게 할까요?</h2><p class="q-desc">어떤 방식이든 업체 가이드와 상위노출 기준(메인 키워드${info.kw_min ? ` 제목·본문·태그 합쳐 ${info.kw_min}회 이상` : ''}, 글 흐름)으로 최종 검수해요.</p>
        <div class="q-body"><div class="opts three">${OPT('body_mode', '알아서', S.body_mode, '알아서 써주세요', '(업체 가이드대로)')}${OPT('body_mode', '가이드라인만', S.body_mode, '가이드라인만 드릴게요')}${OPT('body_mode', '작성한 원고 그대로', S.body_mode, '작성한 원고 그대로', multi ? '(1건일 때만)' : '', multi)}</div>
        ${S.body_mode === '가이드라인만' ? `<div><div class="f-label">가이드라인</div><textarea class="textarea" name="guide" rows="7" placeholder="꼭 들어가야 할 내용, 강조할 점, 피해야 할 표현, 이번 달 이벤트 등을 적어주세요.">${esc(S.guide)}</textarea></div>` : ''}
        ${S.body_mode === '작성한 원고 그대로' && !multi ? `<div><div class="f-label">원고 <span class="req">사진 들어갈 자리는 [사진1], [사진2] 처럼 적어주세요</span></div><textarea class="textarea" name="body" rows="14">${esc(S.body)}</textarea><div class="f-hint" id="bodycnt"></div></div>` : ''}</div></div>

      <div class="q-card"><div class="q-num">7 / 7</div><h2 class="q-title">발행 시간 희망이 있으신가요?</h2>
        <div class="q-body"><div class="opts">${OPT('pub_mode', '맡김', S.pub_mode, '담당자에게 맡길게요')}${OPT('pub_mode', '지정', S.pub_mode, '날짜·시간 지정')}${OPT('pub_mode', '근처', S.pub_mode, '그 시간 근처로', '(앞뒤 30분)')}${OPT('pub_mode', '무작위', S.pub_mode, '날짜만 정할게요', '(시간은 무작위)')}</div>
        ${S.pub_mode !== '맡김' ? `<div class="f-half-wrap"><div><div class="f-label">날짜</div><input class="input" type="date" name="pub_date" value="${esc(S.pub_date || fmt.today(2))}" min="${fmt.today(1)}"></div>${S.pub_mode !== '무작위' ? `<div><div class="f-label">시간</div><input class="input" type="time" name="pub_time" step="600" value="${esc(S.pub_time)}"></div>` : ''}</div><div class="f-hint">원고 작성·검수에 보통 1~2일 걸려요. 네이버 예약은 10분 단위예요.</div>` : ''}
        <div class="sep"></div><div><div class="f-label">요청사항 <span class="req">(선택)</span></div><textarea class="textarea" name="request" rows="3" placeholder="예) 이번 달 신규 고객 할인 이벤트를 꼭 넣어주세요.">${esc(S.request)}</textarea></div></div></div>
      </form></fieldset>
      <div class="submit-bar"><div class="sum">블로그 <b>${N}건</b> 접수 · ${B ? esc(B.name) + ' · ' : ''}접수 후 남는 발행권 <b>${Math.max(0, left - N)}건</b><div class="f-error" id="err"></div></div><button class="btn primary lg" id="go" ${lock ? 'disabled' : ''}>접수하기</button></div>`;
    bind();
  };

  const counters = () => {
    const kc = $('#kwcnt'); if (kc) { const c = (S.keywords || '').split('\n').filter((x) => x.trim()).length; kc.textContent = `${c} / ${n()}줄`; kc.style.color = c === n() ? 'var(--success)' : 'var(--danger)'; }
    const bc = $('#bodycnt'); if (bc) { const k = (S.keyword || '').replace(/\s/g, ''); const pl = (S.body || '').replace(/\[사진\s*\d+\]/g, '').replace(/\s/g, ''); bc.textContent = `${pl.length.toLocaleString()}자 · 사진 자리 ${((S.body || '').match(/\[사진\s*\d+\]/g) || []).length}곳${k ? ` · 본문 메인 키워드 ${pl.split(k).length - 1}회` : ''}`; }
  };
  const upload = async (files) => {
    const list = [...files].slice(0, 50 - S.files.length);
    const st = $('#upst');
    for (const [i, f] of list.entries()) {
      st.innerHTML = `<div class="upload-status"><span class="spinner"></span> 사진 올리는 중 ${i + 1} / ${list.length}</div>`;
      try {
        const r = await api('/my/files' + qs(), { method: 'POST', raw: f, headers: { 'content-type': f.type || 'image/jpeg', 'x-file-name': encodeURIComponent(f.name) } });
        S.files.push({ id: r.id, file_id: r.file_id, name: r.name, used_before: r.used_before });
        if (!S.thumb) S.thumb = r.id;
        if (r.used_before) toast(`${f.name}: 예전에 쓴 사진이에요.`, 'err');
      } catch {}
    }
    save(); draw();
  };
  function bind() {
    const f = $('#of');
    f.addEventListener('input', (e) => { const t = e.target; if (!t.name || t.type === 'radio') return; S[t.name] = t.value; save(); counters(); if (t.name === 'count') { clearTimeout(bind.t); bind.t = setTimeout(draw, 600); } });
    f.addEventListener('change', (e) => { const t = e.target; if (t.type !== 'radio') return; S[t.name] = t.name === 'client_id' ? Number(t.value) : t.value; if (t.name === 'count_mode' && t.value === '여러 건' && S.body_mode === '작성한 원고 그대로') S.body_mode = '알아서'; save(); draw(); });
        const drop = $('#drop'), inp = $('#fileIn');
    inp.onchange = () => upload(inp.files);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files); };
    $$('[data-rm]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); S.files = S.files.filter((x) => x.id !== Number(b.dataset.rm)); if (S.thumb === Number(b.dataset.rm)) S.thumb = S.files[0]?.id || null; save(); draw(); }));
    $$('[data-th]').forEach((b) => (b.onclick = () => { S.thumb = Number(b.dataset.th); save(); draw(); }));
    $('#reset').onclick = () => { if (!confirm('입력한 내용을 모두 지울까요?')) return; S = { ...DEF, files: [] }; localStorage.removeItem(KEY); draw(); };
    counters();
    $('#go').onclick = async () => {
      const err = $('#err'); err.textContent = '';
      const N = n();
      const miss = [];
      if (!S.client_id) miss.push('업체 선택');
      if (N > 1 && S.kw_mode === '글마다 다르게') { if ((S.keywords || '').split('\n').filter((x) => x.trim()).length !== N) miss.push(`메인 키워드 ${N}줄`); }
      else if (!S.keyword.trim()) miss.push('메인 키워드');
      if (S.files.length && !S.photo_used) miss.push('사진 사용 여부');
      if (!S.title_mode) miss.push('제목 방식'); else if (S.title_mode === '입력한 제목 그대로' && (S.titles || '').split('\n').filter((x) => x.trim()).length !== N) miss.push(`제목 ${N}개`);
      if (!S.body_mode) miss.push('원고 방식'); else if (S.body_mode === '가이드라인만' && !S.guide.trim()) miss.push('가이드라인'); else if (S.body_mode === '작성한 원고 그대로' && !S.body.trim()) miss.push('원고 내용');
      if (miss.length) { err.textContent = `아직 안 채운 것: ${miss.join(', ')}`; return; }
      const btn = $('#go'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> 접수 중';
      try {
        const r = await api('/my/orders' + qs(), { method: 'POST', body: { ...S, count: N, files: S.files.map((x) => x.id), pub_mode: S.pub_mode === '맡김' ? '' : S.pub_mode, pub_date: S.pub_mode === '맡김' ? '' : (S.pub_date || fmt.today(2)) } });
        localStorage.removeItem(KEY); S = { ...DEF, files: [] }; done = r; window.scrollTo(0, 0); draw();
      } catch (e) { btn.disabled = false; btn.textContent = '접수하기'; err.textContent = e.message; }
    };
  }
  draw();
  await clientPicker(main);
}

const C_STATUS = { 기획: ['접수완료', 'gray'], 작성중: ['원고 작성 중', 'orange'], 수정요청: ['원고 작성 중', 'orange'], 원고완료: ['사진 준비 중', 'blue'], 이미지완료: ['검수 중', 'blue'], 임시저장: ['검수 중', 'blue'], 검수완료: ['발행 준비', 'purple'], 발행대기: ['발행 예정', 'purple'], 발행완료: ['발행 완료', 'green'], 보류: ['보류', 'red'] };
export async function myOrdersPage() {
  const main = layout({ crumbs: ['접수 내역'], wide: true });
  const { orders } = await api('/my/orders' + qs());
  const allDone = (o) => o.items.length && o.items.every((i) => i.status === '발행완료');
  main.innerHTML = `<div class="page-head"><h1>접수 내역</h1><button class="btn primary" data-href="/my/order">${ICON.plus} 접수하기</button></div>
    ${orders.length ? orders.map((o) => `<div class="card"><div class="card-head"><div><h2>#${o.id} · ${esc(o.client)} · 블로그 ${o.count}건</h2><div class="meta">${fmt.full(o.created_at)} 접수 · ${esc(o.data.body_mode === '작성한 원고 그대로' ? '직접 쓴 원고' : o.data.body_mode === '가이드라인만' ? '가이드라인 전달' : '원고 작성 맡김')}${o.data.files?.length ? ` · 사진 ${o.data.files.length}장` : ''}${o.data.pub_mode ? ` · 발행 희망 ${esc(o.data.pub_date || '')} ${o.data.pub_mode !== '무작위' ? esc(o.data.pub_time || '') : ''}` : ''}</div></div><span class="tag ${o.status === '반려' ? 'red' : allDone(o) ? 'green' : 'blue'}">${o.status === '반려' ? '반려' : allDone(o) ? '모두 발행' : `${o.items.filter((i) => i.status === '발행완료').length} / ${o.count} 발행`}</span></div>
      <table class="tbl"><thead><tr><th>메인 키워드</th><th>제목</th><th>진행</th><th>발행</th></tr></thead><tbody>${o.items.map((i) => { const [l, c] = C_STATUS[i.status] || [i.status, 'gray']; return `<tr><td><span class="kw-chip">#${esc(i.keyword1)}</span></td><td class="title-cell">${esc(i.title || '(작성 전)')}</td><td><span class="tag ${c}">${l}</span></td><td>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">글 보기</a>` : i.planned_at ? `<span class="meta">${fmt.dt(i.planned_at)} 예정</span>` : '<span class="faint">-</span>'}</td></tr>`; }).join('')}</tbody></table></div>`).join('') : '<div class="card empty"><h3>아직 접수한 글이 없어요</h3><p><button class="btn primary mt12" data-href="/my/order">접수하러 가기</button></p></div>'}`;
  await clientPicker(main);
}

// ================= 발행권 충전 신청 =================
const REQ_TAG = { 대기: ['승인 대기', 'orange'], 승인: ['승인 완료', 'green'], 반려: ['반려', 'red'] };
export async function creditsPage() {
  const main = layout({ crumbs: ['발행권 충전'] });
  const r = await api('/my/credits' + qs());
  const c = r.credit;
  main.innerHTML = `<div class="page-head"><h1>발행권 충전</h1></div>
    <div class="credit-bar"><span>총 발행권<b>${fmt.n(c.total)}건</b></span><span>발행 완료<b>${fmt.n(c.done)}건</b></span><span>진행 중<b>${fmt.n(c.wip)}건</b></span><span>남은 발행권<b>${fmt.n(c.left)}건</b></span></div>
    ${r.preview ? '<div class="notice">관리자 미리보기에서는 신청할 수 없어요. 광고주 계정으로 로그인하면 신청돼요.</div>' : ''}
    <form class="q-card" id="cf"><h2 class="q-title">충전 신청</h2><p class="q-desc">입금 후 신청하시면 담당자가 입금을 확인하고 승인해요. 승인되면 바로 발행권이 늘어나요.</p>
      <div class="q-body">
        <div><div class="f-label">몇 건 충전할까요?</div><div class="row">${[10, 30, 50, 100].map((n) => `<button type="button" class="btn sm" data-amt="${n}">${n}건</button>`).join('')}<input class="input" type="number" name="amount" min="1" max="1000" placeholder="직접 입력" style="max-width:160px"></div></div>
        <div class="f-half-wrap"><div><div class="f-label">입금자명 <span class="req">(필수)</span></div><input class="input" name="depositor" placeholder="통장에 찍힌 이름"></div><div><div class="f-label">메모 <span class="req">(선택)</span></div><input class="input" name="memo" placeholder="예) 11월분, 세금계산서 필요"></div></div>
        <div class="f-error" id="err"></div>
        <div><button class="btn primary lg" ${r.preview ? 'disabled' : ''}>충전 신청하기</button></div>
      </div></form>
    <div class="card"><div class="card-head"><h2>신청 내역</h2></div>${r.requests.length ? `<table class="tbl"><thead><tr><th>신청일</th><th class="num">신청</th><th>입금자</th><th>상태</th><th class="num">승인</th><th>담당자 메모</th></tr></thead><tbody>${r.requests.map((x) => { const [l, t] = REQ_TAG[x.status] || [x.status, 'gray']; return `<tr><td class="nowrap">${fmt.dt(x.created_at)}</td><td class="num"><b>${fmt.n(x.amount)}건</b></td><td>${esc(x.depositor || '')}${x.memo ? `<div class="sub">${esc(x.memo)}</div>` : ''}</td><td><span class="tag ${t}">${l}</span>${x.decided_at ? `<div class="sub">${fmt.dt(x.decided_at)}</div>` : ''}</td><td class="num">${x.approved_amount != null ? fmt.n(x.approved_amount) + '건' : '-'}</td><td class="meta">${esc(x.admin_memo || '')}</td></tr>`; }).join('')}</tbody></table>` : '<p class="faint">아직 신청한 내역이 없어요.</p>'}</div>
    <div class="card"><div class="card-head"><h2>발행권 변동 내역</h2></div>${r.logs.length ? `<table class="tbl"><thead><tr><th>일시</th><th>구분</th><th class="num">변동</th><th class="num">변동 후 총 발행권</th><th>메모</th></tr></thead><tbody>${r.logs.map((l) => `<tr><td class="nowrap">${fmt.dt(l.created_at)}</td><td>${esc(l.kind)}</td><td class="num"><b class="${l.delta > 0 ? 'success' : 'danger'}">${l.delta > 0 ? '+' : ''}${fmt.n(l.delta)}</b></td><td class="num">${fmt.n(l.total_after)}건</td><td class="meta">${esc(l.memo || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="faint">변동 내역이 없어요.</p>'}</div>`;
  const f = $('#cf');
  $$('[data-amt]').forEach((b) => (b.onclick = () => { f.amount.value = b.dataset.amt; }));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    try { await api('/my/credits' + qs(), { method: 'POST', body: d, quiet: true }); toast('충전 신청을 보냈어요. 승인되면 발행권이 늘어나요.'); creditsPage(); }
    catch (err) { $('#err').textContent = err.message; }
  };
  await clientPicker(main);
}
