// pages/message-detail/message-detail.js

// 前端简单敏感词预检
const SENSITIVE_KEYWORDS = [
  '加微信', '加vx', '加v', '加QQ', 'qq群', '微信群', '扫码', '二维码',
  '代购', '代发', '代考', '代做', '代写', '包过', '保过',
  '赌博', '博彩', '色情', '约炮', '一夜情',
];

function checkSensitive(text) {
  const lower = text.toLowerCase();
  for (const kw of SENSITIVE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

Page({
  data: {
    messageId: 0,
    message: null,
    replies: [],
    replyContent: '',
    isAnonymous: false,
    submitting: false,
    loading: true,
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    const id = parseInt(options.id, 10);
    this.setData({ messageId: id });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const data = await getApp().request({
        url: `/message-board/messages/${this.data.messageId}`,
      });
      this.setData({
        message: {
          ...data,
          timeText: this.formatTime(data.createdAt),
        },
        replies: (data.replies || []).map((r) => ({
          ...r,
          timeText: this.formatTime(r.createdAt),
        })),
      });
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
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  onReplyInput(e) {
    this.setData({ replyContent: e.detail.value });
  },

  toggleAnonymous() {
    this.setData({ isAnonymous: !this.data.isAnonymous });
  },

  async submitReply() {
    const content = this.data.replyContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }
    if (content.length > 300) {
      wx.showToast({ title: '回复不能超过300字', icon: 'none' });
      return;
    }
    // 前端敏感词预检
    const sensitive = checkSensitive(content);
    if (sensitive) {
      wx.showModal({
        title: '内容违规',
        content: `检测到违规内容:"${sensitive}",请修改后再回复。`,
        showCancel: false,
        confirmColor: '#f56c6c',
      });
      return;
    }

    this.setData({ submitting: true });
    try {
      const reply = await getApp().request({
        url: `/message-board/messages/${this.data.messageId}/reply`,
        method: 'POST',
        data: {
          content,
          isAnonymous: this.data.isAnonymous,
        },
      });
      wx.showToast({ title: '回复成功', icon: 'success' });
      this.setData({
        replyContent: '',
        replies: [
          ...this.data.replies,
          { ...reply, timeText: '刚刚' },
        ],
        'message.replyCount': this.data.message.replyCount + 1,
      });
    } catch (e) {
      // 错误已提示
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleLike() {
    try {
      const result = await getApp().request({
        url: `/message-board/messages/${this.data.messageId}/like`,
        method: 'POST',
      });
      this.setData({
        'message.isLiked': result.liked,
        'message.likeCount': result.likeCount,
      });
    } catch (e) {
      // 静默
    }
  },

  async deleteMessage() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条留言吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await getApp().request({
              url: `/message-board/messages/${this.data.messageId}`,
              method: 'DELETE',
            });
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
          } catch (e) {
            // 静默
          }
        }
      },
    });
  },
});
