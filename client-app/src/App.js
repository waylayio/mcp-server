import { io } from "socket.io-client";
import React, { useState, useEffect, useCallback } from "react";
import { useDataProcessing } from "./hooks/useDataProcessing";
import AppHeader from "./components/AppHeader";
import CoreMetrics from "./components/Metrics/CoreMetrics";
import DataCenter3DContainer from "./components/DataCenter3DContainer";
import SystemActions from "./components/SystemActions";
import FailureRisk from "./components/Metrics/FailureRisk";
import EnvironmentalMetrics from "./components/Metrics/EnvironmentalMetrics";
import RackTemperaturesOverview from "./components/Overviews/RackTemperaturesOverview";
import RackTemperaturesChart from "./components/Charts/RackTemperaturesChart";
import UPSOverview from "./components/Overviews/UPSOverview";
import UPSCharts from "./components/Charts/UPSCharts";
import HVACOverview from "./components/Overviews/HVACOverview";
import HVACChart from "./components/Charts/HVACChart";
import MessageComponent from "./components/MessageComponent";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3000";

function App() {
  const [notification, setNotification] = useState(null);
  const [powerStatus, setPowerStatus] = useState(true);
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);  

  const {
    outsideTemp,
    currentTemp,
    targetTemp,
    action,
    rackTemperatures,
    hvacTemperatures,
    upsData,
    energy,
    workload,
    humidity,
    fanSpeed,
    airflow,
    failureRisk,
    pue,
    thermalStorage,
    outsideHumidity,
    alarmData,
    temperatureData,
    upsDataHistory,
    lastUpdated,
    setTargetTemp,
    setWorkload,
    processIncomingData
  } = useDataProcessing();

  const handleIncomingData = useCallback((msg) => {
    try {
      const notificationText = processIncomingData(msg);
      if (notificationText) {
        setNotification(notificationText);
      }
    } catch (err) {
      console.error("Error processing incoming data:", err);
    }
  }, [processIncomingData]);

useEffect(() => {
  const socketInstance = io(SOCKET_URL, {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    transports: ["websocket"],
    autoConnect: true
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

  // Set up basic event listeners (not including message handler)
  socketInstance.on("connect", onConnect);
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
  if (!socket) return;
  
  socket.on("message", handleIncomingData);
  
  return () => {
    socket.off("message", handleIncomingData);
  };
}, [socket, handleIncomingData]);

  const handlePowerCut = useCallback(() => {
    try {
      if (socket?.connected) {
        const newPowerStatus = !powerStatus;
        setPowerStatus(newPowerStatus);

        socket.emit("message", {
          from: "UX",
          to: "data_center",
          data: {
            request: newPowerStatus ? "powerOn" : "powerCut"
          },
        });

        setNotification(newPowerStatus ? "Power restored!" : "Power cut initiated!");
      }
    } catch (err) {
      console.error("Error sending power command:", err);
    }
  }, [socket, powerStatus]);

  const handleTargetTempChange = useCallback((value) => {
    try {
      const newTarget = Number(value);
      setTargetTemp(newTarget);

      if (socket?.connected) {
        socket.emit("message", {
          from: "UX",
          to: "data_center",
          data: { request: "setTemperature", value: newTarget },
        });
      }
    } catch (err) {
      console.error("Error setting target temperature:", err);
    }
  }, [socket, setTargetTemp]);

  const handleTargetWorkloadChange = useCallback((value) => {
    try {
      const newTarget = Number(value) / 100;
      setWorkload(newTarget);

      if (socket?.connected) {
        socket.emit("message", {
          from: "UX",
          to: "data_center",
          data: { request: "setWorkload", value: newTarget },
        });
      }
    } catch (err) {
      console.error("Error setting target workload:", err);
    }
  }, [socket, setWorkload]);

  useEffect(() => {
    if (!socket) return;

    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit("message", {
          from: "UX",
          to: "waylay_agent",
          data: {
            request: "getDataForMetric", 
            resource: "data_center",
            metric: "critical_HVAC_Temperature_Alarm", 
            period: 1, 
            aggregate: "sum", 
            grouping: "PT1M"
          },
        });
        socket.emit("message", {
          from: "UX",
          to: "waylay_agent",
          data: {
            request: "getDataForMetric", 
            resource: "data_center",
            metric: "criticalRackAlarm", 
            period: 1, 
            aggregate: "sum", 
            grouping: "PT1M"
          },
        });
        for (let i = 1; i < 5; i++) {
          socket.emit("message", {
            from: "UX",
            to: "waylay_agent",
            data: {
              request: "getDataForMetric", 
              resource: `UPS${i}`,
              metric: "Load_Percentage_ALARM", 
              period: 1, 
              aggregate: "sum", 
              grouping: "PT1M"
            }
          });
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [socket]);

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
      <AppHeader 
        connectionStatus={connectionStatus} 
        lastUpdated={lastUpdated} 
        error={error} 
        notification={notification}
        onAIAssistantClick={() => setShowAIChat(true)}
      />

      {showAIChat && (
        <MessageComponent 
          isOpen={showAIChat}
          onClose={() => setShowAIChat(false)} 
          socket={socket} 
        />
      )}

      <CoreMetrics 
        outsideTemp={outsideTemp}
        currentTemp={currentTemp}
        targetTemp={targetTemp}
        action={action}
        alarmData={alarmData}
        powerStatus={powerStatus}
        handlePowerCut={handlePowerCut}
        handleTargetTempChange={handleTargetTempChange}
      />

      <DataCenter3DContainer
        rackTemperatures={rackTemperatures}
        hvacTemperatures={hvacTemperatures}
        currentTemp={currentTemp}
        outsideTemp={outsideTemp}
        targetTemp={targetTemp}
        fanSpeed={fanSpeed}
        airflow={airflow}
        action={action}
        powerStatus={{ pdu: powerStatus, main: true, ups: true, generator: false }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <SystemActions action={action} />
        <FailureRisk failureRisk={failureRisk} />
      </div>

      <EnvironmentalMetrics 
        energy={energy}
        thermalStorage={thermalStorage}
        action={action}
        workload={workload}
        fanSpeed={fanSpeed}
        airflow={airflow}
        handleTargetWorkloadChange={handleTargetWorkloadChange}
      />

      <RackTemperaturesOverview rackTemperatures={rackTemperatures} />
      <RackTemperaturesChart temperatureData={temperatureData} rackTemperatures={rackTemperatures} />

      <UPSOverview upsData={upsData} />
      <UPSCharts upsData={upsData} upsDataHistory={upsDataHistory} />

      <HVACOverview hvacTemperatures={hvacTemperatures} />
      <HVACChart temperatureData={temperatureData} hvacTemperatures={hvacTemperatures} />
    </div>
  );
}

export default App;