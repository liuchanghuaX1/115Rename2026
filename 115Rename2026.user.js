// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         1.8.18
// @description     115视频整理：FC2分段识别｜空格修复｜导出优化｜多站改名+归档+评分
// @author          sonarlee
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @domain          javbus.com
// @domain          avmoo.host
// @domain          avsox.host
// @domain          javdb.com
// @connect         javbus.com
// @connect         javlibrary.com
// @connect         xslist.org
// @connect         javdb.com
// @connect         webapi.115.com
// @grant           GM_notification
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_download
// @grant           GM_setClipboard
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
    const infoCache = {}, actressCache = {}, folderCidCache = {};

    // ========== 并发与进度 ==========
    function runTasksWithLimit(tasks, limit, doneAll) {
        if (!tasks.length) { doneAll && doneAll(); return; }
        let index = 0, running = 0;
        const next = () => {
            if (index >= tasks.length && running === 0) { doneAll && doneAll(); return; }
            while (running < limit && index < tasks.length) {
                const task = tasks[index++]; running++;
                task(() => { running--; next(); });
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

    // ========== 域名清理 ==========
    const stripDomainPrefix = (filename) => {
        // 按 @ 分割，取最后一段，自动丢弃所有广告前缀（例如 JAVman@www.sexinsex.net@真实文件名）
        const parts = filename.split('@');
        let cleaned = parts[parts.length - 1].trim();
        // 如果分割后为空（罕见），回退到原文件名
        if (!cleaned) cleaned = filename;
        // 最后移除开头的多余符号（如残留的 @ 或空格）
        cleaned = cleaned.replace(/^[@\s]+/, '');
        return cleaned;
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
        'DSAM', 'RED', 'BT', 'MX', 'SI', 'VOL', 'CR', 'N'
    ].sort((a, b) => b.length - a.length);

    const matchCodeByPrefix = str => {
        if (!str) return null;
        for (const p of CODE_PREFIXES) {
            const m = str.match(new RegExp(`\\b${p}[-_ ]?0*(\\d{1,5})\\b`, 'i'));
            if (m) return `${p}-${(m[1] === '0' ? '0' : m[1]).padStart(3, '0')}`;
        }
        for (const p of CODE_PREFIXES) {
            const m = str.match(new RegExp(`\\b${p}[-_ ]?0*(\\d{1,5})(?![0-9])`, 'i'));
            if (m) return `${p}-${(m[1] === '0' ? '0' : m[1]).padStart(3, '0')}`;
        }
        const loose = str.match(/\b([A-Z]{2,8})\s*0*(\d{2,5})\b/);
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

    // 增强的 FC2 番号提取
    const extractFC2Code = (str) => {
        const patterns = [
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
            if (m && m[1] && !/^(?:HD|HD|SD|X264|X265|H264|H265|HEVC|AVC|AAC|AC3|DTS|FLAC|MP3|MP4|MKV|AVI|WMV|M4V|RMVB|ISO|TS|WATERMARK|RARBG|WEB-DL|WEBRIP|BLURAY|BDREMUX|1440P|1080P|720P|480P)$/i.test(m[1])) {
                return 'FC2-PPV-' + m[1];
            }
        }
        return null;
    };

    // ========== 核心解析 ==========
    const parseVideoInfo = origTitle => {
        try {
            if (!origTitle) return null;
            let raw = String(origTitle);
            let rawNoExt = raw.replace(/\.\w{2,5}$/, '');
            rawNoExt = stripDomainPrefix(rawNoExt);

            let markers = [];
            rawNoExt.replace(MARKER_PATTERN, (match, p1, offset, full) => {
                const lower = match.toLowerCase();
                if (offset > 0 && /[a-z0-9]/i.test(full[offset - 1])) return match;
                if (offset + match.length < full.length && /[a-z0-9]/i.test(full[offset + match.length])) return match;
                const nm = MARKER_MAP[lower];
                if (nm && !markers.includes(nm)) markers.push(nm);
                return match;
            });

            let dateStr = '';
            const dm = rawNoExt.match(/(?:\b|_|^|@|】|\[|【)((?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2})(?:\b|_|$|(?=[A-Za-z\u4e00-\u9fa5【\[\]】]))/i);
            if (dm) {
                const parts = dm[1].trim().split(/[-_\/\.\s]+/);
                if (parts.length === 3) {
                    const year = parts[0].length === 2 ? '20' + parts[0] : parts[0];
                    dateStr = `${year}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                }
                rawNoExt = rawNoExt.replace(dm[0], ' ');
            }

            let t = removeMarkers(rawNoExt).toUpperCase();
            t = t.replace(/(?:\b|_|^|@|】|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
            t = t.replace(GARBAGE_REGEX, ' ').replace(/[\[\]\{\}（）【】]/g, ' ').replace(/[_\.\-\/\\]+/g, ' ');
            t = t.replace(/\b[01]+(?=[A-Z])/g, '').replace(/\b([A-Z])\s(?=[A-Z]\b)/g, '$1');

            let queryCode = null, displayCode = null;

            // FC2 优先
            const fc2Code = extractFC2Code(rawNoExt);
            if (fc2Code) {
                queryCode = fc2Code;
                displayCode = fc2Code;
            } else {
                const thMatch = rawNoExt.match(/Tokyo[\s_-]*Hot[\s_-]*[nN](\d{3,4})/i);
                if (thMatch) {
                    queryCode = `Tokyo-Hot-n${thMatch[1].padStart(4, '0')}`;
                    displayCode = queryCode;
                } else {
                    const numM = t.match(/\b(\d{4,6})[-_ ](\d{3,4})\b/);
                    if (numM) {
                        queryCode = `${numM[1]}_${numM[2]}`;
                        const lowerRaw = rawNoExt.toLowerCase();
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

            // ========== 分段提取（最终增强版，覆盖 .1 / part1 / vol1 / no1 等） ==========
            let part = '';
            const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // 统一的分段匹配模式（捕获组 2 或 3 会拿到数字或字母）
            const segmentPattern = new RegExp(
                // 模式1: 番号后紧跟 .数字/字母 （如 FC2-123.1）
                `${escapedBase}\\.(\\d{1,3}|[a-dA-D])(?=\\s|$|\\.\\w+$|[^\\d])` +
                // 模式2: 番号后紧跟 _数字/字母 或 -数字/字母 （如 _3, -2）
                `|${escapedBase}[_\\-](\\d{1,3}|[a-dA-D])(?=\\s|$|\\.\\w+$|[^\\d])` +
                // 模式3: 关键词 (part|pt|cd|ep|sp|disc|vol|no|volume) 后接数字/字母
                `|${escapedBase}\\s+` +
                `(?:part|pt|cd|ep|sp|disc|vol|no|volume)\\s*[.\\-\\s]*(\\d{1,3}|[a-dA-D])` +
                // 模式4: 番号后跟空格+数字/字母 （如 FC2-123 1）
                `|${escapedBase}\\s+(\\d{1,3}|[a-dA-D])(?=\\s|$|\\.\\w+$|[^\\d])`,
                'i'
            );

            const segMatch = rawNoExt.match(segmentPattern);
            if (segMatch) {
                // 收集所有捕获组，第一个非空的即为分段内容
                for (let i = 1; i < segMatch.length; i++) {
                    if (segMatch[i]) {
                        part = segMatch[i].toUpperCase();
                        break;
                    }
                }
                // 从原始名称中移除匹配到的分段部分
                rawNoExt = rawNoExt.replace(segMatch[0], ' ').trim();
            }

            const fullCode = part ? `${baseCode}-${part}` : baseCode;

            // 本地标题清洗
            let cleanTitle = removeMarkers(rawNoExt);
            cleanTitle = cleanTitle.replace(/(?:\b|_|^|@|】|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
            cleanTitle = cleanTitle.replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ');
            cleanTitle = cleanTitle.replace(AD_BADGES, ' ');
            cleanTitle = cleanTitle.replace(GARBAGE_REGEX, ' ');
            cleanTitle = cleanTitle.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
            cleanTitle = removeCodeFromText(cleanTitle, baseCode);

            return { queryCode, baseCode, fullCode, markers, date: dateStr, localTitle: cleanTitle };
        } catch (e) {
            console.error('parseVideoInfo error:', e);
            return null;
        }
    };

    const removeCodeFromText = (text, baseCode) => {
        if (!baseCode) return text;
        const stdMatch = baseCode.match(/^([A-Za-z]+)[-_\s]?(\d+)$/);
        if (stdMatch) {
            const prefix = stdMatch[1];
            const num = stdMatch[2];
            const rawNum = parseInt(num, 10).toString();
            text = text.replace(new RegExp(`\\b${prefix}[-_\\s.]*0*${rawNum}\\b`, 'gi'), ' ');
        }
        if (/^FC2[-_\s]?PPV[-_\s]?\d+$/i.test(baseCode)) {
            const num = baseCode.match(/\d+$/)[0];
            const rawNum = parseInt(num, 10).toString();
            const fc2Regex = new RegExp(`\\b(?:FC2[-_\\s.]?(?:PPV[-_\\s.]?)?0*${rawNum}|PPV[-_\\s.]?0*${rawNum})\\b`, 'gi');
            text = text.replace(fc2Regex, ' ');
        }
        return text.replace(/\s+/g, ' ').trim();
    };

    // ========== 构建新名称（修复空格） ==========
    const buildNewName = (vInfo, title, actresses, dateStr, suffix) => {
        let cleanTitle = removeCodeFromText(title, vInfo.baseCode);
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
            if (toAdd.length) name += ' ' + toAdd.map(m => `【${m}】`).join('');
        }

        if (dateStr) name += '_' + dateStr;
        if (suffix) name += suffix;

        // 去除多余空格，特别是扩展名前的
        name = name.replace(/\s+/g, ' ').trim();
        name = name.replace(/\s+\./g, '.');
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

    // ========== 多站刮削（完整） ==========
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
            method: "GET", url: javlibSearchBase + encodeURIComponent(code),
            onload: x => {
                try {
                    const $s = $(x.responseText);
                    let link = $s.find("#video_title a").attr("href") || $s.find("div.video a[href*='?v=']").first().attr("href");
                    if (!link) return fail && fail("JavLibrary 搜索无结果");
                    if (link.startsWith('/')) link = javlibBase.replace(/\/+$/, '') + link;
                    GM_xmlhttpRequest({
                        method: "GET", url: link,
                        onload: xx => {
                            try {
                                const $d = $(xx.responseText);
                                let ttl = $d.find("#video_title a").first().text().trim() || $d.find("#video_title").text().trim();
                                if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                                const dateText = $d.find("#video_date td.text").text().trim();
                                const isoDate = normDate(dateText);
                                const actresses = [];
                                $d.find("#video_cast td.text a").each(function () { const n = $(this).text().trim(); if (n) actresses.push(n); });
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
                method: "GET", url: u + code,
                onload: x => {
                    try {
                        const $r = $(x.responseText);
                        let ttl = null;
                        const h3 = $r.find("h3");
                        if (h3.length) { ttl = h3.text().trim(); if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim(); }
                        if (!ttl) ttl = $r.find("div.photo-frame img").attr("title");
                        if (!ttl) {
                            ttl = $r.find("title").text().trim();
                            if (ttl.includes(" - JavBus")) ttl = ttl.split(" - JavBus")[0].trim();
                            if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                        }
                        let isoDate = '';
                        $r.find("p").each(function () { const t = $(this).text().trim(); if (/發行日期|发行日期/.test(t)) { const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m) isoDate = normDate(m[1]); } });
                        if (!isoDate) {
                            const p = $r.find(".info p:contains('發行日期'), .info p:contains('发行日期')");
                            if (p.length) isoDate = normDate(p.text().replace(/.*?[:：]/, '').trim());
                        }
                        const actresses = [];
                        $r.find("span.genre a[href*='/star/']").each(function () { const n = $(this).text().trim(); if (n) actresses.push(n); });
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
        const parsePage = ($pg, cbOk, cbFail) => {
            const uc = code.toUpperCase();
            let tr = null;
            $pg.find("#movices tbody tr").each(function () {
                const c = ($(this).find("td").eq(0).find("strong").text() || '').trim().toUpperCase();
                if (c === uc) { tr = $(this); return false; }
            });
            if (!tr) return cbFail && cbFail("xslist 模型页未列出该番号");
            const $tds = tr.find("td");
            const ttl = $tds.eq(1).text().trim();
            const dt = $tds.eq(2).text().trim();
            let isoDate = '';
            if (dt && !/n\/a/i.test(dt)) isoDate = normDate(dt);
            const aname = $pg.find("h1 span[itemprop='name']").first().text().trim();
            const actresses = aname ? [aname] : [];
            if (!ttl) return cbFail && cbFail("xslist 无标题");
            const info = { title: ttl, date: isoDate, actresses };
            infoCache[code.toUpperCase()] = info;
            cbOk && cbOk(info);
        };
        GM_xmlhttpRequest({
            method: "GET", url: xslistBase + "search?query=" + encodeURIComponent(code),
            onload: x => {
                try {
                    const $s = $(x.responseText);
                    if ($s.find("#movices").length && $s.find("h1 span[itemprop='name']").length) {
                        return parsePage($s, ok, fail);
                    }
                    let link = $s.find("a[href*='/model/']").first().attr("href");
                    if (!link) return fail && fail("xslist 搜索无结果");
                    if (link.startsWith('/')) link = xslistBase.replace(/\/+$/, '') + link;
                    GM_xmlhttpRequest({
                        method: "GET", url: link,
                        onload: dx => { try { parsePage($(dx.responseText), ok, fail); } catch (e) { fail && fail("xslist 详情解析失败: " + e.message); } },
                        onerror: () => fail && fail("xslist 详情页请求失败")
                    });
                } catch (e) { fail && fail("xslist 搜索解析失败: " + e.message); }
            }, onerror: () => fail && fail("xslist 搜索请求失败")
        });
    };

    const fetchJavdb = (code, ok, fail) => {
        GM_xmlhttpRequest({
            method: "GET", url: `${javdbSearchBase}${encodeURIComponent(code)}&f=all`,
            onload: x => {
                try {
                    const $h = $(x.responseText);
                    let link = $h.find('a[href*="/v/"]').first().attr('href') || $h.find('.movie-list .item a').first().attr('href');
                    if (!link) return fail && fail("JavDB 搜索无结果");
                    if (link.startsWith('/')) link = javdbBase + link;
                    GM_xmlhttpRequest({
                        method: "GET", url: link,
                        onload: dx => {
                            try {
                                const $d = $(dx.responseText);
                                let ttl = $d.find('h2.title').text().trim() || $d.find('strong.current-title').text().trim();
                                if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                                let dateText = '';
                                $d.find('.panel-block').each(function () {
                                    const t = $(this).text().trim();
                                    if (/日期:|發行日期:|发行日期:/.test(t)) { dateText = t.replace(/.*?[:：]/, '').trim(); return false; }
                                });
                                const isoDate = normDate(dateText);
                                const actresses = [];
                                $d.find('a[href*="/actors/"]').each(function () { const n = $(this).text().trim(); if (n) actresses.push(n); });
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

    // ========== 改名主流程 ==========
    window.rename_multi = (fid, vInfo, suffix, addDate, callback, origFilename) => {
        const code = vInfo.queryCode;
        if (/^FC2-PPV-\d{5,7}$/i.test(code)) {
            showPageNotification('FC2 番号不支持在线信息，使用本地改名', 'info', 2500);
            local_rename(fid, vInfo, suffix, addDate, callback, origFilename);
            return;
        }
        const key = code.toUpperCase();
        if (infoCache[key]) {
            const info = infoCache[key];
            const newName = buildNewName(vInfo, info.title || vInfo.localTitle, info.actresses, (addDate && info.date) ? info.date : (addDate ? vInfo.date : ""), suffix);
            send_115(fid, newName, vInfo.fullCode, origFilename, callback);
            return;
        }
        const apply = info => {
            const newName = buildNewName(vInfo, info.title || vInfo.localTitle, info.actresses, (addDate && info.date) ? info.date : (addDate ? vInfo.date : ""), suffix);
            send_115(fid, newName, vInfo.fullCode, origFilename, callback);
        };
        fetchJavlib(code, apply, () => {
            fetchJavbus(code, apply, () => {
                fetchXslist(code, apply, () => {
                    fetchJavdb(code, apply, () => {
                        showPageNotification(`所有信息源未找到 ${code}`, 'error', 4000);
                        if (typeof callback === 'function') callback();
                    });
                });
            });
        });
    };

    const local_rename = (fid, vInfo, suffix, addDate, callback, origFilename) => {
        const newName = buildNewName(vInfo, vInfo.localTitle, [], vInfo.date, suffix);
        send_115(fid, newName, vInfo.fullCode, origFilename, callback);
    };

    // ========== 批量处理（优化导出询问） ==========
    const rename = (call, addDate) => {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        const cnt = $items.length;
        if (!cnt) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }
        const isLocal = (call === local_rename);
        progressBox.init(isLocal ? '本地番号加工' : '联网改名', cnt);
        showPageNotification(`开始处理 ${cnt} 个文件...`, 'info', 3000);

        renameCompareList = [];
        const tasks = [];
        $items.each(function () {
            const $it = $(this);
            const fn = $it.attr("title");
            const ft = $it.attr("file_type");
            let fid, suffix = '';
            if (ft === "0") fid = $it.attr("cate_id");
            else { fid = $it.attr("file_id"); const idx = fn.lastIndexOf('.'); if (idx !== -1) suffix = fn.substring(idx); }
            if (!fid || !fn) return;
            const vi = parseVideoInfo(fn);
            if (!vi) return;
            tasks.push((done) => { call(fid, vi, suffix, addDate, done, fn); });
        });

        const concurrency = isLocal ? 5 : 3;
        let processed = 0;
        const wrapped = tasks.map(t => done => t(() => { processed++; progressBox.update(processed); done(); }));
        runTasksWithLimit(wrapped, concurrency, () => {
            progressBox.finish();
            showPageNotification(`所有文件处理完成`, 'success', 5000);
            if (renameCompareList.length > 0) {
                if (confirm('改名已完成，是否导出对比？')) {
                    if (confirm('导出为 TXT 文件？\n（确定 = TXT 文件，取消 = 复制到剪贴板）')) {
                        exportCompareToFile(renameCompareList);
                    } else {
                        copyCompareToClipboard(renameCompareList);
                    }
                }
            }
        });
    };

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

    // ========== 备份文件名（直接选择方式） ==========
    function backupFileNames() {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        if ($items.length === 0) {
            showPageNotification("请先选中要备份的文件", 'info', 3000);
            return;
        }
        const names = [];
        $items.each(function () { const title = $(this).attr("title"); if (title) names.push(title); });
        if (names.length === 0) return;
        const text = names.join('\n');
        if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) {
            downloadTxt('115_File_Backup.txt', text);
        } else {
            copyToClipboard(text);
        }
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

    // ========== 归档功能 ==========
    const getSeriesFromCode = code => {
        const c = (typeof code === 'object' ? code.queryCode : String(code)).toUpperCase();
        if (/^FC2-PPV/.test(c) || /^\d{6}_\d{3}$/.test(c) || /^1PONDO[-_]/.test(c) || /^CARIB[-_]/.test(c)) return null;
        const m = c.match(/^([A-Z]+)-\d+/);
        return m ? m[1] : null;
    };

    const findOrCreateFolderAndMove = (fid, folderName, successCallback, failCallback) => {
        const cid = archiveRootCid || ROOT_DIR_CID;
        const cleanName = folderName.replace(/[\\/:*?"<>|]/g, ' ');
        if (folderCidCache[cleanName]) {
            moveFileToFolder(fid, folderCidCache[cleanName], cleanName, successCallback, failCallback);
            return;
        }
        $.get("https://webapi.115.com/files/search", {
            search_value: cleanName, format: "json", aid: "1", cid: cid, file_type: "0", limit: 1000
        }, data => {
            const result = typeof data === 'string' ? JSON.parse(data) : data;
            if (result.state && result.data && result.data.count > 0) {
                const found = result.data.list.find(item => item.name === cleanName && item.file_type === "0");
                if (found) {
                    folderCidCache[cleanName] = found.cid;
                    moveFileToFolder(fid, found.cid, cleanName, successCallback, failCallback);
                    return;
                }
            }
            $.post("https://webapi.115.com/files/add", { pid: cid, cname: cleanName }, createData => {
                const createResult = typeof createData === 'string' ? JSON.parse(createData) : createData;
                if (createResult.state) {
                    folderCidCache[cleanName] = createResult.cid;
                    moveFileToFolder(fid, createResult.cid, cleanName, successCallback, failCallback);
                } else {
                    if (createResult.errno === 20004) {
                        $.get("https://webapi.115.com/files/search", { search_value: cleanName, format: "json", aid: "1", cid: cid, file_type: "0", limit: 1000 }, data2 => {
                            const res2 = JSON.parse(data2);
                            const found2 = res2.data && res2.data.list.find(item => item.name === cleanName && item.file_type === "0");
                            if (found2) {
                                folderCidCache[cleanName] = found2.cid;
                                moveFileToFolder(fid, found2.cid, cleanName, successCallback, failCallback);
                            } else {
                                showPageNotification(`创建文件夹失败，且未找到同名文件夹`, 'error', 3000);
                                if (typeof failCallback === 'function') failCallback('重名冲突');
                            }
                        });
                    } else {
                        showPageNotification(`创建文件夹失败: ${createResult.error || '未知错误'}`, 'error', 3000);
                        if (typeof failCallback === 'function') failCallback(createResult.error);
                    }
                }
            }).fail(() => {
                showPageNotification('创建文件夹请求失败', 'error', 3000);
                if (typeof failCallback === 'function') failCallback('网络错误');
            });
        }).fail(() => {
            showPageNotification('搜索文件夹请求失败', 'error', 3000);
            if (typeof failCallback === 'function') failCallback('网络错误');
        });
    };

    const moveFileToFolder = (fid, targetCid, folderName, successCallback, failCallback) => {
        $.post("https://webapi.115.com/files/move", { pid: targetCid, fid: fid }, data => {
            const result = typeof data === 'string' ? JSON.parse(data) : data;
            if (result.state) {
                showPageNotification(`已归档到 ${folderName}`, 'success', 2000);
                if (typeof successCallback === 'function') successCallback();
            } else {
                const errorMsg = result.error || '未知错误';
                if (errorMsg.includes('尚未完成') || errorMsg.includes('请稍后再试')) {
                    showPageNotification(`归档到 ${folderName} 暂时失败，请稍后重试`, 'error', 5000);
                } else {
                    showPageNotification(`归档到 ${folderName} 失败: ${errorMsg}`, 'error', 5000);
                }
                if (typeof failCallback === 'function') failCallback(errorMsg);
            }
        }).fail(err => {
            showPageNotification(`移动文件请求失败: ${err.statusText || '网络错误'}`, 'error', 5000);
            if (typeof failCallback === 'function') failCallback(err.statusText);
        });
    };

    const requestActressForArchive = (fid, code, seriesName, archiveMode, doneCallback) => {
        const key = code.toUpperCase();
        if (actressCache[key] && actressCache[key].length) {
            const folderName = (archiveMode === "2" && seriesName) ? `${actressCache[key][0]} - ${seriesName}` : actressCache[key][0];
            findOrCreateFolderAndMove(fid, folderName, doneCallback, err => doneCallback());
            return;
        }
        GM_xmlhttpRequest({
            method: "GET", url: javbusDirectAccess + code,
            onload: xhr => {
                const $r = $(xhr.responseText);
                const actresses = [];
                $r.find("span.genre a[href*='/star/']").each(function () { const n = $(this).text().trim(); if (n) actresses.push(n); });
                if (actresses.length) {
                    actressCache[key] = actresses;
                    const folderName = (archiveMode === "2" && seriesName) ? `${actresses[0]} - ${seriesName}` : actresses[0];
                    findOrCreateFolderAndMove(fid, folderName, doneCallback, err => doneCallback());
                } else {
                    GM_xmlhttpRequest({
                        method: "GET", url: javbusUncensoredBase + code,
                        onload: xhr2 => {
                            const $r2 = $(xhr2.responseText);
                            const actresses2 = [];
                            $r2.find("span.genre a[href*='/star/']").each(function () { const n = $(this).text().trim(); if (n) actresses2.push(n); });
                            if (actresses2.length) {
                                actressCache[key] = actresses2;
                                const folderName = (archiveMode === "2" && seriesName) ? `${actresses2[0]} - ${seriesName}` : actresses2[0];
                                findOrCreateFolderAndMove(fid, folderName, doneCallback, err => doneCallback());
                            } else {
                                showPageNotification(`未找到 ${code} 的演员信息`, 'error', 3000);
                                doneCallback();
                            }
                        },
                        onerror: () => { showPageNotification(`查询演员失败`, 'error', 3000); doneCallback(); }
                    });
                }
            },
            onerror: () => { showPageNotification(`查询演员失败`, 'error', 3000); doneCallback(); }
        });
    };

    const archiveToActorFolder = () => {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        const cnt = $items.length;
        if (!cnt) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }
        if (!archiveRootCid) {
            showPageNotification("请先设置归档根目录（右键文件夹 → 设为归档根目录）", 'error', 5000);
            return;
        }
        const mode = prompt("选择归档方式：\n1 - 按女优\n2 - 按番号系列\n3 - 按女优+系列");
        if (!mode || !['1', '2', '3'].includes(mode)) { showPageNotification("无效选择", 'error', 3000); return; }
        progressBox.init('归档', cnt);
        showPageNotification(`开始归档 ${cnt} 个项目...`, 'info', 3000);
        let processed = 0, success = 0;
        const tasks = [];
        $items.each(function () {
            const $it = $(this);
            const fn = $it.attr("title");
            const ft = $it.attr("file_type");
            let fid = (ft === "0") ? $it.attr("cate_id") : $it.attr("file_id");
            if (!fid || !fn) return;
            const vi = parseVideoInfo(fn);
            if (!vi) { processed++; progressBox.update(processed); return; }
            const series = getSeriesFromCode(vi);
            if ((mode === "2" || mode === "3") && !series) {
                showPageNotification(`无法识别 ${vi.queryCode} 的系列，跳过`, 'error', 2500);
                processed++; progressBox.update(processed);
                return;
            }
            tasks.push(done => {
                if (mode === "1") {
                    requestActressForArchive(fid, vi.queryCode, null, "1", () => { processed++; success++; progressBox.update(processed); done(); });
                } else if (mode === "2") {
                    findOrCreateFolderAndMove(fid, series, () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
                } else if (mode === "3") {
                    requestActressForArchive(fid, vi.queryCode, series, "2", () => { processed++; success++; progressBox.update(processed); done(); });
                } else {
                    processed++; progressBox.update(processed); done();
                }
            });
        });
        runTasksWithLimit(tasks, 3, () => {
            progressBox.finish();
            showPageNotification(`归档完成：成功 ${success}/${cnt}`, 'success', 5000);
        });
    };

    // ========== JavDB 评分 ==========
    const getJavdbRating = () => {
        const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        const cnt = $items.length;
        if (!cnt) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }
        progressBox.init('获取评分', cnt);
        showPageNotification(`开始获取 ${cnt} 个项目的评分...`, 'info', 3000);
        let processed = 0, success = 0;
        const tasks = [];
        $items.each(function () {
            const $it = $(this);
            const fn = $it.attr("title");
            const ft = $it.attr("file_type");
            let fid = (ft === "0") ? $it.attr("cate_id") : $it.attr("file_id");
            if (!fid || !fn) return;
            const vi = parseVideoInfo(fn);
            if (!vi || !vi.queryCode) return;
            tasks.push(done => {
                requestJavdbRating(fid, vi.queryCode, fn, ok => {
                    processed++; if (ok) success++;
                    progressBox.update(processed);
                    done();
                });
            });
        });
        runTasksWithLimit(tasks, 2, () => {
            progressBox.finish();
            showPageNotification(`评分获取完成：成功 ${success}/${cnt}`, 'success', 5000);
        });
    };

    const requestJavdbRating = (fid, fh, fname, callback) => {
        GM_xmlhttpRequest({
            method: "GET", url: `${javdbSearchBase}${encodeURIComponent(fh)}&f=all`, timeout: 10000,
            onload: xhr => {
                if (xhr.status !== 200) { callback(false); return; }
                try {
                    const doc = new DOMParser().parseFromString(xhr.responseText, "text/html");
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
                        if (!isNaN(rating)) { update115Rating(fid, Math.round(rating), fh, fname, callback); return; }
                        const link = item.querySelector('a.box');
                        if (link) {
                            const href = link.getAttribute('href');
                            if (href) {
                                const detailUrl = javdbBase + (href.startsWith('/') ? href : '/' + href);
                                GM_xmlhttpRequest({
                                    method: "GET", url: detailUrl, timeout: 10000,
                                    onload: dx => {
                                        try {
                                            const dd = new DOMParser().parseFromString(dx.responseText, "text/html");
                                            const rEl = dd.querySelector('.panel-block .value');
                                            if (rEl) {
                                                const rating = parseFloat(rEl.textContent.trim().match(/(\d+\.\d+)/)?.[1]);
                                                if (!isNaN(rating)) { update115Rating(fid, Math.round(rating), fh, fname, callback); return; }
                                            }
                                            callback(false);
                                        } catch (e) { callback(false); }
                                    },
                                    onerror: () => callback(false),
                                    ontimeout: () => callback(false)
                                });
                                return;
                            }
                        }
                    }
                    callback(false);
                } catch (e) { callback(false); }
            },
            onerror: () => callback(false),
            ontimeout: () => callback(false)
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
            $("a#rename_all_multi_date").off("click").on("click", () => rename(rename_multi, true));
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