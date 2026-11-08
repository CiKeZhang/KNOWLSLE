// pages/profile/profile.js

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: { userInfo: {}, isMentor: false, isAdmin: false, myMentor: null },

  onShow() {
    tabbar.refresh(this, 'profile');
    if (!getApp().checkLogin()) return;
    const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const isMentor = userInfo.role && userInfo.role !== 'STUDENT';
    const isAdmin = userInfo.role === 'ACADEMIC_ADMIN' || userInfo.role === 'SYS_ADMIN';
    this.setData({ userInfo, isMentor, isAdmin });
    if (!isMentor) this.loadMyMentor();
  },

  // 学生:当前指导老师
  loadMyMentor() {
    const that = this;
    getApp().request({ url: '/mentor/my-mentor' }).then((mentor) => {
      that.setData({ myMentor: mentor || null });
    }).catch(() => {});
  },

  // 学生功能
  goMentorSelect() { wx.navigateTo({ url: '/pages/mentor-select/mentor-select' }); },
  goArchive() { wx.navigateTo({ url: '/pages/archive/archive' }); },
  goArchiveCollect() { wx.navigateTo({ url: '/pages/archive-collect/archive-collect' }); },
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

  // 管理员功能
  goMessageAdmin() { wx.navigateTo({ url: '/pages/message-admin/message-admin' }); },

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
