// pages/mentor-help/mentor-help.js

const tabbar = require('../../utils/tabbar.js');

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
  },

  onShow() {
    tabbar.refresh(this, 'help');
    this.loadApplications();
  },

  loadApplications() {
    this.setData({ loading: true });
    getApp().request({ url: '/mentor/help-applications' })
      .then((data) => {
        this.setData({ applications: data || [], loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
      });
  },

  assignHelp(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '接受帮扶',
      content: '确认接受该帮扶申请？',
      success: (res) => {
        if (res.confirm) {
          getApp().request({ url: `/mentor/help-applications/${id}/assign`, method: 'POST' })
            .then(() => {
              wx.showToast({ title: '已接受', icon: 'success' });
              this.loadApplications();
            })
            .catch(() => {});
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
    const { id, content, effect } = this.data.recordModal;
    if (!content.trim()) {
      wx.showToast({ title: '请填写帮扶内容', icon: 'none' });
      return;
    }

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
      .catch(() => {});
  },
});
