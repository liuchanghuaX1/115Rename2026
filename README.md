// ==UserScript==
// @name            115Rename2026
// @namespace       https://github.com/liuchanghuaX1/115Rename2026
// @version         3.0.2
// @description     设置面板｜字段顺序自定义｜右键菜单开关｜归档根目录路径｜FC2 分段修复｜纯标点过滤｜多源检索
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
'use strict';

const SCRIPT_VERSION = '3.0.2';

// ============================================================================
// 1. 默认设置
// ============================================================================
const FIELD_DEFINITIONS = {
    code:      { label: '番号(全)', required: true, fixed: true },
    title:     { label: '标题(原)', settingKey: 'enableTitle',   default: true  },
    zhTitle:   { label: '标题(中)', settingKey: 'enableZhTitle', default: false },
    actresses: { label: '女优',    settingKey: 'enableActresses', default: true  },
    date:      { label: '日期',    settingKey: 'enableDate',      default: true  },
};

const MENU_ITEMS = [
    { key: 'localCodeProcess', id: 'local_code_process',    label: '本地番号加工' },
    { key: 'renameMultiDate',  id: 'rename_all_multi_date', label: '改名(多网站轮询)' },
    { key: 'renameMultiZh',    id: 'rename_all_multi_zh',   label: '改名(中文翻译)' },
    { key: 'archiveFolder',    id: 'archive_to_folder',     label: '归档至文件夹' },
    { key: 'archiveBucket',    id: 'archive_to_bucket',     label: '分桶归档(番号前缀数字段)' },
    { key: 'setArchiveRoot',   id: 'set_archive_root',      label: '设为归档根目录' },
    { key: 'javdbRating',      id: 'get_javdb_rating',      label: '获取javdb评分' },
    { key: 'backupFileNames',  id: 'backup_file_names',     label: '备份文件名' },
];

const DEFAULT_SETTINGS = {
    fieldOrder: 'code,title,actresses,date',
    fieldSeparator: ' ',
    datePrefix: '-',
    actressSeparator: '・',

    enableTitle: true,
    enableZhTitle: false,
    enableActresses: true,
    enableDate: true,
    enableMarkers: true,

    translateChinese: false,
    protectManualName: true,
    useCdPrefix: true,

    renameConcurrency: 3,
    archiveConcurrency: 3,

    scrapeSources: 'javdb,javbus,javlibrary,xslist,fc2ppvdb,missav,avsox,avmoo',

    archiveRootCid: null,
    archiveRootName: null,
    archiveRootPath: '',

    cacheTtlDays: 90,
    negativeCacheTtlHours: 24,

    actressAlias: null,

    menuVisibility: {
        localCodeProcess: true,
        renameMultiDate: true,
        renameMultiZh: true,
        archiveFolder: true,
        archiveBucket: true,
        setArchiveRoot: true,
        javdbRating: true,
        backupFileNames: true,
    },
};

let SETTINGS = null;

function loadSettings() {
    if (SETTINGS) return SETTINGS;
    try {
        const raw = GM_getValue('rename2026_settings', '');
        const parsed = raw ? JSON.parse(raw) : {};
        SETTINGS = { ...DEFAULT_SETTINGS, ...parsed };
        if (!SETTINGS.menuVisibility) SETTINGS.menuVisibility = { ...DEFAULT_SETTINGS.menuVisibility };
    } catch (e) {
        SETTINGS = { ...DEFAULT_SETTINGS };
    }
    return SETTINGS;
}
function saveSettings(partial) {
    loadSettings();
    if (partial) Object.assign(SETTINGS, partial);
    GM_setValue('rename2026_settings', JSON.stringify(SETTINGS));
}

// ============================================================================
// 2. 常量
// ============================================================================
const ACTRESS_ALIAS_MAP_DEFAULT = {
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
    '七沢みあ': '七泽米亚', 'Nanasawa Mia': '七泽米亚',
    '紗倉まな': '纱仓真菜', 'Sakura Mana': '纱仓真菜',
    '波多野結衣': '波多野结衣', 'Hatano Yui': '波多野结衣',
    '橋本ありな': '桥本有菜', 'Hashimoto Arina': '桥本有菜',
    '三宮つばき': '三宫椿', 'Sannomiya Tsubaki': '三宫椿',
    '山手梨愛': '山手梨爱', 'Yamamate Ria': '山手梨爱',
    '神宮寺ナオ': '神宫寺奈绪', 'Jinguji Nao': '神宫寺奈绪',
    '七瀬アリス': '七濑爱丽丝', 'Nanase Alice': '七濑爱丽丝',
    '大槻ひびき': '大槻响', 'Otsuki Hibiki': '大槻响',
    '希崎ジェシカ': '希崎杰西卡', 'Kizaki Jessica': '希崎杰西卡',
    '希岛あいり': '希岛爱理', 'Kijima Airi': '希岛爱理',
    '小湊よつ葉': '小凑四叶', 'Kominato Yotsuha': '小凑四叶',
    '伊藤舞雪': '伊藤舞雪', 'Ito Miyuki': '伊藤舞雪',
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

function getActressAliasMap() {
    const s = loadSettings();
    if (!s.actressAlias) return { ...ACTRESS_ALIAS_MAP_DEFAULT };
    try { return { ...ACTRESS_ALIAS_MAP_DEFAULT, ...JSON.parse(s.actressAlias) }; }
    catch { return { ...ACTRESS_ALIAS_MAP_DEFAULT }; }
}

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
    'WWW', 'FHD', 'HD', 'SD', 'X264', 'X265', 'H264', 'H265', 'HEVC', 'AVC',
    'AAC', 'AC3', 'DTS', 'FLAC', 'MP3', 'MP4', 'MKV', 'AVI', 'WMV', 'M4V', 'RMVB', 'ISO', 'TS',
    'WATERMARK', 'RARBG', 'WEB-DL', 'WEBRIP', 'BLURAY', 'BDREMUX',
    '1440P', '1080P', '720P', '480P'
];

const MARKER_MAP = {
    leak: '流出', leaked: '流出', 流出: '流出',
    uncensored: '无码', 無修正: '无码', 无码: '无码',
    chs: '中文字幕', cht: '中文字幕', gb: '中文字幕', big5: '中文字幕', sc: '中文字幕', chinese: '中文字幕',
    中字: '中文字幕', 字幕: '中文字幕', 中文: '中文字幕', 中文字幕: '中文字幕',
    '4k': '4K', '8k': '8K', '60fps': '60fps', '120fps': '120fps',
    破解: '破解', '2160p': '4K', vr: 'VR'
};
const MARKER_PATTERN = /(4K|8K|60fps|120fps|破解|流出|leak(?:ed)?|無修正|无码|uncensored|中字|字幕|chinese|chs|cht|big5|gb|sc|中文字幕|2160p|VR)/gi;
const AD_BADGES = /\[3Q\]|\(原\)|\[BT\]|【广告】|\[廣告\]/gi;

// ============================================================================
// 3. 工具
// ============================================================================
const stripFileExt = (name) => {
    const s = String(name || '');
    const idx = s.lastIndexOf('.');
    return idx > 0 ? s.slice(0, idx) : s;
};
const escapeRegExp = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizePartToken = (p) => {
    const s = String(p == null ? '' : p);
    if (/^\d+$/.test(s)) { const v = parseInt(s, 10); if (v >= 1 && v <= 999) return String(v); }
    return s;
};
const normalize115Name = (n) => {
    if (!n) return '';
    let s = String(n);
    try { s = s.normalize('NFKC'); } catch (_) {}
    s = s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060-\u2064\u180E\u2028\u2029]/g, '');
    s = s.replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"');
    s = s.replace(/[\u2010-\u2015\u2212\u30FC]+/g, '-');
    s = s.replace(/[\u30FB\u00B7\u2022]/g, '·');
    s = s.replace(/[\uFF0C\u3001]/g, '，').replace(/[\uFF0E\u3002]/g, '。');
    s = s.replace(/[\\\/:?"<>|*]/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
};
const normalizeFolderName = (name) => {
    if (!name) return '';
    let s = normalize115Name(String(name));
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
const folderNameKey = (n) => {
    if (!n) return '';
    return normalize115Name(n).toLowerCase()
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
        variants.push(prefix + num, prefix + ' ' + num, prefix + '_' + num);
    }
    return [...new Set(variants)];
};
const getStandardActressName = (name) => {
    if (!name) return name;
    const n = normalizeFolderName(String(name));
    if (!n) return n;
    const map = getActressAliasMap();
    return map[n] || n;
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
const removeMarkers = (str) => {
    return str.replace(MARKER_PATTERN, (match, p1, offset, full) => {
        if (offset > 0 && /[a-z0-9]/i.test(full[offset - 1])) return match;
        if (offset + match.length < full.length && /[a-z0-9]/i.test(full[offset + match.length])) return match;
        return ' ';
    });
};
const stripDomainPrefix = (filename) => {
    if (!filename || !filename.includes('@')) return filename;
    const safeExtMatch = filename.match(/\.([a-z0-9]{2,5})$/i);
    const ext = (safeExtMatch && !/^\d+$/.test(safeExtMatch[1])) ? safeExtMatch[0] : '';
    const base = ext ? filename.slice(0, -ext.length) : filename;
    const parts = base.split('@').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length <= 1) return filename;
    const isDomain = (s) => {
        if (!s) return false;
        if (/\.(mp4|mkv|avi|wmv|mov|flv|rmvb|webm|ts|m4v|mpg|mpeg|jpg|jpeg|png|gif|webp|bmp|iso|wav|mp3|flac|aac|srt|ass|sub)$/i.test(s)) return false;
        return /^(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\.[a-z]{2,})?$/i.test(s);
    };
    const hasCode = (s) => {
        if (!s) return false;
        if (/\b[A-Z]{2,8}[-_ ]?\d{2,5}\b/i.test(s)) return true;
        if (/FC2[-_ ]?PPV[-_ ]?\d{5,8}/i.test(s)) return true;
        if (/\bfc2?\d{5,8}/i.test(s)) return true;
        if (/\b\d{4,6}[-_]\d{3,4}\b/.test(s)) return true;
        if (/Tokyo[-_ ]?Hot[-_ ]?[nN]?\d{3,4}/i.test(s)) return true;
        if (/\b(1PONDO|CARIB|HEYZO|10MU|MURA|H4610|NAMA|PACO|TOKYOHOT)[-_]?\d+/i.test(s)) return true;
        return false;
    };
    for (const part of parts) {
        if (isDomain(part)) continue;
        if (hasCode(part)) return part + ext;
    }
    if (isDomain(parts[0])) return parts.slice(1).join('@') + ext;
    return parts[parts.length - 1] + ext;
};
const getSafeSuffix = (filename) => {
    const m = filename.match(/\.([a-z0-9]{2,5})$/i);
    if (m && !/^\d+$/.test(m[1])) return m[0];
    return '';
};
const normDate = (d) => {
    if (!d) return '';
    const m = d.trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const m2 = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
    return d;
};
const isNotFoundTitle = (t) => /404|not\s*found|page\s*not\s*found|no\s*result|找不到|页面不存在|查無|查无|無此|无此/i.test(String(t || ''));
const gmRequest = (options) => {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 15000;
        const timer = setTimeout(() => reject(new Error('Request timeout')), timeout);
        GM_xmlhttpRequest({
            ...options,
            onload: (res) => { clearTimeout(timer); resolve(res); },
            onerror: (err) => { clearTimeout(timer); reject(err); },
            ontimeout: () => { clearTimeout(timer); reject(new Error('Timeout')); }
        });
    });
};
const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');
const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

