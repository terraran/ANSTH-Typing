// Build the site into dist/ — run by GitHub Actions on every push (npm run build).
// 1. Bundle src/main.jsx (+ everything it imports) into dist/app.js (minified, no Babel in the browser).
// 2. Copy every other site file (index.html, char.js, teacher.html, assets/, …) into dist/.
// 3. Stamp a build id into index.html (?v=…) so school computers never keep an old copy.
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const OUT = 'dist';
const SKIP = new Set([OUT, 'src', 'scripts', 'node_modules', '.github', '.git',
  'package.json', 'package-lock.json', 'README.md']);
const buildId = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 10);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2018'],
  loader: { '.js': 'jsx' },
  jsxFactory: 'React.createElement',      // React is loaded from the CDN <script> in index.html
  jsxFragment: 'React.Fragment',
  outfile: path.join(OUT, 'app.js'),
  logLevel: 'info',
});

for (const name of fs.readdirSync('.')) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  fs.cpSync(name, path.join(OUT, name), { recursive: true });
}

const indexPath = path.join(OUT, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('__BUILD__')) throw new Error('index.html: build id placeholder missing');
fs.writeFileSync(indexPath, html.replaceAll('__BUILD__', buildId));
console.log('build', buildId, 'ok');
