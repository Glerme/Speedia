import * as esbuild from 'esbuild';
import { cp, mkdir, rm, watch } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
process.chdir(root);

const assets = [
  ['static', 'dist'],
  ['src/popup/popup.html', 'dist/popup.html'],
  ['src/welcome/welcome.html', 'dist/welcome.html'],
  ['src/welcome/welcome.css', 'dist/welcome.css'],
];

const context = await esbuild.context({
  entryPoints: {
    background: 'src/background/index.ts',
    inject: 'src/inject/index.ts',
    content: 'src/content/index.ts',
    popup: 'src/popup/popup.ts',
    'popup-theme': 'src/popup/theme-entry.ts',
    welcome: 'src/welcome/welcome.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: ['chrome121', 'firefox128'],
  minify: false,
  legalComments: 'inline',
  plugins: [{
    name: 'assets',
    setup(build) {
      build.onStart(async () => {
        await rm('dist', { recursive: true, force: true });
        await mkdir('dist', { recursive: true });
        for (const [source, destination] of assets) {
          await cp(source, destination, { recursive: true });
        }
      });
    },
  }],
});

if (process.argv.includes('--watch')) {
  await context.watch();
  // esbuild watches its module graph; copied assets also trigger a full rebuild.
  for (const directory of ['static', 'src/popup', 'src/welcome']) {
    (async () => {
      for await (const event of watch(directory, { recursive: true })) {
        if (directory === 'static' || /\.(html|css)$/.test(event.filename ?? '')) {
          await context.rebuild();
        }
      }
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
} else {
  try {
    await context.rebuild();
  } finally {
    await context.dispose();
  }
}
