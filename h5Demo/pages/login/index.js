/**
 * 功能三 · 登录 demo —— 把 BDUSS / STOKEN 传给知秋(H5)页面验证登录
 * 从小程序本地 storage 的 userInfo 里取 bduss / netdisk stoken，拼到 H5 地址后由 web-view 加载。
 *
 * ⚠️ 安全提示：BDUSS 是登录凭证，明文放在 URL query 里仅用于内部 demo 联调；
 *    正式接入建议改用项目已有的 pantoken 换取方式（参考 netdisk_risk_popup 的 postPantoken /
 *    babyAlbum netdisk_h5Upload 的 api/pantoken），由服务端把带鉴权的 URL 返回，避免凭证暴露在链接里。
 */
import { H5_URLS } from '../../config';
import { wxReq } from '../../../../netdisk_utils/wxRequestApi.js';
import { hex_md5 } from '../../../../dep/MD5.js';

Page({
    data: {
        src: '',
        tip: ''
    },
    async onLoad(options) {
        const base = 'https://pan.baidu.com/operation/activitys/shareAlbumV1/main';
        const userInfo = wx.getStorageSync('userInfo') || {};
        const bduss = userInfo.bduss || '';
        const stoken = userInfo.netdisk_stoken || '';

        if (!bduss || !stoken) {
            this.setData({ tip: '未取到 BDUSS/STOKEN，请先在小程序里登录后再进入本页' });
            console.warn('[login] 缺少凭证', { hasBduss: !!bduss, hasStoken: !!stoken });
            return;
        }
        let access_token = await this.apiGetToekn();
        const sep = base.indexOf('?') > -1 ? '&' : '?';
        const src = `${base}${sep}&at=${access_token}`;
        this.setData({ src });
    },
    async apiGetToekn() {
        const login_info = wx.getStorageSync('login_info') || {};
        const SIGN_KEY = '3bb8b1479dd7f848d0bc90156a5d80a2';
        const CLIENT_ID = 'lVmqyIYZt4Gkm6tixlepYXKm8bIVdx9M';
        let res = await wxReq(
            'rest/2.0/xpan/console/v1/toaccesstoken',
            {
                sign: hex_md5(`${SIGN_KEY}_${login_info.uk}_${CLIENT_ID}`),
                client_id: CLIENT_ID
            },
            'GET'
        );
        console.log('111-res', res, res?.data?.data?.access_token);
        return res?.data?.data?.access_token || '';
    },
    // H5 验证登录后可通过 postMessage 回传结果（分享/后退/销毁时投递）
    onMessage(e) {
        console.log('[login] H5 回传：', e && e.detail && e.detail.data);
    },
    onError(e) {
        console.error('[login] web-view error', e);
    }
});
