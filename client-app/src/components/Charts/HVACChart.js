import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const HVACChart = ({ temperatureData, hvacTemperatures }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">HVAC Temperatures</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={temperatureData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12, fill: "#555" }}
              tickMargin={10}
              axisLine={{ stroke: "#ccc" }}
              tickLine={{ stroke: "#ccc" }}
            />
            <YAxis
              domain={['dataMin - 2', 'dataMax + 2']}
              tick={{ fontSize: 12, fill: "#555" }}
              tickMargin={10}
              axisLine={{ stroke: "#ccc" }}
              tickLine={{ stroke: "#ccc" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #ccc",
                borderRadius: "5px",
                padding: "10px",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
              }}
              formatter={(value, name) => [`${value} °F`, name]}
              labelFormatter={(time) => `Time: ${time}`}
            />
            <Legend verticalAlign="top" height={36} iconSize={12} />
            {hvacTemperatures.map((_, index) => (
              <Line
                key={`hvac-${index}`}
                type="monotone"
                dataKey={`hvacTemp${index}`}
                name={`HVAC ${index + 1}`}
                stroke={`hsl(${index * 90}, 70%, 50%)`}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                animationDuration={500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HVACChart;