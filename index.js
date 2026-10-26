// Inv UI: a reading-first SillyTavern UI layer for Moonlit Echoes + ProbablyTooManyTabs.
// - Theme CSS ships in ./css (loaded by ST via style.css). Every layer reads --inv-* variables that this file
//   writes onto <html> from the settings below. Nothing lives in ST's Custom CSS box or CSS Snippets.
// - Settings: `shared` values apply on every device; `devices.desktop` / `devices.tablet` hold per-device values
//   (text size, image layout, ...). Which profile is active is decided per device at load.
// - Loads BEFORE TooManyTabs (loading_order 50 < 101) so it can set PTMT's shared isMobile flag per device.
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';

// Folder-agnostic: work out where this extension was installed from this module's own URL, so any folder
// name or install method works (URL installer, manual clone, junction).
const BASE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const PANEL_SOURCE = 'invui-panel';
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Lexend:wght@300..700&family=Atkinson+Hyperlegible+Next:wght@300..700&family=Nunito:wght@300..800&family=Literata:opsz,wght@7..72,300..700&display=swap';

// ======================================================================================
// 1) Device: decided per device, before TooManyTabs reads its shared flag
// ======================================================================================
const MODE_KEY = 'inv:layoutMode'; // 'auto' | 'mobile' | 'desktop', stored in THIS browser only
const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'auto'; } catch { return 'auto'; } };
function detectMobile(mode = readMode()) {
    if (mode === 'mobile') return true;
    if (mode === 'desktop') return false;
    const ua = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const narrowTouch = window.matchMedia?.('(max-width: 799px) and (pointer: coarse)')?.matches;
    return ua || !!narrowTouch;
}
const IS_MOBILE = detectMobile();
const DEVICE = IS_MOBILE ? 'tablet' : 'desktop';
if (extension_settings.PTMT) {
    extension_settings.PTMT.isMobile = IS_MOBILE;
    extension_settings.PTMT.showIconsOnly = IS_MOBILE;
}
document.documentElement.dataset.invDevice = IS_MOBILE ? 'mobile' : 'desktop';

// ======================================================================================
// 2) Settings model
// ======================================================================================
const PALETTES = [
    ['off', 'Your ST theme (no palette)'], ['lighthouse', 'Lighthouse (colorblind-tuned)'], ['nord', 'Nord Aurora (slate + yellow)'],
    ['hearth', 'Glimmer Hearth (blue + honey)'], ['tokyo', 'Tokyo Night (indigo + amber)'], ['kanagawa', 'Kanagawa (ink + gold)'],
    ['lantern', 'Midnight Lantern (indigo + lamp gold)'], ['harbor', 'Deep Harbor (teal + amber)'],
];
const FONTS = [
    ['Noto Sans, sans-serif', 'Noto Sans'], ['Nunito, Noto Sans, sans-serif', 'Nunito (soft, rounded)'],
    ['Lexend, Noto Sans, sans-serif', 'Lexend (easy reading)'], ['Atkinson Hyperlegible Next, Noto Sans, sans-serif', 'Atkinson Hyperlegible (max clarity)'],
    ['Literata, Georgia, serif', 'Literata (book serif)'], ['Segoe UI Variable Text, Segoe UI, sans-serif', 'Segoe UI'],
];
const LAYOUTS = {
    desktop: [['left', 'Side, left'], ['right', 'Side, right'], ['off', 'Off']],
    tablet: [['split', 'Split (image on top, chat below)'], ['backdrop', 'Backdrop (behind the text)'], ['band', 'Band (banner above each reply)'], ['side', 'Side (beside the text)'], ['off', 'Off']],
};
const IMAGE_DEFAULTS = {
    left: { size: 96, width: 30, focus: 0, fade: 30, pad: 12, fit: 'whole' },
    right: { size: 96, width: 30, focus: 0, fade: 30, pad: 12, fit: 'whole' },
    side: { size: 50, focus: 0, fade: 30, pad: 6 },
    split: { area: 50, size: 100, focus: 15, fade: 0 },
    backdrop: { strength: 30, focus: 15 },
    band: { size: 32, focus: 20 },
    off: {},
};
const DEFAULTS = {
    version: 1,
    enabled: true,
    shared: {
        palette: 'lighthouse', dialogue: 'palette', font: 'Nunito, Noto Sans, sans-serif', weight: 500, tracking: 0.02,
        uiGlow: 40, dlgGlow: 0, storyCard: 'card', userStyle: 'quiet', wallBlur: 8, wallDim: 20,
        spotlight: true, dimOld: false, dropcap: false, vignette: false, focusMode: false,
    },
    devices: {
        desktop: { textSize: 20, leading: 1.7, paraGap: 0.9, measure: 80, inputWidth: 62, glass: 20, solidity: 92, performance: false, layout: 'left', image: {} },
        tablet: { textSize: 18, leading: 1.6, paraGap: 0.8, measure: 80, inputWidth: 100, glass: 0, solidity: 95, performance: false, layout: 'split', image: {} },
    },
    presets: {},
};

