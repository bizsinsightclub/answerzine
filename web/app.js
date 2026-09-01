/* 이슈 창발 장치 — 화면 동작.
   키와 고른 값은 localStorage에만 둔다. 실행할 때만 내 컴퓨터의 서버로 넘어간다. */

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const LS = {
  get: (k, d = '') => { try { return localStorage.getItem('iee.' + k) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('iee.' + k, v) } catch { /* 무시 */ } },
}

const STEPS = ['find', 'choose', 'confirm', 'run', 'cands', 'story']

let S = null
let provider = ''
let FOUND = []
let liveCount = 0
let step = 'find'
let reached = new Set(['find'])

async function api(path, opts) {
  const res = await fetch(path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `요청이 실패했습니다 (${res.status})`)
  return data
}

const post = (path, body) =>
  api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

/* ── 덱 넘기기 ── */
function go(to) {
  step = to
  reached.add(to)
  $$('.deck').forEach((d) => d.classList.toggle('is-on', d.id === 'deck-' + to))
  $$('.step').forEach((b) => {
    const i = STEPS.indexOf(b.dataset.step)
    b.classList.toggle('is-on', b.dataset.step === to)
    b.classList.toggle('done', reached.has(b.dataset.step) && b.dataset.step !== to)
    b.disabled = !reached.has(b.dataset.step)
  })
  window.scrollTo({ top: 0 })
}
$$('.step').forEach((b) => b.addEventListener('click', () => go(b.dataset.step)))
$$('.back').forEach((b) => b.addEventListener('click', () => go(b.dataset.to)))

/* ── 설정 ── */
const ENGINE_NAME = { claude_agent: 'Claude Code 구독', gemini: 'Gemini API', anthropic: 'Anthropic API' }
$('#openSettings').addEventListener('click', () => $('#settings').showModal())
$('#closeSettings').addEventListener('click', () => $('#settings').close())
$('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') $('#settings').close() })

function selectProvider(p) {
  provider = p
  LS.set('provider', p)
  $$('.engine-card').forEach((c) => c.classList.toggle('is-on', c.dataset.provider === p))
  $('#fieldGemini').hidden = p !== 'gemini'
  $('#fieldAnthropic').hidden = p !== 'anthropic'
  $('#fieldClaude').hidden = p !== 'claude_agent'
  $('#engineName').textContent = ENGINE_NAME[p] || p
  $('#engineBadge').hidden = false
}

function renderEngines() {
  $$('.engine-card').forEach((card) => {
    const p = card.dataset.provider
    const el = $('[data-role=state]', card)
    if (p === 'claude_agent') {
      el.textContent = S.claude_cli ? '준비됨 · 키 불필요' : 'claude 명령을 찾지 못했습니다'
      el.classList.toggle('ok', S.claude_cli)
    } else {
      const has = p === 'gemini' ? S.env_keys.gemini : S.env_keys.anthropic
      el.textContent = has ? '.env에 키 있음' : '키 입력 필요'
      el.classList.toggle('ok', has)
    }
    card.onclick = () => selectProvider(p)
  })
  $('#claudeHint').textContent = S.claude_cli
    ? '설치된 Claude Code를 그대로 부릅니다. 도구는 모두 꺼두고 글만 받습니다.'
    : 'claude 명령을 찾지 못했습니다. Claude Code를 설치했는지 확인해 주세요.'
  $('#ytHint').textContent = S.env_keys.youtube
    ? '.env에 키가 있습니다. 비워 두면 그것을 씁니다.'
    : '이슈 찾기와 댓글 수집에 씁니다. 없으면 두 기능이 막힙니다.'
}

$('#loadModels').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  btn.disabled = true
  btn.textContent = '불러오는 중'
  try {
    const { models } = await post('/api/gemini/models', { key: $('#keyGemini').value.trim() })
    const sel = $('#modelGemini')
    const saved = LS.get('model.gemini')
    sel.innerHTML = models.map((m) => `<option value="${esc(m.id)}">${esc(m.id)}</option>`).join('')
    if (saved && models.some((m) => m.id === saved)) sel.value = saved
    sel.hidden = false
    LS.set('model.gemini', sel.value)
  } catch (err) {
    alert(err.message)
  } finally {
    btn.disabled = false
    btn.textContent = '모델 불러오기'
  }
})

