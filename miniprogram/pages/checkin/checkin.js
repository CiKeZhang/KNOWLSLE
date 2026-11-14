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

// 完成事项 id -> 中文名(历史打卡记录只存 id,展示时需翻译)
const ITEM_LABEL_MAP = {};
CHECK_ITEMS.forEach((it) => { ITEM_LABEL_MAP[it.id] = it.text; });

const tabbar = require('../../utils/tabbar.js');
const subjectsUtil = require('../../utils/subjects.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    checkin: { status: 'NOT_SUBMITTED' },
    stages: STAGES,
    stageLabelMap: STAGE_LABEL_MAP,
    itemLabelMap: ITEM_LABEL_MAP,
    rounds: subjectsUtil.ROUNDS,
    subStages: subjectsUtil.SUB_STAGES,
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
    // 分科进度(可内联编辑)
    subjectProgress: {},
    subjectView: [],
    hasSubjectProgress: false,
    archivePublic: 0,
    archiveMajor: 0,
    targetSchool: '',
    // 进度趋势
    trend: null,
    // 编辑模式: false=只读展示, true=可点击编辑
    editMode: false,
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
      const history = data.items || data || [];
      this.setData({ history });
      // 有了档案数据后会在 loadProgressArchive 里一起算 trend
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
        this.setData({
          subjectProgress: {},
          subjectView: [],
          hasSubjectProgress: false,
          archivePublic: 0,
          archiveMajor: 0,
          targetSchool: '',
          trend: null,
        });
        return;
      }
      const sp = subjectsUtil.normalize(arc.subjectProgress);
      const view = subjectsUtil.buildView(sp);
      const hasAny = sp && view.some(function (s) { return s.percent > 0; });
      const overall = subjectsUtil.overall(sp);
      const trend = subjectsUtil.buildTrend(this.data.history, sp);
      this.setData({
        subjectProgress: sp,
        subjectView: view,
        hasSubjectProgress: !!hasAny,
        archivePublic: overall.public || arc.publicCourseProgress || 0,
        archiveMajor: overall.major || arc.majorCourseProgress || 0,
        targetSchool: arc.targetSchoolName ? (arc.targetSchoolName + (arc.targetMajor ? ' · ' + arc.targetMajor : '')) : '',
        trend: trend,
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

  // 切换编辑模式
  toggleEditMode() {
    const next = !this.data.editMode;
    this.setData({ editMode: next });
    if (!next) {
      // 退出编辑模式时,如果有修改,即时保存到后端
      this.saveProgress();
    }
  },

  // 内联编辑:点击章节轮次
  onChapterRoundTap(e) {
    if (!this.data.editMode) return;
    const key = e.currentTarget.dataset.key;
    const idx = Number(e.currentTarget.dataset.idx);
    const next = subjectsUtil.cycleRound(this.data.subjectProgress, key, idx);
    this.setData({
      subjectProgress: next,
      subjectView: subjectsUtil.buildView(next),
    });
  },

  // 内联编辑:点击章节细分(subStage)
  onChapterSubStageTap(e) {
    if (!this.data.editMode) return;
    const key = e.currentTarget.dataset.key;
    const idx = Number(e.currentTarget.dataset.idx);
    const next = subjectsUtil.cycleSubStage(this.data.subjectProgress, key, idx);
    this.setData({
      subjectProgress: next,
      subjectView: subjectsUtil.buildView(next),
    });
  },

  // 内联编辑:切换薄弱标记
  onChapterWeakTap(e) {
    if (!this.data.editMode) return;
    const key = e.currentTarget.dataset.key;
    const idx = Number(e.currentTarget.dataset.idx);
    const next = subjectsUtil.toggleWeak(this.data.subjectProgress, key, idx);
    this.setData({
      subjectProgress: next,
      subjectView: subjectsUtil.buildView(next),
    });
  },

  // 保存分科进度到后端
  async saveProgress() {
    const sp = this.data.subjectProgress;
    if (!sp || Object.keys(sp).length === 0) return;
    try {
      const overall = subjectsUtil.overall(sp);
      await getApp().request({
        url: '/progress/me/archive',
        method: 'PATCH',
        data: {
          subjectProgress: sp,
          publicCourseProgress: overall.public,
          majorCourseProgress: overall.major,
        },
      });
      // 更新本地显示
      this.setData({
        archivePublic: overall.public,
        archiveMajor: overall.major,
      });
    } catch (e) {
      // 保存失败不阻断,下次再试
    }
  },

  // 跳到档案采集页
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

    // 提交打卡前,先把当前分科进度保存到档案
    const sp = this.data.subjectProgress;
    const overall = subjectsUtil.overall(sp || {});

    const payload = {
      stage,
      completedItems,
      difficulties: difficulties.trim(),
      studyHours: this.data.form.studyHours ? Number(this.data.form.studyHours) : undefined,
      progressPublic: overall.public || this.data.archivePublic,
      progressMajor: overall.major || this.data.archiveMajor,
      onlineConfirmationCompleted: this.data.form.onlineConfirmationCompleted,
    };

    try {
      await getApp().request({ url: '/checkin/me/submit', method: 'POST', data: payload });
      // 同时保存分科进度到档案(如果有变化)
      if (sp && Object.keys(sp).length > 0) {
        try {
          await getApp().request({
            url: '/progress/me/archive',
            method: 'PATCH',
            data: {
              subjectProgress: sp,
              publicCourseProgress: overall.public,
              majorCourseProgress: overall.major,
            },
          });
        } catch (e) { /* 不阻断打卡 */ }
      }
      wx.showToast({ title: '打卡成功', icon: 'success' });
      this.loadCheckin();
      this.gotoCollectIfNeeded();
    } catch (e) {
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
      // 静默
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
