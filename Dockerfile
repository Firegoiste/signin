# 使用 Node 20 官方镜像
FROM node:20-slim

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8080

# 设置工作目录
WORKDIR /app

# 复制 package.json
COPY package.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 暴露端口
EXPOSE 8080

# 启动服务器
CMD ["npm", "start"]