const clone = o => structuredClone(o);
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

function loadSettings() {
    let s = extension_settings.invUI;
    if (!s) {
        s = clone(DEFAULTS);
        extension_settings.invUI = s;
    }
    // fill anything new since the settings were saved
    s.shared = { ...DEFAULTS.shared, ...s.shared };
    s.devices = s.devices || {};
    for (const dev of ['desktop', 'tablet']) s.devices[dev] = { ...clone(DEFAULTS.devices[dev]), ...s.devices[dev] };
    s.presets = s.presets || {};
    if (s.enabled === undefined) s.enabled = true;
    return s;
}
const settings = loadSettings();
const profile = () => settings.devices[DEVICE];
function imageParams(layout = profile().layout) {
    const d = profile();
    d.image[layout] = { ...clone(IMAGE_DEFAULTS[layout] || {}), ...(d.image[layout] || {}) };
    return d.image[layout];
}
const save = () => saveSettingsDebounced();

// ======================================================================================
// 3) Settings -> CSS variables
// ======================================================================================
function computeVars() {
    const s = settings.shared, d = profile(), L = d.layout, im = imageParams(L);
    const v = {
        'inv-palette': s.palette, 'inv-dialogue': s.dialogue, 'inv-font': s.font, 'inv-weight': s.weight, 'inv-tracking': s.tracking,
        'inv-ui-glow': s.uiGlow, 'inv-dlg-glow': s.dlgGlow, 'inv-story-card': s.storyCard, 'inv-user-style': s.userStyle,
        'inv-wall-blur': s.wallBlur, 'inv-wall-dim': s.wallDim, 'inv-spotlight': s.spotlight, 'inv-dim-old': s.dimOld,
        'inv-dropcap': s.dropcap, 'inv-vignette': s.vignette, 'inv-focus': s.focusMode,
        'inv-text-size': d.textSize, 'inv-leading': d.leading, 'inv-para-gap': d.paraGap, 'inv-measure': d.measure,
        'inv-input-width': d.inputWidth, 'inv-glass': d.glass, 'inv-mes-opacity': d.solidity, 'inv-performance': d.performance,
    };
    if (DEVICE === 'desktop') {
        Object.assign(v, {
            'inv-portrait-side': L, 'inv-mobile-portrait': 'side',
            'inv-portrait-height': im.size ?? 96, 'inv-portrait': im.width ?? 30, 'inv-portrait-focus': im.focus ?? 0,
            'inv-portrait-fade': im.fade ?? 30, 'inv-portrait-pad': im.pad ?? 12, 'inv-portrait-fit': im.fit ?? 'whole',
        });
    } else {
        v['inv-mobile-portrait'] = L;
        v['inv-portrait-side'] = 'left';
        if (L === 'split') Object.assign(v, { 'inv-stage-h': im.area, 'inv-stage-size': im.size, 'inv-stage-focus': im.focus, 'inv-stage-fade': im.fade });
        if (L === 'backdrop') Object.assign(v, { 'inv-backdrop-strength': im.strength, 'inv-stage-focus': im.focus });
        if (L === 'band') Object.assign(v, { 'inv-band-h': im.size, 'inv-stage-focus': im.focus });
        if (L === 'side') Object.assign(v, { 'inv-portrait-height': im.size, 'inv-portrait-focus': im.focus, 'inv-portrait-fade': im.fade, 'inv-portrait-pad': im.pad, 'inv-portrait-fit': 'whole' });
    }
    return v;
}
function applyVars() {
    const root = document.documentElement.style;
    for (const [k, val] of Object.entries(computeVars())) {
        if (val === undefined || val === null) continue;
        root.setProperty(`--${k}`, typeof val === 'boolean' ? String(val) : String(val));
    }
}
function themeLink() {
    // compare URL-encoded paths on both sides (folder names may contain spaces)
    return [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => new URL(l.href).pathname === `${BASE}/style.css`);
}
function applyEnabled() {
    const link = themeLink();
    if (link) link.disabled = !settings.enabled;
    document.documentElement.dataset.invui = settings.enabled ? 'on' : 'off';
}
function addHeadLink(id, href) {
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
}
addHeadLink('invui-fonts', FONTS_URL);
addHeadLink('invui-panel-css', `${BASE}/panel.css`);
applyVars();

