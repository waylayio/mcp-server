const { io } = require("socket.io-client");

const MCP_SERVER_URL = "http://localhost:3000";
const socket = io(MCP_SERVER_URL);

const CLIENT_ID = "client_123";
const TIMEOUT_MS = 5000;

let receivedData = {
    weather: null,
    metrics: null
};
let timeoutHandle = null;

function resetTracking() {
    receivedData = { weather: null, metrics: null };
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
}

function requestData() {
    console.log(`[Client] Requesting weather and metrics data...`);
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

    // Start timeout window for response merging
    timeoutHandle = setTimeout(() => {
        console.log("[Client] Timeout: Did not receive both responses in time. Resetting...");
        resetTracking();
        requestData(); // Retry request
    }, TIMEOUT_MS);
}

socket.on("connect", () => {
    console.log(`[Client] Connected as ${CLIENT_ID}`);
    socket.emit("register", { agentId: `${CLIENT_ID}` });
    requestData();
});

socket.on("message", (msg) => {
    console.log(`[Client] Received response:`, msg);

    if (msg.from === "weather_agent") {
        receivedData.weather = msg.data;
    } else if (msg.from === "metrics_agent") {
        receivedData.metrics = msg.data;
    }

    if (receivedData.weather && receivedData.metrics) {
        console.log("[Client] Both events received within time, proceeding...");

        socket.emit("message", {
            from: CLIENT_ID,
            to: "waylay_agent",
            data: {
                request: "runTemplate",
                template: "HVAC_filter_check_V2",
                variables: {
                    currentTemperature: receivedData.metrics.temperature.value,
                    airflow: receivedData.metrics.airflow.value,
                    energyUsage: receivedData.metrics.energy.value,
                    resource: receivedData.metrics.asset
                }
            },
        });

        resetTracking();
        //setTimeout(requestData, 10000);
    }
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