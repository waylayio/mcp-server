import React from "react";
import MarkdownRenderer from './MarkdownRenderer';

const AppHeader = ({ connectionStatus, lastUpdated, error, notification, onAIAssistantClick }) => {
  return (
    <header className="mb-6 px-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Data Center Monitoring</h1>
          <div className="flex items-center mt-3 space-x-3">
            <span
              className={`inline-block w-4 h-4 rounded-full ${
                connectionStatus === "connected" ? "bg-green-500" :
                connectionStatus === "error" ? "bg-red-500" : "bg-yellow-500"
              }`}
            ></span>
            <span className="text-sm font-medium text-gray-700">
              {connectionStatus === "connected" ? "Connected" :
                connectionStatus === "error" ? "Connection Error" : "Connecting..."}
            </span>
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Last update: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onAIAssistantClick}
          className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ease-in-out duration-200 shadow-md"
          >
          🤖 Ask AI Assistant
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-100 text-red-700 rounded-lg text-sm shadow-md">
          {error}
        </div>
      )}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded-lg shadow-lg max-w-md animate-fade-in">
          <MarkdownRenderer content={notification} />
        </div>
      )}
    </header>
  );
};

export default AppHeader;