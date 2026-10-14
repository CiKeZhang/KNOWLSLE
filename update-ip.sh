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
sed -i '' "s|apiBase: 'http://[^']*:3000/api'|apiBase: 'http://$IP:3000/api'|" "$CONFIG"

UPDATED=$(grep "apiBase:" "$CONFIG")
case "$UPDATED" in
  *"$IP:3000"*)
    echo "已更新: $UPDATED"
    echo "请重新编译小程序"
    ;;
  *)
    echo "更新失败,请手动修改 $CONFIG 中的 apiBase"
    exit 1
    ;;
esac
