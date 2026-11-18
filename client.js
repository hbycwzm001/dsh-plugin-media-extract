window.__ModuleLoader__.load({
  id: 'dsh-plugin-media-extract',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    const NS = 'mediaExtract';
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
      fileBtn: {
        fontSize: '12px', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
        border: `1px solid ${LINE}`, background: SOFT, color: INK, font: 'inherit',
        maxWidth: '520px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      },
    };

    // 网关不带 query string，所以文件用 POST 取二进制，再转成 blob URL 给 <video>/<img>。
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

    // 面板在切换标签页时会被卸载，把状态放在模块级，切回来还能看到上一次的结果。
    const STORE = { url: '', result: null, urls: {}, playNote: '', error: '' };

    function Panel() {
      const t = useT();
      const [url, setUrl] = useState(STORE.url);
      const [busy, setBusy] = useState(false);
      const [transcribe, setTranscribe] = useState(true);
      const [result, setResult] = useState(STORE.result);
      const [error, setError] = useState(STORE.error);
      const [playNote, setPlayNote] = useState(STORE.playNote);
      const [urls, setUrls] = useState(STORE.urls);
      const [savedPath, setSavedPath] = useState('');
      const [elapsed, setElapsed] = useState(0);
      const timerRef = useRef(null);
      const urlsRef = useRef({ ...STORE.urls });

      useEffect(() => {
        STORE.url = url; STORE.result = result; STORE.urls = urls;
        STORE.playNote = playNote; STORE.error = error;
      }, [url, result, urls, playNote, error]);

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
              setUrls({ ...urlsRef.current });
            } catch (e) {
              if (!cancelled && p === result.media) setPlayNote(`${t('playFail')}：${String((e && e.message) || e)}`);
            }
          }
        })();
        return () => { cancelled = true; };
      }, [result, base, t]);

      const submit = useCallback(async () => {
        const target = url.trim();
        if (!target || busy) return;
        revokeAll();
        setBusy(true); setError(''); setPlayNote(''); setResult(null); setElapsed(0);
        const t0 = Date.now();
        timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
        try {
          const res = await fetch(`${base}api/media-extract/run`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: target, transcribe }),
          });
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(`接口返回异常（HTTP ${res.status}）：${text.slice(0, 200)}`);
          }
          if (!data.ok) setError(data.error || t('failed'));
          else setResult(data);
        } catch (e) {
          setError(String((e && e.message) || e));
        } finally {
          clearInterval(timerRef.current);
          setBusy(false);
        }
      }, [url, busy, transcribe, base, t, revokeAll]);

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
        revokeAll();
        setResult(null); setError(''); setPlayNote(''); setUrl(''); setSavedPath('');
        STORE.url = ''; STORE.result = null; STORE.urls = {}; STORE.playNote = ''; STORE.error = '';
      }, [revokeAll]);

      const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } };

      const images = (result && result.images) || [];
      const files = result ? [result.media, ...images, result.txt].filter(Boolean) : [];

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
          result ? h('button', { style: S.ghost, onClick: () => { revokeAll(); setResult(null); setError(''); setPlayNote(''); } }, t('again')) : null,
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
                      style: S.video,
                      src: urls[result.media],
                      controls: true,
                      playsInline: true,
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
                    ? h('img', { key: p, style: S.thumb, src: urls[p] })
                    : h('div', { key: p, style: { ...S.thumb, width: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: SOFT, fontSize: '11px', color: MUTED } }, '…')),
                ),
              )
              : null,

            result.caption
              ? h('div', null,
                h('div', { style: S.label }, t('caption')),
                h('pre', { style: S.pre }, result.caption),
              )
              : null,

            h('div', null,
              h('div', { style: S.label }, t('title')),
              h('div', { style: { fontSize: '14px', fontWeight: '600', wordBreak: 'break-word', color: INK } }, result.title || '(无)'),
            ),

            result.text && result.text.trim() && result.text.trim() !== '.'
              ? h('details', null,
                h('summary', { style: { ...S.label, cursor: 'pointer' } }, t('text')),
                h('pre', { style: { ...S.pre, marginTop: '8px' } }, result.text),
              )
              : null,

            files.length
              ? h('div', null,
                h('div', { style: S.label }, t('files')),
                h('div', { style: S.fileRow },
                  files.map((p) => h('button', {
                    key: `open-${p}`, style: S.fileBtn, title: p,
                    onClick: () => void reveal(p),
                  }, `${t('open')} · ${p.split(/[\\/]/).pop()}`)),
                  files.map((p) => h('button', {
                    key: `dl-${p}`, style: { ...S.fileBtn, borderColor: '#bfdbfe', color: '#1d4ed8', background: '#eff6ff' }, title: p,
                    onClick: () => void save(p),
                  }, savedPath === p ? `✓ ${t('saved')}` : `${t('download')} · ${p.split(/[\\/]/).pop()}`)),
                ),
                h('div', { style: { ...S.note, marginTop: '6px', wordBreak: 'break-all' } },
                  `${t('folder')}：${String(result.folder || (result.media || files[0] || '')).replace(/[\\/][^\\/]*$/, '') || '—'}`),
              )
              : null,
          )
          : h('div', { style: S.note }, t('hint')),
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
