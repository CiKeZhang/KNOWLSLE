#!/bin/bash
# 自动检测当前局域网 IP 并更新小程序配置
CONFIG="miniprogram/config.js"
IP=$(ifconfig en0 2>/dev/null | grep "inet " | awk '{print $2}')
if [ -z "$IP" ]; then
  IP=$(ifconfig en1 2>/dev/null | grep "inet " | awk '{print $2}')
fi
if [ -z "$IP" ]; then
  echo "未检测到局域网 IP，请检查网络连接"
  exit 1
fi
sed -i '' "s|http://[0-9.]*:3000/api|http://$IP:3000/api|" "$CONFIG"
echo "已更新 apiBase 为: http://$IP:3000/api"
echo "请重新编译小程序"
