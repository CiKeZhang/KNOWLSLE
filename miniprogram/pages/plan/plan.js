// pages/plan/plan.js

Page({
  data: {
    period: 'weekly',
    plan: null,
    tasks: [],
    editing: false,
    saving: false,
  },

  onShow() {
    if (!getApp().checkLogin()) return;
    this.load();
  },

  switchPeriod(e) {
    this.setData({ period: e.currentTarget.dataset.period });
    this.load();
  },

  async load() {
    try {
      const url = this.data.period === 'weekly' ? '/study-plan/me/weekly' : '/study-plan/me/monthly';
      const data = await getApp().request({ url });
      this.setData({ plan: data, tasks: data.tasks || [] });
    } catch (e) {
      // 静默
    }
  },

  toggleTask(e) {
    const index = e.currentTarget.dataset.index;
    const tasks = [...this.data.tasks];
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
      // 静默
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
