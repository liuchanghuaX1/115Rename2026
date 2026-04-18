// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         1.2.0
// @description     115网盘视频整理：本地加工与网络改名双轨分离。新增T28等数字混合厂牌支持、根治01前缀与重复番号、彻底免疫空格日期/广告干扰、规范化TokyoHot/1pondo。已知问题：暂不支持JavDB刮削与FC2网站改名。
// @author          sonarlee
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @domain          javbus.com
// @domain          avmoo.host
// @domain          avsox.host
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

    // ==========================================
    // 模块二：超级清洗字典与算法库
    // ==========================================
    
    const GARBAGE_WORDS = [
        'WWW','CARIBBEAN','TOKYOHOT','HEYDOUGA','UNCENSORED','LEAK','LEAKED',
        '2160P','1440P','1080P','720P','480P',
        'FHD','HD','SD','X264','X265','H264','H265','HEVC','AVC',
        'AAC','AC3','DTS','FLAC','MP3','CHS','CHT','BIG5','GB','SC',
        'MP4','MKV','AVI','WMV','M4V','RMVB','ISO','TS',
        'UNC','CEN','NO','WATERMARK','RARBG','BT','WEB-DL','WEBRIP','BLURAY','BDREMUX'
    ];
    const GARBAGE_REGEX = new RegExp('\\b(' + GARBAGE_WORDS.join('|') + ')\\b', 'gi');
    
    const MARKER_REGEX = /(4K|8K|60fps|120fps|破解|流出|無修正|无码|中字|字幕|中文字幕)/gi;

    const CODE_PREFIXES = [
        'T28', 'S2M', '300MAAN', '200GANA', '259LUXU', '277DCV', '230GANA', '261ADA', // 增加带数字的常见厂牌
        'DASS', 'REBD', 'REBDB', 
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

    function parseVideoInfo(origTitle) {
        if (!origTitle) return null;
        let raw = String(origTitle);
        let rawNoExt = raw.replace(/\.\w{2,5}$/, '');

        rawNoExt = rawNoExt.replace(/^.*?[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}(?:\/.*?)?@/i, ''); 

        let markers = [];
        let mMatch;
        while ((mMatch = MARKER_REGEX.exec(rawNoExt)) !== null) {
            let m = mMatch[1].toUpperCase().replace(/^[-_ ]/, '');
            if(m === '無修正') m = '无码';
            if(m === '中字' || m === '字幕' || m === '中文字幕') m = '中文字幕';
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
    // 模块三：本地改名与网络刮削双轨处理
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
        
        if (dateStr) {
            name += '_' + dateStr;
        }
        
        if (suffix) name += suffix;
        return stringStandard(name);
    }

    function rename_multi(fid, vInfo, suffix, addDate, callback) {
        requestMultiSource(fid, vInfo, suffix, addDate, callback, "javbus");
    }
    
    function requestMultiSource(fid, vInfo, suffix, addDate, callback, source) {
        if (source === "javbus") {
            requestJavbus(fid, vInfo, suffix, addDate, javbusDirectAccess, function() {
                if (typeof callback === 'function') callback();
            }, 0, function() {
                showPageNotification(`无法在所有网站找到"${vInfo.queryCode}"的信息`, 'error', 3000);
                if (typeof callback === 'function') callback();
            });
        }
    }

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
        showPageNotification(`该功能在当前版本暂不支持`, 'info', 3000);
    }
    function getJavdbRating() {
        showPageNotification(`获取javdb评分功能在当前版本暂不支持`, 'info', 3000);
    }

})();
