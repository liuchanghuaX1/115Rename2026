// ==UserScript==
// @name            115Rename2026+
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         1.5.0
// @description     115网盘视频整理：保留本地番号加工与网络改名分离，多站改名(JavLibrary→JavBus→xslist)，增加信息缓存、有限并发、快速番号解析。已知问题：暂不支持JavDB刮削与FC2网站改名。
// @author          sonarlee (多站轮询由原版脚本移植)
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @domain          javbus.com
// @domain          avmoo.host
// @domain          avsox.host
// @connect         javbus.com
// @connect         javlibrary.com
// @connect         xslist.org
// @connect         webapi.115.com
// @grant           GM_notification
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @license         MIT
// @homepageURL     https://github.com/liuchanghuaX1/115Rename2026
// @supportURL      https://github.com/liuchanghuaX1/115Rename2026/issues
// @downloadURL     https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026+.user.js
// @updateURL       https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026+.user.js
// ==/UserScript==

(function () {
    "use strict";

    // ==========================================
    // 模块一：全局UI与提示 (稳定版，加入进度条)
    // ==========================================
    const rootInfoId = 'archive-root-info-' + Date.now();

    function cleanupExistingRootInfo() {
        try {
            document.querySelectorAll('[id^="archive-root-info"]').forEach(el => el.remove());
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    if (iframe.contentDocument) {
                        iframe.contentDocument.querySelectorAll('[id^="archive-root-info"]').forEach(el => el.remove());
                    }
                } catch (e) { }
            });
        } catch (e) { }
    }
    cleanupExistingRootInfo();

    const uiStyle = `
    <style>
        [id^="archive-root-info"] {
            position: fixed; top: 20px; right: 20px; max-width: 300px;
            background-color: rgba(0, 0, 0, 0.8); color: white; padding: 12px 20px;
            border-radius: 4px; z-index: 9998; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border-left: 4px solid #1890ff;
        }
        .custom-notification {
            position: fixed; top: 80px; right: 20px; max-width: 300px;
            background-color: rgba(0, 0, 0, 0.8); color: white; padding: 12px 20px;
            border-radius: 4px; z-index: 9999; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transition: all 0.3s ease;
            opacity: 0; transform: translateY(-10px);
        }
        .custom-notification.success { border-left: 4px solid #52c41a; }
        .custom-notification.error { border-left: 4px solid #f5222d; }
        .custom-notification.info { border-left: 4px solid #1890ff; }
        .custom-notification.show { opacity: 1; transform: translateY(0); }
        #task-progress-box {
            position: fixed; bottom: 20px; right: 20px; min-width: 260px;
            background-color: rgba(0,0,0,0.8); color: #fff; padding: 10px 14px;
            border-radius: 4px; z-index: 9999; font-size: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        #task-progress-box .tp-title {
            font-size: 12px; margin-bottom: 6px;
        }
        #task-progress-box .tp-bar-outer {
            width: 100%; height: 6px; background: rgba(255,255,255,0.15);
            border-radius: 3px; overflow: hidden;
        }
        #task-progress-box .tp-bar-inner {
            height: 100%; width: 0%; background: #1890ff; transition: width 0.2s ease;
        }
        #task-progress-box .tp-text {
            margin-top: 4px; text-align: right; font-size: 11px; opacity: 0.9;
        }
    </style>`;
    $('head').append(uiStyle);

    const ROOT_DIR_CID = "0";
    let archiveRootCid = GM_getValue("archiveRootCid", null);
    let archiveRootName = GM_getValue("archiveRootName", null);

    // --- 信息缓存 (移植自原多站脚本) ---
    const infoCache = {};   // 番号 → { title, date, actresses }
    const actressCache = {};   // 番号 → 女优数组

    // --- 并发任务队列 (移植自原多站脚本) ---
    function runTasksWithLimit(tasks, limit, doneAll) {
        if (!tasks || tasks.length === 0) {
            doneAll && doneAll();
            return;
        }
        let index = 0;
        let running = 0;

        function next() {
            if (index >= tasks.length && running === 0) {
                doneAll && doneAll();
                return;
            }
            while (running < limit && index < tasks.length) {
                const task = tasks[index++];
                running++;
                task(() => {
                    running--;
                    next();
                });
            }
        }
        next();
    }

    // --- 进度条对象 (移植自原多站脚本) ---
    window.progressBox = {
        init(title, total) {
            this.total = total || 0;
            this.current = 0;
            this.title = title || '任务进度';
            let $box = $('#task-progress-box');
            if ($box.length === 0) {
                $('body').append(`
                    <div id="task-progress-box" style="display:none;">
                        <div class="tp-title"></div>
                        <div class="tp-bar-outer">
                            <div class="tp-bar-inner"></div>
                        </div>
                        <div class="tp-text"></div>
                    </div>
                `);
                $box = $('#task-progress-box');
            }
            $box.find('.tp-title').text(this.title);
            this.update(0);
            $box.show();
        },
        update(doneCount) {
            this.current = doneCount;
            const total = this.total || 1;
            const percent = Math.min(100, Math.round(doneCount * 100 / total));
            const $box = $('#task-progress-box');
            $box.find('.tp-bar-inner').css('width', percent + '%');
            $box.find('.tp-text').text(`${doneCount}/${this.total} (${percent}%)`);
        },
        finish() {
            this.update(this.total);
            setTimeout(() => {
                $('#task-progress-box').fadeOut(300);
            }, 800);
        }
    };

    // --- 通知 ---
    window.showPageNotification = function (message, type = 'info', duration = 3000) {
        if (duration === 3000) {
            if (type === 'success') duration = 3000;
            else if (type === 'error') duration = 5000;
        }
        const notificationId = 'custom-notification-' + Date.now();
        $('body').append(`<div id="${notificationId}" class="custom-notification ${type}">${message}</div>`);
        setTimeout(() => { $(`#${notificationId}`).addClass('show'); }, 10);
        setTimeout(() => {
            $(`#${notificationId}`).removeClass('show');
            setTimeout(() => { $(`#${notificationId}`).remove(); }, 300);
        }, duration);
    };

    function showArchiveRootInfo() {
        cleanupExistingRootInfo();
        let msg = (archiveRootCid && archiveRootName)
            ? `当前归档根目录: "${archiveRootName}"`
            : "当前无归档根目录，将使用115网盘根目录";
        const infoElement = $(`<div id="${rootInfoId}" class="archive-root-info">${msg}</div>`);
        if (window.self === window.top) {
            $('body').append(infoElement);
        }
    }

    let rootInfoTimer = null;
    function initializeRootInfo() {
        if (window.self !== window.top) return;
        if (rootInfoTimer) clearTimeout(rootInfoTimer);
        rootInfoTimer = setTimeout(function () {
            showArchiveRootInfo();
            rootInfoTimer = null;
        }, 2000);
    }

    $(window).on('load', initializeRootInfo);
    if (document.readyState === 'complete') initializeRootInfo();

    // =============================
    // 菜单注入
    // =============================
    let rename_list = `
            <li id="rename_list">
                <a id="local_code_process" class="mark" href="javascript:;">本地番号加工</a>
                <a id="rename_all_multi_date" class="mark" href="javascript:;">改名(多网站轮询)_统一格式</a>
                <a id="archive_to_folder" class="mark" href="javascript:;">归档至文件夹</a>
                <a id="set_archive_root" class="mark" href="javascript:;">设置为归档根目录</a>
                <a id="get_javdb_rating" class="mark" href="javascript:;">获取javdb评分</a>
            </li>
        `;

    let interval = setInterval(buttonInterval, 1000);

    // 多站信息源基地址
    const javbusBase = "https://www.javbus.com/";
    const javbusDirectAccess = javbusBase;
    const javbusUncensoredBase = javbusBase + "uncensored/";
    const javlibSearchBase = "https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=";
    const javlibBase = "https://www.javlibrary.com/";
    const xslistBase = "https://xslist.org/tw/";

    // ==========================================
    // 模块二：超级清洗字典与算法库 (原版保留)
    // ==========================================
    const GARBAGE_WORDS = [
        'WWW', 'CARIBBEAN', 'TOKYOHOT', 'HEYDOUGA', 'UNCENSORED', 'LEAK', 'LEAKED',
        '2160P', '1440P', '1080P', '720P', '480P',
        'FHD', 'HD', 'SD', 'X264', 'X265', 'H264', 'H265', 'HEVC', 'AVC',
        'AAC', 'AC3', 'DTS', 'FLAC', 'MP3', 'CHS', 'CHT', 'BIG5', 'GB', 'SC',
        'MP4', 'MKV', 'AVI', 'WMV', 'M4V', 'RMVB', 'ISO', 'TS',
        'UNC', 'CEN', 'NO', 'WATERMARK', 'RARBG', 'BT', 'WEB-DL', 'WEBRIP', 'BLURAY', 'BDREMUX'
    ];
    const GARBAGE_REGEX = new RegExp('\\b(' + GARBAGE_WORDS.join('|') + ')\\b', 'gi');
    const MARKER_REGEX = /(4K|8K|60fps|120fps|破解|流出|無修正|无码|中字|字幕|中文字幕)/gi;

    const CODE_PREFIXES = [
        'T28', 'S2M', '300MAAN', '200GANA', '259LUXU', '277DCV', '230GANA', '261ADA',
        'DASS', 'REBD', 'REBDB', 'MIDV', 'SSIS', 'PRED', 'PRTD', 'FSDSS', 'SIVR', 'SAMA',
        'MIDE', 'MIAD', 'MIAA', 'MIAE', 'MIAS', 'MIGD', 'MIRD', 'MIFD', 'MIID', 'MIZD', 'MDYD', 'MBYD', 'MEYD',
        'WANZ', 'NWF', 'BMW', 'JBD', 'RBD', 'ATAD', 'SHKD', 'SSPD', 'ATID', 'ADN',
        'IPTD', 'IPZ', 'IPX', 'IPZZ', 'IPIT', 'IPITD', 'IDBD', 'SUPD', 'IPSD', 'DAN', 'AND',
        'KAWD', 'KWBD', 'KAPD', 'JUC', 'JUX', 'JUY', 'JUSD', 'JUKD', 'OBA', 'URE',
        'JUFE', 'FINH', 'EBOD', 'MKCK', 'EYAN', 'KIRD', 'KIBD', 'BLK', 'KISD',
        'ONED', 'SOE', 'SNIS', 'SSNI', 'OFJE', 'SIVR', 'SPS', 'SRXV', 'TMSD', 'NEXD',
        'PGD', 'PBD', 'PJD', 'TEK', 'PPPD', 'HND', 'TYOD', 'TPPN', 'BF', 'ZUKO',
        'BID', 'BBI', 'CJOD', 'CLUB', 'MMND', 'TEAM', 'HHK', 'ALB', 'MUKD', 'MUDR', 'MUM',
        'ANND', 'BBAN', 'MOND', 'SPRD', 'VENU', 'VEMA', 'VAGU',
        'STAR', 'STARS', 'SACE', 'SDMS', 'SDDE', 'SDMT', 'SDDM', 'SDNM', 'SDAB', 'SDSI', 'SDMU',
        'DVDPS', 'DVDES', 'NHDT', 'NHDTA', 'RNHDT', 'IESP', 'IDOL', 'IENE', 'OPEN',
        'SVND', 'HBAD', 'HAVD', 'NTR', 'VSPDS', 'VSPDR', 'MV', 'FSET', 'DANDY', 'LADY',
        'HUNT', 'HUNTA', 'HUNTB', 'GAR', 'SVDVD', 'RCT', 'RCTD', 'NGKS', 'RD', 'KUF', 'NSS', 'UPSM', 'SERO',
        'DV', 'DVAJ', 'XV', 'XVSR', 'PXV', 'XVSE',
        'MDS', 'MADA', 'MILD', 'RMLD', 'MDB', 'RMDBB', 'RMDS', 'REAL', 'NATR', 'SCOP', 'SAMA', 'BOKD',
        'ABS', 'ABP', 'KBH', 'EZD', 'MAS', 'INU', 'JOB', 'EDD', 'ESK', 'MEK', 'DOM', 'YRZ',
        'PPP', 'EVO', 'SAD', 'GYD', 'HYK', 'FST', 'TBL', 'LOO', 'TOR', 'TD', 'RBS', 'MAN', 'ZZR', 'WPC', 'BNDV', 'CRS',
        'HODV', 'HRDV', 'YMDD', 'TMD', 'DSD', 'RJMD', 'ALD', 'DBE', 'DOJ', 'OFCD', 'SEND', 'ULJM', 'DSS', 'MOED', 'DER',
        'OPD', 'GRYD', 'MSBD', 'SS', 'HD', 'DVH', 'REID', 'GEN', 'DBUD', 'IBW', 'MMO', 'ADZ',
        'AKB', 'HITMA', 'RAY', '24ID', 'COSQ',
        'GRET', 'GATE', 'GEXP', 'GGFH', 'GGTB', 'GMMD', 'GODS', 'GPTM', 'GSAD', 'GXXD', 'GDGA', 'GOMK', 'GTRL',
        'GOMD', 'GDSC', 'TBW', 'TBB', 'TDP', 'TDLN', 'TGGP', 'THP', 'THZ', 'TMS', 'TZZ', 'TRE', 'TSGS', 'TSDL',
        'TSWN', 'TSW', 'TTRE', 'ATHB', 'AKBD', 'DMG', 'MGJH', 'ANIX', 'CYCD', 'YNO', 'AZGB', 'SKOT', 'SHP', 'JMSZ',
        'JHZD', 'NFDM', 'CGAD', 'CGBD', 'CHSD', 'CUSD', 'CHSH', 'CMV', 'PAED', 'RGI', 'ZARD', 'ZATS', 'ZDAD', 'ZKV',
        'COSETT', 'MXGS', 'MX3DS', 'IPBZ', 'FSDSS', 'SVMGM', 'MIDA'
    ].sort((a, b) => b.length - a.length);

    function matchCodeByPrefixLibrary(str) {
        if (!str) return null;
        for (const prefix of CODE_PREFIXES) {
            let reg = new RegExp(`\\b${prefix}[-_ ]?0*(\\d{1,5})\\b`, 'i');
            let m = str.match(reg);
            if (m) return `${prefix}-${(m[1] === '0' ? '0' : m[1]).padStart(3, '0')}`;
        }
        let t = str.replace(/[^A-Z0-9]/ig, '').toUpperCase();
        for (const prefix of CODE_PREFIXES) {
            let idx = t.indexOf(prefix);
            if (idx !== -1) {
                if (idx > 0 && /[A-Z]/.test(t[idx - 1])) continue;
                const rest = t.slice(idx + prefix.length);
                let m = rest.match(/^0*(\d{1,5})/);
                if (m) {
                    let num = Number(m[1]).toString();
                    return `${prefix}-${(num === '0' ? '0' : num).padStart(3, '0')}`;
                }
            }
        }
        return null;
    }

    function parseVideoInfo(origTitle) {
        if (!origTitle) return null;
        let raw = String(origTitle);
        let rawNoExt = raw.replace(/\.\w{2,5}$/, '');
        rawNoExt = rawNoExt.replace(/^.*?[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}(?:\/.*?)?@/i, '');

        let markers = [];
        let mMatch;
        while ((mMatch = MARKER_REGEX.exec(rawNoExt)) !== null) {
            let m = mMatch[1].toUpperCase().replace(/^[-_ ]/, '');
            if (m === '無修正') m = '无码';
            if (m === '中字' || m === '字幕' || m === '中文字幕') m = '中文字幕';
            if (!markers.includes(m)) markers.push(m);
        }

        let dateStr = "";
        let dateRegex = /(?:\b|_|^|@|】|\]|\[|【)((?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2})(?:\b|_|$|(?=[A-Za-z\u4e00-\u9fa5【\[\]】]))/i;
        let dateMatch = rawNoExt.match(dateRegex);
        if (dateMatch) {
            let rawDate = dateMatch[1];
            let dParts = rawDate.trim().split(/[-_\/\.\s]+/);
            if (dParts.length === 3) {
                let year = dParts[0].length === 2 ? "20" + dParts[0] : dParts[0];
                dateStr = `${year}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
            }
            rawNoExt = rawNoExt.replace(dateMatch[0], ' ');
        }

        let t = rawNoExt.toUpperCase().replace(MARKER_REGEX, ' ');
        t = t.replace(/(?:\b|_|^|@|】|\]|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
        t = t.replace(GARBAGE_REGEX, ' ');
        t = t.replace(/[\[\]\(\)\{\}（）【】]/g, ' ');
        t = t.replace(/[_\.\-\/\\]+/g, ' ');
        t = t.replace(/\b[01]+(?=[A-Z])/g, '');
        t = t.replace(/\b([A-Z])\s(?=[A-Z]\b)/g, '$1');

        let queryCode = null;
        let displayCode = null;

        let fc2Match = t.match(/(?:FC2?[-_ ]*PPV|FC[2C]?|PPV|F)[-_ ]*(\d{5,7})/i);
        if (fc2Match && fc2Match[1]) {
            queryCode = "FC2-PPV-" + fc2Match[1];
            displayCode = queryCode;
        } else {
            let tokyoMatch = t.match(/\b([NHK][-_ ]?\d{4})\b/i);
            if (tokyoMatch) {
                queryCode = tokyoMatch[1].toUpperCase().replace(/[-_ ]/g, '');
                displayCode = "TokyoHot-" + queryCode;
            } else {
                let numMatch = t.match(/\b(\d{4,6})[-_ ](\d{3,4})\b/);
                if (numMatch) {
                    queryCode = `${numMatch[1]}_${numMatch[2]}`;
                    if (/1pon/i.test(rawNoExt)) displayCode = `1pondo-${numMatch[1]}-${numMatch[2]}`;
                    else if (/carib/i.test(rawNoExt)) displayCode = `Caribbean-${numMatch[1]}-${numMatch[2]}`;
                    else if (/paco/i.test(rawNoExt)) displayCode = `Pacopacomama-${numMatch[1]}-${numMatch[2]}`;
                    else if (/heydouga/i.test(rawNoExt)) displayCode = `Heydouga-${numMatch[1]}-${numMatch[2]}`;
                    else {
                        queryCode = `${numMatch[1]}-${numMatch[2]}`;
                        displayCode = queryCode;
                    }
                } else {
                    queryCode = matchCodeByPrefixLibrary(t);
                    if (queryCode) {
                        displayCode = queryCode;
                    } else {
                        const m = t.match(/\b([A-Z]{2,6})[-_ ]?0*(\d{2,5})\b/);
                        if (m) {
                            queryCode = `${m[1]}-${Number(m[2]).toString().padStart(3, '0')}`;
                            displayCode = queryCode;
                        }
                    }
                }
            }
        }

        if (!queryCode) return null;

        let safeBaseForRegex = queryCode.replace(/_/g, '-').replace(/-/g, '[-_ ]?');
        if (raw.indexOf("中文") !== -1 || new RegExp(safeBaseForRegex + "[_-](UC|C)\\b", "i").test(raw)) {
            if (!markers.includes('中文字幕')) markers.push('中文字幕');
        }
        if (raw.indexOf("无码") !== -1 || new RegExp(safeBaseForRegex + "[_-](UC|U)\\b", "i").test(raw)) {
            if (!markers.includes('无码')) markers.push('无码');
        }

        let part = "";
        let baseRegexStr;
        if (queryCode.startsWith('FC2-PPV-')) {
            baseRegexStr = '(?:\\b|\\d{0,3})(?:FC2?[-_ ]*PPV|FC[2C]?|PPV|F)[-_ ]?0*' + queryCode.split('-')[2];
        } else if (displayCode.startsWith('TokyoHot-')) {
            baseRegexStr = '(?:\\b|\\d{0,3})(?:TOKYO[-_ ]*HOT[-_ ]*)?0*' + queryCode;
        } else if (displayCode.match(/^[a-zA-Z]+-\d{6}-\d{3}$/)) {
            baseRegexStr = '(?:\\b|\\d{0,3})(?:1pondo|carib(?:bean)?|pacopacomama|heydouga)?[-_ ]*' + displayCode.split('-').slice(1).join('[-_ ]*0*');
        } else {
            let parts = queryCode.split(/[-_]/);
            baseRegexStr = '(?:\\b|\\d{0,3})' + parts[0] + '[-_ ]?0*' + (parts[1] || '');
        }

        let suffixPattern = '(?:[-_\\s]+([a-zA-Z]{1,2}|\\d{1,3})|\\s*(?:part|pt|cd|ep|sp|disc)\\s*([a-zA-Z]{1,2}|\\d{1,3})|\\s*[\\(\\[]([a-zA-Z]{1,2}|\\d{1,3})[\\)\\]])(?=\\s|$|\\.|-|_|【)';
        let partRegex = new RegExp(baseRegexStr + suffixPattern, 'i');
        let pMatch = rawNoExt.match(partRegex);
        if (pMatch) {
            part = (pMatch[1] || pMatch[2] || pMatch[3]).toUpperCase();
        }

        let fullCode = part ? `${displayCode}-${part}` : displayCode;

        let localTitle = rawNoExt.replace(MARKER_REGEX, ' ');
        localTitle = localTitle.replace(/(?:\b|_|^|@|】|\]|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Za-z\u4e00-\u9fa5【\[\]】]))/ig, ' ');

        let safeBaseExtracted = pMatch ? pMatch[0].replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : baseRegexStr;
        let codeCleanupRegex = new RegExp('(?:\\b|^|_|-)\\d{0,3}' + safeBaseExtracted + '(?:[-_ \\(\\[]*(?:part|pt|cd|ep|sp|disc)?[-_ ]?[A-D0-9]{1,2}[\\)\\]]?)?(?=\\b|_|$|\\.)', 'gi');
        localTitle = localTitle.replace(codeCleanupRegex, ' ');

        localTitle = localTitle.replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ');
        localTitle = localTitle.replace(GARBAGE_REGEX, ' ');
        localTitle = localTitle.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

        return {
            queryCode: queryCode,
            baseCode: displayCode,
            fullCode: fullCode,
            markers: markers,
            date: dateStr,
            localTitle: localTitle
        };
    }

    // ==========================================
    // 模块三：本地改名与网络改名处理函数
    // ==========================================
    function local_rename(fid, vInfo, suffix, addDate, callback) {
        let newName = buildNewNameUnified(vInfo, vInfo.localTitle, [], vInfo.date, suffix);
        send_115(fid, newName, vInfo.fullCode, callback);
    }

    function buildNewNameUnified(vInfo, title, actresses, dateStr, suffix) {
        let name = String(vInfo.fullCode).trim();
        if (title) name += ' ' + String(title).trim();
        if (actresses && actresses.length > 0) name += ' ' + actresses.join('・');
        if (vInfo.markers && vInfo.markers.length > 0) {
            let uniqueM = [...new Set(vInfo.markers)].filter(m => m && m.trim() !== '');
            if (uniqueM.length > 0) {
                name += ' ' + uniqueM.map(m => `【${m}】`).join('');
            }
        }
        if (dateStr) name += '_' + dateStr;
        if (suffix) name += suffix;
        return stringStandard(name);
    }

    function send_115(id, name, fh, callback) {
        let file_name = stringStandard(name);
        $.post("https://webapi.115.com/files/edit", { fid: id, file_name: file_name }, function (data) {
            let result = JSON.parse(data);
            if (!result.state) {
                showPageNotification(`${fh} 修改失败: ${result.error}`, 'error', 3000);
                if (typeof callback === 'function') callback(); // 失败也要继续流程
            } else {
                showPageNotification(`${fh} 修改成功`, 'success', 2000);
                if (typeof callback === 'function') callback();
            }
        }).fail(function () {
            showPageNotification(`${fh} 请求失败`, 'error', 3000);
            if (typeof callback === 'function') callback();
        });
    }

    function stringStandard(name) {
        return name.replace(/\\/g, "").replace(/\//g, " ").replace(/:/g, " ")
            .replace(/\?/g, " ").replace(/"/g, " ").replace(/</g, " ")
            .replace(/>/g, " ").replace(/\|/g, "").replace(/\*/g, " ");
    }

    // ==========================================
    // 模块四：多站刮削函数 (移植自115重命名.txt，适配vInfo)
    // ==========================================
    function normalizeDate(str) {
        if (!str) return '';
        str = str.trim();
        let m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        return str;
    }

    function fetchFromJavlibraryByCode(code, onOk, onFail) {
        const searchUrl = javlibSearchBase + encodeURIComponent(code);
        GM_xmlhttpRequest({
            method: "GET", url: searchUrl,
            onload: xhr => {
                try {
                    const $search = $(xhr.responseText);
                    let firstLink = $search.find("#video_title a").attr("href")
                        || $search.find("div.video a[href*='?v=']").first().attr("href");
                    if (!firstLink) return onFail && onFail("JavLibrary 搜索无结果");
                    if (firstLink.startsWith("/")) firstLink = javlibBase.replace(/\/+$/, '') + firstLink;
                    GM_xmlhttpRequest({
                        method: "GET", url: firstLink,
                        onload: dX => {
                            try {
                                const $detail = $(dX.responseText);
                                let fullTitle = $detail.find("#video_title a").first().text().trim()
                                    || $detail.find("#video_title").text().trim();
                                let title = fullTitle;
                                if (title.toUpperCase().indexOf(code.toUpperCase()) === 0) {
                                    title = title.substring(code.length).trim();
                                }
                                let dateText = $detail.find("#video_date td.text").text().trim();
                                let isoDate = normalizeDate(dateText);
                                const actresses = [];
                                $detail.find("#video_cast td.text a").each(function () {
                                    const n = $(this).text().trim();
                                    if (n) actresses.push(n);
                                });
                                if (!title) return onFail && onFail("JavLibrary 无标题");
                                const info = { title, date: isoDate, actresses };
                                const key = code.toUpperCase();
                                infoCache[key] = info;
                                onOk && onOk(info);
                            } catch (e) { onFail && onFail("JavLibrary 详情解析失败: " + e.message); }
                        },
                        onerror: () => onFail && onFail("JavLibrary 详情页请求失败")
                    });
                } catch (e) { onFail && onFail("JavLibrary 搜索解析失败: " + e.message); }
            },
            onerror: () => onFail && onFail("JavLibrary 搜索请求失败")
        });
    }

    function fetchFromJavbusByCode(code, onOk, onFail) {
        const tryUrl = u => {
            GM_xmlhttpRequest({
                method: "GET", url: u + code,
                onload: xhr => {
                    try {
                        const $res = $(xhr.responseText);
                        let title = null;
                        let h3 = $res.find("h3");
                        if (h3.length) {
                            title = h3.text().trim();
                            if (title.toUpperCase().indexOf(code.toUpperCase()) === 0) {
                                title = title.substring(code.length).trim();
                            }
                        }
                        if (!title) title = $res.find("div.photo-frame img").attr("title");
                        if (!title) {
                            title = $res.find("title").text().trim();
                            if (title.indexOf(" - JavBus") > 0) {
                                title = title.substring(0, title.indexOf(" - JavBus")).trim();
                            }
                            if (title.toUpperCase().indexOf(code.toUpperCase()) === 0) {
                                title = title.substring(code.length).trim();
                            }
                        }
                        let isoDate = "";
                        $res.find("p").each(function () {
                            const t = $(this).text().trim();
                            if (/發行日期|发行日期/.test(t)) {
                                const m = t.match(/(\d{4}-\d{2}-\d{2})/);
                                if (m) isoDate = normalizeDate(m[1]);
                            }
                        });
                        if (!isoDate) {
                            const p = $res.find(".info p:contains('發行日期'), .info p:contains('发行日期')");
                            if (p.length) {
                                const t = p.text().replace(/.*?[:：]/, '').trim();
                                isoDate = normalizeDate(t);
                            }
                        }
                        const actresses = [];
                        $res.find("span.genre a[href*='/star/']").each(function () {
                            const n = $(this).text().trim();
                            if (n) actresses.push(n);
                        });
                        if (!title) {
                            if (u !== javbusUncensoredBase) return tryUrl(javbusUncensoredBase);
                            return onFail && onFail("JavBus 无标题");
                        }
                        const info = { title, date: isoDate, actresses };
                        const key = code.toUpperCase();
                        infoCache[key] = info;
                        onOk && onOk(info);
                    } catch (e) {
                        onFail && onFail("JavBus 解析失败: " + e.message);
                    }
                },
                onerror: () => {
                    if (u !== javbusUncensoredBase) return tryUrl(javbusUncensoredBase);
                    onFail && onFail("JavBus 请求失败");
                }
            });
        };
        tryUrl(javbusDirectAccess);
    }

    function parseXslistModelPageForCode($page, code, onOk, onFail) {
        const upperCode = String(code).toUpperCase();
        let hitRow = null;
        $page.find("#movices tbody tr").each(function () {
            const $tr = $(this);
            const c = ($tr.find("td").eq(0).find("strong").text() || "").trim().toUpperCase();
            if (c === upperCode) { hitRow = $tr; return false; }
        });
        if (!hitRow) return onFail && onFail("xslist 模型页未列出该番号");
        const $tds = hitRow.find("td");
        const title = $tds.eq(1).text().trim();
        const dateText = $tds.eq(2).text().trim();
        let isoDate = '';
        if (dateText && !/n\/a/i.test(dateText)) isoDate = normalizeDate(dateText);
        let actressName = $page.find("h1 span[itemprop='name']").first().text().trim();
        const actresses = actressName ? [actressName] : [];
        if (!title) return onFail && onFail("xslist 无标题");
        const info = { title, date: isoDate, actresses };
        const key = code.toUpperCase();
        infoCache[key] = info;
        onOk && onOk(info);
    }

    function fetchFromXslistByCode(code, onOk, onFail) {
        const searchUrl = xslistBase + "search?query=" + encodeURIComponent(code);
        GM_xmlhttpRequest({
            method: "GET", url: searchUrl,
            onload: xhr => {
                try {
                    const $search = $(xhr.responseText);
                    if ($search.find("#movices").length) {
                        return parseXslistModelPageForCode($search, code, onOk, onFail);
                    }
                    let firstLink = $search.find("a[href*='/model/']").first().attr("href");
                    if (!firstLink) return onFail && onFail("xslist 搜索无结果");
                    if (firstLink.startsWith("/")) firstLink = xslistBase.replace(/\/+$/, "") + firstLink;
                    GM_xmlhttpRequest({
                        method: "GET", url: firstLink,
                        onload: dx => {
                            try {
                                const $detail = $(dx.responseText);
                                parseXslistModelPageForCode($detail, code, onOk, onFail);
                            } catch (e) { onFail && onFail("xslist 详情解析失败: " + e.message); }
                        },
                        onerror: () => onFail && onFail("xslist 详情页请求失败")
                    });
                } catch (e) { onFail && onFail("xslist 搜索解析失败: " + e.message); }
            },
            onerror: () => onFail && onFail("xslist 搜索请求失败")
        });
    }

    // ==========================================
    // 模块五：改名主流程 (多站轮询+缓存+并发)
    // ==========================================
    window.rename_multi = function (fid, vInfo, suffix, addDate, callback) {
        const code = vInfo.queryCode;
        const key = code.toUpperCase();

        // FC2 仍然仅本地处理，不进行网络刮削
        if (/^FC2-PPV-\d{5,7}$/i.test(code)) {
            showPageNotification(`FC2 番号不支持网站在线信息，使用本地改名`, 'info', 2500);
            local_rename(fid, vInfo, suffix, addDate, callback);
            return;
        }

        // 1. 检查缓存
        if (infoCache[key]) {
            const info = infoCache[key];
            let title = info.title || '';
            let date = (addDate && info.date) ? info.date : (addDate ? vInfo.date : "");
            let newName = buildNewNameUnified(vInfo, title, info.actresses, date, suffix);
            send_115(fid, newName, vInfo.fullCode, callback);
            return;
        }

        // 2. 多站轮询：JavLibrary → JavBus → xslist
        fetchFromJavlibraryByCode(code, (info) => {
            let title = info.title || '';
            let date = (addDate && info.date) ? info.date : (addDate ? vInfo.date : "");
            let newName = buildNewNameUnified(vInfo, title, info.actresses, date, suffix);
            send_115(fid, newName, vInfo.fullCode, callback);
        }, () => {
            fetchFromJavbusByCode(code, (info) => {
                let title = info.title || '';
                let date = (addDate && info.date) ? info.date : (addDate ? vInfo.date : "");
                let newName = buildNewNameUnified(vInfo, title, info.actresses, date, suffix);
                send_115(fid, newName, vInfo.fullCode, callback);
            }, () => {
                fetchFromXslistByCode(code, (info) => {
                    let title = info.title || '';
                    let date = (addDate && info.date) ? info.date : (addDate ? vInfo.date : "");
                    let newName = buildNewNameUnified(vInfo, title, info.actresses, date, suffix);
                    send_115(fid, newName, vInfo.fullCode, callback);
                }, () => {
                    showPageNotification(`所有信息源均未找到 ${code} 的信息`, 'error', 4000);
                    if (typeof callback === 'function') callback();
                });
            });
        });
    };

    // ==========================================
    // 模块六：并发改名入口 (重写 rename 函数)
    // ==========================================
    function rename(call, addDate) {
        let $items = $("iframe[rel='wangpan']").contents().find("li.selected");
        let selectedCount = $items.length;
        if (selectedCount === 0) {
            showPageNotification("请先选择要处理的文件或文件夹", 'info', 3000);
            return;
        }

        const isLocal = (call === local_rename);
        progressBox.init(isLocal ? '本地番号加工进度' : '联网改名进度', selectedCount);
        showPageNotification(`开始处理 ${selectedCount} 个文件...`, 'info', 3000);

        const items = $items.toArray();
        const tasks = [];

        items.forEach(li => {
            const $item = $(li);
            const file_name = $item.attr("title");
            const file_type = $item.attr("file_type");
            let fid, suffix = "";
            if (file_type === "0") {
                fid = $item.attr("cate_id");
            } else {
                fid = $item.attr("file_id");
                let lastIndexOf = file_name.lastIndexOf('.');
                if (lastIndexOf !== -1) suffix = file_name.substr(lastIndexOf);
            }
            if (!fid || !file_name) return;
            let vInfo = parseVideoInfo(file_name);
            if (!vInfo) return;

            tasks.push((done) => {
                call(fid, vInfo, suffix, addDate, () => {
                    done();
                });
            });
        });

        const CONCURRENCY = isLocal ? 5 : 3;
        let processedCount = 0;
        const wrappedTasks = tasks.map(task => {
            return (done) => {
                task(() => {
                    processedCount++;
                    progressBox.update(processedCount);
                    done();
                });
            };
        });

        runTasksWithLimit(wrappedTasks, CONCURRENCY, () => {
            progressBox.finish();
            showPageNotification(`所有文件处理完成`, 'success', 5000);
        });
    }

    // ========== 菜单事件绑定 ==========
    function buttonInterval() {
        let $menu = $("div#js_float_content");
        if ($menu.length === 0) return;
        let open_dir = $menu.find("li[val='open_dir'], li[data-val='open_dir'], li[menu='open_dir']");
        if (open_dir.length !== 0 && $("li#rename_list").length === 0) {
            open_dir.before(rename_list);
            $("a#local_code_process").off("click").on("click", () => rename(local_rename, false));
            $("a#rename_all_multi_date").off("click").on("click", () => rename(rename_multi, true));
            $("a#archive_to_folder").off("click").on("click", () => archiveToActorFolder());
            $("a#set_archive_root").off("click").on("click", () => setArchiveRoot());
            $("a#get_javdb_rating").off("click").on("click", () => getJavdbRating());
            clearInterval(interval);
        }
    }

    function setArchiveRoot() {
        let selectedFolder = $("iframe[rel='wangpan']").contents().find("li.selected");
        if (selectedFolder.length !== 1) {
            showPageNotification("请只选择一个文件夹", 'error', 3000);
            return;
        }
        let $item = $(selectedFolder[0]);
        if ($item.attr("file_type") !== "0") {
            showPageNotification("请选择文件夹类型", 'error', 3000);
            return;
        }
        let cid = $item.attr("cate_id");
        let name = $item.attr("title");
        if (cid) {
            GM_setValue("archiveRootCid", cid);
            GM_setValue("archiveRootName", name);
            archiveRootCid = cid; archiveRootName = name;
            cleanupExistingRootInfo();
            showArchiveRootInfo();
            showPageNotification(`归档根目录设置成功: "${name}"`, 'success', 5000);
        }
    }

    // 归档与评分暂时保留空实现
    function archiveToActorFolder() {
        showPageNotification(`该功能在当前版本暂不支持`, 'info', 3000);
    }

    function getJavdbRating() {
        showPageNotification(`已知问题：暂不支持获取JavDB评分`, 'error', 3000);
    }

})();