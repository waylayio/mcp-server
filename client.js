const { io } = require("socket.io-client");

const MCP_SERVER_URL = "http://localhost:3000";
const socket = io(MCP_SERVER_URL);

const CLIENT_ID = "client_123";

socket.on("connect", () => {
    console.log(`[Client] Connected as ${CLIENT_ID}`);
    // Example: sending a message to a specific agent
    socket.emit("register", { agentId: `${CLIENT_ID}`});
    socket.emit("message", {
        from: CLIENT_ID,
        to: "weather_agent",
        data: { request: "get_weather", city: "Berlin" },
    });
    socket.emit("message", {
        from: CLIENT_ID,
        to: "metrics_agent",
        data: { request: "get_metrics", assetName: "HVAC1" },
    });
});

// Listen for direct responses
socket.on("message", (msg) => {
    console.log(`[Client] Received response:`, msg);
});

// Listen for broadcast messages via WebSocket
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