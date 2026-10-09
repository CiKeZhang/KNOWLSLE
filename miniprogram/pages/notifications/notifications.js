// pages/notifications/notifications.js

Page({
  data: { list: [], page: 1, total: 0 },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.load();
  },

  async load() {
    try {
      const data = await getApp().request({ url: '/notifications/me?page=1&pageSize=30' });
      this.setData({ list: data.items || data || [], total: data.total || 0 });
    } catch (e) { /* 静默 */ }
  },
});
