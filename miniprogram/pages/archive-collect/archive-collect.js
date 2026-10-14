// pages/archive-collect/archive-collect.js
// 打卡后的信息采集:目标院校 / 目标专业 / 分科细化进度,写入考研档案

var subjectsUtil = require('../../utils/subjects.js');

Page({
  data: {
    form: {
      targetSchoolName: '',
      targetMajor: '',
      region: '',
      remainingMonths: '',
    },
    // 分科进度:subjectProgress 为提交结构,subjectView 为渲染结构
    subjectProgress: {},
    subjectView: [],
    rounds: subjectsUtil.ROUNDS,
    fromCheckin: false,
    submitting: false,
  },

  onLoad: function (options) {
    if (!getApp().checkLogin()) return;
    this.setData({ fromCheckin: !!(options && options.from === 'checkin') });
    this.loadExisting();
  },

  loadExisting: function () {
    var that = this;
    getApp().request({ url: '/progress/me' }).then(function (data) {
      var a = data.archive || {};
      var p = data.profile || {};
      var sp = subjectsUtil.normalize(a.subjectProgress);
      that.setData({
        form: {
          targetSchoolName: a.targetSchoolName || '',
          targetMajor: a.targetMajor || '',
          region: p.region || '',
          remainingMonths: p.remainingMonths != null ? String(p.remainingMonths) : '',
        },
        subjectProgress: sp,
        subjectView: subjectsUtil.buildView(sp),
      });
    }).catch(function () {
      // 无档案时使用默认空进度
      var sp = subjectsUtil.normalize(null);
      that.setData({ subjectProgress: sp, subjectView: subjectsUtil.buildView(sp) });
    });
  },

  onSchoolInput: function (e) { this.setData({ 'form.targetSchoolName': e.detail.value }); },
  onMajorInput: function (e) { this.setData({ 'form.targetMajor': e.detail.value }); },
  onRegionInput: function (e) { this.setData({ 'form.region': e.detail.value }); },
  onMonthsInput: function (e) { this.setData({ 'form.remainingMonths': e.detail.value }); },

  // 点击章节:未开始 -> 一轮 -> 强化 -> 冲刺 -> 未开始
  onChapterTap: function (e) {
    var key = e.currentTarget.dataset.key;
    var idx = Number(e.currentTarget.dataset.idx);
    var next = subjectsUtil.cycle(this.data.subjectProgress, key, idx);
    this.setData({ subjectProgress: next, subjectView: subjectsUtil.buildView(next) });
  },

  submit: function () {
    var that = this;
    var f = this.data.form;
    if (!f.targetSchoolName.trim()) {
      wx.showToast({ title: '请填写目标院校', icon: 'none' });
      return;
    }

    var archiveData = {
      targetSchoolName: f.targetSchoolName.trim(),
      subjectProgress: this.data.subjectProgress,
    };
    if (f.targetMajor.trim()) archiveData.targetMajor = f.targetMajor.trim();

    var profileData = {};
    if (f.region.trim()) profileData.region = f.region.trim();
    if (f.remainingMonths !== '') profileData.remainingMonths = Number(f.remainingMonths);

    this.setData({ submitting: true });
    getApp().request({ url: '/progress/me/archive', method: 'PATCH', data: archiveData })
      .then(function () {
        if (Object.keys(profileData).length > 0) {
          return getApp().request({ url: '/progress/me/profile', method: 'PATCH', data: profileData });
        }
        return null;
      })
      .then(function () {
        wx.showToast({ title: '档案已保存', icon: 'success' });
        setTimeout(function () {
          if (getCurrentPages().length > 1) {
            wx.navigateBack();
          } else {
            wx.redirectTo({ url: '/pages/archive/archive' });
          }
        }, 800);
      })
      .catch(function () {
        // 错误提示由 request 统一处理
      })
      .then(function () {
        that.setData({ submitting: false });
      });
  },
});
