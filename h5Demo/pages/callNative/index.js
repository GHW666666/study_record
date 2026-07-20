/**
 * 功能四 · 小程序内 H5 调端 demo
 * 嵌入知秋(H5)提供的调端页面，验证 H5 里的调端能力（唤起 App / scheme 等）在小程序 web-view 内是否可用。
 * H5 可通过 postMessage 回传调端结果。
 */
import { H5_URLS } from '../../config';

Page({
    data: {
        src: 'https://pan.baidu.com/comps/view/MV8xOTgxXzI1NTNfNzA4M19vbmxpbmU='
    },
    onLoad(options) {
        const src = options.h5 ? decodeURIComponent(options.h5) : H5_URLS.callNative;
        this.setData({ src: 'https://pan.baidu.com/comps/view/MV8xOTgxXzI1NTNfNzA4M19vbmxpbmU=' });
    },
    onMessage(e) {
        console.log('[callNative] H5 回传：', e && e.detail && e.detail.data);
    },
    onError(e) {
        console.error('[callNative] web-view error', e);
    }
});
