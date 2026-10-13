// pages/recommend/recommend.js

const TIERS = ['冲刺', '稳妥', '保底'];

Page({
  data: {
    form: {
      undergraduateMajor: '',
      gpa: '',
      majorRank: '',
      region: '',
      schoolTierPref: '',
      remainingMonths: 12,
      strongSubjects: '',
      weakSubjects: '',
      targetMajor: '',
    },
    result: null,
    loading: false,
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async generate() {
    if (!this.data.form.undergraduateMajor) {
      wx.showToast({ title: '请填写本科专业', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const payload = {
        ...this.data.form,
        strongSubjects: this.data.form.strongSubjects ? this.data.form.strongSubjects.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        weakSubjects: this.data.form.weakSubjects ? this.data.form.weakSubjects.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
      };
      const data = await getApp().request({ url: '/ai/recommend', method: 'POST', data: payload });
      this.setData({ result: data });
    } catch (e) {
      // 静默
    } finally {
      this.setData({ loading: false });
    }
  },
});
