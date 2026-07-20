/**
 * 功能一 · 微信邀请 demo
 * 1. web-view 加载知秋(H5)的邀请页；
 * 2. H5 点击邀请时通过 wx.miniProgram.postMessage 传参，小程序用 bindmessage 接收并存入 data；
 * 3. 用户点右上角「转发」时，onShareAppMessage 用 data 里的参数拼分享链接。
 *
 * ⚠️ 时序风险（重点验证）：web-view 的 postMessage 不是实时的，微信只在
 *    「小程序后退 / 组件销毁 / 分享 / 复制链接」这几个时机才把消息批量投递给 bindmessage。
 *    转发时 bindmessage 与 onShareAppMessage 几乎同时触发，而 onShareAppMessage 是同步返回，
 *    无法等待 bindmessage 的 setData 完成，因此 onShareAppMessage 里很可能读不到「本次分享才投递」的最新数据。
 *    这个 demo 就是用来实测这一点：看 console 里 onShareAppMessage 读到的 inviteData 是否为最新值。
 */
import { H5_URLS } from '../../config';

Page({
    data: {
        src: 'https://sandbox-pan.baidu-int.com',
        inviteData: null // bindmessage 收到的邀请参数
    },
    onLoad(options) {
        wx.showShareMenu({ menus: ['shareAppMessage'] });
        this.setData({
            // src: 'https://pan.baidu.com'
            src: 'https://sandbox-pan.baidu-int.com'
        });
    },
    // H5 postMessage 的数据会在特定时机批量投递到这里（数组，含历史所有消息）
    onMessage(e) {
        const list = (e && e.detail && e.detail.data) || [];
        const last = list.length ? list[list.length - 1] : null;
        this.setData({ inviteData: last });
        console.log('[invite] bindmessage 收到消息列表：', list);
        wx.setNavigationBarTitle({ title: '已收到邀请参数 ✓' });
    },
    // 点击右上角「转发」时同步触发
    onShareAppMessage() {
        const data = this.data.inviteData || {};
        console.log('[invite] onShareAppMessage 读到的 inviteData：', data);
        const inviteId = data.inviteId || '';
        return {
            title: data.title || '快来加入我的共享文件夹',
            path: `/subpackages/h5Demo/pages/invite/index?inviteId=${inviteId}`
        };
    },
    onError(e) {
        console.error('[invite] web-view error', e);
    }
});
