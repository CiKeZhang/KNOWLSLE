// 小程序全局配置
module.exports = {
  // 后端 API 地址(部署时改为学院服务器公网/内网地址)
  // 注意:微信小程序要求后端域名必须在 mp.weixin.qq.com 后台配置 request 合法域名,且必须 HTTPS
  // 真机调试:手机与电脑需同一局域网(同一WiFi/手机热点),用电脑局域网IP
  // 模拟器调试用 localhost:
  apiBase: 'http://localhost:3000/api',
  // 学院专业列表(注册选择 + 按专业统计)
  majors: ['信息管理', '电子商务', '财务管理', '经济学', '市场营销'],
};