// 纯标点/空白判断
const isPunctOnly = (str) => {
    if (!str) return true;
    const t = String(str).trim();
    if (!t) return true;
    return /^[\s\.\-_·・,，。;；:：!！?？、\/\\|+~@#$%^&*()\[\]{}【】「」『』《》<>]+$/.test(t);
};

// ============================================================================
// 4. 缓存
// ============================================================================
function getCache(key) { try { return JSON.parse(GM_getValue(key, '{}')); } catch { return {}; } }
function setCache(key, data) { GM_setValue(key, JSON.stringify(data)); }

let infoCache = getCache('jb_infoCache');
let actressCache = getCache('jb_actressCache');
let ratingCache = getCache('jb_ratingCache');
let negativeCache = getCache('jb_negativeCache');

const isInfoCacheValid = (code) => {
    const e = infoCache[code];
    if (!e) return false;
    if (!e.cachedAt) return true;
    const ttl = (loadSettings().cacheTtlDays || 90) * 24 * 60 * 60 * 1000;
    return (Date.now() - Number(e.cachedAt)) < ttl;
};
const storeInfo = (key, info) => {
    if (info) info.cachedAt = Date.now();
    infoCache[key] = info;
    setCache('jb_infoCache', infoCache);
};
const isNegativeCached = (code) => {
    const e = negativeCache[code];
    if (!e || !e.cachedAt) return false;
    const ttl = (loadSettings().negativeCacheTtlHours || 24) * 60 * 60 * 1000;
    return (Date.now() - Number(e.cachedAt)) < ttl;
};
const markNegativeCached = (code) => {
    negativeCache[code] = { cachedAt: Date.now() };
    setCache('jb_negativeCache', negativeCache);
};

// ============================================================================
// 5. 番号提取
// ============================================================================
const CODE_PREFIXES = (function build() {
    const prefixes = [...MANUAL_PREFIXES];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) {
        const p = letters[i] + letters[j];
        if (!GARBAGE_WORDS.includes(p) && !prefixes.includes(p)) prefixes.push(p);
    }
    for (let i = 0; i < 26; i++) {
        const p = letters[i];
        if (!GARBAGE_WORDS.includes(p) && !prefixes.includes(p)) prefixes.push(p);
    }
    prefixes.sort((a, b) => b.length - a.length);
    return prefixes;
})();

const CODE_PREFIX_PATTERNS = CODE_PREFIXES.map(p => ({
    prefix: p,
    regex: new RegExp(`\\b${p}[-_ ]?0*(\\d{1,5})(?![0-9])`, 'i')
}));

const matchCodeByPrefix = (str) => {
    if (!str) return null;
    for (const item of CODE_PREFIX_PATTERNS) {
        const m = str.match(item.regex);
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
        if (m && m[1] && !GARBAGE_WORDS.includes(m[1].toUpperCase())) return 'FC2-PPV-' + m[1];
    }
    return null;
};

