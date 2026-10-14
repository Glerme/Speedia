// Gera os prints e GIFs de docs/media a partir do código real da extensão.
// Uso: npm ci && node build.mjs   (CHROME_PATH aponta para outro Chrome, se preciso)
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '../..');
const out = join(root, 'docs/media');
const cache = join(here, '.cache');
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp4': 'video/mp4' };

mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });

// ---------------------------------------------------------------- vídeo de demo (sem conteúdo de terceiros)
const video = join(cache, 'demo.mp4');
if (!existsSync(video)) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'gradients=size=1280x720:rate=30:duration=10:speed=0.03:nb_colors=3:seed=9',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-vf', 'eq=saturation=1.2:brightness=-0.08,format=yuv420p', '-t', '10', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
    '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', video]);
}

// ---------------------------------------------------------------- servidor: /ext = repo, /demo = harness, /cache = vídeo
// O stub entra antes de qualquer script das páginas reais da extensão (popup.html, welcome.html).
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const [, area, ...rest] = url.pathname.split('/');
  const base = { ext: root, demo: join(here, 'demo'), cache }[area];
  const file = base && normalize(join(base, ...rest));
  if (!file || !file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) return res.writeHead(404).end();
  let body = readFileSync(file);
  if (area === 'ext' && file.endsWith('.html')) body = Buffer.from(body.toString().replace('<head>', '<head><script src="/demo/stub.js"></script>'));
  const range = /bytes=(\d+)-/.exec(req.headers.range || ''); // o <video> pede ranges
  if (range) {
    const start = +range[1];
    res.writeHead(206, { 'Content-Type': MIME[extname(file)], 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${body.length - 1}/${body.length}` });
    return res.end(body.subarray(start));
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' }).end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
});

// Contexto isolado por página: o popup espelha o tema em localStorage.
async function open(path, { w, h, scale = 2, store = {}, scheme = 'dark' }) {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(`${origin}${path}${path.includes('?') ? '&' : '?'}store=${encodeURIComponent(JSON.stringify(store))}`);
  return page;
}

// Feed com o vídeo tocando com som; devolve o centro da barra Speedia.
async function feed(opts) {
  const page = await open('/demo/feed.html', opts);
  await page.evaluate(async () => {
    const v = document.getElementById('v');
    v.muted = false;
    await v.play();
  });
  await page.hover('#v');
  await page.waitForFunction(() => window.__sr?.querySelector('.bar:not([hidden])'));
  return page;
}

const rectOf = (page, fn, arg) => page.evaluate((src, a) => {
  const r = new Function('sr', 'a', `return (${src})(sr, a)`)(window.__sr, a).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, fn.toString(), arg);
const bar = (sr) => sr.querySelector('.bar');
const speedBtn = (sr, label) => [...sr.querySelectorAll('.bar button')].find((b) => b.textContent.trim() === label);

async function glide(page, to, ms = 400) {
  const steps = Math.max(1, Math.round(ms / 25));
  await page.mouse.move(to.x, to.y, { steps });
}

// ---------------------------------------------------------------- GIF: capturas contínuas com timestamp -> ffmpeg
async function record(name, page, action, { clip, width = 720, fps = 15 } = {}) {
  const dir = join(cache, `frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const frames = [];
  let run = true;
  const grab = (async () => {
    for (let i = 0; run; i++) {
      const f = `${dir}/${String(i).padStart(4, '0')}.png`;
      const t = performance.now();
      await page.screenshot({ path: f, clip });
      frames.push({ f, t });
    }
  })();
  await action();
  run = false;
  await grab;
  // Duração de cada quadro = intervalo até o próximo (o último dura um fps).
  const list = frames.map((fr, i) => `file '${fr.f}'\nduration ${(((frames[i + 1]?.t ?? fr.t + 1000 / fps) - fr.t) / 1000).toFixed(3)}`).join('\n');
  writeFileSync(`${dir}/list.txt`, list + `\nfile '${frames.at(-1).f}'\n`);
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos`;
  const png = join(dir, 'palette.png');
  const src = ['-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...src, '-vf', `${vf},palettegen=stats_mode=diff`, png]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...src, '-i', png, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', join(out, `${name}.gif`)]);
  console.log(`${name}.gif  ${frames.length} quadros  ${(statSync(join(out, `${name}.gif`)).size / 1e6).toFixed(2)} MB`);
}

try {
  // ---- overlay.png: barra aberta (hover real na barra), tema escuro
  {
    const page = await feed({ w: 900, h: 560, store: { theme: 'dark' } });
    await glide(page, await rectOf(page, bar), 200);
    await page.mouse.click(...Object.values(await rectOf(page, speedBtn, '1.5×')));
    await sleep(500);
    await page.screenshot({ path: join(out, 'overlay.png') });
    await page.browserContext().close();
  }

  // ---- popup-dark.png / popup-light.png
  for (const [name, store, scheme] of [['popup-dark', { theme: 'dark' }, 'dark'], ['popup-light', { theme: 'light', accent: '#f97316' }, 'light']]) {
    const page = await open('/ext/popup.html', { w: 368, h: 700, store, scheme });
    await sleep(500);
    const height = await page.evaluate(() => Math.ceil(document.documentElement.getBoundingClientRect().height));
    await page.setViewport({ width: 368, height, deviceScaleFactor: 2 });
    await page.screenshot({ path: join(out, `${name}.png`) });
    await page.browserContext().close();
  }

  // ---- welcome.png
  {
    const page = await open('/ext/welcome.html', { w: 960, h: 720, store: { theme: 'dark' } });
    await sleep(500);
    await page.screenshot({ path: join(out, 'welcome.png'), fullPage: true });
    await page.browserContext().close();
  }

  // ---- speed.gif
  {
    const page = await feed({ w: 720, h: 440, scale: 1, store: { theme: 'dark' } });
    await page.mouse.move(40, 400);
    await sleep(300);
    await record('speed', page, async () => {
      await sleep(300);
      await glide(page, await rectOf(page, bar), 700); // o mouse vai até o vídeo/barra e ela abre
      await sleep(500);
      await glide(page, await rectOf(page, speedBtn, '1.5×'), 350);
      await page.mouse.down(); await page.mouse.up();
      await sleep(700);
      await glide(page, await rectOf(page, speedBtn, '2×'), 350);
      await page.mouse.down(); await page.mouse.up();
      await sleep(1200);
      await glide(page, { x: 600, y: 250 }, 400); // sai da barra: volta a pílula com "2×"
      await sleep(700);
    });
    await page.browserContext().close();
  }

  // ---- appearance.gif
  {
    const page = await open('/ext/popup.html', { w: 368, h: 900, scale: 2, store: { theme: 'dark' } });
    await sleep(500);
    const box = await page.evaluate(() => {
      const a = document.getElementById('h-look').getBoundingClientRect();
      const b = document.getElementById('accentReset').getBoundingClientRect();
      return { x: 0, y: a.top - 14, width: 368, height: b.bottom - a.top + 28 };
    });
    const pt = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    const click = async (sel, ms = 400) => { await glide(page, await pt(sel), ms); await page.mouse.down(); await page.mouse.up(); await sleep(450); };
    await page.mouse.move(300, box.y);
    await record('appearance', page, async () => {
      await sleep(400);
      await click('input[name=theme][value=light]');
      await click('input[name=accent][value="#3b82f6"]');
      await click('input[name=accent][value="#f97316"]');
      // Arrasta na roda de cor
      const c = await pt('#ring');
      const at = (deg) => ({ x: c.x + 47 * Math.sin((deg * Math.PI) / 180), y: c.y - 47 * Math.cos((deg * Math.PI) / 180) });
      await glide(page, at(30), 350);
      await page.mouse.down();
      for (let d = 30; d <= 150; d += 8) { await page.mouse.move(at(d).x, at(d).y); await sleep(40); }
      await page.mouse.up();
      await sleep(900);
    }, { clip: box });
    await page.browserContext().close();
  }

  // ---- mini-player.gif
  {
    const page = await feed({ w: 720, h: 440, scale: 1, store: { theme: 'dark' } });
    await page.mouse.move(650, 300);
    await sleep(1500); // o vídeo precisa ser visto tocando com som antes de rolar
    await record('mini-player', page, async () => {
      await sleep(900);
      for (let i = 0; i < 24; i++) { await page.mouse.wheel({ deltaY: 22 }); await sleep(45); }
      await sleep(2300);
    });
    await page.browserContext().close();
  }
} finally {
  await browser.close();
  server.close();
}
