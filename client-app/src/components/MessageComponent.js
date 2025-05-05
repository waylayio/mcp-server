import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import HTMLRenderer from './HTMLRenderer';
import { isHTMLContent } from '../utils/htmlDetector';

const MessageComponent = ({ onClose, socket, isOpen }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messageHistory, setMessageHistory] = useState(() => {
    const storedHistory = localStorage.getItem('messageHistory');
    if (storedHistory) {
      const parsedHistory = JSON.parse(storedHistory);
      parsedHistory.forEach(item => {
        item.timestamp = new Date(item.timestamp);
      });
      return parsedHistory;
    }
    return [];
  });
  const [shouldRender, setShouldRender] = useState(false);
  const messagesEndRef = useRef(null);
  const panelRef = useRef(null);

  // Handle mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) {
      setShouldRender(false);
    }
  };

  // Scroll to bottom when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen]);

  // Socket message handling
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (msg) => {
      if (msg.from === 'AI_AGENT' && msg.data) {
        setIsLoading(false);
        const newMessageHistory = [
          ...messageHistory,
          { type: 'response', content: msg.data, timestamp: new Date() }
        ];
        setMessageHistory(newMessageHistory);
        localStorage.setItem('messageHistory', JSON.stringify(newMessageHistory));
      }
    };

    socket.on('message', handleIncomingMessage);
    socket.on('error', (err) => {
      setError('An error occurred while communicating with the AI agent.');
      setIsLoading(false);
    });

    return () => {
      socket.off('message', handleIncomingMessage);
      socket.off('error');
    };
  }, [socket, messageHistory]);

  // Auto-scroll when new messages arrive
  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    setIsLoading(true);
    setError(null);

    const newMessageHistory = [
      ...messageHistory,
      { type: 'question', content: message, timestamp: new Date() }
    ];
    setMessageHistory(newMessageHistory);
    localStorage.setItem('messageHistory', JSON.stringify(newMessageHistory));

    socket.emit('message', {
      from: 'UX',
      to: 'AI_AGENT',
      data: { 
        request: "askAgent", 
        question: message 
      }
    });

    setMessage('');
  };

  const clearHistory = () => {
    setMessageHistory([]);
    localStorage.removeItem('messageHistory');
  };

  if (!shouldRender) return null;

  const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13"></path>
      <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
    </svg>
  );

  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay with fade animation */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Chat panel with slide animation */}
      <div 
        className="absolute top-10 right-0 w-full md:w-1/2 h-1/2 transform transition-all duration-300 ease-out"
      >
        <div
          ref={panelRef}
          className={`h-full bg-gradient-to-r from-blue-50 to-blue-100 shadow-2xl rounded-lg flex flex-col transform transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onTransitionEnd={handleAnimationEnd}
          style={{ opacity: 0.95 }}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-3 border-b border-blue-200 bg-blue-50 bg-opacity-90 rounded-t-lg">
            <div className="flex items-center">
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 text-xl p-1 mr-2"
                aria-label="Close chat"
              >
                &times;
              </button>
              <h2 className="text-lg font-semibold text-gray-800">🤖 Waylay AI Assistant</h2>
            </div>
            <button
              onClick={clearHistory}
              className="flex items-center text-sm text-gray-500 hover:text-red-500 px-2 py-1 rounded border border-gray-300 hover:border-red-300 transition-colors"
              aria-label="Clear history"
              title="Clear chat history"
            >
              <TrashIcon />
              <span className="ml-1">Clear</span>
            </button>
          </div>
          
          {/* Message history */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messageHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500 text-center py-4">
                  Ask me about the data center status
                </p>
              </div>
            ) : (
              messageHistory.map((item, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg ${
                    item.type === 'question' 
                      ? 'bg-blue-100 self-end ml-8 shadow-md' 
                      : 'bg-white self-start mr-8 shadow-sm'
                  }`}
                >
                  {isHTMLContent(item.content) ? (
                    <>
                      <HTMLRenderer content={item.content} />
                      <p className="text-xs text-gray-500 mt-1">
                        {item.timestamp.toLocaleTimeString()}
                      </p>
                    </>
                  ) : (
                    <>
                      <MarkdownRenderer content={item.content} />
                      <p className="text-xs text-gray-500 mt-1">
                        {item.timestamp.toLocaleTimeString()}
                      </p>
                    </>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="p-3 rounded-lg bg-white self-start mr-8 shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-ping" />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-ping" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-ping" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
    
          {/* Input area */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-blue-200 bg-white bg-opacity-90 rounded-b-lg">
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your question..."
                  disabled={isLoading}
                  maxLength={300}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !message.trim()}
                className={`p-2 rounded-full text-white ${
                  isLoading || !message.trim() 
                    ? 'bg-blue-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>
            {error && (
              <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default MessageComponent;