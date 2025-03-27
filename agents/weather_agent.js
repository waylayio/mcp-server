import { io } from "socket.io-client";
import { createClient } from 'redis';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

class WeatherAgent {
    constructor(agentId, serverUrl, weatherApiKey) {
        this.agentId = agentId;
        this.serverUrl = serverUrl;
        this.weatherApiKey = weatherApiKey;
        this.socket = io(serverUrl);
        this.capabilities = [
            {
                name: "get_weather",
                description: "Fetches the current weather for a given city.",
                parameters: {
                    city: { type: "string", required: true, description: "The name of the city to get weather for." }
                },
                returns: {
                    temperature: { type: "number", description: "The current temperature in Celsius." },
                    description: { type: "string", description: "A short description of the weather conditions." }
                }
            }
        ];
        this.redisClient = createClient();

        this.init();
    }

    async init() {
        // Connect to Redis
        await this.redisClient.connect().catch(console.error);

        this.socket.on("connect", () => {
            console.log(`[${this.agentId}] Connected to MCP Server`);
            this.register();
        });

        this.socket.on("message", async (msg) => {
            console.log(`[${this.agentId}] Received request:`, msg);
            if (msg.data?.request === "get_weather") {
                this.handleWeatherRequest(msg.from, msg.data.city);
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

    async handleWeatherRequest(clientId, city) {
        try {
            const weatherData = await this.fetchWeatherWithCache(city);
            this.sendResponse(clientId, weatherData);
        } catch (err) {
            this.sendResponse(clientId, { error: "Failed to fetch weather", details: err.message });
        }
    }

    async fetchWeatherWithCache(city) {
        const cacheKey = `weather:${city}`;
        const cachedData = await this.redisClient.get(cacheKey);
        if (cachedData) {
            console.log(`[${this.agentId}] Returning cached data for ${city}`);
            return JSON.parse(cachedData);
        }

        const weatherData = await this.fetchWeather(city);
        await this.redisClient.setEx(cacheKey, 300, JSON.stringify(weatherData)); // Cache for 5 minutes
        return weatherData;
    }

    async fetchWeather(city) {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${this.weatherApiKey}&units=metric`;
        const response = await axios.get(url);
        return {
            city: city,
            temperature: response.data.main.temp,
            humidity: response.data.main.humidity,
            description: response.data.weather[0].description,
        };
    }

    sendResponse(clientId, data) {
        this.socket.emit("message", {
            from: this.agentId,
            to: clientId,
            data: data,
        });
        console.log(`[${this.agentId}] Sent weather data to ${clientId}:`, data);
    }
}

// --- Start the agent ---
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const agent = new WeatherAgent("weather_agent", "http://localhost:3000", WEATHER_API_KEY);