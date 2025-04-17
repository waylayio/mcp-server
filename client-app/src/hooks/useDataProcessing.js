import { useState, useCallback } from "react";
import { MAX_DATA_POINTS } from "../constants/actions";

export const useDataProcessing = () => {
  const [outsideTemp, setOutsideTemp] = useState(null);
  const [currentTemp, setCurrentTemp] = useState(null);
  const [targetTemp, setTargetTemp] = useState(20);
  const [action, setAction] = useState(null);
  const [rackTemperatures, setRackTemperatures] = useState(Array(12).fill(null));
  const [hvacTemperatures, setHvacTemperatures] = useState(Array(12).fill(null));
  const [upsData, setUpsData] = useState([]);
  const [energy, setEnergy] = useState(null);
  const [workload, setWorkload] = useState(0.5);
  const [humidity, setHumidity] = useState(null);
  const [fanSpeed, setFanSpeed] = useState(null);
  const [airflow, setAirflow] = useState(null);
  const [failureRisk, setFailureRisk] = useState(null);
  const [pue, setPue] = useState(null);
  const [thermalStorage, setThermalStorage] = useState(null);
  const [outsideHumidity, setOutsideHumidity] = useState(null);
  const [alarmData, setAlarmData] = useState({
    hvac: 0,
    rack: 0,
    ups: 0,
    lastUpdated: null
  });
  const [temperatureData, setTemperatureData] = useState([]);
  const [upsDataHistory, setUPSDataHistory] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const addDataPoint = useCallback((newData, currentRackTemperatures, currentHvacTemperatures, currentUpsData) => {
    const time = new Date().toLocaleTimeString();
    setLastUpdated(new Date());

    const upsLoadData = {};
    if (currentUpsData?.length) {
      currentUpsData.forEach((ups, index) => {
        upsLoadData[`ups${index + 1}Load`] = ups.Load_Percentage;
        upsLoadData[`ups${index + 1}SOC`] = ups.State_of_Charge;
        upsLoadData[`ups${index + 1}Battery_Voltage`] = ups.Battery_Voltage_V;
        upsLoadData[`ups${index + 1}Output_Voltage`] = ups.Output_Voltage_V;
      });
    }

    setTemperatureData(prevData => {
      const newDataPoint = {
        time,
        ...newData.temperatureMetrics,
        ...currentRackTemperatures.reduce((acc, temp, index) => {
          acc[`rackTemp${index}`] = temp;
          return acc;
        }, {}),
        ...currentHvacTemperatures.reduce((acc, temp, index) => {
          acc[`hvacTemp${index}`] = temp;
          return acc;
        }, {})
      };
      return [...prevData.slice(-MAX_DATA_POINTS), newDataPoint];
    });

    setUPSDataHistory(prevData => {
      const newUPSPoint = { time, ...upsLoadData };
      return [...prevData.slice(-MAX_DATA_POINTS), newUPSPoint];
    });
  }, []);

  const processIncomingData = useCallback((msg) => {
    if (!msg?.data) return;
    if (msg.data.text) return msg.data.text;
    if (msg.from === 'AI_AGENT') {
      return null; // Let MessageComponent handle these
    }

    const now = new Date();

    // Alarm metrics
    const metric = msg.data.query?.metric;
    if (metric) {
      const total = msg.data.series.reduce((acc, [, val]) => acc + (val ?? 0), 0);
      setAlarmData(prev => ({
        ...prev,
        [metric === "critical_HVAC_Temperature_Alarm" ? "hvac" :
         metric === "criticalRackAlarm" ? "rack" :
         metric === "Load_Percentage_ALARM" ? "ups" : null]: total,
        lastUpdated: now
      }));
      return;
    }

    // Action & general temps
    const { ambientTemp, targetTemp, outsideTemperature, outsideHumidity } = msg.data;
    if (msg.action !== undefined) setAction(msg.action);
    if (ambientTemp !== undefined) setCurrentTemp(parseFloat(ambientTemp).toFixed(1));
    if (targetTemp !== undefined) setTargetTemp(parseFloat(targetTemp).toFixed(1));
    if (outsideTemperature !== undefined) setOutsideTemp(parseFloat(outsideTemperature).toFixed(1));
    if (outsideHumidity !== undefined) setOutsideHumidity(parseFloat(outsideHumidity).toFixed(1));

    // Rack & HVAC temps
    const newRackTemps = Array.isArray(msg.data.rackTemperatures)
      ? msg.data.rackTemperatures.map(t => t != null ? parseFloat(t).toFixed(1) : 0)
      : rackTemperatures;
    setRackTemperatures(newRackTemps);

    const newHvacTemps = Array.isArray(msg.data.hvacTemperatures)
      ? msg.data.hvacTemperatures.map(t => t != null ? parseFloat(t).toFixed(1) : 0)
      : hvacTemperatures;
    setHvacTemperatures(newHvacTemps);

    // UPS
    const newUPS = Array.isArray(msg.data.upsData) ? msg.data.upsData : upsData;
    if (Array.isArray(msg.data.upsData)) setUpsData(newUPS);

    // Environment metrics
    if (msg.data.energy !== undefined) setEnergy(parseFloat(msg.data.energy));
    if (msg.data.workload !== undefined) setWorkload(parseFloat(msg.data.workload));
    if (msg.data.humidity !== undefined) setHumidity(parseFloat(msg.data.humidity));
    if (msg.data.fanSpeed !== undefined) setFanSpeed(parseFloat(msg.data.fanSpeed));
    if (msg.data.airflow !== undefined) setAirflow(parseFloat(msg.data.airflow));
    if (msg.data.failureRisk !== undefined) setFailureRisk(parseFloat(msg.data.failureRisk));
    if (msg.data.pue !== undefined) setPue(parseFloat(msg.data.pue));
    if (msg.data.thermalStorage !== undefined) setThermalStorage(parseFloat(msg.data.thermalStorage));

    // Add to history
    addDataPoint({
      temperatureMetrics: {
        temperature: ambientTemp,
        setTemperature: targetTemp,
        outsideTemperature,
        outsideHumidity
      }
    }, newRackTemps, newHvacTemps, newUPS);
  }, [addDataPoint, rackTemperatures, hvacTemperatures, upsData]);

  return {
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
  };
};
