import { io } from "socket.io-client";

// --- RLAgent Class Definition ---
class RLAgent {
  constructor(agentId, socketUrl, globalBest) {
    this.agentId = agentId;
    this.socketUrl = socketUrl;
    this.globalBest = globalBest; // Shared object to track the best result across agents
    // Q-learning and environment parameters
    this.goalState = 10;
    this.numStates = this.goalState + 1; // states: 0...10
    this.actions = [0, 1]; // 0: move left, 1: move right
    this.alpha = 0.1;    // Learning rate
    this.gamma = 0.9;    // Discount factor
    this.epsilon = 0.1;  // Exploration rate

    // Initialize Q-table: Q[state][action]
    this.Q = Array.from({ length: this.numStates }, () => Array(this.actions.length).fill(0));
    // Create a socket connection to the MCP server
    this.socket = io(this.socketUrl);
  }

  // Wait for socket connection and set up event listeners
  init() {
    return new Promise((resolve) => {
      this.socket.on("connect", () => {
        console.log(`${this.agentId} connected with socket id: ${this.socket.id}`);
        // Register this agent with its capabilities
        this.socket.emit("register", { agentId: this.agentId, capabilities: ["goal_seeking"] });
        resolve();
      });

      // Listen for messages from other agents (via the MCP server)
      this.socket.on("message", (msg) => {
        if (msg.type === "episode" && msg.agentId !== this.agentId) {
          console.log(`${this.agentId} received result from ${msg.agentId}: Episode ${msg.episode}, Steps ${msg.steps}`);
          // Update global best if another agent achieves fewer steps
          if (msg.steps < this.globalBest.steps) {
            console.log(`${this.agentId} updating global best from ${this.globalBest.steps} to ${msg.steps}`);
            this.globalBest.steps = msg.steps;
          }
        }
      });
    });
  }

  // The environment step: returns next state, reward, and done flag.
  step(state, action) {
    let nextState;
    if (action === 1) {
      nextState = Math.min(state + 1, this.goalState);
    } else if (action === 0) {
      nextState = Math.max(state - 1, 0);
    } else {
      nextState = state;
    }
    const reward = nextState === this.goalState ? 10 : -1;
    const done = nextState === this.goalState;
    return { nextState, reward, done };
  }

  // Epsilon-greedy action selection
  chooseAction(state) {
    if (Math.random() < this.epsilon) {
      // Explore: pick a random action
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    } else {
      // Exploit: choose the best known action
      const qValues = this.Q[state];
      return qValues.indexOf(Math.max(...qValues));
    }
  }

  // Runs a series of episodes of training.
  async runEpisodes(numEpisodes = 100) {
    for (let episode = 1; episode <= numEpisodes; episode++) {
      let state = 0;
      let totalReward = 0;
      let steps = 0;
      const maxSteps = 50; // Safety cap

      while (steps < maxSteps) {
        const action = this.chooseAction(state);
        const { nextState, reward, done } = this.step(state, action);
        // Q-learning update
        const bestNext = Math.max(...this.Q[nextState]);
        this.Q[state][action] += this.alpha * (reward + this.gamma * bestNext - this.Q[state][action]);
        state = nextState;
        totalReward += reward;
        steps++;
        if (done) break;
      }

      console.log(`${this.agentId} Episode ${episode}: Total Reward = ${totalReward}, Steps = ${steps}`);

      // Broadcast this episode result (including the agent's ID) to the server
      this.socket.emit("message", { type: "episode", agentId: this.agentId, episode, totalReward, steps });

      // Update global best if this agent beats the current best
      if (steps < this.globalBest.steps) {
        console.log(`${this.agentId} achieved a new global best with ${steps} steps!`);
        this.globalBest.steps = steps;
      }

      // Stop training if optimal result is achieved (optimal path is 10 steps)
      if (this.globalBest.steps === this.goalState) {
        console.log(`${this.agentId} stopping training as optimal solution reached (${this.globalBest.steps} steps).`);
        break;
      }

      // Decay epsilon to reduce exploration over time
      this.epsilon = Math.max(0.01, this.epsilon * 0.99);
      
      // Brief pause between episodes for clarity
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`${this.agentId} final Q-table:`, this.Q);
  }
}

// --- Main Function to Run Multiple Agents in Parallel ---
async function runParallelAgents() {
  const socketUrl = "http://localhost:3000";
  // Shared global object to track best (lowest steps) result across agents
  const globalBest = { steps: Infinity };
  const numAgents = 3;
  const agents = [];

  // Instantiate and initialize agents
  for (let i = 0; i < numAgents; i++) {
    const agent = new RLAgent(`agent_${i + 1}`, socketUrl, globalBest);
    await agent.init();
    agents.push(agent);
  }

  // Run training episodes in parallel for all agents
  await Promise.all(agents.map((agent) => agent.runEpisodes(200)));

  console.log("All agents have completed training.");
}

runParallelAgents();