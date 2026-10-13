// pages/resources/resources.js

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: { list: [], loading: false },

  onShow() {
    tabbar.refresh(this, 'resources');
    if (!getApp().checkLogin()) return;
    this.load();
  },

  async load() {
    try {
      const data = await getApp().request({ url: '/resources?status=APPROVED&page=1&pageSize=50' });
      this.setData({ list: data.items || data || [] });
    } catch (e) { /* 静默 */ }
  },

  openResource(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((r) => r.id === id);
    if (!item) return;

    const desc = item.description || '暂无简介';
    if (item.url) {
      wx.showModal({
        title: item.title,
        content: desc + '\n\n点击"复制链接"获取资源地址,可在浏览器中打开。',
        confirmText: '复制链接',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: item.url,
              success: () => wx.showToast({ title: '链接已复制', icon: 'none' }),
            });
          }
        },
      });
    } else {
      wx.showModal({
        title: item.title,
        content: desc,
        showCancel: false,
        confirmText: '知道了',
      });
    }
  },
});