const checkUncensored = (fh, title) => {
    if (/无码|無修正|uncensored/i.test(title)) return true;
    const uncensoredPatterns = [
        /^Tokyo-Hot-/i, /^TOKYO-HOT-/i, /^1PONDO-/i, /^CARIB-/i,
        /^HEYZO-/i, /^10MU-/i, /^MURA-/i, /^H4610-/i, /^NAMA-/i
    ];
    for (const pat of uncensoredPatterns) if (pat.test(fh)) return true;
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
    if (/^FC2-PPV-\d+$/i.test(baseCode)) {
        const num = baseCode.match(/\d+$/)[0];
        const rawNum = parseInt(num, 10).toString();
        str = str.replace(new RegExp(`\\b(?:fc2?[-_\\s]*(?:ppv[-_\\s]*)?|ppv[-_\\s]*)0*${rawNum}(?:[-_\\s]*(?:sp|part|cd|disc|vol|pt|p|ep|episode)?[-_\\s]*\\d{1,3}|[-_\\s]*sp)?\\b`, 'gi'), ' ');
    }
    const thMatch = baseCode.match(/^Tokyo[-_\s]*Hot[-_\s]*[nN](\d{3,4})$/i);
    if (thMatch) {
        const num = thMatch[1].padStart(4, '0');
        const rawNum = parseInt(num, 10).toString();
        str = str.replace(new RegExp(
            `\\b(?:Tokyo\\s*[-_\\s]*Hot\\s*[-_\\s]*[nN]?\\s*0*${rawNum}|TokyoHotn?${rawNum}|Hotn?${rawNum})(?![_\\s.-]*[a-zA-Z]\\d)`, 'gi'
        ), ' ');
    }
    return str.replace(/\s+/g, ' ').trim();
};

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

    const zhTail = base.match(/(?:^|[\s._\-\[\(【（])((?:上|下|前|後|后)(?:集|部|篇|編|编|段)?)(?:$|[\s._\-\]\)】）])/);
    if (zhTail) {
        const v = zhTail[1];
        if (/上|前/.test(v)) return '1';
        if (/下|後|后/.test(v)) return '2';
    }

    let m = U.match(/(?:^|[\s._\-])(?:HHB|HHC|HHD|HHH)0*([1-9]\d?)(?:$|[\s._\-])/);
    if (m) return numLabel(m[1]);
    m = U.match(/(?:4K|8K|HD|FHD|1080P|720P)[\s._\-]*S0*([1-9]\d?)(?:$|[\s._\-])/);
    if (m) return numLabel(m[1]);
    m = U.match(/(?:4K|8K|UHD|HD|FHD|1080P|720P)?[\s._\-]*(?:60|30)FPS0*([1-9]\d?)(?:$|[\s._\-])/);
    if (m) return numLabel(m[1]);

    const tailZone = U.slice(Math.max(0, U.length - 96));
    m = tailZone.match(/(?:^|[\s._\-\[\(【（])(?:CD|DISC|DISK|DVD|PART|PT|P|VOL|VOLUME|EP|EPISODE)[\s._\-]*0*([1-9]\d?)[\s._\-\]\)】）]*$/);
    if (m) return numLabel(m[1]);

    const spMatch = U.match(/(?:^|[\s._\-\[\(【（])(SP|SPECIAL)[\s._-]*(\d{1,3})?(?=$|[\s._\-\)】）])/i);
    if (spMatch) return spMatch[2] ? 'sp' + numLabel(spMatch[2]) : 'sp';

    m = tailZone.match(/(?:^|[\s._\-])0*([1-9]\d?)\s*(?:OF|\/|／|-)\s*0*([1-9]\d?)(?:$|[\s._\-])/);
    if (m && parseInt(m[2], 10) > 1) return numLabel(m[1]);

    if (code) {
        const codeStr = String(code).toUpperCase();
        const parts = codeStr.split('-');
        let prefix = parts[0] || '', numRaw = parts[1] || '';
        if (prefix === 'FC2' && parts.length >= 3) { prefix = parts[0] + '-' + parts[1]; numRaw = parts[2]; }
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

// ============================================================================
// 6. 核心解析
// ============================================================================
const parseVideoInfo = (origTitle, safeSuffix) => {
    try {
        if (!origTitle) return null;
        let raw = String(origTitle);
        raw = stripDomainPrefix(raw);
        let rawForCode = safeSuffix ? raw.slice(0, raw.lastIndexOf(safeSuffix)) : raw;

        const markers = [];
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
        const garbageRegex = new RegExp('\\b(' + GARBAGE_WORDS.join('|') + ')\\b', 'gi');
        t = t.replace(garbageRegex, ' ').replace(/[\[\]\{\}（）【】]/g, ' ').replace(/[_\.\-\/\\]+/g, ' ');
        t = t.replace(/\b[01]+(?=[A-Z])/g, '').replace(/\b([A-Z])\s(?=[A-Z]\b)/g, '$1');

        let queryCode = null, displayCode = null, part = '';

        const thMatch = rawForCode.match(/Tokyo[\s_-]*Hot[\s_-]*[nN]?(\d{3,4})/i);
        if (thMatch) {
            const num = thMatch[1].padStart(4, '0');
            queryCode = `Tokyo-Hot-n${num}`;
            displayCode = queryCode;
            if (!markers.includes('无码')) markers.push('无码');
        } else {
            const fc2Code = extractFC2Code(rawForCode) || extractFC2Code(t);
            if (fc2Code) {
                queryCode = fc2Code;
                displayCode = fc2Code;
                const fc2Num = fc2Code.match(/\d+$/)[0];
                const fc2FullRegex = new RegExp(`(?:fc2?[-_\\s]*(?:ppv[-_\\s]*)?)0*${fc2Num}(?:[-_\\s]*(?:sp|part|cd|disc|vol|pt|p|ep|episode)?[-_\\s]*\\d{1,3}|[-_\\s]*sp)?`, 'i');
                const fullMatch = rawForCode.match(fc2FullRegex);
                if (fullMatch) {
                    const matchStr = fullMatch[0];
                    const spMatch = matchStr.match(/[-_\s]sp[-_\s]*(\d{1,3})?/i);
                    if (spMatch) {
                        part = spMatch[1] ? 'sp' + normalizePartToken(spMatch[1]) : 'sp';
                    } else {
                        // ★ 修复：必须有分隔符才提取 part，避免 fc2ppv-4821059 误识别为 -cd59
                        const numMatch = matchStr.match(/[-_\s]+(?:(?:part|cd|disc|vol|pt|p|ep)[-_\s]*)?(\d{1,3})$/i);
                        if (numMatch) part = normalizePartToken(numMatch[1]);
                    }
                    rawForCode = rawForCode.replace(matchStr, ' ').trim();
                } else {
                    rawForCode = rawForCode.replace(new RegExp(`fc2?[-_\\s]*(?:ppv[-_\\s]*)?0*${fc2Num}`, 'i'), ' ').trim();
                    const partMatch = rawForCode.match(/[-_](sp\d*|[a-z]*\d{1,3})\b/i);
                    if (partMatch) {
                        const pStr = partMatch[1].toLowerCase();
                        if (pStr.includes('sp')) {
                            const pNum = pStr.replace('sp', '');
                            part = pNum ? 'sp' + normalizePartToken(pNum) : 'sp';
                        } else if (/^\d+$/.test(pStr)) part = normalizePartToken(pStr);
                        rawForCode = rawForCode.replace(partMatch[0], ' ').trim();
                    }
                }
            } else {
                const uncensoredMatch = t.match(/\b(1PONDO|CARIB|HEYZO|10MU|MURA|H4610|NAMA)[-_]?(\d+)/i);
                if (uncensoredMatch) {
                    let prefix = uncensoredMatch[1].toUpperCase();
                    const num = uncensoredMatch[2];
                    if (prefix === 'CARIB') prefix = 'Caribbean';
                    queryCode = prefix + '-' + num;
                    displayCode = queryCode;
                    if (!markers.includes('无码')) markers.push('无码');
                    rawForCode = rawForCode.replace(new RegExp(uncensoredMatch[0], 'i'), ' ').trim();
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
        }

        if (!queryCode) return null;
        const baseCode = displayCode || queryCode;

        if (checkUncensored(baseCode, raw)) {
            if (!markers.includes('无码')) markers.push('无码');
        }

        const safeB = queryCode.replace(/_/g, '-').replace(/-/g, '[-_ ]?');
        if (raw.indexOf('中文') !== -1 || new RegExp(safeB + '[_-](UC|C)\\b', 'i').test(raw)) {
            if (!markers.includes('中文字幕')) markers.push('中文字幕');
        }
        if (raw.indexOf('无码') !== -1 || new RegExp(safeB + '[_-](UC|U)\\b', 'i').test(raw)) {
            if (!markers.includes('无码')) markers.push('无码');
        }

        if (/^FC2-PPV-\d{5,8}$/i.test(queryCode) && !part) {
            const partMatch = rawForCode.match(/[-_](\d{1,3})(?:\s|$)/);
            if (partMatch) { part = normalizePartToken(partMatch[1]); rawForCode = rawForCode.replace(partMatch[0], ' ').trim(); }
        }

        const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keywordRegex = new RegExp(
            `${escapedBase}[\\s._-]*(part|pt|cd|disc|ep|sp|vol|no|volume)[\\s._-]*(\\d{1,3}|[a-dA-D])(?![a-zA-Z0-9])`, 'i'
        );
        const kwMatch = rawForCode.match(keywordRegex);
        if (kwMatch) {
            const kwType = kwMatch[1].toLowerCase();
            const kwVal = kwMatch[2].toUpperCase();
            part = kwType === 'sp' ? 'sp' + kwVal : kwVal;
            rawForCode = rawForCode.replace(kwMatch[0], ' ').trim();
        } else if (!part) {
            const numRegex = new RegExp(`${escapedBase}[_\\-](\\d{1,3})(?![a-zA-Z])|${escapedBase}\\.(\\d{1,3})(?![a-zA-Z0-9])`, 'i');
            const nm = rawForCode.match(numRegex);
            if (nm) { part = (nm[1] || nm[2]).toUpperCase(); rawForCode = rawForCode.replace(nm[0], ' ').trim(); }
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

        let finalPart = part;
        if (finalPart) {
            finalPart = String(finalPart).toLowerCase();
            if (/^\d+$/.test(finalPart)) {
                if (loadSettings().useCdPrefix) finalPart = 'cd' + finalPart;
            }
        }
        const fullCode = finalPart ? `${baseCode}-${finalPart}` : baseCode;

        let cleanTitle = removeMarkers(rawForCode);
        cleanTitle = cleanTitle.replace(/(?:\b|_|^|@|】|\[|【)(?:19|20)\d{2}[-_\/\.\s]+\d{1,2}[-_\/\.\s]+\d{1,2}(?:\b|_|$|(?=[A-Z]))/ig, ' ');
        cleanTitle = cleanTitle.replace(/\[.*?\]|\(.*?\)|【.*?】|\{.*?\}|（.*?）/g, ' ');
        cleanTitle = cleanTitle.replace(AD_BADGES, ' ');
        cleanTitle = cleanTitle.replace(garbageRegex, ' ');
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
        cleanTitle = removeCodeFromTitle(cleanTitle, baseCode);

        // ★ 修复：清理后只剩纯标点/空白的 title 视为无 title
        if (isPunctOnly(cleanTitle)) cleanTitle = '';

        return { queryCode, baseCode, fullCode, markers, date: dateStr, localTitle: cleanTitle };
    } catch (e) {
        console.error('parseVideoInfo error:', e);
        return null;
    }
};

// ============================================================================
// 7. 新名称构建
// ============================================================================
const buildNewName = (vInfo, info, suffix) => {
    if (!vInfo || !vInfo.fullCode) return '';
    const s = loadSettings();

    const originalTitle = (info && info.title) || vInfo.localTitle || '';
    const zhTitle = (info && info.zhTitle) || '';
    const actresses = (info && info.actresses) || [];
    const dateStr = (info && info.date) || vInfo.date || '';

    let actressStr = '';
    if (actresses.length) {
        const list = [];
        const seen = new Set();
        actresses.forEach(a => {
            const std = getStandardActressName(a);
            if (!std || !isPlausibleActressToken(std)) return;
            const key = folderNameKey(std);
            if (!key || seen.has(key)) return;
            seen.add(key);
            list.push(std);
        });
        actressStr = list.join(s.actressSeparator || '・');
    }

    let cleanTitle = originalTitle ? removeCodeFromTitle(originalTitle, vInfo.baseCode).replace(/【[^】]*】/g, '').trim() : '';
    let cleanZhTitle = zhTitle ? removeCodeFromTitle(zhTitle, vInfo.baseCode).replace(/【[^】]*】/g, '').trim() : '';
    // ★ 修复：纯标点 title 视为空
    if (isPunctOnly(cleanTitle)) cleanTitle = '';
    if (isPunctOnly(cleanZhTitle)) cleanZhTitle = '';

    const fieldValues = {
        code: vInfo.fullCode,
        title: cleanTitle,
        zhTitle: cleanZhTitle,
        actresses: actressStr,
        date: dateStr
    };
    const enabled = {
        code: true,
        title: s.enableTitle,
        zhTitle: s.enableZhTitle,
        actresses: s.enableActresses,
        date: s.enableDate
    };
    const order = String(s.fieldOrder || 'code,title,actresses,date').split(',').map(x => x.trim()).filter(Boolean);
    const parts = [];
    for (const f of order) {
        if (!enabled[f]) continue;
        const v = fieldValues[f];
        if (!v) continue;
        if (f === 'date' && s.datePrefix) parts.push(s.datePrefix + v);
        else parts.push(v);
    }
    let name = parts.join(s.fieldSeparator || ' ');

    if (s.enableMarkers && vInfo.markers && vInfo.markers.length) {
        const uniq = [...new Set(vInfo.markers)].filter(Boolean);
        const existingMarkers = name.match(/【[^】]*】/g) || [];
        const toAdd = uniq.filter(m => !existingMarkers.includes(`【${m}】`));
        if (toAdd.length) name += toAdd.map(m => `【${m}】`).join('');
    }

    if (suffix) {
        // ★ 修复：加后缀前去掉尾部空格，避免 "xxx .mp4" → "xxx..mp4"
        name = name.replace(/\s+$/, '');
        name += suffix;
    }
    name = name.replace(/\s+/g, ' ').trim();
    // ★ 已删除危险的 name.replace(/\s+\./g, '.')，它会制造连续点
    return name.replace(/[\\/:*?"<>|]/g, (c) => ({'\\':'','/':' ',':':' ','?':' ','"':' ','<':' ','>':' ','|':''})[c] || '');
};

// ============================================================================
// 8. 手动命名保护
// ============================================================================
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
    return asciiWords.length >= 2 || asciiWords.join('').length >= 10;
};

// ============================================================================
// 9. 刮削基础 URL
// ============================================================================
const javbusBase = "https://www.javbus.com/";
const javbusDirectAccess = javbusBase;
const javbusUncensoredBase = javbusBase + "uncensored/";
const javlibSearchBase = "https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=";
const javlibBase = "https://www.javlibrary.com/";
const xslistBase = "https://xslist.org/tw/";
const javdbBase = "https://javdb.com";
const javdbSearchBase = javdbBase + "/search?q=";
const fc2ppvdbBase = "https://fc2ppvdb.com/articles/";

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

const fetchJavlib = (code) => new Promise((resolve, reject) => {
    trySearchVariants(code, (q, next) => {
        gmRequest({ method: 'GET', url: javlibSearchBase + encodeURIComponent(q), anonymous: true, timeout: 15000 })
            .then(res => {
                const doc = parseHTML(res.responseText);
                let link = doc.querySelector('#video_title a')?.getAttribute('href') || doc.querySelector('div.video a[href*="?v="]')?.getAttribute('href');
                if (!link) { next(); return; }
                if (link.startsWith('/')) link = javlibBase.replace(/\/+$/, '') + link;
                return gmRequest({ method: 'GET', url: link, anonymous: true, timeout: 15000 });
            }).then(res2 => {
                const ddoc = parseHTML(res2.responseText);
                let ttl = ddoc.querySelector('#video_title a')?.textContent.trim() || ddoc.querySelector('#video_title')?.textContent.trim() || '';
                if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                if (isNotFoundTitle(ttl)) ttl = '';
                const dateText = ddoc.querySelector('#video_date td.text')?.textContent.trim() || '';
                const isoDate = normDate(dateText);
                const actresses = [];
                ddoc.querySelectorAll('#video_cast td.text a').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                if (!ttl) { next(); return; }
                resolve({ title: ttl, date: isoDate, actresses });
            }).catch(() => { next(); });
    }, () => { reject(new Error('JavLibrary 搜索无结果')); });
});

const fetchJavbus = (code) => new Promise((resolve, reject) => {
    const variants = getCodeQueryVariants(code).filter(v => !/[\s_]/.test(v));
    let vi = 0;
    const tryOne = (q) => {
        const tryBase = (u) => gmRequest({ method: 'GET', url: u + q, anonymous: true, timeout: 15000 })
            .then(res => {
                const doc = parseHTML(res.responseText);
                let ttl = null;
                const h3 = doc.querySelector('h3');
                if (h3) { ttl = h3.textContent.trim(); if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim(); }
                if (!ttl) ttl = doc.querySelector('div.photo-frame img')?.getAttribute('title') || '';
                if (!ttl) {
                    ttl = doc.querySelector('title')?.textContent.trim() || '';
                    if (ttl.includes(' - JavBus')) ttl = ttl.split(' - JavBus')[0].trim();
                    if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                }
                if (isNotFoundTitle(ttl)) ttl = null;
                if (!ttl) return Promise.reject();
                let isoDate = '';
                doc.querySelectorAll('p').forEach(p => {
                    const t = p.textContent.trim();
                    if (/發行日期|发行日期/.test(t)) { const m = t.match(/(\d{4}-\d{2}-\d{2})/); if (m) isoDate = normDate(m[1]); }
                });
                if (!isoDate) {
                    const p = doc.querySelector('.info p:nth-of-type(2)');
                    if (p) isoDate = normDate(p.textContent.replace(/.*?[:：]/, '').trim());
                }
                const actresses = [];
                doc.querySelectorAll('span.genre a[href*="/star/"]').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
                const info = { title: ttl, date: isoDate, actresses };
                if (u.includes('uncensored')) info.uncensored = true;
                return info;
            }).catch(() => { throw new Error('fail'); });
        tryBase(javbusDirectAccess).catch(() => tryBase(javbusUncensoredBase))
            .then(info => resolve(info))
            .catch(() => {
                vi++;
                if (vi < variants.length) tryOne(variants[vi]);
                else reject(new Error('JavBus 搜索无结果'));
            });
    };
    tryOne(variants[0]);
});

const fetchXslist = (code) => new Promise((resolve, reject) => {
    trySearchVariants(code, (q, next) => {
        gmRequest({ method: 'GET', url: xslistBase + 'search?query=' + encodeURIComponent(q), anonymous: true, timeout: 15000 })
            .then(res => {
                const sdoc = parseHTML(res.responseText);
                const parsePage = (doc) => {
                    const uc = code.toUpperCase().replace(/[-_\s]/g, '');
                    let tr = null;
                    doc.querySelectorAll('#movices tbody tr').forEach(row => {
                        const c = (row.querySelector('td strong')?.textContent || '').trim().toUpperCase().replace(/[-_\s]/g, '');
                        if (c === uc) tr = row;
                    });
                    if (!tr) return null;
                    const tds = tr.querySelectorAll('td');
                    const ttl = tds[1]?.textContent.trim() || '';
                    const dt = tds[2]?.textContent.trim() || '';
                    let isoDate = '';
                    if (dt && !/n\/a/i.test(dt)) isoDate = normDate(dt);
                    const aname = doc.querySelector('h1 span[itemprop="name"]')?.textContent.trim() || '';
                    const actresses = aname ? [aname] : [];
                    if (!ttl) return null;
                    return { title: ttl, date: isoDate, actresses };
                };
                let info = null;
                if (sdoc.querySelector('#movices') && sdoc.querySelector('h1 span[itemprop="name"]')) {
                    info = parsePage(sdoc);
                    if (info) { resolve(info); return; }
                }
                let link = sdoc.querySelector('a[href*="/model/"]')?.getAttribute('href');
                if (!link) { next(); return; }
                if (link.startsWith('/')) link = xslistBase.replace(/\/+$/, '') + link;
                gmRequest({ method: 'GET', url: link, anonymous: true, timeout: 15000 }).then(res2 => {
                    const info2 = parsePage(parseHTML(res2.responseText));
                    if (info2) resolve(info2);
                    else next();
                }).catch(() => next());
            }).catch(() => next());
    }, () => { reject(new Error('xslist 搜索无结果')); });
});

const fetchJavdb = (code) => new Promise((resolve, reject) => {
    trySearchVariants(code, (q, next) => {
        gmRequest({ method: 'GET', url: javdbSearchBase + encodeURIComponent(q) + '&f=all', anonymous: true, timeout: 15000 })
            .then(res => {
                const hdoc = parseHTML(res.responseText);
                let link = hdoc.querySelector('a[href*="/v/"]')?.getAttribute('href') || hdoc.querySelector('.movie-list .item a')?.getAttribute('href');
                if (!link) { next(); return; }
                if (link.startsWith('/')) link = javdbBase + link;
                return gmRequest({ method: 'GET', url: link, anonymous: true, timeout: 15000 });
            }).then(res2 => {
                const ddoc = parseHTML(res2.responseText);
                let ttl = ddoc.querySelector('h2.title')?.textContent.trim() || ddoc.querySelector('strong.current-title')?.textContent.trim() || '';
                if (ttl.toUpperCase().startsWith(code.toUpperCase())) ttl = ttl.slice(code.length).trim();
                if (isNotFoundTitle(ttl)) ttl = '';
                let dateText = '';
                ddoc.querySelectorAll('.panel-block').forEach(block => {
                    const t = block.textContent.trim();
                    if (/日期:|發行日期:|发行日期:/.test(t)) dateText = t.replace(/.*?[:：]/, '').trim();
                });
                const isoDate = normDate(dateText);
                const actorEntries = [];
                ddoc.querySelectorAll('a[href*="/actors/"]').forEach(a => {
                    const name = a.textContent.trim();
                    if (!name) return;
                    let gender = 'unknown';
                    const ownText = [a.textContent, a.getAttribute('data-gender'), a.getAttribute('title')].filter(Boolean).join(' ');
                    if (/♀|female|woman|女(?:優|优|演员|演員)?/i.test(ownText)) gender = 'female';
                    else if (/♂|male|man|男(?:優|优|演员|演員)?/i.test(ownText)) gender = 'male';
                    else {
                        const sib = a.nextElementSibling;
                        if (sib) {
                            const txt = String(sib.textContent || '').trim();
                            if (/♀/.test(txt)) gender = 'female';
                            else if (/♂/.test(txt)) gender = 'male';
                        }
                    }
                    actorEntries.push({ name, gender });
                });
                const actresses = actorEntries.map(e => e.name);
                if (!ttl) { next(); return; }
                resolve({ title: ttl, date: isoDate, actresses, actorEntries });
            }).catch(() => next());
    }, () => { reject(new Error('JavDB 搜索无结果')); });
});

const fetchFC2PPVDB = (code) => {
    const fc2Number = code.match(/\d+$/)[0];
    return gmRequest({ method: 'GET', url: fc2ppvdbBase + fc2Number, anonymous: true, timeout: 15000 })
        .then(res => {
            const doc = parseHTML(res.responseText);
            let title = null;
            const link = doc.querySelector('a[href*="adult.contents.fc2.com"]');
            if (link) title = link.textContent.trim();
            if (!title) {
                title = doc.querySelector('title')?.textContent.trim() || '';
                if (title.includes(' - FC2PPVDB')) title = title.replace(' - FC2PPVDB', '').trim();
            }
            if (!title) throw new Error('无标题');
            return { title, date: '', actresses: [] };
        });
};

const fetchMissavFC2 = (code) => {
    const standardFC2 = code;
    const expectedId = standardFC2.toLowerCase();
    return new Promise((resolve, reject) => {
        const sign = (path) => {
            const databaseId = 'missav-default';
            const publicToken = 'Ikkg568nlM51RHvldlPvc2GzZPE9R4XGzaH9Qj4zK9npbbbTly1gj9K4mgRn0QlV';
            const timestamp = Math.floor(Date.now() / 1000);
            const unsignedPath = `/${databaseId}${path}?frontend_timestamp=${timestamp}`;
            if (!globalThis.crypto || !globalThis.crypto.subtle) return Promise.reject(new Error('WebCrypto unavailable'));
            const encoder = new TextEncoder();
            return globalThis.crypto.subtle.importKey('raw', encoder.encode(publicToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
                .then(key => globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(unsignedPath)))
                .then(sig => {
                    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
                    return unsignedPath + '&frontend_sign=' + hex;
                });
        };
        sign('/search/users/anonymous/items/').then(signedPath => gmRequest({
            method: 'POST',
            url: 'https://client-rapi-missav.recombee.com' + signedPath,
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            data: JSON.stringify({ searchQuery: standardFC2, count: 10, cascadeCreate: true, returnProperties: true }),
            anonymous: true, timeout: 15000
        })).then(res => {
            const data = JSON.parse(res.responseText);
            const results = Array.isArray(data && data.recomms) ? data.recomms : [];
            const exact = results.find(item => String(item && item.id || '').toLowerCase() === expectedId);
            if (!exact || !exact.values) throw new Error('No exact match');
            const values = exact.values;
            const title = String(values.title || '').trim();
            if (!title) throw new Error('No title');
            const actors = [].concat(Array.isArray(values.actresses) ? values.actresses : [], Array.isArray(values.actors) ? values.actors : []);
            let date = null;
            const releasedAt = Number(values.released_at);
            if (Number.isFinite(releasedAt) && releasedAt > 0) date = new Date(releasedAt * 1000).toISOString().slice(0, 10);
            return { title, date, actresses: actors };
        }).then(resolve).catch(reject);
    });
};

const fetchAvsox = (code) => {
    const url = 'https://avsox.host/cn/search/' + encodeURIComponent(code);
    return gmRequest({ method: 'GET', url, anonymous: true, timeout: 15000 }).then(res => {
        const doc = parseHTML(res.responseText);
        const item = doc.querySelector('.movie-box');
        if (!item) throw new Error('No movie found');
        const titleEl = item.querySelector('.title') || item.querySelector('.name');
        if (!titleEl) throw new Error('No title element');
        const title = titleEl.textContent.trim();
        const dateEl = doc.querySelector('.date') || doc.querySelector('.info .date');
        const date = dateEl ? dateEl.textContent.trim() : '';
        const actresses = [];
        doc.querySelectorAll('.star a, .actress a').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
        if (!title) throw new Error('No title content');
        return { title, date, actresses, uncensored: true };
    });
};

const fetchAvmoo = (code) => {
    const url = 'https://avmoo.host/cn/search/' + encodeURIComponent(code);
    return gmRequest({ method: 'GET', url, anonymous: true, timeout: 15000 }).then(res => {
        const doc = parseHTML(res.responseText);
        const item = doc.querySelector('.movie-box');
        if (!item) throw new Error('No movie found');
        const titleEl = item.querySelector('.title') || item.querySelector('.name');
        if (!titleEl) throw new Error('No title');
        const title = titleEl.textContent.trim();
        const dateEl = doc.querySelector('.date') || doc.querySelector('.info .date');
        const date = dateEl ? dateEl.textContent.trim() : '';
        const actresses = [];
        doc.querySelectorAll('.star a, .actress a').forEach(a => { const n = a.textContent.trim(); if (n) actresses.push(n); });
        return { title, date, actresses, uncensored: true };
    });
};

// ============================================================================
// 10. 多源聚合
// ============================================================================
const SOURCE_REGISTRY = {
    javdb: fetchJavdb,
    javbus: fetchJavbus,
    javlibrary: fetchJavlib,
    xslist: fetchXslist,
    fc2ppvdb: fetchFC2PPVDB,
    missav: fetchMissavFC2,
    avsox: fetchAvsox,
    avmoo: fetchAvmoo
};

const fetchRemoteInfo = (code, isUncensored = false) => {
    const key = code.toUpperCase();
    if (isInfoCacheValid(key)) return Promise.resolve(infoCache[key]);
    if (isNegativeCached(key)) return Promise.reject(new Error('Negative cache'));

    const s = loadSettings();
    const enabled = new Set(String(s.scrapeSources || '').split(',').map(x => x.trim()).filter(Boolean));

    const isFc2 = /^FC2-PPV-\d{5,8}$/i.test(code);
    const priority = isFc2
        ? ['javdb', 'missav', 'fc2ppvdb']
        : (isUncensored ? ['avsox', 'avmoo', 'javbus'] : ['javdb', 'javbus', 'javlibrary', 'xslist']);

    const sources = priority.filter(k => enabled.has(k) && SOURCE_REGISTRY[k]).map(k => SOURCE_REGISTRY[k]);
    if (!sources.length) return Promise.reject(new Error('No sources enabled'));

    const promises = sources.map(fn => fn(code).then(info => { storeInfo(key, info); return info; }).catch(() => null));

    return new Promise((resolve, reject) => {
        let settled = false;
        const checkDone = () => {
            if (settled) return;
            Promise.allSettled(promises).then(results => {
                const first = results.find(r => r.status === 'fulfilled' && r.value);
                if (first) { settled = true; resolve(first.value); }
                else { settled = true; markNegativeCached(key); reject(new Error('All sources failed')); }
            });
        };
        let remaining = promises.length;
        promises.forEach(p => p.finally(() => { remaining--; if (remaining === 0) checkDone(); }));
        setTimeout(checkDone, 30000);
    });
};

// ============================================================================
// 11. 翻译
// ============================================================================
const translateTitleToChinese = (title) => {
    return new Promise((resolve) => {
        const originalTitle = String(title || '').trim();
        if (!originalTitle) { resolve(''); return; }
        const deepL = () => gmRequest({
            method: 'POST',
            url: 'https://oneshot-free.www.deepl.com/v1/translate',
            headers: { 'Authorization': 'None', 'Content-Type': 'application/json' },
            data: JSON.stringify({ text: [originalTitle], source_lang: 'ja', target_lang: 'zh-Hans' }),
            anonymous: true, timeout: 15000
        }).then(res => {
            const data = JSON.parse(res.responseText);
            const translated = data?.translations?.[0]?.text?.trim() || '';
            if (translated && translated !== originalTitle) return translated;
            throw new Error('DeepL empty');
        });
        const myMemory = () => gmRequest({
            method: 'GET',
            url: 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(originalTitle) + '&langpair=ja%7Czh-CN',
            anonymous: true, timeout: 15000
        }).then(res => {
            const data = JSON.parse(res.responseText);
            if (data.responseStatus !== 200) throw new Error('MyMemory status');
            const translated = data?.responseData?.translatedText?.trim() || '';
            if (translated && translated !== originalTitle && !/MYMEMORY WARNING|DAILY LIMIT/i.test(translated)) return translated;
            throw new Error('MyMemory invalid');
        });
        deepL().catch(() => myMemory()).then(t => resolve(t)).catch(() => resolve(''));
    });
};

// ============================================================================
// 12. 改名主流程
// ============================================================================
const getTargetName = async (vInfo, suffix) => {
    const code = vInfo.queryCode;
    const key = code.toUpperCase();
    if (isInfoCacheValid(key)) return buildNameFromInfo(vInfo, infoCache[key], suffix);
    try {
        const isUncensored = vInfo.markers && vInfo.markers.includes('无码');
        const info = await fetchRemoteInfo(code, isUncensored);
        if (info) { storeInfo(key, info); return await buildNameFromInfo(vInfo, info, suffix); }
        return null;
    } catch { return null; }
};

const buildNameFromInfo = async (vInfo, info, suffix) => {
    const s = loadSettings();
    if (info && info.uncensored && vInfo.markers && !vInfo.markers.includes('无码')) vInfo.markers.push('无码');
    let zhTitle = '';
    if (s.translateChinese && info && info.title) {
        const t = await translateTitleToChinese(info.title);
        if (t && t !== info.title) zhTitle = t;
    }
    return buildNewName(vInfo, { ...info, zhTitle }, suffix);
};

window.rename_multi = (fid, vInfo, suffix, callback, origFilename) => {
    getTargetName(vInfo, suffix).then(newName => {
        if (newName) send_115(fid, newName, vInfo.fullCode, origFilename, callback);
        else {
            if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode)) {
                showPageNotification(`${vInfo.fullCode} 已保护手动命名，跳过`, 'info', 3000);
            } else {
                showPageNotification(`所有信息源未找到 ${vInfo.queryCode}`, 'error', 4000);
            }
            if (typeof callback === 'function') callback();
        }
    }).catch(() => { if (typeof callback === 'function') callback(); });
};

const local_rename = (fid, vInfo, suffix, callback, origFilename) => {
    const info = { title: vInfo.localTitle, date: vInfo.date, actresses: [] };
    const newName = buildNewName(vInfo, info, suffix);
    const bareName = buildNewName(vInfo, { title: '', date: vInfo.date, actresses: [] }, suffix);
    if (origFilename && hasManualNamePayload(origFilename, vInfo.queryCode) && newName === bareName) {
        showPageNotification(`${vInfo.fullCode} 已保护手动命名，跳过`, 'info', 3000);
        if (typeof callback === 'function') callback();
        return;
    }
    send_115(fid, newName, vInfo.fullCode, origFilename, callback);
};

// ============================================================================
// 13. 发送修改请求
// ============================================================================
let renameCompareList = [];

const send_115 = (id, name, fh, origFilename, callback) => {
    const fn = name.replace(/[\\/:*?"<>|]/g, (c) => ({'\\':'','/':' ',':':' ','?':' ','"':' ','<':' ','>':' ','|':''})[c] || '');
    $.post('https://webapi.115.com/files/edit', { fid: id, file_name: fn }, data => {
        const r = JSON.parse(data);
        if (!r.state) showPageNotification(`${fh} 修改失败: ${r.error}`, 'error', 3000);
        else {
            showPageNotification(`${fh} 修改成功`, 'success', 2000);
            if (origFilename) renameCompareList.push({ original: origFilename, new: name });
        }
        if (typeof callback === 'function') callback();
    }).fail(() => { showPageNotification(`${fh} 请求失败`, 'error', 3000); if (typeof callback === 'function') callback(); });
};

// ============================================================================
// 14. 进度条与通知
// ============================================================================
window.renameInProgress = false;

function runTasksWithLimit(tasks, limit, intervalMs, doneAll) {
    if (!tasks.length) { doneAll && doneAll(); return; }
    let index = 0, running = 0;
    let doneAllCalled = false;
    const callDoneAllOnce = () => { if (!doneAllCalled) { doneAllCalled = true; doneAll && doneAll(); } };
    const next = () => {
        if (index >= tasks.length && running === 0) { callDoneAllOnce(); return; }
        while (running < limit && index < tasks.length) {
            if (window.progressBox && window.progressBox.paused) { setTimeout(next, 500); return; }
            const task = tasks[index++];
            running++;
            setTimeout(() => { task(() => { running--; setTimeout(next, intervalMs || 0); }); }, 0);
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
        this.update(0);
        $box.show();
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

// ============================================================================
// 15. 预览模板
// ============================================================================
const showRenamePreview = (rows, onConfirm, onCancel) => {
    const old = document.getElementById('rename-preview-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rename-preview-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    overlay.innerHTML = `
        <div style="width:min(1100px,calc(100vw - 32px));max-height:88vh;background:#fff;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow:hidden;">
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
            const statusColor = row.status === '手动命名保护' ? '#fa8c16' : (row.status === '未找到' || row.status === '错误' ? '#cf1322' : '#52c41a');
            tr.innerHTML = `
                <input type="checkbox" class="rp-chk" data-idx="${idx}" ${row.checked ? 'checked' : ''} style="margin-top:2px;flex-shrink:0;width:16px;height:16px;">
                <div style="flex-shrink:0;width:150px;font-family:monospace;color:#1890ff;font-weight:600;">${escapeHtml(row.item.vi.fullCode)}</div>
                <div style="flex:1;min-width:0;word-break:break-all;color:#333;">${escapeHtml(row.item.fn)}</div>
                <div style="flex:1.2;min-width:0;word-break:break-all;color:#1890ff;">${escapeHtml(row.newName || '—')}</div>
                <div style="flex-shrink:0;width:96px;text-align:center;color:${statusColor};font-weight:500;">${escapeHtml(row.status)}</div>`;
            body.appendChild(tr);
        });
        updateSummary();
    };

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
    renderList();
};

// ============================================================================
// 16. 预览构建与执行
// ============================================================================
const buildPreviewRows = (parsedItems, isLocal, done) => {
    const rows = [];
    if (isLocal) {
        parsedItems.forEach(item => {
            const info = { title: item.vi.localTitle, date: item.vi.date, actresses: [] };
            const newName = buildNewName(item.vi, info, item.safeSuffix);
            const bareName = buildNewName(item.vi, { title: '', date: item.vi.date, actresses: [] }, item.safeSuffix);
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
            getTargetName(item.vi, item.safeSuffix).then(newName => {
                let status = '网络', checked = true;
                if (!newName) {
                    status = hasManualNamePayload(item.fn, item.vi.queryCode) ? '手动命名保护' : '未找到';
                    checked = false;
                }
                results[idx] = { item, newName, status, checked };
                if (--remaining === 0) done(results.filter(Boolean));
            }).catch(() => {
                results[idx] = { item, newName: null, status: '错误', checked: false };
                if (--remaining === 0) done(results.filter(Boolean));
            });
        });
    };
    if (!missingCodes.length) { afterPrefetch(); return; }
    let prefetched = 0;
    const prefetchNext = () => {
        if (prefetched >= missingCodes.length) { afterPrefetch(); return; }
        const code = missingCodes[prefetched++];
        fetchRemoteInfo(code).catch(() => {}).finally(() => setTimeout(prefetchNext, 200));
    };
    const concurrency = Math.min(3, missingCodes.length);
    for (let i = 0; i < concurrency; i++) prefetchNext();
};

const persistCaches = () => {
    setCache('jb_infoCache', infoCache);
    setCache('jb_actressCache', actressCache);
    setCache('jb_ratingCache', ratingCache);
    setCache('jb_negativeCache', negativeCache);
};

const rename = (call) => {
    if (window.renameInProgress) { showPageNotification('已有任务正在进行中，请等待完成', 'info', 2000); return; }
    window.renameInProgress = true;
    const s = loadSettings();

    const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
    if (!$items.length) { showPageNotification("请先选择文件或文件夹", 'info', 3000); window.renameInProgress = false; return; }

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

    if (!parsedItems.length) { showPageNotification("未识别到有效番号", 'info', 3000); window.renameInProgress = false; return; }

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
    const cancelRename = () => { persistCaches(); showPageNotification('已取消改名', 'info', 2000); window.renameInProgress = false; };

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
        const conc = isLocal ? Math.max(3, s.renameConcurrency) : s.renameConcurrency;
        runTasksWithLimit(tasks, conc, 200, finishRename);
    };

    if (isLocal) {
        buildPreviewRows(parsedItems, true, rows => showRenamePreview(rows, executeRename, cancelRename));
    } else {
        showPageNotification('正在联网生成改名预览...', 'info', 4000);
        buildPreviewRows(parsedItems, false, rows => showRenamePreview(rows, executeRename, cancelRename));
    }
};

// ============================================================================
// 17. 备份与剪贴板
// ============================================================================
function offerCompareExport() {
    if (renameCompareList.length === 0) return;
    if (confirm('改名已完成，是否导出对比？')) {
        if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) exportCompareToFile(renameCompareList);
        else copyCompareToClipboard(renameCompareList);
    }
}
function exportCompareToFile(list) {
    const text = list.map(item => `${item.original}\t${item.new}`).join('\n');
    downloadTxt('Rename_Compare.txt', '【旧文件名】\t【新文件名】\n' + text);
}
function copyCompareToClipboard(list) {
    const text = list.map(item => `${item.original}\t${item.new}`).join('\n');
    copyToClipboard('【旧文件名】\t【新文件名】\n' + text);
}
function backupFileNames() {
    const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
    if ($items.length === 0) { showPageNotification("请先选中要备份的文件", 'info', 3000); return; }
    const names = [];
    $items.each(function () { const t = $(this).attr("title"); if (t) names.push(t); });
    if (!names.length) return;
    const text = names.join('\n');
    if (confirm('导出为 TXT 文件？\n（确定 = TXT，取消 = 复制到剪贴板）')) downloadTxt('115_File_Backup.txt', text);
    else copyToClipboard(text);
}
function downloadTxt(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showPageNotification('TXT 文件已下载', 'success', 3000);
}
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showPageNotification('已复制到剪贴板', 'success', 3000))
            .catch(() => { GM_setClipboard(text); showPageNotification('已复制到剪贴板', 'success', 3000); });
    } else { GM_setClipboard(text); showPageNotification('已复制到剪贴板', 'success', 3000); }
}

// ============================================================================
// 18. 归档
// ============================================================================
let archiveRootCid = null;
let archiveRootName = null;
let archiveRootPath = '';

function initArchiveRoot() {
    loadSettings();
    if (SETTINGS.archiveRootCid) {
        archiveRootCid = SETTINGS.archiveRootCid;
        archiveRootName = SETTINGS.archiveRootName;
        archiveRootPath = SETTINGS.archiveRootPath || '';
    } else {
        archiveRootCid = GM_getValue('archiveRootCid', null);
        archiveRootName = GM_getValue('archiveRootName', null);
        archiveRootPath = GM_getValue('archiveRootPath', '');
    }
}
initArchiveRoot();

function getPathCid(path) {
    return new Promise(resolve => {
        try {
            $.get('https://webapi.115.com/files/getid', { path: '/' + String(path || '').replace(/^\/+/, '') }, d => {
                try {
                    const r = typeof d === 'string' ? JSON.parse(d) : d;
                    if (r && (r.state || r.id || r.cid)) {
                        const id = r.id ?? r.cid ?? r.file_id ?? (r.data && (r.data.id ?? r.data.cid));
                        if (id) { resolve(String(id)); return; }
                    }
                    resolve(null);
                } catch { resolve(null); }
            }).fail(() => resolve(null));
        } catch { resolve(null); }
    });
}

function createFolderApi(pid, name) {
    return new Promise((resolve, reject) => {
        $.post('https://webapi.115.com/files/add', { pid: pid || 0, cname: name }, d => {
            try {
                const r = typeof d === 'string' ? JSON.parse(d) : d;
                if (r && r.state) { resolve(String(r.cid || r.id)); return; }
                if (r && r.errno === 20004) { resolve('CONFLICT'); return; }
                reject(new Error(r && r.error || '创建失败'));
            } catch (e) { reject(e); }
        }).fail(() => reject(new Error('网络错误')));
    });
}

async function resolveArchiveRootByPath(path) {
    path = String(path || '').trim().replace(/^\/+|\/+$/g, '');
    if (!path) return { cid: null, name: null, path: '' };
    const parts = path.split('/').filter(Boolean);
    let parentCid = 0;
    for (let i = 0; i < parts.length; i++) {
        const curPath = parts.slice(0, i + 1).join('/');
        let cid = await getPathCid(curPath);
        if (!cid) {
            try {
                const r = await createFolderApi(parentCid, parts[i]);
                cid = r === 'CONFLICT' ? await getPathCid(curPath) : r;
            } catch { cid = await getPathCid(curPath); }
        }
        if (!cid) throw new Error(`目录不存在且无法创建：${parts[i]}`);
        parentCid = cid;
    }
    return { cid: String(parentCid), name: parts[parts.length - 1] || '', path };
}

const getSeriesFromCode = (code) => {
    const c = (typeof code === 'object' ? code.queryCode : String(code)).toUpperCase();
    if (/^FC2-PPV/.test(c) || /^\d{6}_\d{3}$/.test(c) || /^1PONDO[-_]/.test(c) || /^CARIB[-_]/.test(c)) return null;
    const m = c.match(/^([A-Z]+)-\d+/);
    return m ? m[1] : null;
};

const folderCidCache = {};
const ROOT_DIR_CID = "0";

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
            if (errorMsg.includes('尚未完成') || errorMsg.includes('请稍后再试')) showPageNotification(`归档到 ${folderName} 暂时失败，请稍后重试`, 'error', 5000);
            else showPageNotification(`归档到 ${folderName} 失败: ${errorMsg}`, 'error', 5000);
            if (typeof failCallback === 'function') failCallback(errorMsg);
        }
    }).fail(err => { showPageNotification(`移动文件请求失败: ${err.statusText || '网络错误'}`, 'error', 5000); if (typeof failCallback === 'function') failCallback(err.statusText); });
};

