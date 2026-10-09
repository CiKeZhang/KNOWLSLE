// pages/archive/archive.js

const STAGE_LABELS = {
  NOT_STARTED: '未开始备考', CHOOSING: '择校阶段', BASIC: '基础复习',
  STRENGTHENING: '强化刷题', SPRINT: '冲刺阶段', EXAM_DONE: '初试结束待成绩',
  REEXAM_PREP: '初试通过备战复试', ADJUSTING: '调剂中', FINISHED: '考研结束',
};

Page({
  data: {
    archive: null,
    profile: null,
    timeline: [],
    stageLabel: '',
  },

  onLoad() {
    if (!getApp().checkLogin()) return;
    this.loadArchive();
  },

  async loadArchive() {
    try {
      const data = await getApp().request({ url: '/progress/me' });
      this.setData({
        archive: data.archive,
        profile: data.profile,
        timeline: data.timeline || [],
        stageLabel: STAGE_LABELS[(data.profile && data.profile.currentStage)] || '未开始',
      });
    } catch (e) {
      // 静默
    }
  },
});
