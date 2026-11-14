// pages/plan/plan.js

Page({
  data: {
    period: 'weekly',
    plan: null,
    tasks: [],
    editing: false,
    saving: false,
  },

  // 请求序号:快速切换周期时丢弃旧响应,避免旧数据覆盖新 tab
  _seq: 0,

  onShow() {
    if (!getApp().checkLogin()) return;
    this.load();
  },

  switchPeriod(e) {
    this.setData({ period: e.currentTarget.dataset.period });
    this.load();
  },

  // wxml 的 bindtap 只能是方法名,不能用内联赋值表达式
  startEdit() {
    this.setData({ editing: true });
  },

  cancelEdit() {
    this.setData({ editing: false });
    this.load();
  },

  async load() {
    const seq = ++this._seq;
    try {
      const url = this.data.period === 'weekly' ? '/study-plan/me/weekly' : '/study-plan/me/monthly';
      const data = await getApp().request({ url });
      if (seq !== this._seq) return;
      this.setData({ plan: data, tasks: data.tasks || [] });
    } catch (e) {
      // 静默
    }
  },

  toggleTask(e) {
    if (!this.data.plan) return;
    const index = e.currentTarget.dataset.index;
    const tasks = [...this.data.tasks];
    if (!tasks[index]) return;
    tasks[index].done = !tasks[index].done;
    this.setData({ tasks });
    getApp().request({
      url: `/study-plan/${this.data.plan.id}/toggle`,
      method: 'PATCH',
      data: { index, done: tasks[index].done },
    }).catch(() => {});
  },

  addTask() {
    const tasks = [...this.data.tasks, { task: '', subject: '综合', targetHours: 4, done: false }];
    this.setData({ tasks, editing: true });
  },

  onTaskInput(e) {
    const index = e.currentTarget.dataset.index;
    const tasks = [...this.data.tasks];
    tasks[index].task = e.detail.value;
    this.setData({ tasks });
  },

  async save() {
    if (!this.data.plan) return;
    this.setData({ saving: true });
    try {
      await getApp().request({
        url: `/study-plan/${this.data.plan.id}`,
        method: 'PATCH',
        data: { tasks: this.data.tasks },
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editing: false });
    } catch (e) {
      // 错误提示已由 app.js 统一展示
    } finally {
      this.setData({ saving: false });
    }
  },

  async regenerate() {
    try {
      const data = await getApp().request({ url: '/study-plan/me/regenerate', method: 'POST' });
      this.setData({ plan: data, tasks: data.tasks || [] });
      wx.showToast({ title: '已重新生成', icon: 'success' });
    } catch (e) {
      // 静默
    }
  },
});