$('#modelGemini').addEventListener('change', (e) => LS.set('model.gemini', e.target.value))
$('#effort').addEventListener('change', (e) => LS.set('effort', e.target.value))
;[['keyGemini', 'gemini'], ['keyYoutube', 'youtube'], ['keyAnthropic', 'anthropic']].forEach(([id, k]) => {
  $('#' + id).addEventListener('input', (e) => LS.set('key.' + k, e.target.value.trim()))
})

/* ── 일감 진행 상황 따라가기 ── */
function pollJob(runId, on) {
  let cursor = 0
  let candCursor = 0
  const tick = async () => {
    let d
    try {
      d = await api(`/api/run?id=${encodeURIComponent(runId)}&from=${cursor}&cand=${candCursor}`)
    } catch (err) {
      on.line?.(['### ' + err.message])
      return on.done?.(1)
    }
    cursor = d.next
    candCursor = d.cand_next
    if (d.lines.length) on.line?.(d.lines)
    if (d.cands.length) on.cands?.(d.cands)
    on.step?.(d.step)
    if (d.done) return on.done?.(d.code)
    setTimeout(tick, 700)
  }
  tick()
}

/* ── ① 찾기 ── */
let findMode = 'now'
$$('#findMode .pick-card').forEach((c) => c.addEventListener('click', () => {
  findMode = c.dataset.mode
  LS.set('findMode', findMode)
  $$('#findMode .pick-card').forEach((x) => x.classList.toggle('is-on', x === c))
  $('#findDates').hidden = findMode !== 'period'
}))
;['findStart', 'findEnd'].forEach((id) =>
  $('#' + id).addEventListener('change', (e) => LS.set(id, e.target.value)))

$('#skipFind').addEventListener('click', () => go('choose'))

$('#findIssues').addEventListener('click', async (e) => {
  const problem = guard(['collect_youtube.py'])
  if (problem) { $('#settings').showModal(); return alert(problem) }
  const period = findMode === 'period'
    ? { start: $('#findStart').value, end: $('#findEnd').value } : null
  if (period && !(period.start && period.end)) return alert('시작일과 종료일을 모두 정해 주세요.')

  const btn = e.currentTarget
  btn.disabled = true
  btn.textContent = '찾는 중'
  $('#findNote').className = 'note'
  $('#findNote').textContent = ''
  const log = $('#findLog')
  log.textContent = ''
  log.hidden = false
  try {
    const { run_id } = await post('/api/discover', { ...jobBase(), discover_period: period })
    pollJob(run_id, {
      line: (lines) => {
        log.textContent += lines.filter((l) => !l.startsWith('###')).join('\n') + '\n'
        log.scrollTop = log.scrollHeight
      },
      done: async (code) => {
        btn.disabled = false
        btn.textContent = '다시 찾아보기'
        if (code !== 0) {
          $('#findNote').className = 'note bad'
          $('#findNote').textContent = '찾기에 실패했습니다. 위 기록을 보세요.'
          return
        }
        const d = await api('/api/discover?id=' + encodeURIComponent(run_id))
        renderFound(d.issues)
        log.hidden = true
        if (d.issues.length) go('choose')
        else $('#findNote').textContent = '이슈로 묶을 만한 게 없었습니다. 기간을 넓혀 보세요.'
      },
    })
  } catch (err) {
    btn.disabled = false
    btn.textContent = '이슈 찾아보기'
    alert(err.message)
  }
})

/* ── ② 고르기 ── */
function renderFound(issues) {
  FOUND = issues || []
  const box = $('#found')
  $('#skipFind').hidden = !FOUND.length
  if (!FOUND.length) {
    box.innerHTML = '<div class="empty">아직 찾아 온 후보가 없습니다. 앞 장에서 먼저 찾아 주세요.</div>'
    $('#applyFound').disabled = true
    return
  }
  box.innerHTML = FOUND.map((it, i) => `
    <label class="found-card">
      <input type="checkbox" data-i="${i}">
      <span class="found-body">
        <span class="found-kw">${esc(it.keyword)}</span>
        <span class="found-title">${esc(it.title)}</span>
        <span class="found-meta">영상 ${it.mentions || 0}개${it.why ? ' · ' + esc(it.why) : ''}</span>
      </span>
    </label>`).join('')
  $$('#found input').forEach((c) => c.addEventListener('change', countFound))
  countFound()
}

