#!/bin/bash

# 环境变量设置脚本
# 用于快速配置前端 API 地址

echo "🚀 MEV 监控系统 - 环境配置脚本"
echo "=================================="

# 检查是否存在现有的环境变量文件
if [ -f ".env.local" ]; then
    echo "⚠️  发现现有的 .env.local 文件"
    read -p "是否覆盖现有配置？(y/N): " overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo "❌ 取消配置"
        exit 0
    fi
fi

echo ""
echo "请选择部署环境："
echo "1) 开发环境 (localhost:3000)"
echo "2) 生产环境 - 自动检测域名"
echo "3) 自定义 API 地址"

read -p "请输入选项 (1-3): " choice

case $choice in
    1)
        API_URL="http://localhost:3000"
        echo "✅ 已设置为开发环境"
        ;;
    2)
        echo ""
        read -p "请输入您的域名 (例: example.com): " domain
        if [ -z "$domain" ]; then
            echo "❌ 域名不能为空"
            exit 1
        fi
        
        echo "请选择协议："
        echo "1) HTTP"
        echo "2) HTTPS"
        read -p "请选择 (1-2): " protocol_choice
        
        if [ "$protocol_choice" = "2" ]; then
            protocol="https"
        else
            protocol="http"
        fi
        
        echo "请选择端口配置："
        echo "1) API 在 3000 端口"
        echo "2) 使用 Nginx 反向代理 (无需端口)"
        read -p "请选择 (1-2): " port_choice
        
        if [ "$port_choice" = "1" ]; then
            API_URL="${protocol}://${domain}:3000"
        else
            API_URL="${protocol}://${domain}"
        fi
        
        echo "✅ 已设置为生产环境: $API_URL"
        ;;
    3)
        echo ""
        read -p "请输入完整的 API 地址 (例: https://api.example.com): " custom_url
        if [ -z "$custom_url" ]; then
            echo "❌ API 地址不能为空"
            exit 1
        fi
        API_URL="$custom_url"
        echo "✅ 已设置自定义 API 地址: $API_URL"
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

# 创建 .env.local 文件
cat > .env.local << EOF
# MEV 监控系统环境配置
# 生成时间: $(date)

# API 基础地址
VITE_API_BASE_URL=$API_URL

# 其他配置项（可选）
# VITE_NODE_ENV=production
# VITE_DEBUG=false
EOF

echo ""
echo "✅ 环境配置完成！"
echo "📁 配置文件: .env.local"
echo "🔧 API 地址: $API_URL"
echo ""
echo "接下来的步骤："
echo "1. 运行 'npm run build' 构建前端"
echo "2. 将 dist 目录部署到服务器"
echo "3. 确保后端 API 服务器正在运行"
echo "4. 访问前端页面测试连接"
echo ""
echo "💡 如需修改配置，可直接编辑 .env.local 文件或重新运行此脚本" 