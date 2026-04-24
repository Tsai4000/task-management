# Task MCP Server — 安裝指南（給 AI 執行）

這份文件是給 AI Agent 閱讀的安裝指引。請依照用戶的需求選擇執行 Part 1 或 Part 2，或兩者皆執行。

---

## Part 1：安裝 DB Server（Docker Compose）

DB Server 是所有人共用的資料庫服務，通常只需部署一次。SQLite 資料透過 bind mount 持久化到本機 `./data/`，container 重建後資料不遺失。

### 前置確認

請先向用戶確認：
- 要部署在哪台機器？（本機 / 遠端 VM）
- DB Server 要使用哪個 port？（預設 3334）
- 該機器是否已安裝 Docker 與 Docker Compose？

### 步驟

**1. Clone 專案**

```bash
git clone <repo-url> task-management
cd task-management
```

**2. 建立資料目錄**

```bash
mkdir -p data
```

此目錄會被掛載進 container，SQLite 檔案將存放於此。確認它已在 `.gitignore` 中（預設已有）。

**3. 啟動 DB Server**

```bash
docker compose up -d
```

Docker 會自動建置 image 並在背景啟動。若需指定不同 port：

```bash
DB_PORT=3335 docker compose up -d
```

**4. 確認狀態**

```bash
docker compose ps
```

`task-db` 的 Status 應為 `Up`，Health 應為 `healthy`（約 30 秒後）。

**5. 驗證 API 可用**

```bash
curl http://localhost:3334/tasks
```

應回傳 `[]`（空陣列）。記下 DB Server 的對外位置（例如 `http://192.168.1.100:3334`），Part 2 會用到。

### 常用維運指令

```bash
# 查看即時 log
docker compose logs -f task-db

# 暫停（可用 docker compose start 恢復）
docker compose stop

# 停止並移除 container（./data/ 資料不受影響）
docker compose down

# 更新程式碼後重建並重啟
docker compose up -d --build
```

---

## Part 2：將 MCP Server 加入專案

MCP Server 使用 stdio 模式，Claude Code 會在需要時自動 spawn process，**不需要手動啟動或管理 server**。透過 `.mcp.json` 的 `env` 欄位傳入 DB Server 位置。

### 前置確認

請先向用戶確認：
- 目標專案的根目錄路徑
- DB Server 的連線位置（Part 1 記下的，或由用戶提供）

### 步驟

**1. 加入 git submodule**

在目標專案的根目錄執行：

```bash
git submodule add <repo-url> mcp-server/task-management
```

**2. 安裝依賴並編譯**

```bash
cd mcp-server/task-management
npm install
npm run build
```

確認 `dist/mcp-server/index.js` 存在。

**3. 設定 .mcp.json**

回到**目標專案根目錄**，建立或編輯 `.mcp.json`：

```json
{
  "mcpServers": {
    "task-management": {
      "command": "node",
      "args": ["./mcp-server/task-management/dist/mcp-server/index.js"],
      "env": {
        "DB_SERVER_URL": "http://<db-server-ip>:3334"
      }
    }
  }
}
```

將 `<db-server-ip>` 替換為 Part 1 記下的 DB Server 位置。若 DB Server 在本機則填 `localhost`。

**4. 重啟 Claude Code（或其他 MCP client）**

**5. 驗證連線**

請用戶在 Claude Code 執行：

1. 執行 `/mcp`，確認 `task-management` 狀態為 **connected**
2. 呼叫 `task_create`，title 填 `"安裝測試"` → 預期回傳含 `"id": "TASK-001"` 的 JSON
3. 呼叫 `task_list` → 確認看到剛建立的任務
4. 呼叫 `task_update`，將 TASK-001 的 status 改為 `in_progress`
5. 呼叫 `task_get`，確認 status 已更新

---

## 常見問題排查

| 問題 | 可能原因 | 解法 |
|------|----------|------|
| `/mcp` 顯示 disconnected | `dist/` 不存在或路徑錯誤 | 確認已執行 `npm run build`，檢查 `.mcp.json` 的 `args` 路徑 |
| `DB Server error 404` | DB Server 未啟動 | 先完成 Part 1，確認 container 狀態為 `Up` |
| `fetch failed` | `DB_SERVER_URL` 無法連線 | 確認 `.mcp.json` 的 `env.DB_SERVER_URL`，檢查防火牆是否開放 3334 port |
| 編譯錯誤 | Node.js 版本過舊 | 升級至 Node.js 18+ |
| submodule 目錄是空的 | clone 後未初始化 | 執行 `git submodule update --init` |
| container health 一直 `starting` | 初始化中或有錯誤 | 執行 `docker compose logs task-db` 查看原因 |
| `data/tasks.db` 權限錯誤 | container user 與本機 user 不同 | 執行 `chmod 777 data/` 或 `chown -R $(id -u):$(id -g) data/` |