function countFound() {
  const n = $$('#found input:checked').length
  $('#foundCount').textContent = n ? `${n}개 골랐습니다. 두세 개를 권합니다.` : '다룰 이슈를 고르세요.'
  $('#applyFound').disabled = n === 0
}

$('#applyFound').addEventListener('click', async () => {
  const picked = $$('#found input:checked').map((c) => FOUND[+c.dataset.i])
  if (!picked.length) return
  $('#issues').innerHTML = ''
  picked.forEach((it, i) => $('#issues').appendChild(issueRow(it, i)))
  await saveIssues()
  go('confirm')
})

/* ── ③ 확인 ── */
function issueRow(it = { id: '', keyword: '', proper_nouns: [] }, i = 0) {
  const el = document.createElement('div')
  el.className = 'issue'
  el.innerHTML = `
    <div class="issue-top"><span class="issue-no">이슈 ${i + 1}</span><button class="kill" type="button">지우기</button></div>
    <input class="i-id" type="hidden" value="${esc(it.id)}">
    <div class="field">
      <label>이 이슈, 유튜브에 뭐라고 검색하면 나올까요</label>
      <input class="i-kw" type="text" value="${esc(it.keyword)}" placeholder="예: 제주 실종 경찰 허위종결">
    </div>
    <div class="field">
      <label>이 사건에 나오는 이름들 (쉼표로 구분)</label>
      <input class="i-pn" type="text" value="${esc((it.proper_nouns || []).join(', '))}" placeholder="사람 이름, 지역 이름, 기관 이름">
      <p class="why">여기 적은 말이 그대로 들어간 결과는 버립니다. 사건을 요약한 이름이 아니라,
        아무도 안 붙여 본 새 이름을 얻으려는 것이라서요. 비워 두면 이 장치가 잘 안 돕니다.</p>
    </div>`
  $('.kill', el).onclick = () => { el.remove(); renumber() }
  return el
}

function renumber() {
  $$('.issue .issue-no').forEach((el, i) => (el.textContent = `이슈 ${i + 1}`))
}

function renderIssues() {
  const box = $('#issues')
  box.innerHTML = ''
  const list = S.issues.length ? S.issues : [{ id: '', keyword: '', proper_nouns: [] }]
  list.forEach((it, i) => box.appendChild(issueRow(it, i)))
}

$('#addIssue').addEventListener('click', () => {
  $('#issues').appendChild(issueRow({}, $$('.issue').length))
})

async function saveIssues() {
  const issues = $$('.issue').map((el) => ({
    id: $('.i-id', el).value.trim(),
    keyword: $('.i-kw', el).value.trim(),
    proper_nouns: $('.i-pn', el).value.split(',').map((s) => s.trim()).filter(Boolean),
  }))
  const notice = $('#saveNotice')
  try {
    S = await post('/api/issues', {
      issues,
      period: { start: $('#periodStart').value, end: $('#periodEnd').value },
    })
    notice.className = 'note'
    notice.textContent = `저장했습니다 · 이슈 ${S.issues.length}개`
    renderRuns()
    return true
  } catch (err) {
    notice.className = 'note bad'
    notice.textContent = err.message
    return false
  }
}
$('#saveIssues').addEventListener('click', saveIssues)

/* ── 실행 ── */
function keys() {
  return {
    gemini: $('#keyGemini').value.trim(),
    youtube: $('#keyYoutube').value.trim(),
    anthropic: $('#keyAnthropic').value.trim(),
  }
}

function jobBase() {
  return {
    provider,
    model: provider === 'gemini' ? ($('#modelGemini').value || '') : '',
    effort: provider === 'claude_agent' ? $('#effort').value : '',
    keys: keys(),
  }
}

