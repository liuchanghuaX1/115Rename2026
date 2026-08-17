// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         2.1.0
// @description     115视频整理：右键菜单保留｜中文翻译｜演员补全｜多站改名+归档+评分+备份｜性能优化
// @author          sonarlee
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @domain          javbus.com
// @domain          javlibrary.com
// @domain          xslist.org
// @domain          javdb.com
// @domain          fc2ppvdb.com
// @connect         javbus.com
// @connect         javlibrary.com
// @connect         xslist.org
// @connect         javdb.com
// @connect         webapi.115.com
// @connect         fc2ppvdb.com
// @connect         client-rapi-missav.recombee.com
// @connect         oneshot-free.www.deepl.com
// @connect         api.mymemory.translated.net
// @grant           GM_notification
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM_setClipboard
// @grant           GM_registerMenuCommand
// @grant           GM_addStyle
// @license         MIT
// @homepageURL     https://github.com/liuchanghuaX1/115Rename2026
// @supportURL      https://github.com/liuchanghuaX1/115Rename2026/issues
// @downloadURL     https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js
// @updateURL       https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js
// ==/UserScript==

(function () {
    "use strict";

    // ========== UI 初始化 ==========
    const rootInfoId = 'archive-root-info-' + Date.now();
    function cleanupExistingRootInfo() {
        try {
            document.querySelectorAll('[id^="archive-root-info"]').forEach(el => el.remove());
            document.querySelectorAll('iframe').forEach(iframe => {
                try { if (iframe.contentDocument) iframe.contentDocument.querySelectorAll('[id^="archive-root-info"]').forEach(el => el.remove()); } catch (e) { }
            });
        } catch (e) { }
    }
    cleanupExistingRootInfo();

    const uiStyle = `<style>
        [id^="archive-root-info"] { position: fixed; top: 20px; right: 20px; max-width: 300px; background: rgba(0,0,0,.8); color: #fff; padding: 12px 20px; border-radius: 4px; z-index: 9998; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,.15); border-left: 4px solid #1890ff; }
        .custom-notification { position: fixed; top: 80px; right: 20px; max-width: 300px; background: rgba(0,0,0,.8); color: #fff; padding: 12px 20px; border-radius: 4px; z-index: 9999; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,.15); transition: all .3s ease; opacity: 0; transform: translateY(-10px); }
        .custom-notification.success { border-left: 4px solid #52c41a; }
        .custom-notification.error { border-left: 4px solid #f5222d; }
        .custom-notification.info { border-left: 4px solid #1890ff; }
        .custom-notification.show { opacity: 1; transform: translateY(0); }
        #task-progress-box { position: fixed; bottom: 20px; right: 20px; min-width: 260px; background: rgba(0,0,0,.8); color: #fff; padding: 10px 14px; border-radius: 4px; z-index: 9999; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
        #task-progress-box .tp-title { font-size: 12px; margin-bottom: 6px; }
        #task-progress-box .tp-bar-outer { width: 100%; height: 6px; background: rgba(255,255,255,.15); border-radius: 3px; overflow: hidden; }
        #task-progress-box .tp-bar-inner { height: 100%; width: 0%; background: #1890ff; transition: width .2s ease; }
        #task-progress-box .tp-text { margin-top: 4px; text-align: right; font-size: 11px; opacity: .9; }
    </style>`;
    $('head').append(uiStyle);

    const ROOT_DIR_CID = "0";
    let archiveRootCid = GM_getValue("archiveRootCid", null);
    let archiveRootName = GM_getValue("archiveRootName", null);
    const infoCache = JSON.parse(GM_getValue('jb_infoCache', '{}'));
    const actressCache = JSON.parse(GM_getValue('jb_actressCache', '{}'));
    const ratingCache = JSON.parse(GM_getValue('jb_ratingCache', '{}'));
    const folderCidCache = {};

    // ========== 全局任务锁 ==========
    window.renameInProgress = false;

    // ========== 并发与进度（修复：doneAll 只执行一次） ==========
    function runTasksWithLimit(tasks, limit, intervalMs, doneAll) {
        if (!tasks.length) { doneAll && doneAll(); return; }
        let index = 0, running = 0;
        let doneAllCalled = false;
        const callDoneAllOnce = () => {
            if (!doneAllCalled) {
                doneAllCalled = true;
                doneAll && doneAll();
            }
        };
        const next = () => {
            if (index >= tasks.length && running === 0) {
                callDoneAllOnce();
                return;
            }
            while (running < limit && index < tasks.length) {
                const task = tasks[index++];
                running++;
                const runTask = () => {
                    task(() => {
                        running--;
                        setTimeout(next, intervalMs || 0);
                    });
                };
                setTimeout(runTask, 0);
            }
        };
        next();
    }

    window.progressBox = {
        init(title, total) {
            this.total = total || 0; this.current = 0; this.title = title || '任务进度';
            let $box = $('#task-progress-box');
            if ($box.length === 0) {
                $('body').append(`<div id="task-progress-box" style="display:none;"><div class="tp-title"></div><div class="tp-bar-outer"><div class="tp-bar-inner"></div></div><div class="tp-text"></div></div>`);
                $box = $('#task-progress-box');
            }
            $box.find('.tp-title').text(this.title);
            this.update(0); $box.show();
        },
        update(doneCount) {
            this.current = doneCount;
            const pct = Math.min(100, Math.round(doneCount * 100 / (this.total || 1)));
            const $box = $('#task-progress-box');
            $box.find('.tp-bar-inner').css('width', pct + '%');
            $box.find('.tp-text').text(`${doneCount}/${this.total} (${pct}%)`);
        },
        finish() { this.update(this.total); setTimeout(() => $('#task-progress-box').fadeOut(300), 800); }
    };

    window.showPageNotification = (message, type = 'info', duration = 3000) => {
        if (duration === 3000) { if (type === 'success') duration = 3000; else if (type === 'error') duration = 5000; }
        const id = 'cn-' + Date.now();
        $('body').append(`<div id="${id}" class="custom-notification ${type}">${message}</div>`);
        setTimeout(() => $(`#${id}`).addClass('show'), 10);
        setTimeout(() => { $(`#${id}`).removeClass('show'); setTimeout(() => $(`#${id}`).remove(), 300); }, duration);
    };

    const showArchiveRootInfo = () => {
        cleanupExistingRootInfo();
        let msg = (archiveRootCid && archiveRootName) ? `当前归档根目录: "${archiveRootName}"` : "当前无归档根目录，将使用115网盘根目录";
        if (window.self === window.top) $('body').append(`<div id="${rootInfoId}" class="archive-root-info">${msg}</div>`);
    };

    let rootInfoTimer = null;
    const initializeRootInfo = () => {
        if (window.self !== window.top) return;
        if (rootInfoTimer) clearTimeout(rootInfoTimer);
        rootInfoTimer = setTimeout(() => { showArchiveRootInfo(); rootInfoTimer = null; }, 2000);
    };
    $(window).on('load', initializeRootInfo);
    if (document.readyState === 'complete') initializeRootInfo();

    // ========== 菜单 ==========
    const rename_list = `
        <li id="rename_list">
            <a id="local_code_process" class="mark" href="javascript:;">本地番号加工</a>
            <a id="rename_all_multi_date" class="mark" href="javascript:;">改名(多网站轮询)</a>
            <a id="rename_all_multi_zh" class="mark" href="javascript:;">改名(中文翻译)</a>
            <a id="archive_to_folder" class="mark" href="javascript:;">归档至文件夹</a>
            <a id="set_archive_root" class="mark" href="javascript:;">设为归档根目录</a>
            <a id="get_javdb_rating" class="mark" href="javascript:;">获取javdb评分</a>
            <a id="backup_file_names" class="mark" href="javascript:;">备份文件名</a>
        </li>`;

    let interval = setInterval(buttonInterval, 1000);
    const javbusBase = "https://www.javbus.com/";
    const javbusDirectAccess = javbusBase;
    const javbusUncensoredBase = javbusBase + "uncensored/";
    const javlibSearchBase = "https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=";
    const javlibBase = "https://www.javlibrary.com/";
    const xslistBase = "https://xslist.org/tw/";
    const javdbBase = "https://javdb.com";
    const javdbSearchBase = javdbBase + "/search?q=";
    const fc2ppvdbBase = "https://fc2ppvdb.com/articles/";

    // ========== 广告清理 ==========
    const stripDomainPrefix = (filename) => {
        const idx = filename.lastIndexOf('@');
        return idx === -1 ? filename : filename.substring(idx + 1).trim();
    };

    // ========== 安全后缀 ==========
    const getSafeSuffix = (filename) => {
        const m = filename.match(/\.([a-z0-9]{2,5})$/i);
        if (m && !/^\d+$/.test(m[1])) return m[0];
        return '';
    };

    // ========== 垃圾词与标记 ==========
    const GARBAGE_WORDS = [
        'WWW', 'FHD', 'HD', 'SD', 'X264', 'X265', 'H264', 'H265', 'HEVC', 'AVC',
        'AAC', 'AC3', 'DTS', 'FLAC', 'MP3', 'MP4', 'MKV', 'AVI', 'WMV', 'M4V', 'RMVB', 'ISO', 'TS',
        'WATERMARK', 'RARBG', 'WEB-DL', 'WEBRIP', 'BLURAY', 'BDREMUX',
        '1440P', '1080P', '720P', '480P'
    ];
    const GARBAGE_REGEX = new RegExp('\\b(' + GARBAGE_WORDS.join('|') + ')\\b', 'gi');
    const MARKER_PATTERN = /(4K|8K|60fps|120fps|破解|流出|leak(?:ed)?|無修正|无码|uncensored|中字|字幕|chinese|chs|cht|big5|gb|sc|中文字幕|2160p|VR)/gi;
    const MARKER_MAP = {
        leak: '流出', leaked: '流出', 流出: '流出',
        uncensored: '无码', 無修正: '无码', 无码: '无码',
        chs: '中文字幕', cht: '中文字幕', gb: '中文字幕', big5: '中文字幕', sc: '中文字幕', chinese: '中文字幕',
        中字: '中文字幕', 字幕: '中文字幕', 中文: '中文字幕', 中文字幕: '中文字幕',
        '4k': '4K', '8k': '8K', '60fps': '60fps', '120fps': '120fps',
        破解: '破解', '2160p': '4K', vr: 'VR'
    };
    const AD_BADGES = /\[3Q\]|\(原\)|\[BT\]|【广告】|\[廣告\]/gi;

    const removeMarkers = (str) => {
        return str.replace(MARKER_PATTERN, (match, p1, offset, full) => {
            const lower = match.toLowerCase();
            if (offset > 0 && /[a-z0-9]/i.test(full[offset - 1])) return match;
            if (offset + match.length < full.length && /[a-z0-9]/i.test(full[offset + match.length])) return match;
            return ' ';
        });
    };

    // ========== 番号前缀库（长优先） ==========
    const CODE_PREFIXES = [
        'LEGSJAPAN', 'AYAKISAKI', 'SPERMMANIA', 'FELLATIOJAPAN',
        'S2MCR', 'MXVR', 'SIVR',
        'T28', 'S2M', '300MAAN', '200GANA', '259LUXU', '277DCV', '230GANA', '261ADA',
        'DASS', 'REBD', 'REBDB', 'MIDV', 'SSIS', 'PRED', 'PRTD', 'FSDSS', 'SAMA',
        'MIDE', 'MIAD', 'MIAA', 'MIAE', 'MIAS', 'MIGD', 'MIRD', 'MIFD', 'MIID', 'MIZD', 'MDYD', 'MBYD', 'MEYD',
        'WANZ', 'NWF', 'BMW', 'JBD', 'RBD', 'ATAD', 'SHKD', 'SSPD', 'ATID', 'ADN',
        'IPTD', 'IPZ', 'IPX', 'IPZZ', 'IPIT', 'IPITD', 'IDBD', 'SUPD', 'IPSD', 'DAN', 'AND',
        'KAWD', 'KWBD', 'KAPD', 'JUC', 'JUX', 'JUY', 'JUSD', 'JUKD', 'OBA', 'URE',
        'JUFE', 'FINH', 'EBOD', 'MKCK', 'EYAN', 'KIRD', 'KIBD', 'BLK', 'KISD',
        'ONED', 'SOE', 'SNIS', 'SSNI', 'OFJE', 'SPS', 'SRXV', 'TMSD', 'NEXD',
        'PGD', 'PBD', 'PJD', 'TEK', 'PPPD', 'HND', 'TYOD', 'TPPN', 'BF', 'ZUKO',
        'BID', 'BBI', 'CJOD', 'CLUB', 'MMND', 'TEAM', 'HHK', 'ALB', 'MUKD', 'MUDR', 'MUM',
        'ANND', 'BBAN', 'MOND', 'SPRD', 'VENU', 'VEMA', 'VAGU',
        'STARS', 'STAR', 'SACE', 'SDMS', 'SDDE', 'SDMT', 'SDDM', 'SDNM', 'SDAB', 'SDSI', 'SDMU',
        'DVDPS', 'DVDES', 'NHDT', 'NHDTA', 'RNHDT', 'IESP', 'IDOL', 'IENE', 'OPEN',
        'SVND', 'HBAD', 'HAVD', 'NTR', 'VSPDS', 'VSPDR', 'MV', 'FSET', 'DANDY', 'LADY',
        'HUNTA', 'HUNTB', 'HUNT', 'GAR', 'SVDVD', 'RCT', 'RCTD', 'NGKS', 'RD', 'KUF', 'NSS', 'UPSM', 'SERO',
        'DVAJ', 'DV', 'XVSR', 'XVSE', 'XV', 'PXV',
        'MADA', 'MDS', 'RMLD', 'MILD', 'MDB', 'RMDBB', 'RMDS', 'REAL', 'NATR', 'SCOP', 'SAMA', 'BOKD',
        'ABS', 'ABP', 'KBH', 'EZD', 'MAS', 'INU', 'JOB', 'EDD', 'ESK', 'MEK', 'DOM', 'YRZ',
        'PPP', 'EVO', 'SAD', 'GYD', 'HYK', 'FST', 'TBL', 'LOO', 'TOR', 'TD', 'RBS', 'MAN', 'ZZR', 'WPC', 'BNDV', 'CRS',
        'HODV', 'HRDV', 'YMDD', 'TMD', 'DSD', 'RJMD', 'ALD', 'DBE', 'DOJ', 'OFCD', 'SEND', 'ULJM', 'DSS', 'MOED', 'DER',
        'OPD', 'GRYD', 'MSBD', 'SS', 'HD', 'DVH', 'REID', 'GEN', 'DBUD', 'IBW', 'MMO', 'ADZ',
        'AKB', 'HITMA', 'RAY', '24ID', 'COSQ',
        'GRET', 'GATE', 'GEXP', 'GGFH', 'GGTB', 'GMMD', 'GODS', 'GPTM', 'GSAD', 'GXXD', 'GDGA', 'GOMK', 'GTRL',
        'GOMD', 'GDSC', 'TBW', 'TBB', 'TDP', 'TDLN', 'TGGP', 'THP', 'THZ', 'TMS', 'TZZ', 'TRE', 'TSGS', 'TSDL',
        'TSWN', 'TSW', 'TTRE', 'ATHB', 'AKBD', 'DMG', 'MGJH', 'ANIX', 'CYCD', 'YNO', 'AZGB', 'SKOT', 'SHP', 'JMSZ',
        'JHZD', 'NFDM', 'CGAD', 'CGBD', 'CHSD', 'CUSD', 'CHSH', 'CMV', 'PAED', 'RGI', 'ZARD', 'ZATS', 'ZDAD', 'ZKV',
        'COSETT', 'MXGS', 'MX3DS', 'IPBZ', 'FSDSS', 'SVMGM', 'MIDA',
        'DSAM', 'RED', 'BT', 'MX', 'SI', 'VOL', 'CR', 'N',
        // 新增缺失前缀
        'STZY', 'START', 'SONE', 'KIDM'
    ].sort((a, b) => b.length - a.length);

    // 预编译正则，同时保存前缀
    const CODE_PREFIX_PATTERNS = CODE_PREFIXES.map(p => ({
        prefix: p,
        regex: new RegExp(`\\b${p}[-_ ]?0*(\\d{1,5})(?![0-9])`, 'i'),
        looseRegex: new RegExp(`\\b${p}[-_ ]?0*(\\d{1,5})(?![0-9])`, 'i')
    }));

    const matchCodeByPrefix = str => {
        if (!str) return null;
        for (const item of CODE_PREFIX_PATTERNS) {
            const m = str.match(item.regex);
            if (m) return `${item.prefix}-${(m[1] === '0' ? '0' : m[1]).padStart(3, '0')}`;
        }
        for (const item of CODE_PREFIX_PATTERNS) {
            const m = str.match(item.looseRegex);
            if (m) return `${item.prefix}-${(m[1] === '0' ? '0' : m[1]).padStart(3, '0')}`;
        }
        const loose = str.match(/\b([A-Z]{2,8})\s*0*(\d{2,5})(?![0-9])/);
        if (loose) {
            const prefix = loose[1];
            if (!GARBAGE_WORDS.includes(prefix) && prefix.length > 1) {
                let num = Number(loose[2]).toString();
                if (num === '0') num = '0';
                return `${prefix}-${num.padStart(3, '0')}`;
            }
        }
        return null;
    };

    const extractFC2Code = (str) => {
        const patterns = [
            /\bfc(\d{5,7})\b/i,
            /\bFC2[\s_-]*PPV[\s_-]*(\d{5,7})\b/i,
            /\bFC2PPV[\s_-]*(\d{5,7})\b/i,
            /\bFC2[\s_-]+(\d{5,7})\b/i,
            /\bFC2-(\d{5,7})\b/i,
            /\bFC2(\d{5,7})\b/i,
            /\bPPV[\s_-]*(\d{5,7})\b/i,
            /\bF[\s_-]*(\d{5,7})\b(?!\d)/i,
        ];
        for (const regex of patterns) {
            const m = str.match(regex);
            if (m && m[1] && !/^(?:HD|FHD|SD|X264|X265|H264|H265|HEVC|AVC|AAC|AC3|DTS|FLAC|MP3|MP4|MKV|AVI|WMV|M4V|RMVB|ISO|TS|WATERMARK|RARBG|WEB-DL|WEBRIP|BLURAY|BDREMUX|1440P|1080P|720P|480P)$/i.test(m[1])) {
                return 'FC2-PPV-' + m[1];
            }
        }
        return null;
    };

    const removeCodeFromTitle = (str, baseCode) => {
        if (!baseCode) return str;
        const stdMatch = baseCode.match(/^([A-Za-z]+)[-_\s]?(\d+)$/);
        if (stdMatch) {
            const prefix = stdMatch[1];
            const rawNum = parseInt(stdMatch[2], 10).toString();
            str = str.replace(new RegExp(`\\b${prefix}[-_\\s.]*0*${rawNum}(?![_\\s.-]*[a-zA-Z]\\d)`, 'gi'), ' ');
        }
        if (/^FC2[-_\s]?PPV[-_\s]?\d+$/i.test(baseCode)) {
            const num = baseCode.match(/\d+$/)[0];
            const rawNum = parseInt(num, 10).toString();
            str = str.replace(new RegExp(`\\b(?:FC2[-_\\s.]?(?:PPV[-_\\s.]?)?0*${rawNum}|PPV[-_\\s.]?0*${rawNum})(?![_\\s.-]*[a-zA-Z]\\d)`, 'gi'), ' ');
        }
        const thMatch = baseCode.match(/^Tokyo[-_\s]*Hot[-_\s]*[nN](\d{3,4})$/i);
        if (thMatch) {
            const num = thMatch[1].padStart(4, '0');
            const rawNum = parseInt(num, 10).toString();
            str = str.replace(new RegExp(
                `\\b(?:Tokyo\\s*[-_\\s]*Hot\\s*[-_\\s]*[nN]?\\s*0*${rawNum}|` +
                `TokyoHotn?${rawNum}|` +
                `Hotn?${rawNum})` +
                `(?![_\\s.-]*[a-zA-Z]\\d)`,
                'gi'
            ), ' ');
        }
        return str.replace(/\s+/g, ' ').trim();
    };

    // ========== 核心解析（共用） ==========
    const parseVideoInfo = (origTitle, safeSuffix) => {
        try {
            if (!origTitle) return null;
            let raw = String(origTitle);
            raw = stripDomainPrefix(raw);
            let rawForCode = safeSuffix ? raw.slice(0, raw.lastIndexOf(safeSuffix)) : raw;

            let markers = [];
            rawForCode.replace(MARKER_PATTERN, (match, p1, offset, full) => {
                const lower = match.toLowerCase();
                if (offset > 0 && /[a-z0-9]/i.test(full[offset - 1])) return match;
                if (offset + match.length < full.length && /[a-z0-9]/i.test(full[offset + match.length])) return match;
                const nm = MARKER_MAP[lower];
                if (nm && !markers.includes(nm)) markers.push(nm);
                return match;
            });

            let dateStr = '';
            const dm = rawForCode.match(/(?:\b|_|^|@|】|\[|【)((?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2})(?:\b|_|$|(?=[A-Za-z\u4e00-\u9fa5【\[\]】]))/i);
            if (dm) {
                const parts = dm[1].trim().split(/[-_\/\.\s]+/);
                if (parts.length === 3) {
                    const year = parts[0].length === 2 ? '20' + parts[0] : parts[0];
                    dateStr = `${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                }
                rawForCode = rawForCode.replace(dm[0], ' ');
            }

            let t = removeMarkers(rawForCode).toUpperCase();
            t = t.replace(/(?:\b|_|^|@|】|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
            t = t.replace(GARBAGE_REGEX, ' ').replace(/[\[\]\{\}（）【】]/g, ' ').replace(/[_\.\-\/\\]+/g, ' ');
            t = t.replace(/\b[01]+(?=[A-Z])/g, '').replace(/\b([A-Z])\s(?=[A-Z]\b)/g, '$1');

            let queryCode = null, displayCode = null;
            const thMatch = rawForCode.match(/Tokyo[\s_-]*Hot[\s_-]*[nN]?(\d{3,4})/i);
            if (thMatch) {
                const num = thMatch[1].padStart(4, '0');
                queryCode = `Tokyo-Hot-n${num}`;
                displayCode = queryCode;
            } else {
                const fc2Code = extractFC2Code(rawForCode) || extractFC2Code(t);
                if (fc2Code) {
                    queryCode = fc2Code;
                    displayCode = fc2Code;
                    const fc2Num = fc2Code.match(/\d+$/)[0];
                    const rawFC2Pattern = new RegExp(`\\b(?:fc2?|FC2?)[\\s_-]*(?:ppv[\\s_-]*)?0*${fc2Num}\\b`, 'i');
                    const rawFC2Match = rawForCode.match(rawFC2Pattern);
                    if (rawFC2Match) rawForCode = rawForCode.replace(rawFC2Match[0], ' ');
                } else {
                    const numM = t.match(/\b(\d{4,6})[-_ ](\d{3,4})\b/);
                    if (numM) {
                        queryCode = `${numM[1]}-${numM[2]}`;
                        const lowerRaw = rawForCode.toLowerCase();
                        if (/1pon/i.test(lowerRaw)) displayCode = `1pondo-${numM[1]}-${numM[2]}`;
                        else if (/carib/i.test(lowerRaw)) displayCode = `Caribbean-${numM[1]}-${numM[2]}`;
                        else if (/paco/i.test(lowerRaw)) displayCode = `Pacopacomama-${numM[1]}-${numM[2]}`;
                        else if (/heydouga/i.test(lowerRaw)) displayCode = `Heydouga-${numM[1]}-${numM[2]}`;
                        else if (/tokyo/i.test(lowerRaw)) displayCode = `TokyoHot-${numM[1]}-${numM[2]}`;
                        else { queryCode = `${numM[1]}-${numM[2]}`; displayCode = queryCode; }
                    } else {
                        queryCode = matchCodeByPrefix(t);
                        if (queryCode) displayCode = queryCode;
                    }
                    if (queryCode && !/^FC2-PPV/.test(queryCode)) {
                        const codeForPattern = queryCode.replace(/-/g, '[-_\\s.]?');
                        const rawMatch = rawForCode.match(new RegExp(`\\b${codeForPattern}(?![0-9])`, 'i'));
                        if (rawMatch) rawForCode = rawForCode.replace(rawMatch[0], ' ');
                    }
                }
            }
            if (!queryCode) return null;
            const baseCode = displayCode || queryCode;

            const safeB = queryCode.replace(/_/g, '-').replace(/-/g, '[-_ ]?');
            if (raw.indexOf("中文") !== -1 || new RegExp(safeB + "[_-](UC|C)\\b", "i").test(raw)) {
                if (!markers.includes('中文字幕')) markers.push('中文字幕');
            }
            if (raw.indexOf("无码") !== -1 || new RegExp(safeB + "[_-](UC|U)\\b", "i").test(raw)) {
                if (!markers.includes('无码')) markers.push('无码');
            }

            let part = '';
            if (/^FC2-PPV-\d{5,7}$/i.test(queryCode)) {
                const partMatch = rawForCode.match(/^\s*[_\-](\d{1,3})\b/);
                if (partMatch) {
                    part = partMatch[1];
                    rawForCode = rawForCode.replace(partMatch[0], ' ').trim();
                }
            }

            const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const keywordRegex = new RegExp(
                `${escapedBase}[\\s._-]*(?:part|pt|cd|disc|ep|sp|vol|no|volume)[\\s._-]*(\\d{1,3}|[a-dA-D])(?![a-zA-Z0-9])`,
                'i'
            );
            const kwMatch = rawForCode.match(keywordRegex);
            if (kwMatch) {
                part = kwMatch[1].toUpperCase();
                rawForCode = rawForCode.replace(kwMatch[0], ' ').trim();
            } else if (!part) {
                const numRegex = new RegExp(
                    `${escapedBase}[_\\-](\\d{1,3})(?![a-zA-Z])` +
                    `|${escapedBase}\\.(\\d{1,3})(?![a-zA-Z0-9])`,
                    'i'
                );
                const nm = rawForCode.match(numRegex);
                if (nm) {
                    part = (nm[1] || nm[2]).toUpperCase();
                    rawForCode = rawForCode.replace(nm[0], ' ').trim();
                }
            }
            const fullCode = part ? `${baseCode}-${part}` : baseCode;

            let cleanTitle = removeMarkers(rawForCode);
            cleanTitle = cleanTitle.replace(/(?:\b|_|^|@|】|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
            cleanTitle = cleanTitle.replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ');
            cleanTitle = cleanTitle.replace(AD_BADGES, ' ');
            cleanTitle = cleanTitle.replace(GARBAGE_REGEX, ' ');
            // 保留标题内部原有间隔符（下划线暂不替换，最终在 buildNewName 统一处理）
            cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
            cleanTitle = removeCodeFromTitle(cleanTitle, baseCode);

            return { queryCode, baseCode, fullCode, markers, date: dateStr, localTitle: cleanTitle };
        } catch (e) {
            console.error('parseVideoInfo error:', e);
            return null;
        }
    };

    // ========== 构建新名称（共用） ==========
    const buildNewName = (vInfo, title, actresses, dateStr, suffix) => {
        let cleanTitle = removeCodeFromTitle(title, vInfo.baseCode);
        cleanTitle = cleanTitle.replace(/【[^】]*】/g, '').trim();
        let name = vInfo.fullCode;
        if (cleanTitle) name += ' ' + cleanTitle;
        if (actresses && actresses.length) {
            const actressStr = actresses.join('・');
            if (!name.includes(actressStr)) name += ' ' + actressStr;
        }
        if (vInfo.markers && vInfo.markers.length) {
            const uniq = [...new Set(vInfo.markers)].filter(Boolean);
            const existingMarkers = name.match(/【[^】]*】/g) || [];
            const toAdd = uniq.filter(m => !existingMarkers.includes(`【${m}】`));
            if (toAdd.length) name += toAdd.map(m => `【${m}】`).join('');
        }
        if (dateStr) name += '-' + dateStr; // 日期前使用连字符
        if (suffix) name += suffix;
        name = name.replace(/\s+/g, ' ').trim();
        name = name.replace(/\s+\./g, '.');
        // 统一所有下划线为连字符
        name = name.replace(/_/g, '-');
        return name.replace(/[\\/:*?"<>|]/g, (c) => ({ '\\': '', '/': ' ', ':': ' ', '?': ' ', '"': ' ', '<': ' ', '>': ' ', '|': '' })[c] || '');
    };

    let renameCompareList = [];
    const send_115 = (id, name, fh, origFilename, callback) => {
        const fn = name.replace(/[\\/:*?"<>|]/g, (c) => ({ '\\': '', '/': ' ', ':': ' ', '?': ' ', '"': ' ', '<': ' ', '>': ' ', '|': '' })[c] || '');
        $.post("https://webapi.115.com/files/edit", { fid: id, file_name: fn }, data => {
            const r = JSON.parse(data);
            if (!r.state) showPageNotification(`${fh} 修改失败: ${r.error}`, 'error', 3000);
            else {
                showPageNotification(`${fh} 修改成功`, 'success', 2000);
                if (origFilename) renameCompareList.push({ original: origFilename, new: name });
            }
            if (typeof callback === 'function') callback();
        }).fail(() => { showPageNotification(`${fh} 请求失败`, 'error', 3000); if (typeof callback === 'function') callback(); });
    };

    // ========== DOMParser 辅助 ==========
    const parseHTML = (html) => new DOMParser().parseFromString(html, "text/html");

    // ========== 多站刮削（改用 DOMParser，anonymous: true） ==========
    const normDate = d => {
        if (!d) return '';
        const m = d.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        const m2 = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
        return d;
    };

    const fetchJavlib = (code, ok, fail) => {
        GM_xmlhttpRequest({
            method: "GET", url: javlibSearchBase + encodeURIComponent(code), anonymous: true,
            onload: x => {
                try {
                    const doc = parseHTML(x.responseText);
                    let link = doc.querySelector("#video_title a")?.getAttribute("href") || doc.querySelector("div.video a[href*='?v=']")?.getAttribute("href");
                    if (!link) return fail && fail("JavLibrary 搜索无结果");
                    if (link.startsWith('/')) link = javlibBase.replace(/\/+$/, '') + link;
                    GM_xmlhttpRequest({
                        method: "GET", url: link, anonymous: true,
                        onload: xx => {
                            try {
                                const ddoc = parseHTML(xx.responseText);
                                let ttl = ddoc.querySelector("#video_title a")?.textContent.trim() || ddoc.querySelector("#video_title")?.textContent.trim() || '';
                                if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                                const dateText = ddoc.querySelector("#video_date td.text")?.textContent.trim() || '';
                                const isoDate = normDate(dateText);
                                const actresses = [];
                                ddoc.querySelectorAll("#video_cast td.text a").forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                                if (!ttl) return fail && fail("JavLibrary 无标题");
                                const info = { title: ttl, date: isoDate, actresses };
                                infoCache[code.toUpperCase()] = info;
                                ok && ok(info);
                            } catch (e) { fail && fail("JavLibrary 解析失败: " + e.message); }
                        }, onerror: () => fail && fail("JavLibrary 详情页请求失败")
                    });
                } catch (e) { fail && fail("JavLibrary 搜索解析失败: " + e.message); }
            }, onerror: () => fail && fail("JavLibrary 搜索请求失败")
        });
    };

    const fetchJavbus = (code, ok, fail) => {
        const tryUrl = u => {
            GM_xmlhttpRequest({
                method: "GET", url: u + code, anonymous: true,
                onload: x => {
                    try {
                        const doc = parseHTML(x.responseText);
                        let ttl = null;
                        const h3 = doc.querySelector("h3");
                        if (h3) { ttl = h3.textContent.trim(); if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim(); }
                        if (!ttl) ttl = doc.querySelector("div.photo-frame img")?.getAttribute("title") || '';
                        if (!ttl) {
                            ttl = doc.querySelector("title")?.textContent.trim() || '';
                            if (ttl.includes(" - JavBus")) ttl = ttl.split(" - JavBus")[0].trim();
                            if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                        }
                        let isoDate = '';
                        doc.querySelectorAll("p").forEach(p => { const t = p.textContent.trim(); if (/發行日期|发行日期/.test(t)) { const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m) isoDate = normDate(m[1]); } });
                        if (!isoDate) {
                            const p = doc.querySelector(".info p:nth-of-type(2)");
                            if (p) isoDate = normDate(p.textContent.replace(/.*?[:：]/, '').trim());
                        }
                        const actresses = [];
                        doc.querySelectorAll("span.genre a[href*='/star/']").forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                        if (!ttl) {
                            if (u !== javbusUncensoredBase) return tryUrl(javbusUncensoredBase);
                            return fail && fail("JavBus 无标题");
                        }
                        const info = { title: ttl, date: isoDate, actresses };
                        infoCache[code.toUpperCase()] = info;
                        ok && ok(info);
                    } catch (e) { fail && fail("JavBus 解析失败: " + e.message); }
                },
                onerror: () => {
                    if (u !== javbusUncensoredBase) return tryUrl(javbusUncensoredBase);
                    fail && fail("JavBus 请求失败");
                }
            });
        };
        tryUrl(javbusDirectAccess);
    };

    const fetchXslist = (code, ok, fail) => {
        const parsePage = (doc, cbOk, cbFail) => {
            const uc = code.toUpperCase();
            let tr = null;
            doc.querySelectorAll("#movices tbody tr").forEach(row => {
                const c = (row.querySelector("td strong")?.textContent || '').trim().toUpperCase();
                if (c === uc) { tr = row; }
            });
            if (!tr) return cbFail && cbFail("xslist 模型页未列出该番号");
            const tds = tr.querySelectorAll("td");
            const ttl = tds[1]?.textContent.trim() || '';
            const dt = tds[2]?.textContent.trim() || '';
            let isoDate = '';
            if (dt && !/n\/a/i.test(dt)) isoDate = normDate(dt);
            const aname = doc.querySelector("h1 span[itemprop='name']")?.textContent.trim() || '';
            const actresses = aname ? [aname] : [];
            if (!ttl) return cbFail && cbFail("xslist 无标题");
            const info = { title: ttl, date: isoDate, actresses };
            infoCache[code.toUpperCase()] = info;
            cbOk && cbOk(info);
        };
        GM_xmlhttpRequest({
            method: "GET", url: xslistBase + "search?query=" + encodeURIComponent(code), anonymous: true,
            onload: x => {
                try {
                    const sdoc = parseHTML(x.responseText);
                    if (sdoc.querySelector("#movices") && sdoc.querySelector("h1 span[itemprop='name']")) {
                        return parsePage(sdoc, ok, fail);
                    }
                    let link = sdoc.querySelector("a[href*='/model/']")?.getAttribute("href");
                    if (!link) return fail && fail("xslist 搜索无结果");
                    if (link.startsWith('/')) link = xslistBase.replace(/\/+$/, '') + link;
                    GM_xmlhttpRequest({
                        method: "GET", url: link, anonymous: true,
                        onload: dx => {
                            try { parsePage(parseHTML(dx.responseText), ok, fail); }
                            catch (e) { fail && fail("xslist 详情解析失败: " + e.message); }
                        },
                        onerror: () => fail && fail("xslist 详情页请求失败")
                    });
                } catch (e) { fail && fail("xslist 搜索解析失败: " + e.message); }
            }, onerror: () => fail && fail("xslist 搜索请求失败")
        });
    };

    const fetchJavdb = (code, ok, fail) => {
        GM_xmlhttpRequest({
            method: "GET", url: `${javdbSearchBase}${encodeURIComponent(code)}&f=all`, anonymous: true,
            onload: x => {
                try {
                    const hdoc = parseHTML(x.responseText);
                    let link = hdoc.querySelector('a[href*="/v/"]')?.getAttribute('href') || hdoc.querySelector('.movie-list .item a')?.getAttribute('href');
                    if (!link) return fail && fail("JavDB 搜索无结果");
                    if (link.startsWith('/')) link = javdbBase + link;
                    GM_xmlhttpRequest({
                        method: "GET", url: link, anonymous: true,
                        onload: dx => {
                            try {
                                const ddoc = parseHTML(dx.responseText);
                                let ttl = ddoc.querySelector('h2.title')?.textContent.trim() || ddoc.querySelector('strong.current-title')?.textContent.trim() || '';
                                if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                                let dateText = '';
                                ddoc.querySelectorAll('.panel-block').forEach(block => {
                                    const t = block.textContent.trim();
                                    if (/日期:|發行日期:|发行日期:/.test(t)) { dateText = t.replace(/.*?[:：]/, '').trim(); }
                                });
                                const isoDate = normDate(dateText);
                                const actresses = [];
                                ddoc.querySelectorAll('a[href*="/actors/"]').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                                if (!ttl) return fail && fail("JavDB 无标题");
                                const info = { title: ttl, date: isoDate, actresses };
                                infoCache[code.toUpperCase()] = info;
                                ok && ok(info);
                            } catch (e) { fail && fail("JavDB 详情解析失败: " + e.message); }
                        }, onerror: () => fail && fail("JavDB 详情页请求失败")
                    });
                } catch (e) { fail && fail("JavDB 搜索解析失败: " + e.message); }
            }, onerror: () => fail && fail("JavDB 搜索请求失败")
        });
    };

    const fetchFC2PPVDB = (code, ok, fail) => {
        const fc2Number = code.match(/\d+$/)[0];
        GM_xmlhttpRequest({
            method: "GET", url: fc2ppvdbBase + fc2Number, timeout: 10000, anonymous: true,
            onload: xhr => {
                try {
                    if (xhr.status !== 200) return fail("FC2PPVDB HTTP " + xhr.status);
                    const doc = parseHTML(xhr.responseText);
                    let title = null;
                    const link = doc.querySelector('a[href*="adult.contents.fc2.com"]');
                    if (link) title = link.textContent.trim();
                    if (!title) {
                        title = doc.querySelector("title")?.textContent.trim() || '';
                        if (title.includes(" - FC2PPVDB")) title = title.replace(" - FC2PPVDB", "").trim();
                    }
                    if (!title) return fail("FC2PPVDB 无标题");
                    const info = { title, date: '', actresses: [] };
                    infoCache[code.toUpperCase()] = info;
                    ok && ok(info);
                } catch (e) { fail("FC2PPVDB 解析失败: " + e.message); }
            },
            onerror: () => fail("FC2PPVDB 请求失败"),
            ontimeout: () => fail("FC2PPVDB 超时")
        });
    };

    const signMissavSearchPath = (path, successCallback, failCallback) => {
        const databaseId = "missav-default";
        const publicToken = "Ikkg568nlM51RHvldlPvc2GzZPE9R4XGzaH9Qj4zK9npbbbTly1gj9K4mgRn0QlV";
        const timestamp = Math.floor(Date.now() / 1000);
        const unsignedPath = `/${databaseId}${path}?frontend_timestamp=${timestamp}`;
        try {
            if (!globalThis.crypto || !globalThis.crypto.subtle || typeof TextEncoder === 'undefined') throw new Error("浏览器不支持Web Crypto");
            const encoder = new TextEncoder();
            globalThis.crypto.subtle.importKey("raw", encoder.encode(publicToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
                .then(key => globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(unsignedPath)))
                .then(signatureBuffer => {
                    const signature = Array.from(new Uint8Array(signatureBuffer)).map(value => value.toString(16).padStart(2, "0")).join("");
                    successCallback(unsignedPath + "&frontend_sign=" + signature);
                })
                .catch(error => failCallback(error));
        } catch (error) { failCallback(error); }
    };

    const fetchMissavFC2 = (code, ok, fail) => {
        const standardFC2 = code;
        const expectedId = standardFC2.toLowerCase();
        signMissavSearchPath("/search/users/anonymous/items/", signedPath => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://client-rapi-missav.recombee.com" + signedPath,
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                data: JSON.stringify({ searchQuery: standardFC2, count: 10, cascadeCreate: true, returnProperties: true }),
                timeout: 15000, anonymous: true,
                onload: xhr => {
                    try {
                        if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) return fail("MissAV HTTP " + xhr.status);
                        let data = JSON.parse(xhr.responseText);
                        let results = Array.isArray(data && data.recomms) ? data.recomms : [];
                        let exactResult = results.find(item => String(item && item.id || "").toLowerCase() === expectedId);
                        if (!exactResult || !exactResult.values) return fail("MissAV 无精确匹配");
                        let values = exactResult.values;
                        let originalTitle = String(values.title || "").trim();
                        if (!originalTitle) return fail("MissAV 无标题");
                        let actors = [].concat(
                            Array.isArray(values.actresses) ? values.actresses : [],
                            Array.isArray(values.actors) ? values.actors : []
                        );
                        let date = null;
                        let releasedAt = Number(values.released_at);
                        if (Number.isFinite(releasedAt) && releasedAt > 0) date = new Date(releasedAt * 1000).toISOString().slice(0, 10);
                        const info = { title: originalTitle, date, actresses: actors };
                        infoCache[code.toUpperCase()] = info;
                        ok && ok(info);
                    } catch (error) { fail("MissAV 解析失败: " + error.message); }
                },
                onerror: () => fail("MissAV 请求失败"),
                ontimeout: () => fail("MissAV 超时")
            });
        }, () => fail("MissAV 签名失败"));
    };

    const translateTitleToChinese = (title, enabled, fh, callback) => {
        let originalTitle = String(title || "").trim();
        if (!enabled || !originalTitle) { callback(originalTitle); return; }

        let finished = false;
        function complete(value) { if (finished) return; finished = true; callback(value); }
        function fallbackToOriginal(reason, error) { console.log("翻译失败，使用原标题: " + reason, error || ""); complete(originalTitle); }

        function tryMyMemory(deepLError) {
            console.log("DeepL失败，尝试MyMemory: ", deepLError || "");
            let translateUrl = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(originalTitle) + "&langpair=ja%7Czh-CN";
            GM_xmlhttpRequest({
                method: "GET", url: translateUrl, timeout: 15000, anonymous: true,
                onload: xhr => {
                    try {
                        if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) throw new Error("HTTP " + xhr.status);
                        if (/<!doctype|<html/i.test(xhr.responseText || "")) throw new Error("返回网页而非JSON");
                        let data = JSON.parse(xhr.responseText);
                        if (data && data.responseStatus != null && Number(data.responseStatus) !== 200) throw new Error(data.responseDetails || "状态 " + data.responseStatus);
                        let translated = data && data.responseData ? String(data.responseData.translatedText || "").trim() : "";
                        if (!translated || translated === originalTitle) throw new Error("翻译结果为空或未变化");
                        if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|DAILY LIMIT/i.test(translated)) throw new Error(translated);
                        console.log("MyMemory翻译: " + originalTitle + " -> " + translated);
                        complete(translated);
                    } catch (error) { fallbackToOriginal("MyMemory响应无效", error); }
                },
                onerror: error => fallbackToOriginal("MyMemory请求失败", error),
                ontimeout: () => fallbackToOriginal("MyMemory请求超时")
            });
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: "https://oneshot-free.www.deepl.com/v1/translate",
            headers: { "Authorization": "None", "Content-Type": "application/json" },
            data: JSON.stringify({ text: [originalTitle], source_lang: "ja", target_lang: "zh-Hans" }),
            timeout: 15000, anonymous: true,
            onload: xhr => {
                try {
                    if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) throw new Error("HTTP " + xhr.status);
                    let data = JSON.parse(xhr.responseText);
                    let translated = data && Array.isArray(data.translations) && data.translations[0] ? String(data.translations[0].text || "").trim() : "";
                    if (!translated || translated === originalTitle) throw new Error("翻译结果为空或未变化");
                    console.log("DeepL翻译: " + originalTitle + " -> " + translated);
                    complete(translated);
                } catch (error) { tryMyMemory(error); }
            },
            onerror: error => tryMyMemory(error),
            ontimeout: () => tryMyMemory(new Error("DeepL请求超时"))
        });
    };

    // ========== 统一远程信息获取（含演员补全） ==========
    const fetchRemoteInfo = (code, callback) => {
        const key = code.toUpperCase();
        if (infoCache[key]) { callback(infoCache[key]); return; }

        const enrichActors = (baseInfo, sources, done) => {
            if (!sources.length || (baseInfo.actresses && baseInfo.actresses.length > 0)) {
                done(baseInfo);
                return;
            }
            const source = sources.shift();
            source(code, fetched => {
                if (fetched.actresses && fetched.actresses.length > 0) {
                    baseInfo.actresses = fetched.actresses;
                    done(baseInfo);
                } else {
                    enrichActors(baseInfo, sources, done);
                }
            }, () => {
                enrichActors(baseInfo, sources, done);
            });
        };

        const fetchChain = () => {
            if (/^FC2-PPV-\d{5,7}$/i.test(code)) {
                fetchJavdb(code, info => {
                    infoCache[key] = info;
                    callback(info);
                }, () => {
                    fetchMissavFC2(code, info => {
                        infoCache[key] = info;
                        callback(info);
                    }, () => {
                        fetchFC2PPVDB(code, info => {
                            infoCache[key] = info;
                            callback(info);
                        }, () => {
                            callback(null);
                        });
                    });
                });
            } else {
                fetchJavdb(code, dbInfo => {
                    enrichActors(dbInfo, [fetchJavbus, fetchXslist], enriched => {
                        infoCache[key] = enriched;
                        callback(enriched);
                    });
                }, () => {
                    fetchJavbus(code, busInfo => {
                        enrichActors(busInfo, [fetchXslist], enriched => {
                            infoCache[key] = enriched;
                            callback(enriched);
                        });
                    }, () => {
                        fetchXslist(code, xsInfo => {
                            infoCache[key] = xsInfo;
                            callback(xsInfo);
                        }, () => {
                            callback(null);
                        });
                    });
                });
            }
        };
        fetchChain();
    };

    // ========== 改名主流程 ==========
    window.rename_multi = (fid, vInfo, suffix, addDate, callback, origFilename, translateChinese = false) => {
        const code = vInfo.queryCode;
        const key = code.toUpperCase();

        const applyInfo = (info) => {
            if (translateChinese) {
                translateTitleToChinese(info.title, true, code, translated => {
                    let finalTitle = info.title;
                    if (translated && translated !== info.title) finalTitle = `${info.title} ${translated}`;
                    const newName = buildNewName(vInfo, finalTitle, info.actresses, (addDate && info.date) ? info.date : (addDate ? vInfo.date : ""), suffix);
                    send_115(fid, newName, vInfo.fullCode, origFilename, callback);
                });
            } else {
                const newName = buildNewName(vInfo, info.title, info.actresses, (addDate && info.date) ? info.date : (addDate ? vInfo.date : ""), suffix);
                send_115(fid, newName, vInfo.fullCode, origFilename, callback);
            }
        };

        if (infoCache[key]) {
            applyInfo(infoCache[key]);
            return;
        }

        fetchRemoteInfo(code, (info) => {
            if (info) {
                infoCache[key] = info;
                applyInfo(info);
            } else {
                showPageNotification(`所有信息源未找到 ${code}`, 'error', 4000);
                if (typeof callback === 'function') callback();
            }
        });
    };

    const local_rename = (fid, vInfo, suffix, addDate, callback, origFilename) => {
        const newName = buildNewName(vInfo, vInfo.localTitle, [], vInfo.date, suffix);
        send_115(fid, newName, vInfo.fullCode, origFilename, callback);
    };

    // ========== 批量处理（修复：完成回调只执行一次） ==========
    const rename = (call, addDate, translateChinese = false) => {
        if (window.renameInProgress) {
            showPageNotification('已有任务正在进行中，请等待完成', 'info', 2000);
            return;
        }
        window.renameInProgress = true;

        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        const cnt = $items.length;
        if (!cnt) {
            showPageNotification("请先选择文件或文件夹", 'info', 3000);
            window.renameInProgress = false;
            return;
        }

        const parsedItems = [];
        $items.each(function () {
            const $it = $(this);
            const fn = $it.attr("title");
            const ft = $it.attr("file_type");
            const fid = ft === "0" ? $it.attr("cate_id") : $it.attr("file_id");
            if (!fid || !fn) return;
            const safeSuffix = getSafeSuffix(fn);
            const vi = parseVideoInfo(fn, safeSuffix);
            if (vi) parsedItems.push({ fid, fn, safeSuffix, vi });
        });

        if (!parsedItems.length) {
            showPageNotification("未识别到有效番号", 'info', 3000);
            window.renameInProgress = false;
            return;
        }

        const isLocal = (call === local_rename);
        let finishCalled = false;
        const finishRename = () => {
            if (finishCalled) return;
            finishCalled = true;
            progressBox.finish();
            showPageNotification(`所有文件处理完成`, 'success', 5000);
            persistCaches();
            offerCompareExport();
            window.renameInProgress = false;
        };

        if (isLocal) {
            progressBox.init('本地番号加工', parsedItems.length);
            renameCompareList = [];
            let processed = 0;
            const tasks = parsedItems.map(item => done => {
                local_rename(item.fid, item.vi, item.safeSuffix, addDate, () => {
                    processed++;
                    progressBox.update(processed);
                    done();
                }, item.fn);
            });
            runTasksWithLimit(tasks, 5, 200, finishRename);
        } else {
            const uniqueCodes = [...new Set(parsedItems.map(item => item.vi.queryCode.toUpperCase()))];
            const missingCodes = uniqueCodes.filter(code => !infoCache[code]);

            if (missingCodes.length) {
                progressBox.init('预取信息', missingCodes.length);
                let prefetchIndex = 0;
                const prefetchNext = () => {
                    if (prefetchIndex >= missingCodes.length) {
                        progressBox.finish();
                        startRenameTasks();
                        return;
                    }
                    const code = missingCodes[prefetchIndex++];
                    progressBox.update(prefetchIndex);
                    fetchRemoteInfo(code, (info) => {
                        if (info) infoCache[code.toUpperCase()] = info;
                        setTimeout(prefetchNext, 200);
                    });
                };
                const prefetchConcurrency = Math.min(3, missingCodes.length);
                for (let i = 0; i < prefetchConcurrency; i++) prefetchNext();
            } else {
                startRenameTasks();
            }
        }

        function startRenameTasks() {
            progressBox.init('联网改名', parsedItems.length);
            renameCompareList = [];
            let processed = 0;
            const tasks = parsedItems.map(item => done => {
                call(item.fid, item.vi, item.safeSuffix, addDate, () => {
                    processed++;
                    progressBox.update(processed);
                    done();
                }, item.fn, translateChinese);
            });
            runTasksWithLimit(tasks, 3, 200, finishRename);
        }

        function persistCaches() {
            GM_setValue('jb_infoCache', JSON.stringify(infoCache));
            GM_setValue('jb_actressCache', JSON.stringify(actressCache));
            GM_setValue('jb_ratingCache', JSON.stringify(ratingCache));
        }

        function offerCompareExport() {
            if (renameCompareList.length > 0) {
                if (confirm('改名已完成，是否导出对比？')) {
                    if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) {
                        exportCompareToFile(renameCompareList);
                    } else {
                        copyCompareToClipboard(renameCompareList);
                    }
                }
            }
        }
    };

    // ========== 备份与剪贴板 ==========
    function exportCompareToFile(list) {
        const text = list.map(item => `${item.original}\t${item.new}`).join('\n');
        const header = '【旧文件名】\t【新文件名】\n';
        downloadTxt('Rename_Compare.txt', header + text);
    }
    function copyCompareToClipboard(list) {
        const text = list.map(item => `${item.original}\t${item.new}`).join('\n');
        const header = '【旧文件名】\t【新文件名】\n';
        copyToClipboard(header + text);
    }

    function backupFileNames() {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        if ($items.length === 0) { showPageNotification("请先选中要备份的文件", 'info', 3000); return; }
        const names = [];
        $items.each(function () { const title = $(this).attr("title"); if (title) names.push(title); });
        if (names.length === 0) return;
        const text = names.join('\n');
        if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) {
            downloadTxt('115_File_Backup.txt', text);
        } else { copyToClipboard(text); }
    }

    function downloadTxt(filename, text) {
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showPageNotification('TXT 文件已下载', 'success', 3000);
    }
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showPageNotification('已复制到剪贴板', 'success', 3000))
                .catch(() => { GM_setClipboard(text); showPageNotification('已复制到剪贴板', 'success', 3000); });
        } else { GM_setClipboard(text); showPageNotification('已复制到剪贴板', 'success', 3000); }
    }

    // ========== 归档功能（优化：去重预取演员） ==========
    const getSeriesFromCode = code => {
        const c = (typeof code === 'object' ? code.queryCode : String(code)).toUpperCase();
        if (/^FC2-PPV/.test(c) || /^\d{6}_\d{3}$/.test(c) || /^1PONDO[-_]/.test(c) || /^CARIB[-_]/.test(c)) return null;
        const m = c.match(/^([A-Z]+)-\d+/);
        return m ? m[1] : null;
    };
    const findOrCreateFolderAndMove = (fid, folderName, successCallback, failCallback) => {
        const cid = archiveRootCid || ROOT_DIR_CID;
        const cleanName = folderName.replace(/[\\/:*?"<>|]/g, ' ');
        if (folderCidCache[cleanName]) { moveFileToFolder(fid, folderCidCache[cleanName], cleanName, successCallback, failCallback); return; }
        $.get("https://webapi.115.com/files/search", { search_value: cleanName, format: "json", aid: "1", cid: cid, file_type: "0", limit: 1000 }, data => {
            const result = typeof data === 'string' ? JSON.parse(data) : data;
            if (result.state && result.data && result.data.count > 0) {
                const found = result.data.list.find(item => item.name === cleanName && item.file_type === "0");
                if (found) { folderCidCache[cleanName] = found.cid; moveFileToFolder(fid, found.cid, cleanName, successCallback, failCallback); return; }
            }
            $.post("https://webapi.115.com/files/add", { pid: cid, cname: cleanName }, createData => {
                const createResult = typeof createData === 'string' ? JSON.parse(createData) : createData;
                if (createResult.state) { folderCidCache[cleanName] = createResult.cid; moveFileToFolder(fid, createResult.cid, cleanName, successCallback, failCallback); }
                else if (createResult.errno === 20004) {
                    $.get("https://webapi.115.com/files/search", { search_value: cleanName, format: "json", aid: "1", cid: cid, file_type: "0", limit: 1000 }, data2 => {
                        const res2 = JSON.parse(data2);
                        const found2 = res2.data && res2.data.list.find(item => item.name === cleanName && item.file_type === "0");
                        if (found2) { folderCidCache[cleanName] = found2.cid; moveFileToFolder(fid, found2.cid, cleanName, successCallback, failCallback); }
                        else { showPageNotification(`创建文件夹失败，且未找到同名文件夹`, 'error', 3000); if (typeof failCallback === 'function') failCallback('重名冲突'); }
                    });
                } else { showPageNotification(`创建文件夹失败: ${createResult.error || '未知错误'}`, 'error', 3000); if (typeof failCallback === 'function') failCallback(createResult.error); }
            }).fail(() => { showPageNotification('创建文件夹请求失败', 'error', 3000); if (typeof failCallback === 'function') failCallback('网络错误'); });
        }).fail(() => { showPageNotification('搜索文件夹请求失败', 'error', 3000); if (typeof failCallback === 'function') failCallback('网络错误'); });
    };
    const moveFileToFolder = (fid, targetCid, folderName, successCallback, failCallback) => {
        $.post("https://webapi.115.com/files/move", { pid: targetCid, fid: fid }, data => {
            const result = typeof data === 'string' ? JSON.parse(data) : data;
            if (result.state) { showPageNotification(`已归档到 ${folderName}`, 'success', 2000); if (typeof successCallback === 'function') successCallback(); }
            else {
                const errorMsg = result.error || '未知错误';
                if (errorMsg.includes('尚未完成') || errorMsg.includes('请稍后再试')) { showPageNotification(`归档到 ${folderName} 暂时失败，请稍后重试`, 'error', 5000); }
                else { showPageNotification(`归档到 ${folderName} 失败: ${errorMsg}`, 'error', 5000); }
                if (typeof failCallback === 'function') failCallback(errorMsg);
            }
        }).fail(err => { showPageNotification(`移动文件请求失败: ${err.statusText || '网络错误'}`, 'error', 5000); if (typeof failCallback === 'function') failCallback(err.statusText); });
    };

    const archiveToActorFolder = () => {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        const cnt = $items.length;
        if (!cnt) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }
        if (!archiveRootCid) { showPageNotification("请先设置归档根目录（右键文件夹 → 设为归档根目录）", 'error', 5000); return; }

        const parsedItems = [];
        $items.each(function () {
            const $it = $(this);
            const fn = $it.attr("title");
            const ft = $it.attr("file_type");
            const fid = ft === "0" ? $it.attr("cate_id") : $it.attr("file_id");
            if (!fid || !fn) return;
            const safeSuffix = getSafeSuffix(fn);
            const vi = parseVideoInfo(fn, safeSuffix);
            if (vi) parsedItems.push({ fid, fn, vi });
        });
        if (!parsedItems.length) { showPageNotification("未识别到有效番号", 'info', 3000); return; }

        const uniqueCodes = [...new Set(parsedItems.map(item => item.vi.queryCode.toUpperCase()))];
        const missingCodes = uniqueCodes.filter(code => {
            if (actressCache[code] && actressCache[code].length) return false;
            if (infoCache[code] && infoCache[code].actresses && infoCache[code].actresses.length) {
                actressCache[code] = infoCache[code].actresses;
                return false;
            }
            return true;
        });

        const startArchive = () => {
            progressBox.init('归档', parsedItems.length);
            let processed = 0, success = 0;
            const tasks = parsedItems.map(item => done => {
                const code = item.vi.queryCode;
                if (/^FC2-PPV-\d{5,7}$/i.test(code)) {
                    findOrCreateFolderAndMove(item.fid, "FC2", () => {
                        processed++; success++; progressBox.update(processed); done();
                    }, () => { processed++; progressBox.update(processed); done(); });
                } else {
                    const folderName = actressCache[code.toUpperCase()]?.[0] || getSeriesFromCode(code) || '其他';
                    findOrCreateFolderAndMove(item.fid, folderName, () => {
                        processed++; success++; progressBox.update(processed); done();
                    }, () => { processed++; progressBox.update(processed); done(); });
                }
            });
            runTasksWithLimit(tasks, 3, 500, () => {
                progressBox.finish();
                showPageNotification(`归档完成：成功 ${success}/${parsedItems.length}`, 'success', 5000);
                persistArchiveCaches();
            });
        };

        const persistArchiveCaches = () => {
            GM_setValue('jb_actressCache', JSON.stringify(actressCache));
            GM_setValue('jb_infoCache', JSON.stringify(infoCache));
        };

        if (missingCodes.length) {
            progressBox.init('预取演员信息', missingCodes.length);
            let prefetchIndex = 0;
            const prefetchNext = () => {
                if (prefetchIndex >= missingCodes.length) {
                    progressBox.finish();
                    startArchive();
                    return;
                }
                const code = missingCodes[prefetchIndex++];
                progressBox.update(prefetchIndex);
                fetchRemoteInfo(code, (info) => {
                    if (info) {
                        infoCache[code.toUpperCase()] = info;
                        if (info.actresses && info.actresses.length) actressCache[code.toUpperCase()] = info.actresses;
                    }
                    setTimeout(prefetchNext, 500);
                });
            };
            const prefetchConcurrency = Math.min(2, missingCodes.length);
            for (let i = 0; i < prefetchConcurrency; i++) prefetchNext();
        } else {
            startArchive();
        }
    };

    // ========== JavDB 评分（优化：去重缓存） ==========
    const getJavdbRating = () => {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        const cnt = $items.length;
        if (!cnt) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }

        const parsedItems = [];
        $items.each(function () {
            const $it = $(this);
            const fn = $it.attr("title");
            const ft = $it.attr("file_type");
            const fid = ft === "0" ? $it.attr("cate_id") : $it.attr("file_id");
            if (!fid || !fn) return;
            const safeSuffix = getSafeSuffix(fn);
            const vi = parseVideoInfo(fn, safeSuffix);
            if (vi && vi.queryCode) parsedItems.push({ fid, fn, vi });
        });
        if (!parsedItems.length) { showPageNotification("未识别到有效番号", 'info', 3000); return; }

        const uniqueCodes = [...new Set(parsedItems.map(item => item.vi.queryCode.toUpperCase()))];
        const missingCodes = uniqueCodes.filter(code => !ratingCache[code]);

        const startUpdate = () => {
            progressBox.init('更新评分', parsedItems.length);
            let processed = 0, success = 0;
            const tasks = parsedItems.map(item => done => {
                const code = item.vi.queryCode.toUpperCase();
                const star = ratingCache[code];
                if (star) {
                    update115Rating(item.fid, star, item.vi.queryCode, item.fn, ok => {
                        processed++;
                        if (ok) success++;
                        progressBox.update(processed);
                        done();
                    });
                } else {
                    processed++;
                    progressBox.update(processed);
                    done();
                }
            });
            runTasksWithLimit(tasks, 2, 300, () => {
                progressBox.finish();
                showPageNotification(`评分更新完成：成功 ${success}/${parsedItems.length}`, 'success', 5000);
                GM_setValue('jb_ratingCache', JSON.stringify(ratingCache));
            });
        };

        if (missingCodes.length) {
            progressBox.init('获取评分', missingCodes.length);
            let prefetchIndex = 0;
            const prefetchNext = () => {
                if (prefetchIndex >= missingCodes.length) {
                    progressBox.finish();
                    startUpdate();
                    return;
                }
                const code = missingCodes[prefetchIndex++];
                progressBox.update(prefetchIndex);
                fetchRatingForCode(code, (star) => {
                    if (star) ratingCache[code] = star;
                    setTimeout(prefetchNext, 300);
                });
            };
            const prefetchConcurrency = Math.min(2, missingCodes.length);
            for (let i = 0; i < prefetchConcurrency; i++) prefetchNext();
        } else {
            startUpdate();
        }
    };

    const fetchRatingForCode = (code, callback) => {
        GM_xmlhttpRequest({
            method: "GET", url: `${javdbSearchBase}${encodeURIComponent(code)}&f=all`, timeout: 10000, anonymous: true,
            onload: xhr => {
                if (xhr.status !== 200) { callback(null); return; }
                try {
                    const doc = parseHTML(xhr.responseText);
                    const item = doc.querySelector('.movie-list .item');
                    if (item) {
                        let rating = parseFloat(item.getAttribute('score'));
                        if (isNaN(rating)) {
                            const rel = item.querySelector('.score .value');
                            if (rel) {
                                const m = rel.textContent.trim().match(/(\d+\.\d+)分/);
                                if (m) rating = parseFloat(m[1]);
                            }
                        }
                        if (!isNaN(rating)) { callback(Math.round(rating)); return; }
                        const link = item.querySelector('a.box');
                        if (link) {
                            const href = link.getAttribute('href');
                            if (href) {
                                const detailUrl = javdbBase + (href.startsWith('/') ? href : '/' + href);
                                GM_xmlhttpRequest({
                                    method: "GET", url: detailUrl, timeout: 10000, anonymous: true,
                                    onload: dx => {
                                        try {
                                            const dd = parseHTML(dx.responseText);
                                            const rEl = dd.querySelector('.panel-block .value');
                                            if (rEl) {
                                                const rating = parseFloat(rEl.textContent.trim().match(/(\d+\.\d+)/)?.[1]);
                                                if (!isNaN(rating)) { callback(Math.round(rating)); return; }
                                            }
                                            callback(null);
                                        } catch (e) { callback(null); }
                                    },
                                    onerror: () => callback(null),
                                    ontimeout: () => callback(null)
                                });
                                return;
                            }
                        }
                    }
                    callback(null);
                } catch (e) { callback(null); }
            },
            onerror: () => callback(null),
            ontimeout: () => callback(null)
        });
    };

    const update115Rating = (fid, star, fh, fname, callback) => {
        star = Math.max(1, Math.min(5, star));
        const finish = (ok) => { showPageNotification(`"${fh}"评分${ok ? `更新为 ${star} 星` : '更新失败'}`, ok ? 'success' : 'error', 2000); callback(ok); };
        $.ajax({
            url: "https://webapi.115.com/files/score", type: "POST", data: { file_id: fid, score: star }, dataType: "json",
            success: r => { if (r && r.state) finish(true); else backupScore(); },
            error: backupScore
        });
        function backupScore() {
            $.ajax({
                url: "https://webapi.115.com/files/edit_property", type: "POST", data: { file_id: fid, property: "score", value: star }, dataType: "json",
                success: r => finish(r && r.state),
                error: () => finish(false)
            });
        }
    };

    // ========== 菜单绑定 ==========
    function buttonInterval() {
        const $menu = $("div#js_float_content");
        if ($menu.length === 0) return;
        const openDir = $menu.find("li[val='open_dir'], li[data-val='open_dir'], li[menu='open_dir']");
        if (openDir.length !== 0 && $("li#rename_list").length === 0) {
            openDir.before(rename_list);
            $("a#local_code_process").off("click").on("click", () => rename(local_rename, false));
            $("a#rename_all_multi_date").off("click").on("click", () => rename(rename_multi, true, false));
            $("a#rename_all_multi_zh").off("click").on("click", () => rename(rename_multi, true, true));
            $("a#archive_to_folder").off("click").on("click", archiveToActorFolder);
            $("a#set_archive_root").off("click").on("click", setArchiveRoot);
            $("a#get_javdb_rating").off("click").on("click", getJavdbRating);
            $("a#backup_file_names").off("click").on("click", backupFileNames);
            clearInterval(interval);
        }
    }

    function setArchiveRoot() {
        const sf = $("iframe[rel='wangpan']").contents().find("li.selected");
        if (sf.length !== 1) { showPageNotification("请只选择一个文件夹", 'error', 3000); return; }
        const $it = $(sf[0]);
        if ($it.attr("file_type") !== "0") { showPageNotification("请选择文件夹类型", 'error', 3000); return; }
        const cid = $it.attr("cate_id"), name = $it.attr("title");
        if (cid) {
            GM_setValue("archiveRootCid", cid); GM_setValue("archiveRootName", name);
            archiveRootCid = cid; archiveRootName = name;
            cleanupExistingRootInfo(); showArchiveRootInfo();
            showPageNotification(`归档根目录设置成功: "${name}"`, 'success', 5000);
        }
    }
})();