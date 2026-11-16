// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         3.1.1
// @description     115 改名工具｜双源混合刮削｜极速竞速机制｜并发池化｜深色模式适配｜正式版
// @author          sonarlee
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @connect         *
// @grant           GM_notification
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM_setClipboard
// @grant           GM_registerMenuCommand
// @grant           GM_addStyle
// @grant           unsafeWindow
// @license         MIT
// @run-at          document-idle
// @updateURL       https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js
// @downloadURL     https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '3.1.1';

    // ==================== 番号识别算法 ====================
    const OD = (function () {
        const FC2_PATTERN = /\b(?:FC2[-_\s]?(?:PPV[-_\s]?)?|PPV[-_\s]?)(\d{6,9})(?:[-_\s](\d{1,2}|[A-Za-z]))?\b/i;
        const GARBAGE_PREFIX = ["FULLHD", "H264", "H265", "1080P", "720P", "PART", "DISC", "10BIT"];
        const stripLink = s => String(s || '').replace(/urn:btih:[a-z0-9]+/gi, ' ').replace(/\|(?:\d{6,}|[a-f0-9]{32})(?=\|)/gi, '| ');
        const stripDate = s => String(s || '').replace(/\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ');

        function normalizeCode(code) {
            const s = String(code || '').trim();
            if (!s) return '';
            const fc = s.match(/^(?:FC2[-_\s]?(?:PPV[-_\s]?)?|PPV[-_\s]?)(\d{6,9})$/i);
            if (fc) return `FC2-PPV-${fc[1]}`;
            const u = s.replace(/\s+/g, '-').toUpperCase();
            const un = u.match(/(\d{6})[-_](\d{2,3})/);
            if (un) return `${un[1]}${un[0].includes('_') ? '_' : '-'}${un[2]}`;
            const c = u.match(/^([A-Z]{2,10})(\d{3,6})$/);
            if (c) return `${c[1]}-${c[2].replace(/^0+(?=\d{3})/, '')}`;
            const std = u.match(/^([A-Z0-9]{2,15}[-_]\d{2,9})/);
            return std ? std[1] : u;
        }

        function extractCode(raw) {
            if (!raw) return null;
            let s = stripLink(raw);
            s = stripDate(s);
            const fc = s.match(FC2_PATTERN);
            if (fc) return normalizeCode(`FC2-PPV-${fc[1]}`);
            const m = s.match(/\b([A-Z0-9][A-Z0-9]{1,14})[-_\s](\d{2,10})(?:[-_](\d{1,3}))?/i);
            if (m && !GARBAGE_PREFIX.includes(m[1].toUpperCase())) {
                return normalizeCode(`${m[1].toUpperCase()}-${m[2]}`);
            }
            return null;
        }
        return { extractCode, normalizeCode };
    })();

    // ==================== 配置与字段 ====================
    const FIELD_DEFINITIONS = {
        code: { label: '番号(全)', required: true, fixed: true, settingKey: 'enableCode' },
        title: { label: '标题', settingKey: 'enableTitle', default: true },
        zhTitle: { label: '中文标题', settingKey: 'enableZhTitle', default: false },
        actresses: { label: '演员', settingKey: 'enableActresses', default: true },
        date: { label: '日期', settingKey: 'enableDate', default: true },
        rating: { label: '评分', settingKey: 'enableRating', default: false },
    };

    const MENU_ITEMS = [
        { key: 'localCodeProcess', id: 'local_code_process', label: '本地番号规范' },
        { key: 'renameMultiDate', id: 'rename_all_multi_date', label: '联网改名' },
        { key: 'renameMultiZh', id: 'rename_all_multi_zh', label: '中文标题' },
        { key: 'archiveFolder', id: 'archive_to_folder', label: '归档至文件夹' },
        { key: 'archiveBucket', id: 'archive_to_bucket', label: '分桶归档' },
        { key: 'setArchiveRoot', id: 'set_archive_root', label: '设为归档根目录' },
        { key: 'javdbRating', id: 'get_javdb_rating', label: '获取javdb评分' }
    ];

    const DEFAULT_SETTINGS = {
        fieldOrder: 'code,title,zhTitle,actresses,date,rating',
        sourceOrder: 'javdb,javbus,javlibrary,xslist,fc2ppvdb,missav,avsox,avmoo,custom',
        scrapeSources: 'javdb,javbus,javlibrary,xslist,fc2ppvdb,missav,avsox,avmoo',
        customSources: '',
        fieldSeparator: ' ', datePrefix: '-', actressSeparator: '・',
        enableTitle: true, enableZhTitle: false, enableActresses: true, enableDate: true, enableRating: false, enableMarkers: true,
        translateChinese: false, protectManualName: true, segmentPrefix: 'cd',
        renameConcurrency: 5, queryConcurrency: 6, archiveConcurrency: 3,
        archiveRootCid: null, archiveRootName: null, archiveRootPath: '',
        cacheTtlDays: 90, negativeCacheTtlHours: 24, actressAlias: null,
        menuVisibility: { localCodeProcess: true, renameMultiDate: true, renameMultiZh: true, archiveFolder: true, archiveBucket: true, setArchiveRoot: true, javdbRating: true },
    };

    let SETTINGS = null;
    function loadSettings() {
        if (SETTINGS) return SETTINGS;
        try {
            const raw = GM_getValue('rename2026_settings', '');
            SETTINGS = Object.assign({}, DEFAULT_SETTINGS, raw ? JSON.parse(raw) : {});
            if (!SETTINGS.menuVisibility) SETTINGS.menuVisibility = Object.assign({}, DEFAULT_SETTINGS.menuVisibility);
            if (!String(SETTINGS.fieldOrder || '').split(',').map(x => x.trim()).includes('rating')) {
                SETTINGS.fieldOrder = (SETTINGS.fieldOrder ? SETTINGS.fieldOrder.replace(/,\s*$/, '') + ',' : '') + 'rating';
            }
        } catch (e) { SETTINGS = Object.assign({}, DEFAULT_SETTINGS); }
        return SETTINGS;
    }
    function saveSettings(p) { loadSettings(); if (p) Object.assign(SETTINGS, p); GM_setValue('rename2026_settings', JSON.stringify(SETTINGS)); }

    const ACTRESS_ALIAS_MAP_DEFAULT = {
        '三上悠亜': '三上悠亚', 'Mikami Yua': '三上悠亚', '深田えいみ': '深田咏美', 'Fukada Eimi': '深田咏美',
        '天使もえ': '天使萌', 'Amatsuka Moe': '天使萌', '桃乃木かな': '桃乃木香奈', 'Momonogi Kana': '桃乃木香奈'
    };
    const GARBAGE_WORDS = ['FHD', 'FULLHD', 'UHD', 'QHD', 'HD', 'SD', 'HDR', '2160P', '1440P', '1080P', '720P', '480P', 'X264', 'X265', 'H264', 'H265', 'HEVC', 'AVC', '10BIT', '8BIT', 'AAC', 'AC3', 'DTS', 'MP4', 'MKV', 'AVI', 'WMV', 'ISO', 'TS', 'HHB', 'HHC', 'HHD', 'HHH'];
    const RESOLUTION_FPS_PATTERN = /(?<![A-Za-z0-9])(?:2160[Pp]|1440[Pp]|1080[PpIi]?|720[PpIi]?|480[Pp]|FHD|UHD|HDR10?|10[Bb][Ii][Tt]|8[Bb][Ii][Tt]|(?:24|25|30|50|60|120|144)\s*[Ff][Pp][Ss]|[Ff][Pp][Ss])(?![A-Za-z0-9])/gi;
    const CODEC_PATTERN = /\b(?:h2|h264|h265|hevc|avc)\b/gi;

    const MARKER_MAP = {
        '无码破解': '破解', '无码流出': '流出', '无修正': '无码', '無修正': '无码', '无码': '无码', '無碼': '无码',
        'uncensored': '无码', 'decensored': '无码', '流出': '流出', 'leaked': '流出', '破解': '破解', 'cracked': '破解',
        '中文字幕': '中文字幕', '中字': '中文字幕', 'chinese': '中文字幕', '4k': '4K', '8k': '8K', 'vr': 'VR'
    };
    const MARKER_PATTERN = new RegExp('(?:' + Object.keys(MARKER_MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');

    // ==================== 工具函数 ====================
    const stripFileExt = n => { const s = String(n || ''); const i = s.lastIndexOf('.'); return i > 0 ? s.slice(0, i) : s; };
    const escapeRegExp = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizeFileName = s => s == null ? '' : String(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    const isPunctOnly = s => !s || !String(s).trim() || /^[\s\.\-_·・,，。;；:：!！?？、\/\\|+~@#$%^&*()\[\]{}【】「」『』《》<>]+$/.test(String(s).trim());

    const normalize115Name = n => {
        if (!n) return '';
        let s = String(n).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00AD\u2060-\u2064\u180E\u2028\u2029]/g, '').replace(/[\u2010-\u2015\u2212\u30FC]+/g, '-');
        return s.replace(/[\\\/:?"<>|*]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const normalizeFolderName = n => !n ? '' : normalize115Name(n).replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, ' ').trim();
    const getStandardActressName = name => !name ? name : (ACTRESS_ALIAS_MAP_DEFAULT[normalizeFolderName(name)] || normalizeFolderName(name));
    const isPlausibleActressToken = name => name && !/(有码|无码|欧美|动漫|系列|片商|演員|女优|字幕|高清|修正|合集)/i.test(normalizeFolderName(name));
    const getSafeSuffix = filename => { const m = filename.match(/\.([a-z0-9]{2,5})$/i); return (m && !/^\d+$/.test(m[1])) ? m[0] : ''; };
    const isNotFoundTitle = t => /404|not\s*found|找不到|不存在|查無/i.test(String(t || ''));

    const removeMarkers = str => String(str).replace(MARKER_PATTERN, (m, offset, full) => {
        if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(m)) return ' ';
        const prev = offset > 0 ? full[offset - 1] : '', next = offset + m.length < full.length ? full[offset + m.length] : '';
        return (/[a-z0-9]/i.test(prev) && /[a-z0-9]/i.test(next)) ? m : ' ';
    });

    const stripDomainPrefix = filename => {
        if (!filename || filename.indexOf('@') === -1) return filename;
        const safeExtMatch = filename.match(/\.([a-z0-9]{2,5})$/i);
        const ext = (safeExtMatch && !/^\d+$/.test(safeExtMatch[1])) ? safeExtMatch[0] : '';
        const parts = (ext ? filename.slice(0, -ext.length) : filename).split('@').map(p => p.trim()).filter(Boolean);
        if (parts.length <= 1) return filename;
        const isDomain = s => !s ? false : (!/\.(mp4|mkv|avi)$/i.test(s) && /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(s));
        for (let i = 0; i < parts.length; i++) {
            if (isDomain(parts[i])) continue;
            if (/\b[A-Z]{2,8}[-_ ]?\d{2,5}/i.test(parts[i]) || /\bfc2?\d{5,8}/i.test(parts[i])) return parts[i] + ext;
        }
        return parts[parts.length - 1] + ext;
    };

    const gmRequest = opts => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), opts.timeout || 15000);
        GM_xmlhttpRequest(Object.assign({}, opts, {
            onload: r => { clearTimeout(timer); resolve(r); },
            onerror: e => { clearTimeout(timer); reject(e); },
            ontimeout: () => { clearTimeout(timer); reject(new Error('Timeout')); }
        }));
    });
    const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');
    const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ==================== 115 页面交互 ====================
    function pickFid(row) {
        if (!row) return '';
        const attrs = ['data-file-id', 'cate_id', 'file_id', 'cid'];
        for (const a of attrs) { const v = row.getAttribute && row.getAttribute(a); if (v) return String(v).trim(); }
        const cb = row.querySelector('input[type="checkbox"]');
        return cb ? (cb.getAttribute('data-id') || cb.value || '') : '';
    }
    function pickFn(row) {
        if (!row) return '';
        const direct = row.getAttribute('title') || row.getAttribute('data-title') || row.getAttribute('data-file-name');
        if (direct) return String(direct).trim();
        const sels = ['.file-name .name[title]', '.file-name .name', '.file-name-responsive[title]', '.file-name-responsive', '.name[title]'];
        for (const s of sels) {
            const el = row.querySelector(s);
            if (el) { const t = el.getAttribute('title') || el.textContent; if (t && t.trim()) return String(t).trim(); }
        }
        return '';
    }
    function get115SelectedItems() {
        const results = [], seen = new Set();
        const docs = [document];
        try { document.querySelectorAll('iframe').forEach(f => { if (f.contentDocument) docs.push(f.contentDocument); }); } catch (e) { }
        docs.forEach(doc => {
            const allRows = new Set();
            ['li[rel="item"]', '.file-list-item', '[data-file-id]', '.list-contents li'].forEach(sel => doc.querySelectorAll(sel).forEach(el => allRows.add(el)));
            allRows.forEach(row => {
                if (seen.has(row)) return;
                const isSelected = row.matches('.selected, .is-selected, .checked, [aria-selected="true"]') || String(row.getAttribute('aria-selected')) === 'true' || (row.querySelector('input[type="checkbox"]')?.checked);
                if (!isSelected) return;
                let p = row.parentElement, skip = false;
                while (p && p !== doc.body) { if (allRows.has(p)) { skip = true; break; } p = p.parentElement; }
                if (skip) return;
                seen.add(row);
                const ft = row.getAttribute('file_type');
                const isFolder = ft === '0' || Array.from(row.querySelectorAll('img')).some(img => img.getAttribute('alt') === '文件夹' || img.getAttribute('src')?.includes('folder'));
                const fid = pickFid(row);
                const fn = pickFn(row);
                if (fid && fn) results.push({ fid, fn, isFolder, row });
            });
        });
        return results;
    }

    // ==================== 右键菜单注入 ====================
    const MODERN_MENU_ICONS = {
        local_code_process: 'M4 2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v12h12V4H4zm2 2h2v2H6V6zm0 4h2v2H6v-2zm4-4h4v2h-4V6zm0 4h4v2h-4v-2z',
        rename_all_multi_date: 'M15 2v2h-2v12h2v2H9v-2h2V4H9V2zm1 3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v-2h2V7h-2V5zm-6 0v2H4v6h6v2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 4v2H5V9z',
        rename_all_multi_zh: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 5h2v2.2A6 6 0 0 1 14.8 11H13v2h-2v2H9v-2H5.2A6 6 0 0 1 11 7.2V5zm0 4.3A4 4 0 0 0 7.3 11H9V9.3zm2 0V11h1.7A4 4 0 0 0 11 9.3z',
        archive_to_folder: 'M3 3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3zm2 1v1h3V4H5zm7-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V3zm2 1v1h1V4h-1zM3 13a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3zm2 1v1h3v-1H5zm7-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3zm2 1v1h1v-1h-1z',
        archive_to_bucket: 'M2 4a2 2 0 0 1 2-2h3v2H4v3H2V4zm14-2a2 2 0 0 1 2 2v3h-2V4h-3V2h3zm2 14a2 2 0 0 1-2 2h-3v-2h3v-3h2v3zm-16 0V13h2v3h3v2H4a2 2 0 0 1-2-2zM7 7h6v2H7V7zm0 4h6v2H7v-2z',
        set_archive_root: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
        get_javdb_rating: 'm10 2.5 2.163 4.383 4.837.703-3.5 3.412.826 4.816L10 13.538l-4.326 2.276.826-4.816L3 7.586l4.837-.703L10 2.5zm0 4.106-1.175 2.38-2.627.382 1.901 1.853-.449 2.617L10 12.604l2.35 1.234-.449-2.617 1.901-1.853-2.627-.382L10 6.606z'
    };

    function handleMenuAction(actionId) {
        if (actionId === 'local_code_process') rename(local_rename);
        else if (actionId === 'rename_all_multi_date') { saveSettings({ translateChinese: false }); rename(rename_multi); }
        else if (actionId === 'rename_all_multi_zh') { saveSettings({ translateChinese: true }); rename(rename_multi); }
        else if (actionId === 'archive_to_folder') archiveToActorFolder();
        else if (actionId === 'archive_to_bucket') archiveToBucketFolder();
        else if (actionId === 'set_archive_root') setArchiveRoot();
        else if (actionId === 'get_javdb_rating') getJavdbRating();
    }

    function injectMenu() {
        if (document.getElementById('rename_list_modern') || document.getElementById('rename_list')) return true;
        const modern = document.querySelector('button[data-menu-action="move"], button[data-menu-action="open"], button[data-menu-action="rename"], button[data-menu-action="copy"]');
        const legacy = document.querySelector("li[val='open_dir'], li[data-val='open_dir'], li[menu='open_dir']");
        if (!modern && !legacy) return false;

        const visible = MENU_ITEMS.filter(it => loadSettings().menuVisibility[it.key] !== false);
        if (!visible.length) return true;

        if (modern && modern.parentElement) {
            const wrap = document.createElement('div');
            wrap.id = 'rename_list_modern';
            wrap.style.cssText = 'display: contents;';
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark');
            visible.forEach(it => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left flex items-center whitespace-nowrap cursor-pointer transition-colors';
                btn.style.cssText = `height: 32px; padding: 0 12px; gap: 12px; font-size: 12px; font-weight: 500; color: ${isDark ? '#e5e7eb' : '#1f2937'}; background: transparent; border: none; outline: none;`;
                btn.onmouseenter = () => btn.style.background = isDark ? 'rgba(255,255,255,0.08)' : '#F7F9FA';
                btn.onmouseleave = () => btn.style.background = 'transparent';
                const iconColor = isDark ? '#9ca3af' : '#4a5568';
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" style="flex-shrink:0; width:20px; height:20px;"><g fill="none"><path fill="${iconColor}" fill-rule="nonzero" d="${MODERN_MENU_ICONS[it.id]}"></path></g></svg><span style="line-height: 1;">${escapeHtml(it.label)}</span>`;
                btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); handleMenuAction(it.id); };
                wrap.appendChild(btn);
            });
            modern.insertAdjacentElement('afterend', wrap);
        } else if (legacy && legacy.parentElement) {
            const li = document.createElement('li');
            li.id = 'rename_list';
            visible.forEach(it => {
                const a = document.createElement('a');
                a.id = it.id; a.href = 'javascript:;';
                a.style.cssText = 'display: flex !important; align-items: center !important; padding: 10px 15px !important; text-decoration: none !important; color: inherit !important; cursor: pointer; box-sizing: border-box;';
                a.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" style="flex-shrink:0; margin-right: 12px;"><g fill="none"><path fill="currentColor" fill-rule="nonzero" d="${MODERN_MENU_ICONS[it.id]}"></path></g></svg><span style="display: inline-block; vertical-align: middle;">${escapeHtml(it.label)}</span>`;
                a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); handleMenuAction(it.id); };
                li.appendChild(a);
            });
            legacy.insertAdjacentElement('beforebegin', li);
        }
        return true;
    }

    function hasJavLaosiji() { return !!(window.__LAOSIJI_APP__ || document.getElementById('jav-quick-settings-popover')); }

    let injectDelayed = false, menuInterval = setInterval(() => {
        if (injectMenu()) clearInterval(menuInterval);
        else if (!injectDelayed && hasJavLaosiji()) {
            injectDelayed = true;
            clearInterval(menuInterval);
            setTimeout(() => { injectMenu(); menuInterval = setInterval(() => { if (injectMenu()) clearInterval(menuInterval); }, 1000); }, 1500);
        }
    }, 800);

    let reinjectTimer = null;
    new MutationObserver(() => {
        if (document.getElementById('rename_list_modern') || document.getElementById('rename_list')) return;
        clearTimeout(reinjectTimer);
        reinjectTimer = setTimeout(injectMenu, 200);
    }).observe(document.body, { childList: true, subtree: true });

    // ==================== 核心解析 ====================
    function checkUncensored(baseCode, raw) { return /无码|無修正|uncensored/i.test(raw) || /_/.test(baseCode); }

    function removeCodeFromTitle(str, baseCode) {
        if (!baseCode) return str;
        const escapedCode = escapeRegExp(baseCode).replace(/\\-/g, '[-_.\\s]*');
        return str.replace(new RegExp('\\b' + escapedCode + '(?![0-9])', 'gi'), ' ').replace(/\s+/g, ' ').trim();
    }

    const parseVideoInfo = (origTitle, safeSuffix) => {
        try {
            if (!origTitle) return null;
            let raw = stripDomainPrefix(normalize115Name(origTitle));
            let rawForCode = safeSuffix ? raw.slice(0, raw.lastIndexOf(safeSuffix)) : raw;

            const markers = [];
            rawForCode.replace(MARKER_PATTERN, (m, offset, full) => {
                if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(m)) {
                    const prev = offset > 0 ? full[offset - 1] : '', next = offset + m.length < full.length ? full[offset + m.length] : '';
                    if (/[a-z0-9]/i.test(prev) && /[a-z0-9]/i.test(next)) return m;
                }
                const nm = MARKER_MAP[m.toLowerCase()];
                if (nm && markers.indexOf(nm) === -1) markers.push(nm);
            });

            let dateStr = '';
            const dm = rawForCode.match(/\b((?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2})\b/i);
            if (dm) {
                const p = dm[1].trim().split(/[-_\/\.\s]+/);
                if (p.length === 3) dateStr = p[0] + '-' + String(p[1]).padStart(2, '0') + '-' + String(p[2]).padStart(2, '0');
                rawForCode = rawForCode.replace(dm[1], ' ');
            }

            let cleanForCode = rawForCode.replace(/[-_.\s]*hh[bcdh]\d*/gi, ' ').replace(/[-_.\s]*(?:4k|4ks|8k|2160p|1080p|720p)?\s*(?:60|120|30)\s*fps/gi, ' ').replace(/[-_.\s]*\b(?:4k|8k|2160p|1080p|720p)\b/gi, ' ').replace(/\s+/g, ' ').trim();

            let part = '';
            let partMatch = null;
            const pm = rawForCode.match(/(?:^|[^A-Za-z0-9])(?:cd|part|pt|disc|vol|volume|ep|sp)[-_.\s\[\](){}]*0*(\d{1,3}|[a-d])(?=$|[^0-9A-Za-z])/i);
            if (pm) {
                part = pm[1];
                partMatch = pm[0];
            } else {
                const numMatch = rawForCode.match(/[_.\-]\s*(\d{1,2})(?=$|[^0-9A-Za-z])/);
                if (numMatch) part = numMatch[1];
            }

            let queryCode = null;
            let matchToReplace = null;

            const fc2Match = cleanForCode.match(/\b(?:FC2[-_\s]?(?:PPV[-_\s]?)?|PPV[-_\s]?)(\d{6,9})(?:[-_\s](\d{1,2}|[A-Za-z]))?(?=$|[^0-9A-Za-z])/i);
            if (fc2Match) {
                queryCode = 'FC2-PPV-' + fc2Match[1];
                if (!part && fc2Match[2]) part = fc2Match[2];
                matchToReplace = fc2Match[0];
            } else {
                const normalMatch = cleanForCode.match(/\b([A-Z0-9][A-Z0-9]{1,14})[-_\s](\d{2,10})(?:[-_](\d{1,3}|[A-Za-z]))?(?=$|[^0-9A-Za-z])/i);
                if (normalMatch) {
                    queryCode = normalMatch[1].toUpperCase() + '-' + normalMatch[2];
                    if (!part && normalMatch[3]) part = normalMatch[3];
                    matchToReplace = normalMatch[0];
                }
            }

            if (!queryCode) {
                try {
                    const UW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
                    if (UW.__LAOSIJI_PAN115_OFFLINE__ && typeof UW.__LAOSIJI_PAN115_OFFLINE__.extractCode === 'function') {
                        const r2 = UW.__LAOSIJI_PAN115_OFFLINE__.extractCode(cleanForCode);
                        if (r2) queryCode = normalize115Name(r2);
                    }
                } catch (e) { }
            }

            if (!queryCode) return null;
            const baseCode = queryCode;

            if (matchToReplace) {
                cleanForCode = cleanForCode.replace(matchToReplace, ' ');
            }

            const escapedCode = escapeRegExp(baseCode).replace(/\\-/g, '[-_.\\s]*');
            cleanForCode = cleanForCode.replace(new RegExp('\\b' + escapedCode + '(?![0-9])', 'gi'), ' ');

            if (partMatch) {
                cleanForCode = cleanForCode.replace(partMatch, ' ');
            } else if (part) {
                cleanForCode = cleanForCode.replace(new RegExp('[_.\\-]\\s*0*' + escapeRegExp(part) + '(?=$|[^0-9A-Za-z])', 'i'), ' ');
            }

            if (checkUncensored(baseCode, rawForCode) && markers.indexOf('无码') === -1) markers.push('无码');
            if (rawForCode.indexOf('中文') !== -1 || rawForCode.indexOf('中字') !== -1) {
                if (markers.indexOf('中文字幕') === -1) markers.push('中文字幕');
            }

            let finalPart = part;
            if (finalPart && loadSettings().segmentPrefix) {
                if (/^\d+$/.test(finalPart)) {
                    finalPart = loadSettings().segmentPrefix + finalPart;
                }
            }
            const fullCode = finalPart ? baseCode + '-' + finalPart : baseCode;

            let cleanTitle = removeMarkers(cleanForCode)
                .replace(RESOLUTION_FPS_PATTERN, ' ')
                .replace(CODEC_PATTERN, ' ') // 清理 h2 等编码残渣
                .replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ')
                .replace(/[_\.]+/g, ' ')
                .replace(/[-]+/g, ' ')
                .replace(/\s+/g, ' ').trim();

            cleanTitle = removeCodeFromTitle(cleanTitle, baseCode);
            if (isPunctOnly(cleanTitle)) cleanTitle = '';

            return { queryCode, baseCode, fullCode, markers, date: dateStr, localTitle: cleanTitle };
        } catch (e) {
            console.error('parseVideoInfo error:', e);
            return null;
        }
    };

    const buildNewName = (vInfo, info, suffix) => {
        if (!vInfo || !vInfo.fullCode) return '';
        const s = loadSettings();
        const originalTitle = (info && info.title) || vInfo.localTitle || '';
        const zhTitle = (info && info.zhTitle) || '';
        const dateStr = (info && info.date) || vInfo.date || '';
        const rating = (info && info.rating != null) ? Number(info.rating) : null;

        let actressStr = '';
        const actresses = (info && info.actresses) || [];
        if (actresses.length) {
            const list = [], seen = {};
            actresses.forEach(a => {
                const std = getStandardActressName(a);
                if (std && isPlausibleActressToken(std) && !seen[std]) { seen[std] = true; list.push(std); }
            });
            actressStr = list.join(s.actressSeparator || '・');
        }

        let cleanTitle = originalTitle ? removeCodeFromTitle(originalTitle, vInfo.baseCode).replace(/【[^】]*】/g, '').trim() : '';
        let cleanZhTitle = zhTitle ? removeCodeFromTitle(zhTitle, vInfo.baseCode).replace(/【[^】]*】/g, '').trim() : '';
        if (isPunctOnly(cleanTitle)) cleanTitle = '';

        const fieldValues = {
            code: vInfo.fullCode,
            title: cleanTitle,
            zhTitle: cleanZhTitle,
            actresses: actressStr,
            date: dateStr,
            rating: (rating != null && !isNaN(rating)) ? '[' + rating.toFixed(1) + ']' : ''
        };
        const enabled = { code: true, title: s.enableTitle, zhTitle: s.enableZhTitle, actresses: s.enableActresses, date: s.enableDate, rating: s.enableRating };

        let order = String(s.fieldOrder || 'code,title,actresses,date').split(',').map(x => x.trim()).filter(Boolean);
        if (s.enableRating && !order.includes('rating')) order.push('rating');

        const parts = [];
        order.forEach(f => {
            if (enabled[f] && fieldValues[f]) parts.push(f === 'date' && s.datePrefix ? s.datePrefix + fieldValues[f] : fieldValues[f]);
        });
        let name = parts.join(s.fieldSeparator || ' ');

        if (s.enableMarkers && vInfo.markers && vInfo.markers.length) {
            const existing = name.match(/【[^】]*】/g) || [];
            const toAdd = Array.from(new Set(vInfo.markers)).filter(m => m && existing.indexOf('【' + m + '】') === -1);
            if (toAdd.length) name += toAdd.map(m => '【' + m + '】').join('');
        }

        if (suffix) name = name.replace(/[\s.]+$/, '') + suffix;
        return sanitizeFileName(name.replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim());
    };

    const hasManualNamePayload = (fileName, code) => {
        if (!loadSettings().protectManualName || !fileName || !code) return false;
        let base = normalizeFolderName(stripFileExt(fileName));
        if (!base) return false;
        const codeStr = String(code).toUpperCase(), prefix = codeStr.split('-')[0] || '', numPadded = codeStr.split('-')[1] || '', num = numPadded.replace(/^0+/, '') || numPadded;
        const variants = [codeStr, codeStr.replace(/-/g, '')];
        if (prefix && num) variants.push(prefix + '-' + num, prefix + '_' + num, prefix + ' ' + num, prefix + num);
        variants.forEach(v => { if (v) base = base.replace(new RegExp(escapeRegExp(v).replace(/[-_\s]+/g, '[-_\\s]*'), 'ig'), ' '); });
        base = base.replace(/[\[\]【】()（）{}<>《》「」『』._,，。+~!@#$%^&;:=、\/\|]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!base) return false;
        if (/[぀-ヿ㐀-鿿]/.test(base)) return true;
        const asciiWords = (base.match(/[A-Za-z]{3,}/g) || []).filter(w => !/^(the|and|for|with|you|your|her|his|new|hot|sex|jav|av)$/i.test(w));
        return asciiWords.length >= 2 || asciiWords.join('').length >= 10;
    };

    // ==================== 缓存 ====================
    function getCache(k) { try { return JSON.parse(GM_getValue(k, '{}')); } catch (e) { return {}; } }
    function setCache(k, d) { GM_setValue(k, JSON.stringify(d)); }
    let infoCache = getCache('jb_infoCache'), ratingCache = getCache('jb_ratingCache'), negativeCache = getCache('jb_negativeCache');
    let translationCache = getCache('rename2026_translationCache'), ratingNegCache = getCache('rename2026_ratingNeg');

    const isInfoCacheValid = code => { const e = infoCache[code]; return e && (!e.cachedAt || (Date.now() - Number(e.cachedAt)) < (loadSettings().cacheTtlDays || 90) * 86400000); };
    const storeInfo = (key, info) => { if (info) info.cachedAt = Date.now(); infoCache[key] = info; setCache('jb_infoCache', infoCache); };
    const isNegativeCached = code => { const e = negativeCache[code]; return e && e.cachedAt && (Date.now() - Number(e.cachedAt)) < (loadSettings().negativeCacheTtlHours || 24) * 3600000; };
    const markNegativeCached = code => { negativeCache[code] = { cachedAt: Date.now() }; setCache('jb_negativeCache', negativeCache); };

    const TRANSLATION_TTL = 30 * 86400000;
    function getCachedTranslation(title) {
        const e = translationCache[title];
        if (e && Date.now() - Number(e.cachedAt) < TRANSLATION_TTL) return e.text;
        return null;
    }
    function setCachedTranslation(title, text) {
        translationCache[title] = { text, cachedAt: Date.now() };
        const keys = Object.keys(translationCache);
        if (keys.length > 500) keys.sort((a, b) => translationCache[a].cachedAt - translationCache[b].cachedAt).slice(0, 100).forEach(k => delete translationCache[k]);
        setCache('rename2026_translationCache', translationCache);
    }

    const RATING_NEGATIVE_TTL = 5 * 60 * 1000;
    function isRatingNegativeCached(code) { const e = ratingNegCache[code]; return !!(e && Date.now() - Number(e.cachedAt) < RATING_NEGATIVE_TTL); }
    function markRatingNegative(code) { ratingNegCache[code] = { cachedAt: Date.now() }; setCache('rename2026_ratingNeg', ratingNegCache); }

    const COMMON_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

    // ==================== 刮削源集合 ====================
    function fetchJavbus(code) {
        const url = `https://www.javbus.com/search/${encodeURIComponent(code)}&type=&parent=ce`;
        return gmRequest({ url, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const doc = parseHTML(res.responseText);
            let h3 = doc.querySelector('h3');
            if (h3) return parseJavbusDoc(doc);
            const match = Array.from(doc.querySelectorAll('.movie-box')).find(el => el.textContent.includes(code));
            if (!match) throw new Error('JavBus 无结果');
            return gmRequest({ url: match.href, headers: COMMON_HEADERS, anonymous: true }).then(r2 => parseJavbusDoc(parseHTML(r2.responseText)));
        });
    }
    function parseJavbusDoc(doc) {
        let ttl = doc.querySelector('h3')?.textContent.trim() || '';
        let isoDate = '';
        doc.querySelectorAll('p').forEach(p => { const t = p.textContent.trim(); if (/發行日期|发行日期/.test(t)) { const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m) isoDate = m[1]; } });
        const actresses = []; doc.querySelectorAll('span.genre a[href*="/star/"]').forEach(a => actresses.push(a.textContent.trim()));
        return { title: ttl, date: isoDate, actresses };
    }

    function fetchJavdb(code) {
        return gmRequest({ url: `https://javdb.com/search?q=${encodeURIComponent(code)}&f=all`, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const a = parseHTML(res.responseText).querySelector('a[href*="/v/"]');
            if (!a) throw new Error('JavDB 无结果');
            return gmRequest({ url: a.href.startsWith('http') ? a.href : 'https://javdb.com' + a.href, headers: COMMON_HEADERS, anonymous: true });
        }).then(r2 => {
            const ddoc = parseHTML(r2.responseText);
            let ttl = ddoc.querySelector('h2.title')?.textContent.trim() || '';
            let dt = ''; ddoc.querySelectorAll('.panel-block').forEach(b => { if (/日期|發行/.test(b.textContent)) dt = b.textContent.replace(/.*?[:：]/, '').trim(); });
            const actresses = []; ddoc.querySelectorAll('a[href*="/actors/"]').forEach(a => actresses.push(a.textContent.trim()));
            return { title: ttl, date: dt, actresses };
        });
    }

    function fetchJavlib(code) {
        return gmRequest({ url: `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodeURIComponent(code)}`, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const doc = parseHTML(res.responseText);
            const a = doc.querySelector('#video_title a') || doc.querySelector('div.video a[href*="?v="]');
            if (!a) throw new Error('Javlib 无结果');
            return gmRequest({ url: a.href.startsWith('http') ? a.href : 'https://www.javlibrary.com' + a.href, headers: COMMON_HEADERS, anonymous: true });
        }).then(r2 => {
            const ddoc = parseHTML(r2.responseText);
            let ttl = ddoc.querySelector('#video_title a')?.textContent.trim() || ddoc.querySelector('#video_title')?.textContent.trim() || '';
            let dt = ddoc.querySelector('#video_date td.text')?.textContent.trim() || '';
            const actresses = []; ddoc.querySelectorAll('#video_cast td.text a').forEach(a => actresses.push(a.textContent.trim()));
            return { title: ttl, date: dt, actresses };
        });
    }

    function fetchXslist(code) {
        return gmRequest({ url: `https://xslist.org/tw/search?query=${encodeURIComponent(code)}`, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const doc = parseHTML(res.responseText);
            const tr = Array.from(doc.querySelectorAll('#movices tbody tr')).find(row => row.textContent.replace(/[-_\s]/g, '').toUpperCase().includes(code.replace(/[-_\s]/g, '').toUpperCase()));
            if (!tr) throw new Error('xslist 无结果');
            const tds = tr.querySelectorAll('td');
            return { title: tds[1]?.textContent.trim(), date: tds[2]?.textContent.trim(), actresses: [doc.querySelector('h1 span[itemprop="name"]')?.textContent.trim()].filter(Boolean) };
        });
    }

    function fetchFC2PPVDB(code) {
        return gmRequest({ url: `https://fc2ppvdb.com/articles/${code.match(/\d+$/)[0]}`, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const doc = parseHTML(res.responseText);
            const ttl = doc.querySelector('a[href*="adult.contents.fc2.com"]')?.textContent.trim() || doc.title.replace(' - FC2PPVDB', '').trim();
            return { title: ttl, date: '', actresses: [] };
        });
    }

    function fetchMissavFC2(code) {
        const expectedId = code.toLowerCase();
        return new Promise((resolve, reject) => {
            const sign = path => {
                const ts = Math.floor(Date.now() / 1000), unsigned = '/missav-default' + path + '?frontend_timestamp=' + ts;
                if (!globalThis.crypto?.subtle) return Promise.reject(new Error('WebCrypto'));
                const enc = new TextEncoder();
                return globalThis.crypto.subtle.importKey('raw', enc.encode('Ikkg568nlM51RHvldlPvc2GzZPE9R4XGzaH9Qj4zK9npbbbTly1gj9K4mgRn0QlV'), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
                    .then(k => globalThis.crypto.subtle.sign('HMAC', k, enc.encode(unsigned)))
                    .then(sig => unsigned + '&frontend_sign=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));
            };
            sign('/search/users/anonymous/items/').then(p => gmRequest({
                method: 'POST', url: 'https://client-rapi-missav.recombee.com' + p, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                data: JSON.stringify({ searchQuery: code, count: 10, cascadeCreate: true, returnProperties: true }), anonymous: true
            })).then(res => {
                const items = JSON.parse(res.responseText)?.recomms || [];
                const exact = items.find(it => String(it.id).toLowerCase() === expectedId);
                if (!exact?.values?.title) throw new Error('missav 无结果');
                return { title: exact.values.title, date: exact.values.released_at ? new Date(exact.values.released_at * 1000).toISOString().slice(0, 10) : '', actresses: [].concat(exact.values.actresses || [], exact.values.actors || []) };
            }).then(resolve).catch(reject);
        });
    }

    function fetchAvsox(code) {
        return gmRequest({ url: `https://avsox.host/cn/search/${encodeURIComponent(code)}`, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const item = parseHTML(res.responseText).querySelector('.movie-box');
            if (!item) throw new Error('avsox 无结果');
            return { title: item.querySelector('.title')?.textContent.trim() || '', date: item.querySelector('.date')?.textContent.trim() || '', actresses: Array.from(item.querySelectorAll('.star a')).map(a => a.textContent.trim()) };
        });
    }

    function fetchAvmoo(code) {
        return gmRequest({ url: `https://avmoo.host/cn/search/${encodeURIComponent(code)}`, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const item = parseHTML(res.responseText).querySelector('.movie-box');
            if (!item) throw new Error('avmoo 无结果');
            return { title: item.querySelector('.title')?.textContent.trim() || '', date: item.querySelector('.date')?.textContent.trim() || '', actresses: Array.from(item.querySelectorAll('.star a')).map(a => a.textContent.trim()) };
        });
    }

    function fetchCustomSource(code, urlTemplate) {
        const url = urlTemplate.replace(/\{code\}/gi, encodeURIComponent(code.toUpperCase())).replace(/\{id\}/gi, encodeURIComponent(code.replace(/[^A-Z0-9]/ig, ''))).replace(/\{\}/g, encodeURIComponent(code));
        return gmRequest({ url, headers: COMMON_HEADERS, anonymous: true }).then(res => {
            const doc = parseHTML(res.responseText);
            return {
                title: doc.querySelector('h2.title, .video-title, .entry-title, #video_title')?.textContent.trim() || doc.title.replace(/ - .*?$/, '').trim() || '',
                date: doc.body.textContent.match(/(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/)?.[0] || '',
                actresses: Array.from(doc.querySelectorAll('a[href*="/star/"], a[href*="/actors/"], a[href*="actor"]')).map(a => a.textContent.trim())
            };
        });
    }

    const SOURCE_REGISTRY = { javdb: fetchJavdb, javbus: fetchJavbus, javlibrary: fetchJavlib, xslist: fetchXslist, fc2ppvdb: fetchFC2PPVDB, missav: fetchMissavFC2, avsox: fetchAvsox, avmoo: fetchAvmoo };

    // ==================== 在途查询与竞速机制 ====================
    const inflightQueries = new Map();

    function fetchRemoteInfo(code) {
        const key = code.toUpperCase();
        if (inflightQueries.has(key)) {
            return inflightQueries.get(key);
        }
        const p = _fetchRemoteInfoImpl(code).finally(() => { inflightQueries.delete(key); });
        inflightQueries.set(key, p);
        return p;
    }

    async function _fetchRemoteInfoImpl(code) {
        const key = code.toUpperCase();
        if (isInfoCacheValid(key)) return infoCache[key];

        try {
            const UW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
            if (UW.__LAOSIJI_PAN115_WORK_INFO__?.resolve) {
                const info = await Promise.race([
                    UW.__LAOSIJI_PAN115_WORK_INFO__.resolve(code),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Laosiji Timeout')), 3000))
                ]);
                if (info && (info.title || info.actors?.length)) {
                    const result = { title: info.title || '', date: info.date || '', actresses: info.actors || [], actorEntries: info.actorRefs || [] };
                    storeInfo(key, result); return result;
                }
            }
        } catch (e) { }

        if (isNegativeCached(key)) return Promise.reject(new Error('Negative'));

        const s = loadSettings(), enabled = new Set(String(s.scrapeSources || '').split(',').map(x => x.trim()));
        const promises = [];

        Array.from(enabled).forEach(k => {
            if (k === 'custom') {
                String(s.customSources || '').split(',').filter(Boolean).forEach((url, idx) => {
                    promises.push(fetchCustomSource(code, url).catch(() => null));
                });
            } else if (SOURCE_REGISTRY[k]) {
                promises.push(SOURCE_REGISTRY[k](code).catch(() => null));
            }
        });

        if (!promises.length) return Promise.reject(new Error('No sources'));

        return new Promise((resolve, reject) => {
            let settled = false;
            let failCount = 0;
            const timer = setTimeout(() => {
                if (!settled) { settled = true; markNegativeCached(key); reject(new Error('Timeout')); }
            }, 10000);

            promises.forEach(p => {
                p.then(val => {
                    if (settled || !val) return;
                    settled = true;
                    clearTimeout(timer);
                    storeInfo(key, val);
                    resolve(val);
                }).catch(() => {
                    failCount++;
                    if (!settled && failCount === promises.length) {
                        settled = true;
                        clearTimeout(timer);
                        markNegativeCached(key);
                        reject(new Error('All failed'));
                    }
                });
            });
        });
    }

    async function translateTitleToChinese(title) {
        try {
            const r = await gmRequest({ method: 'POST', url: 'https://oneshot-free.www.deepl.com/v1/translate', headers: { 'Authorization': 'None', 'Content-Type': 'application/json' }, data: JSON.stringify({ text: [title], source_lang: 'ja', target_lang: 'zh-Hans' }), anonymous: true, timeout: 10000 });
            return JSON.parse(r.responseText)?.translations?.[0]?.text?.trim() || '';
        } catch (e) {
            try {
                const r2 = await gmRequest({ url: `https://api.mymemory.translated.net/get?q=${encodeURIComponent(title)}&langpair=ja%7Czh-CN`, anonymous: true, timeout: 10000 });
                return JSON.parse(r2.responseText)?.responseData?.translatedText?.trim() || '';
            } catch (e2) { return ''; }
        }
    }

    async function getTargetName(vInfo, suffix) {
        const code = vInfo.queryCode, key = code.toUpperCase();
        const t0 = performance.now();
        if (isInfoCacheValid(key)) {
            const r = await buildNameFromInfo(vInfo, infoCache[key], suffix);
            console.log(`[Rename2026] getTargetName ${key} cache-hit ${(performance.now() - t0).toFixed(0)}ms`);
            return r;
        }
        try {
            const info = await fetchRemoteInfo(code);
            if (info) {
                storeInfo(key, info);
                const r = await buildNameFromInfo(vInfo, info, suffix);
                console.log(`[Rename2026] getTargetName ${key} ${(performance.now() - t0).toFixed(0)}ms`);
                return r;
            }
            return null;
        } catch (e) { return null; }
    }

    async function buildNameFromInfo(vInfo, info, suffix) {
        if (info?.uncensored && vInfo.markers && !vInfo.markers.includes('无码')) vInfo.markers.push('无码');
        let zhTitle = '';
        if (loadSettings().translateChinese && info?.title) {
            const cached = getCachedTranslation(info.title);
            if (cached !== null) { zhTitle = cached; }
            else {
                const t0 = performance.now();
                try {
                    const t = await translateTitleToChinese(info.title);
                    if (t && t !== info.title) { zhTitle = t; setCachedTranslation(info.title, t); }
                } catch (e) { }
                console.log(`[Rename2026] translate "${info.title}" ${(performance.now() - t0).toFixed(0)}ms`);
            }
        }
        let rating = (info && info.rating != null) ? info.rating : null;
        if (loadSettings().enableRating && rating == null) {
            const t0 = performance.now();
            try { rating = await getRatingForCode(vInfo.queryCode); } catch (e) { }
            console.log(`[Rename2026] rating ${vInfo.queryCode} ${(performance.now() - t0).toFixed(0)}ms -> ${rating}`);
        }
        return buildNewName(vInfo, Object.assign({}, info, { zhTitle, rating }), suffix);
    }

    // ==================== 核心业务调度 ====================
    let renameCompareList = [];
    window.rename_multi = function (fid, vInfo, suffix, callback, origFilename) {
        getTargetName(vInfo, suffix).then(newName => {
            if (newName) send_115(fid, newName, vInfo.fullCode, origFilename, callback);
            else {
                if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode)) {
                    console.log(`[Rename2026] ${vInfo.fullCode} 已保护手动命名，跳过`);
                } else {
                    console.error(`[Rename2026] 所有信息源未找到 ${vInfo.queryCode}`);
                }
                if (typeof callback === 'function') callback();
            }
        }).catch(() => { if (typeof callback === 'function') callback(); });
    };

    function local_rename(fid, vInfo, suffix, callback, origFilename) {
        const newName = buildNewName(vInfo, { title: vInfo.localTitle, date: vInfo.date, actresses: [] }, suffix);
        send_115(fid, newName, vInfo.fullCode, origFilename, callback);
    }

    function send_115(id, name, fh, origFilename, callback) {
        const fn = sanitizeFileName(name);
        const t0 = performance.now();
        fetch('https://webapi.115.com/files/edit', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'fid=' + encodeURIComponent(id) + '&file_name=' + encodeURIComponent(fn)
        }).then(r => r.json()).then(r => {
            if (!r.state) console.error(`[Rename2026] ${fh} 修改失败: ` + (r.error || ''));
            else {
                if (origFilename) renameCompareList.push({ original: origFilename, new: name });
            }
            console.log(`[Rename2026] send_115 ${fh} ${(performance.now() - t0).toFixed(0)}ms`);
            if (typeof callback === 'function') callback();
        }).catch(() => {
            console.error(`[Rename2026] send_115 ${fh} 请求失败 ${(performance.now() - t0).toFixed(0)}ms`);
            if (typeof callback === 'function') callback();
        });
    }

    function offerCompareExport() {
        if (renameCompareList.length === 0) return;
        if (confirm('改名已完成，是否导出对比？')) {
            if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) {
                const text = '【旧文件名】\t【新文件名】\n' + renameCompareList.map(i => `${i.original}\t${i.new}`).join('\n');
                const blob = new Blob([text], { type: 'text/plain' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Rename_Compare.txt';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                showPageNotification('TXT 已下载', 'success', 3000);
            } else {
                const text = '【旧文件名】\t【新文件名】\n' + renameCompareList.map(i => `${i.original}\t${i.new}`).join('\n');
                (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(() => GM_setClipboard(text)).finally(() => showPageNotification('已复制', 'success', 3000));
            }
        }
    }

    window.renameInProgress = false;
    function runTasksWithLimit(tasks, limit, intervalMs, doneAll) {
        if (!tasks.length) return doneAll && doneAll();
        let idx = 0, running = 0, done = false;
        const finish = () => { if (!done) { done = true; doneAll && doneAll(); } };
        const next = () => {
            if (idx >= tasks.length && running === 0) return finish();
            while (running < limit && idx < tasks.length) {
                if (window.progressBox?.paused) { setTimeout(next, 500); return; }
                running++;
                tasks[idx++](() => { running--; setTimeout(next, intervalMs || 0); });
            }
        };
        next();
    }

    window.progressBox = {
        init(title, total) {
            this.total = total; this.current = 0; this.paused = false;
            let box = document.getElementById('task-progress-box');
            if (!box) {
                document.body.insertAdjacentHTML('beforeend', '<div id="task-progress-box" style="display:none;"><div style="display:flex;align-items:center;gap:8px;"><button id="tp-pause-btn" style="width:22px;height:22px;line-height:1;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;font-size:11px;padding:0;">⏸</button><div class="tp-title"></div></div><div class="tp-bar-outer"><div class="tp-bar-inner"></div></div><div class="tp-text"></div></div>');
                box = document.getElementById('task-progress-box');
                document.getElementById('tp-pause-btn').onclick = function () {
                    window.progressBox.paused = !window.progressBox.paused;
                    this.textContent = window.progressBox.paused ? '▶️' : '⏸';
                };
            }
            box.querySelector('.tp-title').textContent = title;
            this.update(0); box.style.display = '';
        },
        update(doneCount) {
            this.current = doneCount;
            const pct = Math.min(100, Math.round(doneCount * 100 / (this.total || 1)));
            const box = document.getElementById('task-progress-box');
            if (!box) return;
            box.querySelector('.tp-bar-inner').style.width = pct + '%';
            box.querySelector('.tp-text').textContent = doneCount + '/' + this.total + ' (' + pct + '%)';
        },
        finish() { this.paused = false; this.update(this.total); setTimeout(() => { const b = document.getElementById('task-progress-box'); if (b) b.style.display = 'none'; }, 800); }
    };

    const toastQueue = []; let toastActive = 0;
    window.showPageNotification = function (msg, type, duration) {
        if (!duration) duration = type === 'error' ? 5000 : 3000;
        const show = () => {
            toastActive++;
            const id = 'cn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            document.body.insertAdjacentHTML('beforeend', `<div id="${id}" class="custom-notification ${type}">${msg}</div>`);
            const el = document.getElementById(id);
            setTimeout(() => el.classList.add('show'), 10);
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.remove(); toastActive--; if (toastQueue.length) toastQueue.shift()(); }, 300); }, duration);
        };
        if (toastActive >= 3) toastQueue.push(show); else show();
    };

    function showRenamePreview(rows, onConfirm, onCancel) {
        const old = document.getElementById('rename-preview-overlay'); if (old) old.remove();
        if (!document.getElementById('rename-preview-style')) {
            const style = document.createElement('style'); style.id = 'rename-preview-style';
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
            const vars = isDark ? `
                --rp-bg: #1e1e1e;
                --rp-text: #e5e5e5;
                --rp-border: #333;
                --rp-toolbar-bg: #252526;
                --rp-btn-bg: #333;
                --rp-btn-border: #444;
                --rp-text-old: #aaa;
                --rp-footer-bg: #252526;
                --rp-primary: #60a5fa;
            ` : `
                --rp-bg: #fff;
                --rp-text: #333;
                --rp-border: #f5f5f5;
                --rp-toolbar-bg: #fafafa;
                --rp-btn-bg: #fff;
                --rp-btn-border: #d9d9d9;
                --rp-text-old: #333;
                --rp-footer-bg: #fafafa;
                --rp-primary: #1a6dff;
            `;
            style.textContent = `.rp-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:sans-serif}.rp-panel{${vars} width:min(1100px,calc(100vw - 32px));max-height:88vh;background:var(--rp-bg);color:var(--rp-text);border-radius:12px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.2)}.rp-header{padding:16px 20px;background:linear-gradient(135deg,#1a6dff,#1890ff);color:#fff;display:flex;justify-content:space-between;align-items:center}.rp-header h3{margin:0;font-size:16px;font-weight:600}.rp-toolbar{padding:10px 16px;border-bottom:1px solid var(--rp-border);display:flex;gap:10px;align-items:center;background:var(--rp-toolbar-bg)}.rp-toolbar button{padding:5px 12px;border:1px solid var(--rp-btn-border);border-radius:4px;background:var(--rp-btn-bg);cursor:pointer;font-size:13px;color:var(--rp-text)}.rp-toolbar span{font-size:13px;color:var(--rp-text-old);margin-left:auto}.rp-body{flex:1;overflow:auto;padding:8px 0;background:var(--rp-bg)}.rp-row{display:flex;gap:10px;padding:10px 16px;border-bottom:1px solid var(--rp-border);font-size:13px}.rp-col-code{width:150px;font-family:monospace;color:#1890ff;font-weight:600}.rp-col-old{flex:1;word-break:break-all;color:var(--rp-text-old)}.rp-col-new{flex:1.2;word-break:break-all;color:#1890ff}.rp-col-status{width:96px;text-align:center;font-weight:500}.rp-footer{padding:12px 20px;border-top:1px solid var(--rp-border);text-align:right;background:var(--rp-footer-bg);display:flex;justify-content:flex-end;gap:16px;align-items:center}.rp-btn-cancel{padding:8px 18px;border:1px solid var(--rp-btn-border);background:var(--rp-btn-bg);color:var(--rp-text) !important;border-radius:6px;cursor:pointer;font-size:14px;}.rp-btn-confirm{padding:8px 18px;border:none;background:transparent !important;color:var(--rp-primary) !important;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;transition:all .2s}.rp-btn-confirm:hover{opacity:0.8}`;
            document.head.appendChild(style);
        }
        const overlay = document.createElement('div'); overlay.id = 'rename-preview-overlay'; overlay.className = 'rp-overlay';
        overlay.innerHTML = `<div class="rp-panel"><div class="rp-header"><h3>改名预览</h3><span id="rp-close" style="cursor:pointer;font-size:22px;">×</span></div><div class="rp-toolbar"><button id="rp-sel-all">全选</button><button id="rp-invert">反选</button><span id="rp-sum" style="margin-left:auto">共 ${rows.length} 个，已选 0 个</span></div><div id="rp-body" class="rp-body"></div><div class="rp-footer"><button id="rp-cancel" class="rp-btn-cancel">取消</button><button id="rp-confirm" class="rp-btn-confirm">确定</button></div></div>`;
        document.body.appendChild(overlay);
        const body = document.getElementById('rp-body');
        const updSum = () => { document.getElementById('rp-sum').textContent = `共 ${rows.length} 个，已选 ${document.querySelectorAll('.rp-chk:checked').length} 个`; };
        rows.forEach((row, idx) => {
            const tr = document.createElement('div'); tr.className = 'rp-row';
            const color = row.status === '手动命名保护' ? '#fa8c16' : (row.status === '未找到' || row.status === '错误' ? '#cf1322' : '#52c41a');
            tr.innerHTML = `<input type="checkbox" class="rp-chk" data-idx="${idx}" ${row.checked ? 'checked' : ''} style="margin-top:2px;"> <div class="rp-col-code">${escapeHtml(row.item.vi.fullCode)}</div> <div class="rp-col-old">${escapeHtml(row.item.fn)}</div> <div class="rp-col-new">${escapeHtml(row.newName || '—')}</div> <div class="rp-col-status" style="color:${color};">${escapeHtml(row.status)}</div>`;
            body.appendChild(tr);
        });
        body.addEventListener('change', e => { if (e.target.classList.contains('rp-chk')) updSum(); });
        document.getElementById('rp-sel-all').onclick = () => { document.querySelectorAll('.rp-chk').forEach(c => c.checked = true); updSum(); };
        document.getElementById('rp-invert').onclick = () => { document.querySelectorAll('.rp-chk').forEach(c => c.checked = !c.checked); updSum(); };
        document.getElementById('rp-close').onclick = document.getElementById('rp-cancel').onclick = () => { overlay.remove(); onCancel(); };
        document.getElementById('rp-confirm').onclick = () => { const sel = []; document.querySelectorAll('.rp-chk:checked').forEach(c => sel.push(rows[Number(c.dataset.idx)])); overlay.remove(); onConfirm(sel); };
    }

    // ==================== 预览生成并发池化 ====================
    function buildPreviewRows(parsedItems, isLocal, done) {
        if (isLocal) {
            done(parsedItems.map(item => {
                const newName = buildNewName(item.vi, { title: item.vi.localTitle, date: item.vi.date, actresses: [] }, item.safeSuffix);
                const prot = hasManualNamePayload(item.fn, item.vi.queryCode) && newName === buildNewName(item.vi, { title: '', date: item.vi.date, actresses: [] }, item.safeSuffix);
                return { item, newName: prot ? null : newName, status: prot ? '手动命名保护' : '本地', checked: !prot };
            }));
            return;
        }

        const missing = Array.from(new Set(parsedItems.map(i => i.vi.queryCode.toUpperCase()))).filter(c => !isInfoCacheValid(c));
        const conc = Math.max(1, loadSettings().queryConcurrency || 6);

        const processItem = (item) => {
            return getTargetName(item.vi, item.safeSuffix).then(nn => {
                let st = '网络', ch = true;
                if (!nn) { st = hasManualNamePayload(item.fn, item.vi.queryCode) ? '手动命名保护' : '未找到'; ch = false; }
                return { item, newName: nn, status: st, checked: ch };
            }).catch(() => {
                return { item, newName: null, status: '错误', checked: false };
            });
        };

        if (!missing.length) {
            const results = new Array(parsedItems.length);
            const tasks = parsedItems.map((item, idx) => cb => processItem(item).then(res => { results[idx] = res; cb(); }));
            runTasksWithLimit(tasks, conc, 0, () => done(results.filter(Boolean)));
        } else {
            const fetchTasks = missing.map(code => cb => fetchRemoteInfo(code).catch(() => { }).finally(cb));
            runTasksWithLimit(fetchTasks, conc, 100, () => {
                const results = new Array(parsedItems.length);
                const tasks = parsedItems.map((item, idx) => cb => processItem(item).then(res => { results[idx] = res; cb(); }));
                runTasksWithLimit(tasks, conc, 0, () => done(results.filter(Boolean)));
            });
        }
    }

    function rename(call) {
        if (window.renameInProgress) return showPageNotification('已有任务进行中', 'info', 2000);
        window.renameInProgress = true;
        const tStart = performance.now();
        const selected = get115SelectedItems();
        if (!selected.length) { console.error('[Rename2026] 请先选择文件'); window.renameInProgress = false; return; }
        const parsedItems = [];
        selected.forEach(item => { const ss = getSafeSuffix(item.fn); const vi = parseVideoInfo(item.fn, ss); if (vi) parsedItems.push({ fid: item.fid, fn: item.fn, safeSuffix: ss, vi }); });
        if (!parsedItems.length) { console.error('[Rename2026] 未识别到有效番号'); window.renameInProgress = false; return; }

        const isLocal = (call === local_rename);
        const finishRename = () => {
            progressBox.finish();
            setCache('jb_infoCache', infoCache); setCache('jb_negativeCache', negativeCache);
            setCache('rename2026_translationCache', translationCache); setCache('rename2026_ratingNeg', ratingNegCache);
            window.renameInProgress = false;
            console.log(`[Rename2026] rename total ${(performance.now() - tStart).toFixed(0)}ms, parsed=${parsedItems.length}`);
            offerCompareExport();
        };
        const cancelRename = () => { window.renameInProgress = false; };

        const execRename = rows => {
            if (!rows.length) return cancelRename();
            progressBox.init(isLocal ? '本地规范' : '联网改名', rows.length);
            renameCompareList = []; let processed = 0;
            const tasks = rows.map(row => done => send_115(row.item.fid, row.newName, row.item.vi.fullCode, row.item.fn, () => { progressBox.update(++processed); done(); }));
            runTasksWithLimit(tasks, isLocal ? 5 : loadSettings().renameConcurrency, 50, finishRename);
        };
        if (isLocal) buildPreviewRows(parsedItems, true, rows => showRenamePreview(rows, execRename, cancelRename));
        else { buildPreviewRows(parsedItems, false, rows => showRenamePreview(rows, execRename, cancelRename)); }
    }

    // ==================== 归档与评分 ====================
    let archiveRootCid = null, archiveRootName = null, archiveRootPath = '';
    function initArchiveRoot() {
        const s = loadSettings();
        archiveRootCid = s.archiveRootCid || GM_getValue('archiveRootCid', null);
        archiveRootName = s.archiveRootName || GM_getValue('archiveRootName', null);
        archiveRootPath = s.archiveRootPath || GM_getValue('archiveRootPath', '');
    }
    initArchiveRoot();

    function setArchiveRoot() {
        const sel = get115SelectedItems();
        if (sel.length !== 1 || !sel[0].isFolder) return showPageNotification('请选择一个文件夹', 'error', 3000);
        archiveRootCid = sel[0].fid; archiveRootName = sel[0].fn; archiveRootPath = '';
        saveSettings({ archiveRootCid, archiveRootName, archiveRootPath });
        showPageNotification('已设为归档根: ' + archiveRootName, 'success', 3000);
    }

    async function archiveToActorFolder() {
        const sel = get115SelectedItems();
        if (!sel.length || !archiveRootCid) return showPageNotification('请先选择文件并设置归档根', 'error', 3000);
        const items = sel.map(it => ({ fid: it.fid, fn: it.fn, vi: parseVideoInfo(it.fn, getSafeSuffix(it.fn)) })).filter(it => it.vi);
        if (!items.length) return showPageNotification('未识别到番号', 'error', 3000);
        progressBox.init('归档', items.length); let p = 0;
        const tasks = items.map(it => done => {
            let act = '其他';
            if (/^FC2/i.test(it.vi.queryCode)) act = 'FC2';
            else if (isInfoCacheValid(it.vi.queryCode) && infoCache[it.vi.queryCode].actresses?.[0]) act = getStandardActressName(infoCache[it.vi.queryCode].actresses[0]);
            else act = it.vi.queryCode.split('-')[0];
            fetch(`https://webapi.115.com/files/add`, { method: 'POST', credentials: 'include', body: `pid=${archiveRootCid}&cname=${encodeURIComponent(act)}` })
                .then(r => r.json()).then(d => {
                    if (d.state) return d.cid || d.id;
                    if (d.errno === 20004) return fetch(`https://webapi.115.com/files/search?search_value=${encodeURIComponent(act)}&cid=${archiveRootCid}`, { credentials: 'include' }).then(r => r.json()).then(res => res.data?.list?.[0]?.cid);
                }).then(cid => {
                    if (cid) return fetch(`https://webapi.115.com/files/move`, { method: 'POST', credentials: 'include', body: `pid=${cid}&fid=${it.fid}` });
                }).finally(() => { progressBox.update(++p); done(); });
        });
        runTasksWithLimit(tasks, 3, 500, () => { progressBox.finish(); showPageNotification('归档完成', 'success', 3000); });
    }

    async function archiveToBucketFolder() {
        const sel = get115SelectedItems();
        if (!sel.length || !archiveRootCid) return showPageNotification('请先选择文件并设置归档根', 'error', 3000);
        const items = sel.map(it => ({ fid: it.fid, fn: it.fn, vi: parseVideoInfo(it.fn, getSafeSuffix(it.fn)) })).filter(it => it.vi);
        progressBox.init('分桶归档', items.length); let p = 0;
        const tasks = items.map(it => done => {
            const parts = it.vi.queryCode.split('-');
            const bucket = parts.length > 1 && !/^FC2/i.test(it.vi.queryCode) ? `${parts[0]}-${String(Math.floor(parseInt(parts[1], 10) / 1000) * 1000).padStart(4, '0')}` : (parts[0] || '其他');
            fetch(`https://webapi.115.com/files/add`, { method: 'POST', credentials: 'include', body: `pid=${archiveRootCid}&cname=${encodeURIComponent(bucket)}` })
                .then(r => r.json()).then(d => {
                    if (d.state) return d.cid || d.id;
                    if (d.errno === 20004) return fetch(`https://webapi.115.com/files/search?search_value=${encodeURIComponent(bucket)}&cid=${archiveRootCid}`, { credentials: 'include' }).then(r => r.json()).then(res => res.data?.list?.[0]?.cid);
                }).then(cid => {
                    if (cid) return fetch(`https://webapi.115.com/files/move`, { method: 'POST', credentials: 'include', body: `pid=${cid}&fid=${it.fid}` });
                }).finally(() => { progressBox.update(++p); done(); });
        });
        runTasksWithLimit(tasks, 3, 500, () => { progressBox.finish(); showPageNotification('分桶归档完成', 'success', 3000); });
    }

    const inflightRatings = new Map();
    const RATING_TIMEOUT = 8000;

    function getRatingForCode(code) {
        const key = code.toUpperCase();
        if (ratingCache[key]) return Promise.resolve(ratingCache[key]);
        if (isRatingNegativeCached(key)) return Promise.resolve(null);
        if (inflightRatings.has(key)) return inflightRatings.get(key);

        const p = gmRequest({ url: `https://javdb.com/search?q=${encodeURIComponent(key)}&f=all`, headers: COMMON_HEADERS, anonymous: true, timeout: RATING_TIMEOUT })
            .then(res => {
                const doc = parseHTML(res.responseText);
                const r = parseFloat(doc.querySelector('.movie-list .item')?.getAttribute('score'));
                if (!isNaN(r) && r > 0) { const rounded = Math.round(r * 10) / 10; ratingCache[key] = rounded; setCache('jb_ratingCache', ratingCache); return rounded; }
                markRatingNegative(key); return null;
            }).catch(() => { markRatingNegative(key); return null; }).finally(() => { inflightRatings.delete(key); });

        inflightRatings.set(key, p);
        return p;
    }

    async function getJavdbRating() {
        const sel = get115SelectedItems();
        if (!sel.length) return showPageNotification('请先选择文件', 'error', 3000);
        const items = sel.map(it => ({ fid: it.fid, fn: it.fn, vi: parseVideoInfo(it.fn, getSafeSuffix(it.fn)) })).filter(it => it.vi);
        if (!items.length) return showPageNotification('未识别到番号', 'error', 3000);
        progressBox.init('更新评分', items.length); let p = 0, success = 0;
        const tasks = items.map(it => done => {
            const code = it.vi.queryCode.toUpperCase();
            getRatingForCode(code).then(star => {
                if (!star) return;
                return fetch('https://webapi.115.com/files/score', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'file_id=' + encodeURIComponent(it.fid) + '&score=' + Math.round(star) })
                    .then(r => r.json()).then(r => { if (r?.state) success++; });
            }).catch(() => { }).finally(() => { progressBox.update(++p); done(); });
        });
        runTasksWithLimit(tasks, 2, 300, () => { progressBox.finish(); showPageNotification('评分完成：成功 ' + success + '/' + items.length, 'success', 3000); });
    }

    // ==================== 设置面板 ====================
    function openSettingsPanel() {
        document.getElementById('rename2026-settings-shadow')?.remove();
        const s = loadSettings();
        const fieldKeys = String(s.fieldOrder).split(',').map(x => x.trim()).filter(Boolean);
        Object.keys(FIELD_DEFINITIONS).forEach(k => { if (!fieldKeys.includes(k)) fieldKeys.push(k); });
        const sourceKeys = String(s.sourceOrder).split(',').map(x => x.trim()).filter(Boolean);
        const enabledSrc = new Set(String(s.scrapeSources || '').split(',').map(x => x.trim()).filter(Boolean));
        const srcLabels = { javdb: 'JavDB', javbus: 'JavBus', javlibrary: 'JavLibrary', xslist: 'Xslist', fc2ppvdb: 'FC2PPVDB', missav: 'MissAV', avsox: 'Avsox', avmoo: 'AVMoo', custom: '自定义源' };
        const mv = s.menuVisibility || {};

        const host = document.createElement('div'); host.id = 'rename2026-settings-shadow';
        host.style.cssText = 'position:fixed;inset:0;z-index:10000070;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;

        const style = document.createElement('style');
        style.textContent = `
            :host { --bg: ${isDark ? '#000' : '#f8fafc'}; --panel: ${isDark ? '#000' : '#fff'}; --text: ${isDark ? '#e5e5e5' : '#0f172a'}; --text-muted: ${isDark ? '#888' : '#64748b'}; --border: ${isDark ? '#333' : '#e2e8f0'}; --primary: #2563eb; --hover: ${isDark ? '#1a1a1a' : '#f1f5f9'}; --input-bg: ${isDark ? '#111' : '#fff'}; --input-border: ${isDark ? '#444' : '#cbd5e1'}; }
            * { box-sizing: border-box; }
            .rs-panel { width: 960px; height: 680px; max-width: 95vw; max-height: 95vh; background: var(--panel); border-radius: 10px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; overflow: hidden; color: var(--text); border: 1px solid var(--border); font-family: sans-serif; }
            
            /* 面包栏 */
            .rs-sidebar { width: 130px; background: var(--bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 12px 0; flex-shrink: 0; }
            .rs-logo { font-size: 15px; font-weight: bold; padding: 0 12px 10px; color: var(--primary); border-bottom: 1px solid var(--border); margin-bottom: 8px; }
            .rs-nav-btn { display: block; width: 100%; text-align: left; padding: 8px 12px; border: none; background: transparent; color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; outline: none; }
            .rs-nav-btn:hover { background: var(--hover); }
            .rs-nav-btn.active { background: var(--primary); color: #fff; font-weight: 600; }
            .rs-sidebar-footer { margin-top: auto; padding: 12px; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; }
            .rs-sidebar-footer a { color: var(--primary); text-decoration: none; font-weight: 500; }
            
            /* 内容区 */
            .rs-content { flex: 1; padding: 16px 20px; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
            .rs-header { font-size: 13px; font-weight: 600; margin: 4px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
            .rs-section { display: none; flex-direction: column; gap: 8px; flex: 1; overflow: hidden; }
            .rs-section.active { display: flex; }
            
            /* 网格与行 */
            .rs-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
            .rs-row { display: flex; align-items: center; justify-content: space-between; background: var(--bg); padding: 0 10px; height: 34px; border-radius: 6px; border: 1px solid var(--border); min-width: 0; overflow: hidden; }
            .rs-label { font-size: 13px; white-space: nowrap; flex: 1; color: var(--text); }
            
            /* 统一输入框尺寸 */
            .rs-input { background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text); border-radius: 4px; height: 26px; font-size: 13px; outline: none; flex-shrink: 0; box-sizing: border-box; }
            .rs-input:focus { border-color: var(--primary); }
            .rs-input[type="number"], .rs-input[type="text"] { width: 64px; text-align: center; padding: 0; }
            .rs-checkbox { width: 15px; height: 15px; accent-color: var(--primary); cursor: pointer; margin: 0; }
            
            /* 拖拽列表 */
            .drag-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
            .drag-item { display: flex; align-items: center; justify-content: space-between; padding: 0 10px; height: 34px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); min-width: 0; }
            .drag-item.dragging { opacity: 0.5; border-style: dashed; border-color: var(--primary); }
            .drag-item.is-required { opacity: 0.7; cursor: default; }
            .drag-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
            .drag-handle { color: var(--text-muted); font-size: 14px; user-select: none; cursor: grab; flex-shrink: 0; }
            
            /* 底部按钮 */
            .rs-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: auto; border-top: 1px solid var(--border); padding-top: 10px; flex-shrink: 0; }
            .rs-btn { padding: 5px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; border: 1px solid transparent; font-weight: 500; }
            .rs-btn-primary { background: var(--primary); color: #fff; }
            .rs-btn-primary:hover { opacity: 0.9; }
            .rs-btn-default { background: transparent; border-color: var(--border); color: var(--text); }
            .rs-btn-default:hover { background: var(--hover); }
        `;

        const wrapper = document.createElement('div');
        wrapper.className = 'rs-panel';
        wrapper.innerHTML = `
            <div class="rs-sidebar">
                <div class="rs-logo">115Rename</div>
                <button class="rs-nav-btn active" data-target="tab-common">通用</button>
                <button class="rs-nav-btn" data-target="tab-menu">右键菜单</button>
                <button class="rs-nav-btn" data-target="tab-sources">刮削源</button>
                <div class="rs-sidebar-footer"><a href="https://github.com/liuchanghuaX1/115Rename2026" target="_blank">⭐ GitHub</a><span>v${SCRIPT_VERSION}</span></div>
            </div>
            <div class="rs-content">
                <div id="tab-common" class="rs-section active">
                    <div class="rs-header">字段顺序与开关</div>
                    <div class="drag-list" id="rs-field-list">
                        ${fieldKeys.map(key => { const def = FIELD_DEFINITIONS[key]; if (!def) return ''; const checked = def.fixed || (s[def.settingKey] !== false); return `<div class="drag-item ${key === 'code' ? 'is-required' : ''}" data-key="${key}"><div class="drag-left"><input type="checkbox" class="rs-checkbox" data-field-enable="${key}" ${checked ? 'checked' : ''} ${def.fixed ? 'disabled' : ''}><span class="rs-label">${def.label}</span></div><div class="drag-handle">≡</div></div>`; }).join('')}
                    </div>
                    <div class="rs-header">常规设置</div>
                    <div class="rs-grid-2">
                        <div class="rs-row"><span class="rs-label">字段分隔符</span><input class="rs-input" type="text" id="rs-field-sep" value="${escapeHtml(s.fieldSeparator)}"></div>
                        <div class="rs-row"><span class="rs-label">日期前缀</span><input class="rs-input" type="text" id="rs-date-prefix" value="${escapeHtml(s.datePrefix)}"></div>
                        <div class="rs-row"><span class="rs-label">演员分隔符</span><input class="rs-input" type="text" id="rs-actress-sep" value="${escapeHtml(s.actressSeparator)}"></div>
                        <div class="rs-row"><span class="rs-label">分段标记</span><input class="rs-input" type="text" id="rs-segment-prefix" value="${escapeHtml(s.segmentPrefix || '')}"></div>
                        <div class="rs-row"><span class="rs-label">提交并发</span><input class="rs-input" type="number" id="rs-rename-concurrency" value="${s.renameConcurrency}" min="1" max="10"></div>
                        <div class="rs-row"><span class="rs-label">查询并发</span><input class="rs-input" type="number" id="rs-query-concurrency" value="${s.queryConcurrency || 6}" min="1" max="15"></div>
                        <div class="rs-row"><span class="rs-label">常规选项</span><div style="display:flex; gap: 12px; align-items:center; height: 100%;">
                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input class="rs-checkbox" type="checkbox" id="rs-protect-manual" ${s.protectManualName ? 'checked' : ''}><span class="rs-label" style="flex:none;">保护命名</span></label>
                            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input class="rs-checkbox" type="checkbox" id="rs-enable-markers" ${s.enableMarkers ? 'checked' : ''}><span class="rs-label" style="flex:none;">附加标记</span></label>
                        </div></div>
                    </div>
                    <div class="rs-header">归档根目录</div>
                    <div style="display:flex; gap:8px; height: 34px;">
                        <input class="rs-input" style="flex:1; width:auto; text-align: left; padding: 0 8px;" type="text" id="rs-archive-path" value="${escapeHtml(s.archiveRootPath || '')}" placeholder="/归档">
                        <button class="rs-btn rs-btn-primary" id="rs-archive-apply" style="height: 26px; line-height: 1;">解析</button>
                        <button class="rs-btn rs-btn-default" id="rs-clear-archive-root" style="color:#ef4444; border-color:#fca5a5; height: 26px; line-height: 1;">清除</button>
                    </div>
                    <p style="margin:0;font-size:12px;color:var(--text-muted);">当前：${archiveRootCid ? '「' + escapeHtml(archiveRootPath || archiveRootName) + '」' : '未设置'}</p>
                </div>
                <div id="tab-menu" class="rs-section">
                    <div class="rs-header">右键菜单开关</div>
                    <div class="drag-list">
                        ${MENU_ITEMS.map(it => `<div class="drag-item"><div class="drag-left"><input class="rs-checkbox" type="checkbox" data-menu-vis="${it.key}" ${mv[it.key] !== false ? 'checked' : ''}><span class="rs-label">${it.label}</span></div></div>`).join('')}
                    </div>
                </div>
                <div id="tab-sources" class="rs-section">
                    <div class="rs-header">刮削源排序与开关</div>
                    <div class="drag-list" id="rs-source-list">
                        ${sourceKeys.map(key => `<div class="drag-item" data-key="${key}"><div class="drag-left"><input type="checkbox" class="rs-checkbox" data-source-enable="${key}" ${enabledSrc.has(key) ? 'checked' : ''}><span class="rs-label">${srcLabels[key] || key}</span></div><div class="drag-handle">≡</div></div>`).join('')}
                    </div>
                    <div style="margin-top: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">自定义源（使用 <b>{}</b> 代表番号，多个网址用逗号分隔）</div>
                        <textarea id="rs-custom-sources" class="rs-input" style="width: 100%; height: 80px; resize: none; padding: 6px 8px; line-height: 1.4;" placeholder="如: https://www.google.com/search?q={}">${escapeHtml(s.customSources || '')}</textarea>
                    </div>
                </div>
                <div class="rs-footer">
                    <button class="rs-btn rs-btn-default" id="rs-reset" style="margin-right:auto; color:#ef4444; border-color:#fca5a5;">恢复默认</button>
                    <button class="rs-btn rs-btn-default" id="rs-cancel">取消</button>
                    <button class="rs-btn rs-btn-primary" id="rs-save">保存</button>
                </div>
            </div>
        `;
        shadow.appendChild(style);
        shadow.appendChild(wrapper);

        const navBtns = shadow.querySelectorAll('.rs-nav-btn'), sections = shadow.querySelectorAll('.rs-section');
        navBtns.forEach(btn => btn.onclick = () => {
            navBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            btn.classList.add('active'); shadow.getElementById(btn.dataset.target).classList.add('active');
        });

        function initDrag(container) {
            let draggedItem = null, placeholder = null, initialRect = null;
            container.addEventListener('pointerdown', e => {
                const handle = e.target.closest('.drag-handle'), item = e.target.closest('.drag-item');
                if (!handle || !item || item.classList.contains('is-required')) return;
                e.preventDefault();
                draggedItem = item; item.classList.add('dragging'); initialRect = item.getBoundingClientRect();
                placeholder = document.createElement('div'); placeholder.style.cssText = `width:${initialRect.width}px; height:${initialRect.height}px`;
                item.parentNode.insertBefore(placeholder, item);
                item.style.cssText = `position:fixed; left:${initialRect.left}px; top:${initialRect.top}px; width:${initialRect.width}px; z-index:99999; pointer-events:none;`;
                document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onUp, { once: true });
            });
            function onMove(e) {
                if (!draggedItem) return;
                draggedItem.style.top = `${e.clientY - initialRect.height / 2}px`;
                const target = [...container.querySelectorAll('.drag-item:not(.dragging)')].find(el => { const r = el.getBoundingClientRect(); return e.clientY >= r.top && e.clientY <= r.bottom; });
                if (target) { const r = target.getBoundingClientRect(); container.insertBefore(placeholder, e.clientY > r.top + r.height / 2 ? target.nextSibling : target); }
            }
            function onUp() {
                if (draggedItem) {
                    draggedItem.style.cssText = ''; draggedItem.classList.remove('dragging');
                    placeholder.parentNode.insertBefore(draggedItem, placeholder); placeholder.remove();
                    draggedItem = null; placeholder = null;
                }
                document.removeEventListener('pointermove', onMove);
            }
        }
        initDrag(shadow.getElementById('rs-field-list'));
        initDrag(shadow.getElementById('rs-source-list'));

        shadow.getElementById('rs-cancel').onclick = () => host.remove();
        shadow.getElementById('rs-reset').onclick = () => {
            if (!confirm('恢复默认？（保留归档根目录）')) return;
            const keep = { archiveRootCid, archiveRootName, archiveRootPath };
            SETTINGS = null; GM_setValue('rename2026_settings', '{}');
            saveSettings(keep);
            showPageNotification('已恢复默认设置', 'success', 2000); host.remove();
        };
        shadow.getElementById('rs-archive-apply').onclick = async function () {
            const p = shadow.getElementById('rs-archive-path').value.trim();
            if (!p) return alert('请输入路径');
            this.disabled = true; this.textContent = '...';
            try {
                const parts = p.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean); let parentCid = 0;
                for (const part of parts) {
                    const cur = parts.slice(0, parts.indexOf(part) + 1).join('/');
                    let cid = await fetch(`https://webapi.115.com/files/getid?path=/${encodeURIComponent(cur)}`, { credentials: 'include' }).then(r => r.json()).then(d => d.id || d.cid);
                    if (!cid) cid = await fetch('https://webapi.115.com/files/add', { method: 'POST', credentials: 'include', body: `pid=${parentCid}&cname=${encodeURIComponent(part)}` }).then(r => r.json()).then(d => d.cid || d.id);
                    parentCid = cid;
                }
                archiveRootCid = String(parentCid); archiveRootName = parts.pop(); archiveRootPath = p;
                saveSettings({ archiveRootCid, archiveRootName, archiveRootPath });
                alert('已保存：' + p); host.remove();
            } catch (e) { alert('解析失败：' + e.message); }
            finally { this.disabled = false; this.textContent = '解析'; }
        };
        shadow.getElementById('rs-clear-archive-root').onclick = () => {
            archiveRootCid = archiveRootName = archiveRootPath = null; saveSettings({ archiveRootCid: null, archiveRootName: null, archiveRootPath: '' });
            host.remove(); showPageNotification('已清除归档根', 'info', 2000);
        };
        shadow.getElementById('rs-save').onclick = () => {
            const em = {};
            ['title', 'zhTitle', 'actresses', 'date', 'rating'].forEach(k => {
                const cb = shadow.querySelector(`[data-field-enable="${k}"]`);
                em['enable' + k.charAt(0).toUpperCase() + k.slice(1)] = cb ? cb.checked : undefined;
            });
            const mv2 = {}; shadow.querySelectorAll('[data-menu-vis]').forEach(cb => mv2[cb.dataset.menuVis] = cb.checked);
            const newOrder = Array.from(shadow.getElementById('rs-field-list').querySelectorAll('.drag-item')).map(el => el.dataset.key).join(',');
            const newSrcOrder = Array.from(shadow.getElementById('rs-source-list').querySelectorAll('.drag-item')).map(el => el.dataset.key).join(',');
            const newEnabledSrc = Array.from(shadow.querySelectorAll('[data-source-enable]')).filter(cb => cb.checked).map(cb => cb.dataset.sourceEnable);

            saveSettings({
                fieldOrder: newOrder, fieldSeparator: shadow.getElementById('rs-field-sep').value || ' ', datePrefix: shadow.getElementById('rs-date-prefix').value,
                actressSeparator: shadow.getElementById('rs-actress-sep').value || '・',
                enableTitle: em.enableTitle !== false,
                enableZhTitle: em.enableZhTitle === true,
                enableActresses: em.enableActresses !== false,
                enableDate: em.enableDate !== false,
                enableRating: em.enableRating === true,
                enableMarkers: shadow.getElementById('rs-enable-markers').checked,
                protectManualName: shadow.getElementById('rs-protect-manual').checked, segmentPrefix: shadow.getElementById('rs-segment-prefix').value,
                renameConcurrency: Math.max(1, Math.min(10, parseInt(shadow.getElementById('rs-rename-concurrency').value, 10) || 5)),
                queryConcurrency: Math.max(1, Math.min(15, parseInt(shadow.getElementById('rs-query-concurrency').value, 10) || 6)),
                sourceOrder: newSrcOrder, scrapeSources: newEnabledSrc.join(','), customSources: shadow.getElementById('rs-custom-sources').value.trim(), menuVisibility: mv2
            });
            showPageNotification('设置已保存', 'success', 2000); host.remove();
        };
    }

    // ==================== 全局样式与自适应通知 ====================
    GM_addStyle(`
        .custom-notification {
            position: fixed; top: 80px; right: 20px; max-width: 300px;
            padding: 12px 20px; border-radius: 6px; z-index: 9999; font-size: 14px;
            transition: all .3s; opacity: 0; transform: translateY(-10px);
            background: #fff; color: #333; border: 1px solid #e2e8f0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        /* 适配 115 深色模式及系统深色模式 */
        html[data-theme="dark"] .custom-notification,
        body.dark .custom-notification {
            background: #1e1e1e; color: #e5e5e5; border-color: #333; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        @media (prefers-color-scheme: dark) {
            .custom-notification { background: #1e1e1e; color: #e5e5e5; border-color: #333; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        }
        .custom-notification.success { border-left: 4px solid #52c41a; }
        .custom-notification.error { border-left: 4px solid #f5222d; }
        .custom-notification.info { border-left: 4px solid #1890ff; }
        .custom-notification.show { opacity: 1; transform: translateY(0); }
        
        #task-progress-box{position:fixed;bottom:20px;right:20px;min-width:260px;background:rgba(0,0,0,.85);color:#fff;padding:10px 14px;border-radius:4px;z-index:9999;font-size:12px;}
        #task-progress-box .tp-bar-outer{width:100%;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden;margin-top:6px;}
        #task-progress-box .tp-bar-inner{height:100%;width:0;background:#1890ff;transition:width .2s;}
    `);

    try { GM_registerMenuCommand('⚙️ 设置', openSettingsPanel); } catch (e) { }

    console.log('115Rename2026 v' + SCRIPT_VERSION + ' 正式版已加载');
})();