# Task MCP Server

多人共用的 AI Agent Task 管理系統。讓 Claude Code 透過 MCP tools 直接操作共用任務清單。

## 架構

系統由兩個獨立服務組成，可分別部署：

```
[專案 A] ./mcp-server/task-management/  (MCP Server :3333)  ──┐
[專案 B] ./mcp-server/task-management/  (MCP Server :3333)  ──┤── HTTP ──► [DB Server :3334] ──► SQLite
[專案 C] ./mcp-server/task-management/  (MCP Server :3333)  ──┘
                  ↑                                                             ↑
           git submodule                                               Docker Compose
           .env 指向 DB Server                                         ./data/ volume 掛載
```

- **DB Server**：用 Docker Compose 集中部署，SQLite 資料透過 volume 持久化
- **MCP Server**：以 git submodule 加入各專案，透過 `.env` 指向 DB Server

---

## Part 1：DB Server（Docker Compose 集中部署）

DB Server 是所有人共用的資料庫服務，通常只需部署一次。

### 快速啟動

```bash
git clone <this-repo-url> task-management
cd task-management
mkdir -p data
docker compose up -d
```

SQLite 資料存放於 `./data/tasks.db`，掛載為 bind mount，`docker compose down` 或重建 image 均不會遺失。

### 常用維運指令

```bash
# 查看即時 log
docker compose logs -f

# 暫停（保留 container 狀態）
docker compose stop

# 停止並移除 container（./data/ 資料不受影響）
docker compose down

# 更新程式碼後重建並重啟
docker compose up -d --build
```

### 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DB_PORT` | `3334` | DB Server 監聽埠號 |

---

## Part 2：MCP Server（git submodule 加入專案）

每個需要 task 功能的專案各自安裝 MCP Server，透過 `.env` 連線到共用的 DB Server。

### 加入 submodule

```bash
# 在目標專案根目錄執行
git submodule add <this-repo-url> mcp-server/task-management
```

### 設定 .env

```bash
cd mcp-server/task-management
cp .env.example .env
```

編輯 `.env`，填入 DB Server 位置：

```env
PORT=3333
API_KEY=
DB_SERVER_URL=http://<db-server-ip>:3334
```

### 安裝、編譯、啟動

```bash
cd mcp-server/task-management
npm install && npm run build
npm run start:mcp
```

### 設定 .mcp.json

在目標**專案根目錄**建立（或編輯）`.mcp.json`：

```json
{
  "mcpServers": {
    "task-management": {
      "url": "http://localhost:3333/sse"
    }
  }
}
```

若有設定 `API_KEY`：

```json
{
  "mcpServers": {
    "task-management": {
      "url": "http://localhost:3333/sse?key=<your-api-key>"
    }
  }
}
```

重啟 Claude Code 後執行 `/mcp`，確認 `task-management` 狀態為 **connected**。

### MCP Server 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | `3333` | MCP Server 監聽埠號 |
| `API_KEY` | _(無)_ | 留空不驗證，設定後需在 SSE URL 帶 `?key=<value>` |
| `DB_SERVER_URL` | `http://localhost:3334` | DB Server 連線位置 |

---

## MCP Tools

| Tool | 說明 |
|------|------|
| `task_create` | 建立任務，自動產生 TASK-001 格式 ID |
| `task_get` | 取得單一任務詳情 |
| `task_list` | 列出任務，支援 `status` / `priority` / `assigned_to` 篩選 |
| `task_update` | 更新任務任意欄位 |

## 任務欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | TASK-001 格式，自動產生 |
| `title` | string | 任務標題 |
| `status` | `pending` \| `in_progress` \| `done` \| `blocked` | 狀態 |
| `priority` | `P0` \| `P1` \| `P2` | 優先級 |
| `assigned_to` | `claude` \| `copilot` \| `human` | 負責人 |
| `branch` | string | 對應 Git branch |
| `depends_on` | string[] | 前置任務 ID 清單 |
| `objective` | string | 任務目標說明 |
| `subtasks` | string | Markdown 格式子任務清單 |
| `impl_notes` | string | 實作備註 |
| `completion_notes` | string | 完成摘要 |

## 專案結構

```
.
├── Dockerfile              # DB Server image（多階段 build）
├── docker-compose.yml      # DB Server 部署設定，掛載 ./data/
├── .env.example            # MCP Server 環境變數範本
├── .dockerignore
├── .gitignore
├── data/                   # SQLite 資料目錄（gitignore，volume 掛載點）
│   └── tasks.db
└── src/
    ├── shared/
    │   └── types.ts        # 共用型別定義
    ├── db-server/
    │   ├── index.ts        # Express REST API (:3334)
    │   ├── db.ts           # SQLite CRUD
    │   └── id-generator.ts # TASK-001 ID 產生
    └── mcp-server/
        ├── index.ts        # Express SSE (:3333)，讀取 .env
        ├── mcp-server.ts   # MCP tools 註冊
        ├── db-client.ts    # HTTP client → DB Server
        └── tools/
            ├── task-create.ts
            ├── task-get.ts
            ├── task-list.ts
            └── task-update.ts
```
