window.__ModuleLoader__.load({
  id: 'dsh-plugin-media-extract',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useRef, useCallback } = React;

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
      empty: '还没有结果',
      hint: '支持的平台：抖音、小红书、TikTok、YouTube、Facebook、X(Twitter)、Instagram。',
      failed: '解析失败',
      notReady: '引擎未安装，先在对话里让 Agent 运行 media_setup(action="download")。',
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
      empty: 'No result yet',
      hint: 'Supports Douyin, Xiaohongshu, TikTok, YouTube, Facebook, X (Twitter) and Instagram.',
      failed: 'Extraction failed',
      notReady: 'Engine is not installed. Ask the agent to run media_setup(action="download").',
    };

    const S = {
      wrap: {
        display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px',
        height: '100%', overflowY: 'auto', boxSizing: 'border-box',
        font: 'inherit', color: 'var(--dsw-alias-text-primary, #e6e6e6)',
      },
      row: { display: 'flex', gap: '10px', alignItems: 'center' },
      input: {
        flex: '1 1 auto', minWidth: '0', padding: '10px 12px', borderRadius: '10px',
        border: '1px solid var(--dsw-alias-border, #3a3a3a)',
        background: 'var(--dsw-alias-surface, #1b1b1b)',
        color: 'inherit', font: 'inherit', outline: 'none',
      },
      button: {
        padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'var(--dsw-alias-accent, #3b82f6)', color: '#fff', font: 'inherit',
        fontWeight: '600', whiteSpace: 'nowrap',
      },
      ghost: {
        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', font: 'inherit',
        background: 'transparent', border: '1px solid var(--dsw-alias-border, #3a3a3a)',
        color: 'inherit',
      },
      card: {
        border: '1px solid var(--dsw-alias-border, #3a3a3a)', borderRadius: '12px',
        padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
        background: 'var(--dsw-alias-surface, #1b1b1b)',
      },
      label: { fontSize: '12px', opacity: 0.7, letterSpacing: '0.04em' },
      pre: {
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
        fontSize: '13px', lineHeight: '1.65', maxHeight: '320px', overflowY: 'auto',
      },
      video: { width: '100%', maxHeight: '62vh', borderRadius: '10px', background: '#000' },
      thumbs: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
      thumb: { height: '150px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border, #3a3a3a)' },
      meta: { display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', opacity: 0.75 },
      chip: {
        padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
        border: '1px solid var(--dsw-alias-border, #3a3a3a)',
      },
      note: { fontSize: '12px', opacity: 0.6, lineHeight: '1.6' },
      err: { color: 'var(--dsw-alias-danger, #f87171)', fontSize: '13px', whiteSpace: 'pre-wrap' },
    };

    function fileUrl(base, path) {
      return `${base}api/media-extract/file?p=${encodeURIComponent(path)}`;
    }

    function Panel() {
      const t = useT();
      const [url, setUrl] = useState('');
      const [busy, setBusy] = useState(false);
      const [transcribe, setTranscribe] = useState(true);
      const [result, setResult] = useState(null);
      const [error, setError] = useState('');
      const [elapsed, setElapsed] = useState(0);
      const timerRef = useRef(null);

      const base = (function () {
        try { return new URL('.', document.baseURI).href; } catch { return '/'; }
      })();

      const submit = useCallback(async () => {
        const target = url.trim();
        if (!target || busy) return;
        setBusy(true); setError(''); setResult(null); setElapsed(0);
        const t0 = Date.now();
        timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
        try {
          const res = await fetch(`${base}api/media-extract/run`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: target, transcribe }),
          });
          const data = await res.json();
          if (!data.ok) setError(data.error || t('failed'));
          else setResult(data);
        } catch (e) {
          setError(String((e && e.message) || e));
        } finally {
          clearInterval(timerRef.current);
          setBusy(false);
        }
      }, [url, busy, transcribe, base, t]);

      const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } };

      const images = (result && result.images) || [];

      return h('div', { style: S.wrap },
        h('div', { style: S.row },
          h('input', {
            style: S.input, value: url, placeholder: t('placeholder'),
            onChange: (e) => setUrl(e.target.value), onKeyDown: onKey, disabled: busy,
          }),
          h('button', { style: { ...S.button, opacity: busy ? 0.6 : 1 }, onClick: () => void submit(), disabled: busy },
            busy ? `${t('busy')} ${elapsed}s` : t('go')),
        ),
        h('div', { style: S.row },
          h('label', { style: { ...S.note, display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' } },
            h('input', { type: 'checkbox', checked: transcribe, onChange: (e) => setTranscribe(e.target.checked) }),
            t('transcribe')),
          result ? h('button', { style: S.ghost, onClick: () => { setResult(null); setError(''); } }, t('again')) : null,
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
                h('video', { style: S.video, src: fileUrl(base, result.media), controls: true, playsInline: true }),
              )
              : null,

            images.length
              ? h('div', null,
                h('div', { style: S.label }, `${t('images')} · ${images.length}`),
                h('div', { style: S.thumbs },
                  images.map((p) => h('img', { key: p, style: S.thumb, src: fileUrl(base, p), loading: 'lazy' })),
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
              h('div', { style: { fontSize: '14px', fontWeight: '600', wordBreak: 'break-word' } }, result.title || '(无)'),
            ),

            result.text && result.text.trim() && result.text.trim() !== '.'
              ? h('details', null,
                h('summary', { style: { ...S.label, cursor: 'pointer' } }, t('text')),
                h('pre', { style: { ...S.pre, marginTop: '8px' } }, result.text),
              )
              : null,

            h('div', { style: { ...S.label, opacity: 0.5, wordBreak: 'break-all' } },
              `${t('files')}: ${[result.media, ...images, result.txt].filter(Boolean).join(' · ') || '—'}`),
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
