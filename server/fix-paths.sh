#!/bin/bash

echo "修复TypeScript路径别名..."

# 对于 src/index.ts，将 @/ 替换为 ./
sed -i 's|@/|./|g' src/index.ts

# 对于子目录中的文件，将 @/ 替换为 ../
find src -mindepth 2 -name "*.ts" -type f -exec sed -i 's|@/|../|g' {} \;

echo "路径修复完成！"
echo "重新编译..."
npm run build

echo "完成！" 