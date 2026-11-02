// 小程序全局配置
// 运行模式: 'auto' 按版本自动切换(开发版直连,体验版/正式版走云托管)
//           'local' 强制直连后端地址; 'cloud' 强制微信云托管
module.exports = {
  mode: 'auto',

  // 后端 API 地址(mode=local 时生效)
  // 注意:微信小程序要求后端域名必须在 mp.weixin.qq.com 后台配置 request 合法域名,且必须 HTTPS
  // 真机调试:手机与电脑需同一局域网(同一WiFi/手机热点),用电脑局域网IP
  // 模拟器调试用 localhost:
  apiBase: 'http://172.20.10.2:3000/api',

  // 微信云托管配置(mode=cloud 时生效)
  // cloudEnv: 云开发环境ID,在小程序后台「云开发」控制台查看,形如 prod-1a2b3c4d
  // cloudService: 云托管服务名称,创建服务时填写的名字
  cloudEnv: '',
  cloudService: 'kygl-backend',

  // 学院专业列表(注册选择 + 按专业统计)
  majors: ['信息管理', '电子商务', '财务管理', '经济学', '市场营销'],
};
