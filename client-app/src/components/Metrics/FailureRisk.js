import React from "react";

const FailureRisk = ({ failureRisk }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Failure Risk</h2>
      <div className="flex flex-col h-full justify-between">
        <p className="text-4xl font-light">
          {failureRisk !== null ? `${(failureRisk * 100).toFixed(1)}%` : "--"}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-4 mt-4">
          <div
            className={`h-4 rounded-full ${
              failureRisk < 0.3 ? 'bg-green-500' :
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
  );
};

export default FailureRisk;