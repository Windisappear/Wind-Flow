# Infinite Canvas

本地优先的 AI 无限画布工作流。

## 启动

### Windows 环境

建议使用 Windows Terminal（PowerShell）安装长期支持版 Node.js 和 Docker Desktop：

```powershell
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

安装 Docker Desktop 后需要启动一次，并等待状态显示 Engine running。重新打开 PowerShell，使用 `node -v`、`pnpm -v` 和 `docker version` 检查环境。

### 项目服务

```powershell
pnpm install
docker compose up -d
pnpm --filter @canvas/web dev
pnpm --filter @canvas/api dev
```

前端默认运行在 http://localhost:5173，API 文档位于 http://localhost:3000/api/docs。

PostgreSQL、Redis 和 MinIO 可通过 `docker compose up -d` 启动。
