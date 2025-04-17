import React from "react";
import { ACTIONS } from "../../constants/actions";

const CoreMetrics = ({
  outsideTemp,
  currentTemp,
  targetTemp,
  action,
  alarmData,
  powerStatus,
  handlePowerCut,
  handleTargetTempChange
}) => {
  const getAlarmColor = (count) => {
    if (count >= 10) return 'bg-red-100 border-red-300 text-red-800';
    if (count >= 5) return 'bg-orange-100 border-orange-300 text-orange-800';
    return 'bg-green-100 border-green-300 text-green-800';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-500">Outside Temperature</h3>
        <p className="text-4xl font-light mt-2">
          {outsideTemp !== null ? `${outsideTemp} °C` : "--"}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-500">Ambient Temperature</h3>
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
            <h3 className="text-lg font-medium text-gray-500">Target Ambient Temperature</h3>
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

      <div className={`p-4 rounded-lg border ${getAlarmColor(Math.max(alarmData.hvac, alarmData.rack, alarmData.ups))}`}>
        <h3 className="text-lg font-medium mb-2">Alarms (per minute)</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm">HVAC Alarms</p>
            <p className="text-xl font-bold">{alarmData.hvac}</p>
          </div>
          <div>
            <p className="text-sm">Rack Alarms</p>
            <p className="text-xl font-bold">{alarmData.rack}</p>
          </div>
          <div>
            <p className="text-sm">UPS Alarms</p>
            <p className="text-xl font-bold">{alarmData.ups}</p>
          </div>
        </div>
        {alarmData.lastUpdated && (
          <p className="text-xs mt-2 opacity-70">
            Last updated: {alarmData.lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>

      <button
        onClick={handlePowerCut}
        className={`p-3 rounded-lg border transition-colors ${powerStatus
          ? 'bg-green-100 border-green-300 hover:bg-green-200'
          : 'bg-red-100 border-red-300 hover:bg-red-200'
          }`}
      >
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-6 w-6 mr-2 ${powerStatus ? 'text-green-500' : 'text-red-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={powerStatus ? "M5 12h14M12 5l7 7-7 7" : "M13 10V3L4 14h7v7l9-11h-7z"}
            />
          </svg>
          <span>{powerStatus ? "PDU Power On" : "PDUs Power Cut"}</span>
        </div>
        <p className="text-sm mt-1">
          {powerStatus ? "System is powered on" : "Immediately cut all power"}
        </p>
      </button>
    </div>
  );
};

export default CoreMetrics;