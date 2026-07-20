/**
 * H5 联调 demo 的 H5 页面地址配置
 * 联调时把下面的占位地址换成知秋(H5)提供的真实地址；
 * 每个页面也支持通过 query ?h5=<encodeURIComponent(url)> 临时覆盖，方便快速换地址联调。
 */
export const H5_URLS = {
    invite: 'https://example-h5.baidu.com/demo/invite', // 功能一：微信邀请页
    hashWebview: 'https://example-h5.baidu.com/demo/hash', // 功能二：hash 接收页
    login: 'https://pan.baidu.com/comps/view/MV8yMDA2XzI1OTNfNzI0OV90ZXN0', // 功能三：登录验证页
    callNative: 'https://pan.baidu.com/comps/view/MV8xOTgxXzI1NTNfNzA4M19vbmxpbmU=' // 功能四：调端页
};
