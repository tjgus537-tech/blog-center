// 관리자 화면: 전체 현황 + 7개 팀 + 기준 정보
import { state, $, $$, esc, api, fmt, toast, modal, confirmBox, layout, navigate, ICON, TEAM_NAV, refreshTeamCounts, mTag, rTag, kwChip, probBar, rankTable, bindRankButtons, captureCard, formData } from './core.js';

const TEAM_INFO = {
  writer: { desc: '키워드 조건에 맞춰 상위노출 글을 계속 모아 패턴으로 만들고, 업체 가이드를 꼭 지켜 원고를 씁니다.', rules: ['업체 가이드(필수 문구·금지 표현·톤)는 모든 원고에 반드시 반영', '패턴은 블로그탭 상위 5개 글만 분석 (통합탭·카페 제외), 주 1회 다시 모아 버전을 올림 (본질 업)', '권장 글자수·사진 수·키워드 반복은 상위글 평균보다 조금 더 충실하게', '사진 들어갈 자리는 본문에 [사진1], [사진2]… 로 표시', '성과팀이 넘긴 "다음 주제"를 먼저 기획'] },
  image: { desc: '원고의 [사진N] 자리에 맞는 이미지를 모아 원고별 폴더로 정리합니다.', rules: ['폴더 이름: 업체명/날짜_키워드/01.jpg 순서', '업체가 준 실제 사진 우선, 부족하면 상업용 무료 스톡만 (AI 티 나는 이미지 금지)', '네이버에 한 번 올린 사진은 재사용 금지 (파일 지문으로 자동 감지)', '원고의 사진 자리 수 이상 모이면 다음 팀으로'] },
  draft: { desc: '원고와 이미지를 네이버 에디터에 넣어 임시저장하고, 마지막 검수까지 끝냅니다.', rules: ['블로그는 하루에 아이디 1개만 로그인, 로그인 화면에서 자동입력 금지', '최종 검수 8가지(제목 키워드·서브 키워드·반복 횟수·글자수·사진 수·재사용·금지 표현·필수 문구) 모두 통과해야 다음 단계', '하나라도 걸리면 원고팀에 수정요청', '캡차·보호조치 화면이 뜨면 그 블로그는 바로 중지'] },
  publish: { desc: '세 가지 방식으로 발행 시간을 정하고 네이버 예약발행을 겁니다.', rules: ['시간지정: 정한 시각 그대로 (네이버 예약은 10분 단위)', '시간근처: 정한 시각 앞뒤 30분 안에서 무작위 (예: 13:00 → 12:30~13:30)', '무작위: 그날 블로그 발행 가능 시간 안에서 무작위', '같은 블로그 글끼리 최소 2시간 간격, 최근 4주에 쓴 시각은 피함', '예약은 발행 20분~3시간 전 사이 무작위로 걸어둠'] },
  perf: { desc: '발행 글의 조회수와 키워드 노출 순위를 확인하고, 캡쳐를 남기고, 다음 주제에 반영합니다.', rules: ['순위: 통합탭(광고 제외) · 블로그탭, 메인·서브 키워드 각각', '하루 2번 자동 확인 (설정에서 시간 변경)', '10위 안 노출은 검색결과 화면을 캡쳐해서 보관', '잘 되는 키워드는 확장, 권외 키워드는 패턴 교체로 원고팀에 제안'] },
  report: { desc: '글이 공개되면 광고주에게 카카오 알림톡으로 보고합니다.', rules: ['공개 즉시 1회 발송 (키워드·제목·처리/공개 일시·총/진행/잔여 건수·주소)', '순위가 안 나온 건은 광고주 ERP에서 보도록 안내', '실패·번호 없음은 대표 브리핑에 바로 올라감'] },
  brief: { desc: '조건별 상위노출 확률과 대표님이 꼭 알아야 할 것만 추려서 보고합니다.', rules: ['확률 = 블로그 지수 + 키워드 경쟁 + 패턴 일치 + 이 키워드 과거 성과 (추정치)', '블로그 중지·누락 의심·순위 급락·알림톡 실패·잔여 건수 임박은 바로 알림', '하루 일정과 멈춘 작업을 한 화면에'] }
};

function teamHead(key, right = '') {
  const t = TEAM_NAV.find((x) => x.key === key);
  const info = TEAM_INFO[key];
  return `<div class="page-head"><h1><span class="team-no lg">${t.no}</span>${esc(t.label)}</h1><div class="row">${right}</div></div>
    <p class="page-desc">${esc(info.desc)}</p>`;
}
function rulesCard(key) {
  return `<details class="card tight rules"><summary><b>팀 운영 규칙</b><span class="meta">Aside 에이전트가 이 규칙대로 움직여요</span></summary><ol class="help-list mt12">${TEAM_INFO[key].rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></details>`;
}
function logCard(logs, title = '팀 활동 기록') {
  return `<div class="card"><div class="card-head"><h2>${title}</h2></div>${logs.length ? `<div class="logs">${logs.map((l) => `<div class="log"><span class="faint nowrap">${fmt.dt(l.created_at)}</span><span>${l.ref_type === 'manuscript' ? `<a href="/admin/m/${l.ref_id}" data-link>${esc(l.message)}</a>` : esc(l.message)}</span><span class="faint nowrap">${esc(l.actor || '')}</span></div>`).join('')}</div>` : '<p class="faint">아직 기록이 없어요.</p>'}</div>`;
}
const tabs = (items, cur) => `<div class="product-tabs">${items.map(([k, l]) => `<button data-tab="${k}" class="${k === cur ? 'active' : ''}">${esc(l)}</button>`).join('')}</div>`;
const bindTabs = (root, fn) => $$('[data-tab]', root).forEach((b) => (b.onclick = () => fn(b.dataset.tab)));
const opts = (list, val, label = (x) => x, value = (x) => x) => list.map((x) => `<option value="${esc(value(x))}" ${String(value(x)) === String(val ?? '') ? 'selected' : ''}>${esc(label(x))}</option>`).join('');

async function page(crumbs, wide = true) { await refreshTeamCounts(); return layout({ crumbs, wide }); }