function guard(steps) {
  if (provider === 'gemini' && !keys().gemini && !S.env_keys.gemini) return 'Gemini API 키를 먼저 넣어 주세요.'
  if (provider === 'anthropic' && !keys().anthropic && !S.env_keys.anthropic) return 'Anthropic API 키를 먼저 넣어 주세요.'
  if (provider === 'claude_agent' && !S.claude_cli) return 'claude 명령을 찾지 못했습니다.'
  if (steps.includes('collect_youtube.py') && !keys().youtube && !S.env_keys.youtube) return 'YouTube API 키를 먼저 넣어 주세요.'
  return ''
}

function vocabRuns() { return S.runs.filter((r) => r.has_vocab) }

function renderRuns() {
  const src = vocabRuns()[0]
  $('#runRound').hidden = !src
  $('#roundHint').textContent = src
    ? `‘발산 시작’은 유튜브 댓글부터 다시 모읍니다. 오래 걸립니다. 이미 모아 둔 ${src.run_id} 의 어휘로 이름만 다시 던지려면 오른쪽 버튼을 쓰세요.`
    : ''
  const sel = $('#resultRun')
  const keep = sel.value
  sel.innerHTML = S.runs.map((r) => `<option value="${esc(r.run_id)}">${esc(r.run_id)} · ${r.count}개</option>`).join('')
  if (keep) sel.value = keep
}

function collisionHTML(it) {
  return it.source_word
    ? `<span class="src">${esc(it.source_word)}</span><span class="x">×</span><span class="act">${esc(it.active_word)}</span>`
    : `<span class="found">사람들이 이미 쓰던 말</span>`
}

function pushCands(cands) {
  liveCount += cands.length
  $('#liveCount').textContent = liveCount
  $('#liveEmpty').hidden = true
  const html = cands.slice().reverse().map((c) => `
    <div class="live-item">
      <div class="live-tag">${esc(c.keyword || '')} <span class="live-mech">${esc((c.mech_title || '').replace(/^mech_\d+\s*/, ''))}</span></div>
      <div class="cand-text">${esc(c.candidate)}</div>
      <div class="cand-meta">${collisionHTML(c)}${c.one_line ? `<span class="memo">${esc(c.one_line)}</span>` : ''}</div>
    </div>`).join('')
  $('#liveStream').insertAdjacentHTML('afterbegin', html)
  $$('.live-item', $('#liveStream')).slice(150).forEach((el) => el.remove())
}

function appendLog(lines) {
  if (!lines.length) return
  const box = $('#log')
  const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 24
  box.insertAdjacentHTML('beforeend', lines.map((l) =>
    l.startsWith('### ') ? `<b>${esc(l.slice(4))}</b>` : esc(l) + '\n').join(''))
  if (stick) box.scrollTop = box.scrollHeight
}

async function startRun(payload) {
  const problem = guard(payload.steps)
  if (problem) { $('#settings').showModal(); return alert(problem) }

  Object.assign(payload, jobBase())
  const writing = payload.steps.includes('pick.py')
  $$('.btn.go, #runRound').forEach((b) => (b.disabled = true))
  try {
    const { run_id } = await post('/api/run', payload)
    liveCount = 0
    $('#log').textContent = ''
    if (!writing) {
      $('#liveStream').innerHTML = ''
      $('#liveCount').textContent = '0'
      $('#liveEmpty').hidden = false
      $('#pulse').hidden = false
      $('#runId').textContent = run_id
      $('#liveStep').textContent = '준비 중'
      go('run')
    } else {
      $('#pick').innerHTML = '<div class="empty">고르고 쓰는 중입니다. 몇 분 걸립니다.</div>'
      go('story')
    }
    pollJob(run_id, {
      line: appendLog,
      cands: pushCands,
      step: (s) => ($('#liveStep').textContent = s || '준비 중'),
      done: async () => {
        $('#pulse').hidden = true
        $('#liveStep').textContent = '끝'
        $$('.btn.go, #runRound').forEach((b) => (b.disabled = false))
        S = await api('/api/state')
        renderRuns()
        await loadResult(run_id)
        await loadPick(run_id)
        if (writing) go('story')
        else if ($('#results').children.length) go('cands')
      },
    })
  } catch (err) {
    $$('.btn.go, #runRound').forEach((b) => (b.disabled = false))
    alert(err.message)
  }
}

