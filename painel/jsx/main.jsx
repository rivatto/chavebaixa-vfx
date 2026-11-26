// chavebaixa VFX 2.0 - lado do After Effects (ExtendScript / ES3)
var XRF = XRF || {};
XRF.VERSION = "2.1.3";

(function () {
    function q(s) {
        return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, '\\n').replace(/\t/g, ' ') + '"';
    }
    function ok(msg, extra) { return '{"ok":true,"msg":' + q(msg || '') + (extra ? ',' + extra : '') + '}'; }
    function fail(msg, extra) { return '{"ok":false,"msg":' + q(msg || '') + (extra ? ',' + extra : '') + '}'; }
    function activeComp() {
        var c = app.project ? app.project.activeItem : null;
        return (c && c instanceof CompItem) ? c : null;
    }
    function errText(e) {
        var m = String((e && e.message) ? e.message : e);
        return m.replace(/^After Effects error:\s*/i, '');
    }
    function isNewer(e) { return /newer version/i.test(String((e && e.message) ? e.message : e)); }
    function selectOnly(comp, layer) {
        var sel = comp.selectedLayers, i;
        for (i = 0; i < sel.length; i++) { sel[i].selected = false; }
        if (layer) { layer.selected = true; }
    }

    // Presets guardam as coordenadas dos efeitos (centro do Optics Compensation, Twirl, CC Lens, Radial Blur, ancora do
    // Transform...) em pixels da camada de quem salvou. Num preset feito em 4K o centro fica em 1920,1080, que numa camada
    // Full HD e o canto. Aqui o tamanho original e descoberto pelo centro que o preset usa e todos os pontos dos efeitos
    // novos sao convertidos para o tamanho desta camada.
    var CENTER_RX = /cent(er|re|ro)|centr|mittel|zentr/i;
    function firstVal(pr) { return pr.numKeys > 0 ? pr.keyValue(1) : pr.value; }
    function eachPoint(layer, fromIndex, fn) {
        var fx = layer.property("ADBE Effect Parade"), e, p, ef, pr;
        for (e = fromIndex; e <= fx.numProperties; e++) {
            ef = fx.property(e);
            for (p = 1; p <= ef.numProperties; p++) {
                pr = ef.property(p);
                try { if (pr.propertyValueType === PropertyValueType.TwoD_SPATIAL) { fn(ef, pr); } } catch (e4) {}
            }
        }
    }
    function mapProp(pr, f) {
        var k;
        if (pr.numKeys > 0) { for (k = 1; k <= pr.numKeys; k++) { pr.setValueAtKey(k, f(pr.keyValue(k))); } }
        else { pr.setValue(f(pr.value)); }
    }
    function centerPoints(layer, fromIndex) {
        var n = 0;
        try {
            var w = layer.width, h = layer.height;
            if (!w || !h) { return 0; }
            var votes = {}, best = null;
            eachPoint(layer, fromIndex, function (ef, pr) {
                var v = firstVal(pr), cand = false, pos;
                if (ef.matchName === "ADBE Geometry2") {
                    // a ancora do Transform so conta como centro quando esta junto da posicao (Transform "parado")
                    if (pr.matchName === "ADBE Geometry2-0001") { pos = firstVal(ef.property("ADBE Geometry2-0002")); cand = Math.abs(pos[0] - v[0]) < 1 && Math.abs(pos[1] - v[1]) < 1; }
                } else { cand = CENTER_RX.test(pr.name); }
                if (cand) {
                    var key = Math.round(v[0]) + "," + Math.round(v[1]);
                    votes[key] = (votes[key] || 0) + 1;
                    if (best === null || votes[key] > votes[best]) { best = key; }
                }
            });
            if (best === null) { return 0; }
            var c = best.split(","), sx = (w / 2) / Number(c[0]), sy = (h / 2) / Number(c[1]);
            if (!(Number(c[0]) > 0 && Number(c[1]) > 0)) { return 0; }
            if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) { return 0; }   // preset feito neste mesmo tamanho
            eachPoint(layer, fromIndex, function (ef, pr) {
                try { mapProp(pr, function (v) { return [v[0] * sx, v[1] * sy]; }); n++; } catch (e5) {}
            });
            // Transform parado com ancora e posicao separadas empurra a imagem para fora do meio: centraliza os dois
            var fx = layer.property("ADBE Effect Parade"), e, ef, an, po, va, vp;
            for (e = fromIndex; e <= fx.numProperties; e++) {
                ef = fx.property(e);
                if (ef.matchName !== "ADBE Geometry2") { continue; }
                try {
                    an = ef.property("ADBE Geometry2-0001"); po = ef.property("ADBE Geometry2-0002");
                    if (an.numKeys || po.numKeys || an.expressionEnabled || po.expressionEnabled) { continue; }
                    va = an.value; vp = po.value;
                    if (Math.abs(va[0] - vp[0]) < 1 && Math.abs(va[1] - vp[1]) < 1) { continue; }
                    an.setValue([w / 2, h / 2]); po.setValue([w / 2, h / 2]); n++;
                } catch (e6) {}
            }
        } catch (e3) {}
        return n;
    }    function fxCount(layer) { try { return layer.property("ADBE Effect Parade").numProperties; } catch (e) { return 0; } }

    XRF.ping = function () {
        try {
            var c = activeComp();
            if (!c) { return '{"ok":true,"comp":"","sel":0,"ae":' + (parseFloat(app.version) || 0) + ',"version":' + q(XRF.VERSION) + '}'; }
            return '{"ok":true,"comp":' + q(c.name) + ',"sel":' + c.selectedLayers.length + ',"ae":' + (parseFloat(app.version) || 0) + ',"version":' + q(XRF.VERSION) + '}';
        } catch (e) { return fail(errText(e)); }
    };

    // recebe os matchNames separados por \n e devolve os que nao estao instaladados
    XRF.missing = function (list) {
        try {
            var have = {}, i, fx = app.effects, out = [];
            for (i = 0; i < fx.length; i++) { have[fx[i].matchName] = true; }
            var names = String(list).split('\n');
            for (i = 0; i < names.length; i++) { if (names[i] && !have[names[i]]) { out.push(q(names[i])); } }
            return '{"ok":true,"missing":[' + out.join(',') + ']}';
        } catch (e) { return fail(errText(e)); }
    };

    // mode: "sel" = nas camadas selecionadas, "adj" = numa camada de ajuste nova
    XRF.apply = function (path, mode, label, center) {
        var comp = activeComp();
        if (!comp) { return fail('Abra uma composi\u00e7\u00e3o primeiro (clique na timeline dela).'); }
        var file = new File(path);
        if (!file.exists) { return fail('N\u00e3o achei o arquivo do preset:\n' + path); }
        var sel = comp.selectedLayers, layers = [], i, done = 0, undo = false, adj = null, nfx = 0;
        for (i = 0; i < sel.length; i++) { layers.push(sel[i]); }
        if (mode !== 'adj' && !layers.length) { return fail('Selecione pelo menos uma camada na timeline.'); }
        try {
            app.beginUndoGroup('chavebaixa VFX: ' + (label || 'preset')); undo = true;
            if (mode === 'adj') {
                adj = comp.layers.addSolid([1, 1, 1], 'FX ' + (label || 'chavebaixa VFX'), comp.width, comp.height, comp.pixelAspect, comp.duration);
                adj.adjustmentLayer = true;
                if (layers.length) {
                    var top = layers[0], a = layers[0].inPoint, b = layers[0].outPoint;
                    for (i = 1; i < layers.length; i++) {
                        if (layers[i].index < top.index) { top = layers[i]; }
                        a = Math.min(a, layers[i].inPoint); b = Math.max(b, layers[i].outPoint);
                    }
                    adj.moveBefore(top);
                    if (b > a) { adj.inPoint = Math.max(0, a); adj.outPoint = Math.min(comp.duration, b); }
                }
                selectOnly(comp, adj);
                adj.applyPreset(file);
                if (center === '1') { centerPoints(adj, 1); }
                done = 1;
            } else {
                // applyPreset age em TODAS as camadas selecionadas: por isso uma de cada vez
                for (i = 0; i < layers.length; i++) {
                    selectOnly(comp, layers[i]);
                    nfx = fxCount(layers[i]);
                    layers[i].applyPreset(file);
                    if (center === '1') { centerPoints(layers[i], nfx + 1); }
                    done++;
                }
                selectOnly(comp, null);
                for (i = 0; i < layers.length; i++) { layers[i].selected = true; }
            }
            app.endUndoGroup();
            return ok(mode === 'adj' ? 'Aplicado numa camada de ajuste nova.' : ('Aplicado em ' + done + (done === 1 ? ' camada.' : ' camadas.')));
        } catch (e) {
            // a camada de ajuste criada para um preset que falhou nao pode sobrar na comp
            if (adj) { try { var src = adj.source; adj.remove(); if (src && src.usedIn.length === 0) { src.remove(); } } catch (e3) {} for (i = 0; i < layers.length; i++) { try { layers[i].selected = true; } catch (e4) {} } }
            if (undo) { try { app.endUndoGroup(); } catch (e2) {} }
            if (isNewer(e)) { return fail('Este preset foi salvo num After mais novo.', '"newer":true'); }
            return fail('O After recusou este preset:\n' + errText(e));
        }
    };

    XRF.overlay = function (path) {
        var comp = activeComp();
        if (!comp) { return fail('Abra uma composi\u00e7\u00e3o primeiro (clique na timeline dela).'); }
        var file = new File(path);
        if (!file.exists) { return fail('N\u00e3o achei o arquivo do overlay:\n' + path); }
        var undo = false;
        try {
            app.beginUndoGroup('chavebaixa VFX: overlay'); undo = true;
            var footage = null, i, it;
            for (i = 1; i <= app.project.numItems; i++) {   // reaproveita se ja foi importado
                it = app.project.item(i);
                if (it instanceof FootageItem && it.file && it.file.fsName === file.fsName) { footage = it; break; }
            }
            if (!footage) { footage = app.project.importFile(new ImportOptions(file)); }
            var layer = comp.layers.add(footage);
            layer.name = 'Overlay: ' + footage.name;
            layer.moveToBeginning();
            app.endUndoGroup();
            return ok('Overlay adicionado no topo da composi\u00e7\u00e3o.');
        } catch (e) {
            if (undo) { try { app.endUndoGroup(); } catch (e2) {} }
            return fail('N\u00e3o consegui importar o overlay:\n' + errText(e));
        }
    };

    XRF.openFolder = function (path) {
        try {
            var f = new Folder(path);
            if (!f.exists) { f.create(); }
            f.execute();
            return ok('');
        } catch (e) { return fail(errText(e)); }
    };
})();

// compatibilidade com o painel antigo
function par(presetPath) { return /"ok":true/.test(XRF.apply(presetPath, 'sel', '')) ? 'success' : 'error'; }
function importOverlay(overlayPath) { return /"ok":true/.test(XRF.overlay(overlayPath)) ? 'success' : 'error'; }
