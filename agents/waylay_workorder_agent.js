import WaylayAssistantAgent from './WaylayAssistantAgent.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WAYLAY_WORKORDER_AGENT_URL = process.env.WAYLAY_WORKORDER_AGENT_URL;
const WAYLAY_WORKORDER_AGENT_SECRET = process.env.WAYLAY_WORKORDER_AGENT_SECRET;
const agent = new WaylayAssistantAgent("waylay_work_order_agent", "http://localhost:3000", WAYLAY_WORKORDER_AGENT_URL, WAYLAY_WORKORDER_AGENT_SECRET);