/**
 * 115网盘新版 DOM 结构检测脚本
 * 使用方法：
 * 1. 登录 115.com，进入文件列表页面 https://115.com/storage/allfiles?cid=0&mode=wangpan
 * 2. 按 F12 打开开发者工具，切换到 Console 标签
 * 3. 粘贴此脚本全部内容，按回车运行
 * 4. 将控制台输出的结果复制给我
 */

(function () {
    "use strict";
    console.log("=== 115网盘新版 DOM 检测开始 ===\n");

    // 1. 检测页面框架
    console.log("【1. 页面框架】");
    console.log("  Next.js:", typeof window.__next_f !== "undefined" ? "✅ 是" : "❌ 否");
    console.log("  React:", typeof window.React !== "undefined" ? "✅ 是" : "❌ 否（可能被webpack封装）");
    console.log("  body class:", document.body.className);
    console.log("");

    // 2. 检测所有有 id 的元素（React 通常不会给元素加 id）
    console.log("【2. 页面中所有带 id 的元素】");
    const allIds = Array.from(document.querySelectorAll("[id]")).map(el => ({
        id: el.id,
        tag: el.tagName,
        class: el.className?.toString().substring(0, 80) || "",
    }));
    console.table(allIds);
    console.log("");

    // 3. 检测所有 data-* 属性
    console.log("【3. 页面中使用的 data-* 属性名】");
    const dataAttrs = new Set();
    document.querySelectorAll("*").forEach(el => {
        for (const attr of el.attributes) {
            if (attr.name.startsWith("data-")) dataAttrs.add(attr.name);
        }
    });
    console.log("  data-* 属性:", [...dataAttrs].sort());
    console.log("");

    // 4. 检测文件列表区域
    console.log("【4. 文件列表区域】");
    // 查找可能的文件列表容器
    const possibleContainers = [
        // 常见 React 组件特征
        ...Array.from(document.querySelectorAll("[class*='file']")),
        ...Array.from(document.querySelectorAll("[class*='list']")),
        ...Array.from(document.querySelectorAll("[class*='table']")),
        ...Array.from(document.querySelectorAll("[class*='grid']")),
        ...Array.from(document.querySelectorAll("[role='list']")),
        ...Array.from(document.querySelectorAll("[role='grid']")),
        ...Array.from(document.querySelectorAll("[role='table']")),
    ];
    // 去重
    const uniqueContainers = [];
    const seen = new Set();
    for (const el of possibleContainers) {
        if (!seen.has(el)) {
            seen.add(el);
            uniqueContainers.push(el);
        }
    }
    console.log(`  找到 ${uniqueContainers.length} 个候选容器`);
    uniqueContainers.slice(0, 15).forEach((el, i) => {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className?.toString() || "").substring(0, 80);
        const childCount = el.children.length;
        const rect = el.getBoundingClientRect();
        console.log(
            `  [${i}] <${tag}> class="${cls}" children=${childCount} size=${Math.round(rect.width)}x${Math.round(rect.height)}`
        );
    });
    console.log("");

    // 5. 查找文件行/文件项
    console.log("【5. 文件行/文件项元素】");
    // 尝试多种选择器
    const selectors = [
        "[class*='row']",
        "[class*='item']",
        "[class*='file']",
        "[role='row']",
        "[class*='tr']",
        "li",
        "tr",
    ];
    for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        if (els.length >= 3 && els.length <= 1000) {
            const sample = els[0];
            console.log(`  选择器 "${sel}" → ${els.length} 个元素`);
            console.log(`    标签: <${sample.tagName.toLowerCase()}>`);
            console.log(`    class: "${sample.className?.toString().substring(0, 100)}"`);
            console.log(
                `    attributes: ${Array.from(sample.attributes)
                    .map(a => `${a.name}="${a.value.substring(0, 60)}"`)
                    .join(", ")}`
            );
            console.log(`    innerText: "${sample.innerText?.substring(0, 100)}"`);
            console.log("");
            break; // 找到第一个有意义的就停
        }
    }
    console.log("");

    // 6. 检测选中状态
    console.log("【6. 选中状态检测】");
    // 请手动选中一个文件后再运行
    const selectedEls = document.querySelectorAll(
        "[class*='select'], [class*='active'], [class*='checked'], [class*='chosen'], [aria-selected='true'], [aria-checked='true']"
    );
    console.log(`  带选中/激活类名的元素: ${selectedEls.length} 个`);
    if (selectedEls.length > 0) {
        selectedEls.forEach((el, i) => {
            if (i < 5) {
                console.log(
                    `  [${i}] <${el.tagName.toLowerCase()}> class="${el.className
                        ?.toString()
                        .substring(0, 100)}" text="${el.innerText?.substring(0, 60)}"`
                );
            }
        });
    }
    console.log("  ⚠️ 如果上面没有结果，请手动选中一个文件后，再运行一次这个脚本");
    console.log("");

    // 7. 检测右键菜单
    console.log("【7. 右键菜单检测】");
    console.log("  ⚠️ 请手动在文件上右键，弹出菜单后，再运行一次这个脚本");
    // 查找可能的菜单容器
    const menuEls = document.querySelectorAll(
        "[class*='menu'], [class*='context'], [class*='dropdown'], [class*='popup'], [class*='float'], [role='menu']"
    );
    console.log(`  找到 ${menuEls.length} 个可能的菜单容器`);
    menuEls.forEach((el, i) => {
        if (i < 10) {
            const visible = el.offsetParent !== null || el.getBoundingClientRect().width > 0;
            console.log(
                `  [${i}] <${el.tagName.toLowerCase()}> visible=${visible} class="${el.className
                    ?.toString()
                    .substring(0, 100)}"`
            );
        }
    });
    console.log("");

    // 8. 检测所有 aria-* 属性（React 常用）
    console.log("【8. 无障碍属性 aria-* 汇总】");
    const ariaAttrs = new Set();
    document.querySelectorAll("*").forEach(el => {
        for (const attr of el.attributes) {
            if (attr.name.startsWith("aria-")) ariaAttrs.add(attr.name);
        }
    });
    console.log("  aria-* 属性:", [...ariaAttrs].sort());
    console.log("");

    // 9. 特殊检测：用 React DevTools 钩子获取信息
    console.log("【9. React 根节点】");
    const reactRoot = document.getElementById("__next") || document.querySelector("[data-reactroot]");
    if (reactRoot) {
        console.log("  React 根节点:", reactRoot.tagName, reactRoot.id || reactRoot.className?.toString().substring(0, 60));
        // 查看 React fiber
        const fiberKey = Object.keys(reactRoot).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
        if (fiberKey) console.log("  React Fiber 键:", fiberKey);
    }
    // 也检查 __next 或 root
    ["__next", "root", "app", "main"].forEach(id => {
        const el = document.getElementById(id);
        if (el) console.log(`  找到 #${id}:`, el.tagName);
    });
    console.log("");

    // 10. iframe 检测
    console.log("【10. iframe 检测】");
    const iframes = document.querySelectorAll("iframe");
    console.log(`  页面中共有 ${iframes.length} 个 iframe`);
    iframes.forEach((iframe, i) => {
        console.log(`  [${i}] src="${iframe.src?.substring(0, 80)}" rel="${iframe.rel}"`);
    });
    console.log("");

    console.log("=== 检测完成 ===");
    console.log("请将以上所有输出复制给我，我会据此修改脚本。");
})();
