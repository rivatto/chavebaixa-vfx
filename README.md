# chavebaixa VFX

Painel de presets para o After Effects: color, shake, mix fx, liquid, text e CRT, com prévia em GIF, busca, favoritos e aparência personalizável.

## Instalar

1. Baixe o arquivo **Instalar-chavebaixa-vfx.bat** deste repositório e dê dois cliques nele.
2. Espere baixar os presets e as prévias (uns 960 MB).
3. Feche o After Effects e abra de novo.
4. Abra em **Window > Extensions > chavebaixa VFX**.

Não precisa de administrador. Depois de instalado, o painel se atualiza sozinho.

## Avisos

- Presets marcados com **!** usam plugins de terceiros que não estão instalados no seu After. Eles aplicam, mas esses efeitos ficam sem funcionar até instalar o plugin.
- Funciona no After Effects CC 2015 ou mais novo, no Windows.

## Para quem mantém

- `painel/` é o painel. `node fonte/build.js` gera o `.bat`; `node fonte/publicar.js` gera e publica.
- Os presets e GIFs ficam num zip nas Releases (`pack-N`). Para publicar um pacote novo: aumente o número em `pack.txt` e rode `node fonte/publicar.js --pack caminho\chavebaixa-vfx-pack.zip`.