const archiveToActorFolder = () => {
    const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
    if (!$items.length) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }
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
        const s = loadSettings();
        progressBox.init('归档', parsedItems.length);
        let processed = 0, success = 0;
        const tasks = parsedItems.map(item => done => {
            const code = item.vi.queryCode;
            if (/^FC2-PPV-\d{5,8}$/i.test(code)) {
                findOrCreateFolderAndMove(item.fid, "FC2", () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
            } else {
                let folderName = '';
                const key = code.toUpperCase();
                const entries = (isInfoCacheValid(key) && infoCache[key].actorEntries) || [];
                const rawActress = actressCache[key]?.[0] || '';
                if (entries.length > 0) {
                    const pref = entries.find(e => e.gender === 'female') || entries.find(e => e.gender === 'unknown') || entries[0];
                    folderName = pref ? getStandardActressName(pref.name) : '';
                } else if (rawActress) folderName = getStandardActressName(rawActress);
                if (!folderName) folderName = getSeriesFromCode(code) || '其他';
                findOrCreateFolderAndMove(item.fid, folderName, () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
            }
        });
        runTasksWithLimit(tasks, s.archiveConcurrency || 3, 500, () => {
            progressBox.finish();
            showPageNotification(`归档完成：成功 ${success}/${parsedItems.length}`, 'success', 5000);
            persistCaches();
        });
    };

    if (missingCodes.length) {
        progressBox.init('预取演员信息', missingCodes.length);
        let idx = 0;
        const next = () => {
            if (idx >= missingCodes.length) { progressBox.finish(); startArchive(); return; }
            const code = missingCodes[idx++];
            progressBox.update(idx);
            fetchRemoteInfo(code).then(info => {
                if (info) {
                    infoCache[code.toUpperCase()] = info;
                    if (info.actresses && info.actresses.length) actressCache[code.toUpperCase()] = info.actresses;
                }
            }).finally(() => setTimeout(next, 500));
        };
        const conc = Math.min(2, missingCodes.length);
        for (let i = 0; i < conc; i++) next();
    } else {
        startArchive();
    }
};

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
    if (!$items.length) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }
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

    const s = loadSettings();
    progressBox.init('分桶归档', parsedItems.length);
    let processed = 0, success = 0;
    const tasks = parsedItems.map(item => done => {
        const bucket = getBucketFolderName(item.vi.queryCode);
        findOrCreateFolderAndMove(item.fid, bucket, () => { processed++; success++; progressBox.update(processed); done(); }, () => { processed++; progressBox.update(processed); done(); });
    });
    runTasksWithLimit(tasks, s.archiveConcurrency || 3, 500, () => {
        progressBox.finish();
        showPageNotification(`分桶归档完成：成功 ${success}/${parsedItems.length}`, 'success', 5000);
        setCache('jb_negativeCache', negativeCache);
    });
};

