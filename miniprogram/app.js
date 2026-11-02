// app.js - 考研进度管理小程序全局逻辑
const config = require('./config.js');

// 解析请求通道:开发版直连后端,体验版/正式版走云托管(免域名白名单)
function resolveCloudMode() {
  if (config.mode === 'cloud') return true;
  if (config.mode === 'local') return false;
  try {
    const info = wx.getAccountInfoSync();
    const version = info && info.miniProgram ? info.miniProgram.envVersion : 'develop';
    // develop = 开发者工具/开发版, trial = 体验版, release = 正式版
    return version === 'trial' || version === 'release';
  } catch (e) {
    return false;
  }
}

App({
  globalData: {
    apiBase: config.apiBase,
    token: '',
    userInfo: null,
    // 云托管模式:请求走 wx.cloud.callContainer,不受合法域名限制
    isCloud: false,
  },

  onLaunch() {
    this.globalData.isCloud = resolveCloudMode();

    // 云托管模式需要初始化云开发环境
    if (this.globalData.isCloud) {
      if (wx.cloud && config.cloudEnv) {
        wx.cloud.init({ env: config.cloudEnv, traceUser: true });
      } else {
        console.error('[config] 云托管模式已启用但 cloudEnv 未配置,请在 config.js 填写云开发环境ID');
      }
    }

    // 启动时读取本地缓存的 token 和用户信息
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) this.globalData.token = token;
    if (userInfo) this.globalData.userInfo = userInfo;
  },

  // 统一响应处理(两种请求通道共用)
  _handleResponse(res, resolve, reject) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const body = res.data;
      // 后端统一响应格式 { success, code, message, data }
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

  // 直连后端(局域网 / 已备案 HTTPS 域名)
  _requestLocal(url, method, data, header) {
    const fullUrl = url.startsWith('http') ? url : this.globalData.apiBase + url;
    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method,
        data,
        header,
        success: (res) => this._handleResponse(res, resolve, reject),
        fail: (err) => {
          wx.showToast({ title: '网络异常,请稍后重试', icon: 'none' });
          reject(err);
        },
      });
    });
  },

  // 微信云托管调用(免域名白名单)
  _requestCloud(url, method, data, header) {
    const path = url.startsWith('http') ? url : '/api' + url;
    const mergedHeader = Object.assign({}, header, {
      'X-WX-SERVICE': config.cloudService,
    });
    return new Promise((resolve, reject) => {
      wx.cloud.callContainer({
        config: { env: config.cloudEnv },
        path,
        method,
        data,
        header: mergedHeader,
        success: (res) => this._handleResponse(res, resolve, reject),
        fail: (err) => {
          wx.showToast({ title: '网络异常,请稍后重试', icon: 'none' });
          reject(err);
        },
      });
    });
  },

  // 统一请求方法(带 token 自动注入 + 错误处理)
  request(options) {
    const { url, method = 'GET', data = {}, header = {} } = options;
    const mergedHeader = Object.assign(
      {
        'Content-Type': 'application/json',
        'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : '',
      },
      header,
    );

    if (this.globalData.isCloud) {
      return this._requestCloud(url, method, data, mergedHeader);
    }
    return this._requestLocal(url, method, data, mergedHeader);
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
