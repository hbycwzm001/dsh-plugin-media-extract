window.__ModuleLoader__.load({
  id: 'dsh-plugin-media-extract',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    const NS = 'mediaExtract';
    const copyToClipboard = (text) => new Promise((res, rej) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(res, rej);
          return;
        }
      } catch (e) { /* 落到下面 */ }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? res() : rej(new Error('copy failed'));
      } catch (e) { rej(e); }
    });

    const ZH = {
      tab: '解析',
      placeholder: '粘贴链接：抖音 / 小红书 / TikTok / YouTube / Facebook / X / Instagram',
      go: '解析',
      again: '再解析一条',
      busy: '正在解析…',
      transcribe: '转写语音',
      video: '视频',
      images: '图片',
      caption: '文案',
      title: '标题',
      text: '转写',
      noSpeech: '（未检测到人声，或这条视频没有语音）',
      copy: '复制',
      copied: '已复制',
      files: '本地文件',
      open: '打开位置',
      clear: '清空',
      download: '下载到…',
      saved: '已保存',
      folder: '所在文件夹',
      hint: '支持的平台：抖音、小红书、TikTok、YouTube、Facebook、X(Twitter)、Instagram。粘整段分享文案也可以。',
      failed: '解析失败',
      playFail: '视频加载失败',
      loading: '正在读取文件…',
    };
    const EN = {
      tab: 'Extract',
      placeholder: 'Paste a link: Douyin / Xiaohongshu / TikTok / YouTube / Facebook / X / Instagram',
      go: 'Extract',
      again: 'Extract another',
      busy: 'Extracting…',
      transcribe: 'Transcribe audio',
      video: 'Video',
      images: 'Images',
      caption: 'Caption',
      title: 'Title',
      text: 'Transcript',
      noSpeech: '(no speech detected in this video)',
      copy: 'Copy',
      copied: 'Copied',
      files: 'Local files',
      open: 'Show in folder',
      clear: 'Clear',
      download: 'Save as…',
      saved: 'Saved',
      folder: 'Folder',
      hint: 'Supports Douyin, Xiaohongshu, TikTok, YouTube, Facebook, X (Twitter) and Instagram. Pasting the whole share text works too.',
      failed: 'Extraction failed',
      playFail: 'Video failed to load',
      loading: 'Reading file…',
    };

    const INK = '#1a1a1a';
    const MUTED = '#6b7280';
    const LINE = '#e5e7eb';
    const SOFT = '#f6f7f9';

    const S = {
      wrap: {
        display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px',
        height: '100%', overflowY: 'auto', boxSizing: 'border-box',
        font: 'inherit', color: INK, background: '#ffffff',
      },
      row: { display: 'flex', gap: '10px', alignItems: 'center' },
      input: {
        flex: '1 1 auto', minWidth: '0', padding: '10px 12px', borderRadius: '10px',
        border: `1px solid ${LINE}`, background: '#ffffff', color: INK,
        font: 'inherit', outline: 'none',
      },
      button: {
        padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: '#2563eb', color: '#fff', font: 'inherit',
        fontWeight: '600', whiteSpace: 'nowrap',
      },
      ghost: {
        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', font: 'inherit',
        background: '#ffffff', border: `1px solid ${LINE}`, color: INK,
      },
      card: {
        border: `1px solid ${LINE}`, borderRadius: '12px',
        padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
        background: '#ffffff', boxShadow: '0 1px 2px rgba(16,24,40,.04)',
      },
      label: { fontSize: '12px', color: MUTED, letterSpacing: '0.04em' },
      labelRow: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '8px', marginBottom: '4px',
      },
      pre: {
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
        fontSize: '13px', lineHeight: '1.7', maxHeight: '320px', overflowY: 'auto',
        color: INK,
      },
      video: { maxHeight: '70vh', maxWidth: '100%', width: 'auto', borderRadius: '10px', background: '#000', display: 'block' },
      thumbs: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
      thumb: { height: '150px', borderRadius: '8px', border: `1px solid ${LINE}` },
      meta: { display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: MUTED },
      chip: {
        padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
        border: `1px solid ${LINE}`, background: SOFT, color: MUTED,
      },
      note: { fontSize: '12px', color: MUTED, lineHeight: '1.6' },
      err: { color: '#b42318', fontSize: '13px', whiteSpace: 'pre-wrap', background: '#fef3f2', padding: '10px 12px', borderRadius: '10px' },
      fileRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      overlay: {
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.86)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
        padding: '24px', boxSizing: 'border-box',
      },
      overlayImg: { maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '8px' },
      fileBtn: {
        fontSize: '12px', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
        border: `1px solid ${LINE}`, background: SOFT, color: INK, font: 'inherit',
        maxWidth: '520px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
    };

    // 网关不带 query string，所以文件用 POST 取二进制，再转成 blob URL 给 <video>/<img>。
    function baseName(p) {
      return String(p || '').split(/[\\/]/).pop() || '';
    }

    function dirName(p) {
      const s = String(p || '');
      const i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/'));
      return i > 0 ? s.slice(0, i) : '';
    }

    /** 标题栏右侧的复制图标；点一下把文本写进剪贴板，1.2 秒后恢复。 */
    function CopyBtn({ text, label, doneLabel }) {
      const [state, setState] = useState('');
      const onClick = () => {
        const value = String(text || '');
        if (!value) return;
        copyToClipboard(value).then(() => {
          setState('ok');
          setTimeout(() => setState(''), 1200);
        }, () => setState('fail'));
      };
      const done = state === 'ok';
      return h('button', {
        type: 'button',
        title: label || '复制',
        'aria-label': label || '复制',
        onClick,
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          border: `1px solid ${done ? '#86efac' : '#e5e7eb'}`,
          background: done ? '#f0fdf4' : '#fff',
          color: done ? '#15803d' : '#6b7280',
          borderRadius: '6px', padding: '2px 6px', fontSize: '11px',
          lineHeight: 1.4, cursor: 'pointer', userSelect: 'none',
        },
      }, done ? `✓ ${doneLabel || '已复制'}` : `⧉ ${label || '复制'}`);
    }

    async function fetchBlobUrl(base, path) {
      const res = await fetch(`${base}api/media-extract/file`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${text.slice(0, 80)}`.trim());
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }

    // 让用户选「保存到哪个文件夹」——Chromium 有 showSaveFilePicker，其它浏览器退化成普通下载。
    async function pickTarget(name) {
      const picker = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
        ? window.showSaveFilePicker
        : null;
      if (!picker) return { fallback: true };
      try {
        const handle = await picker({ suggestedName: name });
        return { handle };
      } catch (e) {
        if (e && e.name === 'AbortError') return null;
        return { fallback: true };
      }
    }

    // 面板在切换标签页/会话时会被卸载，所以「正在解析」和结果都放在模块级：
    // 切走再切回来能接着显示进度，解析完成后结果也不会丢。
    const STORE = {
      url: '', result: null, urls: {}, playNote: '', error: '',
      busy: false, startedAt: 0,
    };
    const SUBS = new Set();
    function notify() {
      for (const fn of Array.from(SUBS)) {
        try { fn(); } catch {}
      }
    }
    let JOB = null;

    function runJob(target, tr, base) {
      if (STORE.busy) return JOB;
      STORE.busy = true;
      STORE.startedAt = Date.now();
      STORE.error = '';
      STORE.playNote = '';
      STORE.result = null;
      notify();
      JOB = (async () => {
        try {
          const res = await fetch(`${base}api/media-extract/run`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: target, transcribe: tr }),
          });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(`接口返回异常（HTTP ${res.status}）：${text.slice(0, 200)}`);
          }
          if (!data.ok) { STORE.error = data.error || '解析失败'; STORE.result = null; }
          else { STORE.result = data; STORE.error = ''; }
        } catch (e) {
          STORE.error = String((e && e.message) || e);
        } finally {
          STORE.busy = false;
          STORE.startedAt = 0;
          JOB = null;
          notify();
        }
      })();
      return JOB;
    }

    function Panel() {
      const t = useT();
      const [url, setUrl] = useState(STORE.url);
      const [busy, setBusy] = useState(STORE.busy);
      const [transcribe, setTranscribe] = useState(true);
      const [result, setResult] = useState(STORE.result);
      const [error, setError] = useState(STORE.error);
      const [playNote, setPlayNote] = useState(STORE.playNote);
      const [urls, setUrls] = useState(STORE.urls);
      const [savedPath, setSavedPath] = useState('');
      const [preview, setPreview] = useState(null);
      const [elapsed, setElapsed] = useState(
        STORE.busy && STORE.startedAt ? Math.round((Date.now() - STORE.startedAt) / 1000) : 0,
      );
      const urlsRef = useRef({ ...STORE.urls });

      // 挂载时从模块级 STORE 同步；解析在后台跑，切回来仍有进度和结果。
      useEffect(() => {
        const sync = () => {
          setBusy(STORE.busy);
          setResult(STORE.result);
          setError(STORE.error);
          setPlayNote(STORE.playNote);
          setElapsed(STORE.busy && STORE.startedAt
            ? Math.round((Date.now() - STORE.startedAt) / 1000) : 0);
        };
        SUBS.add(sync);
        sync();
        return () => { SUBS.delete(sync); };
      }, []);

      useEffect(() => {
        STORE.url = url;
      }, [url]);

      useEffect(() => {
        if (!busy) return;
        const id = setInterval(() => {
          if (STORE.startedAt) setElapsed(Math.round((Date.now() - STORE.startedAt) / 1000));
        }, 500);
        return () => clearInterval(id);
      }, [busy]);

      const base = (function () {
        try { return new URL('.', document.baseURI).href; } catch { return '/'; }
      })();

      const revokeAll = useCallback(() => {
        for (const v of Object.values(urlsRef.current)) {
          try { URL.revokeObjectURL(v); } catch {}
        }
        urlsRef.current = {};
        setUrls({});
        STORE.urls = {};
        setSavedPath('');
      }, []);

      // 结果出来后，把视频和图片逐个取成 blob URL（已有的跳过，避免切标签重复拉）。
      useEffect(() => {
        if (!result) return;
        let cancelled = false;
        (async () => {
          const list = [result.media, ...(result.images || [])].filter(Boolean);
          for (const p of list) {
            if (cancelled) return;
            if (urlsRef.current[p]) continue;
            try {
              const u = await fetchBlobUrl(base, p);
              if (cancelled) { try { URL.revokeObjectURL(u); } catch {} return; }
              urlsRef.current = { ...urlsRef.current, [p]: u };
              STORE.urls = { ...urlsRef.current };
              setUrls({ ...urlsRef.current });
            } catch (e) {
              if (!cancelled && p === result.media) setPlayNote(`${t('playFail')}：${String((e && e.message) || e)}`);
            }
          }
        })();
        return () => { cancelled = true; };
      }, [result, base, t]);

      const submit = useCallback(() => {
        const target = url.trim();
        if (!target || STORE.busy) return;
        revokeAll();
        STORE.url = target;
        void runJob(target, transcribe, base);
      }, [url, transcribe, base, revokeAll]);

      const reveal = useCallback(async (path) => {
        try {
          const res = await fetch(`${base}api/media-extract/reveal`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path }),
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch { data = null; }
          if (!data || !data.ok) setError((data && data.error) || `打开失败（HTTP ${res.status}）：${text.slice(0, 120)}`);
        } catch (e) {
          setError(String((e && e.message) || e));
        }
      }, [base]);

      const save = useCallback(async (path) => {
        const name = String(path).split(/[\\/]/).pop();
        try {
          const pick = await pickTarget(name);
          if (!pick) return;
          const res = await fetch(`${base}api/media-extract/file`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 80)}`.trim());
          const blob = await res.blob();
          if (pick.handle) {
            const w = await pick.handle.createWritable();
            await w.write(blob);
            await w.close();
          } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch {} }, 4000);
          }
          setSavedPath(path);
        } catch (e) {
          setError(`保存失败：${String((e && e.message) || e)}`);
        }
      }, [base]);

      const clear = useCallback(() => {
        if (STORE.busy) return;   // 解析中不清空，避免丢进度
        revokeAll();
        setResult(null); setError(''); setPlayNote(''); setUrl(''); setSavedPath('');
        STORE.url = ''; STORE.result = null; STORE.urls = {}; STORE.playNote = ''; STORE.error = '';
        notify();
      }, [revokeAll]);

      const again = useCallback(() => {
        if (STORE.busy) return;
        revokeAll();
        setResult(null); setError(''); setPlayNote('');
        STORE.result = null; STORE.error = ''; STORE.playNote = '';
        notify();
      }, [revokeAll]);

      const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } };

      const images = (result && result.images) || [];
      const files = result ? [result.media, ...images, result.txt].filter(Boolean) : [];
      const primary = files[0] || '';

      return h('div', { style: S.wrap },
        h('div', { style: S.row },
          h('input', {
            style: S.input, value: url, placeholder: t('placeholder'),
            onChange: (e) => setUrl(e.target.value), onKeyDown: onKey, disabled: busy,
          }),
          h('button', { style: { ...S.button, opacity: busy ? 0.6 : 1 }, onClick: () => void submit(), disabled: busy },
            busy ? `${t('busy')} ${elapsed}s` : t('go')),
          h('button', { style: S.ghost, onClick: clear, title: t('clear') }, t('clear')),
        ),
        h('div', { style: S.row },
          h('label', { style: { ...S.note, display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' } },
            h('input', { type: 'checkbox', checked: transcribe, onChange: (e) => setTranscribe(e.target.checked) }),
            t('transcribe')),
          result ? h('button', { style: S.ghost, onClick: again }, t('again')) : null,
        ),

        error ? h('div', { style: S.err }, error) : null,

        result
          ? h('div', { style: S.card },
            h('div', { style: S.meta },
              h('span', { style: S.chip }, result.platform || '—'),
              h('span', { style: S.chip }, result.type === 'image' ? t('images') : t('video')),
              result.bytes ? h('span', { style: S.chip }, `${(result.bytes / 1048576).toFixed(2)} MB`) : null,
              result.seconds ? h('span', { style: S.chip }, `${result.seconds}s`) : null,
            ),

            result.media
              ? h('div', null,
                h('div', { style: S.label }, t('video')),
                urls[result.media]
                  ? h('div', { style: { display: 'flex', justifyContent: 'center', background: 'transparent' } },
                    h('video', {
                      style: { ...S.video, cursor: 'zoom-in' },
                      src: urls[result.media],
                      controls: true,
                      playsInline: true,
                      onClick: () => setPreview({ type: 'video', src: urls[result.media] }),
                    }))
                  : h('div', { style: { ...S.note, padding: '24px 0' } }, t('loading')),
                playNote ? h('div', { style: { ...S.note, marginTop: '6px', color: '#b42318' } }, playNote) : null,
              )
              : null,

            images.length
              ? h('div', null,
                h('div', { style: S.label }, `${t('images')} · ${images.length}`),
                h('div', { style: S.thumbs },
                  images.map((p) => urls[p]
                    ? h('img', {
                      key: p, style: { ...S.thumb, cursor: 'zoom-in' }, src: urls[p],
                      onClick: () => setPreview({ type: 'image', src: urls[p] }),
                    })
                    : h('div', { key: p, style: { ...S.thumb, width: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: SOFT, fontSize: '11px', color: MUTED } }, '…')),
                ),
              )
              : null,

            result.caption
              ? h('div', null,
                h('div', { style: S.labelRow },
                  h('span', { style: S.label }, t('caption')),
                  h(CopyBtn, { text: result.caption, label: t('copy'), doneLabel: t('copied') }),
                ),
                h('pre', { style: S.pre }, result.caption),
              )
              : null,

            h('div', null,
              h('div', { style: S.labelRow },
                h('span', { style: S.label }, t('title')),
                h(CopyBtn, { text: result.title, label: t('copy'), doneLabel: t('copied') }),
              ),
              h('div', { style: { fontSize: '14px', fontWeight: '600', wordBreak: 'break-word', color: INK } }, result.title || '(无)'),
            ),

            result.text !== undefined
              ? h('div', null,
                h('div', { style: S.labelRow },
                  h('span', { style: S.label },
                    `${t('text')}${result.text && result.text.replace(/\s/g, '').length > 1
                      ? ` · ${result.text.replace(/\s/g, '').length} 字` : ''}`),
                  result.text && result.text.replace(/\s/g, '').length > 1
                    ? h(CopyBtn, { text: result.text, label: t('copy'), doneLabel: t('copied') })
                    : null,
                ),
                h('pre', { style: S.pre },
                  result.text && result.text.replace(/\s/g, '').length > 1 ? result.text : t('noSpeech')),
              )
              : null,

            primary
              ? h('div', null,
                h('div', { style: S.label }, t('files')),
                h('div', { style: S.fileRow },
                  h('button', { style: S.fileBtn, title: primary, onClick: () => void reveal(primary) },
                    `${t('open')} · ${baseName(primary)}`),
                  h('button', {
                    style: { ...S.fileBtn, borderColor: '#bfdbfe', color: '#1d4ed8', background: '#eff6ff' },
                    title: primary,
                    onClick: () => void save(primary),
                  }, savedPath === primary ? `✓ ${t('saved')}` : `${t('download')} · ${baseName(primary)}`),
                ),
                h('div', { style: { ...S.note, marginTop: '6px', wordBreak: 'break-all' } },
                  `${t('folder')}：${dirName(primary) || '—'}`),
              )
              : null,
          )
          : h('div', { style: S.note }, t('hint')),

        preview
          ? h('div', { style: S.overlay, onClick: () => setPreview(null) },
            preview.type === 'image'
              ? h('img', { style: S.overlayImg, src: preview.src })
              : h('video', { style: S.overlayImg, src: preview.src, controls: true, autoPlay: true, onClick: (e) => e.stopPropagation() }),
          )
          : null,
      );
    }

    let currentT = (k) => ZH[k] || k;
    function useT() { return currentT; }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'media-extract: dictionaries');
        const bind = ctx.locale.bind ? ctx.locale.bind(NS) : null;
        if (bind) currentT = (k) => bind(k);
        ctx.slots.inject('conversation.view', () => ctx.slots.register({
          name: 'conversation.view',
          id: 'media-extract',
          order: 40,
          locale: NS,
          label: () => (currentT('tab') || '解析'),
        }, Panel));
      },
    };
  },
});
