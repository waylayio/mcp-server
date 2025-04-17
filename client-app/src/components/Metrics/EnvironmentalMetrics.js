import React from "react";
import { ACTIONS } from "../../constants/actions";

const EnvironmentalMetrics = ({
  energy,
  thermalStorage,
  action,
  workload,
  fanSpeed,
  airflow,
  handleTargetWorkloadChange
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Energy</h3>
          <p className="text-4xl font-light mt-2">
            {energy !== null ? `${parseFloat(energy).toFixed(1)} kWh` : "--"}
          </p>
        </div>

        <div className={`bg-white p-4 rounded-lg shadow ${
          action === ACTIONS.THERMAL_STORAGE_CHARGE ? 'bg-blue-50' :
            action === ACTIONS.THERMAL_STORAGE_DISCHARGE ? 'bg-orange-50' : ''
        }`}>
          <h3 className="text-lg font-medium text-gray-500">Thermal Storage</h3>
          <p className="text-4xl font-light mt-2">
            {thermalStorage !== null ? `${thermalStorage} kWh` : "--"}
          </p>
        </div>

        <div className={`bg-white p-4 rounded-lg shadow ${
          action === ACTIONS.THERMAL_STORAGE_CHARGE ? 'bg-blue-100' :
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-500">Workload</h3>
          <p className="text-4xl font-light mt-2">
            {workload !== null ? `${(workload * 100).toFixed(1)}%` : "--"}
          </p>
          <input
            type="range"
            min="0"
            max="100"
            value={workload * 100}
            onChange={(e) => handleTargetWorkloadChange(e.target.value)}
            className="w-full mt-4 cursor-pointer"
          />
        </div>

        <div className={`bg-white p-4 rounded-lg shadow ${
          action === ACTIONS.FAN_INCREMENT_SMALL ? 'bg-orange-50' :
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
      </div>
    </>
  );
};

export default EnvironmentalMetrics;