import React from "react";
import { ACTIONS } from "../constants/actions";

const SystemActions = ({ action }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">System Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-3 rounded-lg ${
          action === ACTIONS.COOL_INCREMENT_SMALL || action === ACTIONS.COOL_INCREMENT_LARGE ?
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

        <div className={`p-3 rounded-lg ${
          action === ACTIONS.COOL_DECREMENT_SMALL || action === ACTIONS.COOL_DECREMENT_LARGE ?
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

        <div className={`p-3 rounded-lg ${
          action === ACTIONS.FAN_INCREMENT_SMALL || action === ACTIONS.FAN_INCREMENT_LARGE ?
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

        <div className={`p-3 rounded-lg ${
          action === ACTIONS.THERMAL_STORAGE_CHARGE || action === ACTIONS.THERMAL_STORAGE_DISCHARGE ?
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
  );
};

export default SystemActions;