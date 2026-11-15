// app.js - 考研进度管理小程序全局逻辑
const config = require('./config.js');

// 并发请求同时收到 401 时只跳转一次登录页,避免连续 reLaunch
let redirecting = false;

// 后端参数校验失败的 message 是字符串数组,showToast 只接受字符串
function fmtMsg(msg, fallback) {
  if (Array.isArray(msg)) return msg.join('；').slice(0, 60);
  if (typeof msg === 'string' && msg.trim()) return msg.slice(0, 60);
  return fallback;
}

function hideLoading() {
  try { wx.hideLoading(); } catch (e) {}
}

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

  // 统一响应处理(两种请求通道共用)。silent=true 用于后台重放等不应弹提示的请求
  _handleResponse(res, resolve, reject, silent) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const body = res.data;
      // 后端统一响应格式 { success, code, message, data }
      if (body.success !== false) {
        resolve(body.data !== undefined ? body.data : body);
      } else {
        if (!silent) wx.showToast({ title: fmtMsg(body.message, '请求失败'), icon: 'none' });
        hideLoading();
        reject(body);
      }
    } else if (res.statusCode === 401) {
      // token 过期,清除并跳转登录(并发 401 只处理一次)
      hideLoading();
      if (!redirecting) {
        redirecting = true;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
        this.globalData.token = '';
        this.globalData.userInfo = null;
        if (!silent) wx.showToast({ title: '登录已过期,请重新登录', icon: 'none' });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/login/login' });
          redirecting = false;
        }, 1000);
      }
      reject(res);
    } else {
      // 4xx 业务错误:优先展示后端返回的具体原因,避免只显示"服务器错误 400"
      const body = res.data || {};
      const msg = fmtMsg(body.message || body.msg, `服务器错误 ${res.statusCode}`);
      hideLoading();
      if (!silent) wx.showToast({ title: msg, icon: 'none', duration: 3000 });
      reject(res);
    }
  },

  // 直连后端(局域网 / 已备案 HTTPS 域名)
  _requestLocal(url, method, data, header, silent) {
    const fullUrl = url.startsWith('http') ? url : this.globalData.apiBase + url;
    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method,
        data,
        header,
        timeout: 15000,
        success: (res) => this._handleResponse(res, resolve, reject, silent),
        fail: (err) => {
          hideLoading();
          if (!silent) wx.showToast({ title: '网络异常,请稍后重试', icon: 'none' });
          reject(err);
        },
      });
    });
  },

  // 微信云托管调用(免域名白名单)
  _requestCloud(url, method, data, header, silent) {
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
        timeout: 15000,
        success: (res) => this._handleResponse(res, resolve, reject, silent),
        fail: (err) => {
          hideLoading();
          if (!silent) wx.showToast({ title: '网络异常,请稍后重试', icon: 'none' });
          reject(err);
        },
      });
    });
  },

  // 统一请求方法(带 token 自动注入 + 错误处理)
  request(options) {
    const { url, method = 'GET', data = {}, header = {}, silent = false } = options;
    const mergedHeader = Object.assign(
      {
        'Content-Type': 'application/json',
        'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : '',
      },
      header,
    );

    if (this.globalData.isCloud) {
      return this._requestCloud(url, method, data, mergedHeader, silent);
    }
    return this._requestLocal(url, method, data, mergedHeader, silent);
  },

  // 重放断网时暂存的打卡。后端 (studentId, weekStart) 唯一,重复提交返回 409,
  // 因此 409/400 可视为「已提交或数据无效」并安全丢弃;仅网络异常保留到下次重试。
  async replayPendingCheckins() {
    if (this._replaying || !this.globalData.token) return 0;
    let pending = wx.getStorageSync('pending_checkin') || [];
    if (!Array.isArray(pending) || pending.length === 0) return 0;
    this._replaying = true;
    const remain = [];
    let sent = 0;
    try {
      for (const item of pending) {
        if (!item || !item.payload) continue;
        try {
          await this.request({
            url: '/checkin/me/submit', method: 'POST', data: item.payload, silent: true,
          });
          sent++;
        } catch (e) {
          const code = e && (e.statusCode || e.code);
          if (code !== 409 && code !== 400) remain.push(item);
        }
      }
      wx.setStorageSync('pending_checkin', remain);
      if (sent > 0) wx.showToast({ title: `已补交 ${sent} 条打卡`, icon: 'none' });
    } finally {
      this._replaying = false;
    }
    return sent;
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
