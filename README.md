# MCP Server  

This code is for demo purposes only. It does not strictly adhere to the MCP specification, which, despite being open, is not necessarily an open standard. However, it provides a basic idea of how you can quickly implement your own version—just make sure it aligns with the "standard."  

## About the MCP Server Implementation  

- Uses **WebSockets** for agent/tool communication.  
- Provides an **HTTP endpoint** for connecting new clients.  
- Utilizes **Redis** for pub/sub, allowing for horizontal scaling with Kafka or other message brokers if needed.  
- Includes several client implementations, one of which supports **API caching** for efficiency.  
- Sends **Server-Sent Events (SSE)** updates to clients and supports broadcasting messages to all clients via SSE.  

The code does not strictly distinguish between "tools" and "agents," as the boundary between them is often blurry. You can turn agent endpoints into tools, making the classification somewhat arbitrary.  

## Key Takeaways  

- Less than **200 lines of code** to grasp the core concepts.  
- A simple yet effective introduction to multi-agent interactions.  
- Open for forking, modifying, and experimenting—just don’t expect support if things behave unexpectedly (agents can be unpredictable!).  

I may occasionally add improvements, such as more advanced orchestration or goal-seeking agents. However, the core idea remains: keeping things minimal while helping you navigate the complex world of multi-agent systems with just a few dozen lines of code.  


