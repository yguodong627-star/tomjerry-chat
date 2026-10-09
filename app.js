'use strict';
/* ===================== characters & personas ===================== */
const COMMON = '\n\n【规则】这是一个给大人和小朋友娱乐的语音聊天小游戏，用户是来家里做客的朋友。请始终保持角色，用简体中文口语回答，每次只说1到3句简短的话，方便朗读。不要使用Markdown、列表、表情符号，不要写动作描写、括号旁白或拟声注释。内容积极健康、适合儿童，不要说自己是AI或语言模型。';
const CHARS = {
  tom: {
    name: '汤姆',
    prompt: '你是汤姆，一只灰蓝色的家猫，白色的嘴巴和肚皮，住在一栋美国老式大房子里。你骄傲、爱面子、满肚子鬼点子，一心想抓住小老鼠杰瑞，可每次都被他耍得团团转，气急败坏时会夸张地大叫“啊——”。你特别害怕住在院子里的斗牛犬斯派克，一提到他就紧张兮兮。你爱吹牛、爱讨好主人、爱偷懒睡觉，偶尔对杰瑞也有一点点友情，但嘴上绝不承认。说话夸张、戏剧化、语速快。' + COMMON,
    greet: '哼哼，我是汤姆！你有没有看见那只讨厌的小老鼠杰瑞？',
    oops: '啊——！我的电话线好像又被杰瑞咬断了！',
    tts: { pitch: 1.05, rate: 1.22, prefer: ['yunxi', 'yunye', 'kangkang', 'yunze', 'yunhao', 'yunfeng', 'yunyang', 'yunjian', 'male', '男'] }
  },
  jerry: {
    name: '杰瑞',
    prompt: '你是杰瑞，一只棕色的小老鼠，有一对又大又圆的耳朵，住在客厅墙角的老鼠洞里。你机灵、调皮、可爱，最爱吃奶酪，总能用聪明点子捉弄笨猫汤姆，看他出糗你就偷笑。你和斗牛犬斯派克是好朋友，被汤姆追急了就躲到斯派克身边。你还有个爱吃东西的小侄子泰菲。说话轻快俏皮、爱笑、带点小得意。' + COMMON,
    greet: '嗨！我是杰瑞！你口袋里是不是藏着奶酪呀？',
    oops: '嘻，出了点小故障，好像奶酪信号不太好！',
    tts: { pitch: 1.75, rate: 1.25, prefer: ['xiaoyi', 'xiaoxiao', 'xiaomeng', 'xiaoshuang', 'yaoyao', 'xiaohan', 'xiaomo', 'huihui', 'tingting', 'meijia', 'female', '女'] }
  },
  spike: {
    name: '斯派克',
    prompt: '你是斯派克，一只灰色的斗牛犬，戴着带尖钉的项圈，住在院子里的狗屋。你外表凶巴巴，嗓音低沉，说话粗声粗气、简短有力，但心地善良、讲义气。你是儿子泰克（一只小斗牛犬）的好爸爸，非常护着他，常教他怎么做一只勇敢的狗。你最烦汤姆来打扰你和泰克睡午觉，常警告他“别让我再看见你”。你和杰瑞关系不错。偶尔会称呼对方“伙计”。' + COMMON,
    greet: '我是斯派克。小点声，我儿子泰克在睡觉。有什么事，伙计？',
    oops: '嗯？线路出毛病了，伙计。',
    tts: { pitch: 0.35, rate: 0.85, prefer: ['yunjian', 'yunyang', 'yunze', 'yunfeng', 'kangkang', 'yunxi', 'male', '男'] }
  }
};
const ORDER = ['tom', 'jerry', 'spike'];
const DEF = { base: 'https://aihubmix.com/v1', model: 'gpt-4o-mini' };
const LS = { cfg: 'tjchat_cfg', hist: 'tjchat_hist', cur: 'tjchat_cur', mode: 'tjchat_mode', models: 'tjchat_models' };

const $ = s => document.querySelector(s);
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

let cfg = Object.assign({}, DEF, lsGet(LS.cfg, {}));
let hist = lsGet(LS.hist, null) || {};
ORDER.forEach(id => { if (!Array.isArray(hist[id])) hist[id] = []; hist[id] = hist[id].filter(m => m && (m.content || m.error)).map(m => (delete m.pending, m)).slice(-200); });
let cur = lsGet(LS.cur, 'tom'); if (!ORDER.includes(cur)) cur = 'tom';
let mode = lsGet(LS.mode, 'voice');
const saveHist = () => lsSet(LS.hist, hist);

