import { io } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';

const MCP_SERVER_URL = "http://localhost:3000";
const socket = io(MCP_SERVER_URL);

const CLIENT_ID = "client_ask_assistant";
function requestData() {
    console.log(`[Client] Requesting assistent...`);
    var sessionId = "client_ask_assistant_" + uuidv4();
    socket.emit("message", {
        from: CLIENT_ID,
        to: "waylay_assistant_agent",
        data: { request: "askAgent", question: "run diagnostic test on the asset HVAC1", sessionId: sessionId },
    });
}

socket.on("connect", () => {
    console.log(`[Client] Connected as ${CLIENT_ID}`);
    socket.emit("register", { agentId: `${CLIENT_ID}` });
    requestData();
});

socket.on("message", (msg) => {
    console.log(`[Client] Received response:`, JSON.stringify(msg));
});

// Listen for broadcast messages
socket.on("broadcast", (data) => {
    console.log(`[Client] Received broadcast via WebSocket:`, data);
});

// Also connect to the SSE endpoint to receive broadcast events
(async () => {
    const response = await fetch(`${MCP_SERVER_URL}/events/${CLIENT_ID}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        console.log(`[Client] SSE update: ${text}`);
    }
})();