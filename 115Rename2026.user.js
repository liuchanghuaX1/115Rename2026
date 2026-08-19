// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         2.2.1
// @description     115视频整理：FC2变体｜无码识别｜冷门番号｜演员性别优先｜多站刮削｜翻译｜归档｜评分｜完整功能
// @author          sonarlee
// @include         https://115.com/*
// @icon            https://115.com/favicon.ico
// @domain          javbus.com
// @domain          javlibrary.com
// @domain          xslist.org
// @domain          javdb.com
// @domain          fc2ppvdb.com
// @domain          avsox.host
// @domain          avmoo.host
// @connect         javbus.com
// @connect         javlibrary.com
// @connect         xslist.org
// @connect         javdb.com
// @connect         webapi.115.com
// @connect         fc2ppvdb.com
// @connect         client-rapi-missav.recombee.com
// @connect         oneshot-free.www.deepl.com
// @connect         api.mymemory.translated.net
// @connect         avsox.host
// @connect         avmoo.host
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

    // ========================================================================
    // 1. UI 初始化
    // ========================================================================
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
    const negativeCache = JSON.parse(GM_getValue('jb_negativeCache', '{}'));
    const folderCidCache = {};

    const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
    const NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    const isInfoCacheValid = (code) => {
        const e = infoCache[code];
        if (!e) return false;
        if (!e.cachedAt) return true;
        return (Date.now() - Number(e.cachedAt)) < CACHE_TTL_MS;
    };
    const storeInfo = (key, info) => { if (info) info.cachedAt = Date.now(); infoCache[key] = info; };
    const isNegativeCached = (code) => {
        const e = negativeCache[code];
        if (!e || !e.cachedAt) return false;
        return (Date.now() - Number(e.cachedAt)) < NEGATIVE_CACHE_TTL_MS;
    };
    const markNegativeCached = (code) => { negativeCache[code] = { cachedAt: Date.now() }; };

    // ========================================================================
    // 2. 工具函数
    // ========================================================================
    const stripFileExt = (name) => { const s = String(name || ''); const idx = s.lastIndexOf('.'); return idx > 0 ? s.slice(0, idx) : s; };
    const escapeRegExp = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizePartToken = (p) => {
        const s = String(p == null ? '' : p);
        if (/^\d+$/.test(s)) {
            const v = parseInt(s, 10);
            if (v >= 1 && v <= 999) return String(v);
        }
        return s;
    };
    const normalize115Name = (n) => {
        if (!n) return '';
        let s = String(n);
        try { s = s.normalize('NFKC'); } catch (e) { }
        s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u180E\u2028\u2029]/g, '');
        s = s.replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
        s = s.replace(/[\u2010-\u2015\u2212\u30FC]+/g, '-');
        s = s.replace(/[\u30FB\u00B7\u2022]/g, '·');
        s = s.replace(/[\uFF0C\u3001]/g, '，').replace(/[\uFF0E\u3002]/g, '。');
        s = s.replace(/[\uFF08]/g, '（').replace(/[\uFF09]/g, '）');
        s = s.replace(/[\u3010]/g, '【').replace(/[\u3011]/g, '】');
        s = s.replace(/[\u300C]/g, '「').replace(/[\u300D]/g, '」');
        s = s.replace(/[\u300E]/g, '『').replace(/[\u300F]/g, '』');
        s = s.replace(/[\\\/:?"<>|*]/g, ' ');
        return s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    };
    const normalizeFolderName = (name) => {
        if (!name) return '';
        let s = normalize115Name(String(name));
        s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064\u180E\u2028\u2029]/g, '');
        s = s.replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/[\uFF41-\uFF5A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/[\uFF10-\uFF19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/\uFF0C/g, ',').replace(/\u3001/g, ',');
        s = s.replace(/\uFF0E/g, '.').replace(/\u3002/g, '.');
        s = s.replace(/\uFF1A/g, ':').replace(/\uFF1B/g, ';');
        s = s.replace(/\uFF01/g, '!').replace(/\uFF1F/g, '?');
        s = s.replace(/\uFF08/g, '(').replace(/\uFF09/g, ')');
        s = s.replace(/\u3010/g, '[').replace(/\u3011/g, ']');
        s = s.replace(/\u300C/g, '「').replace(/\u300D/g, '」');
        s = s.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
        s = s.replace(/\u201C/g, '"').replace(/\u201D/g, '"');
        s = s.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
        s = s.replace(/\u30FB/g, '·');
        return s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    };
    const folderNameKey = (n) => {
        if (!n) return '';
        return normalize115Name(n)
            .toLowerCase()
            .replace(/[\s\-_·・.,，。()（）\[\]【】「」『』]+/g, '')
            .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/g, '');
    };
    const getCodeQueryVariants = (code) => {
        const variants = [String(code || '')];
        const noDash = String(code || '').replace(/-/g, '');
        if (noDash !== code) variants.push(noDash);
        const m = String(code || '').match(/^([A-Z]+)-(\d+)$/);
        if (m) {
            const prefix = m[1], numRaw = m[2];
            const num = String(parseInt(numRaw, 10));
            if (num !== numRaw) variants.push(prefix + '-' + num);
            variants.push(prefix + num);
            variants.push(prefix + ' ' + num);
            variants.push(prefix + '_' + num);
        }
        return [...new Set(variants)];
    };

    // ========================================================================
    // 3. 女优别名映射表（精简常用）
    // ========================================================================
    const actressAliasMap = {
        '三上悠亜': '三上悠亚', 'Mikami Yua': '三上悠亚',
        '深田えいみ': '深田咏美', 'Fukada Eimi': '深田咏美',
        '天使もえ': '天使萌', 'Amatsuka Moe': '天使萌',
        '桃乃木かな': '桃乃木香奈', 'Momonogi Kana': '桃乃木香奈',
        '凪ひかる': '凪光', 'Nagi Hikaru': '凪光',
        '坂道みる': '坂道美琉', 'Sakamichi Miru': '坂道美琉',
        '高橋しょう子': '高桥圣子', 'Takahashi Shoko': '高桥圣子',
        '河北彩花': '河北彩花', 'Kawakita Saika': '河北彩花',
        '松本いちか': '松本一香', 'Matsumoto Ichika': '松本一香',
        '桜空もも': '樱空桃', 'Sakura Momo': '樱空桃',
        '涼森れむ': '凉森玲梦', 'Suzumori Remu': '凉森玲梦',
        '北野未奈': '北野未奈', 'Kitano Mina': '北野未奈',
        '美谷朱里': '美谷朱里', 'Mitani Akari': '美谷朱里',
        '七沢みあ': '七泽米亚', 'Nanasawa Mia': '七泽米亚',
        '宮下玲奈': '宫下玲奈', 'Miyashita Rena': '宫下玲奈',
        '紗倉まな': '纱仓真菜', 'Sakura Mana': '纱仓真菜',
        '本庄鈴': '本庄铃', 'Honjou Suzu': '本庄铃',
        '西宮ゆめ': '西宫梦', 'Nishimiya Yume': '西宫梦',
        '鈴木真夕': '铃木真夕', 'Suzuki Mayu': '铃木真夕',
        '古川いおり': '古川伊织', 'Furukawa Iori': '古川伊织',
        '葵司': '葵司', 'Aoi Tsukasa': '葵司',
        '波多野結衣': '波多野结衣', 'Hatano Yui': '波多野结衣',
        '小倉奈々': '小仓奈奈', 'Ogura Nana': '小仓奈奈',
        '鈴木心春': '铃木心春', 'Suzuki Koharu': '铃木心春',
        '八掛うみ': '八挂海', 'Yakeno Umi': '八挂海',
        '横宮七海': '横宫七海', 'Yokomiya Nanami': '横宫七海',
        '八木奈々': '八木奈奈', 'Yagi Nana': '八木奈奈',
        '安齋らら': '安斋拉拉', 'Anzai Rara': '安斋拉拉',
        '橋本ありな': '桥本有菜', 'Hashimoto Arina': '桥本有菜',
        '三宮つばき': '三宫椿', 'Sannomiya Tsubaki': '三宫椿',
        '山手梨愛': '山手梨爱', 'Yamamate Ria': '山手梨爱',
        '神宮寺ナオ': '神宫寺奈绪', 'Jinguji Nao': '神宫寺奈绪',
        '小倉由菜': '小仓由菜', 'Ogura Yuna': '小仓由菜',
        '七瀬アリス': '七濑爱丽丝', 'Nanase Alice': '七濑爱丽丝',
        '沖田杏梨': '冲田杏梨', 'Okita Anri': '冲田杏梨',
        '白石茉莉奈': '白石茉莉奈', 'Shiraishi Marina': '白石茉莉奈',
        '大槻ひびき': '大槻响', 'Otsuki Hibiki': '大槻响',
        '友田彩也香': '友田彩也香', 'Tomoda Ayaka': '友田彩也香',
        '希崎ジェシカ': '希崎杰西卡', 'Kizaki Jessica': '希崎杰西卡',
        '希岛あいり': '希岛爱理', 'Kijima Airi': '希岛爱理',
        '小湊よつ葉': '小凑四叶', 'Kominato Yotsuha': '小凑四叶',
        '奥田咲': '奥田咲', 'Okuda Saki': '奥田咲',
        '推川ゆうり': '推川悠里', 'Oshikawa Yuuri': '推川悠里',
        '伊藤舞雪': '伊藤舞雪', 'Ito Miyuki': '伊藤舞雪',
        '美谷朱音': '美谷朱音', 'Mitani Akane': '美谷朱音',
        '天海つばさ': '天海翼', 'Amami Tsubasa': '天海翼',
        '初川みなみ': '初川南', 'Hatsukawa Minami': '初川南',
        '浜崎真緒': '滨崎真绪', 'Hamasaki Mao': '滨崎真绪',
        '上原亜衣': '上原亚衣', 'Uehara Ai': '上原亚衣',
        '彩美旬果': '彩美旬果', 'Ayami Shunka': '彩美旬果',
        '大橋未久': '大桥未久', 'Ohashi Mihuku': '大桥未久',
        '吉沢明歩': '吉泽明步', 'Yoshizawa Akiho': '吉泽明步',
        '蒼井そら': '苍井空', 'Sora Aoi': '苍井空',
        '小澤マリア': '小泽玛利亚', 'Ozawa Maria': '小泽玛利亚',
        'JULIA': 'JULIA', 'AIKA': 'AIKA', 'RION': 'RION',
        'Rio': 'Rio', 'Momo': 'Momo',
    };

    const getStandardActressName = (name) => {
        if (!name) return name;
        const n = normalizeFolderName(String(name));
        if (!n) return n;
        if (actressAliasMap[n]) return actressAliasMap[n];
        return n;
    };

    const isPlausibleActressToken = (name) => {
        if (!name) return false;
        let n = normalizeFolderName(String(name));
        n = n.replace(/[\[\]【】()（）{}<>《》「」『』]/g, '').trim();
        if (!n) return false;
        const key = folderNameKey(n);
        if (key.length < 2 || key.length > 24) return false;
        if (/^(有码|有碼|无码|無碼|欧美|歐美|动漫|動漫|系列|片商|演員|演员|女优|女優|中文字幕|字幕|高清|無修正|无修正|合集|整理|未整理|已整理)$/.test(n)) return false;
        if (/^(女优归档|女優归档|女優歸檔|女优歸檔)[-_]?\d*$/i.test(n)) return false;
        if (/^(番号归档|番號归档|番号歸檔|番號歸檔)(?:[-_][A-Z0-9]+)?$/i.test(n)) return false;
        if (/[!！?？~〜～]/.test(n)) return false;
        if (/(AV女優|AV女优|新人AV|新人|中出し|中出|生中出|無修正|无码|高清|中文字幕|素人|人妻|限定|企画|シリーズ|NTR)/i.test(n)) return false;
        return true;
    };

    // ========================================================================
    // 4. 任务控制
    // ========================================================================
    window.renameInProgress = false;

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
                if (window.progressBox && window.progressBox.paused) { setTimeout(next, 500); return; }
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
            this.total = total || 0; this.current = 0; this.title = title || '任务进度'; this.paused = false;
            let $box = $('#task-progress-box');
            if ($box.length === 0) {
                $('body').append(`<div id="task-progress-box" style="display:none;"><div style="display:flex;align-items:center;gap:8px;"><button id="tp-pause-btn" style="width:22px;height:22px;line-height:1;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;font-size:11px;padding:0;">⏸</button><div class="tp-title"></div></div><div class="tp-bar-outer"><div class="tp-bar-inner"></div></div><div class="tp-text"></div></div>`);
                $box = $('#task-progress-box');
                $('#tp-pause-btn').on('click', function () {
                    window.progressBox.paused = !window.progressBox.paused;
                    $(this).text(window.progressBox.paused ? '▶️' : '⏸');
                    window.showPageNotification(window.progressBox.paused ? '任务已暂停' : '任务已继续', 'info', 2000);
                });
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
        finish() { this.paused = false; this.update(this.total); setTimeout(() => $('#task-progress-box').fadeOut(300), 800); }
    };

    // ========================================================================
    // 5. Toast 通知
    // ========================================================================
    const toastQueue = [];
    let toastActive = 0;
    const TOAST_MAX = 3;
    const flushToastQueue = () => { if (toastQueue.length && toastActive < TOAST_MAX) toastQueue.shift()(); };
    window.showPageNotification = (message, type = 'info', duration) => {
        if (!duration) duration = type === 'error' ? 5000 : 3000;
        const show = () => {
            toastActive++;
            const id = 'cn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            $('body').append(`<div id="${id}" class="custom-notification ${type}">${message}</div>`);
            const $el = $(`#${id}`);
            setTimeout(() => $el.addClass('show'), 10);
            setTimeout(() => {
                $el.removeClass('show');
                setTimeout(() => { $el.remove(); toastActive--; flushToastQueue(); }, 300);
            }, duration);
        };
        if (toastActive >= TOAST_MAX) { toastQueue.push(show); return; }
        show();
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

    // ========================================================================
    // 6. 菜单定义
    // ========================================================================
    const rename_list = `
        <li id="rename_list">
            <a id="local_code_process" class="mark" href="javascript:;">本地番号加工</a>
            <a id="rename_all_multi_date" class="mark" href="javascript:;">改名(多网站轮询)</a>
            <a id="rename_all_multi_zh" class="mark" href="javascript:;">改名(中文翻译)</a>
            <a id="archive_to_folder" class="mark" href="javascript:;">归档至文件夹</a>
            <a id="archive_to_bucket" class="mark" href="javascript:;">分桶归档(番号前缀数字段)</a>
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

    // ========================================================================
    // 7. 广告与标记清理
    // ========================================================================
    const stripDomainPrefix = (filename) => {
        const idx = filename.lastIndexOf('@');
        return idx === -1 ? filename : filename.substring(idx + 1).trim();
    };

    const getSafeSuffix = (filename) => {
        const m = filename.match(/\.([a-z0-9]{2,5})$/i);
        if (m && !/^\d+$/.test(m[1])) return m[0];
        return '';
    };

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

    // ========================================================================
    // 8. 番号前缀库（含自动扩展双字母和单字母）
    // ========================================================================
    let CODE_PREFIXES = [
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
        'SONE', 'START', 'ABF', 'HMN', 'JUQ', 'JUR', 'WAAA', 'DLDSS', 'CAWD', 'MKMP',
        'MISM', 'MVSD', 'NNPJ', 'PPPE', 'SDAM', 'SDJS', 'SDMF', 'SDMM', 'TYSF', 'UMD',
        'VENX', 'YUJ', 'FERA', 'BKD', 'BIJN', 'AARM', 'NHDTB', 'JUFD', 'JUTN', 'JRZE',
        'KSBJ', 'MIMK', 'MDBK', 'SAME', 'SDHS', 'STSK', 'MIAB', 'MDON', 'MKON', 'BONY',
        'FNEO', 'OFKU', 'MUKC', 'SUKE', 'NIMA', 'AMBI', 'ARAN', 'EBWH', 'FPRE', 'GVH',
        'HJMO', 'HOKS', 'IENF', 'JUNY', 'KANO', 'KBMS', 'KIT', 'KMHR', 'KTRA', 'LULU',
        'MCT', 'MMUS', 'MRSS', 'NACR', 'NKKD', 'OKS', 'ONEX', 'PED', 'ROE', 'RKI',
        'SILK', 'SPLY', 'SQTE', 'SUPA', 'VEC', 'VENZ', 'YOCH',
        '3DSVR', 'DSVR', 'MDVR', 'IPVR', 'KMVR', 'ATVR', 'PRVR', 'SAVR', 'CAVR', 'VRKM', 'SLVR',
        'GOPJ', 'HEYZO', '1PONDO', 'CARIB', 'CARIBBEAN', 'PACO', 'PACOPACOMAMA',
        'TOKYO-HOT', 'TOKYOHOT', '10MU', '10MUSUME', '1000GIRI', 'MURA', 'H4610', 'NAMA',
        'STZY', 'KIDM', 'ACHJ'
    ];

    // 自动扩展双字母和单字母
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
        for (let j = 0; j < 26; j++) {
            const prefix = letters[i] + letters[j];
            if (!GARBAGE_WORDS.includes(prefix) && !CODE_PREFIXES.includes(prefix)) {
                CODE_PREFIXES.push(prefix);
            }
        }
    }
    for (let i = 0; i < 26; i++) {
        const prefix = letters[i];
        if (!GARBAGE_WORDS.includes(prefix) && !CODE_PREFIXES.includes(prefix)) {
            CODE_PREFIXES.push(prefix);
        }
    }
    CODE_PREFIXES.sort((a, b) => b.length - a.length);

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

    // ========================================================================
    // 9. FC2 提取与无码检测（增强）
    // ========================================================================
    const extractFC2Code = (str) => {
        const patterns = [
            /\bfc2ppv[-_\s]*(\d{5,8})\b/i,
            /\bfc\s*(\d{5,8})(?=[-_\s]?\d{1,3})?/i,
            /\bfc2?[-_\s]*(\d{5,8})\b/i,
            /\bFC2[\s_-]*PPV[\s_-]*(\d{5,8})\b/i,
            /\bFC2PPV[\s_-]*(\d{5,8})\b/i,
            /\bFC2[\s_-]+(\d{5,8})\b/i,
            /\bFC2(\d{5,8})\b/i,
            /\bPPV[\s_-]*(\d{5,8})\b/i,
            /\bF[\s_-]*(\d{5,8})\b(?!\d)/i,
        ];
        for (const regex of patterns) {
            const m = str.match(regex);
            if (m && m[1] && !/^(?:HD|FHD|SD|X264|X265|H264|H265|HEVC|AVC|AAC|AC3|DTS|FLAC|MP3|MP4|MKV|AVI|WMV|M4V|RMVB|ISO|TS|WATERMARK|RARBG|WEB-DL|WEBRIP|BLURAY|BDREMUX|1440P|1080P|720P|480P)$/i.test(m[1])) {
                return 'FC2-PPV-' + m[1];
            }
        }
        return null;
    };

    // 无码检测（扩展：支持东京热、一本道、加勒比等）
    const checkUncensored = (fh, title) => {
        // 关键词检测
        if (/无码|無修正|uncensored/i.test(title)) return true;
        // 番号模式检测
        const uncensoredPatterns = [
            /^Tokyo-Hot-/i, /^TOKYO-HOT-/i, /^1PONDO-/i, /^CARIB-/i,
            /^HEYZO-/i, /^10MU-/i, /^MURA-/i, /^H4610-/i, /^NAMA-/i
        ];
        for (let pat of uncensoredPatterns) {
            if (pat.test(fh)) return true;
        }
        // 后缀标记检测
        const reg = new RegExp(fh.replace(/-/g, '[-_]?') + "[_-](UC|U)");
        return reg.test(title.toUpperCase());
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

    // ========================================================================
    // 10. 压缩番号识别
    // ========================================================================
    const normalizeExplicitCensoredCode = (prefix, digits) => {
        if (!prefix || !digits) return null;
        const p = String(prefix).toUpperCase().replace(/[^A-Z0-9]/g, '');
        let dRaw = String(digits).replace(/\D/g, '');
        if (!p || !dRaw) return null;
        let d = dRaw;
        if (dRaw.length <= 5) {
            d = String(Number(dRaw));
            if (d === '0') d = '0';
            d = d.padStart(3, '0');
        } else if (/^0+\d/.test(dRaw)) {
            d = dRaw.replace(/^0+/, '') || dRaw;
        }
        return p + '-' + d;
    };

    const extractSitePrefixedCodeFromName = (name) => {
        if (!name) return null;
        let s = String(name);
        s = s.replace(/(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\.[a-z]{2,})?@/gi, '');
        s = s.replace(/[a-z0-9]+\.com@/gi, '');
        s = s.replace(/[a-z0-9]+@/gi, '');
        const base = stripFileExt(s).toUpperCase();
        const paren = base.match(/[（(]([^（）()]{4,40})[）)]/);
        const scan = paren ? paren[1] : base;
        const m = String(scan).match(/(?:^|[^A-Z0-9])(\d{1,4})([A-Z]{2,10})(\d{3,8})(?=$|[^A-Z0-9])/i);
        if (m) {
            const letters = m[2];
            if (/^(HD|FHD|UHD|SD|FPS|CD|PART|DISC|DISK|DVD)$/i.test(letters)) return null;
            const fullPrefix = (m[1] + letters).toUpperCase();
            if (CODE_PREFIXES.includes(fullPrefix)) return null;
            if (/^(1PONDO|CARIB|CARIBBEAN|PACO|PACOPACOMAMA|HEYDOUGA|TOKYOHOT|HEYZO|10MU|10MUSUME|1000GIRI|MURA|H4610|NAMA)$/i.test(fullPrefix)) return null;
            return { code: normalizeExplicitCensoredCode(letters, m[3]), rawMatch: m[0] };
        }
        return null;
    };

    // ========================================================================
    // 11. 分段信息提取
    // ========================================================================
    const extractPartInfoFromFileName = (fileName, code) => {
        if (!fileName) return '';
        const base = stripDomainPrefix(stripFileExt(fileName)).replace(/^h[_\-. ]*\d{2,5}[_\-. ]*/i, '');
        let U = base.toUpperCase();
        U = U.replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        U = U.replace(/[\uFF41-\uFF5A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).toUpperCase();
        U = U.replace(/[\uFF10-\uFF19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        U = U.replace(/[\u2013\u2014\u2212\uFF0D]/g, '-').replace(/[\uFF3F]/g, '_').replace(/[\u3000]/g, ' ');

        const numLabel = n => { const v = parseInt(n, 10); return (v >= 1 && v <= 99) ? String(v) : ''; };
        const letterLabel = ch => { ch = String(ch || '').toUpperCase(); return /^[A-D]$/.test(ch) ? ch : ''; };

        // 上/下/前/后
        const zhTail = base.match(/(?:^|[\s._\-\[\(【（])((?:上|下|前|後|后)(?:集|部|篇|編|编|段)?)(?:$|[\s._\-\]\)】）])/);
        if (zhTail) {
            const v = zhTail[1];
            if (/上|前/.test(v)) return '1';
            if (/下|後|后/.test(v)) return '2';
        }

        // 下载站后缀
        let m = U.match(/(?:^|[\s._\-])(?:HHB|HHC|HHD|HHH)0*([1-9]\d?)(?:$|[\s._\-])/);
        if (m) return numLabel(m[1]);
        m = U.match(/(?:4K|8K|HD|FHD|1080P|720P)[\s._\-]*S0*([1-9]\d?)(?:$|[\s._\-])/);
        if (m) return numLabel(m[1]);
        m = U.match(/(?:4K|8K|UHD|HD|FHD|1080P|720P)?[\s._\-]*(?:60|30)FPS0*([1-9]\d?)(?:$|[\s._\-])/);
        if (m) return numLabel(m[1]);

        // 明确分段词
        const tailZone = U.slice(Math.max(0, U.length - 96));
        m = tailZone.match(/(?:^|[\s._\-\[\(【（])(?:CD|DISC|DISK|DVD|PART|PT|P|VOL|VOLUME|EP|EPISODE)[\s._\-]*0*([1-9]\d?)[\s._\-\]\)】）]*$/);
        if (m) return numLabel(m[1]);

        // SP/SPECIAL
        let spMatch = U.match(/(?:^|[\s._\-\[\(【（])(SP|SPECIAL)[\s._-]*(\d{1,3})?(?=$|[\s._\-\)】）])/i);
        if (spMatch) {
            if (spMatch[2]) return numLabel(spMatch[2]);
            else return 'SP';
        }

        // 1of2
        m = tailZone.match(/(?:^|[\s._\-])0*([1-9]\d?)\s*(?:OF|\/|／|-)\s*0*([1-9]\d?)(?:$|[\s._\-])/);
        if (m && parseInt(m[2], 10) > 1) return numLabel(m[1]);

        // 番号后紧贴分段
        if (code) {
            const codeStr = String(code).toUpperCase();
            const parts = codeStr.split('-');
            const prefix = parts[0] || '', numRaw = parts[1] || '';
            const num = numRaw.replace(/^0+/, '') || numRaw;
            if (prefix && num) {
                const codeRe = new RegExp('(?:^|[^A-Z0-9])' + escapeRegExp(prefix) + '[\\s._-]*0*' + escapeRegExp(num) + '(?=$|[^A-Z0-9])', 'i');
                const cm = U.match(codeRe);
                if (cm && typeof cm.index === 'number') {
                    const after = U.slice(cm.index + cm[0].length);
                    let mm = after.match(/^[\s._-]*([A-D])(?=$|[\s._\-\]\)】）])/);
                    if (mm) return letterLabel(mm[1]);
                    mm = after.match(/^[\s._-]+(?:CD|DISC|DISK|DVD|PART|PT|P|VOL|VOLUME|EP|EPISODE)[\s._-]*0*([1-9]\d?)(?=$|[\s._\-\]\)】）])/);
                    if (mm) return numLabel(mm[1]);
                    mm = after.match(/^[\s._-]+(\d{1,3})(?=$|[\s._\-\]\)】）])/);
                    if (mm) { const v = parseInt(mm[1], 10); if (v >= 1 && v <= 999) return mm[1]; }
                }
            }
        }
        return '';
    };

    // ========================================================================
    // 12. 手动命名保护
    // ========================================================================
    const isRawDownloadSiteName = (fileName) => {
        const base = stripFileExt(String(fileName || '')).replace(/\s+/g, '').toLowerCase();
        if (!base) return false;
        if (/^(?:[a-z0-9.-]+@)?h_\d+[a-z]{2,10}\d{2,6}(?:ex)?(?:hh[bcdh])?\d*(?:[_-]?(?:4k|4ks|4k60fps|60fps|1080p|720p|fhd|hd))?\d*$/.test(base)) return true;
        if (/^(?:[a-z0-9.-]+@)?[a-z]{2,10}\d{2,6}(?:ex)?hh[bcdh]\d*(?:[_-]?(?:4k|4ks|4k60fps|60fps|1080p|720p|fhd|hd))?\d*$/.test(base)) return true;
        if (/^(?:[a-z0-9.-]+@)?\d{1,4}[a-z]{2,10}\d{2,8}v(?:[_-]?(?:4k|4ks|4k60fps|60fps|1080p|720p|fhd|hd))?\d*$/.test(base)) return true;
        if (/^(?:hhd800\.com@|www\.98t\.la@)/i.test(String(fileName))) return true;
        return false;
    };

    const hasManualNamePayload = (fileName, code) => {
        if (!fileName || !code) return false;
        if (isRawDownloadSiteName(fileName)) return false;
        let base = normalizeFolderName(stripFileExt(fileName));
        if (!base) return false;

        const codeStr = String(code).toUpperCase();
        const prefix = codeStr.split('-')[0] || '';
        const numPadded = codeStr.split('-')[1] || '';
        const num = numPadded.replace(/^0+/, '') || numPadded;
        const variants = [codeStr, codeStr.replace(/-/g, '')];
        if (prefix && num) variants.push(prefix + '-' + num, prefix + '_' + num, prefix + ' ' + num, prefix + num);
        if (prefix && numPadded) variants.push(prefix + '-' + numPadded, prefix + '_' + numPadded, prefix + ' ' + numPadded, prefix + numPadded);
        variants.forEach(v => {
            if (!v) return;
            base = base.replace(new RegExp(escapeRegExp(v).replace(/[-_\s]+/g, '[-_\\s]*'), 'ig'), ' ');
        });

        base = base.replace(/https?:\/\/\S+/ig, ' ');
        base = base.replace(/\b(?:www|com|net|org|cc|tv|xyz|me|la|to|info)\b/ig, ' ');
        base = base.replace(/\b(?:javdb|javbus|javlibrary|dmm|fanza|r18|torrent|magnet|bt|rarbg|thz|u3c3|sis001|sex8|98t|gg5|avsox|avmoo)\b/ig, ' ');
        base = base.replace(/\b(?:4k|8k|2160p|1440p|1080p|720p|480p|fhd|hd|sd|x264|x265|h264|h265|hevc|avc|aac|ac3|flac|mp3|web-?dl|webrip|bluray|bdremux|60fps|30fps)\b/ig, ' ');
        base = base.replace(/\b(?:chinese|subtitle|subbed|sub|chs|cht|big5|gb|unc|censored|uncensored|leak|leaked|no[-_ ]?watermark|watermark)\b/ig, ' ');
        base = base.replace(/\b(?:hhb|hhc|hhd|hhh)\d*\b/ig, ' ');
        base = base.replace(/\b(?:cd|part|disc|disk)[-_ ]?\d+\b/ig, ' ');
        base = base.replace(/\b(?:mp4|mkv|avi|rmvb|wmv|flv|mov|mpeg|mpg|ts|m4v|webm)\b/ig, ' ');
        base = base.replace(/[\[\]【】()（）{}<>《》「」『』._,，。+~!@#$%^&;:=、\/\|]+/g, ' ');
        base = base.replace(/[-\s]+/g, ' ').trim();

        if (!base) return false;
        base = base.replace(/中文字幕|無修正|无码|流出|破解|中字|字幕|高清|無碼/g, ' ').replace(/\s+/g, ' ').trim();
        if (!base) return false;
        if (/[぀-ヿ㐀-鿿]/.test(base)) return true;
        const asciiWords = (base.match(/[A-Za-z]{3,}/g) || []).filter(w => !/^(the|and|for|with|you|your|her|his|new|hot|sex|jav|av)$/i.test(w));
        const asciiLen = asciiWords.join('').length;
        return asciiWords.length >= 2 || asciiLen >= 10;
    };

    // ========================================================================
    // 13. 核心解析（全面增强）
    // ========================================================================
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

            let queryCode = null, displayCode = null, part = '';

            // ---- 东京热特殊处理（无码） ----
            const thMatch = rawForCode.match(/Tokyo[\s_-]*Hot[\s_-]*[nN]?(\d{3,4})/i);
            if (thMatch) {
                const num = thMatch[1].padStart(4, '0');
                queryCode = `Tokyo-Hot-n${num}`;
                displayCode = queryCode;
                if (!markers.includes('无码')) markers.push('无码');
            }
            // ---- 一本道等无码系列 ----
            else {
                const fc2Code = extractFC2Code(rawForCode) || extractFC2Code(t);
                if (fc2Code) {
                    queryCode = fc2Code;
                    displayCode = fc2Code;
                    const fc2Num = fc2Code.match(/\d+$/)[0];
                    rawForCode = rawForCode.replace(
                        new RegExp(`(?:^|\\s)fc2?ppv?[\\s_-]*(?:ppv[\\s_-]*)?0*${fc2Num}(?:[-_\\s]?\\d{1,3})?`, 'i'),
                        ' '
                    ).trim();
                    const partMatch = rawForCode.match(/[-_](\d{1,3})(?:\s|$)/);
                    if (partMatch) {
                        part = normalizePartToken(partMatch[1]);
                        rawForCode = rawForCode.replace(partMatch[0], ' ').trim();
                    }
                } else {
                    // 识别其他无码格式：1PONDO, CARIB, HEYZO, 10MU等
                    const uncensoredMatch = t.match(/\b(1PONDO|CARIB|HEYZO|10MU|MURA|H4610|NAMA)[-_]?(\d+)/i);
                    if (uncensoredMatch) {
                        let prefix = uncensoredMatch[1].toUpperCase();
                        let num = uncensoredMatch[2];
                        if (prefix === 'CARIB') prefix = 'Caribbean';
                        queryCode = prefix + '-' + num;
                        displayCode = queryCode;
                        if (!markers.includes('无码')) markers.push('无码');
                        rawForCode = rawForCode.replace(new RegExp(uncensoredMatch[0], 'i'), ' ').trim();
                    } else {
                        const siteCode = extractSitePrefixedCodeFromName(origTitle);
                        if (siteCode && siteCode.code) {
                            queryCode = siteCode.code;
                            displayCode = siteCode.code;
                            if (siteCode.rawMatch) rawForCode = rawForCode.replace(new RegExp(escapeRegExp(siteCode.rawMatch), 'i'), ' ');
                            rawForCode = rawForCode.replace(/^h[_\-. ]*/i, ' ').trim();
                            const segM = rawForCode.match(/[_\-.](\d{1,3})\s*$/);
                            if (segM && parseInt(segM[1], 10) >= 1 && parseInt(segM[1], 10) <= 999) {
                                part = normalizePartToken(segM[1]);
                                rawForCode = rawForCode.replace(new RegExp(`[_\\-.]${segM[1]}\\s*$`), ' ').trim();
                            }
                        } else {
                            // 普通番号匹配
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
                }
            }

            if (!queryCode) return null;
            const baseCode = displayCode || queryCode;

            // 无码检测（追加）
            if (checkUncensored(baseCode, raw)) {
                if (!markers.includes('无码')) markers.push('无码');
            }

            const safeB = queryCode.replace(/_/g, '-').replace(/-/g, '[-_ ]?');
            if (raw.indexOf("中文") !== -1 || new RegExp(safeB + "[_-](UC|C)\\b", "i").test(raw)) {
                if (!markers.includes('中文字幕')) markers.push('中文字幕');
            }
            if (raw.indexOf("无码") !== -1 || new RegExp(safeB + "[_-](UC|U)\\b", "i").test(raw)) {
                if (!markers.includes('无码')) markers.push('无码');
            }

            if (/^FC2-PPV-\d{5,8}$/i.test(queryCode) && !part) {
                const partMatch = rawForCode.match(/[-_](\d{1,3})(?:\s|$)/);
                if (partMatch) {
                    part = normalizePartToken(partMatch[1]);
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
            if (!part) {
                const detectedPart = extractPartInfoFromFileName(origTitle, queryCode);
                if (detectedPart) {
                    part = normalizePartToken(detectedPart);
                    rawForCode = rawForCode
                        .replace(new RegExp(`(?:CD|DISC|DISK|DVD|PART|PT|P|VOL|VOLUME|EP|EPISODE|SP|SPECIAL)[\\s._-]*0*${escapeRegExp(detectedPart)}`, 'i'), ' ')
                        .replace(new RegExp(`(?:上|下|前|後|后)(?:集|部|篇|編|编|段)?(?=[\\s._\\-]|$)`, 'g'), ' ');
                    if (/^\d+$/.test(detectedPart)) {
                        rawForCode = rawForCode.replace(new RegExp(`[\\s._-]${escapeRegExp(detectedPart)}(?=[\\s._\\-]|$)`, 'g'), ' ');
                    }
                    rawForCode = rawForCode.trim();
                }
            }
            const fullCode = part ? `${baseCode}-${part}` : baseCode;

            let cleanTitle = removeMarkers(rawForCode);
            cleanTitle = cleanTitle.replace(/(?:\b|_|^|@|】|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
            cleanTitle = cleanTitle.replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ');
            cleanTitle = cleanTitle.replace(AD_BADGES, ' ');
            cleanTitle = cleanTitle.replace(GARBAGE_REGEX, ' ');
            cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
            cleanTitle = removeCodeFromTitle(cleanTitle, baseCode);

            return { queryCode, baseCode, fullCode, markers, date: dateStr, localTitle: cleanTitle };
        } catch (e) {
            console.error('parseVideoInfo error:', e);
            return null;
        }
    };

    // ========================================================================
    // 14. 构建新名称
    // ========================================================================
    const buildNewName = (vInfo, title, actresses, dateStr, suffix) => {
        let cleanTitle = removeCodeFromTitle(title, vInfo.baseCode);
        cleanTitle = cleanTitle.replace(/【[^】]*】/g, '').trim();
        let name = vInfo.fullCode;
        if (cleanTitle) name += ' ' + cleanTitle;
        if (actresses && actresses.length) {
            const actressList = [];
            const seen = new Set();
            actresses.forEach(a => {
                const std = getStandardActressName(a);
                if (!std || !isPlausibleActressToken(std)) return;
                const key = folderNameKey(std);
                if (!key || seen.has(key)) return;
                seen.add(key);
                actressList.push(std);
            });
            if (actressList.length) {
                const actressStr = actressList.join('・');
                if (!name.includes(actressStr)) name += ' ' + actressStr;
            }
        }
        if (dateStr) name += '-' + dateStr;
        if (vInfo.markers && vInfo.markers.length) {
            const uniq = [...new Set(vInfo.markers)].filter(Boolean);
            const existingMarkers = name.match(/【[^】]*】/g) || [];
            const toAdd = uniq.filter(m => !existingMarkers.includes(`【${m}】`));
            if (toAdd.length) name += toAdd.map(m => `【${m}】`).join('');
        }
        if (suffix) name += suffix;
        name = name.replace(/\s+/g, ' ').trim();
        name = name.replace(/\s+\./g, '.');
        name = name.replace(/_/g, '-');
        return name.replace(/[\\/:*?"<>|]/g, (c) => ({ '\\': '', '/': ' ', ':': ' ', '?': ' ', '"': ' ', '<': ' ', '>': ' ', '|': '' })[c] || '');
    };

    // ========================================================================
    // 15. 发送改名请求
    // ========================================================================
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

    // ========================================================================
    // 16. DOMParser 辅助
    // ========================================================================
    const parseHTML = (html) => new DOMParser().parseFromString(html, "text/html");

    // ========================================================================
    // 17. 刮削函数
    // ========================================================================
    const normDate = d => {
        if (!d) return '';
        const m = d.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        const m2 = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
        return d;
    };

    const trySearchVariants = (code, onQuery, onAllFail) => {
        const variants = getCodeQueryVariants(code);
        let idx = 0;
        const next = () => {
            if (idx >= variants.length) return onAllFail && onAllFail(variants.join('/'));
            const q = variants[idx++];
            onQuery(q, next);
        };
        next();
    };

    const isNotFoundTitle = (t) => /404|not\s*found|page\s*not\s*found|no\s*result|找不到|页面不存在|查無|查无|無此|无此/i.test(String(t || ''));

    // ---- javlibrary ----
    const fetchJavlib = (code, ok, fail) => {
        trySearchVariants(code, (q, nextVariant) => {
            GM_xmlhttpRequest({
                method: "GET", url: javlibSearchBase + encodeURIComponent(q), anonymous: true, timeout: 15000,
                onload: x => {
                    try {
                        if (x.status !== 200) return nextVariant();
                        const doc = parseHTML(x.responseText);
                        let link = doc.querySelector("#video_title a")?.getAttribute("href") || doc.querySelector("div.video a[href*='?v=']")?.getAttribute("href");
                        if (!link) return nextVariant();
                        if (link.startsWith('/')) link = javlibBase.replace(/\/+$/, '') + link;
                        GM_xmlhttpRequest({
                            method: "GET", url: link, anonymous: true, timeout: 15000,
                            onload: xx => {
                                try {
                                    if (xx.status !== 200) return nextVariant();
                                    const ddoc = parseHTML(xx.responseText);
                                    let ttl = ddoc.querySelector("#video_title a")?.textContent.trim() || ddoc.querySelector("#video_title")?.textContent.trim() || '';
                                    if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                                    if (isNotFoundTitle(ttl)) ttl = '';
                                    const dateText = ddoc.querySelector("#video_date td.text")?.textContent.trim() || '';
                                    const isoDate = normDate(dateText);
                                    const actresses = [];
                                    ddoc.querySelectorAll("#video_cast td.text a").forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                                    if (!ttl) return nextVariant();
                                    const info = { title: ttl, date: isoDate, actresses };
                                    storeInfo(code.toUpperCase(), info);
                                    ok && ok(info);
                                } catch (e) { nextVariant(); }
                            }, onerror: () => nextVariant()
                        });
                    } catch (e) { nextVariant(); }
                }, onerror: () => nextVariant()
            });
        }, tried => fail && fail("JavLibrary 搜索无结果: " + tried));
    };

    // ---- javbus ----
    const fetchJavbus = (code, ok, fail) => {
        const variants = getCodeQueryVariants(code).filter(v => !/[\s_]/.test(v));
        let vi = 0;
        const tryOne = (q) => {
            const tryBase = (u, nextOnFail) => {
                GM_xmlhttpRequest({
                    method: "GET", url: u + q, anonymous: true, timeout: 15000,
                    onload: x => {
                        try {
                            if (x.status !== 200) return nextOnFail();
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
                            if (isNotFoundTitle(ttl)) ttl = null;
                            if (!ttl) return nextOnFail();
                            let isoDate = '';
                            doc.querySelectorAll("p").forEach(p => { const t = p.textContent.trim(); if (/發行日期|发行日期/.test(t)) { const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m) isoDate = normDate(m[1]); } });
                            if (!isoDate) {
                                const p = doc.querySelector(".info p:nth-of-type(2)");
                                if (p) isoDate = normDate(p.textContent.replace(/.*?[:：]/, '').trim());
                            }
                            const actresses = [];
                            doc.querySelectorAll("span.genre a[href*='/star/']").forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                            const info = { title: ttl, date: isoDate, actresses };
                            if (u.includes('uncensored')) info.uncensored = true;
                            storeInfo(code.toUpperCase(), info);
                            ok && ok(info);
                        } catch (e) { nextOnFail(); }
                    },
                    onerror: () => nextOnFail()
                });
            };
            tryBase(javbusDirectAccess, () => tryBase(javbusUncensoredBase, nextVariant));
        };
        const nextVariant = () => {
            if (vi >= variants.length) return fail && fail("JavBus 搜索无结果: " + variants.join('/'));
            tryOne(variants[vi++]);
        };
        nextVariant();
    };

    // ---- xslist ----
    const fetchXslist = (code, ok, fail) => {
        const parsePage = (doc, cbOk, cbFail) => {
            const uc = code.toUpperCase().replace(/[-_\s]/g, '');
            let tr = null;
            doc.querySelectorAll("#movices tbody tr").forEach(row => {
                const c = (row.querySelector("td strong")?.textContent || '').trim().toUpperCase().replace(/[-_\s]/g, '');
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
            storeInfo(code.toUpperCase(), info);
            cbOk && cbOk(info);
        };
        trySearchVariants(code, (q, nextVariant) => {
            GM_xmlhttpRequest({
                method: "GET", url: xslistBase + "search?query=" + encodeURIComponent(q), anonymous: true, timeout: 15000,
                onload: x => {
                    try {
                        if (x.status !== 200) return nextVariant();
                        const sdoc = parseHTML(x.responseText);
                        if (sdoc.querySelector("#movices") && sdoc.querySelector("h1 span[itemprop='name']")) {
                            return parsePage(sdoc, ok, nextVariant);
                        }
                        let link = sdoc.querySelector("a[href*='/model/']")?.getAttribute("href");
                        if (!link) return nextVariant();
                        if (link.startsWith('/')) link = xslistBase.replace(/\/+$/, '') + link;
                        GM_xmlhttpRequest({
                            method: "GET", url: link, anonymous: true, timeout: 15000,
                            onload: dx => {
                                try { parsePage(parseHTML(dx.responseText), ok, nextVariant); }
                                catch (e) { nextVariant(); }
                            },
                            onerror: () => nextVariant()
                        });
                    } catch (e) { nextVariant(); }
                }, onerror: () => nextVariant()
            });
        }, tried => fail && fail("xslist 搜索无结果: " + tried));
    };

    // ---- javdb ----
    const fetchJavdb = (code, ok, fail) => {
        trySearchVariants(code, (q, nextVariant) => {
            GM_xmlhttpRequest({
                method: "GET", url: `${javdbSearchBase}${encodeURIComponent(q)}&f=all`, anonymous: true, timeout: 15000,
                onload: x => {
                    try {
                        if (x.status !== 200) return nextVariant();
                        const hdoc = parseHTML(x.responseText);
                        let link = hdoc.querySelector('a[href*="/v/"]')?.getAttribute('href') || hdoc.querySelector('.movie-list .item a')?.getAttribute('href');
                        if (!link) return nextVariant();
                        if (link.startsWith('/')) link = javdbBase + link;
                        GM_xmlhttpRequest({
                            method: "GET", url: link, anonymous: true, timeout: 15000,
                            onload: dx => {
                                try {
                                    if (dx.status !== 200) return nextVariant();
                                    const ddoc = parseHTML(dx.responseText);
                                    let ttl = ddoc.querySelector('h2.title')?.textContent.trim() || ddoc.querySelector('strong.current-title')?.textContent.trim() || '';
                                    if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                                    if (isNotFoundTitle(ttl)) ttl = '';
                                    let dateText = '';
                                    ddoc.querySelectorAll('.panel-block').forEach(block => {
                                        const t = block.textContent.trim();
                                        if (/日期:|發行日期:|发行日期:/.test(t)) { dateText = t.replace(/.*?[:：]/, '').trim(); }
                                    });
                                    const isoDate = normDate(dateText);
                                    // 演员与性别
                                    const actorEntries = [];
                                    ddoc.querySelectorAll('a[href*="/actors/"]').forEach(a => {
                                        const name = a.textContent.trim();
                                        if (!name) return;
                                        const gender = detectJavdbActorGender(a);
                                        actorEntries.push({ name, gender });
                                    });
                                    // 兼容无性别标记时只保存名字
                                    const actresses = actorEntries.map(e => e.name);
                                    if (!ttl) return nextVariant();
                                    const info = { title: ttl, date: isoDate, actresses, actorEntries };
                                    storeInfo(code.toUpperCase(), info);
                                    ok && ok(info);
                                } catch (e) { nextVariant(); }
                            }, onerror: () => nextVariant()
                        });
                    } catch (e) { nextVariant(); }
                }, onerror: () => nextVariant()
            });
        }, tried => fail && fail("JavDB 搜索无结果: " + tried));
    };

    // JavDB 性别检测
    const detectJavdbActorGender = (linkElement) => {
        if (!linkElement) return 'unknown';
        const link = $(linkElement);
        const ownText = [link.text(), link.attr('data-gender'), link.attr('title'), link.attr('aria-label')].filter(Boolean).join(' ');
        if (/♀|female|woman|女(?:優|优|演员|演員)?/i.test(ownText)) return 'female';
        if (/♂|male|man|男(?:優|优|演员|演員)?/i.test(ownText)) return 'male';
        let sibling = linkElement.nextSibling;
        let checked = 0;
        while (sibling && checked < 4) {
            if (sibling.nodeType === 1 && String(sibling.tagName || '').toLowerCase() === 'a') break;
            const text = String(sibling.textContent || '').trim();
            if (/♀/.test(text)) return 'female';
            if (/♂/.test(text)) return 'male';
            sibling = sibling.nextSibling;
            checked++;
        }
        return 'unknown';
    };

    // ---- fc2ppvdb ----
    const fetchFC2PPVDB = (code, ok, fail) => {
        const fc2Number = code.match(/\d+$/)[0];
        GM_xmlhttpRequest({
            method: "GET", url: fc2ppvdbBase + fc2Number, timeout: 15000, anonymous: true,
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
                    storeInfo(code.toUpperCase(), info);
                    ok && ok(info);
                } catch (e) { fail("FC2PPVDB 解析失败: " + e.message); }
            },
            onerror: () => fail("FC2PPVDB 请求失败"),
            ontimeout: () => fail("FC2PPVDB 超时")
        });
    };

    // ---- missav fc2 ----
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
                        storeInfo(code.toUpperCase(), info);
                        ok && ok(info);
                    } catch (error) { fail("MissAV 解析失败: " + error.message); }
                },
                onerror: () => fail("MissAV 请求失败"),
                ontimeout: () => fail("MissAV 超时")
            });
        }, () => fail("MissAV 签名失败"));
    };

    // ---- avsox（无码站） ----
    const fetchAvsox = (code, ok, fail) => {
        const base = "https://avsox.host/cn/search/";
        const url = base + encodeURIComponent(code);
        GM_xmlhttpRequest({
            method: "GET", url, anonymous: true, timeout: 15000,
            onload: xhr => {
                try {
                    if (xhr.status !== 200) return fail("avsox HTTP " + xhr.status);
                    const doc = parseHTML(xhr.responseText);
                    const item = doc.querySelector(".movie-box");
                    if (!item) return fail("未找到影片");
                    let titleEl = item.querySelector(".title") || item.querySelector(".name");
                    if (!titleEl) return fail("无标题元素");
                    let title = titleEl.textContent.trim();
                    const dateEl = doc.querySelector(".date") || doc.querySelector(".info .date");
                    let date = dateEl ? dateEl.textContent.trim() : '';
                    const actresses = [];
                    doc.querySelectorAll(".star a, .actress a").forEach(a => {
                        const n = a.textContent.trim();
                        if (n) actresses.push(n);
                    });
                    if (!title) return fail("无标题内容");
                    const info = { title, date, actresses, uncensored: true };
                    storeInfo(code.toUpperCase(), info);
                    ok(info);
                } catch (e) { fail(e.message); }
            },
            onerror: () => fail("请求失败"),
            ontimeout: () => fail("超时")
        });
    };

    // ========================================================================
    // 18. 翻译
    // ========================================================================
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

    // ========================================================================
    // 19. 远程信息获取（含并发优化）
    // ========================================================================
    const fetchRemoteInfo = (code, callback, isUncensored = false) => {
        const key = code.toUpperCase();
        if (isInfoCacheValid(key)) { callback(infoCache[key]); return; }
        if (isNegativeCached(key)) { callback(null); return; }

        const sources = isUncensored ? [fetchAvsox] : [fetchJavdb, fetchJavbus, fetchXslist];
        let finished = false;
        const done = (info) => {
            if (finished) return;
            finished = true;
            if (info) { storeInfo(key, info); callback(info); }
            else { markNegativeCached(key); callback(null); }
        };

        if (sources.length === 1) {
            sources[0](code, done, done);
            return;
        }

        let active = sources.length;
        sources.forEach(source => {
            source(code, info => { if (!finished) { finished = true; storeInfo(key, info); callback(info); } }, () => {
                active--;
                if (active === 0 && !finished) {
                    finished = true;
                    markNegativeCached(key);
                    callback(null);
                }
            });
        });
    };

    // ========================================================================
    // 20. 改名主流程
    // ========================================================================
    const getTargetName = (vInfo, suffix, addDate, translateChinese, callback) => {
        const code = vInfo.queryCode;
        const key = code.toUpperCase();
        const applyInfo = (info) => {
            if (info.uncensored && !vInfo.markers.includes('无码')) {
                vInfo.markers.push('无码');
            }
            const finalize = (finalTitle) => {
                const newName = buildNewName(vInfo, finalTitle, info.actresses, (addDate && info.date) ? info.date : (addDate ? vInfo.date : ""), suffix);
                callback(newName, true);
            };
            if (translateChinese) {
                translateTitleToChinese(info.title, true, code, translated => {
                    finalize(translated && translated !== info.title ? `${info.title} ${translated}` : info.title);
                });
            } else {
                finalize(info.title);
            }
        };
        if (isInfoCacheValid(key)) { applyInfo(infoCache[key]); return; }

        const isUncensored = vInfo.markers && vInfo.markers.includes('无码');
        fetchRemoteInfo(code, (info) => {
            if (info) { storeInfo(key, info); applyInfo(info); }
            else callback(null, false);
        }, isUncensored);
    };

    window.rename_multi = (fid, vInfo, suffix, addDate, callback, origFilename, translateChinese = false) => {
        getTargetName(vInfo, suffix, addDate, translateChinese, (newName, found) => {
            if (newName) {
                send_115(fid, newName, vInfo.fullCode, origFilename, callback);
            } else {
                if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode)) {
                    showPageNotification(`${vInfo.fullCode} 已保护手动命名，跳过`, 'info', 3000);
                } else {
                    showPageNotification(`所有信息源未找到 ${vInfo.queryCode}`, 'error', 4000);
                }
                if (typeof callback === 'function') callback();
            }
        });
    };

    const local_rename = (fid, vInfo, suffix, addDate, callback, origFilename) => {
        const newName = buildNewName(vInfo, vInfo.localTitle, [], vInfo.date, suffix);
        const bareName = buildNewName(vInfo, '', [], vInfo.date, suffix);
        if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode) && newName === bareName) {
            showPageNotification(`${vInfo.fullCode} 已保护手动命名，跳过`, 'info', 3000);
            if (typeof callback === 'function') callback();
            return;
        }
        send_115(fid, newName, vInfo.fullCode, origFilename, callback);
    };

    // ========================================================================
    // 21. 预览与批量处理
    // ========================================================================
    const buildPreviewRows = (parsedItems, isLocal, addDate, translateChinese, done) => {
        const rows = [];
        if (isLocal) {
            parsedItems.forEach(item => {
                const newName = buildNewName(item.vi, item.vi.localTitle, [], item.vi.date, item.safeSuffix);
                const bareName = buildNewName(item.vi, '', [], item.vi.date, item.safeSuffix);
                const protectedName = hasManualNamePayload(item.fn, item.vi.queryCode) && newName === bareName;
                rows.push({ item, newName: protectedName ? null : newName, status: protectedName ? '手动命名保护' : '本地', checked: !protectedName });
            });
            done(rows);
            return;
        }
        const uniqueCodes = [...new Set(parsedItems.map(i => i.vi.queryCode.toUpperCase()))];
        const missingCodes = uniqueCodes.filter(c => !isInfoCacheValid(c));
        const afterPrefetch = () => {
            let remaining = parsedItems.length;
            const results = new Array(parsedItems.length);
            parsedItems.forEach((item, idx) => {
                getTargetName(item.vi, item.safeSuffix, addDate, translateChinese, (newName) => {
                    let status = '网络', checked = true;
                    if (!newName) {
                        status = hasManualNamePayload(item.fn, item.vi.queryCode) ? '手动命名保护' : '未找到';
                        checked = false;
                    }
                    results[idx] = { item, newName, status, checked };
                    if (--remaining === 0) done(results.filter(Boolean));
                });
            });
        };
        if (!missingCodes.length) { afterPrefetch(); return; }
        let prefetched = 0;
        const prefetchNext = () => {
            if (prefetched >= missingCodes.length) { afterPrefetch(); return; }
            const code = missingCodes[prefetched++];
            fetchRemoteInfo(code, () => setTimeout(prefetchNext, 200));
        };
        const concurrency = Math.min(3, missingCodes.length);
        for (let i = 0; i < concurrency; i++) prefetchNext();
    };

    const showRenamePreview = (rows, onConfirm, onCancel) => {
        const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const old = document.getElementById('rename-preview-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'rename-preview-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
        overlay.innerHTML = `
            <div style="width:min(980px,calc(100vw - 32px));max-height:88vh;background:#fff;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow:hidden;">
                <div style="padding:16px 20px;background:linear-gradient(135deg,#1a6dff,#1890ff);color:#fff;display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:16px;font-weight:600;">改名预览</h3>
                    <span id="rename-preview-close" style="cursor:pointer;font-size:22px;line-height:1;">×</span>
                </div>
                <div style="padding:10px 16px;border-bottom:1px solid #eee;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <button id="rp-select-all" style="padding:5px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;">全选</button>
                    <button id="rp-invert" style="padding:5px 12px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;">反选</button>
                    <span id="rp-summary" style="font-size:13px;color:#666;margin-left:auto;"></span>
                </div>
                <div id="rp-body" style="flex:1;overflow:auto;padding:8px 0;"></div>
                <div style="padding:12px 20px;border-top:1px solid #eee;text-align:right;background:#fafafa;">
                    <button id="rp-cancel" style="padding:8px 18px;border:1px solid #d9d9d9;border-radius:6px;background:#fff;cursor:pointer;font-size:14px;margin-right:10px;">取消</button>
                    <button id="rp-confirm" style="padding:8px 20px;border:none;border-radius:6px;background:#1a6dff;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">确认改名</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const body = document.getElementById('rp-body');
        const updateSummary = () => {
            const checked = document.querySelectorAll('.rp-chk:checked').length;
            document.getElementById('rp-summary').textContent = `共 ${rows.length} 个，已选 ${checked} 个`;
        };
        const renderList = () => {
            body.innerHTML = '';
            rows.forEach((row, idx) => {
                const tr = document.createElement('div');
                tr.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:7px 16px;border-bottom:1px solid #f5f5f5;font-size:13px;';
                const statusColor = row.status === '手动命名保护' ? '#fa8c16' : (row.status === '未找到' ? '#cf1322' : '#52c41a');
                tr.innerHTML = `
                    <input type="checkbox" class="rp-chk" data-idx="${idx}" ${row.checked ? 'checked' : ''} style="margin-top:2px;flex-shrink:0;width:16px;height:16px;">
                    <div style="flex-shrink:0;width:150px;font-family:monospace;color:#1890ff;font-weight:600;">${esc(row.item.vi.fullCode)}</div>
                    <div style="flex:1;min-width:0;word-break:break-all;color:#333;">${esc(row.item.fn)}</div>
                    <div style="flex:1.2;min-width:0;word-break:break-all;color:#1890ff;">${esc(row.newName || '—')}</div>
                    <div style="flex-shrink:0;width:96px;text-align:center;color:${statusColor};font-weight:500;">${esc(row.status)}</div>`;
                body.appendChild(tr);
            });
            updateSummary();
        };

        document.getElementById('rp-select-all').onclick = () => { document.querySelectorAll('.rp-chk').forEach(c => c.checked = true); updateSummary(); };
        document.getElementById('rp-invert').onclick = () => { document.querySelectorAll('.rp-chk').forEach(c => c.checked = !c.checked); updateSummary(); };
        body.addEventListener('change', updateSummary);
        document.getElementById('rename-preview-close').onclick = () => { overlay.remove(); onCancel(); };
        document.getElementById('rp-cancel').onclick = () => { overlay.remove(); onCancel(); };
        document.getElementById('rp-confirm').onclick = () => {
            const selected = [];
            document.querySelectorAll('.rp-chk:checked').forEach(c => selected.push(rows[Number(c.dataset.idx)]));
            overlay.remove();
            onConfirm(selected);
        };
        renderList();
    };

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

        const cancelRename = () => {
            persistCaches();
            showPageNotification('已取消改名', 'info', 2000);
            window.renameInProgress = false;
        };

        const executeRename = (rows) => {
            if (!rows.length) { cancelRename(); return; }
            progressBox.init(isLocal ? '本地番号加工' : '联网改名', rows.length);
            renameCompareList = [];
            let processed = 0;
            const tasks = rows.map(row => done => {
                send_115(row.item.fid, row.newName, row.item.vi.fullCode, row.item.fn, () => {
                    processed++;
                    progressBox.update(processed);
                    done();
                });
            });
            runTasksWithLimit(tasks, isLocal ? 5 : 3, 200, finishRename);
        };

        if (isLocal) {
            buildPreviewRows(parsedItems, true, addDate, false, rows => {
                showRenamePreview(rows, executeRename, cancelRename);
            });
        } else {
            showPageNotification('正在联网生成改名预览...', 'info', 4000);
            buildPreviewRows(parsedItems, false, addDate, translateChinese, rows => {
                showRenamePreview(rows, executeRename, cancelRename);
            });
        }

        function persistCaches() {
            GM_setValue('jb_infoCache', JSON.stringify(infoCache));
            GM_setValue('jb_actressCache', JSON.stringify(actressCache));
            GM_setValue('jb_ratingCache', JSON.stringify(ratingCache));
            GM_setValue('jb_negativeCache', JSON.stringify(negativeCache));
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

    // ========================================================================
    // 22. 备份与剪贴板
    // ========================================================================
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

    // ========================================================================
    // 23. 归档功能（含演员性别优先）
    // ========================================================================
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
            if (isInfoCacheValid(code) && infoCache[code].actresses && infoCache[code].actresses.length) {
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
                if (/^FC2-PPV-\d{5,8}$/i.test(code)) {
                    findOrCreateFolderAndMove(item.fid, "FC2", () => {
                        processed++; success++; progressBox.update(processed); done();
                    }, () => { processed++; progressBox.update(processed); done(); });
                } else {
                    // 优先从 infoCache 获取带性别的演员列表
                    let actorEntries = [];
                    const key = code.toUpperCase();
                    if (isInfoCacheValid(key) && infoCache[key].actorEntries) {
                        actorEntries = infoCache[key].actorEntries;
                    }
                    // 否则从 actressCache 取纯名字
                    let rawActress = actressCache[key]?.[0] || '';
                    let folderName = '';
                    if (actorEntries.length > 0) {
                        // 选择优先女演员
                        const preferred = actorEntries.find(e => e.gender === 'female') || actorEntries.find(e => e.gender === 'unknown') || actorEntries[0];
                        folderName = preferred ? getStandardActressName(preferred.name) : '';
                    } else if (rawActress) {
                        folderName = getStandardActressName(rawActress);
                    }
                    if (!folderName) {
                        folderName = getSeriesFromCode(code) || '其他';
                    }
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
            GM_setValue('jb_negativeCache', JSON.stringify(negativeCache));
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

    // ========================================================================
    // 24. 分桶归档
    // ========================================================================
    const getBucketFolderName = (code) => {
        const c = String(code).toUpperCase();
        if (/^FC2-PPV/.test(c)) return 'FC2';
        const m = c.match(/^([A-Z]+)-(\d+)$/);
        if (m) {
            const prefix = m[1];
            const num = parseInt(m[2], 10);
            const start = Math.floor(num / 1000) * 1000;
            const end = start + 999;
            return `${prefix}-${String(start).padStart(4, '0')}-${String(end).padStart(4, '0')}`;
        }
        return '其他';
    };

    const archiveToBucketFolder = () => {
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

        progressBox.init('分桶归档', parsedItems.length);
        let processed = 0, success = 0;
        const tasks = parsedItems.map(item => done => {
            const bucket = getBucketFolderName(item.vi.queryCode);
            findOrCreateFolderAndMove(item.fid, bucket, () => {
                processed++; success++; progressBox.update(processed); done();
            }, () => { processed++; progressBox.update(processed); done(); });
        });
        runTasksWithLimit(tasks, 3, 500, () => {
            progressBox.finish();
            showPageNotification(`分桶归档完成：成功 ${success}/${parsedItems.length}`, 'success', 5000);
            GM_setValue('jb_negativeCache', JSON.stringify(negativeCache));
        });
    };

    // ========================================================================
    // 25. JavDB 评分
    // ========================================================================
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
            method: "GET", url: `${javdbSearchBase}${encodeURIComponent(code)}&f=all`, timeout: 15000, anonymous: true,
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
                                    method: "GET", url: detailUrl, timeout: 15000, anonymous: true,
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

    // ========================================================================
    // 26. 菜单绑定与设置归档根
    // ========================================================================
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
            $("a#archive_to_bucket").off("click").on("click", archiveToBucketFolder);
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

    console.log("115Rename2026 v2.2.1 已加载（完整版）");
})();