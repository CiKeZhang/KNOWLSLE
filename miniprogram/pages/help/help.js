// pages/help/help.js

Page({
  data: { list: [], loading: false },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.load();
  },

  async load() {
    try {
      const data = await getApp().request({ url: '/help/me' });
      this.setData({ list: data.items || data || [] });
    } catch (e) { /* 静默 */ }
  },

  goApply() { wx.navigateTo({ url: '/pages/help-apply/help-apply' }); },

  statusLabel(s) { return { OPEN: '待处理', IN_PROGRESS: '处理中', RESOLVED: '已解决', CLOSED: '已关闭' }[s] || s; },
});
