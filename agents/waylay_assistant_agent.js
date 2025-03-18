import { io } from "socket.io-client";
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


class WaylayAssistantAgent {
    constructor(agentId, serverUrl, agentUrl, apiSecret) {
        this.agentId = agentId;
        this.serverUrl = serverUrl;
        this.agentUrl = agentUrl;
        this.apiSecret = apiSecret;
        this.socket = io(serverUrl);
        this.capabilities = [
            {
                name: "askAgent",
                description: "starts Waylay Assistant Agent.",
                parameters: {
                    question: { type: "string", required: true, description: "Question to ask" },
                }
            }
        ];
        
        this.init();
    }

    async init() {
    
        this.socket.on("connect", () => {
            console.log(`[${this.agentId}] Connected to MCP Server`);
            this.register();
        });

        this.socket.on("message", async (msg) => {
            console.log(`[${this.agentId}] Received request:`, msg);
            if (msg.data.request === "askAgent") {
                this.handleRequest(msg.from, msg.data.question, msg.data.sessionId);
            }
        });

        this.socket.on("disconnect", () => {
            console.log(`[${this.agentId}] Disconnected`);
        });
    }

    register() {
        this.socket.emit("register", {
            agentId: this.agentId,
            capabilities: this.capabilities
        });
        console.log(`[${this.agentId}] Registered with capabilities: ` + JSON.stringify(this.capabilities));
    }

    async handleRequest(clientId, question, sessionId) {
        try {
            const result = await this.executeAgent(question, sessionId);
            this.sendResponse(clientId, result.data.response.content);
        } catch (err) {
            this.sendResponse(clientId, { error: `Failed to run the agent`, details: err.message });
        }
    }

    async executeAgent(question, sessionId) {
        console.log(`[${this.agentId}] Received request:`, question);
        const response = await axios.post(this.agentUrl, {
            question, sessionId
        }, {
            headers: {
                'Authorization': `hmac-sha256 ${this.apiSecret}`,
                'Content-Type': 'application/json', 
              },
          });
        return response;
    }

    sendResponse(clientId, data) {
        this.socket.emit("message", {
            from: this.agentId,
            to: clientId,
            data: data,
        });
        console.log(`[${this.agentId}] Sent result data to ${clientId}:`, data);
    }
}

// --- Start the agent ---
const WAYLAY_AGENT_URL = process.env.WAYLAY_AGENT_URL;
const WAYLAY_AGENT_SECRET = process.env.WAYLAY_AGENT_SECRET;
const agent = new WaylayAssistantAgent("waylay_assistant_agent", "http://localhost:3000", WAYLAY_AGENT_URL, WAYLAY_AGENT_SECRET);