// ======================================================================================
// 4) Panel definition: sections and fields
// ======================================================================================
const chatStyle = () => (document.body.classList.contains('echostyle') ? 'echo' : document.body.classList.contains('ripplestyle') ? 'ripple' : 'other');

const IMAGE_FIELD_META = {
    size: L => ({ left: ['Height (% of chat)', 40, 100, 1], right: ['Height (% of chat)', 40, 100, 1], side: ['Height (% of chat)', 25, 80, 1],
        split: ['Image size (100 = whole image fits)', 60, 250, 5], band: ['Banner height (% of chat)', 15, 60, 1] })[L],
    width: L => ({ left: ['Max width (% of screen)', 10, 50, 1], right: ['Max width (% of screen)', 10, 50, 1] })[L],
    area: L => ({ split: ['Image area (% of space above the input)', 25, 70, 1] })[L],
    focus: L => (L === 'off' ? null : ['Focus (0 = top, 100 = bottom)', 0, 100, 1]),
    fade: L => ({ left: ['Edge fade (%)', 0, 60, 1], right: ['Edge fade (%)', 0, 60, 1], side: ['Edge fade (%)', 0, 60, 1], split: ['Bottom fade (%)', 0, 40, 1] })[L],
    pad: L => ({ left: ['Padding (px)', 0, 40, 1], right: ['Padding (px)', 0, 40, 1], side: ['Padding (px)', 0, 30, 1] })[L],
    strength: L => ({ backdrop: ['Strength (%)', 10, 70, 1] })[L],
};

