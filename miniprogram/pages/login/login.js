// pages/login/login.js
const config = require('../../config.js');

Page({
  data: {
    step: 1,
    openid: '',
    sessionKey: '',
    nickname: '',
    avatarUrl: '',
    phone: '',
    identity: 'student', // student 学生 / mentor 导师
    majors: config.majors,
    majorIndex: -1,
    form: {
      name: '',
      studentNo: '',
    },
    submitting: false,
    agreedPrivacy: false,
  },

  // 勾选隐私协议
  togglePrivacy() {
    this.setData({ agreedPrivacy: !this.data.agreedPrivacy });
  },

  // 打开隐私政策
  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  // 切换身份
  switchIdentity(e) {
    this.setData({ identity: e.currentTarget.dataset.role });
  },

  // 专业选择
  onMajorChange(e) {
    this.setData({ majorIndex: Number(e.detail.value) });
  },

  onLoad() {
    // 如果已登录,按角色跳转首页
    if (getApp().globalData.token) {
      const userInfo = getApp().globalData.userInfo || wx.getStorageSync('userInfo') || {};
      const isMentor = userInfo.role && userInfo.role !== 'STUDENT';
      const homeUrl = isMentor ? '/pages/mentor-dashboard/mentor-dashboard' : '/pages/index/index';
      wx.reLaunch({ url: homeUrl });
    }
  },

  // 第一步:微信登录(wx.login + getUserInfo)
  onWechatLogin(e) {
    const that = this;
    wx.showLoading({ title: '登录中...' });

    // 1. 调用 wx.login 获取 code
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' });
          return;
        }

        // 2. 后端用 code 换 openid
        getApp().request({
          url: '/auth/wechat/login',
          method: 'POST',
          data: { code: loginRes.code },
        }).then((data) => {
          wx.hideLoading();
          that.setData({
            openid: data.openid,
            sessionKey: data.sessionKey,
            step: 2,
          });
        }).catch(() => {
          wx.hideLoading();
        });
      },
      fail() {
        wx.hideLoading();
        wx.showToast({ title: '微信登录失败', icon: 'none' });
      },
    });
  },

  // 第一步:获取微信用户信息(昵称头像)
  onGetUserInfo(e) {
    if (e.detail.userInfo) {
      this.setData({
        nickname: e.detail.userInfo.nickName,
        avatarUrl: e.detail.userInfo.avatarUrl,
      });
    }
  },

  // 第二步:获取手机号
  onGetPhone(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '未授权手机号', icon: 'none' });
      // 仍然进入下一步,允许不填手机号
      this.setData({ step: 3 });
      return;
    }

    const that = this;
    wx.showLoading({ title: '处理中...' });

    getApp().request({
      url: '/auth/wechat/phone',
      method: 'POST',
      data: { code: e.detail.code },
    }).then((phone) => {
      wx.hideLoading();
      that.setData({ phone, step: 3 });
    }).catch(() => {
      wx.hideLoading();
      that.setData({ step: 3 });
    });
  },

  // 跳过手机号
  skipPhone() {
    this.setData({ step: 3 });
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onStudentNoInput(e) {
    this.setData({ 'form.studentNo': e.detail.value });
  },

  // 第三步:补全信息,完成登录
  onComplete() {
    const { name, studentNo } = this.data.form;
    const { identity, majors, majorIndex, agreedPrivacy } = this.data;
    if (!agreedPrivacy) {
      wx.showToast({ title: '请先阅读并同意隐私政策', icon: 'none' });
      return;
    }
    if (!name.trim()) {
      wx.showToast({ title: '请填写真实姓名', icon: 'none' });
      return;
    }
    if (!studentNo.trim()) {
      wx.showToast({ title: identity === 'mentor' ? '请填写工号' : '请填写学号', icon: 'none' });
      return;
    }
    let majorName = '';
    if (identity === 'student') {
      if (majorIndex < 0) {
        wx.showToast({ title: '请选择专业', icon: 'none' });
        return;
      }
      majorName = majors[majorIndex];
    }

    this.setData({ submitting: true });
    const that = this;

    const payload = {
      openid: this.data.openid,
      phone: this.data.phone,
      name: name.trim(),
      studentNo: studentNo.trim(),
      identity,
      nickname: this.data.nickname,
      avatarUrl: this.data.avatarUrl,
    };
    if (majorName) payload.majorName = majorName;

    getApp().request({
      url: '/auth/wechat/complete',
      method: 'POST',
      data: payload,
    }).then((data) => {
      // 保存 token 和用户信息
      wx.setStorageSync('token', data.accessToken);
      wx.setStorageSync('userInfo', data.user);
      getApp().globalData.token = data.accessToken;
      getApp().globalData.userInfo = data.user;

      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        const isMentor = data.user.role && data.user.role !== 'STUDENT';
        const homeUrl = isMentor ? '/pages/mentor-dashboard/mentor-dashboard' : '/pages/index/index';
        wx.reLaunch({ url: homeUrl });
      }, 800);
    }).catch(() => {
      that.setData({ submitting: false });
    });
  },
});