// ============================================================================
// 19. JavDB 评分
// ============================================================================
const fetchRatingForCode = (code) => new Promise((resolve) => {
    GM_xmlhttpRequest({
        method: "GET",
        url: javdbSearchBase + encodeURIComponent(code) + "&f=all",
        timeout: 15000,
        anonymous: true,
        onload: xhr => {
            if (xhr.status !== 200) { resolve(null); return; }
            try {
                const doc = parseHTML(xhr.responseText);
                const item = doc.querySelector('.movie-list .item');
                if (item) {
                    let rating = parseFloat(item.getAttribute('score'));
                    if (isNaN(rating)) {
                        const rel = item.querySelector('.score .value');
                        if (rel) { const m = rel.textContent.trim().match(/(\d+\.\d+)分/); if (m) rating = parseFloat(m[1]); }
                    }
                    if (!isNaN(rating)) { resolve(Math.round(rating)); return; }
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
                                            const r = parseFloat(rEl.textContent.trim().match(/(\d+\.\d+)/)?.[1]);
                                            if (!isNaN(r)) { resolve(Math.round(r)); return; }
                                        }
                                        resolve(null);
                                    } catch { resolve(null); }
                                },
                                onerror: () => resolve(null),
                                ontimeout: () => resolve(null)
                            });
                            return;
                        }
                    }
                }
                resolve(null);
            } catch { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null)
    });
});

