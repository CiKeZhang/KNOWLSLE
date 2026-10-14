// pages/archive/archive.js
// 考研档案:学生本人(GET /progress/me) 与 导师查看学生(GET /progress/student/:id) 双模式

var subjectsUtil = require('../../utils/subjects.js');

var STAGE_LABELS = {
  NOT_STARTED: '未开始备考', CHOOSING: '择校阶段', BASIC: '基础复习',
  STRENGTHENING: '强化刷题', SPRINT: '冲刺阶段', EXAM_DONE: '初试结束待成绩',
  REEXAM_PREP: '初试通过备战复试', ADJUSTING: '调剂中', FINISHED: '考研结束',
};

function fmtDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

Page({
  data: {
    isMentorView: false,
    studentName: '',
    archive: null,
    advisors: { majorMentor: null, counselor: null, className: '' },
    stageLabel: '',
    timeline: [],
    subjectView: [],
    hasSubjectProgress: false,
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    this.options = options || {};
    if (this.options.studentId) {
      wx.setNavigationBarTitle({ title: '学生考研档案' });
      this.setData({ isMentorView: true });
    } else {
      wx.setNavigationBarTitle({ title: '我的考研档案' });
    }
    this.reload();
  },

  onShow() {
    // 首次进入由 onLoad 加载;从采集页返回时刷新
    if (this.hasShown) this.reload();
    this.hasShown = true;
  },

  reload() {
    if (this.options && this.options.studentId) {
      this.loadStudentArchive(this.options.studentId);
    } else {
      this.loadMyArchive();
    }
  },

  async loadMyArchive() {
    try {
      const data = await getApp().request({ url: '/progress/me' });
      const profile = data.profile || {};
      this.applyData(data.archive, profile, data.advisors, data.timeline, profile.name || '');
    } catch (e) {
      // 静默
    }
  },

  async loadStudentArchive(studentId) {
    try {
      const data = await getApp().request({ url: '/progress/student/' + studentId });
      const student = data.student || {};
      this.applyData(
        student.progressArchive,
        student.studentProfile,
        data.advisors,
        data.timeline,
        student.name || ''
      );
    } catch (e) {
      // 静默
    }
  },

  applyData(archive, profile, advisors, timeline, studentName) {
    const p = profile || {};
    const arc = archive || {};
    const sp = arc.subjectProgress || null;
    const subjectView = subjectsUtil.buildView(sp);
    // 判断是否真的维护过分科进度(任一轮次非 0)
    const hasSubjectProgress = subjectView.some((s) => s.percent > 0 || (sp && sp[s.key]));
    this.setData({
      archive: arc,
      advisors: advisors || { majorMentor: null, counselor: null, className: '' },
      studentName: studentName || '',
      stageLabel: STAGE_LABELS[p.currentStage] || '未开始',
      subjectView,
      hasSubjectProgress: !!hasSubjectProgress,
      timeline: (timeline || []).map((t) => ({
        title: t.title,
        desc: t.desc,
        at: fmtDate(t.at),
      })),
    });
  },

  goCollect() {
    wx.navigateTo({ url: '/pages/archive-collect/archive-collect' });
  },
});
