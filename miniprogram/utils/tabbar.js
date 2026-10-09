// utils/tabbar.js
// 底部导航共享逻辑(普通 JS 模块,非自定义组件,规避真机组件注入问题)

const STUDENT_ITEMS = [
  { key: 'index', path: '/pages/index/index', text: '首页', icon: '🏠' },
  { key: 'checkin', path: '/pages/checkin/checkin', text: '打卡', icon: '✅' },
  { key: 'resources', path: '/pages/resources/resources', text: '资源', icon: '📚' },
  { key: 'profile', path: '/pages/profile/profile', text: '我的', icon: '👤' },
];

const MENTOR_ITEMS = [
  { key: 'dashboard', path: '/pages/mentor-dashboard/mentor-dashboard', text: '看板', icon: '📊' },
  { key: 'students', path: '/pages/mentor-students/mentor-students', text: '学生', icon: '🎓' },
  { key: 'alerts', path: '/pages/mentor-alerts/mentor-alerts', text: '预警', icon: '⚠️' },
  { key: 'help', path: '/pages/mentor-help/mentor-help', text: '帮扶', icon: '🤝' },
  { key: 'profile', path: '/pages/profile/profile', text: '我的', icon: '👤' },
];

// 在页面 onShow/onLoad 调用,设置底部导航数据
function refresh(page, activeKey) {
  let role = 'STUDENT';
  try {
    const u = wx.getStorageSync('userInfo');
    if (u && u.role && u.role !== 'STUDENT') role = 'MENTOR';
  } catch (e) {}
  const items = role === 'MENTOR' ? MENTOR_ITEMS : STUDENT_ITEMS;
  page.setData({ tabItems: items, tabActive: activeKey });
}

// 页面 tap 事件处理(wxml bindtap="onTabTap")
function onTap(e) {
  const { path, key } = e.currentTarget.dataset;
  if (key === this.data.tabActive) return;
  wx.reLaunch({ url: path });
}

module.exports = {
  refresh,
  onTap,
};
