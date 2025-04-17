import React from "react";
import DataCenter3D from '../3d/DataCenter3D';

const DataCenter3DContainer = ({
  rackTemperatures,
  hvacTemperatures,
  currentTemp,
  outsideTemp,
  targetTemp,
  fanSpeed,
  airflow,
  action,
  powerStatus
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-8">
      <DataCenter3D
        rackTemperatures={rackTemperatures}
        hvacTemperatures={hvacTemperatures}
        currentTemp={currentTemp}
        outsideTemp={outsideTemp}
        targetTemp={targetTemp}
        fanSpeed={fanSpeed}
        airflow={airflow}
        action={action}
        powerStatus={powerStatus}
      />
    </div>
  );
};

export default DataCenter3DContainer;