import apiClient from './client';

/**
 * MCP API service
 * Handles MCP server configuration operations
 */
export const mcpService = {
  /**
   * Get MCP server configuration
   * @returns {Promise} MCP configuration
   */
  getConfig: async () => {
    const response = await apiClient.get('/mcp/config');
    return response.data;
  },

  /**
   * Update MCP server configuration
   * @param {Object} config - MCP configuration object
   * @returns {Promise} Update response
   */
  updateConfig: async (config) => {
    const response = await apiClient.post('/mcp/config', config, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  },

  /**
   * Transform server list to API format
   * @param {Array} servers - Array of server objects
   * @returns {Object} MCP servers configuration
   */
  transformServersToConfig: (servers) => {
    const mcpServers = {};

    servers.forEach(server => {
      if (server.enabled) {
        mcpServers[server.name] = {
          command: server.command,
          args: server.args.split(',').map(arg => arg.trim()).filter(arg => arg),
          env: server.env || {}
        };
      }
    });

    return { mcpServers };
  },

  /**
   * Transform API config to server list format
   * @param {Object} config - API configuration
   * @returns {Array} Array of server objects
   */
  transformConfigToServers: (config) => {
    return Object.entries(config.mcpServers || {}).map(([name, serverConfig]) => ({
      name,
      command: serverConfig.command,
      args: serverConfig.args?.join(', ') || '',
      env: serverConfig.env || {},
      enabled: true
    }));
  }
};

export default mcpService;
