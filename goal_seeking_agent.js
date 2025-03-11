const { io } = require("socket.io-client");

class GoalSeekingAgent {
    constructor(agentId, serverUrl) {
        this.agentId = agentId;
        this.serverUrl = serverUrl;
        this.socket = io(serverUrl);
        this.currentScore = 0;
        this.goal = 100; // Target score to reach
        this.init();
    }

    init() {
        this.socket.on("connect", () => {
            console.log(`[Agent ${this.agentId}] Connected to MCP Server`);
            this.register();
        });

        this.socket.on("message", (msg) => {
            console.log(`[Agent ${this.agentId}] Received message:`, msg);
            if (msg.type === "goal_update") {
                this.processGoalUpdate(msg.data);
            }
        });

        this.socket.on("disconnect", () => {
            console.log(`[Agent ${this.agentId}] Disconnected`);
        });

        // Start goal seeking loop
        setInterval(() => this.seekGoal(), 2000);
    }

    register() {
        this.socket.emit("register", { agentId: this.agentId });
        console.log(`[Agent ${this.agentId}] Registered`);
    }

    processGoalUpdate(data) {
        if (data.goal) {
            this.goal = data.goal;
            console.log(`[Agent ${this.agentId}] Updated goal to ${this.goal}`);
        }
    }

    seekGoal() {
        if (this.currentScore < this.goal) {
            this.currentScore += Math.floor(Math.random() * 10) + 1; // Random progress
            this.currentScore = Math.min(this.currentScore, this.goal); // Cap at goal

            console.log(`[Agent ${this.agentId}] Score updated: ${this.currentScore}`);

            // Send updated score back to MCP server
            this.socket.emit("message", {
                from: this.agentId,
                to: "server",
                type: "score_update",
                data: { score: this.currentScore }
            });
        }
    }
}

// Start the agent
const agent = new GoalSeekingAgent("goal_agent_1", "http://localhost:3000");

