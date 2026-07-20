// subpackages/h5Demo/pages/authorize_webview_test/index.js
Page({
    data: {
        redirectUrl: '',
        redirectQuery: '',
        fullPathUrl: '',
        showWebView: false // 是否展示测试用 web-view
    },

    onLoad() {
        this.Authorize = this.selectComponent('#Authorize');
        // Authorize 组件默认展示
        this.Authorize.toggleStatus(true);
    },

    // 切换测试用 web-view 的显示状态
    toggleWebView() {
        this.setData({
            showWebView: !this.data.showWebView
        });
    },
    onShareAppMessage() {
        console.log('111-onShareAppMessage');
        return {
            title: 'Authorize/WebView 测试',
            path: '/subpackages/h5Demo/pages/authorize_webview_test/index'
        };
    }
});
