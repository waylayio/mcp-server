import { io } from "socket.io-client";
import { RunnableSequence } from "@langchain/core/runnables";

const MCP_SERVER_URL = "http://localhost:3000";
const CLIENT_ID = "client_langchain";
const TIMEOUT_DURATION = 10000; 
const TEMP_THRESHOLD = 0

class LangChainClient {
    constructor() {
        this.socket = io(MCP_SERVER_URL);
        this.CLIENT_ID = CLIENT_ID;
        this.socket.on("connect", async () => {
            console.log(`[Client] Connected as ${this.CLIENT_ID}`);
            this.socket.emit("register", { agentId: this.CLIENT_ID });
            await this.flow.invoke();
        });

        this.socket.on("message", (msg) => {
            console.log(`[Agent] Received message:`, msg);
        });

        this.socket.on("broadcast", (data) => {
            console.log(`[Client] Received broadcast via WebSocket:`, data);
        });

        this.flow = RunnableSequence.from([
            async () => {
                const weather = await this.requestWeather();
                if (!weather || weather.temperature <= TEMP_THRESHOLD) {
                    console.log(`[Client] Temperature is below threshold ${TEMP_THRESHOLD}. Exiting flow.`);
                    return null; // Exit early
                }
                const metrics = await this.requestMetrics();
                return metrics ? { weather, metrics } : null;
            },
            async (data) => {
                if (!data) return null; // Prevent calling processData on null
                return this.processData(data);
            },
            async (result) => {
                if (!result) return null; // Prevent calling handleProcessDataResponse on null
                return this.handleProcessDataResponse(result);
            }
        ]);
    }

    async requestWithTimeout(event, requestData, expectedFrom) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error(`[Client] Request timed out:`, requestData);
                reject(new Error("Request timed out"));
            }, TIMEOUT_DURATION);

            this.socket.emit("message", requestData);
            this.socket.once("message", (msg) => {
                if (msg.from === expectedFrom) {
                    clearTimeout(timeout);
                    resolve(msg.data);
                }
            });
        });
    }

    async requestWeather() {
        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "weather_agent",
            data: { request: "get_weather", city: "Berlin" }
        }, "weather_agent");
    }

    async requestMetrics() {
        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "metrics_agent",
            data: { request: "get_metrics", assetName: "HVAC1" }
        }, "metrics_agent");
    }

    async processData({ weather, metrics }) {
        if (!metrics) return null; // Skip processing if metrics are missing

        console.log(`[Client] Requesting to processData...`);
        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "waylay_agent",
            data: {
                request: "runTemplate",
                template: "HVAC_filter_check_V2",
                variables: {
                    currentTemperature: metrics.temperature.value,
                    airflow: metrics.airflow.value,
                    energyUsage: metrics.energy.value,
                    resource: metrics.asset,
                    outsideTemperature: weather.temperature,
                    city: weather.city
                }
            }
        }, "waylay_agent");
    }

    async handleProcessDataResponse(result) {
        if (!result) return;
        console.log(`[Client] Processed to handle final response:`, result);
        if (result.ID) {
            this.socket.emit("message", {
                from: this.CLIENT_ID,
                to: "waylay_agent",
                data: { request: "getTaskResult", id: result.ID }
            });
        }
    }
}

const client = new LangChainClient();