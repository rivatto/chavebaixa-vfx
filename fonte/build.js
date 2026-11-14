// Gera o instalador de arquivo unico (Instalar-chavebaixa-vfx.bat) e o version.txt.
//   painel/            -> o painel HTML (vai embutido no .bat e e de onde o painel se atualiza sozinho)
//   pack.txt           -> numero do pacote de presets + previas (zip grande, fica nas Releases do GitHub)
// Uso:  node fonte/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), p = path.join(root, 'painel');
const REPO = 'rivatto/chavebaixa-vfx';

const jsx = fs.readFileSync(path.join(p, 'jsx', 'main.jsx'), 'utf8');
const ver = (/XRF\.VERSION = "([^"]+)"/.exec(jsx) || [, '?'])[1];
if (/[^\x00-\x7E]/.test(jsx)) throw new Error('painel/jsx/main.jsx precisa ser ASCII puro (use \\uXXXX nos acentos)');
const html = fs.readFileSync(path.join(p, 'index.html'), 'utf8');
if (html.indexOf('chavebaixa-vfx-panel v' + ver + ' ') < 0) throw new Error('marcador de versao ausente no index.html (esperava v' + ver + ')');
if (html.indexOf("var VERSION = '" + ver + "';") < 0) throw new Error('VERSION do index.html diferente da v' + ver);
const manifest = fs.readFileSync(path.join(p, 'CSXS', 'manifest.xml'), 'utf8');
if (manifest.indexOf('ExtensionBundleVersion="' + ver + '"') < 0) throw new Error('versao do manifest.xml diferente da v' + ver);
const art = fs.readFileSync(path.join(p, 'art.js'), 'utf8');
const fxi = fs.readFileSync(path.join(p, 'fx-index.js'), 'utf8');
const pack = fs.readFileSync(path.join(root, 'pack.txt'), 'utf8').trim();
if (!/^\d+$/.test(pack)) throw new Error('pack.txt precisa ser um numero');

const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n').replace(/\r\n$/, '');
const ps = "$l=[IO.File]::ReadAllLines($env:SELF); function X($a,$b,$o){ $i=[Array]::IndexOf($l,$a); $j=[Array]::IndexOf($l,$b); if($i -lt 0 -or $j -lt $i){exit 3}; " +
           "[IO.File]::WriteAllBytes($o,[Convert]::FromBase64String(($l[($i+1)..($j-1)] -join ''))) }; " +
           "X '::#INDEX#' '::#JSX#' ($env:EXT+'\\index.html'); X '::#JSX#' '::#ART#' ($env:EXT+'\\jsx\\main.jsx'); X '::#ART#' '::#FXI#' ($env:EXT+'\\art.js'); " +
           "X '::#FXI#' '::#MANIFEST#' ($env:EXT+'\\fx-index.js'); X '::#MANIFEST#' '::#END#' ($env:EXT+'\\CSXS\\manifest.xml')";
