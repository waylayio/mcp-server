import { io } from "socket.io-client";

class RLAgent {
  constructor(agentId, socketUrl, globalBest) {
    this.agentId = agentId;
    this.socketUrl = socketUrl;
    this.globalBest = globalBest;
    this.goalState = 10;
    this.numStates = this.goalState + 1;
    this.actions = [0, 1];
    this.alpha = 0.1;
    this.gamma = 0.9;
    this.epsilon = 0.1;

    // Initialize Q-table with small random values
    this.Q = Array.from({ length: this.numStates }, () =>
      Array.from({ length: this.actions.length }, () => Math.random() * 0.1)
    );

    this.socket = io(this.socketUrl);
  }

  init() {
    return new Promise((resolve, reject) => {
      this.socket.on("connect", () => {
        console.log(`${this.agentId} connected with socket id: ${this.socket.id}`);
        this.socket.emit("register", { agentId: this.agentId, capabilities: ["goal_seeking"] });
        resolve();
      });

      this.socket.on("connect_error", (err) => {
        console.error(`${this.agentId} connection error:`, err.message);
        reject(err);
      });

      this.socket.on("message", (msg) => {
        if (msg && msg.type === "episode" && msg.agentId && msg.steps !== undefined) {
          console.log(`${this.agentId} received result from ${msg.agentId}: Episode ${msg.episode}, Steps ${msg.steps}`);
          if (msg.steps < this.globalBest.steps) {
            console.log(`${this.agentId} updating global best from ${this.globalBest.steps} to ${msg.steps}`);
            this.globalBest.steps = msg.steps;
          }
        } else {
          console.warn(`${this.agentId} received invalid message:`, msg);
        }
      });
    });
  }

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

  chooseAction(state) {
    if (Math.random() < this.epsilon) {
      return this.actions[Math.floor(Math.random() * this.actions.length)];
    } else {
      const qValues = this.Q[state];
      return qValues.indexOf(Math.max(...qValues));
    }
  }

  async runEpisodes(numEpisodes = 100) {
    for (let episode = 1; episode <= numEpisodes; episode++) {
      let state = 0;
      let totalReward = 0;
      let steps = 0;
      const maxSteps = 50;

      while (steps < maxSteps) {
        const action = this.chooseAction(state);
        const { nextState, reward, done } = this.step(state, action);
        const bestNext = Math.max(...this.Q[nextState]);
        this.Q[state][action] += this.alpha * (reward + this.gamma * bestNext - this.Q[state][action]);
        state = nextState;
        totalReward += reward;
        steps++;
        if (done) break;
      }

      console.log(`${this.agentId} Episode ${episode}: Total Reward = ${totalReward}, Steps = ${steps}`);
      this.socket.emit("message", { type: "episode", agentId: this.agentId, episode, totalReward, steps });

      if (steps < this.globalBest.steps) {
        console.log(`${this.agentId} achieved a new global best with ${steps} steps!`);
        this.globalBest.steps = steps;
      }

      if (this.globalBest.steps === this.goalState) {
        console.log(`${this.agentId} stopping training as optimal solution reached (${this.globalBest.steps} steps).`);
        break;
      }

      this.epsilon = Math.max(0.01, this.epsilon * 0.99);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`${this.agentId} final Q-table:`, this.Q);
  }
}

async function runParallelAgents() {
  const socketUrl = "http://localhost:3000";
  const globalBest = { steps: Infinity };
  const numAgents = 3;
  const agents = [];

  for (let i = 0; i < numAgents; i++) {
    const agent = new RLAgent(`agent_${i + 1}`, socketUrl, globalBest);
    await agent.init();
    agents.push(agent);
  }

  await Promise.all(agents.map((agent) =>
    agent.runEpisodes(200).catch((err) => {
      console.error(`${agent.agentId} failed:`, err.message);
    })
  ));

  console.log("All agents have completed training.");
  agents.forEach((agent) => agent.socket.disconnect());
}

runParallelAgents();