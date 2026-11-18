import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';

export const name = 'dsh-plugin-media-extract';
export const inject = ['tools'];

export const Config = z.object({
  binPath: z.string().default('').description('extract.exe 的完整路径；留空则用 homeDir/extract-tool/extract.exe'),
  homeDir: z.string().default('').description('工具目录；留空则用 ~/.dsh/media-extract'),
  timeoutMs: z.number().default(900000).description('单次解析超时（毫秒）'),
  maxChars: z.number().default(20000).description('回给模型的文本上限'),
});

const PKG_URL = 'https://github.com/hbycwzm001/media-extract-tool/releases/latest/download/extract-tool-win64.zip';
const EXE = platform() === 'win32' ? 'extract.exe' : 'extract';

const homeOf = (config) => {
  const raw = String(config.homeDir || '').trim();
  return raw || join(homedir(), '.dsh', 'media-extract');
};

const binOf = (config) => {
  const raw = String(config.binPath || '').trim();
  return raw || join(homeOf(config), 'extract-tool', EXE);
};

const clip = (text, max) => {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max)}\n…（已截断，原长 ${s.length} 字符）` : s;
};

function readConfig(config) {
  const p = join(dirname(binOf(config)), 'config.json');
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function run(exe, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(exe, args, {
      cwd: dirname(exe) === '.' ? process.cwd() : dirname(exe),
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, out, err: `${err}\n（超时 ${timeoutMs}ms，已终止）` });
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d.toString('utf8')));
    child.stderr.on('data', (d) => (err += d.toString('utf8')));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: String((e && e.message) || e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, out, err });
    });
  });
}

function lastJson(text) {
  const s = String(text || '');
  const idx = s.lastIndexOf('{"status"');
  if (idx < 0) return null;
  const tail = s.slice(idx);
  try {
    return JSON.parse(tail);
  } catch {
    const end = tail.lastIndexOf('}');
    if (end < 0) return null;
    try {
      return JSON.parse(tail.slice(0, end + 1));
    } catch {
      return null;
    }
  }
}

/** 去掉 undefined，保证返回值是合法 JSON。 */
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** 跑一次解析，返回给工具和网页面板共用的结果对象。 */
async function extractOne(config, { url, transcribe, preferBrowser }) {
  const exe = binOf(config);
  if (!existsSync(exe)) {
    return { ok: false, error: `没找到 ${exe}，先调用 media_setup（action=download）或配置 binPath` };
  }
  const argv = [url];
  if (transcribe === false) argv.push('--no-transcribe');
  if (preferBrowser) argv.push('--browser');
  const t0 = Date.now();
  const res = await run(exe, argv, config.timeoutMs);
  const data = lastJson(res.out) || lastJson(res.err);
  if (!data) return { ok: false, error: clip(res.err || res.out || '没有输出', 1200) };
  const ok = data.status === 'ok';
  return compact({
    ok,
    platform: data.platform,
    type: data.type,
    title: data.title,
    caption: clip(data.caption, config.maxChars),
    text: clip(data.text, config.maxChars),
    media: data.local_media || undefined,
    images: data.images && data.images.length ? data.images : undefined,
    txt: data.txt || undefined,
    bytes: data.bytes || undefined,
    seconds: Math.round((Date.now() - t0) / 100) / 10,
    error: ok ? undefined : data.message || '解析失败',
  });
}

const MIME = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.txt': 'text/plain; charset=utf-8',
};

/** 只允许读引擎目录里的文件，防目录穿越。 */
function serveFile(config, request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get('p');
  if (!raw) return new Response('missing p', { status: 400 });
  const target = resolve(raw);
  const root = resolve(homeOf(config));
  if (target !== root && !target.startsWith(root + sep)) return new Response('forbidden', { status: 403 });
  if (!existsSync(target)) return new Response('not found', { status: 404 });
  const buf = readFileSync(target);
  const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
  const range = request.headers.get('range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      const start = m[1] === '' ? Math.max(0, buf.length - Number(m[2])) : Number(m[1]);
      const end = m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
      if (start <= end && start < buf.length) {
        return new Response(buf.subarray(start, end + 1), {
          status: 206,
          headers: {
            'content-type': type,
            'content-length': String(end - start + 1),
            'content-range': `bytes ${start}-${end}/${buf.length}`,
            'accept-ranges': 'bytes',
            'cache-control': 'no-store',
          },
        });
      }
    }
  }
  return new Response(buf, {
    status: 200,
    headers: { 'content-type': type, 'content-length': String(buf.length), 'accept-ranges': 'bytes', 'cache-control': 'no-store' },
  });
}

function makeExtractTool(config) {
  return defineTool({
    name: 'media_extract',
    description:
      '解析任意视频/图文链接并下载原片到本地，同时提取文案（标题/正文），可选做语音转文字。' +
      '支持抖音、小红书、TikTok、YouTube、Facebook、X(Twitter)、Instagram，也支持本地音视频文件。' +
      '返回本地文件路径、标题、文案、转写文本。',
    parameters: {
      url: { type: 'string', required: true, description: '视频/图文页面链接，或本地音视频文件路径' },
      transcribe: { type: 'boolean', description: '是否做语音转文字，默认 true' },
      preferBrowser: { type: 'boolean', description: '强制用浏览器旁路解析（抖音/小红书专用），默认 false' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          platform: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          caption: { type: 'string' },
          text: { type: 'string' },
          media: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          txt: { type: 'string' },
          bytes: { type: 'number' },
          seconds: { type: 'number' },
          error: { type: 'string' },
        },
      },
      render: (_args, v) => {
        if (!v.ok) return [{ type: 'text', text: `解析失败：${v.error || '未知错误'}` }];
        const lines = [`✓ ${v.title || '(无标题)'}`];
        if (v.media) lines.push(`原片：${v.media}`);
        if (v.images && v.images.length) lines.push(`图片 ${v.images.length} 张：${v.images[0]} …`);
        if (v.txt) lines.push(`文案文件：${v.txt}`);
        if (v.caption) lines.push(`文案：${clip(v.caption, 300)}`);
        if (v.text && v.text.trim() && v.text.trim() !== '.') lines.push(`转写：${clip(v.text, 400)}`);
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    async execute(args) {
      return extractOne(config, args);
    },
  });
}

function makeSetupTool(config) {
  return defineTool({
    name: 'media_setup',
    description:
      '安装/检查/配置 media_extract 的本地引擎。action=check 检查是否就绪；action=download 下载并解压引擎包（约 400MB）；' +
      'action=config 读写 config.json（代理、画质、cookie 等）。首次使用先跑 check。',
    parameters: {
      action: { type: 'string', required: true, enum: ['check', 'download', 'config'], description: '动作' },
      patch: { type: 'object', additionalProperties: true, description: 'action=config 时要合并进 config.json 的键值' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ready: { type: 'boolean' },
          bin: { type: 'string' },
          home: { type: 'string' },
          config: { type: 'object', additionalProperties: true },
          message: { type: 'string' },
        },
      },
      render: (_args, v) => [{ type: 'text', text: v.message || (v.ready ? `已就绪：${v.bin}` : '未就绪') }],
    },
    async execute(args) {
      const home = homeOf(config);
      const exe = binOf(config);
      const cfgPath = join(dirname(exe), 'config.json');

      if (args.action === 'check') {
        const ready = existsSync(exe);
        const cfg = readConfig(config);
        return {
          ready,
          bin: exe,
          home,
          config: cfg,
          message: ready
            ? `引擎已就位：${exe}\n代理：${cfg.youtube_proxy || '(未设置)'}\n备用代理：${cfg.youtube_proxy_fallback || '(未设置)'}`
            : `引擎未安装（缺 ${exe}）。调用 media_setup action=download 自动下载。`,
        };
      }

      if (args.action === 'config') {
        const next = { ...readConfig(config), ...(args.patch || {}) };
        mkdirSync(dirname(cfgPath), { recursive: true });
        writeFileSync(cfgPath, JSON.stringify(next, null, 2), 'utf8');
        return { ready: existsSync(exe), bin: exe, home, config: next, message: `已写入 ${cfgPath}` };
      }

      if (existsSync(exe)) {
        return { ready: true, bin: exe, home, config: readConfig(config), message: `已存在，无需下载：${exe}` };
      }
      mkdirSync(home, { recursive: true });
      const zip = join(home, 'extract-tool.zip');
      const ps =
        `$ProgressPreference='SilentlyContinue';` +
        `Invoke-WebRequest -Uri '${PKG_URL}' -OutFile '${zip}' -UseBasicParsing;` +
        `Expand-Archive -Path '${zip}' -DestinationPath '${join(home, 'extract-tool')}' -Force;` +
        `Remove-Item '${zip}' -Force`;
      const res = await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], 30 * 60 * 1000);
      const ready = existsSync(exe);
      return {
        ready,
        bin: exe,
        home,
        config: readConfig(config),
        message: ready ? `下载完成：${exe}` : `下载失败：${clip(res.err || res.out, 800)}`,
      };
    },
  });
}

export function apply(ctx, config) {
  ctx.tools.register(makeExtractTool(config));
  ctx.tools.register(makeSetupTool(config));

  // 浏览器端的「解析」面板靠这两条路由工作（同源，无需额外鉴权）。
  ctx.inject(['connection'], (scope) => {
    scope.effect(() => scope.connection.fetch.register({
      path: '/api/media-extract/run',
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        let body = {};
        try { body = await request.json(); } catch { body = {}; }
        const url = String(body.url || '').trim();
        if (!url) return Response.json({ ok: false, error: '缺少 url' }, { status: 400 });
        const result = await extractOne(config, {
          url,
          transcribe: body.transcribe !== false,
          preferBrowser: body.preferBrowser === true,
        });
        return Response.json(result, { headers: { 'cache-control': 'no-store' } });
      },
    }), 'media-extract: /api/media-extract/run');

    scope.effect(() => scope.connection.fetch.register({
      path: '/api/media-extract/file',
      methods: ['GET'],
      requestBody: 'none',
      fetch: (request) => {
        try { return serveFile(config, request); } catch (error) { return new Response(String(error), { status: 500 }); }
      },
    }), 'media-extract: /api/media-extract/file');

    scope.effect(() => scope.connection.fetch.register({
      path: '/api/media-extract/status',
      methods: ['GET'],
      requestBody: 'none',
      fetch: () => Response.json({
        ready: existsSync(binOf(config)),
        bin: binOf(config),
        home: homeOf(config),
        config: readConfig(config),
      }, { headers: { 'cache-control': 'no-store' } }),
    }), 'media-extract: /api/media-extract/status');
  });
}
