// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         1.1.0
// @description     115网盘视频整理：本地加工与网络改名双轨分离。防误伤透视引擎(完美解决DASS截断)、精确归类NHK一位番号、根治01前缀与重复番号、彻底免疫空格日期/广告干扰、废弃本地乱码标题保留核心标记。
// @author          sonarlee
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @domain          javbus.com
// @domain          avmoo.host
// @domain          avsox.host
// @domain          javdb.com
// @domain          fc2ppvdb.com
// @connect         javdb.com
// @connect         fc2ppvdb.com
// @grant           GM_notification
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @license         MIT
// @homepageURL     https://github.com/liuchanghuaX1/115Rename2026
// @supportURL      https://github.com/liuchanghuaX1/115Rename2026/issues
// @downloadURL     https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js
// @updateURL       https://raw.githubusercontent.com/liuchanghuaX1/115Rename2026/main/115Rename2026.user.js
// ==/UserScript==

(function () {
    "use strict";

    // ==========================================
    // 模块一：全局UI与提示 (稳定版)
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
                } catch (e) {}
            });
        } catch (e) {}
    }
    cleanupExistingRootInfo();
    
    const notificationStyle = `
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
    </style>`;
    $('head').append(notificationStyle);
    
    const ROOT_DIR_CID = "0"; 
    let archiveRootCid = GM_getValue("archiveRootCid", null);
    let archiveRootName = GM_getValue("archiveRootName", null);
    
    window.showPageNotification = function(message, type = 'info', duration = 3000) {
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
        let rootDirMessage = (archiveRootCid && archiveRootName) 
            ? `当前归档根目录: "${archiveRootName}"` 
            : "当前无归档根目录，将使用115网盘根目录";
        const infoElement = $(`<div id="${rootInfoId}" class="archive-root-info">${rootDirMessage}</div>`);
        if (window.self === window.top) {
            $('body').append(infoElement);
        }
    }
    
    let rootInfoTimer = null;
    function initializeRootInfo() {
        if (window.self !== window.top) return;
        if (rootInfoTimer) clearTimeout(rootInfoTimer);
        rootInfoTimer = setTimeout(function() {
            showArchiveRootInfo();
            rootInfoTimer = null;
        }, 2000);
    }
    
    $(window).on('load', initializeRootInfo);
    if (document.readyState === 'complete') initializeRootInfo();
    
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

    const javbusBase = "https://www.javbus.com/";
    const javbusDirectAccess = javbusBase;
    const javbusUncensoredBase = javbusBase + "uncensored/";
    const javdbBase = "https://javdb.com/";
    const javdbSearchBase = "https://javdb.com/search?q=";
    const javdbDirectAccess = "https://javdb.com/";
    const fc2ppvdbBase = "https://fc2ppvdb.com/articles/";

    // ==========================================
    // 模块二：超级清洗字典与算法库
    // ==========================================
    
    // 废弃垃圾词汇 (包含视频格式防干扰)
    const GARBAGE_WORDS = [
        'WWW','CARIBBEAN','TOKYOHOT','HEYDOUGA','UNCENSORED','LEAK','LEAKED',
        '2160P','1440P','1080P','720P','480P',
        'FHD','HD','SD','X264','X265','H264','H265','HEVC','AVC',
        'AAC','AC3','DTS','FLAC','MP3','CHS','CHT','BIG5','GB','SC',
        'MP4','MKV','AVI','WMV','M4V','RMVB','ISO','TS',
        'UNC','CEN','NO','WATERMARK','RARBG','BT','WEB-DL','WEBRIP','BLURAY','BDREMUX'
    ];
    const GARBAGE_REGEX = new RegExp('\\b(' + GARBAGE_WORDS.join('|') + ')\\b', 'gi');
    
    // 提取需要保留的核心标记 (4K, 8K, 破解, 无码等)
    const MARKER_REGEX = /(4K|8K|60fps|120fps|破解|流出|無修正|无码|中字|字幕|中文字幕)/gi;

    const CODE_PREFIXES = [
        'DASS', 'REBD', 'REBDB', // 补充极易发生包含关系的厂牌
        'MIDE','MIAD','MIAA','MIAE','MIAS','MIGD','MIRD','MIFD','MIID','MIZD','MDYD','MBYD','MEYD',
        'WANZ','NWF','BMW','JBD','RBD','ATAD','SHKD','SSPD','ATID','ADN',
        'IPTD','IPZ','IPX','IPZZ','IPIT','IPITD','IDBD','SUPD','IPSD','DAN','AND',
        'KAWD','KWBD','KAPD','JUC','JUX','JUY','JUSD','JUKD','OBA','URE',
        'JUFE','FINH','EBOD','MKCK','EYAN','KIRD','KIBD','BLK','KISD',
        'ONED','SOE','SNIS','SSNI','OFJE','SIVR','SPS','SRXV','TMSD','NEXD',
        'PGD','PBD','PJD','TEK','PPPD','HND','TYOD','TPPN','BF','ZUKO',
        'BID','BBI','CJOD','CLUB','MMND','TEAM','HHK','ALB','MUKD','MUDR','MUM',
        'ANND','BBAN','MOND','SPRD','VENU','VEMA','VAGU',
        'STAR','STARS','SACE','SDMS','SDDE','SDMT','SDDM','SDNM','SDAB','SDSI','SDMU',
        'DVDPS','DVDES','NHDT','NHDTA','RNHDT','IESP','IDOL','IENE','OPEN',
        'SVND','HBAD','HAVD','NTR','VSPDS','VSPDR','MV','FSET','DANDY','LADY',
        'HUNT','HUNTA','HUNTB','GAR','SVDVD','RCT','RCTD','NGKS','RD','KUF','NSS','UPSM','SERO',
        'DV','DVAJ','XV','XVSR','PXV','XVSE',
        'MDS','MADA','MILD','RMLD','MDB','RMDBB','RMDS','REAL','NATR','SCOP','SAMA','BOKD',
        'ABS','ABP','KBH','EZD','MAS','INU','JOB','EDD','ESK','MEK','DOM','YRZ',
        'PPP','EVO','SAD','GYD','HYK','FST','TBL','LOO','TOR','TD','RBS','MAN','ZZR','WPC','BNDV','CRS',
        'HODV','HRDV','YMDD','TMD','DSD','RJMD','ALD','DBE','DOJ','OFCD','SEND','ULJM','DSS','MOED','DER',
        'OPD','GRYD','MSBD','SS','HD','DVH','REID','GEN','DBUD','IBW','MMO','ADZ',
        'AKB','HITMA','RAY','24ID','COSQ',
        'GRET','GATE','GEXP','GGFH','GGTB','GMMD','GODS','GPTM','GSAD','GXXD','GDGA','GOMK','GTRL',
        'GOMD','GDSC','TBW','TBB','TDP','TDLN','TGGP','THP','THZ','TMS','TZZ','TRE','TSGS','TSDL',
        'TSWN','TSW','TTRE','ATHB','AKBD','DMG','MGJH','ANIX','CYCD','YNO','AZGB','SKOT','SHP','JMSZ',
        'JHZD','NFDM','CGAD','CGBD','CHSD','CUSD','CHSH','CMV','PAED','RGI','ZARD','ZATS','ZDAD','ZKV',
        'COSETT','MXGS','MX3DS','IPBZ','FSDSS','SVMGM','MIDA'
    ].sort((a, b) => b.length - a.length);

    'use strict';

    function buttonInterval() {
        let open_dir = $("div#js_float_content li[val='open_dir']");
        if (open_dir.length !== 0 && $("li#rename_list").length === 0) {
            open_dir.before(rename_list);
            $("a#local_code_process").click(function () { rename(local_rename, false); });
            $("a#rename_all_multi_date").click(function () { rename(rename_multi, true); });
            $("a#archive_to_folder").click(function () { archiveToActorFolder(); });
            $("a#set_archive_root").click(function () { setArchiveRoot(); });
            $("a#get_javdb_rating").click(function () { getJavdbRating(); });
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

    function rename(call, addDate) {
        let selectedCount = $("iframe[rel='wangpan']").contents().find("li.selected").length;
        if(selectedCount === 0) return;
        showPageNotification(`开始处理 ${selectedCount} 个文件...`, 'info', 3000);
        let successCount = 0;
        
        $("iframe[rel='wangpan']").contents().find("li.selected").each(function (index, v) {
            let $item = $(v);
            let file_name = $item.attr("title");
            let file_type = $item.attr("file_type");
            let fid, suffix = "";
            
            if (file_type === "0") {
                fid = $item.attr("cate_id");
            } else {
                fid = $item.attr("file_id");
                let lastIndexOf = file_name.lastIndexOf('.');
                if (lastIndexOf !== -1) {
                    suffix = file_name.substr(lastIndexOf, file_name.length);
                }
            }

            if (fid && file_name) {
                let vInfo = parseVideoInfo(file_name);
                if (vInfo) {
                    call(fid, vInfo, suffix, addDate, function() {
                        successCount++;
                        if (successCount === selectedCount) {
                            showPageNotification(`所有 ${successCount} 个文件处理完成`, 'success', 5000);
                        }
                    });
                } else {
                    console.log("无法从文件名中提取到番号: " + file_name);
                }
            }
        });
    }

    // 智能前缀库匹配：融合正常边界匹配和透视防误伤匹配
    function matchCodeByPrefixLibrary(str) {
        if (!str) return null;
        
        // 1. 单词边界匹配优先 (应对标准的 DASS-234)
        for (const prefix of CODE_PREFIXES) {
            let reg = new RegExp(`\\b${prefix}[-_ ]?0*(\\d{1,5})\\b`, 'i');
            let m = str.match(reg);
            if (m) return `${prefix}-${(m[1] === '0' ? '0' : m[1]).padStart(3, '0')}`;
        }
        
        // 2. 透视匹配：应对黏连 (如 h_346rebd00680)
        let t = str.replace(/[^A-Z0-9]/g, '');
        for (const prefix of CODE_PREFIXES) {
            let idx = t.indexOf(prefix);
            if (idx !== -1) {
                // 核心防误伤：如果前缀前面紧跟的是字母（比如 DASS 中的 SS），说明这是长番号的局部，必须跳过！
                if (idx > 0 && /[A-Z]/.test(t[idx - 1])) {
                    continue; 
                }
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

    /**
     * 强力智能提取引擎：
     * 1. 绝对切除域名前缀
     * 2. 安全提取日期（包含空格日期如 2014 01 01，提取后彻底销毁）
     * 3. 透视提取番号、片段
     * 4. 彻底摒弃本地标题内容
     */
    function parseVideoInfo(origTitle) {
        if (!origTitle) return null;
        let raw = String(origTitle);
        let rawNoExt = raw.replace(/\.\w{2,5}$/, '');

        // 1. 绝对切除所有网站域名前缀 
        rawNoExt = rawNoExt.replace(/^.*?[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}(?:\/.*?)?@/i, ''); 

        // 2. 提取需要保留的核心标记 (4K, 无码, 破解等)
        let markers = [];
        let mMatch;
        while ((mMatch = MARKER_REGEX.exec(rawNoExt)) !== null) {
            let m = mMatch[1].toUpperCase().replace(/^[-_ ]/, '');
            if(m === '無修正') m = '无码';
            if(m === '中字' || m === '字幕' || m === '中文字幕') m = '中文字幕';
            if (!markers.includes(m)) markers.push(m);
        }

        // 3. 提取并切除日期 (解决带空格、无连字符与番号粘连)
        let dateStr = "";
        let dateRegex = /(?:\b|_|^|@|】|\]|\[|【)((?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2})(?:\b|_|$|(?=[A-Za-z\u4e00-\u9fa5【\[\]】]))/i;
        let dateMatch = rawNoExt.match(dateRegex);
        if (dateMatch) {
            let rawDate = dateMatch[1];
            // 格式化出标准的 YYYY-MM-DD
            let dParts = rawDate.trim().split(/[-_\/\.\s]+/);
            if (dParts.length === 3) {
                let year = dParts[0].length === 2 ? "20" + dParts[0] : dParts[0];
                dateStr = `${year}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`;
            }
            rawNoExt = rawNoExt.replace(dateMatch[0], ' '); 
        }

        // 4. 构建用于刮削番号的底层字符串
        let t = rawNoExt.toUpperCase().replace(MARKER_REGEX, ' ');
        t = t.replace(/(?:\b|_|^|@|】|\]|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
        t = t.replace(GARBAGE_REGEX, ' '); 
        t = t.replace(/\[[^\]]*?\]|\([^\)]*?\)|\{[^\}]*?\}|（[^）]*?）/g, ' '); 
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
            // Tokyo Hot 处理 (严格只支持 N, H, K 单字母 + 4位数字)
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
                    // 调用带防误伤的库内匹配引擎
                    queryCode = matchCodeByPrefixLibrary(t);
                    if (queryCode) {
                        displayCode = queryCode;
                    } else {
                        // 兜底匹配：[A-Z]{2,6} (至少两位字母)
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

        // 隐式检测原名中的 UC / C / U 后缀，补充无码或中字标记
        let safeBaseForRegex = queryCode.replace(/_/g, '-').replace(/-/g, '[-_ ]?');
        if (raw.indexOf("中文") !== -1 || new RegExp(safeBaseForRegex + "[_-](UC|C)\\b", "i").test(raw)) {
            if (!markers.includes('中文字幕')) markers.push('中文字幕');
        }
        if (raw.indexOf("无码") !== -1 || new RegExp(safeBaseForRegex + "[_-](UC|U)\\b", "i").test(raw)) {
            if (!markers.includes('无码')) markers.push('无码');
        }

        // 5. 精准提取分段标记 (-1, -A, -C, part1 等)
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

        // 返回最精简的数据组合，完全抛弃了以前杂乱的本地标题
        return {
            queryCode: queryCode, // 网络刮削用
            baseCode: displayCode, // 基础规范命名
            fullCode: fullCode, // 带分集规范命名
            markers: markers, // 提取出的各种保留标记
            date: dateStr // 提取出的纯净日期 YYYY-MM-DD
        };
    }

    // ==========================================
    // 模块三：本地改名与网络刮削双轨处理
    // ==========================================
    
    // 【本地改名专用】完全抛弃乱码标题，只保留番号、标记与日期
    function local_rename(fid, vInfo, suffix, addDate, callback) {
        // 第二个参数故意传空字符串 ""，丢弃标题
        let newName = buildNewNameUnified(vInfo, "", [], vInfo.date, suffix);
        send_115(fid, newName, vInfo.fullCode, callback);
    }
    
    // 【网络改名专用】格式：[番号(分集)] [刮削影片名] [刮削女优名] [【标记】] [_YYYY-MM-DD] [后缀]
    function buildNewNameUnified(vInfo, title, actresses, dateStr, suffix) {
        let name = String(vInfo.fullCode).trim();
        
        if (title) name += ' ' + String(title).trim();
        if (actresses && actresses.length > 0) name += ' ' + actresses.join('・');
        
        // 统一加入提取的标记
        if (vInfo.markers && vInfo.markers.length > 0) {
            let uniqueM = [...new Set(vInfo.markers)].filter(m => m && m.trim() !== '');
            if (uniqueM.length > 0) {
                name += ' ' + uniqueM.map(m => `【${m}】`).join('');
            }
        }
        
        if (dateStr) {
            name += '_' + dateStr;
        }
        
        if (suffix) name += suffix;
        return stringStandard(name);
    }

    function rename_multi(fid, vInfo, suffix, addDate, callback) {
        if (/^FC2-PPV-\d{5,7}$/i.test(vInfo.baseCode)) {
            // FC2 改名备用逻辑
            requestFC2(fid, vInfo, suffix, addDate, vInfo.baseCode.split('-')[2], callback);
            return;
        }
        requestMultiSource(fid, vInfo, suffix, addDate, callback, "javbus");
    }
    
    function requestMultiSource(fid, vInfo, suffix, addDate, callback, source) {
        if (source === "javbus") {
            requestJavbus(fid, vInfo, suffix, addDate, javbusDirectAccess, function() {
                if (typeof callback === 'function') callback();
            }, 0, function() {
                // JavBus 失败后跳转 JavDB
                requestMultiSource(fid, vInfo, suffix, addDate, callback, "javdb");
            });
        } else if (source === "javdb") {
            requestJavdb(fid, vInfo, suffix, addDate, callback);
        } else {
            showPageNotification(`无法在所有网站找到"${vInfo.queryCode}"的信息`, 'error', 3000);
            if (typeof callback === 'function') callback();
        }
    }

    // 净化网络刮削到的标题 (彻底剔除 JavDB "顯示原標題" 和重复的番号)
    function cleanScrapedTitle(title, vInfo) {
        if (!title) return "";
        let safeCode = vInfo.queryCode.replace(/[-\s_]/g, '[-_\\s]?');
        title = title.replace(/顯示原標題.*/ig, '');
        title = title.replace(/显示原标题.*/ig, '');
        
        let codeRegex = new RegExp('(?:\\b|^|_|-)\\d{0,3}' + safeCode + '\\b', 'ig');
        while (codeRegex.test(title)) {
            title = title.replace(codeRegex, ' ');
        }
        title = title.replace(new RegExp('\\b' + safeCode + '\\b', 'ig'), ' ');
        title = title.replace(/\s-\s*JavDB/ig, "").trim();
        return title.trim();
    }

    function requestJavbus(fid, vInfo, suffix, addDate, url, callback, uncensoredAttempt = 0, failCallback) {
        GM_xmlhttpRequest({
            method: "GET", url: url + vInfo.queryCode,
            onload: xhr => {
                let response = $(xhr.responseText);
                let title = null;
                let h3Title = response.find("h3");
                if (h3Title.length > 0) title = h3Title.text().trim();
                if (!title) title = response.find("div.photo-frame img").attr("title");
                if (!title) title = response.find("title").text().trim();

                title = cleanScrapedTitle(title, vInfo);

                let date = response.find("div.photo-info date:last").html();
                if (!date) {
                    let allText = response.text();
                    let dateMatch = allText.match(/\d{4}-\d{2}-\d{2}/);
                    if (dateMatch) date = dateMatch[0];
                }

                let actresses = [];
                response.find("span.genre a[href*='/star/']").each(function () {
                    let n = $(this).text().trim();
                    if (n) actresses.push(n);
                });

                if (title && title.length > 0) {
                    let finalDate = (addDate && date) ? date : (addDate ? vInfo.date : "");
                    let newName = buildNewNameUnified(vInfo, title, actresses, finalDate, suffix);
                    send_115(fid, newName, vInfo.fullCode, callback);
                } else if (url !== javbusUncensoredBase && uncensoredAttempt === 0) {
                    requestJavbus(fid, vInfo, suffix, addDate, javbusUncensoredBase, callback, 1, failCallback);
                } else {
                    if (typeof failCallback === 'function') failCallback(); 
                    else if (typeof callback === 'function') callback();
                }
            },
            onerror: xhr => {
                if (typeof failCallback === 'function') failCallback(); 
                else if (typeof callback === 'function') callback();
            }
        });
    }

    function requestFC2(fid, vInfo, suffix, addDate, fc2Number, callback) {
        const fc2Url = fc2ppvdbBase + fc2Number;
        GM_xmlhttpRequest({
            method: "GET", url: fc2Url, timeout: 10000,
            onload: xhr => {
                try {
                    if (xhr.status !== 200) { handleFC2Error(fc2Number, callback, "状态码异常"); return; }
                    let response = $(xhr.responseText);
                    let title = null;
                    let articleLink = response.find('a[href*="adult.contents.fc2.com"]');
                    if (articleLink.length > 0) title = articleLink.text().trim();
                    if (!title) {
                        title = response.find("title").text().replace(" - FC2PPVDB", "").trim();
                    }
                    if (response.text().includes("No articles found")) {
                        handleFC2Error(fc2Number, callback, "未找到记录"); return;
                    }
                    
                    let date = null;
                    let dateElement = response.find("time");
                    if (dateElement.length > 0) {
                        let rawDate = dateElement.attr("datetime") || dateElement.text().trim();
                        let dateMatch = rawDate.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
                        if (dateMatch) date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
                    }
                    
                    if (title) {
                        let finalDate = (addDate && date) ? date : (addDate ? vInfo.date : "");
                        let newName = buildNewNameUnified(vInfo, title, [], finalDate, suffix);
                        send_115(fid, newName, vInfo.fullCode, callback);
                    } else {
                        handleFC2Error(fc2Number, callback, "无标题信息");
                    }
                } catch (e) { handleFC2Error(fc2Number, callback, "解析错误"); }
            },
            onerror: xhr => handleFC2Error(fc2Number, callback, "请求失败")
        });
    }
    
    function handleFC2Error(fc2Number, callback, errorMsg) {
        showPageNotification(`FC2-PPV-${fc2Number}: ${errorMsg}`, 'error', 3000);
        if (typeof callback === 'function') callback();
    }
    
    function requestJavdb(fid, vInfo, suffix, addDate, callback) {
        const searchUrl = javdbSearchBase + vInfo.queryCode + "&f=all";
        GM_xmlhttpRequest({
            method: "GET", url: searchUrl,
            onload: xhr => {
                try {
                    let html = xhr.responseText;
                    let parser = new DOMParser();
                    let doc = parser.parseFromString(html, "text/html");

                    // 检查是否被JavDB直接跳转到详情页
                    if (doc.querySelector('.video-detail')) {
                        parseJavdbDoc(doc, fid, vInfo, suffix, addDate, callback);
                    } else {
                        let firstItem = doc.querySelector('.movie-list .item a.box');
                        if (firstItem) {
                            let detailLink = firstItem.getAttribute('href');
                            if (detailLink.startsWith('/')) detailLink = javdbDirectAccess + detailLink.substring(1);
                            GM_xmlhttpRequest({
                                method: "GET", url: detailLink,
                                onload: detailXhr => {
                                    try {
                                        let detailDoc = parser.parseFromString(detailXhr.responseText, "text/html");
                                        parseJavdbDoc(detailDoc, fid, vInfo, suffix, addDate, callback);
                                    } catch (e) {
                                        if (typeof callback === 'function') callback();
                                    }
                                },
                                onerror: err => { if (typeof callback === 'function') callback(); }
                            });
                        } else {
                            if (typeof callback === 'function') callback();
                        }
                    }
                } catch (e) { if (typeof callback === 'function') callback(); }
            },
            onerror: xhr => { if (typeof callback === 'function') callback(); }
        });
    }

    function parseJavdbDoc(doc, fid, vInfo, suffix, addDate, callback) {
        let titleNode = doc.querySelector('h2.title strong') || doc.querySelector('h2.title');
        if (!titleNode) {
            if (typeof callback === 'function') callback();
            return;
        }
        
        let parentTitleNode = doc.querySelector('h2.title');
        let title = parentTitleNode ? parentTitleNode.textContent : titleNode.textContent;
        title = cleanScrapedTitle(title, vInfo);

        let date = null;
        let dateMatch = doc.body.textContent.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) date = dateMatch[0];
        
        let actresses = [];
        doc.querySelectorAll('div.panel-block .value a[href*="/actors/"]').forEach(function(a) {
            let n = a.textContent.replace(/[♀♂]/g, '').trim();
            if (n) actresses.push(n);
        });

        if (title) {
            let finalDate = (addDate && date) ? date : (addDate ? vInfo.date : "");
            let newName = buildNewNameUnified(vInfo, title, actresses, finalDate, suffix);
            send_115(fid, newName, vInfo.fullCode, callback);
        } else {
            if (typeof callback === 'function') callback();
        }
    }

    function send_115(id, name, fh, callback) {
        let file_name = stringStandard(name);
        $.post("https://webapi.115.com/files/edit", { fid: id, file_name: file_name }, function (data) {
            let result = JSON.parse(data);
            if (!result.state) showPageNotification(`${fh} 修改失败: ${result.error}`, 'error', 3000);
            else { showPageNotification(`${fh} 修改成功`, 'success', 2000); if (typeof callback === 'function') callback(); }
        });
    }

    function stringStandard(name) {
        return name.replace(/\\/g, "").replace(/\//g, " ").replace(/:/g, " ")
            .replace(/\?/g, " ").replace(/"/g, " ").replace(/</g, " ")
            .replace(/>/g, " ").replace(/\|/g, "").replace(/\*/g, " ");
    }
    
    // ==========================================
    // 模块四：归档与评分功能
    // ==========================================
    function archiveToActorFolder() {
        let $iframeContents = $("iframe[rel='wangpan']").contents();
        let $selectedItems = $iframeContents.find("li.selected");
        let selectedCount = $selectedItems.length;
        
        if(selectedCount === 0) return;
        let processedCount = 0; let successCount = 0;
        showPageNotification(`开始处理 ${selectedCount} 个项目...`, 'info', 3000);
        
        $selectedItems.each(function (index, v) {
            let $item = $(v);
            let file_name = $item.attr("title");
            let file_type = $item.attr("file_type");
            let fid = file_type === "0" ? $item.attr("cate_id") : $item.attr("file_id");

            if (fid && file_name) {
                let vInfo = parseVideoInfo(file_name);
                if (vInfo && vInfo.queryCode) {
                    requestJavbusForActor(fid, vInfo.queryCode, function() {
                        processedCount++; successCount++; checkAllCompleted();
                    }, function() {
                        processedCount++; checkAllCompleted();
                    });
                } else { processedCount++; checkAllCompleted(); }
            } else { processedCount++; checkAllCompleted(); }
        });
            
        function checkAllCompleted() {
            if (processedCount === selectedCount) {
                if (successCount > 0) showPageNotification(`处理完成: ${successCount}/${selectedCount} 个项目成功处理`, 'success', 5000);
                else showPageNotification(`处理完成: 没有成功处理的项目`, 'info', 5000);
            }
        }
    }

    function requestJavbusForActor(fid, queryCode, successCallback, failCallback) {
        GM_xmlhttpRequest({
            method: "GET", url: javbusDirectAccess + queryCode,
            onload: xhr => {
                let response = $(xhr.responseText);
                let actresses = [];
                response.find("span.genre a[href*='/star/']").each(function() {
                    let n = $(this).text().trim();
                    if (n) actresses.push(n);
                });
                
                if (actresses.length > 0) {
                    findOrCreateFolderAndMove(fid, actresses[0], successCallback, failCallback);
                } else {
                    GM_xmlhttpRequest({
                        method: "GET", url: javbusUncensoredBase + queryCode,
                        onload: xhrUnc => {
                            let responseUnc = $(xhrUnc.responseText);
                            let actressesUnc = [];
                            responseUnc.find("span.genre a[href*='/star/']").each(function() {
                                let n = $(this).text().trim();
                                if (n) actressesUnc.push(n);
                            });
                            if (actressesUnc.length > 0) findOrCreateFolderAndMove(fid, actressesUnc[0], successCallback, failCallback);
                        }
                    });
                }
            },
            onerror: err => { if (typeof failCallback === 'function') failCallback(); }
        });
    }
    
    function findOrCreateFolderAndMove(fid, actorName, successCallback, failCallback) {
        let cid = archiveRootCid || ROOT_DIR_CID;
        actorName = stringStandard(actorName);
        
        $.get("https://webapi.115.com/files", { aid: 1, cid: cid, limit: 1000, offset: 0, show_dir: 1, format: "json" }, function(listData) {
            let listResult = typeof listData === 'string' ? JSON.parse(listData) : listData;
            let targetCid = null;
            if (listResult.state && listResult.data) {
                listResult.data.some(function(item) {
                    let isFolder = item.is_dir || (item.m === 0 && item.cid && !item.fid);
                    let folderName = item.n || item.name;
                    if (isFolder && folderName === actorName) { targetCid = item.cid; return true; }
                    return false;
                });
            }
            if (targetCid) {
                moveFileToFolder(fid, targetCid, actorName, successCallback, failCallback);
            } else {
                $.post("https://webapi.115.com/files/add", { pid: cid, cname: actorName }, function(createData) {
                    let createResult = typeof createData === 'string' ? JSON.parse(createData) : createData;
                    if (createResult.state) {
                        moveFileToFolder(fid, createResult.cid, actorName, successCallback, failCallback);
                    } else if (createResult.errno === 20004) {
                        if (typeof successCallback === 'function') successCallback();
                    } else {
                        if (typeof failCallback === 'function') failCallback();
                    }
                });
            }
        });
    }
    
    function moveFileToFolder(fid, targetCid, actorName, successCallback, failCallback) {
        $.post("https://webapi.115.com/files/move", { pid: targetCid, fid: fid }, function(data) {
            let result = typeof data === 'string' ? JSON.parse(data) : data;
            if (result.state) {
                showPageNotification(`文件成功归档到 ${actorName}`, 'success', 2000);
                if (typeof successCallback === 'function') successCallback();
            } else {
                if (typeof failCallback === 'function') failCallback();
            }
        });
    }

    function getJavdbRating() {
        let $iframeContents = $("iframe[rel='wangpan']").contents();
        let $selectedItems = $iframeContents.find("li.selected");
        let selectedCount = $selectedItems.length;
        
        if(selectedCount === 0) return;
        let processedCount = 0; let successCount = 0;
        showPageNotification(`开始处理 ${selectedCount} 个项目的评分...`, 'info', 3000);
        
        $selectedItems.each(function (index, v) {
            let $item = $(v);
            let file_name = $item.attr("title");
            let file_type = $item.attr("file_type");
            let fid = file_type === "0" ? $item.attr("cate_id") : $item.attr("file_id");

            if (fid && file_name) {
                let vInfo = parseVideoInfo(file_name);
                if (vInfo && vInfo.queryCode) {
                    requestJavdbRating(fid, vInfo.queryCode, file_name, function(success) {
                        processedCount++; if (success) successCount++;
                        if (processedCount === selectedCount) showPageNotification(`评分处理完成: ${successCount}成功`, 'success', 5000);
                    });
                } else processedCount++;
            } else processedCount++;
        });
    }
    
    function requestJavdbRating(fid, queryCode, file_name, callback) {
        GM_xmlhttpRequest({
            method: "GET", url: javdbSearchBase + queryCode + "&f=all", timeout: 10000,
            onload: xhr => {
                if (xhr.status === 200) {
                    const parser = new DOMParser(); const doc = parser.parseFromString(xhr.responseText, "text/html");
                    
                    if (doc.querySelector('.video-detail')) {
                        let text = doc.body.textContent;
                        let scoreMatch = text.match(/(\d+\.\d+)分/);
                        if (scoreMatch) {
                            update115Rating(fid, Math.round(parseFloat(scoreMatch[1])), queryCode, file_name, callback); 
                            return;
                        }
                    }
                    
                    const firstItem = doc.querySelector('.movie-list .item');
                    if (firstItem) {
                        const scoreAttr = firstItem.getAttribute('score');
                        if (scoreAttr) {
                            update115Rating(fid, Math.round(parseFloat(scoreAttr)), queryCode, file_name, callback); return;
                        }
                    }
                    callback(false);
                } else callback(false);
            },
            onerror: () => callback(false)
        });
    }
    
    function update115Rating(fid, star, queryCode, file_name, callback) {
        star = Math.max(1, Math.min(5, star));
        $.ajax({
            url: "https://webapi.115.com/files/score", type: "POST", data: { file_id: fid, score: star }, dataType: "json",
            success: function(result) {
                if (result && result.state) { showPageNotification(`"${queryCode}"评分更新为${star}星`, 'success', 2000); callback(true); }
                else callback(false);
            },
            error: () => callback(false)
        });
    }
})();
