// mcp_server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "redis";

class MCPServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, { cors: { origin: "*" } });
    this.agents = new Map();  // { agentId: socketId }
    this.clients = new Map(); // { clientId: response object }

    // Create Redis clients for publishing and subscribing
    this.redisPub = createClient();
    this.redisSub = createClient();
  }

  async init() {
    // Connect to Redis
    await this.redisPub.connect();
    await this.redisSub.connect();

    // Initialize all the modules
    this.initWebSocket();
    this.initRedisSubscription();
    this.initEndpoints();
  }

  initWebSocket() {
    this.io.on("connection", (socket) => {
      console.log(`WebSocket connected: ${socket.id}`);

      // Agent registration
      socket.on("register", (data) => {
        this.agents.set(data.agentId, socket.id);
        console.log(`Agent registered: ${data.agentId}` +  `, Agent capabilities: ` + JSON.stringify(data.capabilities));
      });

      // Handle incoming messages from agents or clients
      socket.on("message", async (msg) => {
        console.log(`Received message: ${JSON.stringify(msg)}`);
        // Publish the message to Redis for routing
        await this.redisPub.publish("agent_messages", JSON.stringify(msg));
      });

      socket.on("disconnect", () => {
        console.log(`WebSocket disconnected: ${socket.id}`);
        // Remove agent by matching socket id
        for (const [agentId, socketId] of this.agents.entries()) {
          if (socketId === socket.id) {
            this.agents.delete(agentId);
            break;
          }
        }
      });
    });
  }

  initRedisSubscription() {
    // Subscribe to Redis channel for messages
    this.redisSub.subscribe("agent_messages", (message) => {
      const msg = JSON.parse(message);
      const targetSocketId = this.agents.get(msg.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("message", msg);
      } else {
        console.log(`Agent ${msg.to} not found`);
      }
    });
  }

  initEndpoints() {
    // --- SSE Endpoint for Client Streaming ---
    this.app.get("/events/:clientId", (req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const clientId = req.params.clientId;
      this.clients.set(clientId, res);
      console.log(`SSE client connected: ${clientId}`);

      req.on("close", () => {
        this.clients.delete(clientId);
        res.end();
        console.log(`SSE client disconnected: ${clientId}`);
      });
    });

    // Discovery Endpoint: List available agents and their capabilities
    this.app.get("/agents", (req, res) => {
        const activeAgents = Array.from(this.agents.entries()).map(([agentId, info]) => ({
            agentId,
            capabilities: info.capabilities
        }));
        res.json({ activeAgents });
    });
      

    // --- Broadcast Endpoint ---
    this.app.post("/broadcast", (req, res) => {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Broadcast to all WebSocket clients
      this.io.emit("broadcast", { message });
      console.log(`Broadcasting via WebSocket: ${message}`);

      // Broadcast to all SSE clients
      for (const [clientId, clientRes] of this.clients.entries()) {
        clientRes.write(`data: ${JSON.stringify({ broadcast: message })}\n\n`);
      }
      console.log(`Broadcasting via SSE to ${this.clients.size} client(s)`);
      return res.json({ status: "Broadcast sent" });
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`MCP Server running on port ${this.port}`);
    });
  }
}

// --- Instantiate and Start the Server ---
(async () => {
  const server = new MCPServer(3000);
  await server.init();
  server.start();
})();