const SECTIONS = [
    { id: 'color', title: 'Colors & Glow', icon: 'fa-palette', fields: [
        { key: 'palette', scope: 'shared', type: 'select', label: 'Palette', options: PALETTES },
        { key: 'dialogue', scope: 'shared', type: 'select', label: 'Dialogue color', options: [['palette', 'Palette (calm, consistent)'], ['character', 'Per character (TooManyTabs)']] },
        { key: 'uiGlow', scope: 'shared', type: 'range', label: 'UI glow (%)', min: 0, max: 100, step: 5 },
        { key: 'dlgGlow', scope: 'shared', type: 'range', label: 'Dialogue glow (%)', min: 0, max: 100, step: 5 },
    ] },
    { id: 'text', title: 'Text', icon: 'fa-font', fields: [
        { key: 'font', scope: 'shared', type: 'select', label: 'Story font', options: FONTS },
        { key: 'textSize', scope: 'device', type: 'range', label: 'Text size (px)', min: 13, max: 26, step: 0.5 },
        { key: 'weight', scope: 'shared', type: 'range', label: 'Weight', min: 300, max: 700, step: 25 },
        { key: 'leading', scope: 'device', type: 'range', label: 'Line height', min: 1.2, max: 2.2, step: 0.05 },
        { key: 'tracking', scope: 'shared', type: 'range', label: 'Letter spacing (em)', min: -0.02, max: 0.08, step: 0.005 },
        { key: 'paraGap', scope: 'device', type: 'range', label: 'Paragraph gap (em)', min: 0, max: 2, step: 0.05 },
        { key: 'measure', scope: 'device', type: 'range', label: 'Reading width (chars/line)', min: 45, max: 160, step: 1 },
    ] },
    { id: 'messages', title: 'Messages', icon: 'fa-message', note: () => (IS_MOBILE ? 'On this tablet, cards are solid and unblurred for speed.' : ''), fields: [
        { key: 'storyCard', scope: 'shared', type: 'select', label: 'Story text box', options: [['card', 'Card (calm inner box)'], ['none', 'None']] },
        { key: 'userStyle', scope: 'shared', type: 'select', label: 'Your messages', options: [['quiet', 'Quiet (muted, accent rule)'], ['card', 'Card (tinted box)'], ['plain', 'Plain']] },
        { key: 'solidity', scope: 'device', type: 'range', label: 'Card solidity (%)', min: 30, max: 100, step: 1, show: () => !IS_MOBILE },
        { key: 'glass', scope: 'device', type: 'range', label: 'Card glass blur (px)', min: 0, max: 40, step: 1, show: () => !IS_MOBILE },
        { key: 'spotlight', scope: 'shared', type: 'check', label: 'Spotlight latest reply' },
        { key: 'dimOld', scope: 'shared', type: 'check', label: 'Dim older messages' },
    ] },
    { id: 'background', title: 'Background', icon: 'fa-image', fields: [
        { key: 'wallBlur', scope: 'shared', type: 'range', label: 'Wallpaper blur (px)', min: 0, max: 20, step: 1, show: () => !IS_MOBILE },
        { key: 'wallDim', scope: 'shared', type: 'range', label: 'Wallpaper dim (%)', min: 0, max: 80, step: 1 },
        { key: 'vignette', scope: 'shared', type: 'check', label: 'Cinematic vignette' },
    ] },
    { id: 'image', title: 'Character image', icon: 'fa-user', fields: 'image' },
    { id: 'input', title: 'Input & Layout', icon: 'fa-keyboard', fields: [
        { key: 'inputWidth', scope: 'device', type: 'range', label: 'Input width (% of chat)', min: 35, max: 100, step: 1, show: () => !IS_MOBILE },
        { key: 'focusMode', scope: 'shared', type: 'check', label: 'Focus mode (chrome fades until hover)' },
    ] },
    { id: 'extras', title: 'Extras', icon: 'fa-wand-magic-sparkles', fields: [
        { key: 'dropcap', scope: 'shared', type: 'check', label: 'Book drop cap' },
        { key: 'performance', scope: 'device', type: 'check', label: 'Performance mode (no blur, shadows, animation)' },
    ] },
];

function imageFields() {
    const L = profile().layout;
    const fields = [{ key: 'layout', scope: 'device', type: 'select', label: 'Layout', options: LAYOUTS[DEVICE] }];
    if (L === 'left' || L === 'right') fields.push({ key: 'fit', scope: 'image', type: 'select', label: 'Fit', options: [['whole', 'Whole image'], ['fill', 'Fill width (cropped)']] });
    for (const key of ['area', 'size', 'width', 'focus', 'fade', 'pad', 'strength']) {
        const meta = IMAGE_FIELD_META[key](L);
        if (!meta) continue;
        if (key === 'focus' && (L === 'left' || L === 'right') && imageParams(L).fit !== 'fill') continue; // whole image shows everything
        if (key === 'width' && imageParams(L).fit === 'whole') meta[0] = 'Max width (% of screen)';
        const [label, min, max, step] = meta;
        fields.push({ key, scope: 'image', type: 'range', label, min, max, step });
    }
    return fields;
}
function imageNote() {
    const st = chatStyle();
    if (DEVICE === 'desktop' && st === 'echo') return 'Echo chat style: its image is controlled by Moonlit’s own Echo settings. These controls apply to Ripple.';
    if (DEVICE === 'desktop' && st !== 'ripple') return 'These controls apply to the Ripple chat style (Moonlit).';
    if (DEVICE === 'tablet' && st !== 'ripple' && profile().layout !== 'split' && profile().layout !== 'off') return 'Backdrop, Band and Side need the Ripple chat style. Split works with any style.';
    return '';
}

