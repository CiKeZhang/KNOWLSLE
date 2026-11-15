// pages/mentor-help/mentor-help.js

const tabbar = require('../../utils/tabbar.js');

// 后端 HelpStatus: OPEN(新建) / PENDING / IN_PROGRESS / RESOLVED
// 旧版页面只认 PENDING,导致新建申请被显示成「已解决」且没有「接受帮扶」按钮
const PENDING_STATUS = ['OPEN', 'PENDING'];
const STATUS_LABEL = {
  OPEN: '待处理', PENDING: '待处理', IN_PROGRESS: '进行中', RESOLVED: '已解决',
};
// 兼容两套历史枚举值: help.dto.ts 的 HelpTypeEnum 与 common/enums.ts 的 HelpType
const TYPE_LABEL = {
  SCHOOL_CHOICE: '择校困惑', SUBJECT_BOTTLENECK: '单科瓶颈',
  MENTAL_STATE: '心态问题', REEXAM_GUIDE: '复试指导', OTHER: '其他',
  ACADEMIC: '学业辅导', PSYCHOLOGICAL: '心理疏导',
  LIFE: '生活困难', EMPLOYMENT: '就业指导',
};

function normalize(list) {
  return (list || []).map((a) => Object.assign({}, a, {
    statusLabel: STATUS_LABEL[a.status] || a.status || '未知',
    typeLabel: TYPE_LABEL[a.type] || a.type || '其他',
    // 后端返回 student.name,旧页面误读 item.studentName 导致永远不显示
    studentName: (a.student && a.student.name) || a.studentName || '',
    canAssign: PENDING_STATUS.indexOf(a.status) >= 0,
    canRecord: a.status === 'IN_PROGRESS',
  }));
}

Page({
  onTabTap(e) { tabbar.onTap.call(this, e); },

  // 空方法:阻止弹窗面板内的点击事件冒泡到遮罩层导致误关闭
  noop() {},

  data: {
    applications: [],
    loading: true,
    recordModal: {
      visible: false,
      id: null,
      content: '',
      effect: '',
    },
    submitting: false,
  },

  onShow() {
    tabbar.refresh(this, 'help');
    this.loadApplications();
  },

  loadApplications() {
    this.setData({ loading: true });
    getApp().request({ url: '/mentor/help-applications' })
      .then((data) => {
        this.setData({ applications: normalize(data), loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  assignHelp(e) {
    if (this.data.submitting) return;
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '接受帮扶',
      content: '确认接受该帮扶申请？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ submitting: true });
          getApp().request({ url: `/mentor/help-applications/${id}/assign`, method: 'POST' })
            .then(() => {
              wx.showToast({ title: '已接受', icon: 'success' });
              this.loadApplications();
            })
            .catch(() => {})
            .then(() => this.setData({ submitting: false }));
        }
      },
    });
  },

  openRecordModal(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      'recordModal.visible': true,
      'recordModal.id': id,
      'recordModal.content': '',
      'recordModal.effect': '',
    });
  },

  closeRecordModal() {
    this.setData({ 'recordModal.visible': false });
  },

  onContentInput(e) {
    this.setData({ 'recordModal.content': e.detail.value });
  },

  onEffectInput(e) {
    this.setData({ 'recordModal.effect': e.detail.value });
  },

  submitRecord() {
    if (this.data.submitting) return;
    const { id, content, effect } = this.data.recordModal;
    if (!content.trim()) {
      wx.showToast({ title: '请填写帮扶内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });

    getApp().request({
      url: `/mentor/help-applications/${id}/record`,
      method: 'POST',
      data: { content: content.trim(), effect: effect.trim() },
    })
      .then(() => {
        wx.showToast({ title: '已记录', icon: 'success' });
        this.closeRecordModal();
        this.loadApplications();
      })
      .catch(() => {})
      .then(() => this.setData({ submitting: false }));
  },
});
