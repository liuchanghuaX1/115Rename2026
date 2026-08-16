/**
 * 115Rename 诊断脚本
 * 在115网盘页面按 F12 → Console，粘贴全部内容运行
 */
(async function () {
    console.log('========== 115Rename 诊断 ==========');

    // 1. 检测页面版本
    console.log('【1. 页面版本】');
    console.log('URL:', location.href);
    const isNew = location.pathname.startsWith('/storage/');
    console.log('新版页面?', isNew ? '✅ 是 (/storage/...)' : '❌ 否 (旧版)');

    // 2. 检测关键DOM
    console.log('\n【2. 关键DOM元素】');
    console.log('.file-list-wrap:', !!document.querySelector('.file-list-wrap') ? '✅' : '❌');
    console.log('iframe[rel=wangpan]:', !!document.querySelector('iframe[rel="wangpan"]') ? '✅' : '❌');
    console.log('button文本含"重命名":', [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '重命名').length, '个');

    // 3. 选中文件测试
    console.log('\n【3. 选中文件】（请先点击选中1个文件再运行）】');
    const wrap = document.querySelector('.file-list-wrap');
    if (wrap) {
        const cbs = wrap.querySelectorAll('input[type="checkbox"]:checked');
        console.log('选中的checkbox:', cbs.length, '个');
        cbs.forEach((cb, i) => {
            const row = cb.closest('[class*="group"]');
            const name = row?.querySelector('.file-name-responsive')?.textContent?.trim() || '未知';
            console.log(`  [${i}]`, name);
        });
    }

    // 4. API连通性测试
    console.log('\n【4. API测试】');
    try {
        const resp = await fetch('https://webapi.115.com/files?aid=1&cid=0&offset=0&limit=1&format=json', { credentials: 'include' });
        const text = await resp.text();
        console.log('HTTP状态:', resp.status);
        console.log('响应(前200字):', text.substring(0, 200));
        try {
            const json = JSON.parse(text);
            console.log('state:', json.state);
            console.log('data类型:', typeof json.data, Array.isArray(json.data) ? `Array(${json.data.length})` : '');
            if (Array.isArray(json.data) && json.data.length > 0) {
                console.log('第一个文件keys:', Object.keys(json.data[0]).join(', '));
                console.log('第一个文件:', JSON.stringify(json.data[0]).substring(0, 200));
            }
        } catch (e) { }
    } catch (e) {
        console.error('API请求失败:', e.message);
    }

    // 5. 查找"重命名"按钮位置
    console.log('\n【5. 重命名按钮详情】');
    const renameBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重命名');
    if (renameBtn) {
        console.log('找到重命名按钮');
        console.log('  offsetParent:', renameBtn.offsetParent ? '有(可见)' : 'null(隐藏)');
        console.log('  父元素tag:', renameBtn.parentElement?.tagName);
        console.log('  父元素class:', renameBtn.parentElement?.className?.substring(0, 80));
        console.log('  祖父tag:', renameBtn.parentElement?.parentElement?.tagName);
        console.log('  祖父class:', renameBtn.parentElement?.parentElement?.className?.substring(0, 80));
    } else {
        console.log('❌ 未找到"重命名"按钮 - 请先选中文件再运行！');
    }

    console.log('\n========== 诊断完成 ==========');
    console.log('请截图以上全部输出发给我');
})();
