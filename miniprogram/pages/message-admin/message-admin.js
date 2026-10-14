// pages/message-admin/message-admin.js
// 后台管理员留言管理:查看全部留言(含审核未通过),可编辑/删除任意留言

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    editVisible: false,
    editId: 0,
    editContent: '',
    submitting: false,
  },

  // 空方法:阻止弹窗面板内的点击事件冒泡到遮罩层导致误关闭
  noop() {},

  onShow() {
    if (!getApp().checkLogin()) return;
    if (this.data.list.length === 0) {
      this.loadMessages();
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadMessages().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.loading) return;
    if (this.data.list.length >= this.data.total) return;
    this.setData({ page: this.data.page + 1 });
    this.loadMessages(true);
  },

  async loadMessages(append = false) {
    this.setData({ loading: true });
    try {
      const data = await getApp().request({
        url: `/message-board/admin/messages?page=${this.data.page}&pageSize=${this.data.pageSize}`,
      });
      const items = (data.items || []).map((item) => ({
        ...item,
        timeText: this.formatTime(item.createdAt),
      }));
      this.setData({
        list: append ? this.data.list.concat(items) : items,
        total: data.total || 0,
      });
    } catch (e) {
      // 403(非管理员)或网络错误已在 request 内提示
    } finally {
      this.setData({ loading: false });
    }
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  openEdit(e) {
    const { id, content } = e.currentTarget.dataset;
    this.setData({ editVisible: true, editId: id, editContent: content });
  },

  closeEdit() {
    this.setData({ editVisible: false, editId: 0, editContent: '' });
  },

  onEditInput(e) {
    this.setData({ editContent: e.detail.value });
  },

  async submitEdit() {
    const content = this.data.editContent.trim();
    if (!content) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await getApp().request({
        url: `/message-board/messages/${this.data.editId}`,
        method: 'PATCH',
        data: { content },
      });
      wx.showToast({ title: '已保存', icon: 'success' });
      const editId = this.data.editId;
      const list = this.data.list.map((m) =>
        m.id === editId ? { ...m, content, auditStatus: 'APPROVED', auditResult: null } : m,
      );
      this.setData({ list, editVisible: false, editId: 0, editContent: '' });
    } catch (e) {
      // 审核未通过等错误已在 request 内提示
    } finally {
      this.setData({ submitting: false });
    }
  },

  deleteMessage(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后该留言及其回复对学生端不再可见,确定删除吗?',
      confirmColor: '#f56c6c',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await getApp().request({
            url: `/message-board/messages/${id}`,
            method: 'DELETE',
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({
            list: this.data.list.filter((m) => m.id !== id),
            total: this.data.total - 1,
          });
        } catch (err) {
          // 错误已在 request 内提示
        }
      },
    });
  },
});
