import { io } from "socket.io-client";
const socket = io("http://localhost:3000");

class Thermostat {
    constructor(agent) {
        this.agent = agent;
        this.currentTemp = 15; // Initial temperature
        this.targetTemp = 22; // Desired state (target temperature)
    }
  
    getCurrentTemp() {
      return this.currentTemp;
    }
  
    setCurrentTemp(temp) {
      this.currentTemp = temp;
    }

    getTargetTemp() {
      return this.targetTemp;
    }

    init() {
        socket.on("connect", () => {
            console.log(`[Client] Connected as ${this.agent }`);
            socket.emit("register", { agentId: `${this.agent }` });
        });
        socket.on("message", (msg) => {
            console.log(`[Client] Received response:`, msg);
            if (msg.from === "metrics_agent") {
                this.currentTemp = parseInt(msg.data.temperature.value);
            }
            console.log(`current temperature is now: ${this.currentTemp}`);
            console.log(`target temperature is: ${this.targetTemp}`);
        });
        setInterval(this.requestData, 15000);
    }
    
    requestData() {
        console.log(`[Client] Requesting thermostat data...`);
        socket.emit("message", {
            from: "thermostat",
            to: "metrics_agent",
            data: { request: "get_thermostat_data", assetName: "thermostat" },
        });
    }
}

class RLAgent {
  constructor(agentId) {
    this.agentId = agentId;
    this.actions = [0, 1]; // 0: decrease temp, 1: increase temp
    this.alpha = 0.1; // Learning rate
    this.gamma = 0.9; // Discount factor
    this.epsilon = 0.1; // Exploration rate

    // Initialize Q-table with small random values
    this.Q = Array.from({ length: 100 }, () =>
      Array.from({ length: this.actions.length }, () => Math.random() * 0.1)
    );

    socket.on("connect", () => {
      console.log(`${this.agentId} connected with socket id: ${socket.id}`);
      socket.emit("register", { agentId: this.agentId });
    });

    socket.on("update", (data) => {
      if (data.agentId !== this.agentId) {
        console.log(`${this.agentId} received update from ${data.agentId}:`, data);
      }
    });

    socket.on("disconnect", () => {
      console.log(`${this.agentId} disconnected from server`);
    });
  }

  // Get Q-value for a state-action pair
  getQValue(state, action) {
    if (!this.Q[state]) this.Q[state] = {};
    if (this.Q[state][action] === undefined) this.Q[state][action] = 0;
    return this.Q[state][action];
  }

  // Choose action using epsilon-greedy strategy
  chooseAction(state) {
    if (Math.random() < this.epsilon) {
      return this.actions[Math.floor(Math.random() * this.actions.length)]; // Explore
    } else {
      const qValues = this.actions.map((action) => this.getQValue(state, action));
      return this.actions[qValues.indexOf(Math.max(...qValues))]; // Exploit
    }
  }

  // Update Q-value
  updateQValue(state, action, reward, nextState) {
    const bestNext = Math.max(...this.actions.map((a) => this.getQValue(nextState, a)));
    this.Q[state][action] += this.alpha * (reward + this.gamma * bestNext - this.Q[state][action]);
  }

  // Step function: Interact with the environment
  step(thermostat, action) {
    const prevTemp = thermostat.getCurrentTemp();
    const targetTemp = thermostat.getTargetTemp();

    let nextTemp;
    if (action === 0) {
      nextTemp = prevTemp - 1; // Decrease temperature
    } else if (action === 1) {
      nextTemp = prevTemp + 1; // Increase temperature
    }

    // Update the environment's current temperature
    thermostat.setCurrentTemp(nextTemp);

    // Calculate reward
    const prevDiff = Math.abs(prevTemp - targetTemp);
    const newDiff = Math.abs(nextTemp - targetTemp);
    let reward = prevDiff - newDiff; // Reward is positive if moving closer, negative if moving away

    // Add a large reward for reaching the target
    if (nextTemp === targetTemp) {
      reward += 10; // Bonus for reaching the target
    }

    const done = nextTemp === targetTemp; // Terminal state

    return { nextState: nextTemp, reward, done };
  }

  // Run training loop
  async runTraining(thermostat) {
    while (true) {
      let state = thermostat.getCurrentTemp();

      const action = this.chooseAction(state);
      const { nextState, reward, done } = this.step(thermostat, action);

      this.updateQValue(state, action, reward, nextState);

      // Decay epsilon
      this.epsilon = Math.max(0.01, this.epsilon * 0.95);

      // Log progress
      console.log(`${this.agentId}: State = ${state}, Action = ${action}, Reward = ${reward}, Next State = ${nextState}`);
      console.log(`Q-table for state ${state}:`, this.Q[state]);
      console.log(`Epsilon: ${this.epsilon}`);

    //   socket.emit("update", {
    //     type: "update",
    //     agentId: this.agentId,
    //     state,
    //     action,
    //     reward,
    //     nextState,
    //   });

      // Reset if target is reached
      if (done) {
        thermostat.setCurrentTemp(20); // Reset to initial state
        console.log(`${this.agentId} reached the target temperature!`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1-second delay
    }
  }
}

// Main function
async function main() {
  const thermostat = new Thermostat("thermostat");
  thermostat.init()
  const agent = new RLAgent("RL_Agent");

  agent.runTraining(thermostat).catch((err) => console.error("Error in training loop:", err));
}

main();