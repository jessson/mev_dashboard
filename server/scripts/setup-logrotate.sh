#!/bin/bash

# PM2 Logrotate 安装配置脚本
# 版本: 1.0
# 作者: MEV Dashboard Team
# 用法: chmod +x server/scripts/setup-logrotate.sh && ./server/scripts/setup-logrotate.sh

set -e  # 遇到错误立即退出

# 颜色输出函数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}🔄 PM2 Logrotate 配置脚本${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    # 检查PM2是否已安装
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2未安装，请先安装PM2"
        echo "npm install -g pm2"
        exit 1
    fi
    
    print_success "PM2已安装: $(pm2 --version)"
    
    # 检查Node.js版本
    node_version=$(node --version)
    print_success "Node.js版本: $node_version"
}

# 安装pm2-logrotate模块
install_logrotate() {
    print_info "安装pm2-logrotate模块..."
    
    # 检查是否已安装
    if pm2 list | grep -q "pm2-logrotate"; then
        print_warning "pm2-logrotate已安装，跳过安装步骤"
        return 0
    fi
    
    # 安装模块
    pm2 install pm2-logrotate
    
    # 等待安装完成
    sleep 3
    
    # 验证安装
    if pm2 list | grep -q "pm2-logrotate"; then
        print_success "pm2-logrotate安装成功"
    else
        print_error "pm2-logrotate安装失败"
        exit 1
    fi
}

# 配置环境选择
select_environment() {
    print_info "请选择环境配置:"
    echo "1) 开发环境 (5M, 7天, 无压缩)"
    echo "2) 测试环境 (10M, 14天, 压缩)"
    echo "3) 生产环境 (50M, 30天, 压缩)"
    echo "4) 高负载环境 (100M, 60天, 压缩)"
    echo "5) 自定义配置"
    echo ""
    
    while true; do
        read -p "请输入选择 (1-5): " env_choice
        case $env_choice in
            [1-5])
                break
                ;;
            *)
                print_warning "请输入有效选择 (1-5)"
                ;;
        esac
    done
    
    echo $env_choice
}

# 应用配置
apply_configuration() {
    local env_choice=$1
    
    print_info "应用配置..."
    
    case $env_choice in
        1)
            # 开发环境
            print_info "配置开发环境..."
            pm2 set pm2-logrotate:max_size 5M
            pm2 set pm2-logrotate:retain 7
            pm2 set pm2-logrotate:compress false
            pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
            ENV_NAME="开发环境"
            ;;
        2)
            # 测试环境
            print_info "配置测试环境..."
            pm2 set pm2-logrotate:max_size 10M
            pm2 set pm2-logrotate:retain 14
            pm2 set pm2-logrotate:compress true
            pm2 set pm2-logrotate:rotateInterval '0 1 * * *'
            ENV_NAME="测试环境"
            ;;
        3)
            # 生产环境
            print_info "配置生产环境..."
            pm2 set pm2-logrotate:max_size 50M
            pm2 set pm2-logrotate:retain 30
            pm2 set pm2-logrotate:compress true
            pm2 set pm2-logrotate:rotateInterval '0 2 * * *'
            ENV_NAME="生产环境"
            ;;
        4)
            # 高负载环境
            print_info "配置高负载环境..."
            pm2 set pm2-logrotate:max_size 100M
            pm2 set pm2-logrotate:retain 60
            pm2 set pm2-logrotate:compress true
            pm2 set pm2-logrotate:rotateInterval '0 3 * * *'
            ENV_NAME="高负载环境"
            ;;
        5)
            # 自定义配置
            print_info "自定义配置..."
            
            read -p "单个日志文件最大大小 (如: 10M, 100M, 1G): " max_size
            read -p "保留历史文件数量: " retain
            read -p "是否压缩旧文件 (true/false): " compress
            read -p "轮转时间 (cron格式，如 '0 2 * * *'): " rotate_time
            
            pm2 set pm2-logrotate:max_size $max_size
            pm2 set pm2-logrotate:retain $retain
            pm2 set pm2-logrotate:compress $compress
            pm2 set pm2-logrotate:rotateInterval "$rotate_time"
            ENV_NAME="自定义配置"
            ;;
    esac
    
    # 通用配置
    pm2 set pm2-logrotate:dateFormat 'YYYY-MM-DD_HH-mm-ss'
    pm2 set pm2-logrotate:rotateModule true
    pm2 set pm2-logrotate:workerInterval 30
    
    print_success "$ENV_NAME 配置完成"
}

# 验证配置
verify_configuration() {
    print_info "验证配置..."
    
    # 检查pm2-logrotate是否运行
    if pm2 list | grep -q "pm2-logrotate.*online"; then
        print_success "pm2-logrotate模块运行正常"
    else
        print_warning "pm2-logrotate模块未运行"
    fi
    
    # 显示当前配置
    echo ""
    print_info "当前配置:"
    pm2 conf pm2-logrotate | grep -E "(max_size|retain|compress|rotateInterval|dateFormat)" || true
}

# 创建日志目录
create_log_directory() {
    print_info "创建日志目录..."
    
    # 创建logs目录
    mkdir -p logs
    
    # 设置权限
    chmod 755 logs
    
    print_success "日志目录创建完成: ./logs/"
}

# 重新加载PM2进程
reload_pm2() {
    print_info "重新加载PM2配置..."
    
    # 重新加载日志
    pm2 reloadLogs
    
    # 如果有mev-server进程，重启它
    if pm2 list | grep -q "mev-server"; then
        print_info "重启mev-server进程..."
        pm2 restart mev-server
        print_success "mev-server进程重启完成"
    fi
}

# 显示使用说明
show_usage_instructions() {
    echo ""
    print_info "📚 使用说明:"
    echo ""
    echo "🔧 管理命令:"
    echo "  pm2 logs                    # 查看所有日志"
    echo "  pm2 logs mev-server         # 查看特定应用日志"
    echo "  pm2 flush                   # 清空所有日志"
    echo "  pm2 reloadLogs              # 重新加载日志"
    echo ""
    echo "🔄 日志轮转命令:"
    echo "  pm2 trigger pm2-logrotate rotate  # 强制立即轮转"
    echo "  pm2 conf pm2-logrotate            # 查看配置"
    echo ""
    echo "📁 日志文件位置:"
    echo "  ./logs/err.log              # 错误日志"
    echo "  ./logs/out.log              # 输出日志"
    echo "  ./logs/combined.log         # 合并日志"
    echo ""
    echo "📊 监控命令:"
    echo "  du -sh ./logs/              # 查看日志目录大小"
    echo "  ls -lh ./logs/              # 查看日志文件详情"
    echo "  pm2 monit                   # PM2监控界面"
}

# 主函数
main() {
    print_header
    
    # 检查依赖
    check_dependencies
    
    # 创建日志目录
    create_log_directory
    
    # 安装logrotate模块
    install_logrotate
    
    # 选择环境配置
    env_choice=$(select_environment)
    
    # 应用配置
    apply_configuration $env_choice
    
    # 验证配置
    verify_configuration
    
    # 重新加载PM2
    reload_pm2
    
    # 显示使用说明
    show_usage_instructions
    
    echo ""
    print_success "🎉 PM2 Logrotate配置完成！"
    echo ""
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 