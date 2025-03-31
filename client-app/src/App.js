import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import MarkdownRenderer from './MarkdownRenderer';

const ACTIONS = {
  COOL_INCREMENT_SMALL: 0,
  COOL_DECREMENT_SMALL: 1,
  FAN_INCREMENT_SMALL: 2,
  COOL_INCREMENT_LARGE: 3,
  COOL_DECREMENT_LARGE: 4,
  FAN_INCREMENT_LARGE: 5,
  MAINTAIN: 6,
  THERMAL_STORAGE_CHARGE: 7,
  THERMAL_STORAGE_DISCHARGE: 8
};

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3000";
const MAX_DATA_POINTS = 100;
const DATA_RETENTION_MS = 15 * 60 * 1000; // 15 minutes data retention

function App() {
  // Socket state
  const [socket, setSocket] = useState(null);
  
  // Temperature states
  const [outsideTemp, setOutsideTemp] = useState(null);
  const [currentTemp, setCurrentTemp] = useState(null);
  const [targetTemp, setTargetTemp] = useState(20);
  const [action, setAction] = useState(null);
  const [rackTemperatures, setRackTemperatures] = useState(Array(10).fill(null));
  const [notification, setNotification] = useState(null);

  // Environmental metrics states
  const [energy, setEnergy] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [fanSpeed, setFanSpeed] = useState(null);
  const [airflow, setAirflow] = useState(null);
  const [failureRisk, setFailureRisk] = useState(null);
  const [pue, setPue] = useState(null);
  const [thermalStorage, setThermalStorage] = useState(null);
  const [outsideHumidity, setOutsideHumidity] = useState(null);

  // Data history states
  const [temperatureData, setTemperatureData] = useState([]);
  const [envData, setEnvData] = useState([]);

  // System states
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Clean up old data points periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTemperatureData(prev => prev.filter(point => 
        now - new Date(point.time).getTime() < DATA_RETENTION_MS
      ));
      setEnvData(prev => prev.filter(point => 
        now - new Date(point.time).getTime() < DATA_RETENTION_MS
      ));
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const addDataPoint = useCallback((newData, currentRackTemperatures) => {
    const time = new Date().toLocaleTimeString();
    setLastUpdated(new Date());
  
    setTemperatureData((prevData) => {
      const newDataPoint = {
        time,
        ...newData.temperatureMetrics,
        ...currentRackTemperatures.reduce((acc, temp, index) => {
          acc[`rackTemp${index}`] = temp;
          return acc;
        }, {})
      };
      return [...prevData.slice(-MAX_DATA_POINTS), newDataPoint];
    });
  
    setEnvData((prevData) => {
      const newEnvPoint = {
        time,
        ...newData.envMetrics,
      };
      return [...prevData.slice(-MAX_DATA_POINTS), newEnvPoint];
    });
  }, []);

  const handleIncomingData = useCallback((msg) => {
    try {
      if (!msg.data) {
        throw new Error("Invalid message format: missing data");
      }
  
      if (msg.data.text) {
        setNotification(msg.data.text);
      }
  
      const temperatureMetrics = {
        temperature: msg.data.ambientTemp,
        setTemperature: msg.data.targetTemp,
        outsideTemperature: msg.data.outsideTemperature,
        outsideHumidity: msg.data.outsideHumidity
      };
  
      if (msg.action !== undefined) setAction(msg.action);
  
      if (temperatureMetrics.temperature) setCurrentTemp(parseFloat(temperatureMetrics.temperature).toFixed(1));
      if (temperatureMetrics.setTemperature) setTargetTemp(parseFloat(temperatureMetrics.setTemperature).toFixed(1));
      if (temperatureMetrics.outsideTemperature) setOutsideTemp(parseFloat(temperatureMetrics.outsideTemperature).toFixed(1));
      if (temperatureMetrics.outsideHumidity) setOutsideHumidity(parseFloat(temperatureMetrics.outsideHumidity).toFixed(1));
  
      // Process rack temperatures
      let newRackTemperatures = rackTemperatures;
      if (msg.data.rackTemperatures && Array.isArray(msg.data.rackTemperatures)) {
        newRackTemperatures = msg.data.rackTemperatures.map(temp =>
          temp !== null ? parseFloat(temp).toFixed(1) : 0
        );
        setRackTemperatures(newRackTemperatures);
      }
  
      const envMetrics = {
        energy: msg.data.energy ? parseFloat(msg.data.energy) : energy,
        workload: msg.data.workload ? parseFloat(msg.data.workload) : workload,
        humidity: msg.data.humidity ? parseFloat(msg.data.humidity) : humidity,
        fanSpeed: msg.data.fanSpeed ? parseFloat(msg.data.fanSpeed) : fanSpeed,
        airflow: msg.data.airflow ? parseFloat(msg.data.airflow) : airflow,
        failureRisk: msg.data.failureRisk ? parseFloat(msg.data.failureRisk) : failureRisk,
        pue: msg.data.pue ? parseFloat(msg.data.pue) : pue,
        thermalStorage: msg.data.thermalStorage ? parseFloat(msg.data.thermalStorage) : thermalStorage
      };
  
      if (msg.data.energy) setEnergy(envMetrics.energy);
      if (msg.data.workload) setWorkload(envMetrics.workload);
      if (msg.data.humidity) setHumidity(envMetrics.humidity);
      if (msg.data.fanSpeed) setFanSpeed(envMetrics.fanSpeed);
      if (msg.data.airflow) setAirflow(envMetrics.airflow);
      if (msg.data.failureRisk) setFailureRisk(envMetrics.failureRisk);
      if (msg.data.pue) setPue(envMetrics.pue);
      if (msg.data.thermalStorage) setThermalStorage(envMetrics.thermalStorage);
  
      addDataPoint({
        temperatureMetrics,
        envMetrics
      }, newRackTemperatures);
    } catch (err) {
      console.error("Error processing incoming data:", err);
      setError(`Data processing error: ${err.message}`);
    }
  }, [addDataPoint, energy, workload, humidity, fanSpeed, airflow, failureRisk, pue, thermalStorage]);
 
  const handleTargetTempChange = useCallback((value) => {
    try {
      const newTarget = Number(value);
      setTargetTemp(newTarget);

      if (socket && socket.connected) {
        socket.emit("message", {
          from: "UX",
          to: "data_center",
          data: { request: "setTemperature", value: newTarget },
        });
      }
    } catch (err) {
      console.error("Error setting target temperature:", err);
      setError(`Failed to set temperature: ${err.message}`);
    }
  }, [socket]);

  // Socket connection management
  useEffect(() => {
    const socketInstance = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: ["websocket"],
      autoConnect: false
    });

    const onConnect = () => {
      console.log("[Client] Connected to socket server");
      setConnectionStatus("connected");
      setError(null);
      socketInstance.emit("register", { agentId: "UX", capabilities: ["monitoring"] });
    };

    const onDisconnect = (reason) => {
      console.log("[Client] Disconnected:", reason);
      setConnectionStatus("disconnected");
      if (reason === "io server disconnect") {
        // Server forced disconnect - need to manually reconnect
        setTimeout(() => socketInstance.connect(), 1000);
      }
    };

    const onConnectError = (err) => {
      console.error("[Client] Connection error:", err);
      setConnectionStatus("error");
      setError(`Connection error: ${err.message}`);
    };

    const onReconnectAttempt = (attempt) => {
      console.log(`[Client] Reconnection attempt ${attempt}`);
      setConnectionStatus(`reconnecting (attempt ${attempt})`);
    };

    const onReconnectFailed = () => {
      console.error("[Client] Reconnection failed");
      setConnectionStatus("failed");
      setError("Failed to reconnect to server");
    };

    // Set up event listeners
    socketInstance.on("connect", onConnect);
    socketInstance.on("message", handleIncomingData);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("connect_error", onConnectError);
    socketInstance.on("reconnect_attempt", onReconnectAttempt);
    socketInstance.on("reconnect_failed", onReconnectFailed);

    // Connect after setting up listeners
    socketInstance.connect();
    setSocket(socketInstance);

    return () => {
      // Clean up event listeners
      socketInstance.off("connect", onConnect);
      socketInstance.off("message", handleIncomingData);
      socketInstance.off("disconnect", onDisconnect);
      socketInstance.off("connect_error", onConnectError);
      socketInstance.off("reconnect_attempt", onReconnectAttempt);
      socketInstance.off("reconnect_failed", onReconnectFailed);
      
      // Disconnect socket
      if (socketInstance.connected) {
        socketInstance.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div className="p-6 font-sans max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Data Center Monitoring</h1>
            <div className="flex items-center mt-2">
              <span className={`inline-block w-3 h-3 rounded-full mr-2 ${connectionStatus === "connected" ? "bg-green-500" :
                connectionStatus === "error" ? "bg-red-500" : "bg-yellow-500"
                }`}></span>
              <span className="text-sm">
                {connectionStatus === "connected" ? "Connected" :
                  connectionStatus === "error" ? "Connection Error" : "Connecting..."}
              </span>
              {lastUpdated && (
                <span className="text-sm text-gray-500 ml-4">
                  Last update: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          {/* <div className="bg-white p-2 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Outside Humidity</h3>
            <p className="text-xl font-light">
              {outsideHumidity !== null ? `${outsideHumidity}%` : "--"}
            </p>
          </div> */}

          <div className="bg-white p-2 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-500">PUE</h4>
          <p className="text-3xl font-light mt-2">
            {pue !== null ? pue.toFixed(2) : "--"}
          </p>
          </div>

        </div>
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}
        {notification && (
          <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg max-w-md animate-fade-in">
            <MarkdownRenderer content={notification} />
          </div>
        )}
      </header>

      {/* Core Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Outside</h3>
          <p className="text-4xl font-light mt-2">
            {outsideTemp !== null ? `${outsideTemp} °C` : "--"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Ambient</h3>
          <p className="text-4xl font-light mt-2">
            {currentTemp !== null ? `${currentTemp} °C` : "--"}
          </p>
        </div>

        <div className={`bg-white p-4 rounded-lg shadow ${action === ACTIONS.COOL_INCREMENT_SMALL ? 'bg-blue-50' :
          action === ACTIONS.COOL_DECREMENT_SMALL ? 'bg-orange-50' :
            action === ACTIONS.COOL_INCREMENT_LARGE ? 'bg-blue-200' :
              action === ACTIONS.COOL_DECREMENT_LARGE ? 'bg-orange-200' : ''
          }`}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-500">Target</h3>
              <p className="text-4xl font-light mt-2">{targetTemp} °C</p>
            </div>
          </div>
          <input
            type="range"
            min="18"
            max="28"
            value={targetTemp}
            onChange={(e) => handleTargetTempChange(e.target.value)}
            className="w-full mt-4 cursor-pointer"
          />
        </div>
      </div>

      {/* System Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">System Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg ${action === ACTIONS.COOL_INCREMENT_SMALL || action === ACTIONS.COOL_INCREMENT_LARGE ?
              'bg-blue-100 border border-blue-300' : 'bg-gray-50'
              }`}>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span>Cooling</span>
              </div>
              <p className="text-sm mt-1">
                {action === ACTIONS.COOL_INCREMENT_SMALL ? "Small increase" :
                  action === ACTIONS.COOL_INCREMENT_LARGE ? "Large increase" : "Inactive"}
              </p>
            </div>

            <div className={`p-3 rounded-lg ${action === ACTIONS.COOL_DECREMENT_SMALL || action === ACTIONS.COOL_DECREMENT_LARGE ?
              'bg-orange-100 border border-orange-300' : 'bg-gray-50'
              }`}>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                <span>Fan Reduce</span>
              </div>
              <p className="text-sm mt-1">
                {action === ACTIONS.COOL_DECREMENT_SMALL ? "Small decrease" :
                  action === ACTIONS.COOL_DECREMENT_LARGE ? "Large decrease" : "Inactive"}
              </p>
            </div>

            <div className={`p-3 rounded-lg ${action === ACTIONS.FAN_INCREMENT_SMALL || action === ACTIONS.FAN_INCREMENT_LARGE ?
              'bg-green-100 border border-green-300' : 'bg-gray-50'
              }`}>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6m0 0L3 9m4-5l4 5m6 0v6m0-6v-6m0 0l-4 5m4 5l-4-5" />
                </svg>
                <span>Fan Boost</span>
              </div>
              <p className="text-sm mt-1">
                {action === ACTIONS.FAN_INCREMENT_SMALL ? "Small increase" :
                  action === ACTIONS.FAN_INCREMENT_LARGE ? "Large increase" : "Inactive"}
              </p>
            </div>

            <div className={`p-3 rounded-lg ${action === ACTIONS.THERMAL_STORAGE_CHARGE || action === ACTIONS.THERMAL_STORAGE_DISCHARGE ?
              'bg-purple-100 border border-purple-300' : 'bg-gray-50'
              }`}>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Thermal Storage</span>
              </div>
              <p className="text-sm mt-1">
                {action === ACTIONS.THERMAL_STORAGE_CHARGE ? "Charging" :
                  action === ACTIONS.THERMAL_STORAGE_DISCHARGE ? "Discharging" : "Inactive"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Failure Risk</h2>
          <div className="flex flex-col h-full justify-between">
            <p className="text-4xl font-light">
              {failureRisk !== null ? `${(failureRisk * 100).toFixed(1)}%` : "--"}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
              <div
                className={`h-4 rounded-full ${failureRisk < 0.3 ? 'bg-green-500' :
                  failureRisk < 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                style={{ width: `${(failureRisk * 100) || 0}%` }}
              ></div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                {failureRisk < 0.3 ? "Low risk - Normal operation" :
                  failureRisk < 0.7 ? "Medium risk - Monitor closely" :
                    "High risk - Immediate attention required"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rack Temperatures Overview */}
      <div className="bg-white p-4 rounded-lg shadow mb-8">
        <h3 className="text-lg font-medium text-gray-500 mb-2">Rack Temperatures Overview</h3>
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500 mb-3">
          <span>15°C (Cool)</span>
          <span>20°C</span>
          <span>30°C (Hot)</span>
        </div>
        <div className="w-full h-3 rounded-full mt-1 mb-4 bg-gradient-to-r from-blue-200 via-blue-100 to-orange-200"></div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {rackTemperatures.map((temp, index) => {
            const tempValue = temp !== null ? parseFloat(temp) : 15;
            const normalizedTemp = Math.min(Math.max(tempValue, 15), 30);
            const ratio = (normalizedTemp - 15) / 15;

            const r = Math.round(191 + (254 - 191) * ratio);
            const g = Math.round(219 + (215 - 219) * ratio);
            const b = Math.round(254 + (170 - 254) * ratio);
            const bgColor = `rgb(${r}, ${g}, ${b})`;

            return (
              <div
                key={`rack-overview-${index}`}
                className="p-2 border rounded transition-all duration-300"
                style={{
                  backgroundColor: bgColor,
                  borderColor: `rgba(120, 120, 120, 0.2)`
                }}
              >
                <div className="text-sm font-medium text-gray-800">Rack {index + 1}</div>
                <div className="text-xl text-gray-800">
                  {temp !== null ? `${temp} °C` : "--"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Environmental Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Energy</h3>
          <p className="text-4xl font-light mt-2">
            {energy !== null ? `${energy} kWh` : "--"}
          </p>
        </div>

        {/* <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Humidity</h3>
          <p className="text-4xl font-light mt-2">
            {humidity !== null ? `${humidity}%` : "--"}
          </p>
        </div> */}

        <div className={`bg-white p-4 rounded-lg shadow ${
          action === ACTIONS.THERMAL_STORAGE_CHARGE ? 'bg-blue-50' :
          action === ACTIONS.THERMAL_STORAGE_DISCHARGE ? 'bg-orange-50' : ''
        }`}>
          <h3 className="text-lg font-medium text-gray-500">Thermal Storage</h3>
          <p className="text-4xl font-light mt-2">
            {thermalStorage !== null ? `${thermalStorage} kWh` : "--"}
          </p>
        </div>

        <div className={`bg-white p-4 rounded-lg shadow ${action === ACTIONS.THERMAL_STORAGE_CHARGE ? 'bg-blue-100' :
          action === ACTIONS.THERMAL_STORAGE_DISCHARGE ? 'bg-orange-100' : ''
          }`}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-500">Thermal Storage Status</h3>
              <p className="text-4xl font-light mt-2">
                {action === ACTIONS.THERMAL_STORAGE_CHARGE ? "Charging" :
                  action === ACTIONS.THERMAL_STORAGE_DISCHARGE ? "Discharging" : "Idle"}
              </p>
            </div>
            {action === ACTIONS.THERMAL_STORAGE_CHARGE && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            {action === ACTIONS.THERMAL_STORAGE_DISCHARGE && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
              </svg>
            )}
          </div>
        </div>

      </div>

      {/* Fan and Airflow Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        
      <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Workload</h3>
          <p className="text-4xl font-light mt-2">
            {workload !== null ? `${(workload * 100).toFixed(1)}%` : "--"}
          </p>
        </div>

        <div className={`bg-white p-4 rounded-lg shadow ${action === ACTIONS.FAN_INCREMENT_SMALL ? 'bg-orange-50' :
          action === ACTIONS.FAN_INCREMENT_LARGE ? 'bg-orange-200' : ''
          }`}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium text-gray-500">Fan Speed</h3>
              <p className="text-4xl font-light mt-2">
                {fanSpeed !== null ? `${fanSpeed}%` : "--"}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Airflow</h3>
          <p className="text-4xl font-light mt-2">
            {airflow !== null ? `${airflow} CFM` : "--"}
          </p>
        </div>

        {/* <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Outside Humidity</h3>
          <p className="text-4xl font-light mt-2">
            {outsideHumidity !== null ? `${outsideHumidity} %` : "--"}
          </p>
        </div> */}

      </div>

      {/* Temperature Chart */}
      <div className="bg-white p-4 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Temperature History</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={temperatureData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickMargin={10} />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 12 }} tickMargin={10} />
              <Tooltip
                formatter={(value, name) => [
                  name === "Outside" ? `${value} °C` :
                    name === "Target" ? `${value} °C` : `${value} °C`,
                  name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')
                ]}
                labelFormatter={(time) => `Time: ${time}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="temperature"
                name="Current"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="setTemperature"
                name="Target"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="outsideTemperature"
                name="Outside"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rack Temperatures Chart */}
      <div className="bg-white p-4 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Rack Temperatures</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={temperatureData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickMargin={10} />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 12 }} tickMargin={10} />
              <Tooltip
                formatter={(value, name) => [`${value} °C`, name]}
                labelFormatter={(time) => `Time: ${time}`}
              />
              <Legend />
              {rackTemperatures.map((_, index) => (
                <Line
                  key={`rack-${index}`}
                  type="monotone"
                  dataKey={`rackTemp${index}`}
                  name={`Rack ${index + 1}`}
                  stroke={`hsl(${index * 36}, 70%, 50%)`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Environmental Metrics Chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Environmental Metrics</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={envData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} tickMargin={10} />
              <YAxis tick={{ fontSize: 12 }} tickMargin={10} />
              <Tooltip
                formatter={(value, name) => [
                  name === "Energy" ? `${value} kWh` :
                    name === "Airflow" ? `${value} CFM` : 
                    name === "PUE" ? value.toFixed(3) : `${value} %`,
                  name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')
                ]}
                labelFormatter={(time) => `Time: ${time}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="energy"
                name="Energy"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="workload"
                name="Workload"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                name="Humidity"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="fanSpeed"
                name="Fan Speed"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="airflow"
                name="Airflow"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="failureRisk"
                name="Failure Risk"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="pue"
                name="PUE"
                stroke="#6b7280"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;