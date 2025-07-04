#!/bin/bash

# 数据库迁移脚本
# 用法: ./run-migration.sh [旧数据库路径]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认路径
DEFAULT_OLD_DB="./data/old_mev.db"
DEFAULT_NEW_DB="./data/mev.db"

# 获取参数
OLD_DB_PATH=${1:-$DEFAULT_OLD_DB}

echo -e "${BLUE}🚀 MEV数据库迁移工具${NC}"
echo -e "${BLUE}=====================${NC}"
echo ""

# 检查Node.js和tsx
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: Node.js 未安装${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ 错误: npx 未安装${NC}"
    exit 1
fi

# 检查旧数据库文件
if [ ! -f "$OLD_DB_PATH" ]; then
    echo -e "${RED}❌ 错误: 旧数据库文件不存在: $OLD_DB_PATH${NC}"
    echo -e "${YELLOW}💡 请确保提供正确的旧数据库路径${NC}"
    echo ""
    echo "用法:"
    echo "  ./run-migration.sh [旧数据库路径]"
    echo ""
    echo "示例:"
    echo "  ./run-migration.sh ./backup/old_mev.db"
    echo "  ./run-migration.sh /path/to/old/database.db"
    exit 1
fi

# 备份提醒
echo -e "${YELLOW}⚠️  重要提醒:${NC}"
echo -e "${YELLOW}  1. 请确保已备份旧数据库文件${NC}"
echo -e "${YELLOW}  2. 迁移过程中请勿中断程序${NC}"
echo -e "${YELLOW}  3. 如果新数据库已存在，重复记录将被跳过${NC}"
echo ""

# 确认
read -p "是否继续迁移? [y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️  迁移已取消${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}📋 迁移信息:${NC}"
echo -e "  旧数据库: ${YELLOW}$OLD_DB_PATH${NC}"
echo -e "  新数据库: ${YELLOW}$DEFAULT_NEW_DB${NC}"
echo ""

# 设置环境变量
export OLD_DATABASE_PATH="$OLD_DB_PATH"
export DATABASE_PATH="$DEFAULT_NEW_DB"

# 确保scripts目录存在且有执行权限
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SCRIPT="$SCRIPT_DIR/migrate-database.ts"

if [ ! -f "$MIGRATE_SCRIPT" ]; then
    echo -e "${RED}❌ 错误: 迁移脚本不存在: $MIGRATE_SCRIPT${NC}"
    exit 1
fi

# 检查依赖
echo -e "${BLUE}🔧 检查依赖...${NC}"
cd "$(dirname "$SCRIPT_DIR")"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: 未找到 package.json${NC}"
    exit 1
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装依赖...${NC}"
    npm install
fi

# 运行迁移
echo -e "${GREEN}🚀 开始迁移...${NC}"
echo ""

# 使用tsx运行TypeScript脚本
if npx tsx "$MIGRATE_SCRIPT"; then
    echo ""
    echo -e "${GREEN}✅ 迁移完成！${NC}"
    echo ""
    echo -e "${BLUE}📊 建议操作:${NC}"
    echo -e "  1. 检查新数据库中的数据是否正确"
    echo -e "  2. 运行应用程序进行功能测试"
    echo -e "  3. 确认无误后删除旧数据库备份"
    echo ""
else
    echo ""
    echo -e "${RED}❌ 迁移失败！${NC}"
    echo -e "${YELLOW}💡 请检查错误信息并重试${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 迁移流程完成！${NC}" 