// Build the site into dist/ — run by GitHub Actions on every push (npm run build).
// 1. Bundle src/main.jsx (+ everything it imports) into dist/app.js (minified, no Babel in the browser).
// 2. Copy every other site file (index.html, char.js, teacher.html, assets/, …) into dist/.
// 3. Stamp a build id into index.html (?v=…) so school computers never keep an old copy.
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { convertCurriculum, lessonIndexJs } from './curriculum.mjs';

const OUT = 'dist';
const SKIP = new Set([OUT, 'src', 'scripts', 'data', 'node_modules', '.github', '.git',
  'package.json', 'package-lock.json', 'README.md', 'edition.json', 'firestore.rules']);   // edition.json is read by the bundle (src/edition.js)
// Files this edition leaves off the site (edition.json "skip", e.g. teacher.html in the public edition).
// They stay in the repo so merges from the school repo never hit a deleted file.
const edition = JSON.parse(fs.readFileSync('edition.json', 'utf8'));
for (const name of edition.skip || []) SKIP.add(name);
const buildId = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 10);

// 0. data/curriculum.xlsx → src/data/curriculum.gen.js (stops the build if a word is not typeable yet)
const cur = convertCurriculum();
console.log(`curriculum: ${cur.words} words, ${cur.passages} passages`);
for (const w of cur.warnings.slice(0, 30)) console.log('  (เตือน)', w);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

// The game (index.html → app.js) and the new teacher page (teacher2.html → teacher2.js)
for (const [entry, out] of [['src/main.jsx', 'app.js'], ['src/teacher/main.jsx', 'teacher2.js']]) await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2018'],
  loader: { '.js': 'jsx' },
  jsxFactory: 'React.createElement',      // React is loaded from the CDN <script> in index.html
  jsxFragment: 'React.Fragment',
  outfile: path.join(OUT, out),
  logLevel: 'info',
});

for (const name of fs.readdirSync('.')) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  fs.cpSync(name, path.join(OUT, name), { recursive: true });
}

fs.writeFileSync(path.join(OUT, 'lesson-index.js'), lessonIndexJs());

const indexPath = path.join(OUT, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('__BUILD__')) throw new Error('index.html: build id placeholder missing');
fs.writeFileSync(indexPath, html.replaceAll('__BUILD__', buildId));
for (const page of ['teacher.html', 'teacher2.html']) {
  const p = path.join(OUT, page);
  if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__BUILD__', buildId));
}
console.log('build', buildId, 'ok');
