// pages/mentor-alerts/mentor-alerts.js

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    alerts: [],
    loading: true,
  },

  onShow() {
    tabbar.refresh(this, 'alerts');
    this.loadAlerts();
  },

  loadAlerts() {
    this.setData({ loading: true });
    getApp().request({ url: '/mentor/alerts' })
      .then((data) => {
        this.setData({ alerts: data || [], loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  handleAlert(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '处理预警',
      content: '确认标记为已处理？',
      success: (res) => {
        if (res.confirm) {
          getApp().request({ url: `/mentor/alerts/${id}/handle`, method: 'PATCH' })
            .then(() => {
              wx.showToast({ title: '已处理', icon: 'success' });
              this.loadAlerts();
            })
            .catch(() => {});
        }
      },
    });
  },
});
