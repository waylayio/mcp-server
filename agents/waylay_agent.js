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
            },
            {
                name: "getLatestMetrics",
                description: "getLatestMetrics.",
                parameters: {
                    resource: { type: "string", required: true, description: "The resource id." }
                }
            },
            {
                name: "storeData",
                description: "StoreData",
                parameters: {
                    resource: { type: "string", required: true, description: "The resource id." },
                    data: { type: "object", required: true, description: "Data payload" }
                }
            },
            {
                name: "getDataForMetric",
                description: "Get data metric",
                parameters: {
                    resource: { type: "string", required: true, description: "The resource id." },
                    metric: { type: "string", required: true, description: "metric" },
                    period: { type: "string", required: true, description: "from" },
                    grouping: { type: "string", required: true, description: "grouping" },
                    aggregate: { type: "string", required: true, description: "aggregate" }
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
            if (msg.data?.request === "runTemplate") {
                this.handleTemplateRequest(msg.from, msg.data.template, msg.data.variables);
            } else if (msg.data?.request === "getTaskResult") {
                this.handleGetTaskRequest(msg.from, msg.data.id);
            } else if (msg.data?.request === "getLatestMetrics") {
                this.handleGetLatestMetrics(msg.from, msg.data.resource);
            } else if (msg.data?.request === "storeData") {
                this.handleStoreData(msg.from, msg.data.resource, msg.data.data);
            } else if (msg.data?.request === "getDataForMetric") {
                this.handleGetDataForMetric(msg.from, msg.data.resource, 
                    msg.data.metric, msg.data.period, msg.data.aggregate, msg.data.grouping);
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
            this.sendResponse(clientId, { error: `Failed to get the task ${id}`, details: err.message });
        }
    }

    async executeGetTask(id) {
        const url = `https://api.waylay.io/rules/v1/tasks/${id}?format=bn`;
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

    async handleGetLatestMetrics(clientId, resource) {
        try {
            const result = await this.executeLatestMetrics(resource);
            this.sendResponse(clientId, result.data);
        } catch (err) {
            this.sendResponse(clientId, { error: `Failed to get the task ${resource}`, details: err.message });
        }
    }

    async executeLatestMetrics(resource) {
        const url = `https://api.waylay.io/data/v1/messages/${resource}/current`;
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

    async handleStoreData(clientId, resource, payload) {
        try {
            const result = await this.executeStoreData(resource, payload);
            this.sendResponse(clientId, result.data);
        } catch (err) {
            this.sendResponse(clientId, { error: `Failed to store data for ${resource}`, details: err.message });
        }
    }

    async executeStoreData(resource, data) {
        console.log("executeStoreData", resource, data)
        const url = `https://api.waylay.io/data/v1/events/${resource}`;
        const response = await axios.post(url, data, {
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

    async handleGetDataForMetric(clientId, resource, metric, period, aggregate, grouping) {
        try {
            const result = await this.executeGetLatestMetrics(resource, metric, period, aggregate, grouping);
            this.sendResponse(clientId, result.data);
        } catch (err) {
            this.sendResponse(clientId, { error: `Failed to get data for ${resource}`, details: err.message });
        }
    }

    //period in minutes
    async executeGetLatestMetrics(resource, metric, period, aggregate, grouping) {
        console.log("executeGetLatestMetrics", resource, metric, period, aggregate, grouping);
        const from = new Date() - period * 60 * 1000;
        const url = `https://api.waylay.io/data/v1/series/${resource}/${metric}?from=${from}&aggregate=${aggregate}&grouping=${grouping}`;
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