const update115Rating = (fid, star, fh, fname, callback) => {
    star = Math.max(1, Math.min(5, star));
    const finish = ok => { showPageNotification(`"${fh}"评分${ok ? `更新为 ${star} 星` : '更新失败'}`, ok ? 'success' : 'error', 2000); callback(ok); };
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

const getJavdbRating = () => {
    const $items = $("iframe[rel='wangpan']").contents().find("li.selected");
    if (!$items.length) { showPageNotification("请先选择文件或文件夹", 'info', 3000); return; }

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
            } else { processed++; progressBox.update(processed); done(); }
        });
        runTasksWithLimit(tasks, 2, 300, () => {
            progressBox.finish();
            showPageNotification(`评分更新完成：成功 ${success}/${parsedItems.length}`, 'success', 5000);
            setCache('jb_ratingCache', ratingCache);
        });
    };

    if (missingCodes.length) {
        progressBox.init('获取评分', missingCodes.length);
        let idx = 0;
        const next = () => {
            if (idx >= missingCodes.length) { progressBox.finish(); startUpdate(); return; }
            const code = missingCodes[idx++];
            progressBox.update(idx);
            fetchRatingForCode(code).then(star => { if (star) ratingCache[code] = star; }).finally(() => setTimeout(next, 300));
        };
        const conc = Math.min(2, missingCodes.length);
        for (let i = 0; i < conc; i++) next();
    } else startUpdate();
};

