import React from "react";

const HVACOverview = ({ hvacTemperatures }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-8">
      <h3 className="text-lg font-medium text-gray-500 mb-2">HVAC Temperatures Overview</h3>
      <div className="flex justify-between items-center mt-2 text-xs text-gray-500 mb-3">
        <span>60°F (Cool)</span>
        <span>80°F</span>
        <span>100°F (Hot)</span>
      </div>
      <div className="w-full h-3 rounded-full mt-1 mb-4 bg-gradient-to-r from-blue-200 via-blue-100 to-orange-200"></div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {hvacTemperatures.map((temp, index) => {
          const tempValue = temp !== null ? parseFloat(temp) : 60;
          const normalizedTemp = Math.min(Math.max(tempValue, 60), 100);
          const ratio = (normalizedTemp - 60) / 60;

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
              <div className="text-sm font-medium text-gray-800">HVAC {index + 1}</div>
              <div className="text-xl text-gray-800">
                {temp !== null ? `${temp} °F` : "--"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HVACOverview;