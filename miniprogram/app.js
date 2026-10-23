// app.js - 考研进度管理小程序全局逻辑
const config = require('./config.js');

App({
  globalData: {
    apiBase: config.apiBase,
    token: '',
    userInfo: null,
  },

  onLaunch() {
    // 启动时读取本地缓存的 token 和用户信息
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) this.globalData.token = token;
    if (userInfo) this.globalData.userInfo = userInfo;
  },

  // 统一请求方法(带 token 自动注入 + 错误处理)
  request(options) {
    const { url, method = 'GET', data = {}, header = {} } = options;
    const fullUrl = (url.startsWith('http') ? url : this.globalData.apiBase + url);

    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : '',
          ...header,
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = res.data;
            // 后端统一响应格式 { code, data, message }
            if (body.success !== false) {
              resolve(body.data !== undefined ? body.data : body);
            } else {
              wx.showToast({ title: body.message || '请求失败', icon: 'none' });
              reject(body);
            }
          } else if (res.statusCode === 401) {
            // token 过期,清除并跳转登录
            try { wx.hideLoading(); } catch (e) {}
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            this.globalData.token = '';
            this.globalData.userInfo = null;
            wx.showToast({ title: '登录已过期,请重新登录', icon: 'none' });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 1000);
            reject(res);
          } else {
            wx.showToast({ title: `服务器错误 ${res.statusCode}`, icon: 'none' });
            reject(res);
          }
        },
        fail: (err) => {
          wx.showToast({ title: '网络异常,请稍后重试', icon: 'none' });
          reject(err);
        },
      });
    });
  },

  // 检查登录态
  checkLogin() {
    if (!this.globalData.token) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  // 根据角色获取首页路径
  getHomePage() {
    const userInfo = this.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    const isMentor = userInfo.role && userInfo.role !== 'STUDENT';
    return isMentor ? '/pages/mentor-dashboard/mentor-dashboard' : '/pages/index/index';
  },
});