$('#runFull').addEventListener('click', async () => {
  if (!(await saveIssues())) return
  startRun({ steps: ['collect_youtube.py', 'extract_vocab.py', 'generate.py', 'filter.py'] })
})

$('#runRound').addEventListener('click', async () => {
  const src = vocabRuns()[0]
  if (!src) return
  await saveIssues()
  startRun({ steps: ['generate.py', 'filter.py'], reuse_vocab_from: src.run_id })
})

$('#toCands').addEventListener('click', () => go('cands'))

/* ── ⑤ 후보 ── */
function candHTML(it) {
  const memo = it.one_line ? `<span class="memo">${esc(it.one_line)}</span>` : ''
  return `<div class="cand"><div class="cand-text">${esc(it.candidate)}</div><div class="cand-meta">${collisionHTML(it)}${memo}</div></div>`
}

async function loadResult(runId) {
  const box = $('#results')
  const data = await api('/api/result' + (runId ? '?id=' + encodeURIComponent(runId) : ''))
  $('#resultTitle').textContent = data.total ? `후보 ${data.total}개` : '후보'
  $('#dlMd').href = `/api/download?id=${encodeURIComponent(data.run_id)}&kind=md`
  $('#dlCsv').href = `/api/download?id=${encodeURIComponent(data.run_id)}&kind=csv`
  if (data.run_id) $('#resultRun').value = data.run_id

  if (!data.total) {
    box.innerHTML = '<div class="empty">아직 던진 게 없습니다. 앞 장에서 발산을 시작하세요.</div>'
    return
  }
  box.innerHTML = data.issues.map((iss) => `
    <section class="issue-block">
      <div class="issue-name">${esc(iss.keyword)}<span class="n">${iss.count}개</span></div>
      ${iss.mechs.map((m) => `
        <div class="mech">
          <div class="mech-name">${esc(m.title.replace(/^mech_\d+\s*/, ''))}</div>
          ${m.items.map(candHTML).join('')}
        </div>`).join('')}
    </section>`).join('')
}

$('#resultRun').addEventListener('change', (e) => { loadResult(e.target.value); loadPick(e.target.value) })

/* ── ⑥ 글 ── */
function article(text) {
  return String(text || '').split('\n').map((raw) => {
    const t = raw.trim()
    if (!t) return ''
    if (t.startsWith('## ')) {
      const head = t.slice(3)
      const m = head.match(/^(Chapter\s*\d+)\.\s*(.+)$/i)
      return m ? `<h2><span class="ch">${esc(m[1])}</span>${esc(m[2])}</h2>` : `<h2>${esc(head)}</h2>`
    }
    if (t.startsWith('> ')) return `<blockquote>${esc(t.slice(2))}</blockquote>`
    if (t.startsWith('_')) return `<p class="attrib">${esc(t.slice(1))}</p>`
    return `<p>${esc(t)}</p>`
  }).join('')
}

function briefHTML(b) {
  if (!b || !b.shift) return ''
  const list = (items, key, sub) => (items || []).map((x) =>
    `<li><b>${esc(x[key] || '')}</b><span>${esc(x[sub] || '')}</span></li>`).join('')
  const t = b.target || {}
  return `
    <section class="brief">
      <h2>그래서 우리는</h2>
      <p class="brief-shift">${esc(b.shift)}</p>
      ${(b.sectors || []).length ? `<h3>어디를 볼까</h3><ul class="brief-list">${list(b.sectors, 'name', 'why')}</ul>` : ''}
      ${t.who ? `<h3>누구에게</h3><p class="brief-who"><b>${esc(t.who)}</b><span>${esc(t.tension || '')}</span></p>` : ''}
      ${(b.angles || []).length ? `<h3>어떻게 말 걸까</h3><ul class="brief-list">${list(b.angles, 'line', 'how')}</ul>` : ''}
      ${b.pitch ? `<p class="brief-pitch">${esc(b.pitch)}</p>` : ''}
    </section>`
}

