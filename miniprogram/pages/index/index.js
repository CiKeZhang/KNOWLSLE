// pages/index/index.js

const STAGE_LABELS = {
  NOT_STARTED: '未开始备考',
  CHOOSING: '择校阶段',
  BASIC: '基础复习',
  STRENGTHENING: '强化刷题',
  SPRINT: '冲刺阶段',
  EXAM_DONE: '初试结束待成绩',
  REEXAM_PREP: '初试通过备战复试',
  ADJUSTING: '调剂中',
  FINISHED: '考研结束',
};

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    userInfo: {},
    checkin: { status: '', weekLabel: '' },
    stageLabel: '',
    timeline: [],
    keyNodes: [],
  },

  onShow() {
    tabbar.refresh(this, 'index');
    if (!getApp().checkLogin()) return;
    this.setData({ userInfo: getApp().globalData.userInfo || {} });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    const that = this;
    try {
      // 加载本周打卡状态
      const checkin = await getApp().request({ url: '/checkin/me/week-status' });
      this.setData({
        checkin: {
          status: checkin.status || 'NOT_SUBMITTED',
          weekLabel: checkin.weekStartText || '本周',
        },
      });

      // 加载档案(获取当前阶段)
      const archive = await getApp().request({ url: '/progress/me' });
      const stage = (archive.profile && archive.profile.currentStage) || 'NOT_STARTED';
      this.setData({
        stageLabel: STAGE_LABELS[stage] || '未开始',
        timeline: (archive.timeline || []).slice(0, 6),
      });

      // 加载关键节点
      const keyNodes = await getApp().request({ url: '/progress/key-nodes' });
      this.setData({
        keyNodes: (keyNodes || []).slice(0, 4).map((n) => ({
          ...n,
          remindAtText: (n.remindAt || '').slice(0, 16).replace('T', ' '),
        })),
      });
    } catch (e) {
      // 静默处理
    }
  },

  goCheckIn() { wx.reLaunch({ url: '/pages/checkin/checkin' }); },
  goArchive() { wx.navigateTo({ url: '/pages/archive/archive' }); },
  goRecommend() { wx.navigateTo({ url: '/pages/ai-chat/ai-chat' }); },
  goPlan() { wx.navigateTo({ url: '/pages/plan/plan' }); },
  goResources() { wx.reLaunch({ url: '/pages/resources/resources' }); },
  goHelp() { wx.navigateTo({ url: '/pages/help/help' }); },
  goNotifications() { wx.navigateTo({ url: '/pages/notifications/notifications' }); },
  goAdvisor() { wx.navigateTo({ url: '/pages/advisor/advisor' }); },
  goMessageBoard() { wx.reLaunch({ url: '/pages/message-board/message-board' }); },
});
