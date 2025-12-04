# 安装

```
cd vite-pdf
npm install
```

# 启动后端

```
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

# 启动前端

若在不同机器上启动，需要修改 vite.config.ts 中的 proxy 地址为后端机器的 IP 地址。
```
npm run dev
```