async function loadPick(runId) {
  const box = $('#pick')
  const data = await api('/api/pick' + (runId ? '?id=' + encodeURIComponent(runId) : ''))
  $('#dlPick').href = `/api/download?id=${encodeURIComponent(data.run_id || runId || '')}&kind=pick`
  const best = data.best
  if (!best) {
    box.innerHTML = '<div class="empty">아직 고른 게 없습니다. 후보 장에서 ‘하나 뽑아 글 쓰기’를 누르세요.</div>'
    return
  }
  const lens = data.lens || {}
  const reading = data.reading || {}
  box.innerHTML = `
    <article class="pick">
      <h1 class="pick-word">${esc(best.candidate)}</h1>
      ${lens.person ? `<p class="pick-by">글 <b>${esc(lens.person)}</b>${lens.field ? ' · ' + esc(lens.field) : ''}</p>` : ''}
      ${lens.quote ? `<blockquote class="pick-quote">
        <p>${esc(lens.quote_ko || lens.quote)}</p>
      </blockquote>
      ${lens.quote_ko ? `<p class="pick-orig">${esc(lens.quote)}</p>` : ''}
      ${lens.bridge ? `<p class="pick-bridge">${esc(lens.bridge)}</p>` : '<div style="height:28px"></div>'}` : ''}
      <div class="pick-column">${article(data.column)}</div>
      ${lens.person ? `<p class="pick-disclosure">이 글은 magilite의 ${esc(lens.field || '')} 렌즈로 썼습니다.
        맨 위 인용만 실제 발언이고, 본문은 그 렌즈로 쓴 것입니다.</p>` : ''}
      ${briefHTML(data.brief)}
      <div class="pick-note">
        <h3>왜 이것인가</h3>
        ${article(data.why)}
        ${reading.first ? `<p class="pick-reading">처음엔 「${esc(reading.first)}」, 알고 나면 「${esc(reading.then || '')}」.</p>` : ''}
        <p class="pick-from">${esc(best.issue || '')} · ${esc(best.source_word || '')} × ${esc(best.active_word || '')}</p>
      </div>
      ${(data.runners_up || []).length ? `<div class="pick-note">
        <h3>아깝게 밀린 것</h3>
        ${data.runners_up.map((r) => `<p><b>${esc(r.candidate || '')}</b> — ${esc(r.why || '')}</p>`).join('')}
      </div>` : ''}
    </article>`
}

const writeStory = () => {
  const runId = $('#resultRun').value
  if (!runId) return alert('먼저 발산을 한 번 돌려 주세요.')
  startRun({ steps: ['pick.py'], run_id: runId })
}
$('#runSelect').addEventListener('click', writeStory)
$('#reSelect').addEventListener('click', writeStory)

/* ── 시작 ── */
async function init() {
  S = await api('/api/state')
  $('#keyGemini').value = LS.get('key.gemini')
  $('#keyYoutube').value = LS.get('key.youtube')
  $('#keyAnthropic').value = LS.get('key.anthropic')
  $('#periodStart').value = S.period.start || ''
  $('#periodEnd').value = S.period.end || ''
  $('#effort').value = LS.get('effort', 'medium')
  $('#findStart').value = LS.get('findStart', S.period.start || '')
  $('#findEnd').value = LS.get('findEnd', S.period.end || '')
  selectProvider(LS.get('provider') || S.provider)
  renderEngines()
  renderIssues()
  renderRuns()
  renderFound((S.discover || {}).issues || [])

  const savedMode = LS.get('findMode', 'now')
  $$('#findMode .pick-card').forEach((c) => {
    if (c.dataset.mode === savedMode) c.click()
  })

  await loadResult('')
  await loadPick('')
  // 이미 해 둔 데가 있으면 그 장들을 열어 둔다
  if (S.issues.length && S.issues[0].keyword) reached.add('choose').add('confirm')
  if (S.runs.length) ['run', 'cands', 'story'].forEach((s) => reached.add(s))
  go('find')
}

init().catch((err) => alert(err.message))
