
import AssistantClient from './AssistantClient.js';
const assistantClient = new AssistantClient("client_ask_agent1","waylay_assistant_agent", "askAgent", "run diagnostic test on the asset HVAC1");
const assistantClient2 = new AssistantClient("client_ask_agent2","waylay_work_order_agent", "askAgent", "create me a work order for HVAC1, description is test description, make it open case and assign it to veselin@waylay.io");
