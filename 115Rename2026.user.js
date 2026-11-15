// ==UserScript==
// @name            115Rename2026 
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         2.0.0
// @description     115 新版适配｜解决与JAV老司机冲突｜侧边栏紧凑设置｜暗黑模式支持｜多源检索
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
// @connect         *
// @grant           GM_notification
// @grant           GM_xmlhttpRequest
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_deleteValue
// @grant           GM_setClipboard
// @grant           GM_registerMenuCommand
// @grant           GM_addStyle
// @license         MIT
// @run-at          document-idle
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '2.0.0';

    // ============================================================
    // 默认设置
    // ============================================================
    const FIELD_DEFINITIONS = {
        code: { label: '番号(全)', required: true, fixed: true, settingKey: 'enableCode' },
        title: { label: '标题', settingKey: 'enableTitle', default: true },
        zhTitle: { label: '中文标题', settingKey: 'enableZhTitle', default: false },
        actresses: { label: '演员', settingKey: 'enableActresses', default: true },
        date: { label: '日期', settingKey: 'enableDate', default: true },
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
        fieldOrder: 'code,title,zhTitle,actresses,date',
        sourceOrder: 'javdb,javbus,javlibrary,xslist,fc2ppvdb,missav,avsox,avmoo,custom',
        scrapeSources: 'javdb,javbus,javlibrary,xslist,fc2ppvdb,missav,avsox,avmoo',
        customSources: '',
        fieldSeparator: ' ',
        datePrefix: '-',
        actressSeparator: '・',
        enableTitle: true, enableZhTitle: false, enableActresses: true, enableDate: true, enableMarkers: true,
        translateChinese: false, protectManualName: true, segmentPrefix: 'cd',
        renameConcurrency: 3, archiveConcurrency: 3,
        archiveRootCid: null, archiveRootName: null, archiveRootPath: '',
        cacheTtlDays: 90, negativeCacheTtlHours: 24, actressAlias: null,
        menuVisibility: { localCodeProcess: true, renameMultiDate: true, renameMultiZh: true, archiveFolder: true, archiveBucket: true, setArchiveRoot: true, javdbRating: true },
    };

    let SETTINGS = null;
    function loadSettings() {
        if (SETTINGS) return SETTINGS;
        try {
            const raw = GM_getValue('rename2026_settings', '');
            const p = raw ? JSON.parse(raw) : {};
            SETTINGS = Object.assign({}, DEFAULT_SETTINGS, p);

            if (p.hasOwnProperty('useCdPrefix') && SETTINGS.segmentPrefix === undefined) {
                SETTINGS.segmentPrefix = p.useCdPrefix ? 'cd' : '';
            }
            if (!SETTINGS.menuVisibility) SETTINGS.menuVisibility = Object.assign({}, DEFAULT_SETTINGS.menuVisibility);
            if (!SETTINGS.fieldOrder) SETTINGS.fieldOrder = DEFAULT_SETTINGS.fieldOrder;
            if (!SETTINGS.sourceOrder) SETTINGS.sourceOrder = DEFAULT_SETTINGS.sourceOrder;
        } catch (e) { SETTINGS = Object.assign({}, DEFAULT_SETTINGS); }
        return SETTINGS;
    }
    function saveSettings(p) { loadSettings(); if (p) Object.assign(SETTINGS, p); GM_setValue('rename2026_settings', JSON.stringify(SETTINGS)); }

    // ============================================================
    // 常量配置
    // ============================================================
    const ACTRESS_ALIAS_MAP_DEFAULT = {
        '三上悠亜': '三上悠亚', 'Mikami Yua': '三上悠亚', '深田えいみ': '深田咏美', 'Fukada Eimi': '深田咏美',
        '天使もえ': '天使萌', 'Amatsuka Moe': '天使萌', '桃乃木かな': '桃乃木香奈', 'Momonogi Kana': '桃乃木香奈',
        '凪ひかる': '凪光', 'Nagi Hikaru': '凪光', '坂道みる': '坂道美琉', 'Sakamichi Miru': '坂道美琉',
        '高橋しょう子': '高桥圣子', 'Takahashi Shoko': '高桥圣子', '河北彩花': '河北彩花', 'Kawakita Saika': '河北彩花',
        '松本いちか': '松本一香', 'Matsumoto Ichika': '松本一香', '桜空もも': '樱空桃', 'Sakura Momo': '樱空桃',
        '涼森れむ': '凉森玲梦', 'Suzumori Remu': '凉森玲梦', '七沢みあ': '七泽米亚', 'Nanasawa Mia': '七泽米亚',
        '紗倉まな': '纱仓真菜', 'Sakura Mana': '纱仓真菜', '波多野結衣': '波多野结衣', 'Hatano Yui': '波多野结衣',
        '橋本ありな': '桥本有菜', 'Hashimoto Arina': '桥本有菜', '三宮つばき': '三宫椿', 'Sannomiya Tsubaki': '三宫椿',
        '山手梨愛': '山手梨爱', 'Yamamate Ria': '山手梨爱', '神宮寺ナオ': '神宫寺奈绪', 'Jinguji Nao': '神宫寺奈绪',
        '七瀬アリス': '七濑爱丽丝', 'Nanase Alice': '七濑爱丽丝', '大槻ひびき': '大槻响', 'Otsuki Hibiki': '大槻响',
        '希崎ジェシカ': '希崎杰西卡', 'Kizaki Jessica': '希崎杰西卡', '希岛あいり': '希岛爱理', 'Kijima Airi': '希岛爱理',
        '小湊よつ葉': '小凑四叶', 'Kominato Yotsuha': '小凑四叶', '伊藤舞雪': '伊藤舞雪', 'Ito Miyuki': '伊藤舞雪',
        '天海つばさ': '天海翼', 'Amami Tsubasa': '天海翼', '初川みなみ': '初川南', 'Hatsukawa Minami': '初川南',
        '浜崎真緒': '滨崎真绪', 'Hamasaki Mao': '滨崎真绪', '上原亜衣': '上原亚衣', 'Uehara Ai': '上原亚衣',
        '彩美旬果': '彩美旬果', 'Ayami Shunka': '彩美旬果', '大橋未久': '大桥未久', 'Ohashi Mihuku': '大桥未久',
        '吉沢明歩': '吉泽明步', 'Yoshizawa Akiho': '吉泽明步', '蒼井そら': '苍井空', 'Sora Aoi': '苍井空',
        '小澤マリア': '小泽玛利亚', 'Ozawa Maria': '小泽玛利亚',
    };

    const MANUAL_PREFIXES = [
        'LEGSJAPAN', 'AYAKISAKI', 'SPERMMANIA', 'FELLATIOJAPAN', 'S2MCR', 'MXVR', 'SIVR',
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
        'MADA', 'MDS', 'RMLD', 'MILD', 'MDB', 'RMDBB', 'RMDS', 'REAL', 'NATR', 'SCOP', 'BOKD',
        'ABS', 'ABP', 'KBH', 'EZD', 'MAS', 'INU', 'JOB', 'EDD', 'ESK', 'MEK', 'DOM', 'YRZ',
        'PPP', 'EVO', 'SAD', 'GYD', 'HYK', 'FST', 'TBL', 'LOO', 'TOR', 'TD', 'RBS', 'MAN', 'ZZR', 'WPC', 'BNDV', 'CRS',
        'HODV', 'HRDV', 'YMDD', 'TMD', 'DSD', 'RJMD', 'ALD', 'DBE', 'DOJ', 'OFCD', 'SEND', 'ULJM', 'DSS', 'MOED', 'DER',
        'OPD', 'GRYD', 'MSBD', 'SS', 'HD', 'DVH', 'REID', 'GEN', 'DBUD', 'IBW', 'MMO', 'ADZ',
        'AKB', 'HITMA', 'RAY', '24ID', 'COSQ',
        'GRET', 'GATE', 'GEXP', 'GGFH', 'GGTB', 'GMMD', 'GODS', 'GPTM', 'GSAD', 'GXXD', 'GDGA', 'GOMK', 'GTRL',
        'GOMD', 'GDSC', 'TBW', 'TBB', 'TDP', 'TDLN', 'TGGP', 'THP', 'THZ', 'TMS', 'TZZ', 'TRE', 'TSGS', 'TSDL',
        'TSWN', 'TSW', 'TTRE', 'ATHB', 'AKBD', 'DMG', 'MGJH', 'ANIX', 'CYCD', 'YNO', 'AZGB', 'SKOT', 'SHP', 'JMSZ',
        'JHZD', 'NFDM', 'CGAD', 'CGBD', 'CHSD', 'CUSD', 'CHSH', 'CMV', 'PAED', 'RGI', 'ZARD', 'ZATS', 'ZDAD', 'ZKV',
        'COSETT', 'MXGS', 'MX3DS', 'IPBZ', 'SVMGM', 'MIDA',
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

    const GARBAGE_WORDS = [
        'FHD', 'FULLHD', 'UHD', 'QHD', 'WQHD', 'HD', 'SD', 'HDR', 'HDR10', '2160P', '1440P', '1080P', '1080I', '720P', '720I', '576P', '540P', '480P', '396P', '360P', '240P',
        'X264', 'X265', 'H264', 'H265', 'HEVC', 'AVC', 'VP9', 'AV1', '10BIT', '8BIT',
        'AAC', 'AC3', 'DTS', 'FLAC', 'MP3', 'DDP',
        'MP4', 'MKV', 'AVI', 'WMV', 'M4V', 'RMVB', 'ISO', 'TS',
        'WATERMARK', 'RARBG', 'WEB-DL', 'WEBRIP', 'BLURAY', 'BDREMUX', 'BDRIP', 'HDRIP', 'WEBDL',
        'HHB', 'HHC', 'HHD', 'HHH'
    ];

    const RESOLUTION_FPS_PATTERN = /(?<![A-Za-z0-9])(?:2160[Pp]|1440[Pp]|1080[PpIi]?|720[PpIi]?|576[Pp]|540[Pp]|480[Pp]|396[Pp]|360[Pp]|240[Pp]|FHD|FULLHD|UHD|QHD|WQHD|HDR10\+?|HDR|10[Bb][Ii][Tt]|8[Bb][Ii][Tt]|(?:24|25|30|50|60|120|144)\s*[Ff][Pp][Ss]|[Ff][Pp][Ss])(?![A-Za-z0-9])/gi;

    const MARKER_MAP = {
        '无码破解': '破解', '破解无码': '破解',
        '无码流出': '流出', '流出无码': '流出',
        '无修正': '无码', '無修正': '无码',
        '无码': '无码', '無碼': '无码',
        '无马赛克': '无码', '無馬賽克': '无码',
        '去码': '无码', '去碼': '无码',
        'uncensored': '无码', 'uncensor': '无码',
        'decensored': '无码', 'decensor': '无码',
        'restored': '无码', 'restoration': '无码',
        '流出': '流出',
        'leaked': '流出', 'leaks': '流出', 'leak': '流出',
        '破解版': '破解', '破解': '破解',
        '破壊版': '破解', '破壊': '破解',
        'hacked': '破解', 'hack': '破解',
        'cracked': '破解', 'crack': '破解',
        'pierce': '破解',
        '中文字幕版': '中文字幕', '中文字幕': '中文字幕',
        '中字版': '中文字幕',
        '繁体中文': '中文字幕', '简体中文': '中文字幕',
        '繁體中文': '中文字幕', '簡體中文': '中文字幕',
        '繁體中文字幕': '中文字幕', '簡體中文字幕': '中文字幕',
        'chinese': '中文字幕', 'big5': '中文字幕',
        'chs': '中文字幕', 'cht': '中文字幕', 'gb': '中文字幕',
        '4k': '4K', '8k': '8K', '2160p': '4K',
        'vr180': 'VR', 'vr360': 'VR', 'vr': 'VR', '3d': '3D',
    };
    const MARKER_PATTERN = (function () {
        const keys = Object.keys(MARKER_MAP).sort((a, b) => b.length - a.length);
        const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp('(?:' + escaped.join('|') + ')', 'gi');
    })();
    const AD_BADGES = /\[3Q\]|\(原\)|\[原\]|\[BT\]|【广告】|\[廣告\]/gi;

    // ============================================================
    // 工具函数
    // ============================================================
    const stripFileExt = n => { const s = String(n || ''); const i = s.lastIndexOf('.'); return i > 0 ? s.slice(0, i) : s; };
    const escapeRegExp = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizeFileName = s => s == null ? '' : String(s).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    const isPunctOnly = s => !s || !String(s).trim() || /^[\s\.\-_·・,，。;；:：!！?？、\/\\|+~@#$%^&*()\[\]{}【】「」『』《》<>]+$/.test(String(s).trim());

    const normalize115Name = n => {
        if (!n) return '';
        let s = String(n);
        try { s = s.normalize('NFKC'); } catch (_) { }
        s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060-\u2064\u180E\u2028\u2029]/g, '');
        s = s.replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
        s = s.replace(/[\u2010-\u2015\u2212\u30FC]+/g, '-');
        s = s.replace(/[\u30FB\u00B7\u2022]/g, '·');
        s = s.replace(/[\uFF0C\u3001]/g, '，').replace(/[\uFF0E\u3002]/g, '。');
        s = s.replace(/[\\\/:?"<>|*]/g, ' ');
        return s.replace(/\s+/g, ' ').trim();
    };

    const normalizeFolderName = n => {
        if (!n) return '';
        let s = normalize115Name(String(n));
        s = s.replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/[\uFF41-\uFF5A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/[\uFF10-\uFF19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/\uFF0C/g, ',').replace(/\u3001/g, ',');
        s = s.replace(/\uFF0E/g, '.').replace(/\u3002/g, '.');
        s = s.replace(/\uFF08/g, '(').replace(/\uFF09/g, ')');
        s = s.replace(/\u3010/g, '[').replace(/\u3011/g, ']');
        s = s.replace(/\u2014/g, '-').replace(/\u2013/g, '-');
        return s.replace(/\s+/g, ' ').trim();
    };

    const folderNameKey = n => !n ? '' : normalize115Name(n).toLowerCase().replace(/[\s\-_·・.,，。()（）\[\]【】「」『』]+/g, '').replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/g, '');

    const getCodeQueryVariants = code => {
        const variants = [String(code || '')];
        const noDash = String(code || '').replace(/-/g, '');
        if (noDash !== code) variants.push(noDash);
        const m = String(code || '').match(/^([A-Z]+)-(\d+)$/);
        if (m) {
            const num = String(parseInt(m[2], 10));
            if (num !== m[2]) variants.push(m[1] + '-' + num);
            variants.push(m[1] + num, m[1] + ' ' + num, m[1] + '_' + num);
        }
        return Array.from(new Set(variants));
    };

    const getActressAliasMap = () => {
        const s = loadSettings();
        if (!s.actressAlias) return Object.assign({}, ACTRESS_ALIAS_MAP_DEFAULT);
        try { return Object.assign({}, ACTRESS_ALIAS_MAP_DEFAULT, JSON.parse(s.actressAlias)); } catch (e) { return Object.assign({}, ACTRESS_ALIAS_MAP_DEFAULT); }
    };

    const getStandardActressName = name => {
        if (!name) return name;
        const n = normalizeFolderName(String(name));
        if (!n) return n;
        const map = getActressAliasMap();
        return map[n] || n;
    };

    const isPlausibleActressToken = name => {
        if (!name) return false;
        let n = normalizeFolderName(String(name)).replace(/[\[\]【】()（）{}<>《》「」『』]/g, '').trim();
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

    const removeMarkers = str => String(str).replace(MARKER_PATTERN, (m, p1, offset, full) => {
        if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(m)) return ' ';
        const prev = offset > 0 ? full[offset - 1] : '';
        const next = offset + m.length < full.length ? full[offset + m.length] : '';
        if (/[a-z0-9]/i.test(prev) && /[a-z0-9]/i.test(next)) return m;
        return ' ';
    });

    const stripDomainPrefix = filename => {
        if (!filename || filename.indexOf('@') === -1) return filename;
        const safeExtMatch = filename.match(/\.([a-z0-9]{2,5})$/i);
        const ext = (safeExtMatch && !/^\d+$/.test(safeExtMatch[1])) ? safeExtMatch[0] : '';
        const base = ext ? filename.slice(0, -ext.length) : filename;
        const parts = base.split('@').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length <= 1) return filename;
        const isDomain = s => !s ? false : (!/\.(mp4|mkv|avi|wmv|mov|flv|rmvb|webm|ts|m4v|mpg|mpeg|jpg|jpeg|png|gif|webp|bmp|iso|wav|mp3|flac|aac|srt|ass|sub)$/i.test(s) && /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\.[a-z]{2,})?$/i.test(s));
        const hasCode = s => !s ? false : (/\b[A-Z]{2,8}[-_ ]?\d{2,5}/i.test(s) || /FC2[-_ ]?PPV[-_ ]?\d{5,8}/i.test(s) || /\bfc2?\d{5,8}/i.test(s) || /\b\d{4,6}[-_]\d{3,4}\b/.test(s) || /Tokyo[-_ ]?Hot[-_ ]?[nN]?\d{3,4}/i.test(s) || /\b(1PONDO|CARIB|HEYZO|10MU|MURA|H4610|NAMA|PACO|TOKYOHOT)[-_]?\d+/i.test(s));
        for (let i = 0; i < parts.length; i++) {
            if (isDomain(parts[i])) continue;
            if (hasCode(parts[i])) return parts[i] + ext;
        }
        if (isDomain(parts[0])) return parts.slice(1).join('@') + ext;
        return parts[parts.length - 1] + ext;
    };

    const getSafeSuffix = filename => { const m = filename.match(/\.([a-z0-9]{2,5})$/i); return (m && !/^\d+$/.test(m[1])) ? m[0] : ''; };

    const normDate = d => {
        if (!d) return '';
        const m = d.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
        const m2 = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m2) return m2[3] + '-' + m2[2] + '-' + m2[1];
        return d;
    };

    const isNotFoundTitle = t => /404|not\s*found|page\s*not\s*found|no\s*result|找不到|页面不存在|查無|查无|無此|无此/i.test(String(t || ''));

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

    // ============================================================
    // 新版 115 适配选择器
    // ============================================================
    const V115_ROW_SELECTORS = ['li[rel="item"]', '.file-list-item', '.file-grid-item', '[data-file-id]', '.list-contents li', 'div[rel="item"]'];
    const V115_ID_ATTRS_FOLDER = ['data-file-id', 'cate_id', 'cid', 'file_id', 'data-cate-id', 'data-cid'];
    const V115_ID_ATTRS_FILE = ['data-file-id', 'file_id', 'cid', 'data-cid'];
    const V115_NAME_SELECTORS = ['.file-name .name[title]', '.file-name .name', '.file-name-responsive[title]', '.file-name-responsive', '[rel="file_name"] .name', '.name[title]', '.name'];

    function v115GetAttr(el, attrs) {
        if (!el) return '';
        for (let i = 0; i < attrs.length; i++) {
            const v = el.getAttribute && el.getAttribute(attrs[i]);
            if (v) return String(v).trim();
        }
        return '';
    }

    function v115IsFolderRow(row) {
        const ft = row.getAttribute('file_type');
        if (ft === '0') return true;
        if (ft === '1') return false;
        const imgs = row.querySelectorAll('img');
        for (let i = 0; i < imgs.length; i++) {
            const img = imgs[i];
            const alt = img.getAttribute('alt') || '';
            const title = img.getAttribute('title') || '';
            const src = img.getAttribute('src') || '';
            if (alt === '文件夹' || title === '文件夹' || /folder/i.test(src)) return true;
        }
        return false;
    }

    function v115GetRowName(row) {
        if (!row) return '';
        const direct = row.getAttribute('title') || row.getAttribute('data-title') || row.getAttribute('data-name');
        if (direct) return String(direct).trim();
        for (let i = 0; i < V115_NAME_SELECTORS.length; i++) {
            const el = row.querySelector(V115_NAME_SELECTORS[i]);
            if (el) {
                const t = el.getAttribute('title') || el.textContent;
                if (t && t.trim()) return String(t).trim();
            }
        }
        return '';
    }

    function v115GetRowId(row, isFolder) {
        const attrs = isFolder ? V115_ID_ATTRS_FOLDER : V115_ID_ATTRS_FILE;
        let id = v115GetAttr(row, attrs);
        if (id) return id;
        const cbs = row.querySelectorAll('input[type="checkbox"]');
        for (let i = 0; i < cbs.length; i++) {
            const v = cbs[i].getAttribute('data-id') || cbs[i].getAttribute('value') || cbs[i].getAttribute('fid');
            if (v) return String(v).trim();
        }
        const pk = row.getAttribute('pick_code') || (row.querySelector('[pick_code]') ? row.querySelector('[pick_code]').getAttribute('pick_code') : '');
        if (pk) return String(pk).trim();
        return '';
    }

    function v115IsRowSelected(row) {
        if (!row) return false;
        try {
            if (typeof row.matches === 'function' && row.matches('li.selected, .selected, .is-selected, .checked, [aria-selected="true"]')) return true;
        } catch (e) { }
        if (String(row.getAttribute('aria-selected') || '') === 'true') return true;
        if (row.classList && (row.classList.contains('selected') || row.classList.contains('checked'))) return true;
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb && (cb.checked || cb.hasAttribute('checked'))) return true;
        const p = row.closest('.selected, .checked, [aria-selected="true"]');
        if (p) return true;
        return false;
    }

    function get115SelectedItems() {
        const results = [];
        const seen = new Set();
        const docs = [document];
        try {
            document.querySelectorAll('iframe[rel="wangpan"], iframe[src*="115.com"], iframe[src*="/web/"]').forEach(f => {
                try { if (f.contentDocument) docs.push(f.contentDocument); } catch (e) { }
            });
        } catch (e) { }

        for (let d = 0; d < docs.length; d++) {
            const doc = docs[d];
            const allRows = new Set();
            V115_ROW_SELECTORS.forEach(sel => {
                try { doc.querySelectorAll(sel).forEach(el => { allRows.add(el); }); } catch (e) { }
            });
            allRows.forEach(row => {
                if (seen.has(row)) return;
                if (!v115IsRowSelected(row)) return;
                let p = row.parentElement;
                let skip = false;
                while (p && p !== doc.body) { if (allRows.has(p)) { skip = true; break; } p = p.parentElement; }
                if (skip) return;
                seen.add(row);
                const isFolder = v115IsFolderRow(row);
                const fid = v115GetRowId(row, isFolder);
                const fn = v115GetRowName(row);
                if (fid && fn) results.push({ fid, fn, isFolder, row });
            });
        }
        return results;
    }

    // ============================================================
    // 防冲突菜单注入
    // ============================================================
    const MENU_MODERN_ANCHOR_SEL = 'button[data-menu-action="move"], button[data-menu-action="open"], button[data-menu-action="rename"], button[data-menu-action="copy"]';
    const MENU_LEGACY_ANCHOR_SEL = "li[val='open_dir'], li[data-val='open_dir'], li[menu='open_dir']";

    const MODERN_MENU_ICONS = {
        local_code_process: 'M4 2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v12h12V4H4zm2 2h2v2H6V6zm0 4h2v2H6v-2zm4-4h4v2h-4V6zm0 4h4v2h-4v-2z',
        rename_all_multi_date: 'M15 2v2h-2v12h2v2H9v-2h2V4H9V2zm1 3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v-2h2V7h-2V5zm-6 0v2H4v6h6v2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 4v2H5V9z',
        rename_all_multi_zh: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 5h2v2.2A6 6 0 0 1 14.8 11H13v2h-2v2H9v-2H5.2A6 6 0 0 1 11 7.2V5zm0 4.3A4 4 0 0 0 7.3 11H9V9.3zm2 0V11h1.7A4 4 0 0 0 11 9.3z',
        archive_to_folder: 'M3 3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3zm2 1v1h3V4H5zm7-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V3zm2 1v1h1V4h-1zM3 13a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3zm2 1v1h3v-1H5zm7-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3zm2 1v1h1v-1h-1z',
        archive_to_bucket: 'M2 4a2 2 0 0 1 2-2h3v2H4v3H2V4zm14-2a2 2 0 0 1 2 2v3h-2V4h-3V2h3zm2 14a2 2 0 0 1-2 2h-3v-2h3v-3h2v3zm-16 0V13h2v3h3v2H4a2 2 0 0 1-2-2zM7 7h6v2H7V7zm0 4h6v2H7v-2z',
        set_archive_root: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
        get_javdb_rating: 'm10 2.5 2.163 4.383 4.837.703-3.5 3.412.826 4.816L10 13.538l-4.326 2.276.826-4.816L3 7.586l4.837-.703L10 2.5zm0 4.106-1.175 2.38-2.627.382 1.901 1.853-.449 2.617L10 12.604l2.35 1.234-.449-2.617 1.901-1.853-2.627-.382L10 6.606z'
    };

    function findMenuAnchor() {
        try {
            const modern = document.querySelector(MENU_MODERN_ANCHOR_SEL);
            if (modern && modern.parentElement) return { type: 'modern', anchor: modern, parent: modern.parentElement };
        } catch (e) { }
        try {
            const legacy = document.querySelector(MENU_LEGACY_ANCHOR_SEL);
            if (legacy && legacy.parentElement) return { type: 'legacy', anchor: legacy, parent: legacy.parentElement };
        } catch (e) { }
        return null;
    }

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
        if (document.getElementById('rename_list') || document.getElementById('rename_list_modern')) return true;
        const info = findMenuAnchor();
        if (!info) return false;
        const s = loadSettings();
        const visible = MENU_ITEMS.filter(it => s.menuVisibility[it.key] !== false);
        if (!visible.length) return true;

        if (info.type === 'modern') {
            const wrap = document.createElement('div');
            wrap.id = 'rename_list_modern';
            wrap.style.cssText = 'display: contents;';
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
            const textColor = isDark ? '#e5e7eb' : '#1f2937';
            const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : '#F7F9FA';

            visible.forEach(it => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left flex items-center whitespace-nowrap cursor-pointer transition-colors';
                btn.style.cssText = `height: 32px; padding: 0 12px; gap: 12px; font-size: 12px; font-weight: 500; color: ${textColor}; background: transparent; border: none; outline: none;`;
                btn.dataset.renameAction = it.id;

                btn.addEventListener('mouseenter', () => { btn.style.background = hoverBg; });
                btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });

                const iconPath = MODERN_MENU_ICONS[it.id];
                const iconColor = 'var(--dark-only-file-menu-icon, ' + (isDark ? '#9ca3af' : '#4a5568') + ')';
                const svg = iconPath
                    ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" style="flex-shrink:0; width:20px; height:20px;"><g fill="none" fill-rule="evenodd"><path d="M0 0h20v20H0z"></path><path fill="${iconColor}" fill-rule="nonzero" d="${iconPath}"></path></g></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" style="flex-shrink:0; width:20px; height:20px;"><g fill="none" fill-rule="evenodd"><path d="M0 0h20v20H0z"></path><circle cx="10" cy="10" r="2.5" fill="${iconColor}"></circle></g></svg>`;

                btn.innerHTML = svg + `<span style="line-height: 1;">${escapeHtml(it.label)}</span>`;

                btn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleMenuAction(it.id);
                }, true);

                wrap.appendChild(btn);
            });
            info.anchor.insertAdjacentElement('afterend', wrap);
        } else {
            const li = document.createElement('li');
            li.id = 'rename_list';
            visible.forEach(it => {
                const a = document.createElement('a');
                a.id = it.id; a.className = 'mark'; a.href = 'javascript:;'; a.textContent = it.label;
                a.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleMenuAction(it.id);
                }, true);
                li.appendChild(a);
            });
            info.anchor.insertAdjacentElement('beforebegin', li);
        }
        return true;
    }

    function hasJavLaosiji() {
        return !!(window.__LAOSIJI_APP__ || window.__LAOSIJI_RUNTIME__ || document.getElementById('jav-quick-settings-popover'));
    }

    let injectDelayed = false;
    let menuInterval = setInterval(() => {
        if (injectMenu()) {
            clearInterval(menuInterval);
        } else if (!injectDelayed && hasJavLaosiji()) {
            injectDelayed = true;
            clearInterval(menuInterval);
            setTimeout(() => {
                injectMenu();
                menuInterval = setInterval(() => { if (injectMenu()) clearInterval(menuInterval); }, 1000);
            }, 1500);
        }
    }, 800);

    let reinjectTimer = null;
    const menuObserver = new MutationObserver(() => {
        if (document.getElementById('rename_list_modern') || document.getElementById('rename_list')) return;
        clearTimeout(reinjectTimer);
        reinjectTimer = setTimeout(injectMenu, 200);
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });


    // ============================================================
    // 核心解析
    // ============================================================
    function extractFC2Part(str, fc2Num) {
        const s = String(str || '');
        const prefix = '(?:fc2?[-_\\s]*(?:ppv[-_\\s]*)?|ppv[-_\\s]*)0*' + fc2Num;
        let m = s.match(new RegExp(prefix + '[-_.\\s\\[\\](){}]*sp[-_.\\s]*0*(\\d{0,3})(?=$|[^0-9A-Za-z])', 'i'));
        if (m) {
            if (m[1]) { const v = parseInt(m[1], 10); return (v >= 1 && v <= 20) ? 'sp' + v : 'sp'; }
            return 'sp';
        }
        m = s.match(new RegExp(prefix + '[-_.\\s\\[\\](){}]*(?:cd|part|pt|disc|vol|volume|ep)[-_.\\s]*0*(\\d{1,3}|[a-d])(?=$|[^0-9A-Za-z])', 'i'));
        if (m) {
            if (/^\d+$/.test(m[1])) { const n = parseInt(m[1], 10); return (n >= 1 && n <= 20) ? String(n) : ''; }
            return m[1].toUpperCase();
        }
        m = s.match(new RegExp(prefix + '[-_.\\s\\[\\](){}]+0*(\\d{1,2})(?=$|[^0-9A-Za-z])', 'i'));
        if (m) { const v = parseInt(m[1], 10); return (v >= 1 && v <= 20) ? String(v) : ''; }
        m = s.match(new RegExp(prefix + '[-_.\\s]*([a-d])(?=$|[^a-z0-9])', 'i'));
        if (m) return m[1].toUpperCase();
        return '';
    }

    function extractPart(str, code) {
        const s = String(str || '');
        const c = String(code || '');
        if (!c) return '';
        const codePattern = c.replace(/-/g, '[-_\\s.]?');
        let m = s.match(new RegExp(codePattern + '[-_.\\s\\[\\](){}]*(?:cd|part|pt|disc|vol|volume|ep|sp)[-_.\\s]*0*(\\d{1,3}|[a-d])(?=$|[^0-9A-Za-z])', 'i'));
        if (m) {
            if (/^\d+$/.test(m[1])) { const n = parseInt(m[1], 10); return (n >= 1 && n <= 20) ? String(n) : ''; }
            return m[1].toUpperCase();
        }
        m = s.match(new RegExp(codePattern + '[-_.\\s\\[\\](){}]+0*(\\d{1,2})(?=$|[^0-9A-Za-z])', 'i'));
        if (m) { const v = parseInt(m[1], 10); return (v >= 1 && v <= 20) ? String(v) : ''; }
        m = s.match(new RegExp(codePattern + '[-_.\\s\\[\\](){}]+([a-d])(?=$|[^a-z0-9])', 'i'));
        if (m) return m[1].toUpperCase();
        m = s.match(/(?:^|[^A-Za-z0-9])(?:cd|part|pt|disc|vol|volume|ep)[-_.\s\[\](){}]*0*(\d{1,2})(?=$|[^0-9A-Za-z])/i);
        if (m) { const v = parseInt(m[1], 10); return (v >= 1 && v <= 20) ? String(v) : ''; }
        return '';
    }

    function extractJavCode(rawStr) {
        if (!rawStr) return null;
        let s = String(rawStr);
        s = s.replace(/urn:btih:[a-z0-9]+/gi, ' ').replace(/\|(?:\d{6,}|[a-f0-9]{32})(?=\|)/gi, '| ');
        s = s.replace(/\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ');

        let m = s.match(/\b(?:FC2[-_\s]?(?:PPV[-_\s]?)?|PPV[-_\s]?)(\d{6,9})\b/i);
        if (m) return { code: 'FC2-PPV-' + m[1], type: 'fc2', fc2Num: m[1], matchedStr: m[0] };

        m = s.match(/\bHEYDOUGA[-_\s]*(\d{4})[-_\s]+([A-Z0-9]+)\b/i);
        if (m) return { code: 'HEYDOUGA-' + m[1] + '-' + m[2], type: 'heydouga', matchedStr: m[0] };

        m = s.match(/\bGACHI[-_\s]*(\d{3,6})\b/i);
        if (m) return { code: 'GACHI-' + m[1], type: 'gachi', matchedStr: m[0] };

        m = s.match(/\bDUGA[-_\s]+([A-Z0-9]+[-_][A-Z0-9]+)\b/i);
        if (m) return { code: 'DUGA-' + m[1].replace(/_/g, '-'), type: 'duga', matchedStr: m[0] };

        m = s.match(/\bMY[-_\s]?WIFE[-_\s]*(\d+)\b/i);
        if (m) return { code: 'MYWIFE-' + m[1], type: 'mywife', matchedStr: m[0] };

        m = s.match(/\bTOKYO[-_\s]?HOT[-_\s]*([A-Z0-9]+(?:[-_][A-Z0-9]+)?)\b/i);
        if (m) return { code: 'Tokyo-Hot-' + m[1], type: 'tokyo-hot', matchedStr: m[0] };

        const sources = 'PACOPACOMAMA|PACO|10MUSUME|10MU|1PONDO|CARIBBEANCOM|CARIBBEAN|CARIB|HEYZO';
        m = s.match(new RegExp('\\b(' + sources + ')[-_\\s]*(\\d{6})[-_](\\d{2,3})\\b', 'i'));
        if (m) return { code: m[2] + '_' + m[3] + '-' + m[1].toUpperCase(), type: 'uncensored', matchedStr: m[0] };
        m = s.match(new RegExp('\\b(\\d{6})[-_](\\d{2,3})[-_\\s]*(' + sources + ')\\b', 'i'));
        if (m) return { code: m[1] + '_' + m[2] + '-' + m[3].toUpperCase(), type: 'uncensored', matchedStr: m[0] };
        m = s.match(/\b(\d{6})[-_](\d{2,3})(?=$|[^0-9])/);
        if (m) return { code: m[1] + '_' + m[2], type: 'uncensored', matchedStr: m[0] };

        m = s.match(/\b(\d{3}[A-Z]{2,10})[-_\s](\d{2,6})\b/i);
        if (m) return { code: m[1] + '-' + m[2], type: 'digit-prefix', matchedStr: m[0] };

        const garbage = ['FULLHD', 'H264', 'H265', '1080P', '720P', 'PART', 'DISC', '10BIT', 'HHB', 'HHC', 'HHD', 'HHH'];

        m = s.match(/\b([A-Z]{2,15})[-_\s](\d{2,10})[-_](\d{1,3})(?=$|[^0-9])/i);
        if (m && garbage.indexOf(m[1].toUpperCase()) === -1) return { code: m[1].toUpperCase() + '-' + m[2] + '-' + m[3], type: 'standard', matchedStr: m[0] };

        m = s.match(/\b([A-Z]{2,15})[-_\s](\d{2,10})(?=$|[^0-9])/i);
        if (m && garbage.indexOf(m[1].toUpperCase()) === -1) {
            const num = m[2].replace(/^0+(?=\d{3})/, '');
            return { code: m[1].toUpperCase() + '-' + num, type: 'standard', matchedStr: m[0] };
        }

        m = s.match(/\b([A-Z]{2,10})(\d{3,6})\b/i);
        if (m && garbage.indexOf(m[1].toUpperCase()) === -1) {
            const num = m[2].replace(/^0+(?=\d{3})/, '');
            return { code: m[1].toUpperCase() + '-' + num, type: 'compact', matchedStr: m[0] };
        }
        return null;
    }

    const CODE_PREFIXES = (function () {
        const prefixes = MANUAL_PREFIXES.slice();
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {
            const p = letters[i] + letters[j];
            if (GARBAGE_WORDS.indexOf(p) === -1 && prefixes.indexOf(p) === -1) prefixes.push(p);
        }
        for (let i = 0; i < 26; i++) {
            const p = letters[i];
            if (GARBAGE_WORDS.indexOf(p) === -1 && prefixes.indexOf(p) === -1) prefixes.push(p);
        }
        prefixes.sort((a, b) => b.length - a.length);
        return prefixes;
    })();

    const CODE_PREFIX_PATTERNS = CODE_PREFIXES.map(p => ({ prefix: p, regex: new RegExp('\\b' + p + '[-_ ]?0*(\\d{1,5})(?![0-9])', 'i') }));

    function matchCodeByPrefix(str) {
        if (!str) return null;
        for (let i = 0; i < CODE_PREFIX_PATTERNS.length; i++) {
            const item = CODE_PREFIX_PATTERNS[i];
            const m = str.match(item.regex);
            if (m) return { code: item.prefix + '-' + (m[1] === '0' ? '0' : m[1]).padStart(3, '0'), matchedStr: m[0] };
        }
        const loose = str.match(/\b([A-Z]{2,8})\s*0*(\d{2,5})(?![0-9])/);
        if (loose && GARBAGE_WORDS.indexOf(loose[1]) === -1 && loose[1].length > 1) {
            let num = Number(loose[2]).toString();
            if (num === '0') num = '0';
            return { code: loose[1] + '-' + num.padStart(3, '0'), matchedStr: loose[0] };
        }
        return null;
    }

    function checkUncensored(baseCode, raw) {
        if (/无码|無修正|uncensored/i.test(raw)) return true;
        if (/^Tokyo-Hot-/i.test(baseCode) || /^1PONDO-/i.test(baseCode) || /^CARIB-/i.test(baseCode) || /^HEYZO-/i.test(baseCode) || /^10MU-/i.test(baseCode) || /^MURA-/i.test(baseCode) || /^H4610-/i.test(baseCode) || /^NAMA-/i.test(baseCode) || /_/.test(baseCode)) return true;
        return false;
    }

    function removeCodeFromTitle(str, baseCode) {
        if (!baseCode) return str;
        let s = String(str);
        if (/^FC2-PPV-\d+$/i.test(baseCode)) {
            const num = baseCode.match(/\d+$/)[0];
            return s.replace(new RegExp('(?:fc2[-_.\\s]*(?:ppv[-_.\\s]*)?|ppv[-_.\\s]*)0*' + num + '(?![0-9])', 'gi'), ' ').replace(/\s+/g, ' ').trim();
        }
        if (/^Tokyo-Hot-/i.test(baseCode)) {
            const m = baseCode.match(/n?(\d+)$/i);
            if (m) return s.replace(new RegExp('(?:tokyo[-_.\\s]*hot[-_.\\s]*[nN]?|tokyohot[nN]?|hot[nN]?)0*' + m[1] + '(?![0-9])', 'gi'), ' ').replace(/\s+/g, ' ').trim();
        }
        const parts = baseCode.split('-');
        if (parts.length >= 2) {
            const prefix = parts[0].replace(/_/g, '[-_\\s]');
            const num = parts[1].replace(/^0+/, '') || parts[1];
            return s.replace(new RegExp('\\b' + prefix + '[-_.\\s]*0*' + num + '(?![0-9])', 'gi'), ' ').replace(/\s+/g, ' ').trim();
        }
        return s;
    }

    const parseVideoInfo = (origTitle, safeSuffix) => {
        try {
            if (!origTitle) return null;
            let raw = String(origTitle);
            raw = stripDomainPrefix(raw);
            let rawForCode = safeSuffix ? raw.slice(0, raw.lastIndexOf(safeSuffix)) : raw;

            // 1. 提取标记
            const markers = [];
            rawForCode.replace(MARKER_PATTERN, (m, p1, offset, full) => {
                if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(m)) {
                    const prev = offset > 0 ? full[offset - 1] : '';
                    const next = offset + m.length < full.length ? full[offset + m.length] : '';
                    if (/[a-z0-9]/i.test(prev) && /[a-z0-9]/i.test(next)) return m;
                }
                const nm = MARKER_MAP[m.toLowerCase()];
                if (nm && markers.indexOf(nm) === -1) markers.push(nm);
                return m;
            });

            // 2. 提取日期
            let dateStr = '';
            const dm = rawForCode.match(/(?:\b|_|^|@|】|\[|【)((?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2})(?:\b|_|$|(?=[A-Za-z\u4e00-\u9fa5【\[\]】]))/i);
            if (dm) {
                const parts = dm[1].trim().split(/[-_\/\.\s]+/);
                if (parts.length === 3) {
                    const year = parts[0].length === 2 ? '20' + parts[0] : parts[0];
                    dateStr = year + '-' + String(parts[1]).padStart(2, '0') + '-' + String(parts[2]).padStart(2, '0');
                }
                rawForCode = rawForCode.replace(dm[0], ' ');
            }

            // 3. 强力预清洗，防止帧率、画质后缀干扰番号识别
            let cleanForCode = rawForCode;
            cleanForCode = cleanForCode.replace(/[-_.\s]*hh[bcdh]\d*/gi, ' ');
            cleanForCode = cleanForCode.replace(/[-_.\s]*(?:4k|4ks|8k|2160p|1080p|720p)?\s*(?:60|120|30)\s*fps/gi, ' ');
            cleanForCode = cleanForCode.replace(/[-_.\s]*\b(?:4k|8k|2160p|1080p|720p)\b/gi, ' ');
            cleanForCode = cleanForCode.replace(/\s+/g, ' ').trim();

            // 4. 提取分段
            let part = '';
            const partMatch = cleanForCode.match(/(?:^|[^A-Za-z0-9])(?:cd|part|pt|disc|vol|volume|ep|sp)[-_.\s\[\](){}]*0*(\d{1,3}|[a-d])(?=$|[^0-9A-Za-z])/i);
            if (partMatch) {
                part = partMatch[1];
            } else {
                // 如果找不到，用原始字符串再找一次（应对某些奇怪格式）
                const rawPartMatch = rawForCode.match(/(?:^|[^A-Za-z0-9])(?:cd|part|pt|disc|vol|volume|ep|sp)[-_.\s\[\](){}]*0*(\d{1,3}|[a-d])(?=$|[^0-9A-Za-z])/i);
                if (rawPartMatch) part = rawPartMatch[1];
            }

            // 5. 提取番号
            let queryCode = null, displayCode = null;
            const extracted = extractJavCode(cleanForCode);
            if (extracted) {
                queryCode = normalize115Name(extracted.code);
                displayCode = queryCode;

                // 用极其宽容的正则抹去原串中的番号残留，绝不影响其他信息
                const rawMatchStr = extracted.matchedStr || extracted.code;
                let cleanPattern;
                const prefix = rawMatchStr.split(/[-_ ]/)[0].replace(/[^A-Z0-9]/gi, '');
                const num = rawMatchStr.replace(prefix, '').replace(/[^0-9]/g, '').replace(/^0+/, '');
                if (prefix && num) {
                    cleanPattern = new RegExp(`\\b${prefix}[-_.\\s]*0*${num}(?![0-9])`, 'i');
                } else {
                    cleanPattern = new RegExp(escapeRegExp(rawMatchStr).replace(/-/g, '[-_\\s.]?') + '(?![0-9])', 'i');
                }
                cleanForCode = cleanForCode.replace(cleanPattern, ' ');
            } else {
                const backup = matchCodeByPrefix(cleanForCode);
                if (backup) {
                    queryCode = backup.code;
                    displayCode = backup.code;
                    const cleanPattern = new RegExp(escapeRegExp(backup.matchedStr).replace(/-/g, '[-_\\s.]?'), 'i');
                    cleanForCode = cleanForCode.replace(cleanPattern, ' ');
                }
            }

            if (!queryCode) return null;
            const baseCode = displayCode || queryCode;

            if (checkUncensored(baseCode, rawForCode) && markers.indexOf('无码') === -1) markers.push('无码');

            const safeB = queryCode.replace(/_/g, '-').replace(/-/g, '[-_ ]?');
            if (rawForCode.indexOf('中文') !== -1 || new RegExp(safeB + '[_-](UC|C)\\b', 'i').test(rawForCode)) {
                if (markers.indexOf('中文字幕') === -1) markers.push('中文字幕');
            }
            if (rawForCode.indexOf('无码') !== -1 || new RegExp(safeB + '[_-](UC|U)\\b', 'i').test(rawForCode)) {
                if (markers.indexOf('无码') === -1) markers.push('无码');
            }

            let finalPart = part;
            if (finalPart) {
                finalPart = String(finalPart).toLowerCase();
                const segPref = loadSettings().segmentPrefix;
                if (/^\d+$/.test(finalPart) && segPref) finalPart = segPref + finalPart;
            }
            const fullCode = finalPart ? baseCode + '-' + finalPart : baseCode;

            // 6. 清理标题
            const garbageRegex = new RegExp('\\b(' + GARBAGE_WORDS.join('|') + ')\\b', 'gi');
            let cleanTitle = removeMarkers(cleanForCode);
            cleanTitle = cleanTitle.replace(RESOLUTION_FPS_PATTERN, ' ');
            cleanTitle = cleanTitle.replace(garbageRegex, ' ');
            cleanTitle = cleanTitle.replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ');
            cleanTitle = cleanTitle.replace(AD_BADGES, ' ');
            cleanTitle = cleanTitle.replace(/(?:^|[\s_\-\.])(?:cd|part|pt|disc|vol|volume|ep|sp)(?=$|[\s_\-\.])/gi, ' ');
            cleanTitle = cleanTitle.replace(/[_\.]+/g, ' ');
            cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
            cleanTitle = removeCodeFromTitle(cleanTitle, baseCode);
            cleanTitle = cleanTitle.replace(/^[\s_\-\.]+|[\s_\-\.]+$/g, '').trim();
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
        const actresses = (info && info.actresses) || [];
        const dateStr = (info && info.date) || vInfo.date || '';

        let actressStr = '';
        if (actresses.length) {
            const list = [], seen = {};
            for (let i = 0; i < actresses.length; i++) {
                const std = getStandardActressName(actresses[i]);
                if (!std || !isPlausibleActressToken(std)) continue;
                const key = folderNameKey(std);
                if (!key || seen[key]) continue;
                seen[key] = true;
                list.push(std);
            }
            actressStr = list.join(s.actressSeparator || '・');
        }

        let cleanTitle = originalTitle ? removeCodeFromTitle(originalTitle, vInfo.baseCode).replace(/【[^】]*】/g, '').trim() : '';
        let cleanZhTitle = zhTitle ? removeCodeFromTitle(zhTitle, vInfo.baseCode).replace(/【[^】]*】/g, '').trim() : '';
        if (isPunctOnly(cleanTitle)) cleanTitle = '';
        if (isPunctOnly(cleanZhTitle)) cleanZhTitle = '';

        const fieldValues = { code: vInfo.fullCode, title: cleanTitle, zhTitle: cleanZhTitle, actresses: actressStr, date: dateStr };
        const enabled = { code: true, title: s.enableTitle, zhTitle: s.enableZhTitle, actresses: s.enableActresses, date: s.enableDate };
        const order = String(s.fieldOrder || 'code,title,actresses,date').split(',').map(x => x.trim()).filter(Boolean);
        const parts = [];
        for (let i = 0; i < order.length; i++) {
            const f = order[i];
            if (!enabled[f]) continue;
            const v = fieldValues[f];
            if (!v) continue;
            if (f === 'date' && s.datePrefix) parts.push(s.datePrefix + v);
            else parts.push(v);
        }
        let name = parts.join(s.fieldSeparator || ' ');

        if (s.enableMarkers && vInfo.markers && vInfo.markers.length) {
            const uniq = Array.from(new Set(vInfo.markers)).filter(Boolean);
            const existing = name.match(/【[^】]*】/g) || [];
            const toAdd = uniq.filter(m => existing.indexOf('【' + m + '】') === -1);
            if (toAdd.length) name += toAdd.map(m => '【' + m + '】').join('');
        }

        if (suffix) {
            name = name.replace(/[\s.]+$/, '');
            name += suffix;
        }
        name = name.replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
        return sanitizeFileName(name);
    };

    const isRawDownloadSiteName = fileName => {
        const base = stripFileExt(String(fileName || '')).replace(/\s+/g, '').toLowerCase();
        if (!base) return false;
        if (/^(?:[a-z0-9.-]+@)?h_\d+[a-z]{2,10}\d{2,6}(?:ex)?(?:hh[bcdh])?\d*(?:[_-]?(?:4k|4ks|4k60fps|60fps|1080p|720p|fhd|hd))?\d*$/.test(base)) return true;
        if (/^(?:[a-z0-9.-]+@)?[a-z]{2,10}\d{2,6}(?:ex)?hh[bcdh]\d*(?:[_-]?(?:4k|4ks|4k60fps|60fps|1080p|720p|fhd|hd))?\d*$/.test(base)) return true;
        if (/^(?:[a-z0-9.-]+@)?\d{1,4}[a-z]{2,10}\d{2,8}v(?:[_-]?(?:4k|4ks|4k60fps|60fps|1080p|720p|fhd|hd))?\d*$/.test(base)) return true;
        if (/^(?:hhd800\.com@|www\.98t\.la@)/i.test(String(fileName))) return true;
        return false;
    };

    const hasManualNamePayload = (fileName, code) => {
        if (!loadSettings().protectManualName) return false;
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
        variants.forEach(v => { if (v) base = base.replace(new RegExp(escapeRegExp(v).replace(/[-_\s]+/g, '[-_\\s]*'), 'ig'), ' '); });
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
        return asciiWords.length >= 2 || asciiWords.join('').length >= 10;
    };

    // ============================================================
    // 缓存与刮削源
    // ============================================================
    function getCache(k) { try { return JSON.parse(GM_getValue(k, '{}')); } catch (e) { return {}; } }
    function setCache(k, d) { GM_setValue(k, JSON.stringify(d)); }
    let infoCache = getCache('jb_infoCache');
    let actressCache = getCache('jb_actressCache');
    let ratingCache = getCache('jb_ratingCache');
    let negativeCache = getCache('jb_negativeCache');

    const isInfoCacheValid = code => {
        const e = infoCache[code];
        if (!e) return false;
        if (!e.cachedAt) return true;
        return (Date.now() - Number(e.cachedAt)) < (loadSettings().cacheTtlDays || 90) * 86400000;
    };
    const storeInfo = (key, info) => { if (info) info.cachedAt = Date.now(); infoCache[key] = info; setCache('jb_infoCache', infoCache); };
    const isNegativeCached = code => {
        const e = negativeCache[code];
        if (!e || !e.cachedAt) return false;
        return (Date.now() - Number(e.cachedAt)) < (loadSettings().negativeCacheTtlHours || 24) * 3600000;
    };
    const markNegativeCached = code => { negativeCache[code] = { cachedAt: Date.now() }; setCache('jb_negativeCache', negativeCache); };

    const javbusBase = 'https://www.javbus.com/';
    const javbusUncensoredBase = javbusBase + 'uncensored/';
    const javlibSearchBase = 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=';
    const javlibBase = 'https://www.javlibrary.com/';
    const xslistBase = 'https://xslist.org/tw/';
    const javdbBase = 'https://javdb.com';
    const javdbSearchBase = javdbBase + '/search?q=';
    const fc2ppvdbBase = 'https://fc2ppvdb.com/articles/';

    function trySearchVariants(code, onQuery, onFail) {
        const v = getCodeQueryVariants(code);
        let i = 0;
        const next = () => { if (i >= v.length) return onFail && onFail(v.join('/')); const q = v[i++]; onQuery(q, next); };
        next();
    }

    function fetchJavlib(code) {
        return new Promise((resolve, reject) => {
            trySearchVariants(code, (q, next) => {
                gmRequest({ method: 'GET', url: javlibSearchBase + encodeURIComponent(q), anonymous: true, timeout: 15000 })
                    .then(res => {
                        const doc = parseHTML(res.responseText);
                        const a = doc.querySelector('#video_title a') || doc.querySelector('div.video a[href*="?v="]');
                        let link = a ? a.getAttribute('href') : '';
                        if (!link) { next(); return; }
                        if (link.charAt(0) === '/') link = javlibBase.replace(/\/+$/, '') + link;
                        return gmRequest({ method: 'GET', url: link, anonymous: true, timeout: 15000 });
                    }).then(res2 => {
                        if (!res2) { next(); return; }
                        const ddoc = parseHTML(res2.responseText);
                        let ttl = '';
                        const ta = ddoc.querySelector('#video_title a');
                        if (ta) ttl = ta.textContent.trim();
                        else { const td = ddoc.querySelector('#video_title'); if (td) ttl = td.textContent.trim(); }
                        if (ttl.toUpperCase().indexOf(code.toUpperCase()) === 0) ttl = ttl.slice(code.length).trim();
                        if (isNotFoundTitle(ttl)) ttl = '';
                        const dateEl = ddoc.querySelector('#video_date td.text');
                        const isoDate = dateEl ? normDate(dateEl.textContent.trim()) : '';
                        const actresses = [];
                        ddoc.querySelectorAll('#video_cast td.text a').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                        if (!ttl) { next(); return; }
                        resolve({ title: ttl, date: isoDate, actresses });
                    }).catch(() => { next(); });
            }, () => { reject(new Error('JavLibrary 无结果')); });
        });
    }

    function fetchJavbus(code) {
        return new Promise((resolve, reject) => {
            const variants = getCodeQueryVariants(code).filter(v => !/[\s_]/.test(v));
            let vi = 0;
            const tryOne = q => {
                const tryBase = u => gmRequest({ method: 'GET', url: u + q, anonymous: true, timeout: 15000 }).then(res => {
                    const doc = parseHTML(res.responseText);
                    let ttl = '';
                    const h3 = doc.querySelector('h3');
                    if (h3) { ttl = h3.textContent.trim(); if (ttl.toUpperCase().indexOf(code.toUpperCase()) === 0) ttl = ttl.slice(code.length).trim(); }
                    if (!ttl) { const img = doc.querySelector('div.photo-frame img'); if (img) ttl = img.getAttribute('title') || ''; }
                    if (!ttl) {
                        const t = doc.querySelector('title');
                        if (t) { ttl = t.textContent.trim(); if (ttl.indexOf(' - JavBus') !== -1) ttl = ttl.split(' - JavBus')[0].trim(); if (ttl.toUpperCase().indexOf(code.toUpperCase()) === 0) ttl = ttl.slice(code.length).trim(); }
                    }
                    if (isNotFoundTitle(ttl)) ttl = '';
                    if (!ttl) return Promise.reject();
                    let isoDate = '';
                    doc.querySelectorAll('p').forEach(p => { const t = p.textContent.trim(); if (/發行日期|发行日期/.test(t)) { const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m) isoDate = normDate(m[1]); } });
                    if (!isoDate) { const p = doc.querySelector('.info p:nth-of-type(2)'); if (p) isoDate = normDate(p.textContent.replace(/.*?[:：]/, '').trim()); }
                    const actresses = [];
                    doc.querySelectorAll('span.genre a[href*="/star/"]').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                    const info = { title: ttl, date: isoDate, actresses };
                    if (u.indexOf('uncensored') !== -1) info.uncensored = true;
                    return info;
                }).catch(() => { throw new Error('fail'); });
                tryBase(javbusBase).catch(() => tryBase(javbusUncensoredBase))
                    .then(i => resolve(i))
                    .catch(() => { vi++; if (vi < variants.length) tryOne(variants[vi]); else reject(new Error('JavBus 无结果')); });
            };
            tryOne(variants[0]);
        });
    }

    function fetchXslist(code) {
        return new Promise((resolve, reject) => {
            trySearchVariants(code, (q, next) => {
                gmRequest({ method: 'GET', url: xslistBase + 'search?query=' + encodeURIComponent(q), anonymous: true, timeout: 15000 })
                    .then(res => {
                        const sdoc = parseHTML(res.responseText);
                        const parsePage = doc => {
                            const uc = code.toUpperCase().replace(/[-_\s]/g, '');
                            let tr = null;
                            doc.querySelectorAll('#movices tbody tr').forEach(row => { const s = row.querySelector('td strong'); const c = (s ? s.textContent : '').trim().toUpperCase().replace(/[-_\s]/g, ''); if (c === uc) tr = row; });
                            if (!tr) return null;
                            const tds = tr.querySelectorAll('td');
                            const ttl = tds[1] ? tds[1].textContent.trim() : '';
                            const dt = tds[2] ? tds[2].textContent.trim() : '';
                            let isoDate = '';
                            if (dt && !/n\/a/i.test(dt)) isoDate = normDate(dt);
                            const an = doc.querySelector('h1 span[itemprop="name"]');
                            const aname = an ? an.textContent.trim() : '';
                            if (!ttl) return null;
                            return { title: ttl, date: isoDate, actresses: aname ? [aname] : [] };
                        };
                        let info = null;
                        if (sdoc.querySelector('#movices') && sdoc.querySelector('h1 span[itemprop="name"]')) {
                            info = parsePage(sdoc);
                            if (info) { resolve(info); return; }
                        }
                        const linkEl = sdoc.querySelector('a[href*="/model/"]');
                        let link = linkEl ? linkEl.getAttribute('href') : '';
                        if (!link) { next(); return; }
                        if (link.charAt(0) === '/') link = xslistBase.replace(/\/+$/, '') + link;
                        gmRequest({ method: 'GET', url: link, anonymous: true, timeout: 15000 }).then(r2 => {
                            const i2 = parsePage(parseHTML(r2.responseText));
                            if (i2) resolve(i2); else next();
                        }).catch(() => next());
                    }).catch(() => next());
            }, () => { reject(new Error('xslist 无结果')); });
        });
    }

    function fetchJavdb(code) {
        return new Promise((resolve, reject) => {
            trySearchVariants(code, (q, next) => {
                gmRequest({ method: 'GET', url: javdbSearchBase + encodeURIComponent(q) + '&f=all', anonymous: true, timeout: 15000 })
                    .then(res => {
                        const hdoc = parseHTML(res.responseText);
                        const a = hdoc.querySelector('a[href*="/v/"]') || hdoc.querySelector('.movie-list .item a');
                        let link = a ? a.getAttribute('href') : '';
                        if (!link) { next(); return; }
                        if (link.charAt(0) === '/') link = javdbBase + link;
                        return gmRequest({ method: 'GET', url: link, anonymous: true, timeout: 15000 });
                    }).then(r2 => {
                        if (!r2) { next(); return; }
                        const ddoc = parseHTML(r2.responseText);
                        let ttl = '';
                        const h2 = ddoc.querySelector('h2.title');
                        if (h2) ttl = h2.textContent.trim();
                        else { const s = ddoc.querySelector('strong.current-title'); if (s) ttl = s.textContent.trim(); }
                        if (ttl.toUpperCase().indexOf(code.toUpperCase()) === 0) ttl = ttl.slice(code.length).trim();
                        if (isNotFoundTitle(ttl)) ttl = '';
                        let dt = '';
                        ddoc.querySelectorAll('.panel-block').forEach(b => { const t = b.textContent.trim(); if (/日期:|發行日期:|发行日期:/.test(t)) dt = t.replace(/.*?[:：]/, '').trim(); });
                        const isoDate = normDate(dt);
                        const actorEntries = [];
                        ddoc.querySelectorAll('a[href*="/actors/"]').forEach(a => {
                            const n = a.textContent.trim();
                            if (!n) return;
                            let gender = 'unknown';
                            const own = [a.textContent, a.getAttribute('data-gender'), a.getAttribute('title')].filter(Boolean).join(' ');
                            if (/♀|female|woman|女(?:優|优|演员|演員)?/i.test(own)) gender = 'female';
                            else if (/♂|male|man|男(?:優|优|演员|演員)?/i.test(own)) gender = 'male';
                            else { const sib = a.nextElementSibling; if (sib) { const txt = String(sib.textContent || '').trim(); if (/♀/.test(txt)) gender = 'female'; else if (/♂/.test(txt)) gender = 'male'; } }
                            actorEntries.push({ name: n, gender });
                        });
                        if (!ttl) { next(); return; }
                        resolve({ title: ttl, date: isoDate, actresses: actorEntries.map(e => e.name), actorEntries });
                    }).catch(() => next());
            }, () => { reject(new Error('JavDB 无结果')); });
        });
    }

    function fetchFC2PPVDB(code) {
        const num = code.match(/\d+$/)[0];
        return gmRequest({ method: 'GET', url: fc2ppvdbBase + num, anonymous: true, timeout: 15000 }).then(res => {
            const doc = parseHTML(res.responseText);
            let title = null;
            const link = doc.querySelector('a[href*="adult.contents.fc2.com"]');
            if (link) title = link.textContent.trim();
            if (!title) { const t = doc.querySelector('title'); title = t ? t.textContent.trim() : ''; if (title.indexOf(' - FC2PPVDB') !== -1) title = title.replace(' - FC2PPVDB', '').trim(); }
            if (!title) throw new Error('无标题');
            return { title, date: '', actresses: [] };
        });
    }

    function fetchMissavFC2(code) {
        const expectedId = code.toLowerCase();
        return new Promise((resolve, reject) => {
            const sign = path => {
                const dbId = 'missav-default';
                const token = 'Ikkg568nlM51RHvldlPvc2GzZPE9R4XGzaH9Qj4zK9npbbbTly1gj9K4mgRn0QlV';
                const ts = Math.floor(Date.now() / 1000);
                const unsigned = '/' + dbId + path + '?frontend_timestamp=' + ts;
                if (!globalThis.crypto || !globalThis.crypto.subtle) return Promise.reject(new Error('WebCrypto'));
                const enc = new TextEncoder();
                return globalThis.crypto.subtle.importKey('raw', enc.encode(token), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
                    .then(k => globalThis.crypto.subtle.sign('HMAC', k, enc.encode(unsigned)))
                    .then(sig => unsigned + '&frontend_sign=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));
            };
            sign('/search/users/anonymous/items/').then(p => {
                return gmRequest({
                    method: 'POST',
                    url: 'https://client-rapi-missav.recombee.com' + p,
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    data: JSON.stringify({ searchQuery: code, count: 10, cascadeCreate: true, returnProperties: true }),
                    anonymous: true, timeout: 15000
                });
            }).then(res => {
                const data = JSON.parse(res.responseText);
                const items = Array.isArray(data && data.recomms) ? data.recomms : [];
                const exact = items.find(it => String((it && it.id) || '').toLowerCase() === expectedId);
                if (!exact || !exact.values) throw new Error('No match');
                const v = exact.values;
                const title = String(v.title || '').trim();
                if (!title) throw new Error('No title');
                const actors = [].concat(Array.isArray(v.actresses) ? v.actresses : [], Array.isArray(v.actors) ? v.actors : []);
                let date = null;
                const ra = Number(v.released_at);
                if (Number.isFinite(ra) && ra > 0) date = new Date(ra * 1000).toISOString().slice(0, 10);
                return { title, date, actresses: actors };
            }).then(resolve).catch(reject);
        });
    }

    function fetchAvsox(code) {
        return gmRequest({ method: 'GET', url: 'https://avsox.host/cn/search/' + encodeURIComponent(code), anonymous: true, timeout: 15000 }).then(res => {
            const doc = parseHTML(res.responseText);
            const item = doc.querySelector('.movie-box');
            if (!item) throw new Error('No movie');
            const tEl = item.querySelector('.title') || item.querySelector('.name');
            if (!tEl) throw new Error('No title');
            const title = tEl.textContent.trim();
            const dEl = doc.querySelector('.date') || doc.querySelector('.info .date');
            const date = dEl ? dEl.textContent.trim() : '';
            const actresses = [];
            doc.querySelectorAll('.star a, .actress a').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
            if (!title) throw new Error('No content');
            return { title, date, actresses, uncensored: true };
        });
    }

    function fetchAvmoo(code) {
        return gmRequest({ method: 'GET', url: 'https://avmoo.host/cn/search/' + encodeURIComponent(code), anonymous: true, timeout: 15000 }).then(res => {
            const doc = parseHTML(res.responseText);
            const item = doc.querySelector('.movie-box');
            if (!item) throw new Error('No movie');
            const tEl = item.querySelector('.title') || item.querySelector('.name');
            if (!tEl) throw new Error('No title');
            const title = tEl.textContent.trim();
            const dEl = doc.querySelector('.date') || doc.querySelector('.info .date');
            const date = dEl ? dEl.textContent.trim() : '';
            const actresses = [];
            doc.querySelectorAll('.star a, .actress a').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
            return { title, date, actresses, uncensored: true };
        });
    }

    // 自定义源通用解析器（智能兼容有无横杠）
    function fetchCustomSource(code, urlTemplate) {
        const codeStr = String(code).toUpperCase();
        const idStr = codeStr.replace(/[^A-Z0-9]/g, '');

        const url1 = urlTemplate.replace(/\{code\}/gi, encodeURIComponent(codeStr)).replace(/\{id\}/gi, encodeURIComponent(idStr)).replace(/\{\}/g, encodeURIComponent(codeStr));
        const url2 = urlTemplate.replace(/\{code\}/gi, encodeURIComponent(idStr)).replace(/\{id\}/gi, encodeURIComponent(codeStr)).replace(/\{\}/g, encodeURIComponent(idStr));

        const urls = [...new Set([url1, url2])]; // 去重

        const fetchOne = (url) => {
            return gmRequest({ method: 'GET', url, anonymous: true, timeout: 15000 }).then(res => {
                const doc = parseHTML(res.responseText);
                let title = '';
                let date = '';
                let actresses = [];

                const h1 = doc.querySelector('h2.title, .video-title, .entry-title, #video_title');
                if (h1) title = h1.textContent.trim();
                if (!title) {
                    const t = doc.querySelector('title');
                    if (t) title = t.textContent.trim();
                }

                title = title.replace(/ - .*?$/, '').trim();

                const text = doc.body ? doc.body.textContent : '';
                const dm = text.match(/(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/);
                if (dm) date = normDate(dm[0]);

                doc.querySelectorAll('a[href*="/star/"], a[href*="/actors/"], a[href*="actor"]').forEach(a => {
                    const n = a.textContent.trim();
                    if (n && !actresses.includes(n)) actresses.push(n);
                });

                if (!title) throw new Error('无法解析自定义源的标题');
                return { title, date, actresses };
            });
        };

        // 并发请求所有变体，只要有一个成功就返回
        return new Promise((resolve, reject) => {
            let pending = urls.length;
            let failed = false;
            urls.forEach(url => {
                fetchOne(url).then(resolve).catch(() => {
                    pending--;
                    if (pending === 0 && !failed) {
                        failed = true;
                        reject(new Error('自定义源均请求失败'));
                    }
                });
            });
        });
    }

    const SOURCE_REGISTRY = {
        javdb: fetchJavdb, javbus: fetchJavbus, javlibrary: fetchJavlib, xslist: fetchXslist,
        fc2ppvdb: fetchFC2PPVDB, missav: fetchMissavFC2, avsox: fetchAvsox, avmoo: fetchAvmoo
    };

    function fetchRemoteInfo(code, isUncensored) {
        const key = code.toUpperCase();
        if (isInfoCacheValid(key)) return Promise.resolve(infoCache[key]);
        if (isNegativeCached(key)) return Promise.reject(new Error('Negative'));
        const s = loadSettings();

        const order = String(s.sourceOrder || DEFAULT_SETTINGS.sourceOrder).split(',').map(x => x.trim()).filter(Boolean);
        const enabled = new Set(String(s.scrapeSources || DEFAULT_SETTINGS.scrapeSources).split(',').map(x => x.trim()).filter(Boolean));
        const customList = String(s.customSources || '').split(',').map(x => x.trim()).filter(Boolean);

        const promises = [];

        order.forEach(k => {
            if (!enabled.has(k)) return;
            if (k === 'custom') {
                customList.forEach((url, idx) => {
                    promises.push(fetchCustomSource(code, url).then(i => { storeInfo('custom_' + idx, i); return i; }).catch(() => null));
                });
            } else if (SOURCE_REGISTRY[k]) {
                promises.push(SOURCE_REGISTRY[k](code).then(i => { storeInfo(k, i); return i; }).catch(() => null));
            }
        });

        if (!promises.length) return Promise.reject(new Error('No sources'));

        return new Promise((resolve, reject) => {
            let settled = false;
            const check = () => {
                if (settled) return;
                Promise.allSettled(promises).then(rs => {
                    const first = rs.find(r => r.status === 'fulfilled' && r.value);
                    if (first) { settled = true; resolve(first.value); }
                    else { settled = true; markNegativeCached(key); reject(new Error('All failed')); }
                });
            };
            let remaining = promises.length;
            promises.forEach(p => p.finally(() => { remaining--; if (remaining === 0) check(); }));
            setTimeout(check, 30000);
        });
    }

    function translateTitleToChinese(title) {
        return new Promise(resolve => {
            const src = String(title || '').trim();
            if (!src) { resolve(''); return; }
            const deepL = () => gmRequest({
                method: 'POST',
                url: 'https://oneshot-free.www.deepl.com/v1/translate',
                headers: { 'Authorization': 'None', 'Content-Type': 'application/json' },
                data: JSON.stringify({ text: [src], source_lang: 'ja', target_lang: 'zh-Hans' }),
                anonymous: true, timeout: 15000
            }).then(r => {
                const d = JSON.parse(r.responseText);
                const t = d && d.translations && d.translations[0] && d.translations[0].text ? d.translations[0].text.trim() : '';
                if (t && t !== src) return t;
                throw new Error('empty');
            });
            const mm = () => gmRequest({
                method: 'GET',
                url: 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(src) + '&langpair=ja%7Czh-CN',
                anonymous: true, timeout: 15000
            }).then(r => {
                const d = JSON.parse(r.responseText);
                if (d.responseStatus !== 200) throw new Error('status');
                const t = d && d.responseData && d.responseData.translatedText ? d.responseData.translatedText.trim() : '';
                if (t && t !== src && !/MYMEMORY WARNING|DAILY LIMIT/i.test(t)) return t;
                throw new Error('invalid');
            });
            deepL().catch(() => mm()).then(t => resolve(t)).catch(() => resolve(''));
        });
    }

    async function getTargetName(vInfo, suffix) {
        const code = vInfo.queryCode;
        const key = code.toUpperCase();
        if (isInfoCacheValid(key)) return buildNameFromInfo(vInfo, infoCache[key], suffix);
        try {
            const unc = vInfo.markers && vInfo.markers.indexOf('无码') !== -1;
            const info = await fetchRemoteInfo(code, unc);
            if (info) { storeInfo(key, info); return await buildNameFromInfo(vInfo, info, suffix); }
            return null;
        } catch (e) { return null; }
    }

    async function buildNameFromInfo(vInfo, info, suffix) {
        const s = loadSettings();
        if (info && info.uncensored && vInfo.markers && vInfo.markers.indexOf('无码') === -1) vInfo.markers.push('无码');
        let zhTitle = '';
        if (s.translateChinese && info && info.title) {
            const t = await translateTitleToChinese(info.title);
            if (t && t !== info.title) zhTitle = t;
        }
        return buildNewName(vInfo, Object.assign({}, info, { zhTitle }), suffix);
    }

    window.rename_multi = function (fid, vInfo, suffix, callback, origFilename) {
        getTargetName(vInfo, suffix).then(newName => {
            if (newName) send_115(fid, newName, vInfo.fullCode, origFilename, callback);
            else {
                if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode)) showPageNotification(vInfo.fullCode + ' 已保护手动命名，跳过', 'info', 3000);
                else showPageNotification('所有信息源未找到 ' + vInfo.queryCode, 'error', 4000);
                if (typeof callback === 'function') callback();
            }
        }).catch(() => { if (typeof callback === 'function') callback(); });
    };

    function local_rename(fid, vInfo, suffix, callback, origFilename) {
        const info = { title: vInfo.localTitle, date: vInfo.date, actresses: [] };
        const newName = buildNewName(vInfo, info, suffix);
        const bareName = buildNewName(vInfo, { title: '', date: vInfo.date, actresses: [] }, suffix);
        if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode) && newName === bareName) {
            showPageNotification(vInfo.fullCode + ' 已保护手动命名，跳过', 'info', 3000);
            if (typeof callback === 'function') callback();
            return;
        }
        send_115(fid, newName, vInfo.fullCode, origFilename, callback);
    }

    let renameCompareList = [];

    function send_115(id, name, fh, origFilename, callback) {
        const fn = sanitizeFileName(name);
        fetch('https://webapi.115.com/files/edit', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'fid=' + encodeURIComponent(id) + '&file_name=' + encodeURIComponent(fn)
        }).then(r => r.json()).then(r => {
            if (!r.state) showPageNotification(fh + ' 修改失败: ' + (r.error || ''), 'error', 3000);
            else {
                showPageNotification(fh + ' 修改成功', 'success', 2000);
                if (origFilename) renameCompareList.push({ original: origFilename, new: name });
            }
            if (typeof callback === 'function') callback();
        }).catch(() => { showPageNotification(fh + ' 请求失败', 'error', 3000); if (typeof callback === 'function') callback(); });
    }

    window.renameInProgress = false;

    function runTasksWithLimit(tasks, limit, intervalMs, doneAll) {
        if (!tasks.length) { doneAll && doneAll(); return; }
        let idx = 0, running = 0, done = false;
        const finish = () => { if (!done) { done = true; doneAll && doneAll(); } };
        const next = () => {
            if (idx >= tasks.length && running === 0) { finish(); return; }
            while (running < limit && idx < tasks.length) {
                if (window.progressBox && window.progressBox.paused) { setTimeout(next, 500); return; }
                const t = tasks[idx++];
                running++;
                setTimeout(() => { t(() => { running--; setTimeout(next, intervalMs || 0); }); }, 0);
            }
        };
        next();
    }

    window.progressBox = {
        init(title, total) {
            this.total = total || 0; this.current = 0; this.title = title || '任务进度'; this.paused = false;
            let box = document.getElementById('task-progress-box');
            if (!box) {
                document.body.insertAdjacentHTML('beforeend', '<div id="task-progress-box" style="display:none;"><div style="display:flex;align-items:center;gap:8px;"><button id="tp-pause-btn" style="width:22px;height:22px;line-height:1;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;font-size:11px;padding:0;">⏸</button><div class="tp-title"></div></div><div class="tp-bar-outer"><div class="tp-bar-inner"></div></div><div class="tp-text"></div></div>');
                box = document.getElementById('task-progress-box');
                document.getElementById('tp-pause-btn').addEventListener('click', function () {
                    window.progressBox.paused = !window.progressBox.paused;
                    this.textContent = window.progressBox.paused ? '▶️' : '⏸';
                    window.showPageNotification(window.progressBox.paused ? '任务已暂停' : '任务已继续', 'info', 2000);
                });
            }
            box.querySelector('.tp-title').textContent = this.title;
            this.update(0);
            box.style.display = '';
        },
        update(doneCount) {
            this.current = doneCount;
            const pct = Math.min(100, Math.round(doneCount * 100 / (this.total || 1)));
            const box = document.getElementById('task-progress-box');
            if (!box) return;
            box.querySelector('.tp-bar-inner').style.width = pct + '%';
            box.querySelector('.tp-text').textContent = doneCount + '/' + this.total + ' (' + pct + '%)';
        },
        finish() { this.paused = false; this.update(this.total); const b = document.getElementById('task-progress-box'); if (b) setTimeout(() => { b.style.display = 'none'; }, 800); }
    };

    const toastQueue = [];
    let toastActive = 0;
    const TOAST_MAX = 3;
    const flushToast = () => { if (toastQueue.length && toastActive < TOAST_MAX) toastQueue.shift()(); };

    window.showPageNotification = function (msg, type, duration) {
        if (type == null) type = 'info';
        if (!duration) duration = type === 'error' ? 5000 : 3000;
        const show = () => {
            toastActive++;
            const id = 'cn-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            document.body.insertAdjacentHTML('beforeend', `<div id="${id}" class="custom-notification ${type}">${msg}</div>`);
            const el = document.getElementById(id);
            setTimeout(() => el.classList.add('show'), 10);
            setTimeout(() => {
                el.classList.remove('show');
                setTimeout(() => { el.remove(); toastActive--; flushToast(); }, 300);
            }, duration);
        };
        if (toastActive >= TOAST_MAX) { toastQueue.push(show); return; }
        show();
    };

    function showRenamePreview(rows, onConfirm, onCancel) {
        const old = document.getElementById('rename-preview-overlay');
        if (old) old.remove();

        const styleId = 'rename-preview-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
            .rp-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:99999; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
            .rp-panel { width:min(1100px,calc(100vw - 32px)); max-height:88vh; background:#fff; border-radius:12px; box-shadow:0 12px 48px rgba(0,0,0,0.35); display:flex; flex-direction:column; overflow:hidden; color:#333; }
            .rp-header { padding:16px 20px; background:linear-gradient(135deg,#1a6dff,#1890ff); color:#fff; display:flex; justify-content:space-between; align-items:center; }
            .rp-header h3 { margin:0; font-size:16px; font-weight:600; }
            .rp-toolbar { padding:10px 16px; border-bottom:1px solid #eee; display:flex; gap:10px; align-items:center; }
            .rp-toolbar button { padding:5px 12px; border:1px solid #d9d9d9; border-radius:4px; background:#fff; cursor:pointer; font-size:13px; color:#333; }
            .rp-toolbar span { font-size:13px; color:#666; margin-left:auto; }
            .rp-body { flex:1; overflow:auto; padding:8px 0; background:#fff; }
            .rp-row { display:flex; align-items:flex-start; gap:10px; padding:7px 16px; border-bottom:1px solid #f5f5f5; font-size:13px; }
            .rp-col-code { flex-shrink:0; width:150px; font-family:monospace; color:#1890ff; font-weight:600; }
            .rp-col-old { flex:1; min-width:0; word-break:break-all; color:#333; }
            .rp-col-new { flex:1.2; min-width:0; word-break:break-all; color:#1890ff; }
            .rp-col-status { flex-shrink:0; width:96px; text-align:center; font-weight:500; }
            .rp-footer { padding:12px 20px; border-top:1px solid #eee; text-align:right; background:#fafafa; }
            .rp-footer button { padding:8px 18px; border-radius:6px; font-size:14px; cursor:pointer; }
            .rp-btn-cancel { border:1px solid #d9d9d9; background:#fff; margin-right:10px; color:#333; }
            .rp-btn-confirm { border:none; background:#1a6dff; color:#fff; font-weight:600; }

            html[data-theme="dark"] .rp-panel, html[data-theme="dark"] .rp-body, html[data-theme="dark"] .rp-footer { background:#1e1e1e; color:#e5e7eb; border-color:#333; }
            html[data-theme="dark"] .rp-toolbar { border-color:#333; }
            html[data-theme="dark"] .rp-toolbar button, html[data-theme="dark"] .rp-btn-cancel { background:#2d2d2d; border-color:#444; color:#d1d5db; }
            html[data-theme="dark"] .rp-toolbar span { color:#9ca3af; }
            html[data-theme="dark"] .rp-row { border-color:#2d2d2d; }
            html[data-theme="dark"] .rp-col-code { color:#60a5fa; }
            html[data-theme="dark"] .rp-col-old { color:#cbd5e1; }
            html[data-theme="dark"] .rp-col-new { color:#60a5fa; }
            html[data-theme="dark"] .rp-footer { border-color:#333; }
            html[data-theme="dark"] .rp-btn-confirm { background:#2563eb; }
        `;
            document.head.appendChild(style);
        }

        const overlay = document.createElement('div');
        overlay.id = 'rename-preview-overlay';
        overlay.className = 'rp-overlay';
        overlay.innerHTML = `
        <div class="rp-panel">
            <div class="rp-header">
                <h3>改名预览</h3>
                <span id="rename-preview-close" style="cursor:pointer;font-size:22px;line-height:1;">×</span>
            </div>
            <div class="rp-toolbar">
                <button id="rp-select-all">全选</button>
                <button id="rp-invert">反选</button>
                <span id="rp-summary"></span>
            </div>
            <div id="rp-body" class="rp-body"></div>
            <div class="rp-footer">
                <button id="rp-cancel" class="rp-btn-cancel">取消</button>
                <button id="rp-confirm" class="rp-btn-confirm">确认改名</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);

        const body = document.getElementById('rp-body');
        const updateSummary = () => {
            const checked = document.querySelectorAll('.rp-chk:checked').length;
            document.getElementById('rp-summary').textContent = `共 ${rows.length} 个，已选 ${checked} 个`;
        };

        rows.forEach((row, idx) => {
            const tr = document.createElement('div');
            tr.className = 'rp-row';
            const statusColor = row.status === '手动命名保护' ? '#fa8c16' : (row.status === '未找到' || row.status === '错误' ? '#cf1322' : '#52c41a');
            tr.innerHTML = `
            <input type="checkbox" class="rp-chk" data-idx="${idx}" ${row.checked ? 'checked' : ''} style="margin-top:2px;flex-shrink:0;width:16px;height:16px;accent-color:#1a6dff;">
            <div class="rp-col-code">${escapeHtml(row.item.vi.fullCode)}</div>
            <div class="rp-col-old">${escapeHtml(row.item.fn)}</div>
            <div class="rp-col-new">${escapeHtml(row.newName || '—')}</div>
            <div class="rp-col-status" style="color:${statusColor};">${escapeHtml(row.status)}</div>`;
            body.appendChild(tr);
        });

        updateSummary();
        body.addEventListener('change', e => { if (e.target.classList.contains('rp-chk')) updateSummary(); });
        document.getElementById('rp-select-all').addEventListener('click', () => { document.querySelectorAll('.rp-chk').forEach(c => c.checked = true); updateSummary(); });
        document.getElementById('rp-invert').addEventListener('click', () => { document.querySelectorAll('.rp-chk').forEach(c => c.checked = !c.checked); updateSummary(); });
        document.getElementById('rename-preview-close').addEventListener('click', () => { overlay.remove(); onCancel(); });
        document.getElementById('rp-cancel').addEventListener('click', () => { overlay.remove(); onCancel(); });
        document.getElementById('rp-confirm').addEventListener('click', () => {
            const selected = [];
            document.querySelectorAll('.rp-chk:checked').forEach(c => selected.push(rows[Number(c.dataset.idx)]));
            overlay.remove();
            onConfirm(selected);
        });
    }

    function buildPreviewRows(parsedItems, isLocal, done) {
        if (isLocal) {
            const rows = parsedItems.map(item => {
                const info = { title: item.vi.localTitle, date: item.vi.date, actresses: [] };
                const newName = buildNewName(item.vi, info, item.safeSuffix);
                const bare = buildNewName(item.vi, { title: '', date: item.vi.date, actresses: [] }, item.safeSuffix);
                const prot = hasManualNamePayload(item.fn, item.vi.queryCode) && newName === bare;
                return { item, newName: prot ? null : newName, status: prot ? '手动命名保护' : '本地', checked: !prot };
            });
            done(rows);
            return;
        }
        const codes = Array.from(new Set(parsedItems.map(i => i.vi.queryCode.toUpperCase())));
        const missing = codes.filter(c => !isInfoCacheValid(c));
        const after = () => {
            let remaining = parsedItems.length;
            const results = new Array(parsedItems.length);
            parsedItems.forEach((item, idx) => {
                getTargetName(item.vi, item.safeSuffix).then(nn => {
                    let st = '网络', ch = true;
                    if (!nn) { st = hasManualNamePayload(item.fn, item.vi.queryCode) ? '手动命名保护' : '未找到'; ch = false; }
                    results[idx] = { item, newName: nn, status: st, checked: ch };
                    if (--remaining === 0) done(results.filter(Boolean));
                }).catch(() => {
                    results[idx] = { item, newName: null, status: '错误', checked: false };
                    if (--remaining === 0) done(results.filter(Boolean));
                });
            });
        };
        if (!missing.length) { after(); return; }
        let pi = 0;
        const prefetch = () => {
            if (pi >= missing.length) { after(); return; }
            const c = missing[pi++];
            fetchRemoteInfo(c).catch(() => { }).finally(() => setTimeout(prefetch, 200));
        };
        const conc = Math.min(3, missing.length);
        for (let i = 0; i < conc; i++) prefetch();
    }

    function persistCaches() {
        setCache('jb_infoCache', infoCache);
        setCache('jb_actressCache', actressCache);
        setCache('jb_ratingCache', ratingCache);
        setCache('jb_negativeCache', negativeCache);
    }

    function rename(call) {
        if (window.renameInProgress) { showPageNotification('已有任务进行中', 'info', 2000); return; }
        window.renameInProgress = true;
        const s = loadSettings();

        const selected = get115SelectedItems();
        if (!selected.length) { showPageNotification('请先选择文件或文件夹', 'info', 3000); window.renameInProgress = false; return; }

        const parsedItems = [];
        selected.forEach(item => {
            const safeSuffix = getSafeSuffix(item.fn);
            const vi = parseVideoInfo(item.fn, safeSuffix);
            if (vi) parsedItems.push({ fid: item.fid, fn: item.fn, safeSuffix, vi });
        });

        if (!parsedItems.length) { showPageNotification('未识别到有效番号', 'info', 3000); window.renameInProgress = false; return; }

        const isLocal = (call === local_rename);
        let finished = false;
        const finishRename = () => {
            if (finished) return;
            finished = true;
            progressBox.finish();
            showPageNotification('所有文件处理完成', 'success', 5000);
            persistCaches();
            offerCompareExport();
            window.renameInProgress = false;
        };
        const cancelRename = () => { persistCaches(); showPageNotification('已取消', 'info', 2000); window.renameInProgress = false; };

        const execRename = rows => {
            if (!rows.length) { cancelRename(); return; }
            progressBox.init(isLocal ? '本地番号规范' : '联网改名', rows.length);
            renameCompareList = [];
            let processed = 0;
            const tasks = rows.map(row => done => {
                send_115(row.item.fid, row.newName, row.item.vi.fullCode, row.item.fn, () => {
                    processed++;
                    progressBox.update(processed);
                    done();
                });
            });
            const conc = isLocal ? Math.max(3, s.renameConcurrency) : s.renameConcurrency;
            runTasksWithLimit(tasks, conc, 200, finishRename);
        };

        if (isLocal) buildPreviewRows(parsedItems, true, rows => showRenamePreview(rows, execRename, cancelRename));
        else {
            showPageNotification('正在联网生成预览...', 'info', 4000);
            buildPreviewRows(parsedItems, false, rows => showRenamePreview(rows, execRename, cancelRename));
        }
    }

    function offerCompareExport() {
        if (renameCompareList.length === 0) return;
        if (confirm('改名已完成，是否导出对比？')) {
            if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) exportCompareToFile(renameCompareList);
            else copyCompareToClipboard(renameCompareList);
        }
    }
    function exportCompareToFile(list) {
        const text = list.map(i => `${i.original}\t${i.new}`).join('\n');
        downloadTxt('Rename_Compare.txt', '【旧文件名】\t【新文件名】\n' + text);
    }
    function copyCompareToClipboard(list) {
        const text = list.map(i => `${i.original}\t${i.new}`).join('\n');
        copyToClipboard('【旧文件名】\t【新文件名】\n' + text);
    }

    function downloadTxt(filename, text) {
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showPageNotification('TXT 已下载', 'success', 3000);
    }
    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showPageNotification('已复制', 'success', 3000))
                .catch(() => { GM_setClipboard(text); showPageNotification('已复制', 'success', 3000); });
        } else { GM_setClipboard(text); showPageNotification('已复制', 'success', 3000); }
    }

    let archiveRootCid = null, archiveRootName = null, archiveRootPath = '';
    function initArchiveRoot() {
        loadSettings();
        if (SETTINGS.archiveRootCid) { archiveRootCid = SETTINGS.archiveRootCid; archiveRootName = SETTINGS.archiveRootName; archiveRootPath = SETTINGS.archiveRootPath || ''; }
        else { archiveRootCid = GM_getValue('archiveRootCid', null); archiveRootName = GM_getValue('archiveRootName', null); archiveRootPath = GM_getValue('archiveRootPath', ''); }
    }
    initArchiveRoot();

    function getPathCid(path) {
        return fetch('https://webapi.115.com/files/getid?path=' + encodeURIComponent('/' + String(path || '').replace(/^\/+/, '')), { credentials: 'include' })
            .then(r => r.json())
            .then(d => { const id = d.id || d.cid || d.file_id; return id ? String(id) : null; })
            .catch(() => null);
    }

    function createFolderApi(pid, name) {
        return fetch('https://webapi.115.com/files/add', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'pid=' + encodeURIComponent(pid || 0) + '&cname=' + encodeURIComponent(name)
        }).then(r => r.json()).then(d => {
            if (d.state) return String(d.cid || d.id);
            if (d.errno === 20004) return 'CONFLICT';
            throw new Error(d.error || '创建失败');
        });
    }

    async function resolveArchiveRootByPath(path) {
        path = String(path || '').trim().replace(/^\/+|\/+$/g, '');
        if (!path) return { cid: null, name: null, path: '' };
        const parts = path.split('/').filter(Boolean);
        let parentCid = 0;
        for (let i = 0; i < parts.length; i++) {
            const cur = parts.slice(0, i + 1).join('/');
            let cid = await getPathCid(cur);
            if (!cid) {
                try { const r = await createFolderApi(parentCid, parts[i]); cid = r === 'CONFLICT' ? await getPathCid(cur) : r; } catch (e) { cid = await getPathCid(cur); }
            }
            if (!cid) throw new Error('目录不存在且无法创建：' + parts[i]);
            parentCid = cid;
        }
        return { cid: String(parentCid), name: parts[parts.length - 1] || '', path };
    }

    function getSeriesFromCode(code) {
        const c = (typeof code === 'object' ? code.queryCode : String(code)).toUpperCase();
        if (/^FC2-PPV/.test(c) || /^\d{6}_\d{3}$/.test(c) || /^1PONDO[-_]/.test(c) || /^CARIB[-_]/.test(c)) return null;
        const m = c.match(/^([A-Z]+)-\d+/);
        return m ? m[1] : null;
    }

    const folderCidCache = {};
    const ROOT_DIR_CID = '0';

    function findOrCreateFolderAndMove(fid, folderName, ok, fail) {
        const cid = archiveRootCid || ROOT_DIR_CID;
        const cleanName = String(folderName || '').replace(/[\\/:*?"<>|]/g, ' ');
        if (folderCidCache[cleanName]) { moveFileToFolder(fid, folderCidCache[cleanName], cleanName, ok, fail); return; }
        fetch(`https://webapi.115.com/files/search?search_value=${encodeURIComponent(cleanName)}&format=json&aid=1&cid=${cid}&file_type=0&limit=1000`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => {
                if (d.state && d.data && d.data.count > 0) {
                    const f = d.data.list.find(it => it.name === cleanName && it.file_type === '0');
                    if (f) { folderCidCache[cleanName] = f.cid; moveFileToFolder(fid, f.cid, cleanName, ok, fail); return; }
                }
                return createFolderApi(cid, cleanName).then(r => {
                    if (r === 'CONFLICT') return getPathCid(cleanName).then(c => c);
                    return r;
                }).then(newCid => {
                    if (newCid) { folderCidCache[cleanName] = newCid; moveFileToFolder(fid, newCid, cleanName, ok, fail); }
                    else { showPageNotification('创建文件夹失败', 'error', 3000); if (typeof fail === 'function') fail('fail'); }
                });
            }).catch(() => { showPageNotification('搜索/创建文件夹失败', 'error', 3000); if (typeof fail === 'function') fail('net'); });
    }

    function moveFileToFolder(fid, targetCid, folderName, ok, fail) {
        fetch('https://webapi.115.com/files/move', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'pid=' + encodeURIComponent(targetCid) + '&fid=' + encodeURIComponent(fid)
        }).then(r => r.json()).then(d => {
            if (d.state) { showPageNotification('已归档到 ' + folderName, 'success', 2000); if (typeof ok === 'function') ok(); }
            else { showPageNotification('归档失败: ' + (d.error || ''), 'error', 5000); if (typeof fail === 'function') fail(d.error); }
        }).catch(() => { showPageNotification('移动请求失败', 'error', 5000); if (typeof fail === 'function') fail('net'); });
    }

    function archiveToActorFolder() {
        const selected = get115SelectedItems();
        if (!selected.length) { showPageNotification('请先选择', 'info', 3000); return; }
        if (!archiveRootCid) { showPageNotification('请先设置归档根目录', 'error', 5000); return; }

        const parsedItems = [];
        selected.forEach(item => {
            const ss = getSafeSuffix(item.fn);
            const vi = parseVideoInfo(item.fn, ss);
            if (vi) parsedItems.push({ fid: item.fid, fn: item.fn, vi });
        });
        if (!parsedItems.length) { showPageNotification('未识别到有效番号', 'info', 3000); return; }

        const codes = Array.from(new Set(parsedItems.map(i => i.vi.queryCode.toUpperCase())));
        const missing = codes.filter(c => {
            if (actressCache[c] && actressCache[c].length) return false;
            if (isInfoCacheValid(c) && infoCache[c].actresses && infoCache[c].actresses.length) { actressCache[c] = infoCache[c].actresses; return false; }
            return true;
        });

        const start = () => {
            const s = loadSettings();
            progressBox.init('归档', parsedItems.length);
            let processed = 0, success = 0;
            const tasks = parsedItems.map(item => done => {
                const code = item.vi.queryCode;
                if (/^FC2-PPV-\d{5,8}$/i.test(code)) {
                    findOrCreateFolderAndMove(item.fid, 'FC2', () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
                } else {
                    let folderName = '';
                    const key = code.toUpperCase();
                    const entries = (isInfoCacheValid(key) && infoCache[key].actorEntries) || [];
                    const rawA = (actressCache[key] && actressCache[key][0]) || '';
                    if (entries.length > 0) {
                        const pref = entries.find(e => e.gender === 'female') || entries.find(e => e.gender === 'unknown') || entries[0];
                        folderName = pref ? getStandardActressName(pref.name) : '';
                    } else if (rawA) folderName = getStandardActressName(rawA);
                    if (!folderName) folderName = getSeriesFromCode(code) || '其他';
                    findOrCreateFolderAndMove(item.fid, folderName, () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
                }
            });
            runTasksWithLimit(tasks, s.archiveConcurrency || 3, 500, () => {
                progressBox.finish();
                showPageNotification('归档完成：成功 ' + success + '/' + parsedItems.length, 'success', 5000);
                persistCaches();
            });
        };

        if (missing.length) {
            progressBox.init('预取演员信息', missing.length);
            let i = 0;
            const next = () => {
                if (i >= missing.length) { progressBox.finish(); start(); return; }
                const code = missing[i++];
                progressBox.update(i);
                fetchRemoteInfo(code).then(info => {
                    if (info) {
                        infoCache[code.toUpperCase()] = info;
                        if (info.actresses && info.actresses.length) actressCache[code.toUpperCase()] = info.actresses;
                    }
                }).finally(() => setTimeout(next, 500));
            };
            const conc = Math.min(2, missing.length);
            for (let j = 0; j < conc; j++) next();
        } else start();
    }

    function getBucketFolderName(code) {
        const c = String(code).toUpperCase();
        if (/^FC2-PPV/.test(c)) return 'FC2';
        const m = c.match(/^([A-Z]+)-(\d+)$/);
        if (m) {
            const num = parseInt(m[2], 10);
            const start = Math.floor(num / 1000) * 1000;
            return m[1] + '-' + String(start).padStart(4, '0') + '-' + String(start + 999).padStart(4, '0');
        }
        return '其他';
    }

    function archiveToBucketFolder() {
        const selected = get115SelectedItems();
        if (!selected.length) { showPageNotification('请先选择', 'info', 3000); return; }
        if (!archiveRootCid) { showPageNotification('请先设置归档根目录', 'error', 5000); return; }

        const parsedItems = [];
        selected.forEach(item => {
            const ss = getSafeSuffix(item.fn);
            const vi = parseVideoInfo(item.fn, ss);
            if (vi) parsedItems.push({ fid: item.fid, fn: item.fn, vi });
        });
        if (!parsedItems.length) { showPageNotification('未识别到有效番号', 'info', 3000); return; }

        const s = loadSettings();
        progressBox.init('分桶归档', parsedItems.length);
        let processed = 0, success = 0;
        const tasks = parsedItems.map(item => done => {
            const bucket = getBucketFolderName(item.vi.queryCode);
            findOrCreateFolderAndMove(item.fid, bucket, () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
        });
        runTasksWithLimit(tasks, s.archiveConcurrency || 3, 500, () => {
            progressBox.finish();
            showPageNotification('分桶归档完成：成功 ' + success + '/' + parsedItems.length, 'success', 5000);
        });
    }

    function fetchRatingForCode(code) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'GET', url: javdbSearchBase + encodeURIComponent(code) + '&f=all', timeout: 15000, anonymous: true,
                onload: xhr => {
                    if (xhr.status !== 200) { resolve(null); return; }
                    try {
                        const doc = parseHTML(xhr.responseText);
                        const item = doc.querySelector('.movie-list .item');
                        if (!item) { resolve(null); return; }
                        let r = parseFloat(item.getAttribute('score'));
                        if (isNaN(r)) { const rel = item.querySelector('.score .value'); if (rel) { const m = rel.textContent.match(/(\d+\.\d+)分/); if (m) r = parseFloat(m[1]); } }
                        if (!isNaN(r)) { resolve(Math.round(r)); return; }
                        const a = item.querySelector('a.box');
                        if (!a) { resolve(null); return; }
                        const href = a.getAttribute('href');
                        GM_xmlhttpRequest({
                            method: 'GET', url: javdbBase + (href.charAt(0) === '/' ? href : '/' + href), timeout: 15000, anonymous: true,
                            onload: dx => {
                                try {
                                    const dd = parseHTML(dx.responseText);
                                    const rEl = dd.querySelector('.panel-block .value');
                                    if (rEl) { const rr = parseFloat(rEl.textContent.match(/(\d+\.\d+)/)[1]); if (!isNaN(rr)) { resolve(Math.round(rr)); return; } }
                                    resolve(null);
                                } catch (e) { resolve(null); }
                            },
                            onerror: () => resolve(null), ontimeout: () => resolve(null)
                        });
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null), ontimeout: () => resolve(null)
            });
        });
    }

    function update115Rating(fid, star, fh, fname, callback) {
        star = Math.max(1, Math.min(5, star));
        const finish = ok => { showPageNotification(`"${fh}"评分${ok ? `更新为 ${star} 星` : '失败'}`, ok ? 'success' : 'error', 2000); callback(ok); };
        fetch('https://webapi.115.com/files/score', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'file_id=' + encodeURIComponent(fid) + '&score=' + star
        }).then(r => r.json()).then(r => { if (r && r.state) finish(true); else finish(false); })
            .catch(() => finish(false));
    }

    function getJavdbRating() {
        const selected = get115SelectedItems();
        if (!selected.length) { showPageNotification('请先选择', 'info', 3000); return; }
        const parsedItems = [];
        selected.forEach(item => {
            const ss = getSafeSuffix(item.fn);
            const vi = parseVideoInfo(item.fn, ss);
            if (vi && vi.queryCode) parsedItems.push({ fid: item.fid, fn: item.fn, vi });
        });
        if (!parsedItems.length) { showPageNotification('未识别到有效番号', 'info', 3000); return; }

        const codes = Array.from(new Set(parsedItems.map(i => i.vi.queryCode.toUpperCase())));
        const missing = codes.filter(c => !ratingCache[c]);

        const start = () => {
            progressBox.init('更新评分', parsedItems.length);
            let processed = 0, success = 0;
            const tasks = parsedItems.map(item => done => {
                const code = item.vi.queryCode.toUpperCase();
                const star = ratingCache[code];
                if (star) {
                    update115Rating(item.fid, star, item.vi.queryCode, item.fn, ok => {
                        processed++; if (ok) success++; progressBox.update(processed); done();
                    });
                } else { processed++; progressBox.update(processed); done(); }
            });
            runTasksWithLimit(tasks, 2, 300, () => {
                progressBox.finish();
                showPageNotification('评分完成：成功 ' + success + '/' + parsedItems.length, 'success', 5000);
                setCache('jb_ratingCache', ratingCache);
            });
        };

        if (missing.length) {
            progressBox.init('获取评分', missing.length);
            let i = 0;
            const next = () => {
                if (i >= missing.length) { progressBox.finish(); start(); return; }
                const code = missing[i++];
                progressBox.update(i);
                fetchRatingForCode(code).then(s => { if (s) ratingCache[code] = s; }).finally(() => setTimeout(next, 300));
            };
            const conc = Math.min(2, missing.length);
            for (let j = 0; j < conc; j++) next();
        } else start();
    }

    // ============================================================
    // 重构：紧凑版设置面板 (OLED 纯黑适配，无滑动，一屏展示)
    // ============================================================
    function openSettingsPanel() {
        const old = document.getElementById('rename2026-settings-shadow');
        if (old) old.remove();

        loadSettings();
        const s = SETTINGS;
        const fieldKeys = String(s.fieldOrder).split(',').map(x => x.trim()).filter(Boolean);
        const sourceKeys = String(s.sourceOrder).split(',').map(x => x.trim()).filter(Boolean);
        const enabledSrc = new Set(String(s.scrapeSources || '').split(',').map(x => x.trim()).filter(Boolean));
        const customStr = String(s.customSources || '').trim();

        const srcLabels = { javdb: 'JavDB', javbus: 'JavBus', javlibrary: 'JavLibrary', xslist: 'Xslist', fc2ppvdb: 'FC2PPVDB', missav: 'MissAV', avsox: 'Avsox', avmoo: 'AVMoo', custom: '自定义源' };
        const mv = s.menuVisibility || {};

        const host = document.createElement('div');
        host.id = 'rename2026-settings-shadow';
        host.style.cssText = 'position:fixed;inset:0;z-index:10000070;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
        document.body.appendChild(host);

        const shadow = host.attachShadow({ mode: 'open' });
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;

        const themeVars = isDark ? `
            --bg: #000000;
            --panel: #000000;
            --text: #e5e5e5;
            --text-muted: #888888;
            --border: #333333;
            --primary: #2563eb;
            --hover: #1a1a1a;
            --input-bg: #111111;
            --input-border: #444444;
        ` : `
            --bg: #f8fafc;
            --panel: #ffffff;
            --text: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --primary: #2563eb;
            --hover: #f1f5f9;
            --input-bg: #ffffff;
            --input-border: #cbd5e1;
        `;

        const style = document.createElement('style');
        style.textContent = `
            :host { ${themeVars} }
            * { box-sizing: border-box; }
            .rs-panel { width: 860px; height: 620px; max-width: 95vw; max-height: 90vh; background: var(--panel); border-radius: 10px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; overflow: hidden; color: var(--text); border: 1px solid var(--border); font-family: -apple-system, sans-serif; }
            .rs-sidebar { width: 160px; background: var(--bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 12px 0; flex-shrink: 0; }
            .rs-logo { font-size: 15px; font-weight: bold; padding: 0 16px 12px; color: var(--primary); border-bottom: 1px solid var(--border); margin-bottom: 8px; }
            .rs-nav-btn { display: block; width: 100%; text-align: left; padding: 8px 16px; border: none; background: transparent; color: var(--text); font-size: 13px; cursor: pointer; outline: none; }
            .rs-nav-btn:hover { background: var(--hover); }
            .rs-nav-btn.active { background: var(--primary); color: #fff; font-weight: 500; }
            
            .rs-sidebar-footer { margin-top: auto; padding: 12px 16px; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 6px; }
            .rs-sidebar-footer a { color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 4px; }
            .rs-sidebar-footer a:hover { text-decoration: underline; }

            .rs-content { flex: 1; padding: 20px 24px; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
            .rs-header { font-size: 14px; font-weight: 600; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
            .rs-section { display: none; flex-direction: column; gap: 12px; flex: 1; }
            .rs-section.active { display: flex; }
            
            .rs-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
            
            .rs-row { display: flex; align-items: center; background: var(--bg); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); min-width: 0; overflow: hidden; }
            .rs-label { font-size: 13px; white-space: nowrap; flex: 1; }
            .rs-input { background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text); border-radius: 4px; padding: 4px 6px; font-size: 12px; outline: none; min-width: 0; flex-shrink: 0; }
            .rs-input:focus { border-color: var(--primary); }
            .rs-input[type="number"] { width: 60px; text-align: center; }
            .rs-input[type="text"] { width: 80px; }
            .rs-checkbox { width: 16px; height: 16px; accent-color: var(--primary); cursor: pointer; margin: 0; }

            .drag-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
            .drag-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); min-width: 0; }
            .drag-item.dragging { opacity: 0.5; border-style: dashed; border-color: var(--primary); }
            .drag-item.is-required { opacity: 0.7; cursor: default; }
            .drag-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
            .drag-handle { color: var(--text-muted); font-size: 16px; user-select: none; padding: 0 4px; cursor: grab; flex-shrink: 0; }

            .rs-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: auto; border-top: 1px solid var(--border); padding-top: 12px; flex-shrink: 0; }
            .rs-btn { padding: 5px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; border: 1px solid transparent; font-weight: 500; }
            .rs-btn-primary { background: var(--primary); color: #fff; }
            .rs-btn-primary:hover { opacity: 0.9; }
            .rs-btn-default { background: transparent; border-color: var(--border); color: var(--text); }
            .rs-btn-default:hover { background: var(--hover); }
        `;

        let fieldListHtml = '';
        fieldKeys.forEach((key) => {
            const def = FIELD_DEFINITIONS[key]; if (!def) return;
            const checked = def.fixed || (s[def.settingKey] !== false);
            const dis = def.fixed;
            fieldListHtml += `
                <div class="drag-item ${key === 'code' ? 'is-required' : ''}" data-key="${key}">
                    <div class="drag-left">
                        <input type="checkbox" class="rs-checkbox" data-field-enable="${key}" ${checked ? 'checked' : ''} ${dis ? 'disabled' : ''}>
                        <span class="rs-label">${def.label}</span>
                    </div>
                    <div class="drag-handle">≡</div>
                </div>
            `;
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'rs-panel';
        wrapper.innerHTML = `
            <div class="rs-sidebar">
                <div class="rs-logo">115Rename</div>
                <button class="rs-nav-btn active" data-target="tab-common">通用</button>
                <button class="rs-nav-btn" data-target="tab-menu">右键菜单</button>
                <button class="rs-nav-btn" data-target="tab-sources">刮削源</button>
                <div class="rs-sidebar-footer">
                    <a href="https://github.com/liuchanghuaX1/115Rename2026" target="_blank">⭐ GitHub</a>
                    <span>版本 v${SCRIPT_VERSION}</span>
                </div>
            </div>
            <div class="rs-content">
                <div id="tab-common" class="rs-section active">
                    <div class="rs-header">字段顺序与开关</div>
                    <div class="drag-list" id="rs-field-list">${fieldListHtml}</div>
                    
                    <div class="rs-header" style="margin-top: 8px;">常规设置</div>
                    <div class="rs-grid-2">
                        <div class="rs-row">
                            <span class="rs-label">字段分隔符</span>
                            <input class="rs-input" type="text" id="rs-field-sep" value="${escapeHtml(s.fieldSeparator)}">
                        </div>
                        <div class="rs-row">
                            <span class="rs-label">日期前缀</span>
                            <input class="rs-input" type="text" id="rs-date-prefix" value="${escapeHtml(s.datePrefix)}">
                        </div>
                        <div class="rs-row">
                            <span class="rs-label">演员分隔符</span>
                            <input class="rs-input" type="text" id="rs-actress-sep" value="${escapeHtml(s.actressSeparator)}">
                        </div>
                        <div class="rs-row">
                            <span class="rs-label">分段标记</span>
                            <input class="rs-input" type="text" id="rs-segment-prefix" value="${escapeHtml(s.segmentPrefix || '')}">
                        </div>
                        <div class="rs-row">
                            <span class="rs-label">并发数</span>
                            <input class="rs-input" type="number" id="rs-rename-concurrency" value="${s.renameConcurrency}" min="1" max="10">
                        </div>
                        <div class="rs-row">
                            <span class="rs-label">常规选项</span>
                            <div style="display:flex; gap: 16px; align-items:center;">
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input class="rs-checkbox" type="checkbox" id="rs-protect-manual" ${s.protectManualName ? 'checked' : ''}>
                                    <span class="rs-label">保护命名</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                    <input class="rs-checkbox" type="checkbox" id="rs-enable-markers" ${s.enableMarkers ? 'checked' : ''}>
                                    <span class="rs-label">附加标记</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="rs-header" style="margin-top: 8px;">归档根目录</div>
                    <div style="display:flex; gap:8px;">
                        <input class="rs-input" style="flex:1; width:auto;" type="text" id="rs-archive-path" value="${escapeHtml(s.archiveRootPath || '')}" placeholder="/归档">
                        <button class="rs-btn rs-btn-primary" id="rs-archive-apply">解析</button>
                        <button class="rs-btn rs-btn-default" id="rs-clear-archive-root" style="color:#ef4444; border-color:#fca5a5;">清除</button>
                    </div>
                    <p style="margin:0;font-size:12px;color:var(--text-muted);">当前：${archiveRootCid ? '「' + escapeHtml(archiveRootPath || archiveRootName) + '」' : '未设置'}</p>
                </div>

                <div id="tab-menu" class="rs-section">
                    <div class="rs-header">右键菜单开关</div>
                    <div class="drag-list">
                        ${MENU_ITEMS.map(it => `
                            <div class="drag-item">
                                <div class="drag-left">
                                    <input class="rs-checkbox" type="checkbox" data-menu-vis="${it.key}" ${mv[it.key] !== false ? 'checked' : ''}>
                                    <span class="rs-label">${it.label}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div id="tab-sources" class="rs-section">
                    <div class="rs-header">刮削源排序与开关</div>
                    <div class="drag-list" id="rs-source-list">
                        <!-- JS 渲染所有源 -->
                    </div>
                    <div style="margin-top: 8px;">
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">
                            自定义源（使用 <b>{}</b> 代表番号。会同时兼容有-和无-的请求。多个网址用英文 , 分隔）
                        </div>
                        <textarea id="rs-custom-sources" class="rs-input" style="width: 100%; height: 60px; resize: none;" placeholder="如: https://www.google.com/search?q={}">${escapeHtml(s.customSources || '')}</textarea>
                    </div>
                </div>

                <div class="rs-footer">
                    <button class="rs-btn rs-btn-default" id="rs-reset">恢复默认</button>
                    <button class="rs-btn rs-btn-default" id="rs-cancel">取消</button>
                    <button class="rs-btn rs-btn-primary" id="rs-save">保存</button>
                </div>
            </div>
        `;
        shadow.appendChild(style);
        shadow.appendChild(wrapper);

        // --- 事件绑定 ---
        const navBtns = shadow.querySelectorAll('.rs-nav-btn');
        const sections = shadow.querySelectorAll('.rs-section');
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                sections.forEach(sec => sec.classList.remove('active'));
                btn.classList.add('active');
                shadow.getElementById(btn.dataset.target).classList.add('active');
            });
        });

        // 通用 Pointer Drag 逻辑
        function initPointerDrag(container) {
            let draggedItem = null;
            let placeholder = null;
            let startY = 0;
            let initialRect = null;

            container.addEventListener('pointerdown', e => {
                const handle = e.target.closest('.drag-handle');
                const item = e.target.closest('.drag-item');
                if (!handle || !item || item.classList.contains('is-required')) return;

                e.preventDefault();
                draggedItem = item;
                item.classList.add('dragging');
                initialRect = item.getBoundingClientRect();

                placeholder = document.createElement('div');
                placeholder.style.width = `${initialRect.width}px`;
                placeholder.style.height = `${initialRect.height}px`;
                item.parentNode.insertBefore(placeholder, item);

                item.style.position = 'fixed';
                item.style.left = `${initialRect.left}px`;
                item.style.top = `${initialRect.top}px`;
                item.style.width = `${initialRect.width}px`;
                item.style.zIndex = '99999';
                item.style.pointerEvents = 'none';

                document.addEventListener('pointermove', onMove);
                document.addEventListener('pointerup', onUp, { once: true });
            });

            function onMove(e) {
                if (!draggedItem) return;
                const y = e.clientY;
                draggedItem.style.top = `${y - initialRect.height / 2}px`;

                const items = [...container.querySelectorAll('.drag-item:not(.dragging)')];
                const target = items.find(item => {
                    const rect = item.getBoundingClientRect();
                    return y >= rect.top && y <= rect.bottom;
                });

                if (target) {
                    const rect = target.getBoundingClientRect();
                    const isAfter = y > rect.top + rect.height / 2;
                    if (isAfter) {
                        container.insertBefore(placeholder, target.nextSibling);
                    } else {
                        container.insertBefore(placeholder, target);
                    }
                }
            }

            function onUp() {
                if (draggedItem) {
                    draggedItem.style.position = '';
                    draggedItem.style.left = '';
                    draggedItem.style.top = '';
                    draggedItem.style.width = '';
                    draggedItem.style.zIndex = '';
                    draggedItem.style.pointerEvents = '';
                    draggedItem.classList.remove('dragging');

                    placeholder.parentNode.insertBefore(draggedItem, placeholder);
                    placeholder.remove();
                    placeholder = null;
                    draggedItem = null;
                }
                document.removeEventListener('pointermove', onMove);
            }
        }

        // 字段排序
        const fieldList = shadow.getElementById('rs-field-list');
        initPointerDrag(fieldList);

        // 刮削源列表
        const srcListEl = shadow.getElementById('rs-source-list');
        const renderSources = () => {
            srcListEl.innerHTML = sourceKeys.map((key) => `
                <div class="drag-item" data-key="${key}">
                    <div class="drag-left">
                        <input type="checkbox" class="rs-checkbox" data-source-enable="${key}" ${enabledSrc.has(key) ? 'checked' : ''}>
                        <span class="rs-label">${srcLabels[key] || key}</span>
                    </div>
                    <div class="drag-handle">≡</div>
                </div>
            `).join('');
        };
        renderSources();
        initPointerDrag(srcListEl);

        // 修复按钮绑定
        shadow.getElementById('rs-cancel').onclick = () => host.remove();

        shadow.getElementById('rs-archive-apply').onclick = async function () {
            const p = shadow.getElementById('rs-archive-path').value.trim();
            if (!p) { alert('请输入路径'); return; }
            const b = this; b.disabled = true; b.textContent = '...';
            try {
                const r = await resolveArchiveRootByPath(p);
                archiveRootCid = r.cid; archiveRootName = r.name; archiveRootPath = r.path;
                saveSettings({ archiveRootCid: r.cid, archiveRootName: r.name, archiveRootPath: r.path });
                alert('已保存：' + r.path); host.remove(); cleanupRootInfo(); showRootInfo();
            } catch (e) { alert('失败：' + (e.message || e)); }
            finally { b.disabled = false; b.textContent = '解析'; }
        };

        shadow.getElementById('rs-clear-archive-root').onclick = () => {
            if (!confirm('清除？')) return;
            archiveRootCid = null; archiveRootName = null; archiveRootPath = '';
            saveSettings({ archiveRootCid: null, archiveRootName: null, archiveRootPath: '' });
            showPageNotification('已清除', 'info', 2000); host.remove(); cleanupRootInfo(); showRootInfo();
        };

        shadow.getElementById('rs-reset').onclick = () => {
            if (!confirm('恢复默认？（保留归档根目录）')) return;
            const keep = { archiveRootCid: SETTINGS.archiveRootCid, archiveRootName: SETTINGS.archiveRootName, archiveRootPath: SETTINGS.archiveRootPath };
            GM_setValue('rename2026_settings', '{}'); SETTINGS = null;
            if (keep.archiveRootCid) saveSettings(keep);
            host.remove(); showPageNotification('已恢复默认', 'success', 2000);
        };

        shadow.getElementById('rs-save').onclick = () => {
            const em = {};
            ['title', 'zhTitle', 'actresses', 'date'].forEach(k => {
                const el = shadow.querySelector(`[data-field-enable="${k}"]`);
                if (el) em['enable' + k.charAt(0).toUpperCase() + k.slice(1)] = el.checked;
            });
            const mv2 = {};
            shadow.querySelectorAll('[data-menu-vis]').forEach(cb => { mv2[cb.dataset.menuVis] = cb.checked; });

            const newOrder = Array.from(fieldList.querySelectorAll('.drag-item')).map(el => el.dataset.key).join(',');

            const newSrcOrder = Array.from(srcListEl.querySelectorAll('.drag-item')).map(el => el.dataset.key).join(',');
            const newEnabledSrc = [];
            shadow.querySelectorAll('[data-source-enable]').forEach(cb => { if (cb.checked) newEnabledSrc.push(cb.dataset.sourceEnable); });

            const upd = {
                fieldOrder: newOrder,
                fieldSeparator: shadow.getElementById('rs-field-sep').value || ' ',
                datePrefix: shadow.getElementById('rs-date-prefix').value,
                actressSeparator: shadow.getElementById('rs-actress-sep').value || '・',
                enableTitle: em.enableTitle !== false,
                enableZhTitle: em.enableZhTitle === true,
                enableActresses: em.enableActresses !== false,
                enableDate: em.enableDate !== false,
                enableMarkers: shadow.getElementById('rs-enable-markers').checked,
                protectManualName: shadow.getElementById('rs-protect-manual').checked,
                segmentPrefix: shadow.getElementById('rs-segment-prefix').value,
                renameConcurrency: Math.max(1, Math.min(10, parseInt(shadow.getElementById('rs-rename-concurrency').value, 10) || 3)),
                sourceOrder: newSrcOrder,
                scrapeSources: newEnabledSrc.join(','),
                customSources: shadow.getElementById('rs-custom-sources').value.trim(),
                menuVisibility: mv2
            };
            saveSettings(upd);
            showPageNotification('已保存', 'success', 2000);
            host.remove();
        };
    }

    const rootInfoId = 'archive-root-info-' + Date.now();
    function cleanupRootInfo() {
        try { document.querySelectorAll('[id^="archive-root-info"]').forEach(el => { el.remove(); }); } catch (e) { }
    }
    function showRootInfo() {
        cleanupRootInfo();
        let msg;
        if (archiveRootCid) msg = '归档根目录：' + (archiveRootPath ? '「' + archiveRootPath + '」' : '「' + (archiveRootName || '?') + '」');
        else msg = '未设置归档根目录（使用网盘根）';
        if (window.self === window.top) {
            const d = document.createElement('div');
            d.id = rootInfoId;
            d.className = 'archive-root-info';
            d.textContent = msg;
            document.body.appendChild(d);
        }
    }
    setTimeout(showRootInfo, 2000);

    GM_addStyle(
        '[id^="archive-root-info"] { position:fixed;top:20px;right:20px;max-width:320px;background:rgba(0,0,0,.8);color:#fff;padding:12px 20px;border-radius:4px;z-index:9998;font-size:14px;border-left:4px solid #1890ff;word-break:break-all; }' +
        '.custom-notification{position:fixed;top:80px;right:20px;max-width:300px;background:rgba(0,0,0,.8);color:#fff;padding:12px 20px;border-radius:4px;z-index:9999;font-size:14px;transition:all .3s;opacity:0;transform:translateY(-10px);}' +
        '.custom-notification.success{border-left:4px solid #52c41a;}.custom-notification.error{border-left:4px solid #f5222d;}.custom-notification.info{border-left:4px solid #1890ff;}' +
        '.custom-notification.show{opacity:1;transform:translateY(0);}' +
        '#task-progress-box{position:fixed;bottom:20px;right:20px;min-width:260px;background:rgba(0,0,0,.8);color:#fff;padding:10px 14px;border-radius:4px;z-index:9999;font-size:12px;}' +
        '#task-progress-box .tp-title{font-size:12px;margin-bottom:6px;}' +
        '#task-progress-box .tp-bar-outer{width:100%;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden;}' +
        '#task-progress-box .tp-bar-inner{height:100%;width:0;background:#1890ff;transition:width .2s;}' +
        '#task-progress-box .tp-text{margin-top:4px;text-align:right;font-size:11px;opacity:.9;}'
    );

    function setArchiveRoot() {
        const selected = get115SelectedItems();
        if (selected.length !== 1) { showPageNotification('请只选择一个文件夹', 'error', 3000); return; }
        const item = selected[0];
        if (!item.isFolder) { showPageNotification('请选择文件夹', 'error', 3000); return; }
        archiveRootCid = item.fid;
        archiveRootName = item.fn;
        archiveRootPath = '';
        saveSettings({ archiveRootCid: item.fid, archiveRootName: item.fn, archiveRootPath: '' });
        cleanupRootInfo(); showRootInfo();
        showPageNotification('归档根目录：' + item.fn, 'success', 5000);
    }

    try {
        GM_registerMenuCommand('⚙️ 设置', openSettingsPanel);
    } catch (e) { }

    console.log('115Rename2026 v' + SCRIPT_VERSION + ' 已加载（优化防冲突、紧凑布局、OLED纯黑适配、拖拽排序、自定义源智能兼容）');
})();