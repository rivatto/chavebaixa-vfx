// Gera o .bat e publica no repositorio (so envia o que mudou).
// Uso:  node fonte/publicar.js ["mensagem"]
//       node fonte/publicar.js --pack C:\caminho\chavebaixa-vfx-pack.zip   (envia o zip de presets + previas do pack.txt atual)
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os'), crypto = require('crypto');
const REPO = 'rivatto/chavebaixa-vfx', BRANCH = 'main';
const root = path.join(__dirname, '..');

const candidates = [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'GitHubCLI', 'bin', 'gh.exe'), 'C:\\Program Files\\GitHub CLI\\gh.exe', 'gh'];
const GH = candidates.find(c => c === 'gh' || fs.existsSync(c));
function gh(args, opts) { return cp.execFileSync(GH, args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, opts || {})); }

try { gh(['auth', 'status']); } catch (e) { console.error('GitHub CLI sem login. Rode:  gh auth login'); process.exit(2); }
try { gh(['repo', 'view', REPO, '--json', 'name']); }
catch (e) { gh(['repo', 'create', REPO, '--public', '--description', 'chavebaixa VFX - painel de presets para After Effects']); console.log('repositorio criado: ' + REPO); }

cp.execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });
const ver = fs.readFileSync(path.join(root, 'version.txt'), 'utf8').trim();
const pack = fs.readFileSync(path.join(root, 'pack.txt'), 'utf8').trim();
const packArg = process.argv.indexOf('--pack');
const msg = (packArg < 0 && process.argv[2]) || ('chavebaixa VFX v' + ver);

function blobSha(buf) { return crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex'); }
function remoteSha(name) {
  try { return gh(['api', 'repos/' + REPO + '/contents/' + name + '?ref=' + BRANCH, '--jq', '.sha']).trim(); } catch (e) { return null; }
}
// version.txt e pack.txt por ultimo: ninguem ve o numero novo antes de os arquivos novos estarem la
const files = ['README.md', 'fonte/build.js', 'fonte/publicar.js', 'painel/art.js', 'painel/fx-index.js', 'painel/jsx/main.jsx', 'painel/CSXS/manifest.xml', 'painel/index.html',
               'Instalar-chavebaixa-vfx.bat', 'version.txt'];
let sent = 0;
function put(name) {
  const buf = fs.readFileSync(path.join(root, name)), sha = remoteSha(name);
  if (sha === blobSha(buf)) { console.log('igual, pulei: ' + name); return; }
  const body = { message: msg, content: buf.toString('base64'), branch: BRANCH };
  if (sha) body.sha = sha;
  const tmp = path.join(os.tmpdir(), 'cbv_put_' + Date.now() + '.json');
  fs.writeFileSync(tmp, JSON.stringify(body));
  try { gh(['api', '-X', 'PUT', 'repos/' + REPO + '/contents/' + name, '--input', tmp, '--silent']); console.log('publicado:   ' + name); sent++; }
  finally { fs.unlinkSync(tmp); }
}
files.forEach(put);

if (packArg >= 0) {
  const zip = process.argv[packArg + 1], tag = 'pack-' + pack;
  if (!zip || !fs.existsSync(zip)) { console.error('nao achei o zip: ' + zip); process.exit(3); }
  if (path.basename(zip) !== 'chavebaixa-vfx-pack.zip') { console.error('o zip precisa se chamar chavebaixa-vfx-pack.zip'); process.exit(3); }
  let exists = true; try { gh(['release', 'view', tag, '--repo', REPO]); } catch (e) { exists = false; }
  console.log('enviando o pacote ' + pack + ' (' + Math.round(fs.statSync(zip).size / 1048576) + ' MB)...');
  if (exists) { gh(['release', 'upload', tag, zip, '--repo', REPO, '--clobber'], { stdio: 'inherit' }); }
  else { gh(['release', 'create', tag, zip, '--repo', REPO, '--title', 'Pacote de presets ' + pack, '--notes', 'Presets (.ffx) e previas (.gif) do chavebaixa VFX. O instalador baixa este arquivo sozinho.'], { stdio: 'inherit' }); }
  console.log('pacote publicado: ' + tag);
}
put('pack.txt');   // so depois de o zip estar no ar
console.log(sent ? ('\nv' + ver + ' publicada em https://github.com/' + REPO) : '\nNada mudou; o GitHub ja esta na v' + ver + '.');
