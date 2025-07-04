#!/bin/bash

# PM2日志管理脚本
# 用法: ./server/scripts/manage-logs.sh [command]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_header() { echo -e "${CYAN}🔧 $1${NC}"; }

# 显示帮助信息
show_help() {
    echo ""
    print_header "PM2日志管理工具"
    echo ""
    echo "用法: ./server/scripts/manage-logs.sh [command]"
    echo ""
    echo "命令:"
    echo "  status      - 显示日志状态信息"
    echo "  size        - 显示日志文件大小"
    echo "  config      - 显示logrotate配置"
    echo "  rotate      - 强制轮转日志"
    echo "  clean       - 清空当前日志"
    echo "  archive     - 手动归档日志"
    echo "  monitor     - 实时监控日志大小"
    echo "  backup      - 备份日志文件"
    echo "  restore     - 恢复日志备份"
    echo "  help        - 显示此帮助信息"
    echo ""
}

# 显示日志状态
show_status() {
    print_header "📊 日志状态信息"
    echo ""
    
    # PM2进程状态
    print_info "PM2进程状态:"
    pm2 list
    echo ""
    
    # logrotate模块状态
    print_info "PM2-Logrotate模块状态:"
    if pm2 list | grep -q "pm2-logrotate"; then
        pm2 list | grep "pm2-logrotate"
        print_success "pm2-logrotate运行正常"
    else
        print_warning "pm2-logrotate未安装或未运行"
    fi
    echo ""
    
    # 日志文件存在性检查
    print_info "日志文件检查:"
    if [ -d "./logs" ]; then
        print_success "日志目录存在: ./logs/"
        ls -la ./logs/ 2>/dev/null || print_warning "日志目录为空"
    else
        print_warning "日志目录不存在"
    fi
}

# 显示日志文件大小
show_size() {
    print_header "📏 日志文件大小"
    echo ""
    
    if [ -d "./logs" ]; then
        print_info "日志目录总大小:"
        du -sh ./logs/
        echo ""
        
        print_info "各文件详细大小:"
        ls -lh ./logs/ | grep -v "^total"
        echo ""
        
        print_info "大文件报告 (>10MB):"
        find ./logs/ -name "*.log" -size +10M -exec ls -lh {} \; 2>/dev/null || print_info "没有超过10MB的日志文件"
    else
        print_warning "日志目录不存在"
    fi
    
    # PM2日志目录
    if [ -d "$HOME/.pm2/logs" ]; then
        echo ""
        print_info "PM2系统日志目录大小:"
        du -sh $HOME/.pm2/logs/
    fi
}

# 显示配置信息
show_config() {
    print_header "⚙️ Logrotate配置"
    echo ""
    
    if pm2 list | grep -q "pm2-logrotate"; then
        pm2 conf pm2-logrotate
    else
        print_warning "pm2-logrotate未安装"
        echo "运行以下命令安装: ./server/scripts/setup-logrotate.sh"
    fi
}

# 强制轮转日志
force_rotate() {
    print_header "🔄 强制轮转日志"
    echo ""
    
    if pm2 list | grep -q "pm2-logrotate"; then
        print_info "执行日志轮转..."
        pm2 trigger pm2-logrotate rotate
        print_success "日志轮转完成"
        
        # 显示轮转后的状态
        echo ""
        show_size
    else
        print_error "pm2-logrotate未安装，无法执行轮转"
    fi
}

