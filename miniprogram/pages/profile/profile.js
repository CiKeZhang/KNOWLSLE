// pages/profile/profile.js

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: { userInfo: {}, isMentor: false },

  onShow() {
    tabbar.refresh(this, 'profile');
    if (!getApp().checkLogin()) return;
    const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const isMentor = userInfo.role && userInfo.role !== 'STUDENT';
    this.setData({ userInfo, isMentor });
  },

  // 学生功能
  goArchive() { wx.navigateTo({ url: '/pages/archive/archive' }); },
  goRecommend() { wx.navigateTo({ url: '/pages/recommend/recommend' }); },
  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }); },
  goHelp() { wx.navigateTo({ url: '/pages/help/help' }); },
  goNotifications() { wx.navigateTo({ url: '/pages/notifications/notifications' }); },

  // 隐私政策
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },

  // 导师功能
  goMentorDashboard() { wx.reLaunch({ url: '/pages/mentor-dashboard/mentor-dashboard' }); },
  goMentorStudents() { wx.reLaunch({ url: '/pages/mentor-students/mentor-students' }); },
  goMentorAlerts() { wx.reLaunch({ url: '/pages/mentor-alerts/mentor-alerts' }); },
  goMentorHelp() { wx.reLaunch({ url: '/pages/mentor-help/mentor-help' }); },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗?',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          getApp().globalData.token = '';
          getApp().globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