// ======================================================================================
// 5) Panel rendering
// ======================================================================================
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const openKey = id => `invui:open:${DEVICE}:${id}`;
const isOpen = id => { try { return localStorage.getItem(openKey(id)) === '1'; } catch { return false; } };

function getValue(f) {
    if (f.scope === 'shared') return settings.shared[f.key];
    if (f.scope === 'device') return profile()[f.key];
    return imageParams()[f.key];
}
function setValue(f, val) {
    if (f.scope === 'shared') settings.shared[f.key] = val;
    else if (f.scope === 'device') profile()[f.key] = val;
    else imageParams()[f.key] = val;
}

function fieldHTML(f) {
    const v = getValue(f);
    const devIcon = f.scope === 'shared' ? '' : `<i class="fa-solid ${IS_MOBILE ? 'fa-tablet-screen-button' : 'fa-desktop'}" title="Saved separately for this device"></i>`;
    const label = `<span class="invui-label">${esc(f.label)} ${devIcon}</span>`;
    const id = `invui-${f.scope}-${f.key}`;
    if (f.type === 'select') {
        const opts = f.options.map(([val, text]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(text)}</option>`).join('');
        return `<div class="invui-row">${label}<select class="text_pole" data-f="${f.scope}:${f.key}" id="${id}">${opts}</select></div>`;
    }
    if (f.type === 'check') {
        return `<div class="invui-row">${label}<input type="checkbox" class="invui-check" data-f="${f.scope}:${f.key}" id="${id}" ${v ? 'checked' : ''}></div>`;
    }
    return `<div class="invui-row">${label}<div class="invui-range">
        <input type="range" class="neo-range-slider" data-f="${f.scope}:${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
        <input type="number" class="text_pole" data-f="${f.scope}:${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}">
    </div></div>`;
}

function sectionFields(sec) { return (sec.fields === 'image' ? imageFields() : sec.fields).filter(f => !f.show || f.show()); }
function findField(scope, key) {
    for (const sec of SECTIONS) for (const f of sectionFields(sec)) if (f.scope === scope && f.key === key) return f;
    return null;
}

function renderPanel() {
    const host = document.getElementById('invui-panel');
    if (!host) return;
    const scroll = host.scrollTop;
    const sections = SECTIONS.map(sec => {
        const note = sec.id === 'image' ? imageNote() : (sec.note ? sec.note() : '');
        const body = sectionFields(sec).map(fieldHTML).join('');
        return `<details class="invui-section" data-sec="${sec.id}" ${isOpen(sec.id) ? 'open' : ''}>
            <summary><i class="fa-solid ${sec.icon}"></i> ${esc(sec.title)}</summary>
            <div class="invui-body">${note ? `<div class="invui-note">${esc(note)}</div>` : ''}${body}
                <div class="invui-actions"><div class="menu_button" data-act="reset-section" data-sec="${sec.id}"><i class="fa-solid fa-rotate-left"></i> Reset section</div></div>
            </div></details>`;
    }).join('');
    const presetNames = Object.keys(settings.presets);
    const presetOpts = presetNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    host.innerHTML = `
        <div class="invui-head">
            <span class="invui-title"><i class="fa-solid fa-sliders"></i> Inv UI</span>
            <span class="invui-device"><i class="fa-solid ${IS_MOBILE ? 'fa-tablet-screen-button' : 'fa-desktop'}"></i> ${IS_MOBILE ? 'Tablet' : 'Desktop'} profile</span>
            <label class="invui-master"><input type="checkbox" data-act="master" ${settings.enabled ? 'checked' : ''}> Styling on</label>
        </div>
        <div class="invui-note"><i class="fa-solid ${IS_MOBILE ? 'fa-tablet-screen-button' : 'fa-desktop'}"></i> = saved separately for this device. Everything else is shared by all devices.</div>
        ${sections}
        <details class="invui-section" data-sec="manage" ${isOpen('manage') ? 'open' : ''}>
            <summary><i class="fa-solid fa-box-archive"></i> Presets & backup</summary>
            <div class="invui-body">
                <div class="invui-row"><span class="invui-label">Preset</span><select class="text_pole" id="invui-preset">${presetOpts || '<option value="">(none saved)</option>'}</select></div>
                <div class="invui-actions">
                    <div class="menu_button" data-act="preset-save"><i class="fa-solid fa-floppy-disk"></i> Save as preset</div>
                    <div class="menu_button" data-act="preset-load"><i class="fa-solid fa-upload"></i> Load</div>
                    <div class="menu_button" data-act="preset-delete"><i class="fa-solid fa-trash-can"></i> Delete</div>
                </div>
                <div class="invui-actions">
                    <div class="menu_button" data-act="copy-device"><i class="fa-solid fa-copy"></i> Copy this device's settings to the ${IS_MOBILE ? 'desktop' : 'tablet'}</div>
                </div>
                <div class="invui-actions">
                    <div class="menu_button" data-act="export"><i class="fa-solid fa-file-export"></i> Export</div>
                    <div class="menu_button" data-act="import"><i class="fa-solid fa-file-import"></i> Import</div>
                    <div class="menu_button redWarningBG" data-act="reset-all"><i class="fa-solid fa-rotate-left"></i> Reset everything</div>
                </div>
            </div>
        </details>`;
    host.scrollTop = scroll;
}

function onPanelInput(ev) {
    const el = ev.target;
    const tag = el.dataset.f;
    if (!tag) return;
    const [scope, key] = tag.split(':');
    const f = findField(scope, key);
    if (!f) return;
    let val;
    if (f.type === 'check') val = el.checked;
    else if (f.type === 'select') val = el.value;
    else {
        val = num(el.value, getValue(f));
        el.closest('.invui-range')?.querySelectorAll('input').forEach(i => { if (i !== el) i.value = val; });
    }
    setValue(f, val);
    applyVars();
    save();
    // layout / fit change which image controls exist
    if (ev.type === 'change' && (key === 'layout' || key === 'fit')) renderPanel();
}

async function onPanelClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'master') {
        settings.enabled = btn.checked; applyEnabled(); save(); return;
    }
    if (act === 'reset-section') {
        const sec = SECTIONS.find(s => s.id === btn.dataset.sec);
        if (!sec) return;
        if (sec.fields === 'image') {
            const L = profile().layout;
            profile().image[L] = clone(IMAGE_DEFAULTS[L] || {});
        } else {
            for (const f of sec.fields) {
                if (f.scope === 'shared') settings.shared[f.key] = DEFAULTS.shared[f.key];
                else profile()[f.key] = DEFAULTS.devices[DEVICE][f.key];
            }
        }
        applyVars(); save(); renderPanel(); return;
    }
    if (act === 'copy-device') {
        const other = IS_MOBILE ? 'desktop' : 'tablet';
        const keep = settings.devices[other].layout; // layouts differ per device type; keep the other device's
        const keepImage = settings.devices[other].image;
        settings.devices[other] = { ...clone(profile()), layout: keep, image: keepImage };
        save(); toastr.success(`Text and card settings copied to the ${other} profile.`, 'Inv UI'); return;
    }
    if (act === 'preset-save') {
        const name = await callGenericPopup('Preset name:', POPUP_TYPE.INPUT, '');
        if (!name) return;
        settings.presets[String(name)] = clone({ shared: settings.shared, devices: settings.devices });
        save(); renderPanel(); toastr.success(`Saved preset "${name}".`, 'Inv UI'); return;
    }
    const sel = document.getElementById('invui-preset')?.value;
    if (act === 'preset-load' && sel && settings.presets[sel]) {
        const p = clone(settings.presets[sel]);
        settings.shared = { ...DEFAULTS.shared, ...p.shared };
        settings.devices = p.devices;
        applyVars(); save(); renderPanel(); toastr.success(`Loaded preset "${sel}".`, 'Inv UI'); return;
    }
    if (act === 'preset-delete' && sel && settings.presets[sel]) {
        const ok = await callGenericPopup(`Delete preset "${esc(sel)}"?`, POPUP_TYPE.CONFIRM);
        if (!ok) return;
        delete settings.presets[sel]; save(); renderPanel(); return;
    }
    if (act === 'export') {
        const blob = new Blob([JSON.stringify({ invUI: 1, shared: settings.shared, devices: settings.devices, presets: settings.presets }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `inv-ui-${new Date().toISOString().slice(0, 10)}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000); return;
    }
    if (act === 'import') {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.onchange = async () => {
            try {
                const data = JSON.parse(await input.files[0].text());
                if (!data.shared || !data.devices) throw new Error('Not an Inv UI export');
                settings.shared = { ...DEFAULTS.shared, ...data.shared };
                settings.devices = data.devices;
                if (data.presets) settings.presets = data.presets;
                applyVars(); save(); renderPanel(); toastr.success('Imported.', 'Inv UI');
            } catch (e) { toastr.error(String(e.message || e), 'Inv UI import'); }
        };
        input.click(); return;
    }
    if (act === 'reset-all') {
        const ok = await callGenericPopup('Reset every Inv UI setting (both devices) to defaults? Presets are kept.', POPUP_TYPE.CONFIRM);
        if (!ok) return;
        const presets = settings.presets;
        Object.assign(settings, clone(DEFAULTS), { presets });
        applyVars(); save(); renderPanel();
    }
}

