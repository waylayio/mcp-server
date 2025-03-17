import { io } from "socket.io-client";
import { RunnableSequence } from "@langchain/core/runnables";

const MCP_SERVER_URL = "http://localhost:3000";
const CLIENT_ID = "client_langchain";

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
                return { weather: await this.requestWeather(), metrics: await this.requestMetrics() };
            },
            this.processData.bind(this),
            this.handleProcessDataResponse.bind(this)
        ]);
    }

    async requestWeather() {
        return new Promise((resolve) => {
            this.socket.emit("message", {
                from: this.CLIENT_ID,
                to: "weather_agent",
                data: { request: "get_weather", city: "Berlin" },
            });
            this.socket.once("message", (msg) => {
                if (msg.from === "weather_agent") resolve(msg.data);
            });
        });
    }

    async requestMetrics() {
        return new Promise((resolve) => {
            this.socket.emit("message", {
                from: this.CLIENT_ID,
                to: "metrics_agent",
                data: { request: "get_metrics", assetName: "HVAC1" },
            });
            this.socket.once("message", (msg) => {
                if (msg.from === "metrics_agent") resolve(msg.data);
            });
        });
    }

    async processData({ weather, metrics }) {
        console.log(`[Client] Requesting to processData...`);

        return new Promise((resolve) => {
            this.socket.emit("message", {
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
                },
            });
            this.socket.once("message", (msg) => {
                if (msg.from === "waylay_agent") resolve(msg.data);
            });
        });
    }

    async handleProcessDataResponse(result) {
        console.log(`[Client] Processed to handle final response:`, result);
        if(result.ID) {
            this.socket.emit("message", {
                from: this.CLIENT_ID,
                to: "waylay_agent",
                data: {
                    request: "getTaskResult",
                    id: result.ID
                },
            })
        }
        return result;
    }

    async listenForUpdates() {
        const response = await fetch(`${MCP_SERVER_URL}/events/${this.CLIENT_ID}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            console.log(`[Client] SSE update: ${decoder.decode(value)}`);
        }
    }
}

const client = new LangChainClient();
client.listenForUpdates();