import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as tools from './tools/index.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'task-server', version: '1.0.0' });

  server.tool('task_create', tools.taskCreate.schema, tools.taskCreate.handler);
  server.tool('task_get',    tools.taskGet.schema,    tools.taskGet.handler);
  server.tool('task_list',   tools.taskList.schema,   tools.taskList.handler);
  server.tool('task_update', tools.taskUpdate.schema, tools.taskUpdate.handler);

  return server;
}