function onToggle(ev) {
    const d = ev.target;
    if (!(d instanceof HTMLDetailsElement) || !d.dataset.sec) return;
    try { localStorage.setItem(openKey(d.dataset.sec), d.open ? '1' : '0'); } catch { /* storage blocked */ }
}

function buildPanelHost() {
    let host = document.getElementById('invui-panel');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'invui-panel';
    host.addEventListener('input', onPanelInput);
    host.addEventListener('change', onPanelInput);
    host.addEventListener('click', onPanelClick);
    host.addEventListener('toggle', onToggle, true);
    return host;
}

// ======================================================================================
// 6) Dock the panel as a TooManyTabs tab (fallback: Extensions settings drawer)
// ======================================================================================
function dockPanel() {
    const api = window.ptmtTabs;
    const host = buildPanelHost();
    if (!api) {
        const target = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
        if (!target) return false;
        if (!target.contains(host)) target.prepend(host);
        renderPanel();
        return true;
    }
    // PTMT rebuilds saved tabs on load as empty placeholders; refill ours where the user left it
    const existing = document.querySelector(`.ptmt-panel[data-source-id="${PANEL_SOURCE}"]`);
    let pane = existing?.closest('.ptmt-pane');
    if (!pane || pane.closest('.ptmt-body-column')?.offsetParent === null) {
        // first run, or the saved column is hidden (mobile layout hides the side columns)
        pane = document.querySelector(`#ptmt-${IS_MOBILE ? 'center' : 'left'}Body .ptmt-pane`);
    }
    if (!pane) return false;
    if (existing) {
        const root = existing.querySelector('.ptmt-panel-content');
        if (!root.contains(host)) root.appendChild(host);
    } else {
        api.createTabFromContent(host, { title: 'Inv UI', icon: 'fa-sliders', sourceId: PANEL_SOURCE, makeActive: false }, pane);
        window.dispatchEvent(new CustomEvent('ptmt:layoutChanged', { detail: { reason: 'invui-dock' } }));
    }
    renderPanel();
    return true;
}
async function dockWhenReady() {
    for (let i = 0; i < 80; i++) {
        if (window.ptmtTabs && dockPanel()) return;
        await new Promise(r => setTimeout(r, 250));
    }
    dockPanel(); // fallback without TooManyTabs
}