// ============================================================================
// 20. 设置面板
// ============================================================================
function openSettingsPanel() {
    const existing = document.getElementById('rename2026-settings');
    if (existing) existing.remove();
    loadSettings();
    const s = SETTINGS;
    const orderArr = String(s.fieldOrder || 'code,title,actresses,date').split(',').map(x => x.trim()).filter(Boolean);
    const enabledSources = new Set(String(s.scrapeSources || '').split(',').map(x => x.trim()).filter(Boolean));
    const allSources = ['javdb', 'javbus', 'javlibrary', 'xslist', 'fc2ppvdb', 'missav', 'avsox', 'avmoo'];
    const sourceLabels = { javdb: 'JavDB', javbus: 'JavBus', javlibrary: 'JavLibrary', xslist: 'Xslist', fc2ppvdb: 'FC2PPVDB', missav: 'MissAV', avsox: 'Avsox', avmoo: 'AVMoo' };
    const mv = s.menuVisibility || {};

    const renderFieldRows = () => orderArr.map((key, i) => {
        const def = FIELD_DEFINITIONS[key];
        if (!def) return '';
        const checked = def.fixed || (s[def.settingKey] !== false);
        const disabled = def.fixed;
        return `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;margin-bottom:6px;">
                <span style="flex:0 0 26px;text-align:center;color:#94a3b8;font-weight:600;">${i + 1}.</span>
                <label style="flex:1;display:flex;align-items:center;gap:8px;cursor:${disabled ? 'default' : 'pointer'};">
                    <input type="checkbox" data-field-enable="${key}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="cursor:pointer;width:15px;height:15px;">
                    <span style="font-size:13px;color:#0f172a;">${def.label}</span>
                    ${def.fixed ? '<span style="font-size:11px;color:#94a3b8;">(必需)</span>' : ''}
                </label>
                <button type="button" data-field-up="${key}" ${i === 0 ? 'disabled' : ''} style="padding:3px 9px;border:1px solid #cbd5e1;background:${i === 0 ? '#f1f5f9' : '#f8fafc'};border-radius:4px;cursor:${i === 0 ? 'not-allowed' : 'pointer'};font-size:12px;">↑</button>
                <button type="button" data-field-down="${key}" ${i === orderArr.length - 1 ? 'disabled' : ''} style="padding:3px 9px;border:1px solid #cbd5e1;background:${i === orderArr.length - 1 ? '#f1f5f9' : '#f8fafc'};border-radius:4px;cursor:${i === orderArr.length - 1 ? 'not-allowed' : 'pointer'};font-size:12px;">↓</button>
            </div>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'rename2026-settings';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    overlay.innerHTML = `
        <div style="width:min(760px,calc(100vw - 32px));max-height:90vh;background:#fff;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;">
            <div style="padding:14px 20px;background:linear-gradient(135deg,#1a6dff,#1890ff);color:#fff;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;font-size:16px;">115Rename 设置 · v${SCRIPT_VERSION}</h3>
                <button type="button" id="rs-close" style="background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
            </div>
            <div style="padding:16px 20px;overflow:auto;flex:1;">

                <div style="margin-bottom:20px;">
                    <h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">字段顺序与开关</h4>
                    <p style="margin:0 0 8px;font-size:12px;color:#64748b;">番号固定第一项。其他字段可启用/停用并调整顺序。改名后顺序按从上到下拼接。</p>
                    <div id="rs-field-list">${renderFieldRows()}</div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
                    <label style="display:flex;flex-direction:column;gap:4px;">
                        <span style="font-size:12px;color:#475569;">字段分隔符</span>
                        <input type="text" id="rs-field-sep" value="${escapeHtml(s.fieldSeparator || ' ')}" style="height:32px;padding:0 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                    </label>
                    <label style="display:flex;flex-direction:column;gap:4px;">
                        <span style="font-size:12px;color:#475569;">日期前缀 (加在日期前)</span>
                        <input type="text" id="rs-date-prefix" value="${escapeHtml(s.datePrefix || '')}" style="height:32px;padding:0 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                    </label>
                    <label style="display:flex;flex-direction:column;gap:4px;">
                        <span style="font-size:12px;color:#475569;">女优分隔符</span>
                        <input type="text" id="rs-actress-sep" value="${escapeHtml(s.actressSeparator || '・')}" style="height:32px;padding:0 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                    </label>
                    <label style="display:flex;flex-direction:column;gap:4px;">
                        <span style="font-size:12px;color:#475569;">改名并发数 (1-10)</span>
                        <input type="number" id="rs-rename-concurrency" value="${s.renameConcurrency || 3}" min="1" max="10" style="height:32px;padding:0 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                    </label>
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">选项开关</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;">
                            <input type="checkbox" id="rs-translate" ${s.translateChinese ? 'checked' : ''}>
                            <span style="font-size:13px;">翻译中文标题</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;">
                            <input type="checkbox" id="rs-enable-markers" ${s.enableMarkers ? 'checked' : ''}>
                            <span style="font-size:13px;">附加【中字/无码】等标记</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;">
                            <input type="checkbox" id="rs-protect-manual" ${s.protectManualName ? 'checked' : ''}>
                            <span style="font-size:13px;">保护手动命名</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;">
                            <input type="checkbox" id="rs-cd-prefix" ${s.useCdPrefix ? 'checked' : ''}>
                            <span style="font-size:13px;">分段使用 cd 前缀</span>
                        </label>
                    </div>
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">右键菜单可见性</h4>
                    <p style="margin:0 0 8px;font-size:12px;color:#64748b;">取消勾选后，右键菜单中隐藏该项。</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        ${MENU_ITEMS.map(it => `<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:12px;"><input type="checkbox" data-menu-vis="${it.key}" ${mv[it.key] !== false ? 'checked' : ''}><span>${it.label}</span></label>`).join('')}
                    </div>
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">刮削源</h4>
                    <p style="margin:0 0 8px;font-size:12px;color:#64748b;">勾选启用的站点（并行请求，第一个成功返回即用）。</p>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
                        ${allSources.map(k => `<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:12px;"><input type="checkbox" data-source="${k}" ${enabledSources.has(k) ? 'checked' : ''}><span>${sourceLabels[k]}</span></label>`).join('')}
                    </div>
                </div>

                <div style="margin-bottom:8px;">
                    <h4 style="margin:0 0 8px;font-size:14px;color:#0f172a;">归档根目录</h4>
                    <p style="margin:0 0 8px;font-size:12px;color:#64748b;">当前：${archiveRootCid ? `「${escapeHtml(archiveRootPath || archiveRootName || archiveRootCid)}」 (cid: ${archiveRootCid})` : '未设置（使用 115 网盘根目录）'}</p>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <input type="text" id="rs-archive-path" value="${escapeHtml(s.archiveRootPath || '')}" placeholder="如 /归档 或 /我的资源/归档（相对网盘根）" style="flex:1;min-width:240px;height:34px;padding:0 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                        <button type="button" id="rs-archive-apply" style="padding:7px 14px;border:1px solid #1a6dff;background:#1a6dff;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;">解析并保存</button>
                    </div>
                    <p style="margin:6px 0 8px;font-size:11px;color:#94a3b8;">路径不存在会自动创建；也可以右键选中文件夹 → 设为归档根目录。</p>
                    <button type="button" id="rs-clear-archive-root" style="padding:6px 14px;border:1px solid #fca5a5;background:#fff1f2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:12px;">清除归档根目录</button>
                </div>

            </div>
            <div style="padding:12px 20px;border-top:1px solid #eee;text-align:right;background:#fafafa;display:flex;justify-content:space-between;align-items:center;">
                <button type="button" id="rs-reset" style="padding:7px 14px;border:1px solid #fca5a5;background:#fff1f2;color:#b91c1c;border-radius:6px;cursor:pointer;font-size:13px;">恢复默认</button>
                <div>
                    <button type="button" id="rs-cancel" style="padding:7px 18px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;cursor:pointer;font-size:13px;margin-right:8px;">取消</button>
                    <button type="button" id="rs-save" style="padding:7px 20px;border:0;background:#1a6dff;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">保存</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const refreshFields = () => {
        overlay.querySelector('#rs-field-list').innerHTML = renderFieldRows();
        bindFieldEvents();
    };
    function bindFieldEvents() {
        overlay.querySelectorAll('[data-field-up]').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.fieldUp;
                const idx = orderArr.indexOf(key);
                if (idx <= 0) return;
                [orderArr[idx - 1], orderArr[idx]] = [orderArr[idx], orderArr[idx - 1]];
                refreshFields();
            };
        });
        overlay.querySelectorAll('[data-field-down]').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.fieldDown;
                const idx = orderArr.indexOf(key);
                if (idx < 0 || idx >= orderArr.length - 1) return;
                [orderArr[idx], orderArr[idx + 1]] = [orderArr[idx + 1], orderArr[idx]];
                refreshFields();
            };
        });
    }
    bindFieldEvents();

    overlay.querySelector('#rs-close').onclick = () => overlay.remove();
    overlay.querySelector('#rs-cancel').onclick = () => overlay.remove();

    overlay.querySelector('#rs-archive-apply').onclick = async () => {
        const input = overlay.querySelector('#rs-archive-path');
        const path = input.value.trim();
        if (!path) { alert('请输入路径'); return; }
        const btn = overlay.querySelector('#rs-archive-apply');
        btn.disabled = true;
        const oldText = btn.textContent;
        btn.textContent = '解析中...';
        try {
            const res = await resolveArchiveRootByPath(path);
            if (!res.cid) throw new Error('无法获取目录ID');
            archiveRootCid = res.cid;
            archiveRootName = res.name;
            archiveRootPath = res.path;
            saveSettings({ archiveRootCid: res.cid, archiveRootName: res.name, archiveRootPath: res.path });
            alert(`归档根目录已保存：\n${res.path}\n(cid: ${res.cid})`);
            overlay.remove();
            cleanupExistingRootInfo();
            showArchiveRootInfo();
        } catch (e) {
            alert('解析失败：' + (e.message || e));
        } finally {
            btn.disabled = false;
            btn.textContent = oldText;
        }
    };

    overlay.querySelector('#rs-clear-archive-root').onclick = () => {
        if (!confirm('清除归档根目录？之后归档将使用网盘根目录。')) return;
        archiveRootCid = null;
        archiveRootName = null;
        archiveRootPath = '';
        saveSettings({ archiveRootCid: null, archiveRootName: null, archiveRootPath: '' });
        showPageNotification('已清除归档根目录', 'info', 2000);
        overlay.remove();
        cleanupExistingRootInfo();
        showArchiveRootInfo();
    };

    overlay.querySelector('#rs-reset').onclick = () => {
        if (!confirm('恢复所有设置到默认值？（不会清除缓存数据和归档根目录）')) return;
        const keepCid = SETTINGS.archiveRootCid;
        const keepName = SETTINGS.archiveRootName;
        const keepPath = SETTINGS.archiveRootPath;
        GM_setValue('rename2026_settings', '{}');
        SETTINGS = null;
        if (keepCid) saveSettings({ archiveRootCid: keepCid, archiveRootName: keepName, archiveRootPath: keepPath });
        overlay.remove();
        showPageNotification('已恢复默认设置', 'success', 2000);
    };

    overlay.querySelector('#rs-save').onclick = () => {
        const enableMap = {
            title: overlay.querySelector('[data-field-enable="title"]')?.checked ?? true,
            zhTitle: overlay.querySelector('[data-field-enable="zhTitle"]')?.checked ?? false,
            actresses: overlay.querySelector('[data-field-enable="actresses"]')?.checked ?? true,
            date: overlay.querySelector('[data-field-enable="date"]')?.checked ?? true,
        };
        const sources = [];
        overlay.querySelectorAll('[data-source]').forEach(cb => { if (cb.checked) sources.push(cb.dataset.source); });
        const menuVisibility = {};
        overlay.querySelectorAll('[data-menu-vis]').forEach(cb => { menuVisibility[cb.dataset.menuVis] = cb.checked; });

        saveSettings({
            fieldOrder: orderArr.join(','),
            fieldSeparator: overlay.querySelector('#rs-field-sep').value || ' ',
            datePrefix: overlay.querySelector('#rs-date-prefix').value,
            actressSeparator: overlay.querySelector('#rs-actress-sep').value || '・',
            enableTitle: enableMap.title,
            enableZhTitle: enableMap.zhTitle,
            enableActresses: enableMap.actresses,
            enableDate: enableMap.date,
            enableMarkers: overlay.querySelector('#rs-enable-markers').checked,
            translateChinese: overlay.querySelector('#rs-translate').checked,
            protectManualName: overlay.querySelector('#rs-protect-manual').checked,
            useCdPrefix: overlay.querySelector('#rs-cd-prefix').checked,
            renameConcurrency: Math.max(1, Math.min(10, parseInt(overlay.querySelector('#rs-rename-concurrency').value, 10) || 3)),
            scrapeSources: sources.join(','),
            menuVisibility,
        });
        showPageNotification('设置已保存', 'success', 2000);
        overlay.remove();
    };
}

