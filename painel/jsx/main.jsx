// chavebaixa VFX 2.0 - lado do After Effects (ExtendScript / ES3)
var XRF = XRF || {};
XRF.VERSION = "2.1.0";

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

    XRF.ping = function () {
        try {
            var c = activeComp();
            if (!c) { return '{"ok":true,"comp":"","sel":0,"version":' + q(XRF.VERSION) + '}'; }
            return '{"ok":true,"comp":' + q(c.name) + ',"sel":' + c.selectedLayers.length + ',"version":' + q(XRF.VERSION) + '}';
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
    XRF.apply = function (path, mode, label) {
        var comp = activeComp();
        if (!comp) { return fail('Abra uma composi\u00e7\u00e3o primeiro (clique na timeline dela).'); }
        var file = new File(path);
        if (!file.exists) { return fail('N\u00e3o achei o arquivo do preset:\n' + path); }
        var sel = comp.selectedLayers, layers = [], i, done = 0, undo = false;
        for (i = 0; i < sel.length; i++) { layers.push(sel[i]); }
        if (mode !== 'adj' && !layers.length) { return fail('Selecione pelo menos uma camada na timeline.'); }
        try {
            app.beginUndoGroup('chavebaixa VFX: ' + (label || 'preset')); undo = true;
            if (mode === 'adj') {
                var adj = comp.layers.addSolid([1, 1, 1], 'FX ' + (label || 'chavebaixa VFX'), comp.width, comp.height, comp.pixelAspect, comp.duration);
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
                done = 1;
            } else {
                // applyPreset age em TODAS as camadas selecionadas: por isso uma de cada vez
                for (i = 0; i < layers.length; i++) {
                    selectOnly(comp, layers[i]);
                    layers[i].applyPreset(file);
                    done++;
                }
                selectOnly(comp, null);
                for (i = 0; i < layers.length; i++) { layers[i].selected = true; }
            }
            app.endUndoGroup();
            return ok(mode === 'adj' ? 'Aplicado numa camada de ajuste nova.' : ('Aplicado em ' + done + (done === 1 ? ' camada.' : ' camadas.')));
        } catch (e) {
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
