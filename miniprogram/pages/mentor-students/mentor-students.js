// pages/mentor-students/mentor-students.js

const tabbar = require('../../utils/tabbar.js');

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },
  data: {
    students: [],
    keyword: '',
    stage: '',
    loading: true,
    page: 1,
    hasMore: true,
  },

  onShow() {
    tabbar.refresh(this, 'students');
    this.setData({ page: 1, students: [], hasMore: true });
    this.loadStudents();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.setData({ page: 1, students: [], hasMore: true });
    this.loadStudents();
  },

  loadStudents() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });

    const stageMap = {
      NOT_STARTED: '未开始', CHOOSING: '择校中', FOUNDATION: '基础阶段',
      STRENGTHEN: '强化阶段', SPRINT: '冲刺阶段', EXAM: '初试',
      ADJUSTMENT: '复试调剂', ADMITTED: '已上岸',
    };
    Promise.all([
      getApp().request({
        url: '/mentor/students',
        data: { keyword: this.data.keyword, stage: this.data.stage, page: this.data.page, pageSize: 20 },
      }).catch(() => null),
      getApp().request({ url: '/mentor/watched' }).catch(() => []),
    ]).then(([data, watched]) => {
      if (!data) { this.setData({ loading: false, hasMore: false }); return; }
      const items = data.items || [];
      const watchedIds = new Set((watched || []).map((w) => w.studentId));
      const list = items.map((u) => ({
        id: u.id,
        name: u.name,
        studentNo: u.studentNo,
        majorName: u.majorName || (u.major && u.major.name) || '',
        stage: (u.studentProfile && stageMap[u.studentProfile.currentStage]) || '',
        watched: watchedIds.has(u.id),
      }));
      this.setData({
        students: this.data.students.concat(list),
        page: this.data.page + 1,
        hasMore: list.length >= 20,
        loading: false,
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onReachBottom() {
    this.loadStudents();
  },

  toggleWatch(e) {
    const id = e.currentTarget.dataset.id;
    const watched = e.currentTarget.dataset.watched;
    const url = watched ? `/mentor/watch/${id}` : `/mentor/watch/${id}`;
    const method = watched ? 'DELETE' : 'POST';

    getApp().request({ url, method, data: {} })
      .then(() => {
        wx.showToast({ title: watched ? '已取消关注' : '已关注', icon: 'success' });
        this.setData({ page: 1, students: [], hasMore: true });
        this.loadStudents();
      })
      .catch(() => {});
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/archive/archive?studentId=${id}` });
  },
});