// ================= 전체 현황 =================
export async function overviewPage() {
  const main = await page(['전체 현황']);
  const o = await api('/overview');
  const c = o.counts;
  const flow = [
    ['writer', `${(c.기획 || 0) + (c.작성중 || 0)}건 작성`, c.수정요청 ? `수정요청 ${c.수정요청}` : ''],
    ['image', `${c.원고완료 || 0}건 취합 대기`, ''],
    ['draft', `${c.이미지완료 || 0}건 임시저장`, `${c.임시저장 || 0}건 검수`],
    ['publish', `${c.검수완료 || 0}건 시간 정하기`, `${c.발행대기 || 0}건 예약`],
    ['perf', `${o.team.perf || 0}개 글 추적`, ''],
    ['report', `${o.team.reportTotal || 0}건 보고`, o.team.report ? `확인 필요 ${o.team.report}` : ''],
    ['brief', '오늘 브리핑', '']
  ];
  main.innerHTML = `<div class="page-head"><h1>전체 현황</h1><div class="row"><button class="btn" id="auto">${ICON.refresh} 자동 기획·일정 지금 돌리기</button><button class="btn primary" id="new-m">${ICON.plus} 새 원고 기획</button></div></div>
    <p class="page-desc">원고 1건이 1팀부터 7팀까지 차례로 넘어가요. 팀을 누르면 그 팀 작업판으로 가요.</p>
    <div class="flow">${flow.map(([k, a, b], i) => { const t = TEAM_NAV.find((x) => x.key === k); return `<button class="flow-step" data-href="${t.path}"><span class="team-no">${t.no}</span><b>${esc(t.label)}</b><span class="v">${esc(a)}</span>${b ? `<span class="meta">${esc(b)}</span>` : ''}</button>${i < flow.length - 1 ? '<span class="flow-arrow">›</span>' : ''}`; }).join('')}</div>
    <div class="grid2 mt16">
      <div class="card"><div class="card-head"><h2>다가오는 발행</h2><button class="btn ghost sm" data-href="/admin/team/publish">발행팀 ›</button></div>
        ${o.upcoming.length ? `<table class="tbl"><tbody>${o.upcoming.map((s) => `<tr class="click" data-href="/admin/m/${s.manuscript_id}"><td class="nowrap"><b>${fmt.dt(s.planned_at)}</b><div class="sub">${fmt.wd(s.planned_at)}요일 · ${esc(s.mode)}</div></td><td><div class="title-cell">${esc(s.title || s.keyword1)}</div><div class="sub">${esc(s.client)} · ${esc(s.blog_name || '')}</div></td><td>${s.status === '예약완료' ? '<span class="tag green">예약 걸림</span>' : '<span class="tag orange">예약 전</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="faint">잡힌 발행이 없어요.</p>'}
      </div>
      ${logCard(o.logs.slice(0, 12), '최근 팀 활동')}
    </div>`;
  $('#new-m').onclick = () => newManuscript();
  $('#auto').onclick = async () => { const r = await api('/auto/run', { method: 'POST' }); toast(`자동 기획 ${r.planned.length}건 · 자동 일정 ${r.scheduled.length}건`); overviewPage(); };
}

// 새 원고 기획 (원고팀 시작점)
export async function newManuscript(preset = {}) {
  const [{ clients }, { blogs }, { keywords }] = await Promise.all([api('/clients'), api('/blogs'), api('/keywords')]);
  const kwFor = (cid) => keywords.filter((k) => String(k.client_id) === String(cid)).map((k) => k.keyword);
  const cid0 = preset.client_id || clients[0]?.id;
  let newId = null;
  const r = await modal({
    title: '새 원고 기획', body: `<form class="form-grid">
      <div class="full"><label class="label">업체</label><select class="select" name="client_id">${opts(clients, cid0, (c) => c.name, (c) => c.id)}</select></div>
      <div><label class="label">메인 키워드</label><input class="input" name="keyword1" list="kwl" required value="${esc(preset.keyword1 || '')}" placeholder="예) 청주눈썹문신"></div>
      <div><label class="label">서브 키워드 (참고용, 쉼표로 1~5개)</label><input class="input" name="keyword2" value="${esc(preset.keyword2 || '')}" placeholder="예) 청주남자눈썹, 청주자연눈썹"></div>
      <datalist id="kwl">${kwFor(cid0).map((k) => `<option value="${esc(k)}">`).join('')}</datalist>
      <div class="full"><label class="label">발행 블로그 (나중에 정해도 돼요)</label><select class="select" name="blog_id"><option value="">발행팀이 정함</option>${opts(blogs.filter((b) => b.status === '운영'), '', (b) => `${b.blog_id} · ${b.grade}`, (b) => b.id)}</select></div>
    </form>`,
    actions: [{ label: '취소', value: null }, { label: '기획 만들기', primary: true, onClick: async (root) => { const d = formData(root); if (!d.keyword1) { toast('메인 키워드를 넣어 주세요.', 'err'); return false; } const x = await api('/manuscripts', { method: 'POST', body: d }); newId = x.id; }, value: 'ok' }],
    onMount: (root) => { root.querySelector('[name=client_id]').onchange = (e) => { root.querySelector('#kwl').innerHTML = kwFor(e.target.value).map((k) => `<option value="${esc(k)}">`).join(''); }; }
  });
  if (r === 'ok') { toast('원고팀에 기획을 넘겼어요.'); navigate(`/admin/m/${newId}`); }
}

// ================= 원고 공통 표 =================
function mTable(rows, cols) {
  if (!rows.length) return '<div class="empty"><h3>지금은 할 일이 없어요</h3><p>앞 팀에서 넘어오면 여기에 쌓여요.</p></div>';
  const C = {
    client: ['업체', (m) => `${esc(m.client)}<div class="sub">${esc(m.blog_name || '블로그 미정')}</div>`],
    title: ['제목 · 키워드', (m) => `<div class="title-cell">${esc(m.title || '(제목 작성 전)')}</div><div class="mt8">${kwChip(m.keyword1, m.keyword2)}</div>`],
    status: ['상태', (m) => mTag(m.status) + (m.review_note && m.status === '수정요청' ? `<div class="sub danger">${esc(m.review_note)}</div>` : '')],
    pscore: ['패턴 일치', (m) => (m.pattern_score != null ? `<b>${m.pattern_score}</b><span class="faint">점</span>` : '<span class="faint">-</span>')],
    chars: ['분량', (m) => (m.chars ? `${fmt.n(m.chars)}자<div class="sub">사진 ${m.photo_slots || 0}곳</div>` : '<span class="faint">-</span>')],
    prob: ['상위노출 확률', (m) => (m.prob != null ? probBar(m.prob) : '-')],
    images: ['사진', (m) => `<b class="${m.img_n >= (m.photo_slots || 1) ? 'success' : 'danger'}">${m.img_n}</b> / ${m.photo_slots || 0}장<div class="sub">${ICON.folder} ${esc(m.image_folder || '')}</div>`],
    review: ['최종 검수', (m) => (m.review ? `<b class="${m.review.ok ? 'success' : 'danger'}">${m.review.passed}/${m.review.total}</b> 통과` : '<span class="faint">검수 전</span>')],
    temp: ['임시저장', (m) => (m.temp_saved_at ? fmt.dt(m.temp_saved_at) : '<span class="faint">-</span>')],
    planned: ['발행 시간', (m) => (m.planned_at ? `<b>${fmt.dt(m.planned_at)}</b><div class="sub">${esc(m.mode)} · ${esc(m.sched_status || '')}</div>` : '<span class="faint">미정</span>')],
    updated: ['최근 변경', (m) => `<span class="meta">${fmt.rel(m.updated_at)}</span>`]
  };
  return `<div class="table-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${C[c][0]}</th>`).join('')}<th></th></tr></thead><tbody>
    ${rows.map((m) => `<tr class="click" data-href="/admin/m/${m.id}">${cols.map((c) => `<td>${C[c][1](m)}</td>`).join('')}<td class="nowrap" data-act="${m.id}"></td></tr>`).join('')}</tbody></table></div>`;
}
function addRowButtons(root, fn) {
  $$('[data-act]', root).forEach((td) => { const html = fn(Number(td.dataset.act)); if (html) td.innerHTML = html; td.onclick = (e) => { if (e.target.closest('button')) e.stopPropagation(); }; });
}

// ================= 1. 원고 작성팀 =================
export async function writerPage({ query }) {
  const main = await page(['7개 팀', '원고 작성팀']);
  const cur = query.get('tab') || 'queue';
  main.innerHTML = teamHead('writer', `<button class="btn primary" id="new-m">${ICON.plus} 새 원고 기획</button>`) + tabs([['queue', '원고 큐'], ['pattern', '상위노출 패턴'], ['ideas', '성과팀 제안']], cur) + '<div id="tab"></div>' + rulesCard('writer') + '<div id="logs"></div>';
  $('#new-m').onclick = () => newManuscript();
  bindTabs(main, (t) => navigate('/admin/team/writer?tab=' + t));
  const tab = $('#tab');
  if (cur === 'queue') {
    const { manuscripts } = await api('/manuscripts?status=기획,작성중,수정요청,원고완료&prob=1');
    const todo = manuscripts.filter((m) => m.status !== '원고완료'), done = manuscripts.filter((m) => m.status === '원고완료');
    tab.innerHTML = `<div class="card"><div class="card-head"><h2>작성할 원고 <span class="faint">${todo.length}</span></h2></div>${mTable(todo, ['client', 'title', 'status', 'chars', 'pscore', 'prob', 'updated'])}</div>
      <div class="card"><div class="card-head"><h2>작성 끝 → 이미지팀 대기 <span class="faint">${done.length}</span></h2></div>${mTable(done, ['client', 'title', 'chars', 'pscore', 'prob', 'updated'])}</div>`;
  } else if (cur === 'pattern') {
    const { keywords } = await api('/keywords');
    tab.innerHTML = `<div class="card"><div class="card-head"><h2>키워드별 상위노출 패턴</h2><span class="meta">블로그탭 상위 5개 글만 모아 분석해요. 매주 다시 모아 버전을 올려요.</span></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>업체</th><th>키워드</th><th class="num">블로그 문서수</th><th class="num">경쟁 점수</th><th>패턴</th><th>수집</th><th></th></tr></thead><tbody>
      ${keywords.map((k) => `<tr class="click" data-pat="${k.id}"><td>${esc(k.client)}</td><td><b>${esc(k.keyword)}</b></td><td class="num">${k.doc_count != null ? fmt.n(k.doc_count) : '-'}</td><td class="num">${k.difficulty != null ? `<b class="${k.difficulty >= 70 ? 'danger' : k.difficulty >= 45 ? '' : 'success'}">${k.difficulty}</b>` : '-'}</td><td>${k.pv ? `<span class="tag blue">v${k.pv}</span>` : '<span class="tag gray">없음</span>'}</td><td class="meta">${k.crawled_at ? fmt.rel(k.crawled_at) : '-'}</td><td><button class="btn sm" data-crawl="${k.id}">${ICON.refresh} 다시 수집</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
    $$('[data-pat]', tab).forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest('button')) patternModal(tr.dataset.pat); }));
    $$('[data-crawl]', tab).forEach((b) => (b.onclick = async () => { b.disabled = true; b.innerHTML = '<span class="spinner"></span> 수집 중'; const r = await api(`/keywords/${b.dataset.crawl}/crawl`, { method: 'POST' }).catch(() => null); if (r) toast(`패턴 v${r.version}로 업데이트했어요.`); writerPage({ query }); }));
  } else {
    await ideasBlock(tab, true);
  }
  $('#logs').innerHTML = logCard((await api('/logs?team=writer')).logs.slice(0, 15));
}

async function patternModal(kid) {
  const r = await api(`/keywords/${kid}/pattern`);
  const p = r.versions[0]?.data;
  const body = !p ? '<div class="empty"><h3>아직 수집 전이에요</h3><p>"다시 수집"을 누르면 상위글을 모아 패턴을 만들어요.</p></div>' : `
    <div class="stats">
      <div class="stat"><div class="k">권장 글자수</div><div class="v">${fmt.n(p.rec.chars)}<small>자</small></div><div class="meta">상위글 평균 ${fmt.n(p.chars.avg)}자</div></div>
      <div class="stat"><div class="k">권장 사진</div><div class="v">${p.rec.images}<small>장</small></div><div class="meta">상위글 중간값 ${p.images.mid}장</div></div>
      <div class="stat"><div class="k">메인 키워드 반복 (제목+본문+태그)</div><div class="v">${r.kw_rule ? `${r.kw_rule.lo}<small>회 이상${r.kw_rule.hi ? ` (최대 ${r.kw_rule.hi})` : ''}</small>` : `${p.rec.kw_lo ?? p.rec.kw}~${p.rec.kw_hi ?? p.rec.kw}<small>회</small>`}</div><div class="meta">${r.kw_rule ? '대표님 기준 · ' : ''}참고: 상위 5개 ${(p.kw_list || []).join(' · ')}회</div></div>
      <div class="stat"><div class="k">제목 맨 앞 키워드</div><div class="v">${p.title_front_rate}<small>%</small></div><div class="meta">제목 평균 ${p.title_len}자</div></div>
    </div>
    ${p.rec.flow ? `<div class="card tight" style="margin-bottom:12px"><h3>권장 글 흐름 <span class="meta">상위 5개 중 3개 이상이 쓴 구간을, 더 많은 글에서 앞에 나온 순서대로</span></h3>${flowChips(p.rec.flow)}${p.rec.flow_opt?.length ? `<div class="meta mt8">선택 구간 (2개 글만 씁): ${p.rec.flow_opt.map(esc).join(', ')}</div>` : ''}<div class="meta mt8">메인 키워드 위치: 도입부 ${p.kw_intro_rate}% · 마무리 ${p.kw_outro_rate}% · 붙여쓰기 비율 ${p.kw_exact_rate}% · 끝에 지도/예약 ${p.map_rate}%</div></div>` : ''}
    <div class="notice"><b>원고팀 지시:</b> ${p.rec.title_front ? '메인 키워드를 제목 맨 앞에' : '제목에 메인 키워드 포함'} · 메인 키워드 반복 제목+본문+태그 총 <b>${r.kw_rule ? r.kw_rule.label : `${p.rec.kw_lo ?? p.rec.kw}~${p.rec.kw_hi ?? p.rec.kw}회`}</b>${p.rec.kw_intro ? ' (첫 문단에 1번)' : ''} · ${fmt.n(p.rec.chars)}자 이상 · 사진 ${p.rec.images}장 이상${p.rec.quotes ? ` · 소제목(인용구) ${p.rec.quotes}개 정도` : ''}<br>
      <span class="meta">상위글 제목에 자주 나온 말: ${p.title_words.map((w) => `<span class="tag gray">${esc(w.w)} ${w.c}</span>`).join(' ') || '-'}</span></div>
    <h3>분석한 블로그탭 상위글 (${r.posts.length})</h3>
    <div class="table-wrap"><table class="track-tbl"><thead><tr><th>순위</th><th>제목 · 글 흐름</th><th>글자</th><th>사진</th><th>메인 키워드</th></tr></thead><tbody>
    ${r.posts.map((x) => `<tr><td>${x.rank}</td><td><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a><div class="faint">${esc(x.blogger || '')}</div>${x.flow ? `<div class="mt8">${flowChips(x.flow.map((f) => f.cat).filter((c) => c !== '본문'), true)}</div>` : ''}</td><td>${fmt.n(x.chars)}</td><td>${x.images}</td><td class="nowrap"><b>총 ${x.kw_count}회</b>${x.kw_title != null ? `<div class="faint">제목 ${x.kw_title} · 본문 ${x.kw_body} · 태그 ${x.kw_tags}</div><div class="faint">태그 ${(x.tags || []).length}개</div>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <h3 class="mt16">버전 기록</h3><div class="meta">${r.versions.map((v) => `v${v.version} · ${fmt.dt(v.created_at)} · 표본 ${v.sample_n}개 · ${esc(v.note || '')}`).join('<br>')}</div>`;
  await modal({ title: `${r.keyword.keyword} · 상위노출 패턴`, wide: true, body });
}

export const flowChips = (cats, small = false, missing = []) => `<div class="flow-chips ${small ? 'sm' : ''}">${cats.map((c, i) => `<span class="fc ${missing.includes(c) ? 'miss' : ''}">${i + 1}. ${esc(c)}</span>`).join('<span class="fa">›</span>')}</div>`;

async function ideasBlock(root, full) {
  const { ideas } = await api('/ideas');
  const open = ideas.filter((i) => i.status === '제안');
  root.innerHTML = `<div class="card"><div class="card-head"><h2>성과팀이 넘긴 다음 주제 <span class="faint">${open.length}</span></h2><button class="btn sm" id="gen">${ICON.refresh} 성과 보고 새로 제안받기</button></div>
    ${ideas.length ? `<table class="tbl"><thead><tr><th>업체</th><th>키워드</th><th>이유</th><th>상태</th><th></th></tr></thead><tbody>${(full ? ideas : open).map((i) => `<tr><td>${esc(i.client)}</td><td>${kwChip(i.keyword1, i.keyword2)}<div class="sub">${esc(i.kind || '')}</div></td><td>${esc(i.reason)}</td><td>${i.status === '제안' ? '<span class="tag blue">제안</span>' : i.status === '채택' ? '<span class="tag green">채택</span>' : '<span class="tag gray">버림</span>'}</td><td class="nowrap">${i.status === '제안' ? `<button class="btn sm primary" data-acc="${i.id}">원고로 만들기</button> <button class="btn sm" data-dis="${i.id}">버리기</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="faint">아직 제안이 없어요.</p>'}</div>`;
  $('#gen', root).onclick = async () => { const r = await api('/ideas/generate', { method: 'POST' }); toast(r.added ? `${r.added}건 새로 제안됐어요.` : '새로 제안할 게 없어요.'); ideasBlock(root, full); };
  $$('[data-acc]', root).forEach((b) => (b.onclick = async () => { const r = await api(`/ideas/${b.dataset.acc}/accept`, { method: 'POST' }); toast('원고팀 기획으로 넘겼어요.'); navigate(`/admin/m/${r.id}`); }));
  $$('[data-dis]', root).forEach((b) => (b.onclick = async () => { await api(`/ideas/${b.dataset.dis}/dismiss`, { method: 'POST' }); ideasBlock(root, full); }));
}

// ================= 2. 이미지 취합팀 =================
export async function imagePage() {
  const main = await page(['7개 팀', '이미지 취합팀']);
  const { manuscripts } = await api('/manuscripts?status=원고완료,이미지완료');
  const todo = manuscripts.filter((m) => m.status === '원고완료'), done = manuscripts.filter((m) => m.status === '이미지완료');
  main.innerHTML = teamHead('image') + `
    <div class="card"><div class="card-head"><h2>사진 모을 원고 <span class="faint">${todo.length}</span></h2></div>${mTable(todo, ['client', 'title', 'images', 'updated'])}</div>
    <div class="card"><div class="card-head"><h2>취합 끝 → 임시저장팀 대기 <span class="faint">${done.length}</span></h2></div>${mTable(done, ['client', 'title', 'images', 'updated'])}</div>
    ${rulesCard('image')}<div id="logs"></div>`;
  addRowButtons(main, (id) => { const m = todo.find((x) => x.id === id); return m ? `<button class="btn sm primary" data-done="${id}" ${m.img_n < (m.photo_slots || 1) ? 'disabled title="사진이 모자라요"' : ''}>취합 완료</button>` : ''; });
  $$('[data-done]', main).forEach((b) => (b.onclick = async () => { await api(`/manuscripts/${b.dataset.done}/status`, { method: 'POST', body: { status: '이미지완료' } }); toast('임시저장팀으로 넘겼어요.'); imagePage(); }));
  $('#logs').innerHTML = logCard((await api('/logs?team=image')).logs.slice(0, 12));
}

// ================= 3. 임시저장·검수팀 =================
export async function draftPage() {
  const main = await page(['7개 팀', '임시저장·검수팀']);
  const { manuscripts } = await api('/manuscripts?status=이미지완료,임시저장,검수완료');
  const a = manuscripts.filter((m) => m.status === '이미지완료'), b = manuscripts.filter((m) => m.status === '임시저장'), c = manuscripts.filter((m) => m.status === '검수완료');
  main.innerHTML = teamHead('draft') + `
    <div class="card"><div class="card-head"><h2>① 네이버 에디터에 임시저장할 글 <span class="faint">${a.length}</span></h2><span class="meta">원고 + 사진을 [사진N] 자리에 맞춰 넣고 임시저장</span></div>${mTable(a, ['client', 'title', 'images', 'updated'])}</div>
    <div class="card"><div class="card-head"><h2>② 최종 검수 <span class="faint">${b.length}</span></h2><span class="meta">8가지 체크를 모두 통과해야 발행팀으로 가요</span></div>${mTable(b, ['client', 'title', 'temp', 'review', 'updated'])}</div>
    <div class="card"><div class="card-head"><h2>검수 통과 → 발행팀 대기 <span class="faint">${c.length}</span></h2></div>${mTable(c, ['client', 'title', 'review', 'updated'])}</div>
    ${rulesCard('draft')}<div id="logs"></div>`;
  addRowButtons(main, (id) => {
    if (a.find((x) => x.id === id)) return `<button class="btn sm primary" data-temp="${id}">임시저장 완료</button>`;
    const m = b.find((x) => x.id === id);
    if (m) return `<button class="btn sm" data-rev="${id}">검수 실행</button> ${m.review?.ok ? `<button class="btn sm primary" data-pass="${id}">통과</button>` : `<button class="btn sm danger" data-fix="${id}">수정요청</button>`}`;
    return '';
  });
  $$('[data-temp]', main).forEach((x) => (x.onclick = async () => { await api(`/manuscripts/${x.dataset.temp}/tempsaved`, { method: 'POST' }); await api(`/manuscripts/${x.dataset.temp}/review`, { method: 'POST' }); toast('임시저장 처리하고 검수까지 돌렸어요.'); draftPage(); }));
  $$('[data-rev]', main).forEach((x) => (x.onclick = async () => { const r = await api(`/manuscripts/${x.dataset.rev}/review`, { method: 'POST' }); toast(`검수 ${r.passed}/${r.total} 통과`); draftPage(); }));
  $$('[data-pass]', main).forEach((x) => (x.onclick = async () => { await api(`/manuscripts/${x.dataset.pass}/status`, { method: 'POST', body: { status: '검수완료' } }); toast('발행팀으로 넘겼어요.'); draftPage(); }));
  $$('[data-fix]', main).forEach((x) => (x.onclick = () => askFix(x.dataset.fix, draftPage)));
  $('#logs').innerHTML = logCard((await api('/logs?team=draft')).logs.slice(0, 12));
}
async function askFix(id, after) {
  const d = await api(`/manuscripts/${id}`);
  const fails = (d.m.review?.list || []).filter((x) => !x.ok).map((x) => `${x.k}: ${x.v}`).join('\n');
  const r = await modal({ title: '원고팀에 수정요청', body: `<form><label class="label">고칠 내용</label><textarea class="textarea" name="note" rows="5">${esc(fails)}</textarea></form>`, actions: [{ label: '취소', value: null }, { label: '수정요청 보내기', primary: true, value: 'ok', onClick: async (root) => { await api(`/manuscripts/${id}/status`, { method: 'POST', body: { status: '수정요청', note: formData(root).note } }); } }] });
  if (r) { toast('원고팀으로 돌려보냈어요.'); after(); }
}

// ================= 4. 발행팀 =================
const MODE_DESC = { 지정: '정한 시각 그대로 올려요.', 근처: '정한 시각 앞뒤 30분 안에서 무작위로 골라요.', 무작위: '그날 블로그 발행 가능 시간 안에서 무작위로 골라요.' };
export async function scheduleModal(m, after) {
  const { blogs } = await api('/blogs');
  const live = blogs.filter((b) => b.status === '운영');
  const r = await modal({
    title: '발행 시간 정하기', wide: true, body: `<form>
      <p class="meta" style="margin:0 0 14px">${esc(m.client)} · ${esc(m.title || m.keyword1)}</p>
      <div class="form-grid">
        <div class="full"><label class="label">발행 블로그</label><select class="select" name="blog_id">${opts(live, m.blog_id, (b) => `${b.blog_id} · ${b.grade} · 하루 최대 ${b.daily_max}건 · ${b.win_start}~${b.win_end}`, (b) => b.id)}</select></div>
        <div class="full"><label class="label">발행 방식</label><div class="opts three">${['지정', '근처', '무작위'].map((k, i) => `<label class="opt ${i === 1 ? 'checked' : ''}"><input type="radio" name="mode" value="${k}" ${i === 1 ? 'checked' : ''}><span class="dot"></span><span>${{ 지정: '시간 선택', 근처: '시간 근처', 무작위: '무작위 발행' }[k]}</span></label>`).join('')}</div><div class="f-hint" id="mode-desc">${MODE_DESC.근처}</div></div>
        <div><label class="label">날짜</label><input class="input" type="date" name="date" value="${fmt.today(1)}"></div>
        <div id="time-wrap"><label class="label">시간</label><input class="input" type="time" name="time" value="13:00" step="600"></div>
      </div>
      <div class="notice mt16" id="plan-out"><button type="button" class="link-btn" id="try">어떤 시간이 잡힐지 미리 보기</button></div>
    </form>`,
    actions: [{ label: '취소', value: null }, { label: '이 방식으로 확정', primary: true, value: 'ok', onClick: async (root) => { const d = formData(root); const x = await api(`/manuscripts/${m.id}/schedule`, { method: 'POST', body: d }); toast(`${fmt.dt(x.planned_at)} 발행으로 잡았어요.${x.warn ? ' (' + x.warn + ')' : ''}`); } }],
    onMount: (root) => {
      const sync = () => { const mode = root.querySelector('[name=mode]:checked').value; $$('.opt', root).forEach((o) => o.classList.toggle('checked', o.querySelector('input').checked)); $('#mode-desc', root).textContent = MODE_DESC[mode]; $('#time-wrap', root).style.visibility = mode === '무작위' ? 'hidden' : 'visible'; };
      $$('[name=mode]', root).forEach((x) => (x.onchange = sync));
      const tryIt = async () => {
        const d = formData(root);
        const outs = [];
        for (let i = 0; i < 5; i++) outs.push(await api('/plan-preview', { method: 'POST', body: d }));
        $('#plan-out', root).innerHTML = `<b>이런 시간들이 잡힐 수 있어요 (매번 다르게 뽑아요)</b><div class="row mt8">${outs.map((o) => `<span class="tag blue">${o.hm}</span>`).join('')}</div><div class="meta mt8">예약은 발행 20분~3시간 전 사이에 걸어요.${outs[0].warn ? ` <span class="danger">${esc(outs[0].warn)}</span>` : ''}</div><button type="button" class="link-btn" id="try">다시 뽑아 보기</button>`;
        $('#try', root).onclick = tryIt;
      };
      $('#try', root).onclick = tryIt;
    }
  });
  if (r) after();
}
export async function publishPage() {
  const main = await page(['7개 팀', '발행팀']);
  const [{ manuscripts }, { schedules }, { blogs }] = await Promise.all([api('/manuscripts?status=검수완료&prob=1'), api('/schedules'), api('/blogs')]);
  const days = {};
  for (const s of schedules) (days[fmt.date(s.planned_at)] ||= []).push(s);
  const today = fmt.date(new Date()), tomorrow = fmt.date(Date.now() + 86400e3);
  const load = (b, d) => schedules.filter((s) => s.blog_id === b.id && fmt.date(s.planned_at) === d).length;
  main.innerHTML = teamHead('publish') + `
    <div class="mode-cards">${['지정', '근처', '무작위'].map((k) => `<div class="mode-card"><b>${{ 지정: '① 시간 선택', 근처: '② 시간 근처', 무작위: '③ 무작위 발행' }[k]}</b><span>${MODE_DESC[k]}</span><span class="meta">${{ 지정: '예) 13:00 → 13:00', 근처: '예) 13:00 → 12:30~13:30 중 하나', 무작위: '예) 11/7 → 09:30~23:50 중 하나' }[k]}</span></div>`).join('')}</div>
    <div class="card"><div class="card-head"><h2>시간 정할 글 <span class="faint">${manuscripts.length}</span></h2></div>${mTable(manuscripts, ['client', 'title', 'review', 'prob', 'updated'])}</div>
    <div class="card"><div class="card-head"><h2>발행 일정</h2><span class="meta">오늘부터 2주 · 예약 걸 시간이 되면 Aside가 네이버 예약발행을 걸어요</span></div>
      ${Object.keys(days).length ? Object.entries(days).map(([d, list]) => `<div class="day"><div class="day-h">${d === today ? '오늘' : d === tomorrow ? '내일' : d} <span class="faint">${fmt.wd(list[0].planned_at)}요일 · ${list.length}건</span></div>
        <table class="tbl"><tbody>${list.map((s) => `<tr class="click" data-href="/admin/m/${s.manuscript_id}"><td class="nowrap" style="width:90px"><b class="big">${fmt.hm(s.planned_at)}</b></td><td style="width:120px"><span class="tag ${s.mode === '지정' ? 'gray' : s.mode === '근처' ? 'blue' : 'purple'}">${{ 지정: '시간 선택', 근처: '시간 근처', 무작위: '무작위' }[s.mode]}</span><div class="sub">${s.base_time ? '기준 ' + esc(s.base_time) : '그날 무작위'}</div></td><td><div class="title-cell">${esc(s.title || s.keyword1)}</div><div class="sub">${esc(s.client)} · ${esc(s.blog_name || '')}</div>${s.note ? `<div class="sub danger">⚠ ${esc(s.note)}</div>` : ''}</td><td class="nowrap">${s.status === '발행완료' ? '<span class="tag green">발행 완료</span>' : s.status === '예약완료' ? '<span class="tag green">예약 걸림</span>' : `<span class="tag orange">예약 전</span><div class="sub">${fmt.dt(s.reserve_by)}까지 걸기</div>`}</td><td class="nowrap" data-sact="${s.manuscript_id}" data-st="${s.status}"></td></tr>`).join('')}</tbody></table></div>`).join('') : '<p class="faint">잡힌 일정이 없어요.</p>'}
    </div>
    <div class="card"><div class="card-head"><h2>블로그별 발행량</h2></div><table class="tbl"><thead><tr><th>블로그</th><th>지수</th><th>상태</th><th>발행 가능 시간</th><th class="num">오늘</th><th class="num">내일</th></tr></thead><tbody>
      ${blogs.map((b) => `<tr><td><b>${esc(b.blog_id)}</b></td><td>${esc(b.grade)}</td><td>${b.status === '운영' ? '<span class="tag green">운영</span>' : `<span class="tag red">${esc(b.status)}</span>`}</td><td>${esc(b.win_start)}~${esc(b.win_end)}</td><td class="num">${load(b, today)} / ${b.daily_max}</td><td class="num">${load(b, tomorrow)} / ${b.daily_max}</td></tr>`).join('')}</tbody></table></div>
    ${rulesCard('publish')}<div id="logs"></div>`;
  addRowButtons(main, (id) => `<button class="btn sm primary" data-plan="${id}">시간 정하기</button>`);
  $$('[data-plan]', main).forEach((b) => (b.onclick = () => scheduleModal(manuscripts.find((m) => m.id === Number(b.dataset.plan)), publishPage)));
  $$('[data-sact]', main).forEach((td) => {
    const id = td.dataset.sact;
    td.onclick = (e) => e.stopPropagation();
    if (td.dataset.st === '예약대기') td.innerHTML = `<button class="btn sm" data-res="${id}">예약 걸림</button>`;
    else if (td.dataset.st === '예약완료') td.innerHTML = `<button class="btn sm primary" data-pub="${id}">발행 완료 등록</button>`;
  });
  $$('[data-res]', main).forEach((b) => (b.onclick = async () => { await api(`/manuscripts/${b.dataset.res}/reserved`, { method: 'POST' }); toast('예약 걸림으로 표시했어요.'); publishPage(); }));
  $$('[data-pub]', main).forEach((b) => (b.onclick = () => publishModal(b.dataset.pub, publishPage)));
  $('#logs').innerHTML = logCard((await api('/logs?team=publish')).logs.slice(0, 12));
}
export async function publishModal(id, after) {
  const r = await modal({ title: '발행 완료 등록', body: `<form><label class="label">공개된 글 주소</label><input class="input" name="url" placeholder="https://blog.naver.com/아이디/글번호" required><label class="label mt12">공개 시각</label><input class="input" type="datetime-local" name="published_at" value="${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16)}"><p class="meta">등록하면 성과팀 순위 추적이 시작되고, 보고팀이 알림톡을 보내요.</p></form>`, actions: [{ label: '취소', value: null }, { label: '등록', primary: true, value: 'ok', onClick: async (root) => { const d = formData(root); d.published_at = d.published_at ? new Date(d.published_at + ':00+09:00').toISOString() : undefined; await api(`/manuscripts/${id}/publish`, { method: 'POST', body: d }); } }] });
  if (r) { toast('발행 완료! 성과팀·보고팀으로 넘겼어요.'); after(); }
}

// ================= 5. 성과팀 =================
export async function perfPage({ query }) {
  const main = await page(['7개 팀', '성과팀']);
  const cur = query.get('tab') || 'rank';
  const cid = query.get('client') || '';
  const [{ clients }, { posts }] = await Promise.all([api('/clients'), api('/posts' + (cid ? `?client_id=${cid}` : ''))]);
  const tr = posts.flatMap((p) => p.tracks).filter((t) => t.checks > 0);
  const integ = tr.filter((t) => t.tab === '통합');
  main.innerHTML = teamHead('perf', `<select class="select" id="cf" style="width:auto"><option value="">전체 업체</option>${opts(clients, cid, (c) => c.name, (c) => c.id)}</select><button class="btn primary" id="runall">${ICON.refresh} 전체 순위 지금 확인</button>`) + `
    <div class="stats">
      <div class="stat"><div class="k">추적 중인 글</div><div class="v">${posts.length}<small>개</small></div></div>
      <div class="stat"><div class="k">통합탭 10위 안</div><div class="v success">${integ.filter((t) => t.last_rank && t.last_rank <= 10).length}<small>/ ${integ.length} 키워드</small></div></div>
      <div class="stat"><div class="k">블로그탭 10위 안</div><div class="v primary">${tr.filter((t) => t.tab === '블로그' && t.last_rank && t.last_rank <= 10).length}<small>키워드</small></div></div>
      <div class="stat"><div class="k">권외</div><div class="v danger">${tr.filter((t) => t.last_rank == null).length}<small>키워드</small></div></div>
      <div class="stat"><div class="k">총 조회수</div><div class="v">${fmt.n(posts.reduce((a, p) => a + (p.views || 0), 0))}</div></div>
    </div>
    ${tabs([['rank', '순위표'], ['capture', '노출 캡쳐'], ['views', '조회수'], ['ideas', '다음 주제 반영']], cur)}<div id="tab"></div>${rulesCard('perf')}<div id="logs"></div>`;
  bindTabs(main, (t) => navigate(`/admin/team/perf?tab=${t}${cid ? '&client=' + cid : ''}`));
  $('#cf').onchange = (e) => navigate(`/admin/team/perf?tab=${cur}${e.target.value ? '&client=' + e.target.value : ''}`);
  $('#runall').onclick = async (e) => { e.target.disabled = true; e.target.innerHTML = '<span class="spinner"></span> 확인 중'; const r = await api('/rank/run', { method: 'POST' }).catch(() => null); if (r) toast(`순위 ${r.ok}건 확인${r.err ? ` · 실패 ${r.err}` : ''}`); perfPage({ query }); };
  const tab = $('#tab');
  if (cur === 'rank') { tab.innerHTML = `<div class="card">${rankTable(posts, { actions: true })}</div>`; bindRankButtons(tab, () => perfPage({ query })); }
  else if (cur === 'capture') {
    const { captures } = await api('/captures' + (cid ? `?client_id=${cid}` : ''));
    tab.innerHTML = `<div class="card"><div class="card-head"><h2>노출 캡쳐 <span class="faint">${captures.length}</span></h2><span class="meta">10위 안에 든 키워드는 Aside가 모바일 검색결과에서 우리 글 부분만 찍어 보관해요</span></div>${captures.length ? `<div class="cap-grid">${captures.map(captureCard).join('')}</div>` : '<p class="faint">아직 캡쳐가 없어요.</p>'}</div>`;
  } else if (cur === 'views') {
    tab.innerHTML = `<div class="card"><div class="card-head"><h2>글별 조회수</h2><span class="meta">블로그 관리자 통계에서 Aside가 하루 1번 모아요 (로그인 필요)</span></div><table class="tbl"><thead><tr><th>글</th><th>업체</th><th class="num">조회수</th><th>수집</th><th></th></tr></thead><tbody>
      ${posts.map((p) => `<tr><td><div class="title-cell">${esc(p.title)}</div><div class="sub">${fmt.dt(p.published_at)} 공개</div></td><td>${esc(p.client)}</td><td class="num"><b>${p.views != null ? fmt.n(p.views) : '-'}</b></td><td class="meta">${p.views_at ? fmt.rel(p.views_at) : '-'}</td><td><button class="btn sm" data-views="${p.id}" data-v="${p.views ?? ''}">입력</button></td></tr>`).join('')}</tbody></table></div>`;
    $$('[data-views]', tab).forEach((b) => (b.onclick = async () => { const r = await modal({ title: '조회수 입력', body: `<form><input class="input" name="views" type="number" value="${b.dataset.v}"></form>`, actions: [{ label: '취소' }, { label: '저장', primary: true, value: 'ok', onClick: async (root) => { await api(`/posts/${b.dataset.views}/views`, { method: 'POST', body: formData(root) }); } }] }); if (r) perfPage({ query }); }));
  } else await ideasBlock(tab, false);
  $('#logs').innerHTML = logCard((await api('/logs?team=perf')).logs.slice(0, 12));
}

// ================= 6. 보고팀 =================
export const kakaoBubble = (msg, at) => `<div class="kakao"><div class="kakao-head"><span class="kakao-av">T</span><b>탬블</b></div><div class="kakao-bub"><div class="kakao-top">알림톡 도착</div><div class="kakao-body">${esc(msg).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}</div></div><div class="kakao-at">${at ? fmt.hm(at) : ''}</div></div>`;
export async function reportPage({ query }) {
  const main = await page(['7개 팀', '보고팀']);
  const [{ reports }, { settings: s }, { clients }] = await Promise.all([api('/reports'), api('/settings'), api('/clients')]);
  const sel = reports.find((r) => String(r.id) === query.get('r')) || reports[0];
  main.innerHTML = teamHead('report') + `
    ${s.has_solapi ? '' : '<div class="notice warn"><b>카카오 알림톡이 아직 연결 전이에요.</b> 지금은 보낼 내용을 "연결 전(미리보기)"으로 쌓아 두고 있어요. 카카오 비즈니스 채널 + 알림톡 대행사(솔라피) 키를 설정에 넣으면 실제로 나가요. <button class="link-btn" data-href="/admin/settings">설정으로 ›</button></div>'}
    <div class="detail-grid">
      <div class="card"><div class="card-head"><h2>발송 기록 <span class="faint">${reports.length}</span></h2></div>
        ${reports.length ? `<table class="tbl"><thead><tr><th>시각</th><th>업체 · 글</th><th>받는 번호</th><th>상태</th><th></th></tr></thead><tbody>${reports.map((r) => `<tr class="click ${sel && r.id === sel.id ? 'sel' : ''}" data-href="/admin/team/report?r=${r.id}"><td class="nowrap meta">${fmt.dt(r.created_at)}</td><td><b>${esc(r.client)}</b><div class="sub">${esc(r.title || '')}</div></td><td class="meta nowrap">${esc(r.to_phone || '-')}</td><td>${rTag(r.status)}${r.error ? `<div class="sub danger">${esc(r.error)}</div>` : ''}</td><td><button class="btn sm" data-resend="${r.id}">다시 보내기</button></td></tr>`).join('')}</tbody></table>` : '<p class="faint">아직 보고가 없어요.</p>'}
      </div>
      <div class="side"><div class="card tight"><h3>카톡 미리보기</h3>${sel ? kakaoBubble(sel.message, sel.sent_at || sel.created_at) : '<p class="faint">-</p>'}</div></div>
    </div>
    <div class="grid2">
      <form class="card" id="tpl"><div class="card-head"><h2>알림톡 문구</h2><button class="btn sm primary">저장</button></div>
        <textarea class="textarea code" name="report_template" rows="13">${esc(s.report_template)}</textarea>
        <p class="meta">쓸 수 있는 칸: #{키워드} #{제목} #{처리일시} #{공개일시} #{총건수} #{진행건수} #{잔여건수} #{URL} #{업체명}<br>※ 실제 발송 문구는 카카오 템플릿 심사를 받은 내용과 똑같아야 해요.</p></form>
      <div class="card"><div class="card-head"><h2>업체별 받는 사람</h2></div><table class="tbl"><thead><tr><th>업체</th><th>번호</th><th>보고</th><th class="num">진행/총</th></tr></thead><tbody>
        ${clients.map((c) => `<tr class="click" data-href="/admin/clients/${c.id}"><td><b>${esc(c.name)}</b></td><td class="meta">${esc(c.report_phone || '없음')}</td><td>${c.report_on ? '<span class="tag green">켜짐</span>' : '<span class="tag gray">꺼짐</span>'}</td><td class="num">${c.done} / ${c.contract_total}</td></tr>`).join('')}</tbody></table></div>
    </div>${rulesCard('report')}<div id="logs"></div>`;
  $$('[data-resend]', main).forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await api(`/reports/${b.dataset.resend}/resend`, { method: 'POST' }); toast('다시 보냈어요.'); reportPage({ query }); }));
  $('#tpl').onsubmit = async (e) => { e.preventDefault(); await api('/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('문구를 저장했어요.'); };
  $('#logs').innerHTML = logCard((await api('/logs?team=report')).logs.slice(0, 10));
}

// ================= 7. 대표 브리핑팀 =================
export async function briefPage() {
  const main = await page(['7개 팀', '대표 브리핑팀']);
  const d = await api('/briefing');
  const k = d.kpi, pl = k.pipeline;
  const lvTag = { red: 'red', orange: 'orange', gray: 'gray' };
  main.innerHTML = teamHead('brief', `<button class="btn" id="save">브리핑 저장</button>`) + `
    <div class="brief-hero card"><div class="meta">${fmt.full(d.at)} 기준</div><h2 style="margin:6px 0 0">대표님, 오늘 발행 ${k.todayCount}건 · 확인할 것 ${d.alerts.filter((a) => a.lv !== 'gray').length}건이에요.</h2>
      <p class="muted" style="margin:8px 0 0">통합탭 10위 안 ${k.top10}/${k.tracked} 키워드 · 권외 ${k.outs} · 작성 중 ${(pl.기획 || 0) + (pl.작성중 || 0) + (pl.수정요청 || 0)} · 발행 대기 ${(pl.검수완료 || 0) + (pl.발행대기 || 0)} · 다음 주제 제안 ${k.ideas}</p></div>
    <div class="grid2">
      <div class="card"><div class="card-head"><h2>대표님이 알아야 할 것</h2></div>${d.alerts.length ? `<div class="alerts">${d.alerts.map((a) => `<div class="alert ${a.lv}" data-href="${a.link}"><span class="tag ${lvTag[a.lv]}">${a.lv === 'red' ? '바로 확인' : a.lv === 'orange' ? '주의' : '참고'}</span><div><b>${esc(a.t)}</b><div class="meta">${esc(a.d)}</div></div></div>`).join('')}</div>` : '<p class="success">특이사항 없어요.</p>'}</div>
      <div class="card"><div class="card-head"><h2>오늘 발행 일정</h2></div>${d.todayPub.length ? `<table class="tbl"><tbody>${d.todayPub.map((s) => `<tr><td class="nowrap"><b>${fmt.hm(s.planned_at)}</b></td><td><div class="title-cell">${esc(s.title || s.keyword1)}</div><div class="sub">${esc(s.client)} · ${esc(s.blog_id || '')} · ${esc(s.mode)}</div></td><td>${s.status === '발행완료' ? '<span class="tag green">완료</span>' : s.status === '예약완료' ? '<span class="tag blue">예약됨</span>' : '<span class="tag orange">예약 전</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="faint">오늘 잡힌 발행이 없어요.</p>'}</div>
    </div>
    <div class="card"><div class="card-head"><h2>조건별 상위노출 확률</h2><span class="meta">블로그 지수 + 키워드 경쟁 + 패턴 일치 + 이 키워드 과거 성과로 낸 추정치예요</span></div>
      <table class="tbl"><thead><tr><th>업체 · 키워드</th><th>제목</th><th>블로그</th><th>단계</th><th style="width:180px">확률</th><th>근거</th></tr></thead><tbody>
      ${d.probs.map((p) => `<tr class="click" data-href="/admin/m/${p.id}"><td><b>${esc(p.client)}</b><div class="mt8">${kwChip(p.keyword1, p.keyword2)}</div></td><td class="title-cell">${esc(p.title || '(작성 전)')}</td><td>${esc(p.blog || '미정')}<div class="sub">${esc(p.grade || '')}</div></td><td>${mTagLite(p.status)}</td><td>${probBar(p.p)}</td><td class="meta">${p.reasons.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
    ${rulesCard('brief')}`;
  $('#save').onclick = async () => { await api('/briefing', { method: 'POST' }); toast('오늘 브리핑을 저장했어요.'); };
}
const mTagLite = (s) => `<span class="tag gray">${esc(s)}</span>`;

// ================= 원고 상세 (한 건의 1~6팀 기록) =================
export async function manuscriptPage({ params }) {
  const main = await page(['원고', `#${params.id}`]);
  const d = await api(`/manuscripts/${params.id}`);
  const m = d.m, p = d.pattern?.data, rec = p?.rec;
  const g = JSON.parse(m.guide || '{}');
  const { blogs } = await api('/blogs');
  const steps = ['기획', '원고완료', '이미지완료', '임시저장', '검수완료', '발행대기', '발행완료'];
  const idx = m.status === '작성중' || m.status === '수정요청' ? 0 : steps.indexOf(m.status);
  const stepLabel = [[1, '원고'], [2, '이미지'], [3, '임시저장'], [3, '최종 검수'], [4, '시간 확정'], [4, '예약·발행'], [5, '성과·보고']];
  const post = d.posts[0];
  main.innerHTML = `<div class="page-head"><h1 style="font-size:24px">${esc(m.title || m.keyword1 + ' (제목 작성 전)')}</h1><div class="row">${mTag(m.status)}${probBar(d.prob.p)}</div></div>
    <p class="page-desc">${esc(m.client)} · ${kwChip(m.keyword1, m.keyword2)} · 블로그 ${esc(m.blog_name || '미정')}</p>
    <div class="stepper">${steps.map((s, i) => `<div class="st ${i < idx ? 'done' : i === idx ? 'cur' : ''}"><span>${i < idx || (m.status === '발행완료' && i === idx) ? '✓' : stepLabel[i][0]}</span>${stepLabel[i][0]}팀 · ${stepLabel[i][1]}</div>`).join('')}</div>
    ${m.status === '수정요청' && m.review_note ? `<div class="notice warn"><b>검수팀 수정요청</b><br>${esc(m.review_note).replace(/\n/g, '<br>')}</div>` : ''}
    ${d.order ? `<div class="card tight" style="border-color:var(--primary-line)"><div class="row between"><h3 style="margin:0">광고주 접수 #${d.order.id} <span class="tag blue">${esc(m.source || '광고주 접수')}</span></h3><span class="meta">${fmt.full(d.order.created_at)}</span></div>
      <dl class="kv mt12"><dt>제목</dt><dd>${d.order.data.title_mode === '입력한 제목 그대로' ? '광고주 제목 그대로' : '알아서'}</dd><dt>원고</dt><dd>${esc(d.order.data.body_mode || '')}</dd>${d.order.data.guide ? `<dt>가이드라인</dt><dd>${esc(d.order.data.guide).replace(/\n/g, '<br>')}</dd>` : ''}${d.order.data.request ? `<dt>요청사항</dt><dd>${esc(d.order.data.request).replace(/\n/g, '<br>')}</dd>` : ''}<dt>발행 희망</dt><dd>${d.order.data.pub_mode ? `${esc({ 지정: '시간 지정', 근처: '시간 근처', 무작위: '날짜만' }[d.order.data.pub_mode] || '')} ${esc(d.order.data.pub_date || '')} ${d.order.data.pub_mode !== '무작위' ? esc(d.order.data.pub_time || '') : ''}` : '담당자에게 맡김'}</dd>${d.order_files.length ? `<dt>광고주 사진</dt><dd>${d.order_files.length}장${d.order.data.photo_used === '사용한 적이 있어요' ? ' <span class="danger">· 네이버에 쓴 적 있는 사진 포함</span>' : ''}</dd>` : ''}</dl>
      ${d.order_files.length ? `<div class="c-photos">${d.order_files.map((f) => `<div class="ph"><img src="/api/files/${f.file_id}" alt=""></div>`).join('')}</div>` : ''}</div>` : ''}
    <div class="detail-grid">
      <div>
        <form class="card" id="mf"><div class="card-head"><h2>1. 원고</h2><div class="row"><button class="btn sm" name="act" value="save">저장</button>${['기획', '작성중', '수정요청'].includes(m.status) ? '<button class="btn sm primary" name="act" value="done">작성 완료 → 이미지팀</button>' : ''}</div></div>
          <div class="form-grid">
            <div><label class="label">메인 키워드</label><input class="input" name="keyword1" value="${esc(m.keyword1)}"></div>
            <div><label class="label">서브 키워드 (참고용, 쉼표로 1~5개)</label><input class="input" name="keyword2" value="${esc(m.keyword2 || '')}"></div>
            <div class="full"><label class="label">제목</label><input class="input" name="title" value="${esc(m.title || '')}" placeholder="${rec?.title_front ? '메인 키워드를 맨 앞에' : '메인 키워드 포함'}"></div>
            <div class="full"><label class="label">본문 <span class="meta" id="cnt"></span></label><textarea class="textarea" name="body" rows="18" placeholder="사진 자리는 [사진1], [사진2] 처럼 적어 주세요.">${esc(m.body || '')}</textarea></div>
            <div class="full"><label class="label">태그 (쉼표로)</label><input class="input" name="tags" value="${esc(m.tags || '')}" placeholder="예) 청주눈썹문신, 청주반영구, 청주남자눈썹"></div>
            <div class="full"><label class="label">발행 블로그</label><select class="select" name="blog_id"><option value="">발행팀이 정함</option>${opts(blogs, m.blog_id, (b) => `${b.blog_id} · ${b.grade}${b.status !== '운영' ? ' (' + b.status + ')' : ''}`, (b) => b.id)}</select></div>
          </div>
        </form>
        <div class="card"><div class="card-head"><h2>2. 이미지 <span class="faint">${d.images.length} / ${m.photo_slots || 0}장</span></h2><label class="btn sm">${ICON.plus} 사진 올리기<input type="file" id="up" accept="image/*" multiple hidden></label></div>
          <div class="meta">${ICON.folder} 정리 폴더: <b>${esc(m.image_folder || '원고 저장 시 자동 생성')}</b>${m.photo_folder ? ` · 사진 가져올 곳: ${/^https?:/.test(m.photo_folder) ? `<a href="${esc(m.photo_folder)}" target="_blank" rel="noopener">업체 자료 폴더</a>` : `<b>${esc(m.photo_folder)}</b>`}` : ' · <span class="danger">업체 자료 폴더 미등록</span>'}</div>
          ${d.images.length ? `<div class="thumbs mt12">${d.images.map((i) => `<div class="thumb"><div class="thumb-img">${i.file_id ? `<img src="/api/files/${i.file_id}" alt="">` : `<div class="ph-img">${String(i.slot).padStart(2, '0')}</div>`}<span class="thumb-num">${i.slot}</span><button class="thumb-x" data-delimg="${i.id}" aria-label="삭제">×</button></div><div class="thumb-name">${esc(i.name)}</div><div class="thumb-state ${i.used_before ? 'danger' : ''}">${i.used_before ? '⚠ 재사용 사진' : esc(i.source || '')}</div></div>`).join('')}</div>` : '<p class="faint">아직 사진이 없어요.</p>'}
          ${m.status === '원고완료' ? `<button class="btn primary mt16" id="imgdone" ${d.images.length < (m.photo_slots || 1) ? 'disabled' : ''}>취합 완료 → 임시저장팀</button>` : ''}
        </div>
        <div class="card"><div class="card-head"><h2>3. 임시저장 · 최종 검수</h2><div class="row"><button class="btn sm" id="rev">검수 실행</button>${m.status === '이미지완료' ? '<button class="btn sm primary" id="temp">임시저장 완료</button>' : ''}${m.status === '임시저장' && m.review?.ok ? '<button class="btn sm primary" id="pass">통과 → 발행팀</button>' : ''}${m.status === '임시저장' ? '<button class="btn sm danger" id="fix">수정요청</button>' : ''}</div></div>
          <div class="meta">임시저장: ${m.temp_saved_at ? fmt.full(m.temp_saved_at) : '전'}</div>
          ${m.review ? `<div class="checks mt12">${m.review.list.map((c) => `<div class="chk ${c.ok ? 'ok' : 'no'}"><span>${c.ok ? '✓' : '✕'}</span><b>${esc(c.k)}</b><span class="meta">${esc(c.v)}</span></div>`).join('')}</div>` : '<p class="faint mt12">아직 검수 전이에요.</p>'}
        </div>
        <div class="card"><div class="card-head"><h2>4. 발행</h2>${['검수완료', '발행대기'].includes(m.status) ? '<button class="btn sm primary" id="plan">시간 정하기</button>' : ''}</div>
          ${d.schedules.length ? `<table class="track-tbl"><thead><tr><th>방식</th><th>기준</th><th>발행 시각</th><th>예약 걸 시각</th><th>상태</th></tr></thead><tbody>${d.schedules.map((s) => `<tr><td>${esc(s.mode)}</td><td>${esc(s.base_date || '')} ${esc(s.base_time || '')}</td><td><b>${fmt.full(s.planned_at)}</b></td><td>${fmt.dt(s.reserve_by)}</td><td>${esc(s.status)}${s.note ? `<div class="danger">${esc(s.note)}</div>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="faint">아직 일정이 없어요.</p>'}
          ${m.status === '발행대기' ? `<div class="row mt12"><button class="btn sm" id="res">예약 걸림</button><button class="btn sm primary" id="pub">발행 완료 등록</button></div>` : ''}
        </div>
        ${post ? `<div class="card"><div class="card-head"><h2>5. 성과</h2><a class="btn sm" href="${esc(post.url)}" target="_blank" rel="noopener">글 열기</a></div>${rankTable(d.posts, { showClient: false, actions: true })}
          ${post.captures?.length ? `<div class="cap-grid mt16">${post.captures.map((c) => captureCard({ ...c, title: post.title, blog_name: post.blog_name, published_at: post.published_at })).join('')}</div>` : ''}</div>
          <div class="card"><div class="card-head"><h2>6. 보고</h2></div>${d.reports.map((r) => `<div class="row between"><span>${rTag(r.status)} <span class="meta">${fmt.dt(r.created_at)} · ${esc(r.to_phone || '')}</span></span></div>${kakaoBubble(r.message, r.sent_at || r.created_at)}`).join('') || '<p class="faint">보고 없음</p>'}</div>` : ''}
      </div>
      <div class="side">
        <div class="card tight"><h3>상위노출 확률 ${d.prob.p}%</h3>${probBar(d.prob.p)}<div class="meta mt8">${d.prob.reasons.map(esc).join('<br>')}</div></div>
        ${rec?.flow?.length && d.analysis ? `<div class="card tight"><h3>글 흐름 비교</h3><div class="meta">상위 5개 권장 흐름</div>${flowChips(rec.flow, true, d.analysis.compare?.missing || [])}<div class="meta mt12">이 원고의 흐름</div>${flowChips(d.analysis.flow.map((f) => f.cat), true)}<div class="mt8 ${d.analysis.compare && !d.analysis.compare.missing.length && d.analysis.compare.order >= 70 ? 'success' : 'danger'}" style="font-size:13px;font-weight:600">필요한 구간 ${d.analysis.compare.covered}/${d.analysis.compare.total} · 순서 일치 ${d.analysis.compare.order}%${d.analysis.compare.missing.length ? ` · 빠짐: ${d.analysis.compare.missing.join(', ')}` : ''}</div>
          <div class="meta mt12">메인 키워드 반복 <b class="${d.analysis.kw_count >= d.kw_rule.lo && (!d.kw_rule.hi || d.analysis.kw_count <= d.kw_rule.hi) ? 'success' : 'danger'}">총 ${d.analysis.kw_count}회</b> (제목 ${d.analysis.kw_title} · 본문 ${d.analysis.kw_body} · 태그 ${d.analysis.kw_tags}) / 기준 ${d.kw_rule.label}</div></div>` : ''}
        <div class="card tight"><h3>패턴 권장값 ${d.pattern ? `<span class="tag blue">v${d.pattern.version}</span>` : ''}</h3>${rec ? `<dl class="kv"><dt>글자수</dt><dd>${fmt.n(rec.chars)}자 이상</dd><dt>사진</dt><dd>${rec.images}장 이상</dd><dt>메인 키워드</dt><dd>제목+본문+태그 총 ${d.kw_rule.label}${rec.kw_intro ? ' · 첫 문단에 1번' : ''}</dd><dt>제목</dt><dd>${rec.title_front ? '키워드 맨 앞' : '키워드 포함'} · ${rec.title_len}자 안팎</dd><dt>패턴 일치</dt><dd><b>${m.pattern_score ?? '-'}</b>점</dd></dl>` : '<p class="faint">이 키워드는 아직 패턴이 없어요. 원고팀 > 상위노출 패턴에서 수집해 주세요.</p>'}</div>
        <div class="card tight"><h3>업체 가이드 (필수)</h3><dl class="kv">${[['소개', g.intro], ['말투', g.tone], ['필수 문구', g.must], ['금지 표현', g.banned], ['마무리', g.cta], ['사진', g.photo_rule], ['제목', g.title_rule]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v).replace(/\n/g, '<br>')}</dd>`).join('') || '<dd class="faint">가이드가 비어 있어요.</dd>'}</dl><button class="btn ghost sm mt8" data-href="/admin/clients/${m.client_id}">가이드 고치기 ›</button></div>
        ${logCard(d.logs, '이 원고 기록')}
      </div>
    </div>`;
  const reload = () => manuscriptPage({ params });
  const f = $('#mf');
  const cnt = () => {
    const v = f.body.value; const pl = v.replace(/\[사진\s*\d+\]/g, '').replace(/\s/g, ''); const k = f.keyword1.value.replace(/\s/g, '');
    const c = (s) => (k ? String(s).replace(/\s/g, '').split(k).length - 1 : 0);
    const ti = c(f.title.value), bo = c(pl), tg = c(f.tags.value);
    const tot = ti + bo + tg, kr = d.kw_rule;
    $('#cnt').innerHTML = `${pl.length.toLocaleString()}자 · 사진 ${(v.match(/\[사진\s*\d+\]/g) || []).length}곳 · <b class="${tot < kr.lo || (kr.hi && tot > kr.hi) ? 'danger' : 'success'}">메인 키워드 총 ${tot}회</b> (제목 ${ti} · 본문 ${bo} · 태그 ${tg}) · 기준 ${kr.label}${tot < kr.lo ? ` · ${kr.lo - tot}회 더` : ''}`;
  };
  f.body.oninput = cnt; f.title.oninput = cnt; f.tags.oninput = cnt; f.keyword1.oninput = cnt; cnt();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(f));
    if (e.submitter?.value === 'done') b.status = '원고완료';
    const r = await api(`/manuscripts/${m.id}`, { method: 'PUT', body: b });
    toast(b.status ? '이미지팀으로 넘겼어요.' : `저장했어요. 패턴 일치 ${r.pattern_score ?? '-'}점`); reload();
  };
  $('#up').onchange = async (e) => {
    for (const file of e.target.files) {
      const r = await api(`/manuscripts/${m.id}/images`, { method: 'POST', raw: file, headers: { 'content-type': file.type || 'image/jpeg', 'x-file-name': encodeURIComponent(file.name), 'x-source': encodeURIComponent('업체 자료') } });
      if (r.used_before) toast(`${file.name}: 예전에 쓴 사진이에요!`, 'err');
    }
    reload();
  };
  $$('[data-delimg]').forEach((b) => (b.onclick = async () => { await api(`/images/${b.dataset.delimg}`, { method: 'DELETE' }); reload(); }));
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('#imgdone', async () => { await api(`/manuscripts/${m.id}/status`, { method: 'POST', body: { status: '이미지완료' } }); reload(); });
  on('#rev', async () => { const r = await api(`/manuscripts/${m.id}/review`, { method: 'POST' }); toast(`검수 ${r.passed}/${r.total} 통과`); reload(); });
  on('#temp', async () => { await api(`/manuscripts/${m.id}/tempsaved`, { method: 'POST' }); await api(`/manuscripts/${m.id}/review`, { method: 'POST' }); reload(); });
  on('#pass', async () => { await api(`/manuscripts/${m.id}/status`, { method: 'POST', body: { status: '검수완료' } }); reload(); });
  on('#fix', () => askFix(m.id, reload));
  on('#plan', () => scheduleModal({ ...m }, reload));
  on('#res', async () => { await api(`/manuscripts/${m.id}/reserved`, { method: 'POST' }); reload(); });
  on('#pub', () => publishModal(m.id, reload));
  bindRankButtons(main, reload);
}

// ================= 광고주 접수 관리 =================
export async function ordersPage() {
  const main = await page(['광고주 접수']);
  const { orders } = await api('/orders');
  const B = { 작성한원고그대로: '광고주 원고' };
  main.innerHTML = `<div class="page-head"><h1>광고주 접수</h1><button class="btn" data-href="/my/order">광고주 접수 화면 보기</button></div>
    <p class="page-desc">광고주가 접수하면 글 수만큼 원고가 자동으로 생겨서 1팀(원고 작성팀)으로 들어가요. 직접 쓴 원고는 2팀(이미지)부터 시작해요.</p>
    <div class="card">${orders.length ? `<table class="tbl"><thead><tr><th>접수</th><th>업체</th><th>메인 키워드</th><th>원고</th><th class="num">사진</th><th>발행 희망</th><th>진행</th><th></th></tr></thead><tbody>
      ${orders.map((o) => `<tr><td class="nowrap"><b>#${o.id}</b><div class="sub">${fmt.dt(o.created_at)}</div></td><td>${esc(o.client)}</td><td>${(o.data.keywords_list || []).slice(0, 3).map((k) => `<span class="kw-chip">#${esc(k)}</span>`).join(' ')}${o.count > 3 ? ` <span class="meta">외 ${o.count - 3}</span>` : ''}<div class="sub">${o.count}건</div></td><td class="meta">${esc(o.data.body_mode === '작성한 원고 그대로' ? '광고주 원고' : o.data.body_mode === '가이드라인만' ? '가이드라인' : '맡김')}</td><td class="num">${o.files_n}</td><td class="meta">${o.data.pub_mode ? `${esc(o.data.pub_date || '')} ${o.data.pub_mode !== '무작위' ? esc(o.data.pub_time || '') : '(무작위)'}` : '맡김'}</td><td>${o.status === '반려' ? '<span class="tag red">반려</span>' : `<span class="tag ${o.done_n === o.count ? 'green' : 'blue'}">${o.done_n} / ${o.count} 발행</span>`}</td><td><button class="btn sm" data-od="${o.id}">자세히</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty"><h3>아직 접수가 없어요</h3></div>'}</div>`;
  $$('[data-od]', main).forEach((b) => (b.onclick = async () => {
    const r = await api(`/orders/${b.dataset.od}`);
    const o = r.order;
    const res = await modal({ title: `광고주 접수 #${o.id} · ${o.client}`, wide: true, body: `<dl class="kv"><dt>글 수</dt><dd>${o.count}건</dd><dt>서브 키워드</dt><dd>${esc(o.data.subs || '-')}</dd><dt>제목</dt><dd>${o.data.title_mode === '입력한 제목 그대로' ? esc(o.data.titles).replace(/\n/g, '<br>') : '알아서'}</dd><dt>원고</dt><dd>${esc(o.data.body_mode)}${o.data.guide ? `<br>${esc(o.data.guide).replace(/\n/g, '<br>')}` : ''}</dd>${o.data.request ? `<dt>요청사항</dt><dd>${esc(o.data.request)}</dd>` : ''}</dl>
      ${r.files.length ? `<div class="c-photos mt12">${r.files.map((f) => `<div class="ph"><img src="/api/files/${f.file_id}" alt=""></div>`).join('')}</div>` : ''}
      <h3 class="mt16">생성된 원고</h3><table class="track-tbl"><tbody>${r.items.map((i) => `<tr><td><a href="#/admin/m/${i.id}">#${i.id}</a></td><td>${esc(i.keyword1)}</td><td>${esc(i.title || '(작성 전)')}</td><td>${mTag(i.status)}</td></tr>`).join('')}</tbody></table>`,
      actions: [{ label: '접수 반려', danger: true, value: 'reject' }, { label: '닫기', value: null }] });
    if (res === 'reject' && (await confirmBox('접수 반려', '이 접수로 만든 원고를 모두 보류로 돌려요. 반려할까요?', '반려', true))) { await api(`/orders/${o.id}`, { method: 'PATCH', body: { status: '반려' } }); ordersPage(); }
  }));
}

// ================= 업체 · 가이드 =================
export async function clientsPage() {
  const main = await page(['기준 정보', '업체 · 가이드']);
  const { clients } = await api('/clients');
  main.innerHTML = `<div class="page-head"><h1>업체 · 가이드</h1><button class="btn primary" id="add">${ICON.plus} 업체 추가</button></div>
    <p class="page-desc">업체별 가이드는 원고팀이 반드시 지켜요. 검수팀도 이 가이드로 최종 검수해요.</p>
    <div class="card"><table class="tbl"><thead><tr><th>업체</th><th>업종 · 지역</th><th class="num">진행 / 총</th><th class="num">잔여</th><th class="num">키워드</th><th class="num">진행 중 원고</th><th>상태</th></tr></thead><tbody>
    ${clients.map((c) => `<tr class="click" data-href="/admin/clients/${c.id}"><td><b>${esc(c.name)}</b></td><td>${esc(c.industry || '')}<div class="sub">${esc(c.region || '')}</div></td><td class="num">${c.done} / ${c.contract_total}</td><td class="num"><b>${Math.max(0, c.contract_total - c.done)}</b></td><td class="num">${c.kw_n}</td><td class="num">${c.wip}</td><td>${c.status === '운영' ? '<span class="tag green">운영</span>' : `<span class="tag gray">${esc(c.status)}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  $('#add').onclick = async () => {
    const { blogs } = await api('/blogs');
    let newId = null;
    const r = await modal({ title: '업체 등록 (이것만 넣으면 자동으로 돌아가요)', wide: true, body: `<form class="form-grid">
      <div class="full"><label class="label">업체명</label><input class="input" name="name" required></div>
      <div><label class="label">업종</label><input class="input" name="industry"></div><div><label class="label">지역</label><input class="input" name="region"></div>
      <div class="full"><label class="label">목표 키워드 (줄마다 하나)</label><textarea class="textarea" name="keywords" rows="3"></textarea></div>
      <div class="full"><label class="label">사진 자료 폴더 (구글 드라이브 주소)</label><input class="input" name="photo_folder" placeholder="https://drive.google.com/..."></div>
      <div><label class="label">한 달 발행 건수 (자동 기획)</label><input class="input" type="number" name="monthly_posts" value="8"></div><div><label class="label">계약 총 건수</label><input class="input" type="number" name="contract_total" value="30"></div>
      <div><label class="label">기본 발행 블로그</label><select class="select" name="blog_id"><option value="">선택</option>${opts(blogs.filter((b) => b.status === '운영'), '', (b) => `${b.blog_id} · ${b.grade}`, (b) => b.id)}</select></div>
      <div><label class="label">기본 발행 방식</label><select class="select" name="publish_mode">${opts([['무작위', '무작위 발행'], ['근처', '시간 근처'], ['지정', '시간 선택']], '무작위', (x) => x[1], (x) => x[0])}</select></div>
      <div><label class="label">기준 시간 (시간 선택·근처일 때)</label><input class="input" type="time" name="publish_time" value="13:00" step="600"></div><div><label class="label">알림톡 받을 번호</label><input class="input" name="report_phone" placeholder="010-"></div>
      <p class="full meta" style="margin:0">가이드(필수 문구·금지 표현·말투)는 등록 후 업체 화면에서 적어 주세요.</p></form>`, actions: [{ label: '취소' }, { label: '등록', primary: true, value: 'ok', onClick: async (root) => { const x = await api('/clients', { method: 'POST', body: formData(root) }); newId = x.id; } }] });
    if (r) navigate(`/admin/clients/${newId}`);
  };
}
export async function clientDetailPage({ params }) {
  const main = await page(['기준 정보', '업체 · 가이드', '상세']);
  const [{ client: c, keywords, accounts, done }, { blogs }] = await Promise.all([api(`/clients/${params.id}`), api('/blogs')]);
  const g = c.guide || {};
  const ta = (k, label, ph, rows = 3) => `<div class="full"><label class="label">${label}</label><textarea class="textarea" name="g_${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(g[k] || '')}</textarea></div>`;
  main.innerHTML = `<div class="page-head"><h1>${esc(c.name)}</h1><div class="row"><span class="tag blue">진행 ${done} / ${c.contract_total} · 잔여 ${Math.max(0, c.contract_total - done)}</span></div></div>
    <div class="detail-grid"><form class="card" id="cf"><div class="card-head"><h2>업체 가이드 (원고 필수 반영)</h2><button class="btn primary sm">저장</button></div>
      <div class="form-grid">
        ${ta('intro', '업체 소개 · 기본 정보', '주소, 영업시간, 대표 시술/서비스, 차별점', 4)}
        ${ta('tone', '말투', '예) 친근한 ~요체, 원장님 1인칭 후기 느낌', 2)}
        ${ta('must', '꼭 들어갈 문구 (줄마다 하나, 검수에서 그대로 확인)', '예) 1:1 맞춤 상담', 3)}
        ${ta('banned', '쓰면 안 되는 표현 (쉼표나 줄바꿈)', '예) 최저가, 부작용 없음', 2)}
        ${ta('cta', '마무리 문구 · 연락 방법', '예) 네이버 예약 링크, 지도', 2)}
        ${ta('photo_rule', '사진 규칙', '예) 매장 실사진만, 얼굴 모자이크', 2)}
        ${ta('title_rule', '제목 규칙', '예) 지역+키워드 앞에, 30자 안쪽', 2)}
      </div></form>
      <div class="side">
        <form class="card tight" id="bf"><h3>계약 · 보고</h3>
          <label class="label">업체명</label><input class="input sm" name="name" value="${esc(c.name)}">
          <div class="f-half-wrap mt8"><div><label class="label">업종</label><input class="input sm" name="industry" value="${esc(c.industry || '')}"></div><div><label class="label">지역</label><input class="input sm" name="region" value="${esc(c.region || '')}"></div></div>
          <div class="f-half-wrap mt8"><div><label class="label">계약 총 건수</label><input class="input sm" type="number" name="contract_total" value="${c.contract_total}"></div><div><label class="label">상태</label><select class="select sm" name="status">${opts(['운영', '중지', '종료'], c.status)}</select></div></div>
          <label class="label mt8">사진 자료 폴더</label><input class="input sm" name="photo_folder" value="${esc(c.photo_folder || '')}" placeholder="구글 드라이브 주소">
          <div class="f-half-wrap mt8"><div><label class="label">한 달 발행 (자동 기획)</label><input class="input sm" type="number" name="monthly_posts" value="${c.monthly_posts || 0}"></div><div><label class="label">기본 블로그</label><select class="select sm" name="blog_id"><option value="">선택</option>${opts(blogs, c.blog_id, (b) => b.blog_id, (b) => b.id)}</select></div></div>
          <div class="f-half-wrap mt8"><div><label class="label">기본 발행 방식</label><select class="select sm" name="publish_mode">${opts([['무작위', '무작위'], ['근처', '시간 근처'], ['지정', '시간 선택']], c.publish_mode, (x) => x[1], (x) => x[0])}</select></div><div><label class="label">기준 시간</label><input class="input sm" type="time" name="publish_time" value="${esc(c.publish_time || '13:00')}" step="600"></div></div>
          <label class="label mt8">알림톡 받을 번호</label><input class="input sm" name="report_phone" value="${esc(c.report_phone || '')}">
          <label class="row mt8"><input type="checkbox" name="report_on" ${c.report_on ? 'checked' : ''}> 발행 시 알림톡 보고</label>
          <button class="btn sm primary mt12">저장</button></form>
        <div class="card tight"><h3>키워드 ${keywords.length}</h3><div class="chips">${keywords.map((k) => `<span class="chip">${esc(k.keyword)}</span>`).join('')}</div><button class="btn ghost sm mt8" data-href="/admin/keywords">키워드 관리 ›</button></div>
        <div class="card tight"><h3>광고주 ERP 계정</h3>${accounts.map((a) => `<div class="row between mt8"><div><b>${esc(a.login_id)}</b> <span class="meta">${esc(a.name || '')} · 업체 ${a.businesses}개</span></div><div class="row"><input class="input sm" type="number" style="width:90px" data-credit="${a.id}" value="${a.credits ?? ''}" placeholder="업체별"><span class="meta">건 발행권</span></div></div>`).join('') || '<p class="faint">없음</p>'}<p class="meta">발행권은 계정 단위예요. 비워두면 업체별 계약 건수 합을 써요.</p><button class="btn sm mt8" id="acc">계정 만들기</button></div>
      </div></div>`;
  const save = async (extra) => { await api(`/clients/${c.id}`, { method: 'PUT', body: extra }); toast('저장했어요.'); };
  $('#cf').onsubmit = async (e) => { e.preventDefault(); const guide = {}; for (const [k, v] of new FormData(e.target)) guide[k.slice(2)] = v; await save({ guide }); };
  $('#bf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.report_on = e.target.report_on.checked; await save(d); clientDetailPage({ params }); };
  $$('[data-credit]').forEach((inp) => (inp.onchange = async () => { await api(`/users/${inp.dataset.credit}`, { method: 'PUT', body: { credits: inp.value } }); toast('발행권을 저장했어요.'); }));
  $('#acc').onclick = async () => { const r = await modal({ title: '광고주 ERP 계정 만들기', body: '<form><label class="label">아이디</label><input class="input" name="login_id"><label class="label mt12">비밀번호 (8자 이상)</label><input class="input" name="password" type="text"><label class="label mt12">담당자 이름</label><input class="input" name="name"></form>', actions: [{ label: '취소' }, { label: '만들기', primary: true, value: 'ok', onClick: async (root) => { await api(`/clients/${c.id}/account`, { method: 'POST', body: formData(root) }); } }] }); if (r) clientDetailPage({ params }); };
}

// ================= 키워드 =================
export async function keywordsPage() {
  const main = await page(['기준 정보', '키워드']);
  const [{ keywords }, { clients }] = await Promise.all([api('/keywords'), api('/clients')]);
  main.innerHTML = `<div class="page-head"><h1>키워드</h1><button class="btn primary" id="add">${ICON.plus} 키워드 추가</button></div>
    <p class="page-desc">업체별 목표 키워드예요. 원고팀이 여기 키워드로 상위글을 모아 패턴을 만들어요.</p>
    <div class="card"><table class="tbl"><thead><tr><th>업체</th><th>키워드</th><th class="num">월 검색량</th><th class="num">블로그 문서수</th><th class="num">경쟁 점수</th><th>패턴</th><th>상태</th><th></th></tr></thead><tbody>
    ${keywords.map((k) => `<tr><td>${esc(k.client)}</td><td><b>${esc(k.keyword)}</b></td><td class="num">${k.monthly != null ? fmt.n(k.monthly) : '-'}</td><td class="num">${k.doc_count != null ? fmt.n(k.doc_count) : '-'}</td><td class="num">${k.difficulty ?? '-'}</td><td>${k.pv ? `<span class="tag blue">v${k.pv}</span>` : '-'}</td><td>${k.status === '활성' ? '<span class="tag green">활성</span>' : '<span class="tag gray">보류</span>'}</td><td class="nowrap"><button class="btn sm" data-crawl="${k.id}">${ICON.refresh} 수집</button> <button class="btn sm" data-tog="${k.id}" data-s="${k.status}">${k.status === '활성' ? '보류' : '활성'}</button></td></tr>`).join('')}</tbody></table></div>`;
  $('#add').onclick = async () => { const r = await modal({ title: '키워드 추가', body: `<form><label class="label">업체</label><select class="select" name="client_id">${opts(clients, '', (c) => c.name, (c) => c.id)}</select><label class="label mt12">키워드 (줄마다 하나)</label><textarea class="textarea" name="text" rows="6"></textarea></form>`, actions: [{ label: '취소' }, { label: '추가', primary: true, value: 'ok', onClick: async (root) => { const x = await api('/keywords', { method: 'POST', body: formData(root) }); toast(`${x.added}개 추가`); } }] }); if (r) keywordsPage(); };
  $$('[data-crawl]', main).forEach((b) => (b.onclick = async () => { b.disabled = true; b.innerHTML = '<span class="spinner"></span>'; await api(`/keywords/${b.dataset.crawl}/crawl`, { method: 'POST' }).catch(() => null); keywordsPage(); }));
  $$('[data-tog]', main).forEach((b) => (b.onclick = async () => { await api(`/keywords/${b.dataset.tog}`, { method: 'PUT', body: { status: b.dataset.s === '활성' ? '보류' : '활성' } }); keywordsPage(); }));
}

// ================= 블로그 계정 =================
export async function blogsPage() {
  const main = await page(['기준 정보', '블로그 계정']);
  const { blogs } = await api('/blogs');
  const form = (b = {}) => `<form class="form-grid"><div><label class="label">블로그 아이디</label><input class="input" name="blog_id" value="${esc(b.blog_id || '')}"></div><div><label class="label">로그인 아이디</label><input class="input" name="login_id" value="${esc(b.login_id || '')}"></div>
    <div><label class="label">블로그 지수</label><select class="select" name="grade">${opts(['최적', '준최', '일반', '저품질'], b.grade || '일반')}</select></div><div><label class="label">하루 최대 발행</label><input class="input" type="number" name="daily_max" value="${b.daily_max || 2}" min="1" max="5"></div>
    <div><label class="label">발행 가능 시작</label><input class="input" type="time" name="win_start" value="${b.win_start || '09:30'}"></div><div><label class="label">발행 가능 끝</label><input class="input" type="time" name="win_end" value="${b.win_end || '23:50'}"></div>
    <div><label class="label">상태</label><select class="select" name="status">${opts(['운영', '중지', '보호조치'], b.status || '운영')}</select></div><div class="full"><label class="label">메모</label><input class="input" name="memo" value="${esc(b.memo || '')}"></div></form>`;
  main.innerHTML = `<div class="page-head"><h1>블로그 계정</h1><button class="btn primary" id="add">${ICON.plus} 블로그 추가</button></div>
    <p class="page-desc">비밀번호는 여기 저장하지 않아요. 로그인은 Aside가 대표님 브라우저에서 하루 아이디 1개씩만 해요.</p>
    <div class="card"><table class="tbl"><thead><tr><th>블로그</th><th>지수</th><th class="num">하루 최대</th><th>발행 가능 시간</th><th class="num">발행 글</th><th class="num">대기</th><th>상태</th></tr></thead><tbody>
    ${blogs.map((b) => `<tr class="click" data-edit="${b.id}"><td><b>${esc(b.blog_id)}</b><div class="sub">로그인 ${esc(b.login_id || '')}${b.memo ? ' · ' + esc(b.memo) : ''}</div></td><td>${esc(b.grade)}</td><td class="num">${b.daily_max}</td><td>${esc(b.win_start)}~${esc(b.win_end)}</td><td class="num">${b.posts}</td><td class="num">${b.queued}</td><td>${b.status === '운영' ? '<span class="tag green">운영</span>' : `<span class="tag red">${esc(b.status)}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
  $('#add').onclick = async () => { const r = await modal({ title: '블로그 추가', wide: true, body: form(), actions: [{ label: '취소' }, { label: '추가', primary: true, value: 'ok', onClick: async (root) => { await api('/blogs', { method: 'POST', body: formData(root) }); } }] }); if (r) blogsPage(); };
  $$('[data-edit]', main).forEach((tr) => (tr.onclick = async () => { const b = blogs.find((x) => x.id === Number(tr.dataset.edit)); const r = await modal({ title: `${b.blog_id} 수정`, wide: true, body: form(b), actions: [{ label: '취소' }, { label: '저장', primary: true, value: 'ok', onClick: async (root) => { await api(`/blogs/${b.id}`, { method: 'PUT', body: formData(root) }); } }] }); if (r) blogsPage(); }));
}

// ================= 설정 · 연결 =================
export async function settingsPage() {
  const main = await page(['기준 정보', '설정 · 연결'], false);
  const { settings: s } = await api('/settings');
  const times = JSON.parse(s.rank_times || '[]').join(', ');
  main.innerHTML = `<div class="page-head"><h1>설정 · 연결</h1></div>
    <form id="sf">
    <div class="card"><div class="card-head"><h2>네이버 순위 확인</h2>${s.has_naver ? '<span class="tag green">API 연결됨</span>' : '<span class="tag gray">API 키 없음</span>'}</div>
      <div class="form-grid">
        <div><label class="label">검색 API Client ID</label><input class="input" name="naver_id" value="${esc(s.naver_id || '')}"></div>
        <div><label class="label">Client Secret</label><input class="input" name="naver_secret" value="${esc(s.naver_secret || '')}"></div>
        <div><label class="label">통합탭 순위 수집 방식</label><select class="select" name="integrated_mode">${opts([['server', '서버가 직접 (빠름, 막히면 실패)'], ['agent', 'Aside가 대표님 브라우저로 (안정적)']], s.integrated_mode, (x) => x[1], (x) => x[0])}</select></div>
        <div><label class="label">메인 키워드 최소 반복 (제목+본문+태그)</label><input class="input" type="number" name="kw_min" value="${esc(s.kw_min ?? '15')}" placeholder="비우면 상위 5개 범위"></div>
        <div><label class="label">메인 키워드 최대 반복 (선택)</label><input class="input" type="number" name="kw_max" value="${esc(s.kw_max || '')}" placeholder="제한 없음"></div>
        <div><label class="label">원고 패턴 분석 기준</label><select class="select" name="pattern_top">${opts(['3', '5', '7', '10'], s.pattern_top || '5', (x) => `블로그탭 상위 ${x}개`)}</select></div>
        <div><label class="label">블로그탭 확인 깊이</label><select class="select" name="blog_depth">${opts(['100', '200', '300', '500'], s.blog_depth, (x) => x + '위까지')}</select></div>
        <div class="full"><label class="label">자동 확인 시각 (쉼표로)</label><input class="input" name="rank_times" value="${esc(times)}"></div>
      </div>
      <p class="meta">블로그탭 = 네이버 공식 검색 API(광고 없음, 하루 25,000회 무료). 통합탭 = 공식 API가 없어서 모바일 통합검색 첫 화면을 읽고 파워링크·파워컨텐츠 광고를 뺀 순서로 세요.</p></div>
    <div class="card"><div class="card-head"><h2>발행 규칙</h2></div><div class="form-grid">
      <div><label class="label">같은 블로그 글 최소 간격 (분)</label><input class="input" type="number" name="min_gap_min" value="${esc(s.min_gap_min)}"></div>
      <div><label class="label">시간근처 범위 (앞뒤 ±분)</label><input class="input" type="number" name="near_range_min" value="${esc(s.near_range_min)}"></div>
      <div><label class="label">예약 거는 시점 (발행 몇 분 전, 최소-최대)</label><input class="input" name="reserve_before_min" value="${esc(s.reserve_before_min)}"></div>
      <div><label class="label">공통 금지 표현</label><input class="input" name="common_banned" value="${esc(s.common_banned)}"></div>
    </div></div>
    <div class="card"><div class="card-head"><h2>카카오 알림톡 (솔라피)</h2>${s.has_solapi ? '<span class="tag green">연결됨</span>' : '<span class="tag gray">연결 전</span>'}</div><div class="form-grid">
      <div><label class="label">API Key</label><input class="input" name="solapi_key" value="${esc(s.solapi_key || '')}"></div>
      <div><label class="label">API Secret</label><input class="input" name="solapi_secret" value="${esc(s.solapi_secret || '')}"></div>
      <div><label class="label">카카오 채널 pfId</label><input class="input" name="kakao_pfid" value="${esc(s.kakao_pfid || '')}"></div>
      <div><label class="label">템플릿 ID</label><input class="input" name="kakao_template_id" value="${esc(s.kakao_template_id || '')}"></div>
      <div><label class="label">발신 번호</label><input class="input" name="sender_phone" value="${esc(s.sender_phone || '')}"></div>
      <div><label class="label">발행되면 바로 보고</label><select class="select" name="report_on_publish">${opts([['1', '켜기'], ['0', '끄기']], s.report_on_publish, (x) => x[1], (x) => x[0])}</select></div>
    </div><p class="meta">필요한 것: 카카오톡 채널(비즈니스 인증) → 솔라피 가입 후 채널 연결 → 보고팀 문구로 템플릿 심사(1~3일).</p></div>
    <div class="row"><button class="btn primary lg">저장</button></div></form>
    <div class="card mt24"><div class="card-head"><h2>Aside 에이전트 연결</h2><button class="btn sm" id="regen">토큰 새로 만들기</button></div>
      <p class="meta" style="margin-top:0">원고 쓰기·사진 모으기·네이버 에디터 임시저장·예약발행·캡쳐·조회수 수집은 Aside가 대표님 브라우저에서 해요. Aside는 이 토큰으로 <code>/api/agent/tasks</code>에서 팀별 할 일을 받아 가요.</p>
      <div class="code" style="background:var(--surface);padding:12px;border-radius:8px;word-break:break-all">x-agent-token: ${esc(s.agent_token)}</div></div>`;
  $('#sf').onsubmit = async (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.rank_times = d.rank_times.split(',').map((x) => x.trim()).filter(Boolean); await api('/settings', { method: 'PUT', body: d }); toast('저장했어요.'); settingsPage(); };
  $('#regen').onclick = async () => { if (await confirmBox('토큰 새로 만들기', '지금 연결된 Aside 루틴도 새 토큰으로 바꿔야 해요.', '새로 만들기')) { await api('/settings', { method: 'PUT', body: { regen_token: true } }); settingsPage(); } };
}