const head = [
  '@echo off',
  'setlocal',
  'title chavebaixa VFX ' + ver + ' - instalar',
  'set "SELF=%~f0"',
  'set "EXT=%APPDATA%\\Adobe\\CEP\\extensions\\com.chavebaixa.vfx"',
  'if not "%~1"=="" set "EXT=%~1"',
  'set "PACK=' + pack + '"',
  'set "PACKURL=https://github.com/' + REPO + '/releases/download/pack-' + pack + '/chavebaixa-vfx-pack.zip"',
  'if not "%~2"=="" set "PACKURL=%~2"',
  'set "ZIP=%TEMP%\\chavebaixa-vfx-pack.zip"',
  'echo chavebaixa VFX ' + ver,
  'echo.',
  '',
  'rem 1) copia o painel para a pasta de extensoes do After (pasta do usuario, sem administrador)',
  'if not exist "%EXT%\\CSXS" mkdir "%EXT%\\CSXS"',
  'if not exist "%EXT%\\jsx" mkdir "%EXT%\\jsx"',
  'powershell -NoProfile -ExecutionPolicy Bypass -Command "' + ps + '"',
  'if errorlevel 1 goto fail',
  'if not exist "%EXT%\\index.html" goto fail',
  'echo Painel gravado em %EXT%',
  '',
  'rem 2) presets + previas: um zip grande que fica no GitHub (so baixa se ainda nao tiver este pacote)',
  'set "HAVE="',
  'if exist "%EXT%\\pack.txt" set /p HAVE=<"%EXT%\\pack.txt"',
  'if "%HAVE%"=="%PACK%" if exist "%EXT%\\preset\\cc" goto packok',
  'echo.',
  'echo Baixando os presets e as previas (uns 960 MB, pode demorar)...',
  'if exist "%ZIP%" del "%ZIP%" >nul 2>&1',
  'curl.exe -L --fail --retry 3 -o "%ZIP%" "%PACKURL%"',
  'if errorlevel 1 powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=\'Tls12\'; (New-Object Net.WebClient).DownloadFile($env:PACKURL,$env:ZIP)"',
  'if not exist "%ZIP%" goto failpack',
  'echo Extraindo...',
  'tar.exe -xf "%ZIP%" -C "%EXT%"',
  'if errorlevel 1 powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath $env:ZIP -DestinationPath $env:EXT -Force"',
  'if not exist "%EXT%\\preset\\cc" goto failpack',
  'if not exist "%EXT%\\preset\\overlay" mkdir "%EXT%\\preset\\overlay"',
  '>"%EXT%\\pack.txt" echo %PACK%',
  'del "%ZIP%" >nul 2>&1',
  'echo Presets instalados.',
  ':packok',
  '',
  'rem 3) paineis nao assinados pela Adobe so abrem com esta opcao ligada (so para o seu usuario)',
  'if "%~1"=="" for %%N in (8 9 10 11 12 13 14 15 16) do reg add "HKCU\\Software\\Adobe\\CSXS.%%N" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1',
  '',
  'echo.',
  'echo Pronto.',
  'echo   1. Feche o After Effects e abra de novo.',
  'echo   2. Abra em  Window ^> Extensions ^> chavebaixa VFX',
  'echo.',
  'echo Depois disso o painel se atualiza sozinho.',
  'if "%~1"=="" if exist "%CommonProgramFiles(x86)%\\Adobe\\CEP\\extensions\\xrronafx" echo.',
  'if "%~1"=="" if exist "%CommonProgramFiles(x86)%\\Adobe\\CEP\\extensions\\xrronafx" echo AVISO: este PC tem o xrronafx antigo em "%CommonProgramFiles(x86)%\\Adobe\\CEP\\extensions\\xrronafx". Apague essa pasta para nao aparecer duplicado.',
  'echo.',
  'pause',
  'exit /b 0',
  '',
  ':fail',
  'echo.',
  'echo Nao consegui extrair os arquivos. Baixe o .bat de novo e tente outra vez.',
  'pause',
  'exit /b 1',
  '',
  ':failpack',
  'echo.',
  'echo O painel foi instalado, mas nao consegui baixar ou extrair os presets.',
  'echo Confira a internet e rode este .bat de novo.',
  'pause',
  'exit /b 2',
  ''
].join('\r\n');
const bat = head + '::#INDEX#\r\n' + b64(html) + '\r\n::#JSX#\r\n' + b64(jsx) + '\r\n::#ART#\r\n' + b64(art) + '\r\n::#FXI#\r\n' + b64(fxi) + '\r\n::#MANIFEST#\r\n' + b64(manifest) + '\r\n::#END#\r\n';
if (/[^\x00-\x7E]/.test(bat)) throw new Error('non-ASCII no bat');

fs.writeFileSync(path.join(root, 'version.txt'), ver + '\n', 'utf8');
fs.writeFileSync(path.join(root, 'Instalar-chavebaixa-vfx.bat'), bat, 'latin1');
console.log('ok v' + ver + ' | pacote ' + pack + ' | bat ' + bat.length + ' bytes');