/* ===================== helpers ===================== */
let toastT = 0;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// bubble text: show *actions* / (actions) in italics
function fmt(s) {
  return esc(s).replace(/\*{1,2}([^*\n]+?)\*{1,2}/g, '<i>$1</i>').replace(/（[^（）]*）|\([^()]*\)|【[^【】]*】|\[[^\[\]]*\]/g, m => '<i>' + m + '</i>');
}
// spoken text: strip actions, markdown, emoji, speaker prefixes
function cleanForTTS(s) {
  return String(s)
    .replace(/\*[^*]*\*/g, ' ').replace(/（[^（）]*）|\([^()]*\)|【[^【】]*】|\[[^\[\]]*\]|〔[^〕]*〕/g, ' ')
    .replace(/^\s*(汤姆|杰瑞|斯派克|Tom|Jerry|Spike)\s*[:：]/i, '')
    .replace(/[#*_`>|~～]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ').trim();
}
const hasSpeakable = s => /[\p{L}\p{N}]/u.test(s);

/* ===================== TTS (speechSynthesis) ===================== */
const TTS = {
  ok: 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
  voices: [], map: {}, q: [], busy: false, gen: 0, keep: [], ka: 0, wd: 0, simT: 0, fails: 0, unlocked: false,
  init() {
    if (!this.ok) return;
    const load = () => { const n0 = this.voices.length; try { this.voices = speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; } if (this.voices.length !== n0) this.fails = 0; this.assign(); };
    load();
    try { speechSynthesis.addEventListener('voiceschanged', load); } catch (e) { speechSynthesis.onvoiceschanged = load; }
    let n = 0; const poll = setInterval(() => { if (this.voices.length || ++n > 20) clearInterval(poll); else load(); }, 250); // voices load async
  },
  assign() { // pick different Chinese voices per character when possible
    const zh = this.voices.filter(v => /^zh/i.test(v.lang) || /chinese|普通话|中文|國語/i.test(v.name));
    const rank = v => (/zh[-_]CN/i.test(v.lang) || /普通话|mandarin/i.test(v.name)) ? 0 : /zh[-_]TW/i.test(v.lang) ? 1 : 2;
    zh.sort((a, b) => rank(a) - rank(b));
    const cn = zh.filter(v => rank(v) === 0);
    const pool = cn.length ? cn : zh;
    const used = new Set(); this.map = {};
    ['spike', 'jerry', 'tom'].forEach(id => {
      let pick = null;
      for (const p of CHARS[id].tts.prefer) { pick = pool.find(v => !used.has(v) && v.name.toLowerCase().includes(p)); if (pick) break; }
      if (!pick) pick = pool.find(v => !used.has(v)) || pool[0] || null;
      if (pick) used.add(pick);
      this.map[id] = pick;
    });
  },
  unlock() { // must run inside a user gesture (Chrome autoplay policy)
    if (!this.ok || this.unlocked) return; this.unlocked = true;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  },
  split(text) { // keep utterances short (Chrome cuts long ones at ~15s)
    const out = []; let s = text;
    while (s.length > 48) { let i = -1; for (const c of ['，', ',', '、', ' ']) { const j = s.lastIndexOf(c, 44); if (j > 10) { i = j; break; } } if (i < 0) i = 44; out.push(s.slice(0, i + 1)); s = s.slice(i + 1); }
    if (s.trim()) out.push(s); return out;
  },
  say(text, cid) {
    const t = cleanForTTS(text); if (!t || !hasSpeakable(t)) return;
    this.split(t).forEach(p => this.q.push({ text: p, cid }));
    this.next();
  },
  dur(it) { return Math.min(9000, 400 + it.text.length * 240 / CHARS[it.cid].tts.rate); },
  simulate(it) { // no working audio engine: still animate the mouth for an estimated duration
    const g = this.gen; this.busy = true; setTalking(it.cid);
    clearTimeout(this.simT); this.simT = setTimeout(() => { if (g !== this.gen) return; this.busy = false; this.next(); }, this.dur(it));
  },
  next() {
    if (this.busy) return;
    const it = this.q.shift();
    if (!it) { setTalking(null); return; }
    if (!this.ok || this.fails >= 2) return this.simulate(it);
    this.busy = true; const g = this.gen;
    const ch = CHARS[it.cid].tts; const v = this.map[it.cid];
    const u = new SpeechSynthesisUtterance(it.text);
    u.lang = v ? v.lang : 'zh-CN'; if (v) u.voice = v;
    u.pitch = ch.pitch; u.rate = ch.rate; u.volume = 1;
    let started = false;
    const begin = () => { if (g !== this.gen || started) return; started = true; this.fails = 0; setTalking(it.cid); };
    const done = () => { if (g !== this.gen) return; clearTimeout(this.wd); clearInterval(this.ka); this.busy = false; this.keep = this.keep.filter(x => x !== u); this.next(); };
    u.onstart = begin; u.onboundary = begin;
    u.onend = done;
    u.onerror = e => {
      const real = e && e.error && !/interrupted|canceled/.test(e.error);
      if (real) console.warn('TTS error:', e.error);
      if (real && !started && g === this.gen) { // engine failed (no voice etc.) → still animate the mouth
        clearTimeout(this.wd); clearInterval(this.ka); this.fails++; this.keep = this.keep.filter(x => x !== u); this.busy = false; return this.simulate(it);
      }
      done();
    };
    this.keep.push(u); // keep a reference: Chrome may GC the utterance and drop onend
    try { if (speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { this.busy = false; return this.simulate(it); }
    // watchdog: engine stuck / never starts → fall back to simulated talking
    clearTimeout(this.wd);
    this.wd = setTimeout(() => { if (g !== this.gen || started) return; this.fails++; this.gen++; try { speechSynthesis.cancel(); } catch (e) {} this.busy = false; this.simulate(it); }, 3000 + it.text.length * 80);
    // keep-alive for Chrome network voices (they silently stop after ~15s)
    clearInterval(this.ka);
    if (v && v.localService === false) this.ka = setInterval(() => { if (g !== this.gen || !this.busy) return clearInterval(this.ka); if (speechSynthesis.speaking) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 9000);
  },
  stop() {
    this.gen++; this.q = []; this.busy = false; this.keep = []; clearTimeout(this.wd); clearTimeout(this.simT); clearInterval(this.ka);
    if (this.ok) { try { speechSynthesis.cancel(); } catch (e) {} }
    setTalking(null);
  }
};
/* lip flap: several mouth-openness frames (data-mo 0..3) cycled while talking */
const Lips = {
  timer: 0, forced: null, last: 0,
  frame(el) {
    if (this.forced != null) { el.dataset.mo = this.forced; return; }
    // syllable-like pattern: mostly mid/wide, short closures between "syllables"
    const r = Math.random(); let n;
    if (this.last === 0) n = r < .55 ? 2 : (r < .85 ? 3 : 1);
    else if (this.last === 3) n = r < .5 ? 2 : (r < .8 ? 1 : 0);
    else n = r < .3 ? 0 : (r < .55 ? 1 : (r < .8 ? 3 : 2));
    if (n === this.last) n = n ? n - 1 : 2;
    this.last = n; el.dataset.mo = n;
  },
  start(el) {
    this.stop(); const tick = () => { this.frame(el); this.timer = setTimeout(tick, 70 + Math.random() * 70); }; tick();
  },
  stop() { clearTimeout(this.timer); this.timer = 0; this.last = 0; document.querySelectorAll('.char').forEach(el => { el.dataset.mo = 0; }); }
};
function setTalking(cid) {
  let talker = null;
  document.querySelectorAll('.char').forEach(el => {
    const on = !!cid && el.dataset.id === cid && cid === cur;
    el.classList.toggle('talking', on); if (on) talker = el;
  });
  if (talker) { if (!Lips.timer || Lips.el !== talker) { Lips.el = talker; Lips.start(talker); } }
  else { Lips.el = null; Lips.stop(); }
}
function setThinking(cid, on) { const el = document.querySelector('.char[data-id="' + cid + '"]'); if (el) el.classList.toggle('thinking', on); }

/* streaming text → sentences → TTS queue (low latency) */
class Speaker {
  constructor(cid) { this.cid = cid; this.buf = ''; this.muted = false; }
  push(t) {
    this.buf += t;
    for (;;) {
      const b = this.buf; let cut = -1;
      const m = b.match(/[。！？!?；;\n…]+[”"’」』）)]*/);
      if (m && this.balanced(b.slice(0, m.index))) cut = m.index + m[0].length;
      else if (b.length > 26) { const j = Math.max(b.lastIndexOf('，'), b.lastIndexOf(',')); if (j > 8 && this.balanced(b.slice(0, j))) cut = j + 1; }
      if (cut < 0) break;
      this.emit(b.slice(0, cut)); this.buf = b.slice(cut);
    }
  }
  balanced(s) { return (s.split('*').length - 1) % 2 === 0 && (s.match(/[（(【\[]/g) || []).length <= (s.match(/[）)】\]]/g) || []).length; }
  flush() { if (this.buf.trim()) this.emit(this.buf); this.buf = ''; }
  emit(s) { if (!this.muted) TTS.say(s, this.cid); }
}

/* ===================== rendering ===================== */
let rafR = 0;
function render(now) {
  if (!now) { if (!rafR) rafR = requestAnimationFrame(() => { rafR = 0; render(true); }); return; }
  const box = $('#talk'); const items = hist[cur].slice(-6);
  let html = '';
  if (!items.length) html = `<div class="b ai cur">${fmt(CHARS[cur].greet)}</div>`;
  const last = items.length - 1;
  items.forEach((m, i) => {
    const isCur = i === last && m.role === 'assistant';
    const old = i !== last && !(i === last - 1 && m.role === 'user' && items[last].role === 'assistant');
    if (m.role === 'user') html += `<div class="b user${old ? ' old' : ''}">${esc(m.content)}</div>`;
    else {
      let inner = m.content ? fmt(m.content) : (m.pending ? '<span class="dots"><span></span><span></span><span></span></span>' : '');
      if (m.error && m.detail) inner += `<span class="det">${esc(m.detail)}</span>`;
      html += `<div class="b ai${isCur ? ' cur' : ''}${old ? ' old' : ''}${m.error ? ' err' : ''}">${inner}</div>`;
    }
  });
  if (box.innerHTML !== html) {
    const key = cur + ':' + hist[cur].length; // only pop-animate when a new bubble appears
    box.innerHTML = html;
    const n = box.querySelector('.b.ai.cur');
    if (n && key === render.key) n.style.animation = 'none';
    render.key = key;
  }
}

/* ===================== character switching ===================== */
let switching = false;
function showChar(id, dir) {
  document.querySelectorAll('.char').forEach(el => {
    el.classList.remove('enter', 'leave', 'rev', 'talking', 'thinking'); el.dataset.mo = 0;
    if (el.dataset.id === id) { el.classList.add('show'); if (dir) { el.classList.add('enter'); if (dir < 0) el.classList.add('rev'); } }
    else if (el.classList.contains('show') && dir) { el.classList.remove('show'); el.classList.add('leave'); if (dir < 0) el.classList.add('rev'); setTimeout(() => el.classList.remove('leave', 'rev'), 420); }
    else el.classList.remove('show');
  });
  document.body.dataset.cur = id;
  const tag = $('#nametag'); tag.textContent = CHARS[id].name; tag.classList.remove('pop'); void tag.offsetWidth; tag.classList.add('pop');
  if (active && active.cid === id && active.msg.pending && !active.msg.content) setThinking(id, true);
}
function switchChar(dir = 1) {
  if (switching) return; switching = true; setTimeout(() => switching = false, 450);
  TTS.unlock(); TTS.stop();
  if (active) active.speaker.muted = true; // reply keeps streaming into that character's history, silently
  if (recState.active) stopRec(true);
  cur = ORDER[(ORDER.indexOf(cur) + dir + ORDER.length) % ORDER.length]; lsSet(LS.cur, cur);
  const talk = $('#talk'); talk.classList.add('fade');
  showChar(cur, dir);
  setTimeout(() => { render(true); talk.classList.remove('fade'); }, 260);
  const me = cur;
  if (!hist[cur].length) setTimeout(() => { if (cur === me && !recState.active && !active) TTS.say(CHARS[me].greet, me); }, 520);
}

/* ===================== chat API (OpenAI-compatible, streaming SSE) ===================== */
let active = null; // { ctrl, cid, msg, speaker }
function endpoint() {
  const b = (cfg.base || DEF.base).trim().replace(/\/+$/, '');
  return /\/chat\/completions$/.test(b) ? b : b + '/chat/completions';
}
async function send(text) {
  text = String(text || '').trim(); if (!text) return;
  if (!cfg.key) { openSetup(); toast('请先填写 API Key'); return; }
  TTS.unlock(); TTS.stop();
  const cid = cur;
  if (active) { if (active.cid === cid) { try { active.ctrl.abort(); } catch (e) {} } else active.speaker.muted = true; }
  const h = hist[cid];
  const ctx = h.filter(m => !m.error && !m.pending && m.content).slice(-20).map(m => ({ role: m.role, content: m.content }));
  h.push({ role: 'user', content: text });
  const msg = { role: 'assistant', content: '', pending: true }; h.push(msg);
  saveHist(); render(true);
  const ctrl = new AbortController(); const speaker = new Speaker(cid);
  const me = { ctrl, cid, msg, speaker }; active = me;
  setThinking(cid, true);
  const noAudio = !TTS.ok;
  try {
    const model = cfg.model || DEF.model;
    const doFetch = minimal => fetch(endpoint(), {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify(Object.assign({ model, stream: true }, minimal ? {} : { temperature: 0.9 },
        { messages: [{ role: 'system', content: CHARS[cid].prompt }, ...ctx, { role: 'user', content: text }] }))
    });
    let res = await doFetch(false), body = '';
    if (!res.ok) {
      try { body = await res.text(); } catch (e) {}
      // some models (e.g. reasoning models) reject temperature → retry once with a minimal body
      if (res.status === 400 && /temperature|unsupported|not support/i.test(body)) { res = await doFetch(true); body = ''; if (!res.ok) { try { body = await res.text(); } catch (e) {} } }
    }
    if (!res.ok) {
      let detail = body; try { const j = JSON.parse(body); detail = (j.error && (j.error.message || j.error)) || j.message || body; } catch (e) {}
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
      const err = new Error(`HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''}${detail ? '：' + detail.slice(0, 300) : ''}`);
      err.status = res.status; throw err;
    }
    const onDelta = d => {
      if (!d) return;
      if (!msg.content) setThinking(cid, false);
      msg.content += d; speaker.push(d);
      if (noAudio && cid === cur) setTalking(cid);
      if (cid === cur) render();
    };
    const ct = res.headers.get('content-type') || '';
    if (!res.body || /application\/json/i.test(ct)) { // server ignored stream:true
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      onDelta((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '');
    } else {
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''; let fin = false;
      while (!fin) {
        const r = await reader.read(); if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, ''); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') { fin = true; break; }
          let j; try { j = JSON.parse(data); } catch (e) { continue; }
          if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
          const c = j.choices && j.choices[0];
          if (c) onDelta((c.delta && c.delta.content) || (c.message && c.message.content) || '');
        }
      }
      try { reader.cancel(); } catch (e) {}
    }
    speaker.flush();
    if (!msg.content) throw new Error('模型没有返回任何内容（请检查模型名称是否正确）');
  } catch (e) {
    if (e.name === 'AbortError') { if (!msg.content) { const k = h.indexOf(msg); if (k >= 0) h.splice(k, 1); } }
    else {
      let detail = e.message || String(e);
      if (/Failed to fetch|NetworkError|Load failed/i.test(detail)) detail += '\n（网络不通、地址写错，或接口不允许跨域访问）';
      if (/model|模型/i.test(detail) && /not|exist|found|invalid|不存在|无效|support/i.test(detail)) detail += '\n（模型「' + (cfg.model || DEF.model) + '」可能不可用：点左上角模型名换一个试试）';
      if (e.status === 401 || e.status === 403 || /invalid.*key|unauthori|api key/i.test(detail)) detail += '\n（API Key 可能不正确：双击左上角标题或点右上角小齿轮重新设置）';
      const friendly = CHARS[cid].oops;
      msg.error = true; msg.content = (msg.content ? msg.content + '\n' : '') + friendly; msg.detail = detail;
      if (!speaker.muted && cid === cur) TTS.say(friendly, cid);
    }
  } finally {
    delete msg.pending; setThinking(cid, false);
    if (active === me) active = null;
    if (noAudio) setTimeout(() => { if (!active) setTalking(null); }, 900);
    saveHist(); if (cid === cur) render(true);
  }
}

/* ===================== speech recognition (press & hold) ===================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let recState = { active: false };
const CANCEL_DY = 70;
function recUI() {
  const st = recState, r = $('#rec'), hold = $('#hold'), live = st.active && !st.released;
  r.classList.toggle('show', !!live); r.classList.toggle('cancel', !!st.cancelling);
  hold.classList.toggle('on', !!live); hold.classList.toggle('cancel', !!(live && st.cancelling));
  hold.textContent = live ? (st.cancelling ? '松开 取消' : '松开 发送') : '按住 说话';
  $('#recHint').textContent = st.cancelling ? '松开手指，取消发送' : (st.viaKey ? '松开空格 发送 · Esc 取消' : '松开 发送 · 上滑 取消');
  const f = esc(st.final || ''), i = esc(st.interim || '');
  $('#recText').innerHTML = (f || i) ? f + '<span class="int">' + i + '</span>' : '<span class="int">正在聆听，请说话…</span>';
}
function startRec(y, viaKey) {
  if (recState.active) return;
  TTS.unlock(); TTS.stop();
  if (active) active.speaker.muted = true;
  if (!SR) { toast('当前浏览器不支持语音识别，已切换为文字输入（推荐使用 Chrome 或 Edge）', 4000); setMode('text'); return; }
  const st = recState = { active: true, released: false, cancelling: false, final: '', interim: '', startY: y || 0, viaKey: !!viaKey, ended: false, done: false, error: null, t0: Date.now() };
  try {
    rec = new SR(); rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => { if (st !== recState) return; let f = '', i = ''; for (let k = 0; k < e.results.length; k++) { const r = e.results[k]; if (r.isFinal) f += r[0].transcript; else i += r[0].transcript; } st.final = f; st.interim = i; recUI(); };
    rec.onerror = e => { st.error = e.error || 'error'; if (/not-allowed|service-not-allowed|audio-capture|network/.test(st.error)) { st.released = true; st.cancelling = true; finishRec(st); } };
    rec.onend = () => { st.ended = true; if (st.released) finishRec(st); };
    rec.start();
  } catch (err) { st.error = String(err.message || err); st.released = true; st.cancelling = true; finishRec(st); return; }
  recUI();
}
function stopRec(cancel) {
  const st = recState; if (!st.active || st.released) return;
  st.released = true; if (cancel) st.cancelling = true;
  if (!cancel && Date.now() - st.t0 < 300 && !st.final && !st.interim) { st.cancelling = true; st.short = true; }
  recUI();
  try { st.cancelling ? rec.abort() : rec.stop(); } catch (e) {}
  if (st.ended) finishRec(st);
  setTimeout(() => finishRec(st), 2500); // safety net if onend never fires
}
function finishRec(st) {
  if (st.done) return; st.done = true; st.active = false; recUI();
  const E = st.error;
  if (E === 'not-allowed' || E === 'service-not-allowed') return toast('麦克风权限被拒绝：请点地址栏左侧图标允许麦克风，或点左下角按钮改用文字输入', 5000);
  if (E === 'audio-capture') return toast('没有找到可用的麦克风', 3500);
  if (E === 'network') return toast('语音识别需要联网（Chrome 使用在线识别服务）', 4000);
  if (st.short) return toast('请按住按钮说话，说完再松开哦', 2200);
  if (st.cancelling) { if (E && !/aborted|no-speech/.test(E)) toast('语音识别出错：' + E); return; }
  const text = (st.final + st.interim).trim();
  if (text) send(text);
  else toast(!E || E === 'no-speech' ? '没有听清，再说一次吧～' : '语音识别出错：' + E, 2500);
}

/* ===================== input mode ===================== */
const ICON_KB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12.5" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M18 13.5h.01M8.5 15.5h7"/></svg>';
const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
function setMode(m) {
  mode = m; lsSet(LS.mode, m);
  document.body.classList.toggle('textmode', m === 'text');
  $('#modeBtn').innerHTML = m === 'text' ? ICON_MIC : ICON_KB;
  $('#modeBtn').title = m === 'text' ? '按住说话' : '输入文本';
  if (m === 'text' && !$('#setup').classList.contains('show')) setTimeout(() => $('#txt').focus(), 30);
}

/* ===================== setup overlay ===================== */
function openSetup() {
  $('#cfgBase').value = cfg.base || DEF.base; $('#cfgKey').value = cfg.key || ''; $('#cfgModel').value = cfg.model || DEF.model;
  const has = !!cfg.key; $('#setupClose').style.display = has ? '' : 'none'; $('#setupExtra').style.display = has ? '' : 'none';
  $('#setup').classList.add('show'); setTimeout(() => (has ? $('#cfgModel') : $('#cfgKey')).focus(), 50);
}
function closeSetup() { $('#setup').classList.remove('show'); if (picker.open) closePicker(); }

/* ===================== wiring ===================== */
function bind() {
  const hold = $('#hold');
  hold.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); try { hold.setPointerCapture(e.pointerId); } catch (x) {} startRec(e.clientY); });
  hold.addEventListener('pointermove', e => { const st = recState; if (!st.active || st.released || st.viaKey) return; const c = st.startY - e.clientY > CANCEL_DY; if (c !== st.cancelling) { st.cancelling = c; recUI(); } });
  hold.addEventListener('pointerup', () => { if (!recState.viaKey) stopRec(!!recState.cancelling); });
  hold.addEventListener('pointercancel', () => { if (!recState.viaKey) stopRec(true); });
  hold.addEventListener('contextmenu', e => e.preventDefault());
  hold.addEventListener('keydown', e => { if (e.code === 'Enter') e.preventDefault(); });
  window.addEventListener('keydown', e => {
    if ($('#setup').classList.contains('show') || picker.open) return;
    const tag = (e.target && e.target.tagName) || '';
    if (e.code === 'Space' && mode === 'voice' && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); if (!e.repeat) startRec(0, true); }
    if (e.key === 'Escape' && recState.active) stopRec(true);
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space' && recState.active && recState.viaKey) { e.preventDefault(); stopRec(!!recState.cancelling); } });
  window.addEventListener('blur', () => { if (recState.active && !recState.released) stopRec(true); });

  $('#modeBtn').addEventListener('click', () => { TTS.unlock(); setMode(mode === 'text' ? 'voice' : 'text'); });
  const txt = $('#txt'), sb = $('#sendBtn');
  const upd = () => sb.classList.toggle('show', !!txt.value.trim());
  const go = () => { const v = txt.value; if (!v.trim()) return; txt.value = ''; upd(); send(v); };
  txt.addEventListener('input', upd);
  txt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); go(); } });
  sb.addEventListener('click', () => { go(); txt.focus(); });
  $('#swap').addEventListener('click', () => switchChar(1));

  const title = $('#title'); let lp = 0;
  title.addEventListener('dblclick', openSetup);
  title.addEventListener('pointerdown', () => { clearTimeout(lp); lp = setTimeout(openSetup, 800); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => title.addEventListener(ev, () => clearTimeout(lp)));
  $('#gear').addEventListener('click', openSetup);
  $('#eyeBtn').addEventListener('click', () => { const k = $('#cfgKey'); const s = k.type === 'password'; k.type = s ? 'text' : 'password'; $('#eyeBtn').textContent = s ? '隐藏' : '显示'; });
  $('#setupClose').addEventListener('click', closeSetup);
  $('#setupSave').addEventListener('click', () => {
    const base = $('#cfgBase').value.trim() || DEF.base, key = $('#cfgKey').value.trim(), model = $('#cfgModel').value.trim() || DEF.model;
    if (!key) { toast('请填写 API Key'); $('#cfgKey').focus(); return; }
    if (!/^https?:\/\//i.test(base)) { toast('API 地址需要以 http:// 或 https:// 开头'); return; }
    cfg = { base, key, model }; lsSet(LS.cfg, cfg); closeSetup(); updateChip(); TTS.unlock();
    toast(mode === 'voice' ? '已保存！按住按钮（或空格键）说话吧～' : '已保存！输入文字聊天吧～');
  });
  $('#setup').addEventListener('keydown', e => { if (e.key === 'Enter') $('#setupSave').click(); if (e.key === 'Escape' && cfg.key) closeSetup(); });
  $('#clearCur').addEventListener('click', () => { if (active && active.cid === cur) active.ctrl.abort(); hist[cur] = []; saveHist(); render(true); toast('已清空' + CHARS[cur].name + '的聊天记录'); });
  $('#clearAll').addEventListener('click', () => { if (active) active.ctrl.abort(); ORDER.forEach(id => hist[id] = []); saveHist(); render(true); toast('已清空全部聊天记录'); });
  window.addEventListener('pointerdown', () => TTS.unlock(), { capture: true });
}


/* ===================== model picker ===================== */
const PRESET = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-5.4-mini', 'gpt-4o', 'claude-haiku-4-5', 'claude-sonnet-4-5', 'gemini-2.5-flash', 'gemini-3.5-flash',
  'deepseek-v4-flash', 'deepseek-v3.2', 'qwen3.7-flash', 'kimi-k2.6', 'glm-5.1', 'doubao-seed-2-0-mini', 'grok-4-1-fast-non-reasoning'];
const baseOf = b => String(b || DEF.base).trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
const Models = {
  cache: {}, err: null, loading: null,
  get(base) { return this.cache[base] || null; },
  load(base, key, force) {
    if (!force && this.cache[base]) return Promise.resolve();
    if (!force) { const c = lsGet(LS.models, null); if (c && c.base === base && Date.now() - c.ts < 864e5 && Array.isArray(c.ids) && c.ids.length) { this.cache[base] = c.ids; return Promise.resolve(); } }
    if (this.loading) return this.loading;
    this.err = null;
    this.loading = (async () => {
      try {
        const r = await fetch(base + '/models', { headers: key ? { Authorization: 'Bearer ' + key } : {} });
        if (!r.ok) { let t = ''; try { t = (await r.text()).slice(0, 120); } catch (e) {} throw new Error('HTTP ' + r.status + (t ? ' ' + t : '')); }
        const j = await r.json();
        const arr = (Array.isArray(j) ? j : (j.data || j.models || [])).map(m => typeof m === 'string' ? m : (m && (m.id || m.name))).filter(Boolean);
        if (!arr.length) throw new Error('返回的列表为空');
        this.cache[base] = [...new Set(arr)];
        lsSet(LS.models, { base, ts: Date.now(), ids: this.cache[base] });
      } catch (e) { this.err = e.message || String(e); }
      finally { this.loading = null; }
    })();
    return this.loading;
  }
};
let picker = { open: false };
function updateChip() { $('#modelName').textContent = cfg.model || DEF.model; $('#modelChip').title = '当前模型：' + (cfg.model || DEF.model) + '（点击切换）'; }
function openPicker(anchor, opts) {
  picker = Object.assign({ open: true, hl: 0, items: [], anchor }, opts);
  const el = $('#mpick'); el.classList.add('show');
  const r = anchor.getBoundingClientRect(); const w = Math.min(360, innerWidth * 0.92);
  el.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + 'px';
  el.style.top = (r.bottom + 6) + 'px';
  el.style.maxHeight = Math.max(220, Math.min(innerHeight * 0.72, innerHeight - r.bottom - 16)) + 'px';
  $('#mpQ').value = ''; renderPicker(); setTimeout(() => $('#mpQ').focus(), 20);
  loadModels(false);
}
function closePicker() { picker.open = false; $('#mpick').classList.remove('show'); }
function loadModels(force) { const p = Models.load(picker.base, picker.key, force); renderPicker(); p.then(() => { if (picker.open) renderPicker(); }); }
function renderPicker() {
  const q = $('#mpQ').value.trim(), ql = q.toLowerCase();
  const ids = Models.get(picker.base); const all = ids || [];
  const rec = ids ? PRESET.filter(p => ids.includes(p)) : PRESET;
  const items = []; let html = '';
  const add = (id, label, cls) => { items.push(id); html += `<div class="mp-it${cls || ''}${id === picker.current && !cls ? ' sel' : ''}" data-i="${items.length - 1}">${label || esc(id)}</div>`; };
  const recF = rec.filter(id => id.toLowerCase().includes(ql));
  if (recF.length) { html += `<div class="mp-sec">推荐（适合聊天、响应快）</div>`; recF.forEach(id => add(id)); }
  if (ids) {
    const rest = all.filter(id => !rec.includes(id) && id.toLowerCase().includes(ql)).sort((a, b) => a.localeCompare(b));
    if (rest.length) { html += `<div class="mp-sec">全部模型（${rest.length}）</div>`; rest.slice(0, 800).forEach(id => add(id)); }
  }
  if (q && !all.includes(q) && !rec.includes(q)) { html += `<div class="mp-sec">${items.length ? '找不到想要的？' : '列表里没有这个模型'}</div>`; add(q, '使用自定义模型：<b>' + esc(q) + '</b>', ' custom'); }
  picker.items = items; picker.hl = Math.max(0, Math.min(picker.hl, items.length - 1));
  $('#mpList').innerHTML = html; hlPicker(false);
  $('#mpFoot').textContent = Models.loading ? '正在获取模型列表…' :
    Models.err && !ids ? '获取模型列表失败（' + Models.err + '），先显示常用预设；也可直接输入模型 ID 回车' :
    `共 ${all.length} 个可用模型 · 也可直接输入任意模型 ID 回车`;
}
function hlPicker(scroll) {
  document.querySelectorAll('#mpList .mp-it').forEach(el => el.classList.toggle('hl', +el.dataset.i === picker.hl));
  if (scroll) { const el = document.querySelector('#mpList .mp-it.hl'); if (el) el.scrollIntoView({ block: 'nearest' }); }
}
function choose(id) { id = String(id || '').trim(); if (!id) return; const cb = picker.onPick; closePicker(); cb && cb(id); }
function bindPicker() {
  $('#modelChip').addEventListener('click', () => {
    if (picker.open) return closePicker();
    openPicker($('#modelChip'), { base: baseOf(cfg.base), key: cfg.key, current: cfg.model || DEF.model,
      onPick: id => { cfg.model = id; lsSet(LS.cfg, cfg); updateChip(); toast('已切换模型：' + id); } });
  });
  $('#cfgModelPick').addEventListener('click', () => {
    if (picker.open) return closePicker();
    openPicker($('#cfgModel'), { base: baseOf($('#cfgBase').value), key: $('#cfgKey').value.trim(), current: $('#cfgModel').value.trim(),
      onPick: id => { $('#cfgModel').value = id; } });
  });
  $('#mpQ').addEventListener('input', () => { picker.hl = 0; renderPicker(); $('#mpList').scrollTop = 0; });
  $('#mpQ').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') { e.preventDefault(); picker.hl = Math.min(picker.items.length - 1, picker.hl + 1); hlPicker(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); picker.hl = Math.max(0, picker.hl - 1); hlPicker(true); }
    else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); choose(picker.items[picker.hl] || $('#mpQ').value); }
    else if (e.key === 'Escape') { e.preventDefault(); closePicker(); }
  });
  $('#mpList').addEventListener('click', e => { const it = e.target.closest('.mp-it'); if (it) choose(picker.items[+it.dataset.i]); });
  $('#mpRefresh').addEventListener('click', () => loadModels(true));
  document.addEventListener('pointerdown', e => {
    if (!picker.open) return;
    if (e.target.closest('#mpick') || e.target.closest('#modelChip') || e.target.closest('#cfgModelPick')) return;
    closePicker();
  }, true);
  window.addEventListener('resize', () => { if (picker.open) closePicker(); });
  window.addEventListener('keydown', e => { if (picker.open && e.key === 'Escape') { e.preventDefault(); closePicker(); } }, true);
}

/* ===================== boot ===================== */
(function boot() {
  let w = ''; for (let i = 0; i < 9; i++) w += `<i style="animation-delay:${(i * 0.09).toFixed(2)}s"></i>`; $('#wave').innerHTML = w;
  bind(); bindPicker(); updateChip(); TTS.init();
  setMode(SR ? mode : 'text');
  showChar(cur, 0); render(true);
  if (!cfg.key) openSetup();
  else if (!SR) setTimeout(() => toast('当前浏览器不支持语音识别，已使用文字输入（推荐 Chrome / Edge）', 4000), 600);
})();
window.__tj = { get cur() { return cur; }, get rs() { return recState; }, hist, TTS, switchChar, send, setTalking, Lips, freezeMouth(n) { Lips.forced = n; if (Lips.el && n != null) Lips.el.dataset.mo = n; } }; // debug/test hook
