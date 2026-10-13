// pages/mentor-dashboard/mentor-dashboard.js

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    stats: {
      totalStudents: 0,
      checkedInToday: 0,
      checkinRate: '0%',
      alerts: 0,
      pendingHelp: 0,
    },
    stageDistribution: [],
    majorStats: [],
    loading: true,
  },

  onShow() {
    tabbar.refresh(this, 'dashboard');
    this.loadDashboard();
  },

  loadDashboard() {
    this.setData({ loading: true });
    Promise.all([
      getApp().request({ url: '/mentor/dashboard' }).catch(() => null),
      getApp().request({ url: '/mentor/alerts?status=PENDING' }).catch(() => []),
      getApp().request({ url: '/mentor/help-applications?status=PENDING' }).catch(() => []),
    ]).then(([data, alerts, helpApps]) => {
      if (!data) { this.setData({ loading: false }); return; }

      // 阶段分布:对象 map → 数组
      const dist = data.stageDistribution || {};
      const total = data.total || 0;
      const stageMap = {
        NOT_STARTED: '未开始', CHOOSING: '择校中', FOUNDATION: '基础阶段',
        STRENGTHEN: '强化阶段', SPRINT: '冲刺阶段', EXAM: '初试',
        ADJUSTMENT: '复试调剂', ADMITTED: '已上岸',
      };
      const stageDistribution = Object.keys(dist).map((key) => ({
        stage: stageMap[key] || key,
        count: dist[key],
        percent: total ? Math.round((dist[key] / total) * 100) : 0,
      }));

      // 按专业统计(补百分比)
      const majorStats = (data.majorStats || []).map((m) => ({
        major: m.major,
        total: m.total,
        checkedIn: m.checkedIn,
        percent: m.total ? Math.round((m.checkedIn / m.total) * 100) : 0,
      }));

      const weekChecked = majorStats.reduce((s, m) => s + m.checkedIn, 0);

      this.setData({
        stats: {
          totalStudents: total,
          checkedInToday: weekChecked,
          checkinRate: (data.checkinRate || 0) + '%',
          alerts: Array.isArray(alerts) ? alerts.length : 0,
          pendingHelp: Array.isArray(helpApps) ? helpApps.length : 0,
        },
        stageDistribution,
        majorStats,
        loading: false,
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  goStudents() {
    wx.reLaunch({ url: '/pages/mentor-students/mentor-students' });
  },

  goAlerts() {
    wx.reLaunch({ url: '/pages/mentor-alerts/mentor-alerts' });
  },

  goHelp() {
    wx.reLaunch({ url: '/pages/mentor-help/mentor-help' });
  },
});
