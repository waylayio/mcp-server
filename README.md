# mcp-server
testing MCP server implementation
Uses websockets for agent communication, HTTP to connect new clients, and REDIS for server pub/sub as well for client caching (which is just a test). 
Server also sends SSE changes to the client and you can also broadcast messages to all clients via SSE - if that is ever needed

