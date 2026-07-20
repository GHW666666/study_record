/**
 * 功能二 · hash 传参 demo —— 嵌套 webview 的页面
 * 流程：
 *   1. 本页 web-view 加载知秋(H5)页面；
 *   2. H5 里通过 wx.miniProgram.navigateTo 跳到「模拟共享相册页面A」(mockAlbum)；
 *   3. 页面A 点按钮返回本页，并调用本页的 receiveFromAlbum，把参数以 hash 形式拼到 H5 地址后重载 web-view；
 *   4. H5 通过 location.hash / onhashchange 读取参数。
 */
import { H5_URLS } from '../../config';

Page({
    data: {
        baseUrl: '',
        src: ''
    },
    onLoad(options) {
        const baseUrl = options.h5 ? decodeURIComponent(options.h5) : H5_URLS.hashWebview;
        this.setData({ baseUrl, src: baseUrl });
    },
    // 供页面A(mockAlbum)返回时调用：把参数以 hash 形式回传给 H5
    receiveFromAlbum(params) {
        const hash = encodeURIComponent(JSON.stringify(params));
        const base = (this.data.baseUrl || '').split('#')[0];
        // 带上时间戳，确保 src 变化触发 web-view 重新加载（H5 读 location.hash 即可拿到参数）
        const src = `${base}#params=${hash}&t=${Date.now()}`;
        this.setData({ src });
        console.log('[webview] 以 hash 回传给 H5：', src);
    },
    onError(e) {
        console.error('[webview] web-view error', e);
    }
});