// ======================================================================================
// 7) Stage image for the tablet Split layout
// ======================================================================================
let stageTimer = null;
function updateStage() {
    const bots = document.querySelectorAll('#chat .mes[is_user="false"]');
    const last = bots[bots.length - 1];
    let url = '';
    if (last) {
        const cs = getComputedStyle(last);
        url = cs.getPropertyValue('--mes-avatar-original-url').trim() || cs.getPropertyValue('--mes-avatar-url').trim();
        if (!url) { const src = last.querySelector('.avatar img')?.getAttribute('src'); if (src) url = `url("${src}")`; }
    }
    if (!url) {
        const ctx = SillyTavern.getContext();
        const ch = ctx.characters?.[ctx.characterId];
        if (ch?.avatar) url = `url("/characters/${encodeURIComponent(ch.avatar)}")`;
    }
    if (url) document.documentElement.style.setProperty('--inv-stage-url', url);
    else document.documentElement.style.removeProperty('--inv-stage-url');
}
const scheduleStage = () => { clearTimeout(stageTimer); stageTimer = setTimeout(updateStage, 150); };
for (const name of ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED']) {
    if (event_types[name]) eventSource.on(event_types[name], scheduleStage);
}

// ======================================================================================
// 8) Slash command: per-device layout mode
// ======================================================================================
SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'inv-layout',
    helpString: 'Inv UI: layout mode for THIS device only (auto, mobile, desktop). No argument shows the current mode. Changing it reloads the page.',
    unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'auto | mobile | desktop', typeList: [ARGUMENT_TYPE.STRING], isRequired: false, enumList: ['auto', 'mobile', 'desktop'] })],
    callback: (_a, value) => {
        const mode = String(value ?? '').trim().toLowerCase();
        if (!mode) { const m = `Layout mode on this device: ${readMode()} (currently ${IS_MOBILE ? 'mobile' : 'desktop'})`; toastr.info(m, 'Inv UI'); return m; }
        if (!['auto', 'mobile', 'desktop'].includes(mode)) { toastr.error('Use: /inv-layout auto | mobile | desktop', 'Inv UI'); return ''; }
        try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage blocked */ }
        window.location.href = window.location.pathname; // navigate, not reload (PTMT replays a checkpoint on reload)
        return mode;
    },
}));