# 清空当前日志
clean_logs() {
    print_header "🗑️ 清空日志"
    echo ""
    
    read -p "确定要清空所有当前日志吗? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        print_info "清空PM2日志..."
        pm2 flush
        
        print_info "清空本地日志文件..."
        if [ -d "./logs" ]; then
            rm -f ./logs/*.log
            print_success "本地日志文件已清空"
        fi
        
        print_success "所有日志已清空"
    else
        print_info "操作已取消"
    fi
}

# 手动归档日志
archive_logs() {
    print_header "📦 手动归档日志"
    echo ""
    
    # 创建归档目录
    archive_dir="./logs/archive/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$archive_dir"
    
    # 归档现有日志
    if [ -d "./logs" ] && [ "$(ls -A ./logs/*.log 2>/dev/null)" ]; then
        print_info "归档日志文件到: $archive_dir"
        
        # 复制并压缩日志文件
        for log_file in ./logs/*.log; do
            if [ -f "$log_file" ]; then
                filename=$(basename "$log_file")
                gzip -c "$log_file" > "$archive_dir/${filename}.gz"
                print_info "归档: $filename -> ${filename}.gz"
            fi
        done
        
        # 清空原日志文件
        pm2 flush
        
        print_success "日志归档完成: $archive_dir"
        print_info "归档大小: $(du -sh $archive_dir | cut -f1)"
    else
        print_warning "没有找到需要归档的日志文件"
    fi
}

# 实时监控日志大小
monitor_logs() {
    print_header "👁️ 实时监控日志大小"
    echo ""
    print_info "按 Ctrl+C 停止监控"
    echo ""
    
    while true; do
        clear
        echo -e "${CYAN}$(date)${NC}"
        echo "================================"
        
        if [ -d "./logs" ]; then
            du -sh ./logs/ 2>/dev/null || echo "日志目录为空"
            echo ""
            ls -lh ./logs/*.log 2>/dev/null | head -10 || echo "没有日志文件"
        else
            echo "日志目录不存在"
        fi
        
        echo ""
        echo "PM2进程内存使用:"
        pm2 list | grep "mev-server" || echo "mev-server未运行"
        
        sleep 5
    done
}

# 备份日志文件
backup_logs() {
    print_header "💾 备份日志文件"
    echo ""
    
    backup_dir="./backups/logs/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    print_info "创建备份目录: $backup_dir"
    
    # 备份本地日志
    if [ -d "./logs" ]; then
        cp -r ./logs/* "$backup_dir/" 2>/dev/null || print_warning "本地日志目录为空"
        print_success "本地日志已备份"
    fi
    
    # 备份PM2日志
    if [ -d "$HOME/.pm2/logs" ]; then
        mkdir -p "$backup_dir/pm2_logs"
        cp $HOME/.pm2/logs/mev-server* "$backup_dir/pm2_logs/" 2>/dev/null || print_warning "PM2日志为空"
        print_success "PM2日志已备份"
    fi
    
    # 压缩备份
    tar -czf "${backup_dir}.tar.gz" -C "$(dirname $backup_dir)" "$(basename $backup_dir)"
    rm -rf "$backup_dir"
    
    print_success "备份完成: ${backup_dir}.tar.gz"
    print_info "备份大小: $(du -sh ${backup_dir}.tar.gz | cut -f1)"
}

# 恢复日志备份
restore_logs() {
    print_header "🔄 恢复日志备份"
    echo ""
    
    if [ ! -d "./backups/logs" ]; then
        print_error "备份目录不存在: ./backups/logs"
        return 1
    fi
    
    print_info "可用的备份文件:"
    ls -lh ./backups/logs/*.tar.gz 2>/dev/null || {
        print_warning "没有找到备份文件"
        return 1
    }
    
    echo ""
    read -p "请输入要恢复的备份文件名: " backup_file
    
    if [ -f "./backups/logs/$backup_file" ]; then
        print_info "恢复备份: $backup_file"
        
        # 解压备份
        temp_dir=$(mktemp -d)
        tar -xzf "./backups/logs/$backup_file" -C "$temp_dir"
        
        # 恢复文件
        mkdir -p ./logs
        cp -r "$temp_dir"/*/* ./logs/ 2>/dev/null
        
        # 清理临时文件
        rm -rf "$temp_dir"
        
        print_success "日志备份恢复完成"
    else
        print_error "备份文件不存在: $backup_file"
    fi
}

# 主函数
main() {
    case "${1:-help}" in
        "status")
            show_status
            ;;
        "size")
            show_size
            ;;
        "config")
            show_config
            ;;
        "rotate")
            force_rotate
            ;;
        "clean")
            clean_logs
            ;;
        "archive")
            archive_logs
            ;;
        "monitor")
            monitor_logs
            ;;
        "backup")
            backup_logs
            ;;
        "restore")
            restore_logs
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 