import { io } from "socket.io-client";

class MetricsAgent {
    constructor(agentId, serverUrl) {
        this.agentId = agentId;
        this.serverUrl = serverUrl;
        this.socket = io(serverUrl);

        this.capabilities = [
            {
                name: "get_metrics",
                description: "Fetches all simulated metrics for a given asset.",
                parameters: {
                    assetName: {
                        type: "string",
                        required: true,
                        description: "The name of the asset to retrieve metrics for."
                    }
                },
                returns: {
                    temperature: { type: "number", description: "The simulated temperature in Celsius." },
                    air_pressure: { type: "number", description: "The simulated air pressure in hPa." },
                    airflow: { type: "number", description: "The simulated airflow in m³/s." },
                    energy: { type: "number", description: "The simulated energy consumption in kWh." }
                }
            },
                {
                    name: "get_thermostat_data",
                    description: "Fetches all simulated metrics for a given thermostat.",
                    parameters: {
                        assetName: {
                            type: "string",
                            required: true,
                            description: "The name of the thermostat to retrieve metrics for."
                        }
                    },
                    returns: {
                        temperature: { type: "number", description: "The simulated temperature in Celsius." },
                        humidity: { type: "number", description: "Humidity in %" }
                    }
                }
        ];

        this.init();
    }

    init() {
        this.socket.on("connect", () => {
            console.log(`[${this.agentId}] Connected to MCP Server`);
            this.register();
        });

        this.socket.on("message", async (msg) => {
            console.log(`[${this.agentId}] Received request:`, msg);
            if (msg.data?.request === "get_metrics") {
                this.handleMetricsRequest(msg.from, msg.data.assetName);
            } else if (msg.data?.request === "get_thermostat_data") {
                this.handleThermostatRequest(msg.from, msg.data.assetName);
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
        console.log(`[${this.agentId}] Registered with capabilities:`, JSON.stringify(this.capabilities, null, 2));
    }

    handleMetricsRequest(clientId, assetName) {
        if (!assetName) {
            this.sendResponse(clientId, { error: "Missing assetName parameter" });
            return;
        }

        const metricsData = this.generateMockMetrics(assetName);
        this.sendResponse(clientId, metricsData);
    }

    generateMockMetrics(assetName) {
        return {
            asset: assetName,
            temperature: { value: this.randomFloat(20, 40), unit: "°C" },
            air_pressure: { value: this.randomFloat(950, 1050), unit: "hPa" },
            airflow: { value: this.randomFloat(5, 10), unit: "m³/s" },
            energy: { value: this.randomFloat(50, 500), unit: "kWh" }
        };
    }

    handleThermostatRequest(clientId, assetName) {
        if (!assetName) {
            this.sendResponse(clientId, { error: "Missing assetName parameter" });
            return;
        }
        this.sendResponse(clientId, {
            asset: assetName,
            temperature: { value: this.randomFloat(15, 30), unit: "°C" },
            humidity: { value: this.randomFloat(30, 80), unit: "%" },
        });
    }


    sendResponse(clientId, data) {
        this.socket.emit("message", {
            from: this.agentId,
            to: clientId,
            data: data
        });
        console.log(`[${this.agentId}] Sent metrics data to ${clientId}:`, data);
    }

    randomFloat(min, max) {
        return parseFloat((Math.random() * (max - min) + min).toFixed(2));
    }
}

// --- Start the agent ---
const agent = new MetricsAgent("metrics_agent", "http://localhost:3000");

