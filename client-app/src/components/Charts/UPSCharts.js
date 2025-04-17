import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const UPSCharts = ({ upsData, upsDataHistory }) => {
  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">UPS Load Percentage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={upsDataHistory}
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
              domain={[0, 100]}
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
              formatter={(value, name) => [`${value}%`, name.replace('ups', 'UPS ').replace('Load', ' Load')]}
              labelFormatter={(time) => `Time: ${time}`}
            />
            <Legend verticalAlign="top" height={36} iconSize={12} />
            {upsData.map((_, index) => (
              <Line
                key={`ups-load-${index}`}
                type="monotone"
                dataKey={`ups${index + 1}Load`}
                name={`UPS ${index + 1} Load`}
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

      <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">UPS State of Charge</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={upsDataHistory}
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
              domain={[0, 100]}
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
              formatter={(value, name) => [`${value}%`, name.replace('ups', 'UPS ').replace('SOC', ' State of Charge')]}
              labelFormatter={(time) => `Time: ${time}`}
            />
            <Legend verticalAlign="top" height={36} iconSize={12} />
            {upsData.map((_, index) => (
              <Line
                key={`ups-soc-${index}`}
                type="monotone"
                dataKey={`ups${index + 1}SOC`}
                name={`UPS ${index + 1} SOC`}
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

      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">UPS Battery Voltage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={upsDataHistory}
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
              formatter={(value, name) => [`${value}V`, name.replace('ups', 'UPS ').replace('Voltage', ' Voltage')]}
              labelFormatter={(time) => `Time: ${time}`}
            />
            <Legend verticalAlign="top" height={36} iconSize={12} />
            {upsData.map((_, index) => (
              <Line
                key={`ups-voltage-${index}`}
                type="monotone"
                dataKey={`ups${index + 1}Battery_Voltage`}
                name={`UPS ${index + 1} Voltage`}
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
    </>
  );
};

export default UPSCharts;