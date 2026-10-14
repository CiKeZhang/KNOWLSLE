// pages/message-board/message-board.js

const tabbar = require('../../utils/tabbar.js');

// 前端简单敏感词预检(仅拦截明显违规,减轻后端压力;最终审核以后端AI为准)
const SENSITIVE_KEYWORDS = [
  '加微信', '加vx', '加QQ', 'qq群', '微信群', '扫码', '二维码',
  '代购', '代发', '代考', '代做', '代写', '包过', '保过',
  '赌博', '博彩', '色情', '约炮', '一夜情',
];

function checkSensitive(text) {
  const lower = text.toLowerCase();
  for (const kw of SENSITIVE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return kw;
    }
  }
  return null;
}

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: false,
    refreshing: false,
    showPublish: false,
    publishContent: '',
    submitting: false,
  },

  onTabTap(e) { tabbar.onTap.call(this, e); },

  // 空方法:阻止弹窗面板内的点击事件冒泡到遮罩层导致误关闭
  noop() {},

  onShow() {
    tabbar.refresh(this, 'message-board');
    if (!getApp().checkLogin()) return;
    if (this.data.list.length === 0) {
      this.loadMessages();
    }
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true, page: 1 });
    this.loadMessages().then(() => {
      this.setData({ refreshing: false });
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
        url: `/message-board/messages?page=${this.data.page}&pageSize=${this.data.pageSize}`,
      });
      const items = (data.items || []).map((item) => ({
        ...item,
        timeText: this.formatTime(item.createdAt),
      }));
      if (append) {
        this.setData({ list: [...this.data.list, ...items] });
      } else {
        this.setData({ list: items });
      }
      this.setData({ total: data.total || 0 });
    } catch (e) {
      // 静默
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

  openPublish() {
    this.setData({ showPublish: true, publishContent: '' });
  },

  closePublish() {
    this.setData({ showPublish: false });
  },

  onContentInput(e) {
    this.setData({ publishContent: e.detail.value });
  },

  async submitPublish() {
    const content = this.data.publishContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入留言内容', icon: 'none' });
      return;
    }
    if (content.length > 500) {
      wx.showToast({ title: '留言不能超过500字', icon: 'none' });
      return;
    }
    // 前端敏感词预检
    const sensitive = checkSensitive(content);
    if (sensitive) {
      wx.showModal({
        title: '内容违规',
        content: `检测到违规内容:"${sensitive}",请修改后再发布。`,
        showCancel: false,
        confirmColor: '#f56c6c',
      });
      return;
    }

    this.setData({ submitting: true });
    try {
      await getApp().request({
        url: '/message-board/messages',
        method: 'POST',
        data: { content },
      });
      wx.showToast({ title: '发布成功', icon: 'success' });
      this.setData({ showPublish: false, publishContent: '' });
      // 刷新列表
      this.setData({ page: 1 });
      this.loadMessages();
    } catch (e) {
      // 错误已在 request 中提示
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleLike(e) {
    const id = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;
    try {
      const result = await getApp().request({
        url: `/message-board/messages/${id}/like`,
        method: 'POST',
      });
      const key = `list[${index}].isLiked`;
      const countKey = `list[${index}].likeCount`;
      this.setData({
        [key]: result.liked,
        [countKey]: result.likeCount,
      });
    } catch (e) {
      // 静默
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/message-detail/message-detail?id=${id}` });
  },
});
