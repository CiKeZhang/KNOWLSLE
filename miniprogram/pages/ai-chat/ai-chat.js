// pages/ai-chat/ai-chat.js

Page({
  // 空方法:阻止侧边栏面板内的点击事件冒泡到遮罩层导致误关闭
  noop() {},

  data: {
    sessionId: null,
    messages: [],
    inputText: '',
    sending: false,
    sessions: [],
    showSessions: false,
    scrollToView: '',
    // 快捷问题
    quickQuestions: [
      '帮我推荐几所院校',
      '北京有哪些211院校',
      '会计学专业考研难吗',
      '我的考研档案情况',
    ],
  },

  onLoad(options) {
    if (!getApp().checkLogin()) return;
    if (options.sessionId) {
      this.setData({ sessionId: parseInt(options.sessionId, 10) });
      this.loadMessages();
    } else {
      // 新会话，添加欢迎消息
      this.addWelcomeMessage();
    }
    this.loadSessions();
  },

  addWelcomeMessage() {
    const welcomeMsg = {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是**研选小助手**🎯\n\n我是你的专属考研择校顾问，可以帮你：\n- 🔍 搜索院校和专业信息\n- 📊 查询历年录取数据（复试线、报录比）\n- 🎯 智能推荐院校（冲刺/稳妥/保底三档）\n- 💡 提供备考建议\n\n试试问我：\n"帮我推荐几所适合我的学校"\n"上海有哪些财经类院校"',
      isWelcome: true,
    };
    this.setData({ messages: [welcomeMsg] });
  },

  async loadSessions() {
    try {
      const data = await getApp().request({ url: '/ai/chat/sessions' });
      this.setData({ sessions: data || [] });
    } catch (e) {
      // 静默
    }
  },

  async loadMessages() {
    if (!this.data.sessionId) return;
    try {
      const data = await getApp().request({
        url: `/ai/chat/sessions/${this.data.sessionId}/messages`,
      });
      const msgs = (data || []).filter((m) => m.role !== 'system');
      this.setData({ messages: msgs });
      this.scrollToBottom();
    } catch (e) {
      // 静默
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  async sendMessage() {
    const text = this.data.inputText.trim();
    if (!text || this.data.sending) return;

    // 添加用户消息
    const userMsg = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: text,
    };
    this.setData({
      messages: [...this.data.messages, userMsg],
      inputText: '',
      sending: true,
    });
    this.scrollToBottom();

    try {
      const data = await getApp().request({
        url: '/ai/chat/send',
        method: 'POST',
        data: {
          sessionId: this.data.sessionId ? String(this.data.sessionId) : undefined,
          message: text,
        },
      });

      if (!this.data.sessionId && data.sessionId) {
        this.setData({ sessionId: data.sessionId });
        this.loadSessions();
      }

      // 添加 AI 回复
      if (data.message) {
        const aiMsg = {
          id: data.message.id || 'ai_' + Date.now(),
          role: 'assistant',
          content: data.message.content,
          createdAt: data.message.createdAt,
        };
        this.setData({
          messages: [...this.data.messages, aiMsg],
        });
        this.scrollToBottom();
      }
    } catch (e) {
      // 错误已在 request 中提示
      // 添加错误提示消息
      const errorMsg = {
        id: 'error_' + Date.now(),
        role: 'assistant',
        content: '抱歉，暂时无法连接到智能服务，请稍后再试。',
        isError: true,
      };
      this.setData({
        messages: [...this.data.messages, errorMsg],
      });
    } finally {
      this.setData({ sending: false });
    }
  },

  sendQuickQuestion(e) {
    const question = e.currentTarget.dataset.question;
    this.setData({ inputText: question });
    this.sendMessage();
  },

  scrollToBottom() {
    const messages = this.data.messages;
    if (messages.length > 0) {
      const lastId = messages[messages.length - 1].id;
      this.setData({ scrollToView: 'msg_' + lastId });
    }
  },

  toggleSessions() {
    this.setData({ showSessions: !this.data.showSessions });
  },

  selectSession(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      sessionId: id,
      showSessions: false,
      messages: [],
    });
    this.loadMessages();
  },

  async newChat() {
    try {
      const session = await getApp().request({
        url: '/ai/chat/sessions',
        method: 'POST',
      });
      this.setData({
        sessionId: session.id,
        messages: [],
        showSessions: false,
      });
      this.addWelcomeMessage();
      this.loadSessions();
    } catch (e) {
      // 静默
    }
  },

  async deleteSession(e) {
    const id = e.currentTarget.dataset.id;
    e.stopPropagation();
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个会话吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await getApp().request({
              url: `/ai/chat/sessions/${id}`,
              method: 'DELETE',
            });
            // 如果删除的是当前会话，清空
            if (this.data.sessionId === id) {
              this.setData({ sessionId: null, messages: [] });
              this.addWelcomeMessage();
            }
            this.loadSessions();
          } catch (e) {
            // 静默
          }
        }
      },
    });
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  },
});
