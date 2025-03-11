// weather_agent.js
const { io } = require("socket.io-client");
const axios = require("axios");
const { createClient } = require("redis");
require("dotenv").config();

const AGENT_ID = "weather_agent";
const MCP_SERVER_URL = "http://localhost:3000";
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Connect to Redis for caching
const redisClient = createClient();
redisClient.connect().catch(console.error);

const socket = io(MCP_SERVER_URL);

socket.on("connect", () => {
    console.log(`[${AGENT_ID}] Connected to MCP Server`);
    socket.emit("register", { agentId: AGENT_ID });
});

socket.on("message", async (msg) => {
    console.log(`[${AGENT_ID}] Received request:`, msg);

    if (msg.data.request === "get_weather") {
        try {
            const { city } = msg.data;
            const weatherData = await fetchWeatherWithCache(city);
            sendResponse(msg.from, weatherData);
        } catch (err) {
            sendResponse(msg.from, { error: "Failed to fetch weather", details: err.message });
        }
    }
});

// Check Redis cache before calling the API
async function fetchWeatherWithCache(city) {
    const cacheKey = `weather:${city}`;
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
        console.log(`[${AGENT_ID}] Returning cached data for ${city}`);
        return JSON.parse(cachedData);
    }
    // No cache available; fetch fresh data
    const weatherData = await fetchWeather(city);
    // Cache the data for 5 minutes (300 seconds)
    await redisClient.setEx(cacheKey, 300, JSON.stringify(weatherData));
    return weatherData;
}

async function fetchWeather(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
    const response = await axios.get(url);
    return {
        city: city,
        temperature: response.data.main.temp,
        description: response.data.weather[0].description,
    };
}

function sendResponse(clientId, data) {
    socket.emit("message", {
        from: AGENT_ID,
        to: clientId,
        data: data,
    });
}

