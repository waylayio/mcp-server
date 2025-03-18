import { io } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';

const MCP_SERVER_URL = "http://localhost:3000";
const CLIENT_ID = "client_ask_assistant"

class AssistantClient {
    constructor(request = "askAgent", question = "run diagnostic test on the asset HVAC1") {
        this.clientId = CLIENT_ID
        this.request = request;
        this.question = question;
        this.socket = io(MCP_SERVER_URL);
        this.initializeSocket();
        this.listenForUpdates();
    }

    initializeSocket() {
        this.socket.on("connect", () => {
            console.log(`[Client] Connected as ${this.clientId}`);
            this.socket.emit("register", { agentId: this.clientId });
            this.requestData();
        });

        this.socket.on("message", (msg) => {
            console.log(`[Client] Received response:`, JSON.stringify(msg));
        });

        this.socket.on("broadcast", (data) => {
            console.log(`[Client] Received broadcast via WebSocket:`, data);
        });
    }

    requestData() {
        console.log(`[Client] Requesting assistant...`);
        const sessionId = `${this.clientId}_${uuidv4()}`;
        this.socket.emit("message", {
            from: this.clientId,
            to: "waylay_assistant_agent",
            data: { request: this.request, question: this.question, sessionId },
        });
    }

    async listenForUpdates() {
        try {
            const response = await fetch(`${MCP_SERVER_URL}/events/${this.clientId}`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                console.log(`[Client] SSE update: ${decoder.decode(value)}`);
            }
        } catch (error) {
            console.error("[Client] Error listening for SSE updates:", error);
        }
    }
}

const assistantClient = new AssistantClient("askAgent", "run diagnostic test on the asset HVAC1");
