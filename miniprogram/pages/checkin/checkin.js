// pages/checkin/checkin.js

const STAGES = [
  { value: 'NOT_STARTED', label: '未开始' },
  { value: 'CHOOSING', label: '择校' },
  { value: 'BASIC', label: '基础复习' },
  { value: 'STRENGTHENING', label: '强化刷题' },
  { value: 'SPRINT', label: '冲刺' },
  { value: 'EXAM_DONE', label: '初试结束' },
  { value: 'REEXAM_PREP', label: '备战复试' },
  { value: 'ADJUSTING', label: '调剂中' },
  { value: 'FINISHED', label: '考研结束' },
];

const STAGE_LABEL_MAP = {};
STAGES.forEach((s) => { STAGE_LABEL_MAP[s.value] = s.label; });

const CHECK_ITEMS = [
  { id: 'public_study', text: '公共课知识点学习' },
  { id: 'public_exercise', text: '公共课习题/真题练习' },
  { id: 'major_study', text: '专业课参考书阅读' },
  { id: 'major_exercise', text: '专业课真题训练' },
  { id: 'mock_exam', text: '模拟考试' },
  { id: 'plan_review', text: '学习计划复盘' },
];

const tabbar = require('../../utils/tabbar.js');
const subjectsUtil = require('../../utils/subjects.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    checkin: { status: 'NOT_SUBMITTED' },
    stages: STAGES,
    stageLabelMap: STAGE_LABEL_MAP,
    // 每项带 checked 字段,避免在 WXML 里调用 indexOf(真机兼容性差)
    checkItems: CHECK_ITEMS.map((it) => ({ id: it.id, text: it.text, checked: false })),
    form: {
      stage: '',
      completedItems: [],
      difficulties: '',
      studyHours: '',
      onlineConfirmationCompleted: false,
    },
    submitting: false,
    history: [],
    // 分科进度(从考研档案同步)
    subjectView: [],
    hasSubjectProgress: false,
    archivePublic: 0,
    archiveMajor: 0,
    targetSchool: '',
  },

  onShow() {
    tabbar.refresh(this, 'checkin');
    if (!getApp().checkLogin()) return;
    this.loadCheckin();
    this.loadHistory();
    this.loadProgressArchive();
  },

  onPullDownRefresh() {
    Promise.all([this.loadCheckin(), this.loadHistory(), this.loadProgressArchive()]).then(() => wx.stopPullDownRefresh());
  },

  async loadCheckin() {
    try {
      const data = await getApp().request({ url: '/checkin/me/week-status' });
      this.setData({ checkin: data });
    } catch (e) {
      // 静默
    }
  },

  async loadHistory() {
    try {
      const data = await getApp().request({ url: '/checkin/me/history?limit=8' });
      this.setData({ history: data.items || data || [] });
    } catch (e) {
      // 静默
    }
  },

  // 加载考研档案,同步分科进度到打卡页展示
  async loadProgressArchive() {
    try {
      const data = await getApp().request({ url: '/progress/me' });
      const arc = data && data.archive ? data.archive : null;
      if (!arc) {
        this.setData({ subjectView: [], hasSubjectProgress: false, archivePublic: 0, archiveMajor: 0, targetSchool: '' });
        return;
      }
      const sp = arc.subjectProgress || null;
      var view = subjectsUtil.buildView(sp);
      var hasAny = sp && view.some(function (s) { return s.percent > 0; });
      var overall = subjectsUtil.overall(sp);
      this.setData({
        subjectView: view,
        hasSubjectProgress: !!hasAny,
        archivePublic: overall.public || arc.publicCourseProgress || 0,
        archiveMajor: overall.major || arc.majorCourseProgress || 0,
        targetSchool: arc.targetSchoolName ? (arc.targetSchoolName + (arc.targetMajor ? ' · ' + arc.targetMajor : '')) : '',
      });
    } catch (e) {
      // 静默
    }
  },

  selectStage(e) {
    this.setData({ 'form.stage': e.currentTarget.dataset.value });
  },

  toggleCheckItem(e) {
    const id = e.currentTarget.dataset.id;
    const items = this.data.checkItems.map((it) => (
      it.id === id ? { id: it.id, text: it.text, checked: !it.checked } : it
    ));
    const completedItems = items.filter((it) => it.checked).map((it) => it.id);
    this.setData({ checkItems: items, 'form.completedItems': completedItems });
  },

  onDifficultiesInput(e) {
    this.setData({ 'form.difficulties': e.detail.value });
  },

  onHoursInput(e) {
    this.setData({ 'form.studyHours': e.detail.value });
  },

  toggleOnlineConfirmation() {
    this.setData({ 'form.onlineConfirmationCompleted': !this.data.form.onlineConfirmationCompleted });
  },

  // 跳到信息采集页更新分科进度
  goUpdateProgress() {
    wx.navigateTo({ url: '/pages/archive-collect/archive-collect?from=checkin' });
  },

  async submit() {
    const { stage, completedItems, difficulties } = this.data.form;
    if (!stage) {
      wx.showToast({ title: '请选择当前阶段', icon: 'none' });
      return;
    }
    if (completedItems.length === 0) {
      wx.showToast({ title: '请勾选本周完成事项', icon: 'none' });
      return;
    }
    if (!difficulties.trim()) {
      wx.showToast({ title: '请填写本周备考困难', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const payload = {
      stage,
      completedItems,
      difficulties: difficulties.trim(),
      studyHours: this.data.form.studyHours ? Number(this.data.form.studyHours) : undefined,
      // 从档案分科进度自动算出整体百分比,保持后端字段一致
      progressPublic: this.data.archivePublic,
      progressMajor: this.data.archiveMajor,
      onlineConfirmationCompleted: this.data.form.onlineConfirmationCompleted,
    };

    try {
      await getApp().request({ url: '/checkin/me/submit', method: 'POST', data: payload });
      wx.showToast({ title: '打卡成功', icon: 'success' });
      this.loadCheckin();
      this.gotoCollectIfNeeded();
    } catch (e) {
      // 网络异常:本地缓存
      try {
        const pending = wx.getStorageSync('pending_checkin') || [];
        pending.push({ payload, cachedAt: Date.now() });
        wx.setStorageSync('pending_checkin', pending);
        wx.showToast({ title: '网络异常,已缓存待同步', icon: 'none' });
      } catch (err) {
        // ignore
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 打卡成功后:若档案还没有目标院校,进入信息采集环节
  async gotoCollectIfNeeded() {
    try {
      const data = await getApp().request({ url: '/progress/me' });
      const hasTarget = data.archive && data.archive.targetSchoolName;
      if (!hasTarget) {
        setTimeout(() => {
          wx.navigateTo({ url: '/pages/archive-collect/archive-collect?from=checkin' });
        }, 800);
      }
    } catch (e) {
      // 静默,不阻断打卡流程
    }
  },

  applyMakeup() {
    wx.showModal({
      title: '补卡申请',
      editable: true,
      placeholderText: '请填写未按时打卡的原因',
      success: async (res) => {
        if (res.confirm) {
          try {
            await getApp().request({
              url: '/checkin/me/makeup',
              method: 'POST',
              data: { weekStart: this.data.checkin.weekStart, reason: res.content },
            });
            wx.showToast({ title: '补卡申请已提交', icon: 'success' });
          } catch (e) {
            // 静默
          }
        }
      },
    });
  },
});
