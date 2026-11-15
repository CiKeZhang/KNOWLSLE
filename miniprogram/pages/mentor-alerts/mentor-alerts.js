// pages/mentor-alerts/mentor-alerts.js

const tabbar = require('../../utils/tabbar.js');

// 后端 AlertStatus: OPEN(新建) / PENDING / HANDLED / RESOLVED / IGNORED
// 旧版页面只认 PENDING,导致新预警被显示成「已处理」且没有操作按钮
const PENDING_STATUS = ['OPEN', 'PENDING'];
const TYPE_LABEL = {
  CHECKIN_MISSING: '缺卡', CHECKIN_CONSECUTIVE: '连续缺卡',
  STAGE_STUCK: '阶段停滞', SCORE_DECLINE: '成绩下滑',
  PROGRESS_STALE: '进度未更新', LOGIN_INACTIVE: '长期未登录',
  HELP_REQUEST: '帮扶请求',
};

function normalize(list) {
  return (list || []).map((a) => Object.assign({}, a, {
    statusLabel: PENDING_STATUS.indexOf(a.status) >= 0 ? '待处理' : '已处理',
    isPending: PENDING_STATUS.indexOf(a.status) >= 0,
    typeLabel: TYPE_LABEL[a.type] || a.type || '异常',
    // 后端返回 student.name,旧页面误读 item.studentName 导致永远不显示
    studentName: (a.student && a.student.name) || a.studentName || '',
  }));
}

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    alerts: [],
    loading: true,
    submitting: false,
  },

  onShow() {
    tabbar.refresh(this, 'alerts');
    this.loadAlerts();
  },

  loadAlerts() {
    this.setData({ loading: true });
    getApp().request({ url: '/mentor/alerts' })
      .then((data) => {
        this.setData({ alerts: normalize(data), loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  handleAlert(e) {
    if (this.data.submitting) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '处理预警',
      content: '确认标记为已处理？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ submitting: true });
          getApp().request({ url: `/mentor/alerts/${id}/handle`, method: 'PATCH' })
            .then(() => {
              wx.showToast({ title: '已处理', icon: 'success' });
              this.loadAlerts();
            })
            .catch(() => {})
            .then(() => this.setData({ submitting: false }));
        }
      },
    });
  },
});
