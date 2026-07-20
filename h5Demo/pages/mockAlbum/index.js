/**
 * 功能二 · 模拟共享相册页面A（小程序原生页，非 web-view）
 * 点按钮：把参数写回上一个 webview 页（调用其 receiveFromAlbum），再 navigateBack 返回。
 * navigateBack 无法直接带参，这里用 getCurrentPages 拿到上一页实例来回传。
 */
Page({
    data: {
        picId: 'pic_1001',
        name: '模拟相册照片'
    },
    backWithParams() {
        const params = { picId: this.data.picId, name: this.data.name, ts: Date.now() };
        const pages = getCurrentPages();
        const prev = pages[pages.length - 2];
        if (prev && typeof prev.receiveFromAlbum === 'function') {
            prev.receiveFromAlbum(params);
        } else {
            console.warn('[mockAlbum] 未找到上一页的 receiveFromAlbum，请从 webview 页进入');
        }
        wx.navigateBack({ delta: 1 });
    }
});
