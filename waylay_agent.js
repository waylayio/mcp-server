import { io } from "socket.io-client";
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


class WaylayAgent {
    constructor(agentId, serverUrl, apiKey, apiSecret) {
        this.agentId = agentId;
        this.serverUrl = serverUrl;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.socket = io(serverUrl);
        this.capabilities = [
            {
                name: "runTemplate",
                description: "starts Waylay Template.",
                parameters: {
                    template: { type: "string", required: true, description: "The name of template." },
                    variables: { type: "object", required: false, description: "Template variables." }
                }
            },
            {
                name: "getTaskResult",
                description: "get Waylay Task Result.",
                parameters: {
                    id: { type: "string", required: true, description: "The task id." }
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
            if (msg.data.request === "runTemplate") {
                this.handleTemplateRequest(msg.from, msg.data.template, msg.data.variables);
            } else if (msg.data.request === "getTaskResult") {
                this.handleGetTaskRequest(msg.from, msg.data.id);
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

    async handleTemplateRequest(clientId, template, variables) {
        try {
            const result = await this.executeTemplate(template, variables);
            this.sendResponse(clientId, result.data);
        } catch (err) {
            this.sendResponse(clientId, { error: `Failed to run the template ${template}`, details: err.message });
        }
    }

    async executeTemplate(template, variables) {
        //console.log(`Received request: ${template} with variables:`, JSON.stringify(variables));
        const url = "https://api.waylay.io/rules/v1/tasks";
        const response = await axios.post(url, {
            template, name: "agent test:" + variables.resource, variables, type: "onetime",
            tags : {
                AiTool : "AiTool"
            },
        }, {
            auth: {
              username: this.apiKey,
              password: this.apiSecret
            },
            headers: {
              'Content-Type': 'application/json',
            },
          });
        return response;
    }

    async handleGetTaskRequest(clientId, id) {
        try {
            const result = await this.executeGetTask(id);
            this.sendResponse(clientId, result.data.taskOutput);
        } catch (err) {
            this.sendResponse(clientId, { error: `Failed to run the task ${id}`, details: err.message });
        }
    }

    async executeGetTask(id) {
        const url = `https://api.waylay.io/rules/v1/tasks/cf94de3a-5fe3-4d32-a622-586e1efba1ca?format=bn`

        //const url = `https://api.waylay.io/rules/v1/tasks/${id}?format=bn`;
        const response = await axios.get(url, {
            auth: {
              username: this.apiKey,
              password: this.apiSecret
            },
            headers: {
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
const WAYLAY_API_KEY = process.env.WAYLAY_API_KEY;
const WAYLAY_API_SECRET = process.env.WAYLAY_API_SECRET;
const agent = new WaylayAgent("waylay_agent", "http://localhost:3000", WAYLAY_API_KEY, WAYLAY_API_SECRET);