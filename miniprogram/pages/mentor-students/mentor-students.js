// pages/mentor-students/mentor-students.js

const tabbar = require('../../utils/tabbar.js');

// 与后端 student-scope.ts 一致:仅这两位院长(及管理员)可以看到全院学生
const FULL_ACCESS_STAFF_NOS = ['683412', '512907'];

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },

  // 请求序号:切换筛选条件后丢弃在途的旧分页响应
  _seq: 0,

  data: {
    students: [],
    keyword: '',
    stage: '',
    loading: false,
    page: 1,
    hasMore: true,
    onlyMine: false,
    canFilterMine: false,
  },

  onShow() {
    tabbar.refresh(this, 'students');
    const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const isAdmin = userInfo.role === 'ACADEMIC_ADMIN' || userInfo.role === 'SYS_ADMIN';
    const isDean = FULL_ACCESS_STAFF_NOS.indexOf(String(userInfo.staffNo || userInfo.username || '')) >= 0;
    this.setData({
      page: 1,
      students: [],
      hasMore: true,
      loading: false,
      // 普通导师的可见范围本来就锁定为 mentorId=自己,「我的学生」开关对他没有意义
      canFilterMine: isAdmin || isDean,
    });
    this.loadStudents();
  },

  // 切换「全部学生 / 我的学生」
  toggleMine() {
    this.setData({ onlyMine: !this.data.onlyMine, page: 1, students: [], hasMore: true });
    this.loadStudents();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this._seq++;
    this.setData({ page: 1, students: [], hasMore: true, loading: false });
    this.loadStudents();
  },

  loadStudents() {
    // 防重:快速上滑/重复 onShow 时并发请求同一页会 concat 出重复学生
    if (this.data.loading || !this.data.hasMore) return;
    const seq = ++this._seq;
    this.setData({ loading: true });

    // 与后端 StudyStage 枚举一致(旧映射有 6 个阶段对不上,会显示空白)
    const stageMap = {
      NOT_STARTED: '未开始', CHOOSING: '择校中', BASIC: '基础复习',
      STRENGTHENING: '强化刷题', SPRINT: '冲刺', EXAM_DONE: '初试结束',
      REEXAM_PREP: '备战复试', ADJUSTING: '调剂中', FINISHED: '考研结束',
    };
    const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
    Promise.all([
      getApp().request({
        url: '/mentor/students',
        data: {
          keyword: this.data.keyword,
          stage: this.data.stage,
          page: this.data.page,
          pageSize: 20,
          mentorId: this.data.onlyMine ? userInfo.id : '',
        },
      }).catch(() => null),
      getApp().request({ url: '/mentor/watched' }).catch(() => []),
    ]).then(([data, watched]) => {
      // 筛选条件已变/已有更新的请求,丢弃这份旧响应
      if (seq !== this._seq) return;
      if (!data) { this.setData({ loading: false, hasMore: false }); return; }
      const items = data.items || [];
      const watchedIds = new Set((watched || []).map((w) => w.studentId));
      const list = items.map((u) => ({
        id: u.id,
        name: u.name,
        studentNo: u.studentNo,
        majorName: u.majorName || (u.major && u.major.name) || '',
        stage: (u.studentProfile && stageMap[u.studentProfile.currentStage]) || '',
        mentorName: (u.mentor && u.mentor.name) || '',
        watched: watchedIds.has(u.id),
      }));
      const merged = this.data.students.concat(list);
      // 后端返回过滤后的真实 total;用「本页条数>=20」推断会因不足一页而提前截断
      const total = typeof data.total === 'number' ? data.total : merged.length;
      this.setData({
        students: merged,
        page: this.data.page + 1,
        hasMore: merged.length < total && list.length > 0,
        loading: false,
      });
    }).catch(() => {
      if (seq === this._seq) this.setData({ loading: false });
    });
  },

  onReachBottom() {
    this.loadStudents();
  },

  toggleWatch(e) {
    const id = e.currentTarget.dataset.id;
    const watched = e.currentTarget.dataset.watched;
    const url = `/mentor/watch/${id}`;
    const method = watched ? 'DELETE' : 'POST';

    getApp().request({ url, method, data: {} })
      .then(() => {
        wx.showToast({ title: watched ? '已取消关注' : '已关注', icon: 'success' });
        this._seq++;
        this.setData({ page: 1, students: [], hasMore: true, loading: false });
        this.loadStudents();
      })
      .catch(() => {});
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/archive/archive?studentId=${id}` });
  },
});
