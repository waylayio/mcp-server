import React from "react";

const UPSOverview = ({ upsData }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-8">
      <h2 className="text-xl font-semibold mb-4">UPS Status</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {upsData.map((ups, index) => (
          <div key={`ups-card-${index}`} className="border rounded-lg p-3">
            <h3 className="font-medium text-lg">UPS {index + 1}</h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <p className="text-sm text-gray-500">Load</p>
                <p className={`text-xl ${
                  ups.Load_Percentage > 80 ? 'text-red-500' :
                    ups.Load_Percentage > 70 ? 'text-orange-500' : 'text-green-500'
                }`}>
                  {ups.Load_Percentage?.toFixed(1) || '--'}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Charge</p>
                <p className={`text-xl ${
                  ups.State_of_Charge < 20 ? 'text-red-500' :
                    ups.State_of_Charge < 40 ? 'text-orange-500' : 'text-green-500'
                }`}>
                  {ups.State_of_Charge?.toFixed(1) || '--'}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Battery_Voltage</p>
                <p className="text-xl">
                  {ups.Battery_Voltage_V?.toFixed(1) || '--'}V
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Output_Voltage</p>
                <p className="text-xl">
                  {ups.Output_Voltage_V?.toFixed(1) || '--'}V
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UPSOverview;