// pages/recommend/recommend.js

const TIERS = ['冲刺', '稳妥', '保底'];

// 与后端 SchoolTierEnum 保持一致(曾因自由文本 + 空字符串导致 /ai/recommend 必现 400)
const SCHOOL_TIERS = [
  { value: '', label: '不限' },
  { value: 'NINE_EIGHT_FIVE', label: '985' },
  { value: 'TWO_ONE_ONE', label: '211' },
  { value: 'DOUBLE_FIRST', label: '双一流' },
  { value: 'DOUBLE_NON', label: '双非' },
];

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
    schoolTiers: SCHOOL_TIERS,
    tierIndex: 0,
    result: null,
    loading: false,
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onTierChange(e) {
    const idx = Number(e.detail.value) || 0;
    this.setData({ tierIndex: idx, 'form.schoolTierPref': SCHOOL_TIERS[idx].value });
  },

  // 结果页「重新生成」:清掉结果让表单重新出现
  reset() {
    this.setData({ result: null, loading: false });
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
      delete payload.targetMajor; // 后端 DTO 无此字段
      // @IsOptional 不跳过空字符串,'' 会被 @IsEnum 判为非法值而返回 400
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === undefined || payload[k] === null) delete payload[k];
      });
      const data = await getApp().request({ url: '/ai/recommend', method: 'POST', data: payload });
      this.setData({ result: data });
    } catch (e) {
      // 错误提示已由 app.js 统一展示
    } finally {
      this.setData({ loading: false });
    }
  },
});