// ======================================================================================
// 9) Health checks
// ======================================================================================
function healthChecks() {
    // another full-UI theme extension competes with these styles
    if (document.getElementById('latheme')) toastr.warning('LATheme is enabled and will compete with Inv UI’s styling.', 'Inv UI');
    // requirements: Moonlit Echoes (look, chat styles) and ProbablyTooManyTabs (layout, docking, mobile mode)
    setTimeout(() => {
        const missing = [];
        if (!document.querySelector('script[src*="MoonlitEchoesTheme"]')) missing.push('Moonlit Echoes');
        if (!window.ptmtTabs) missing.push('ProbablyTooManyTabs');
        if (missing.length) toastr.info(`Inv UI works best with ${missing.join(' and ')}. Some controls won't apply without it.`, 'Inv UI', { timeOut: 8000 });
    }, 15000);
}

// re-render when the chat style changes (Ripple / Echo / ...), since image controls depend on it
let lastStyle = '';
new MutationObserver(() => {
    const st = chatStyle();
    if (st !== lastStyle) { lastStyle = st; renderPanel(); }
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

eventSource.on(event_types.APP_READY, async () => {
    applyEnabled();
    applyVars();
    healthChecks();
    setTimeout(dockWhenReady, 400);
    scheduleStage();
});
