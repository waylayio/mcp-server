import { io } from "socket.io-client";
import { RunnableSequence } from "@langchain/core/runnables";

const MCP_SERVER_URL = "http://localhost:3000";
const CLIENT_ID = "client_langchain";
const TIMEOUT_DURATION = 20000;
const LOOP_DURATION = 60000;
const TEMP_THRESHOLD = 0;
const HVAC_COUNT = 1; // Number of HVAC units to test

class LangChainClient {
    constructor() {
        this.socket = io(MCP_SERVER_URL);
        this.CLIENT_ID = CLIENT_ID;
        this.capabilities = [
            {
                name: "Execute LangChain flow",
                description: "starts Waylay Template."
            }
        ];
        this.socket.on("connect", async () => {
            console.log(`[Client] Connected as ${this.CLIENT_ID}`);
            this.socket.emit("register", {
                agentId: this.CLIENT_ID,
                capabilities: this.capabilities
            });
        });

        this.socket.on("message", (msg) => {
            console.log(`[Agent] Received message:`, msg);
        });

        this.socket.on("broadcast", (data) => {
            console.log(`[Client] Received broadcast via WebSocket:`, data);
        });
    }

    flow = RunnableSequence.from([
        async () => {
            const weather = await this.requestWeather();
            if (!weather || weather.temperature <= TEMP_THRESHOLD) {
                console.log(`[Client] Temperature is below threshold ${TEMP_THRESHOLD}. Exiting flow.`);
                return null; // Exit early
            }
            
            // Process all HVAC units
            const results = [];
            for (let i = 1; i <= HVAC_COUNT; i++) {
                const hvacId = `HVAC${i}`;
                console.log(`[Client] Processing ${hvacId}`);
                
                const metrics = await this.requestMetrics(hvacId);
                if (metrics) {
                    results.push({ weather, metrics, hvacId });
                }
            }
            
            return results.length > 0 ? results : null;
        },
        async (data) => {
            if (!data) return null; // Prevent calling processData on null
            
            // Process each HVAC unit's data
            const processedResults = [];
            for (const item of data) {
                const result = await this.processData({
                    weather: item.weather,
                    metrics: item.metrics,
                    hvacId: item.hvacId
                });
                if (result) {
                    processedResults.push({ result, hvacId: item.hvacId });
                }
            }
            
            return processedResults.length > 0 ? processedResults : null;
        },
        async (results) => {
            if (!results) return null;
            
            // Handle responses for each HVAC unit
            const finalResults = [];
            for (const item of results) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const response = await this.handleProcessDataResponse(item.result);
                if (response) {
                    finalResults.push({ ...response, hvacId: item.hvacId });
                }
            }
            
            return finalResults.length > 0 ? finalResults : null;
        }, 
        async (data) => {
            if (!data) return null;
            
            // Create work orders for HVACs that need attention
            const workOrders = [];
            for (const item of data) {
                if (item.isTheAlarmTriggered === 'TRUE') {
                    const order = await this.createWorkOrder(item);
                    if (order) {
                        workOrders.push(order);
                    }
                }
            }
            
            return workOrders.length > 0 ? workOrders : null;
        }, 
        async(orders) => {
            if (orders) {
                for (const order of orders) {
                    console.log("work order:", order);
                    this.socket.emit("message", {
                        from: this.CLIENT_ID,
                        to: "UX",
                        data: {
                            text: order
                        }
                    });
                }
            } else {
                console.log('nothing to do, all good');
            }
        }
    ]);

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

    async requestMetrics(hvacId) {
        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "waylay_agent",
            data: { request: "getLatestMetrics", resource: hvacId }
        }, "waylay_agent");
    }

    async processData({ weather, metrics, hvacId }) {
        if (!metrics) return null; // Skip processing if metrics are missing

        console.log(`[Client] Requesting to processData for ${hvacId}...`);
        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "waylay_agent",
            data: {
                request: "runTemplate",
                template: "HVAC_filter_check_V2",
                variables: {
                    currentTemperature: metrics.currentTemperature,
                    airflow: metrics.airflow,
                    energyUsage: metrics.energyUsage,
                    resource: hvacId,
                    outsideTemperature: weather.temperature,
                    city: weather.city
                }
            }
        }, "waylay_agent");
    }

    async handleProcessDataResponse(result) {
        if (!result) return;
        console.log(`[Client] Processed to handle response:`, result);

        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "waylay_agent",
            data: {
                request: "getTaskResult",
                id: result.ID
            }
        }, "waylay_agent");
    }

    async createWorkOrder(data) {
        return this.requestWithTimeout("message", {
            from: this.CLIENT_ID,
            to: "waylay_work_order_agent",
            data: { 
                request: "askAgent", 
                question: `create me a work order for ${data.hvacId}, description is ${data.description}, make it open case and assign it to veselin@waylay.io` 
            }
        }, "waylay_work_order_agent");
    }
}

const client = new LangChainClient();
setInterval(async () => {
    try {
        await client.flow.invoke();
    } catch (error) {
        console.error("Error in flow execution:", error);
    }
}, LOOP_DURATION);