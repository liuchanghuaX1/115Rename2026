/**
 * 115网盘新版 DOM 检测脚本 v2
 * 使用步骤：
 * 1. 在文件列表中，按住 Ctrl/Cmd 点击选中 2-3 个文件
 * 2. 在选中的文件上右键，弹出菜单
 * 3. 保持菜单打开，按 F12 → Console，粘贴运行此脚本
 */
(function () {
    "use strict";
    console.log("=== 115网盘 DOM 检测 v2 ===\n");

    // ---- A. 检测选中的文件 ----
    console.log("【A. 选中文件检测】");

    // 方法1: 查找 aria-selected
    let sel = document.querySelectorAll('[aria-selected="true"]');
    console.log(`  aria-selected="true": ${sel.length} 个`);

    // 方法2: 查找包含 "selected" 的 class
    sel = document.querySelectorAll('[class*="selected"], [class*="Selected"]');
    console.log(`  class含"selected": ${sel.length} 个`);

    // 方法3: 查找可能被选中的 file-list-item
    const allItems = document.querySelectorAll('.file-list-item');
    const selectedItems = [];
    allItems.forEach(el => {
        // 检查 class 中是否有选中标记
        const cls = el.className?.toString() || '';
        if (/(?:selected|active|checked|bg-blue|bg-\w+-\d+)/i.test(cls)) {
            selectedItems.push(el);
        }
    });
    console.log(`  .file-list-item 中带选中特征的: ${selectedItems.length} 个`);

    if (selectedItems.length > 0 && selectedItems.length < 20) {
        selectedItems.forEach((el, i) => {
            if (i < 5) {
                console.log(`  [${i}] class="${el.className?.toString().substring(0, 120)}"`);
                // 获取所有属性
                const attrs = {};
                for (const a of el.attributes) {
                    attrs[a.name] = a.value?.substring(0, 80);
                }
                console.log(`       attributes:`, JSON.stringify(attrs));
                // 获取文件名
                const nameEl = el.querySelector('.file-name-responsive');
                console.log(`       文件名: "${nameEl?.innerText?.substring(0, 80)}"`);
                // 递归查找 data-* 属性
                const dataEls = el.querySelectorAll('[data-file-id], [data-fid], [data-id], [data-cid]');
                dataEls.forEach(d => {
                    for (const a of d.attributes) {
                        if (a.name.startsWith('data-')) console.log(`       ${a.name}="${a.value}"`);
                    }
                });
            }
        });
    }

    // 方法4: 直接找所有带 data- 且值像 ID 的元素
    console.log("\n  所有 data-file 相关属性:");
    ['data-file-id', 'data-fid', 'data-id', 'data-cid', 'data-cate-id', 'data-pick-code'].forEach(attr => {
        const els = document.querySelectorAll(`[${attr}]`);
        if (els.length > 0 && els.length < 500) {
            console.log(`  ${attr}: ${els.length} 个, 示例="${els[0].getAttribute(attr)?.substring(0, 40)}"`);
        }
    });

    console.log("");

    // ---- B. 检测右键菜单 ----
    console.log("【B. 右键菜单检测】");

    // 找所有当前可见的菜单
    const visibleMenus = [];
    document.querySelectorAll('*').forEach(el => {
        if (el.offsetParent !== null && el.getBoundingClientRect().width > 50 && el.getBoundingClientRect().height > 50) {
            const cls = el.className?.toString() || '';
            if (/(?:menu|context|dropdown|popup|float|popper)/i.test(cls) || el.getAttribute('role') === 'menu') {
                visibleMenus.push(el);
            }
        }
    });

    console.log(`  当前可见的菜单候选: ${visibleMenus.length} 个`);
    visibleMenus.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        console.log(`  [${i}] <${el.tagName.toLowerCase()}> class="${el.className?.toString().substring(0, 100)}"`);
        console.log(`       位置: (${Math.round(rect.left)},${Math.round(rect.top)}) ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        // 列出菜单项
        const items = el.querySelectorAll('li, [role="menuitem"], a, button, div');
        const textItems = [];
        items.forEach(item => {
            const txt = item.innerText?.trim();
            if (txt && txt.length < 30 && txt.length > 0) textItems.push(txt);
        });
        if (textItems.length > 0) console.log(`       菜单项: [${textItems.slice(0, 15).join(', ')}]`);
    });

    // 如果没找到可见菜单，可能是菜单已经关闭了
    if (visibleMenus.length === 0) {
        console.log("  ⚠️ 未找到可见菜单！请重新右键打开菜单后立即运行此脚本");
        // 回退: 查找所有可能的菜单容器(包括隐藏的)
        console.log("  回退: 查找所有角色为 menu 的元素:");
        document.querySelectorAll('[role="menu"], [role="menubar"]').forEach((el, i) => {
            console.log(`  [${i}] <${el.tagName.toLowerCase()}> class="${el.className?.toString().substring(0, 100)}"`);
            el.querySelectorAll('[role="menuitem"]').forEach((item, j) => {
                console.log(`      menuitem[${j}]: "${item.innerText?.trim()?.substring(0, 40)}"`);
            });
        });
    }

    console.log("");

    // ---- C. 页面工具栏 ----
    console.log("【C. 页面工具栏/操作栏检测】");
    // 查找顶部工具栏（通常有下载、删除、重命名等按钮）
    const toolbars = document.querySelectorAll('[class*="toolbar"], [class*="tool-bar"], [class*="action"], [class*="operation"], [class*="header"]');
    const toolbarTexts = [];
    toolbars.forEach(el => {
        const txt = el.innerText?.trim();
        if (txt && txt.length > 5 && txt.length < 200 && el.getBoundingClientRect().width > 100) {
            toolbarTexts.push({ el, txt: txt.substring(0, 100), cls: el.className?.toString().substring(0, 60) });
        }
    });
    // 去重
    const seen = new Set();
    const unique = toolbarTexts.filter(t => {
        if (seen.has(t.txt)) return false;
        seen.add(t.txt);
        return true;
    });
    console.log(`  找到 ${unique.length} 个工具栏候选:`);
    unique.slice(0, 10).forEach((t, i) => {
        console.log(`  [${i}] class="${t.cls}"`);
        console.log(`       text: "${t.txt}"`);
    });

    console.log("");
    console.log("=== 检测完成 ===");
    console.log("请把以上输出完整复制给我！");
})();
