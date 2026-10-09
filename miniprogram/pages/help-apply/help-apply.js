// pages/help-apply/help-apply.js

const TYPES = [
  { value: 'SCHOOL_CHOICE', label: '择校困惑' },
  { value: 'SUBJECT_BOTTLENECK', label: '单科瓶颈' },
  { value: 'MENTAL', label: '心态问题' },
  { value: 'REEXAM', label: '复试指导' },
  { value: 'OTHER', label: '其他' },
];

Page({
  data: {
    types: TYPES,
    form: { type: '', content: '' },
    submitting: false,
  },

  selectType(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.value });
  },

  onContentInput(e) {
    this.setData({ 'form.content': e.detail.value });
  },

  async submit() {
    if (!this.data.form.type) {
      wx.showToast({ title: '请选择帮扶类型', icon: 'none' });
      return;
    }
    if (!this.data.form.content.trim()) {
      wx.showToast({ title: '请填写帮扶内容', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await getApp().request({ url: '/help', method: 'POST', data: this.data.form });
      wx.showToast({ title: '已提交', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      // 静默
    } finally {
      this.setData({ submitting: false });
    }
  },
});
