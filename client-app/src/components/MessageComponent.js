import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

const MessageComponent = ({ onClose, socket }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);
  const messagesEndRef = useRef(null); // Reference to the end of the message list

  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (msg) => {
      if (msg.from === 'AI_AGENT' && msg.data) {
        setIsLoading(false);
        setMessageHistory(prev => [
          ...prev,
          { type: 'response', content: msg.data, timestamp: new Date() }
        ]);
      }
    };

    socket.on('message', handleIncomingMessage);

    return () => {
      socket.off('message', handleIncomingMessage);
    };
  }, [socket]);

  useEffect(() => {
    // Scroll to the bottom whenever messageHistory is updated
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageHistory]); // Runs every time messageHistory changes

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    setIsLoading(true);
    setError(null);
    
    try {
      // Add question to history
      setMessageHistory(prev => [
        ...prev,
        { type: 'question', content: message, timestamp: new Date() }
      ]);

      // Send message via socket
      socket.emit('message', {
        from: 'UX',
        to: 'AI_AGENT',
        data: { 
            request: "askAgent", 
            question:  message 
        }
      });

      setMessage('');
    } catch (err) {
      setError('Failed to send message');
      console.error('Socket send error:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end items-start p-4">
      <div className="bg-gradient-to-r from-blue-100 to-blue-200 p-6 rounded-lg shadow-2xl w-1/2 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">AI Assistant</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition duration-200"
          >
            ✕
          </button>
        </div>
        
        {/* Message history */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-3 custom-scrollbar">
          {messageHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Ask me about the data center status</p>
          ) : (
            messageHistory.map((item, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg transition duration-300 ${item.type === 'question' 
                  ? 'bg-blue-100 self-end ml-8 shadow-2xl hover:shadow-3xl transform hover:scale-105' 
                  : 'bg-gray-100 self-start mr-8 shadow-lg hover:shadow-xl'}`}
              >
                <MarkdownRenderer content={item.content} />
                <p className="text-xs text-gray-500 mt-1">
                  {item.timestamp.toLocaleTimeString()}
                </p>
              </div>
            ))
          )}
          {isLoading && (
            <div className="p-3 rounded-lg bg-gray-100 self-start mr-8">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-ping"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-ping" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-ping" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} /> {/* This is the element where we scroll to */}
        </div>
  
        {/* Input area */}
        <form onSubmit={handleSubmit} className="mt-auto">
          <div className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
              placeholder="Type your question..."
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className={`px-4 py-2 rounded-lg text-white transition duration-200 ease-in-out ${isLoading || !message.trim() 
                ? 'bg-blue-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              Send
            </button>
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm shadow-md">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default MessageComponent;