// ============================================================================
// 21. UI 样式
// ============================================================================
const rootInfoId = 'archive-root-info-' + Date.now();
function cleanupExistingRootInfo() {
    try {
        document.querySelectorAll('[id^="archive-root-info"]').forEach(el => el.remove());
        document.querySelectorAll('iframe').forEach(iframe => {
            try { if (iframe.contentDocument) iframe.contentDocument.querySelectorAll('[id^="archive-root-info"]').forEach(el => el.remove()); } catch {}
        });
    } catch {}
}
cleanupExistingRootInfo();

$('head').append(`<style>
    [id^="archive-root-info"] { position: fixed; top: 20px; right: 20px; max-width: 320px; background: rgba(0,0,0,.8); color: #fff; padding: 12px 20px; border-radius: 4px; z-index: 9998; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,.15); border-left: 4px solid #1890ff; word-break: break-all; }
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
</style>`);

const showArchiveRootInfo = () => {
    cleanupExistingRootInfo();
    let msg;
    if (archiveRootCid) {
        const disp = archiveRootPath ? `「${archiveRootPath}」` : `「${archiveRootName || '未知'}」`;
        msg = `当前归档根目录: ${disp}`;
    } else {
        msg = "当前无归档根目录，将使用115网盘根目录";
    }
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

// ============================================================================
// 22. 右键菜单（动态生成）
// ============================================================================
function buildMenuHtml() {
    const s = loadSettings();
    const mv = s.menuVisibility || {};
    const items = MENU_ITEMS.filter(it => mv[it.key] !== false);
    if (!items.length) return '';
    return `<li id="rename_list">${items.map(it => `<a id="${it.id}" class="mark" href="javascript:;">${it.label}</a>`).join('')}</li>`;
}

function bindMenuEvents() {
    $("a#local_code_process").off("click").on("click", () => rename(local_rename));
    $("a#rename_all_multi_date").off("click").on("click", () => { saveSettings({ translateChinese: false }); rename(rename_multi); });
    $("a#rename_all_multi_zh").off("click").on("click", () => { saveSettings({ translateChinese: true }); rename(rename_multi); });
    $("a#archive_to_folder").off("click").on("click", archiveToActorFolder);
    $("a#archive_to_bucket").off("click").on("click", archiveToBucketFolder);
    $("a#set_archive_root").off("click").on("click", setArchiveRoot);
    $("a#get_javdb_rating").off("click").on("click", getJavdbRating);
    $("a#backup_file_names").off("click").on("click", backupFileNames);
}

let interval = setInterval(buttonInterval, 1000);

function buttonInterval() {
    const $menu = $("div#js_float_content");
    if ($menu.length === 0) return;
    const openDir = $menu.find("li[val='open_dir'], li[data-val='open_dir'], li[menu='open_dir']");
    if (openDir.length !== 0 && $("li#rename_list").length === 0) {
        const html = buildMenuHtml();
        if (html) {
            openDir.before(html);
            bindMenuEvents();
        }
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
        archiveRootCid = cid;
        archiveRootName = name;
        archiveRootPath = '';
        saveSettings({ archiveRootCid: cid, archiveRootName: name, archiveRootPath: '' });
        cleanupExistingRootInfo();
        showArchiveRootInfo();
        showPageNotification(`归档根目录设置成功: "${name}"`, 'success', 5000);
    }
}

// ============================================================================
// 23. GM 菜单
// ============================================================================
try {
    GM_registerMenuCommand('⚙️ 115Rename 设置', openSettingsPanel);
    GM_registerMenuCommand('📋 备份文件名', backupFileNames);
    GM_registerMenuCommand('ℹ️ 版本信息', () => showPageNotification(`115Rename2026 v${SCRIPT_VERSION}`, 'info', 3000));
} catch (e) {
    console.warn('GM_registerMenuCommand not supported:', e);
}

console.log(`115Rename2026 v${SCRIPT_VERSION} 已加载`);
})();