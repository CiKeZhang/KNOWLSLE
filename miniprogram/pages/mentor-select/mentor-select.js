// pages/mentor-select/mentor-select.js
Page({
  data: {
    loading: true,
    submitting: false,
    mentors: [],
    shownMentors: [],
    keyword: '',
    currentMentor: null,
    fromLogin: false,
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    this.setData({ fromLogin: !!(options && options.from === 'login') });
    this.loadData();
  },

  // 拉取导师列表 + 当前已选导师
  loadData() {
    const that = this;
    that.setData({ loading: true });
    Promise.all([
      getApp().request({ url: '/mentor/options' }),
      getApp().request({ url: '/mentor/my-mentor' }),
    ]).then(function (res) {
      that.setData({
        mentors: res[0] || [],
        currentMentor: res[1] || null,
        loading: false,
      });
      that.buildList();
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  // 按关键词过滤并补充展示字段
  buildList() {
    const current = this.data.currentMentor;
    const kw = (this.data.keyword || '').trim().toLowerCase();
    const list = (this.data.mentors || []).filter(function (m) {
      if (!kw) return true;
      return (m.name || '').toLowerCase().indexOf(kw) >= 0
        || (m.staffNo || '').toLowerCase().indexOf(kw) >= 0;
    }).map(function (m) {
      return {
        id: m.id,
        name: m.name,
        staffNo: m.staffNo,
        majorName: m.majorName,
        initial: m.name ? m.name.substring(0, 1) : '师',
        isSelected: !!(current && current.id === m.id),
      };
    });
    this.setData({ shownMentors: list });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    this.buildList();
  },

  // 点击某位老师
  chooseMentor(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    if (this.data.currentMentor && this.data.currentMentor.id === id) return;
    const that = this;
    wx.showModal({
      title: this.data.currentMentor ? '更换导师' : '确认选择',
      content: '确定选择「' + name + '」老师作为你的指导老师吗?',
      success(res) {
        if (res.confirm) that.submit(id);
      },
    });
  },

  submit(mentorId) {
    const that = this;
    if (that.data.submitting) return;
    that.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });
    getApp().request({
      url: '/mentor/select',
      method: 'POST',
      data: { mentorId: mentorId },
    }).then(function (data) {
      wx.hideLoading();
      that.setData({ submitting: false });
      // 同步本地用户信息
      const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
      userInfo.mentorId = data.mentorId;
      userInfo.mentorName = data.mentorName;
      wx.setStorageSync('userInfo', userInfo);
      getApp().globalData.userInfo = userInfo;

      wx.showToast({ title: '选择成功', icon: 'success' });
      setTimeout(function () {
        if (that.data.fromLogin) {
          wx.reLaunch({ url: '/pages/index/index' });
        } else {
          wx.navigateBack({
            delta: 1,
            fail() { wx.reLaunch({ url: '/pages/index/index' }); },
          });
        }
      }, 800);
    }).catch(function () {
      wx.hideLoading();
      that.setData({ submitting: false });
    });
  },

  // 登录后允许暂时跳过
  skip() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
