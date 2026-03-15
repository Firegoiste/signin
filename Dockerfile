FROM node:20-slim

WORKDIR /app

# 先复制 package.json
COPY package.json ./

# 安装依赖
RUN npm install

# 复制其余文件
COPY . .

# 构建前端
RUN npm run build

# 暴露端口
EXPOSE 8080

# 启动服务器
CMD ["npm", "start"]
