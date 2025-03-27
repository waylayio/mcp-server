import * as tf from '@tensorflow/tfjs-node';
import { io } from "socket.io-client";

const config = {
  training: {
    gamma: 0.95,
    epsilon: 1.0,
    epsilonMin: 0.01,
    epsilonDecay: 0.995,
    learningRate: 0.001,
    batchSize: 32,
    memoryCapacity: 10000,
    targetUpdateFreq: 200,
    saveModelFreq: 1000
  },
  environment: {
    updateInterval: 60000,
    updateExternalInterval: 30000,
    actionInterval: 1000,
    maxModelsToKeep: 5,
    rackCount: 10
  },
  model: {
    hiddenUnits: [256, 128],
    activation: 'relu',
    kernelInitializer: 'heNormal'
  }
};

// Action definitions
const ACTIONS = {
  COOL_INCREMENT_SMALL: 0,
  COOL_DECREMENT_SMALL: 1,
  FAN_INCREMENT_SMALL: 2,
  COOL_INCREMENT_LARGE: 3,
  COOL_DECREMENT_LARGE: 4,
  FAN_INCREMENT_LARGE: 5,
  MAINTAIN: 6,
  THERMAL_STORAGE_CHARGE: 7,
  THERMAL_STORAGE_DISCHARGE: 8
};

const ACTION_EFFECTS = {
  [ACTIONS.COOL_INCREMENT_SMALL]: { temp: -0.5, fan: 5, energy: 3 },
  [ACTIONS.COOL_DECREMENT_SMALL]: { temp: 0.5, fan: -5, energy: -3 },
  [ACTIONS.FAN_INCREMENT_SMALL]: { temp: -0.1, fan: 10, energy: 3 },
  [ACTIONS.COOL_INCREMENT_LARGE]: { temp: -1.0, fan: 10, energy: 10 },
  [ACTIONS.COOL_DECREMENT_LARGE]: { temp: 1.0, fan: -10, energy: -10 },
  [ACTIONS.FAN_INCREMENT_LARGE]: { temp: -0.2, fan: 20, energy: 5 },
  [ACTIONS.MAINTAIN]: { temp: 0, fan: 0, energy: 0 },
  [ACTIONS.THERMAL_STORAGE_CHARGE]: { temp: 0.5, fan: 0, energy: 5 },
  [ACTIONS.THERMAL_STORAGE_DISCHARGE]: { temp: -0.5, fan: 0, energy: -3 }
};

class Sensor {
  constructor(initialValue, min = 0, max = 100, variation = 1, name = '') {
    this.value = initialValue;
    this.min = min;
    this.max = max;
    this.variation = variation;
    this.name = name;
    this.history = [];
  }

  update() {
    this.value = Math.min(this.max, Math.max(this.min, this.value + (Math.random() - 0.5) * this.variation));
    this.history.push(this.value);
    if (this.history.length > 100) this.history.shift();
  }

  get() { return this.value; }
  getNormalized() { return (this.value - this.min) / (this.max - this.min); }
}

class EnhancedDataCenterEnvironment {
  constructor(agentId, socket) {
    this.socket = socket;
    this.agentId = agentId;

    // Sensors
    this.energy = new Sensor(20, 0, 200, 5, 'Energy'); // Min 0, Max 200 kW
    this.workload = new Sensor(0.5, 0, 1, 0.1, 'Workload');
    this.ambientTemperature = new Sensor(25, 15, 30, 1, 'Ambient Temp');
    this.humidity = new Sensor(50, 10, 90, 5, 'Humidity');
    this.targetTemperature = new Sensor(22, 20, 25, 0, 'Target Temp');
    this.fanSpeed = new Sensor(30, 0, 100, 5, 'Fan Speed');
    this.airflow = new Sensor(300, 100, 500, 20, 'Airflow');

    // Rack temperatures
    this.rackTemperatures = Array(config.environment.rackCount).fill(0).map((_, i) =>
      new Sensor(22, 15, 35, 0.5, `Rack ${i + 1} Temp`)
    );

    // Metrics
    this.pue = new Sensor(1.5, 1.0, 3.0, 0.05, 'PUE');
    this.failureRisk = 0;

    // Thermal storage
    this.thermalStorage = {
      capacity: 1000,
      current: 300,
      chargeRate: 50,
      dischargeRate: 100,
      efficiency: 0.85
    };

    this.updateInterval = setInterval(() => this.updateMetrics(), config.environment.updateInterval);

    //external 
    this.currentWeather = {
      temperature: 15,
      humidity: 50,
      forecast: 'sunny'
    };
    this.currentEnergyPrices = {
      current: 0.08,
      forecast: Array(24).fill(0.08)
    };
    this.updateExternalInterval = setInterval(() => this.updateExternalMetrics(), config.environment.updateExternalInterval);

    this.socket.on("message", (msg) => {
      if (msg.data.temperature) {
        this.currentWeather = msg.data;
        if (this.currentWeather?.temperature < 5 || this.currentWeather?.temperature > 25) {
          this.currentEnergyPrices.current = 0.2;
        }
        console.log("Update Current Weather", this.currentWeather, "Update Energy Price", this.currentEnergyPrices.current);
      }
    });
  }

  updateMetrics() {
    try {
      this.energy.update();
      this.workload.update();
      this.ambientTemperature.update();
      this.humidity.update();
      this.fanSpeed.update();
      this.airflow.update();

      // Update rack temperatures with workload correlation
      this.rackTemperatures.forEach((rack, i) => {
        rack.value += (this.workload.get() - 0.5) * 0.2 * (1 + (i % 3) / 10);
        rack.update();
      });

      // Update PUE based on energy
      this.pue.value = 1.2 + (this.energy.get() / 200) * 0.8;
      this.pue.update();

      this.updateFailureRisk();
      this.emitStatusUpdate("UPDATE");
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  updateExternalMetrics() {
    this.socket.emit("message", {
      from: this.agentId,
      to: "weather_agent",
      data: { request: "get_weather", city: "Brussels" }
    });
  }

  updateFailureRisk() {
    const maxRackTemp = Math.max(...this.rackTemperatures.map(r => r.get()));
    const tempPenalty = Math.max(0, maxRackTemp - 25) * 0.1;

    this.failureRisk = Math.min(1,
      (this.workload.get() * 0.4) +
      tempPenalty +
      (Math.max(0, this.humidity.get() - 60) * 0.01) +
      (Math.max(0, this.fanSpeed.get() - 80) * 0.005)
    );
  }

  getNormalizedState() {
    // Core metrics - using min-max normalization instead of z-score
    const coreState = [
      this.energy.getNormalized(), // Already uses min-max
      this.workload.getNormalized(),
      (this.ambientTemperature.get() - 15) / 15, // 15-30°C range
      (this.humidity.get() - 10) / 80, // 10-90% range
      (this.targetTemperature.get() - 20) / 5, // 20-25°C range
      this.fanSpeed.getNormalized(),
      (this.airflow.get() - 100) / 400, // 100-500 range
      (this.pue.get() - 1.0) / 2.0 // 1.0-3.0 range
    ];

    // Rack temperatures (15-30°C range)
    const rackTemps = this.rackTemperatures.map(rack =>
      (rack.get() - 15) / 15
    );

    // Thermal storage
    const storageState = [
      this.thermalStorage.current / this.thermalStorage.capacity,
      this.thermalStorage.efficiency
    ];

    return [...coreState, ...rackTemps, ...storageState];
  }

  executeAction(action) {
    const effect = ACTION_EFFECTS[action];

    // Handle special actions (thermal storage)
    if (action === ACTIONS.THERMAL_STORAGE_CHARGE) {
      const chargeAmount = Math.min(
        this.thermalStorage.capacity - this.thermalStorage.current,
        this.thermalStorage.chargeRate
      );
      this.thermalStorage.current += chargeAmount * this.thermalStorage.efficiency;
      this.energy.value = Math.max(0, this.energy.value + effect.energy);
    }
    else if (action === ACTIONS.THERMAL_STORAGE_DISCHARGE) {
      const dischargeAmount = Math.min(
        this.thermalStorage.current,
        this.thermalStorage.dischargeRate
      );
      this.thermalStorage.current -= dischargeAmount;
      this.energy.value = Math.max(0, this.energy.value + effect.energy);
    }
    else {
      // Handle regular cooling/fan actions
      this.targetTemperature.value += effect.temp * 0.5;
      this.fanSpeed.value = Math.min(100, Math.max(0, this.fanSpeed.value + effect.fan));
      this.energy.value = Math.max(0, this.energy.value + effect.energy);
    }

    // Calculate ambient temperature change
    let ambientEffect = 0;

    if (action === ACTIONS.COOL_INCREMENT_SMALL || action === ACTIONS.COOL_INCREMENT_LARGE) {
      ambientEffect = effect.temp * 0.8; // Strong cooling effect on ambient
    }
    else if (action === ACTIONS.FAN_INCREMENT_SMALL || action === ACTIONS.FAN_INCREMENT_LARGE) {
      ambientEffect = effect.temp * 0.3; // Moderate effect from fans
    }
    else if (action === ACTIONS.THERMAL_STORAGE_DISCHARGE) {
      ambientEffect = effect.temp * 0.6; // Significant cooling from storage
    }

    // Store old ambient temperature for rack temperature calculation
    const oldAmbientTemp = this.ambientTemperature.value;

    // Apply ambient temperature change with bounds
    this.ambientTemperature.value = Math.min(30, Math.max(15, this.ambientTemperature.value + ambientEffect));

    // Calculate ambient temperature change magnitude
    const ambientTempChange = this.ambientTemperature.value - oldAmbientTemp;

    // Update rack temperatures based on ambient temperature change and workload
    this.rackTemperatures.forEach((rack, index) => {
      // Base rack temperature change follows ambient but with some inertia
      let rackTempChange = ambientTempChange * 0.7; // Racks don't change as fast as ambient

      // Workload contributes to heating (more workload = more heat)
      rackTempChange += (this.workload.get() - 0.5) * 0.1;

      // Some racks heat up more than others (simulate hot spots)
      const hotspotFactor = 1 + (index % 3) * 0.1;

      // Apply the temperature change to the rack
      rack.value = Math.min(30, Math.max(15, rack.value + rackTempChange * hotspotFactor));

      // Add some random variation
      rack.value += (Math.random() - 0.5) * 0.2;

      // Ensure rack temperature stays within bounds
      rack.value = Math.min(35, Math.max(15, rack.value)); // Racks can go slightly higher than ambient
    });

    // Update airflow based on fan speed
    this.airflow.value = this.fanSpeed.value * 5;

    // Update failure risk based on new rack temperatures
    this.updateFailureRisk();
  }

  emitStatusUpdate(action) {
    let status = {
      from: this.agentId,
      data: {
        energy: this.energy.get().toFixed(2),
        workload: this.workload.get().toFixed(2),
        ambientTemp: this.ambientTemperature.get().toFixed(2),
        humidity: this.humidity.get().toFixed(2),
        targetTemp: this.targetTemperature.get().toFixed(2),
        fanSpeed: this.fanSpeed.get().toFixed(2),
        airflow: this.airflow.get().toFixed(2),
        pue: this.pue.get().toFixed(3),
        failureRisk: this.failureRisk.toFixed(4),
        rackTemperatures: this.rackTemperatures.map(r => r.get().toFixed(2)),
        thermalStorage: this.thermalStorage.current.toFixed(1),
        outsideTemperature: this.currentWeather.temperature.toFixed(2),
        outsideHumidity: this.currentWeather.humidity.toFixed(2),
        rackTemperatures: this.rackTemperatures.map(v=>v.value)
      }
    };
    const ACTION_NAMES = Object.fromEntries(
      Object.entries(ACTIONS).map(([name, value]) => [value, name])
    );
    console.log(`[${this.agentId}] ${ACTION_NAMES[action]} | Energy:${this.energy.get().toFixed(2)}kW | Temp:${this.ambientTemperature.get().toFixed(2)}°C/${this.targetTemperature.get().toFixed(2)}°C | Fans:${this.fanSpeed.get().toFixed(2)}% | Risk:${(this.failureRisk * 100).toFixed(2)}% | Storage:${this.thermalStorage.current.toFixed(1)}kWh`);
    if (action && action !== "UDPDATE")
      status.action = action
    this.socket.emit('message', status);
    return status;
  }
}

class EnhancedDQNAgent {
  constructor(env) {
    this.env = env;
    this.isTraining = false;

    // State indices for safe access
    this.stateIndices = {
      ENERGY: 0,
      WORKLOAD: 1,
      AMBIENT_TEMP: 2,
      HUMIDITY: 3,
      TARGET_TEMP: 4,
      FAN_SPEED: 5,
      AIRFLOW: 6,
      PUE: 7,
      RACK_TEMPS: 8, // Starting index for rack temps
      STORAGE: 9 + config.environment.rackCount
    };


    // Hyperparameters
    this.gamma = config.training.gamma;
    this.epsilon = config.training.epsilon;
    this.epsilonMin = config.training.epsilonMin;
    this.epsilonDecay = config.training.epsilonDecay;
    this.learningRate = config.training.learningRate;
    this.batchSize = config.training.batchSize;
    this.memoryCapacity = config.training.memoryCapacity;

    // Tracking
    this.stepCount = 0;
    this.memoryBuffer = [];

    // External factors
    this.weatherAdjustment = 0;
    this.currentEnergyPrice = 0.1;

    if (!tf.backend()) {
      console.log('Initializing TensorFlow backend...');
      tf.setBackend('tensorflow');
    }

    // Models
    this.model = this.buildModel();
    this.targetModel = this.buildModel();
    this.updateTargetModel();

  }

  async updateTargetModel() {
    try {
      console.log('updateTargetModel');
      const modelWeights = await this.model.getWeights();
      await this.targetModel.setWeights(modelWeights);
    } catch (error) {
      console.error('Target update failed:', error);
      await this.resetBackend();
    }
  }

  buildModel() {
    const model = tf.sequential();
    const inputShape = 8 + config.environment.rackCount + 2;
    const numActions = Object.keys(ACTIONS).length;
    console.log('Model input shape:', inputShape);

    model.add(tf.layers.dense({
      units: config.model.hiddenUnits[0],
      inputShape: [inputShape],
      activation: config.model.activation,
      kernelInitializer: config.model.kernelInitializer
    }));

    for (let i = 1; i < config.model.hiddenUnits.length; i++) {
      model.add(tf.layers.dense({
        units: config.model.hiddenUnits[i],
        activation: config.model.activation,
        kernelInitializer: config.model.kernelInitializer
      }));
    }

    model.add(tf.layers.dense({
      units: numActions,
      activation: 'linear'
    }));

    model.compile({
      optimizer: tf.train.adam(this.learningRate),
      loss: tf.losses.huberLoss
    });

    return model;
  }

  sanitizeState(state) {
    const expectedLength = this.stateIndices.STORAGE + 1;

    // Handle invalid state objects
    if (!Array.isArray(state)) {
      console.error('State is not an array:', state);
      return Array(expectedLength).fill(0);
    }

    // Handle incorrect length
    if (state.length !== expectedLength) {
      console.error(`State length mismatch (expected ${expectedLength}, got ${state.length})`);
      return Array(expectedLength).fill(0);
    }

    // Sanitize each value
    return state.map((val, idx) => {
      const num = Number(val);

      // Special handling for critical parameters
      if (idx === this.stateIndices.ENERGY) {
        return Math.max(0, Math.min(500, num)); // Energy cap at 500kW
      }
      if (idx === this.stateIndices.AMBIENT_TEMP) {
        return Math.max(15, Math.min(35, num)); // Temp range 15-35°C
      }

      return Number.isFinite(num) ? num : 0;
    });
  }

  remember(state, action, reward, nextState, done) {
    const cleanState = this.sanitizeState(state);
    const cleanNextState = this.sanitizeState(nextState);

    if (this.memoryBuffer.length >= this.memoryCapacity) {
      this.memoryBuffer.shift();
    }
    this.memoryBuffer.push({
      state: cleanState,
      action,
      reward,
      nextState: cleanNextState,
      done
    });
  }

  sampleFromMemory() {
    const shuffled = [...this.memoryBuffer];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, this.batchSize);
  }

  calculateReward(oldState, newState, action) {

    this.weatherAdjustment = Math.min(5, Math.max(-5,
      (this.env.currentWeather.temperature - this.env.ambientTemperature.value) * 0.1
    ));
    this.currentEnergyPrice = this.env.currentEnergyPrices.current;
    const cleanNewState = this.sanitizeState(newState);

    // Extract normalized values
    const {
      [this.stateIndices.ENERGY]: energyNorm,
      [this.stateIndices.AMBIENT_TEMP]: ambientTempNorm,
      [this.stateIndices.TARGET_TEMP]: targetTempNorm,
      [this.stateIndices.FAN_SPEED]: fanSpeedNorm,
      [this.stateIndices.PUE]: pueNorm,
      [this.stateIndices.STORAGE]: storageNorm,
      [this.stateIndices.WORKLOAD]: workloadNorm
    } = cleanNewState;

    // Rack temperature analysis
    const rackTempsNorm = cleanNewState.slice(
      this.stateIndices.RACK_TEMPS,
      this.stateIndices.RACK_TEMPS + config.environment.rackCount
    );
    const maxRackTempNorm = Math.max(...rackTempsNorm);
    const minRackTempNorm = Math.min(...rackTempsNorm);
    const rackTempGradient = maxRackTempNorm - minRackTempNorm;

    // Energy price factor (0.20 is max expected price)
    const energyPriceFactor = 1 + (this.currentEnergyPrice / 0.20);

    // Reward components
    const components = {
      // Energy cost (price-sensitive)
      energyCost: -Math.min(2, energyNorm * 2 * energyPriceFactor),

      // Temperature control (more important when workload is high)
      temperatureControl: -Math.min(1, Math.abs(ambientTempNorm - targetTempNorm)) * (1 + workloadNorm),

      // Rack safety (non-linear penalty)
      rackSafety: -Math.min(2, Math.pow(Math.max(0, maxRackTempNorm - 0.5), 2)),

      // Temperature uniformity
      tempUniformity: -Math.min(1, rackTempGradient * 3),

      // PUE efficiency
      pueEfficiency: -Math.min(1, Math.abs(pueNorm - 0.25)),

      // Fan wear (non-linear)
      fanWear: -Math.min(1, Math.pow(fanSpeedNorm, 3)),

      // Storage value (with bonus for smart usage)
      storageValue: storageNorm > 0.5 ? 0.1 : -0.1,

      // Workload balance
      workloadBalance: -Math.min(1, Math.abs(workloadNorm - 0.5)),

      // Failure risk (sigmoid penalty)
      failurePenalty: -1 / (1 + Math.exp(-10 * (this.env.failureRisk - 0.7))),

      // Small penalty for any action
      actionPenalty: -0.03
    };

    // Action-specific bonuses
    if (action === ACTIONS.THERMAL_STORAGE_DISCHARGE && maxRackTempNorm > 0.7) {
      components.storageBonus = 0.5;
    }

    // Dynamic weights
    const weights = {
      energyCost: 1.0,
      temperatureControl: maxRackTempNorm > 0.67 ? 3.0 : 1.5,
      rackSafety: maxRackTempNorm > 0.7 ? 3.0 : 1.0,
      tempUniformity: 0.8,
      pueEfficiency: 0.7,
      fanWear: 0.5,
      storageValue: 0.5,
      workloadBalance: 0.5,
      failurePenalty: 3.0,
      actionPenalty: 1.0
    };

    // Calculate total reward
    return Object.entries(components).reduce((total, [key, value]) => {
      return total + (value * (weights[key] || 1));
    }, 0);
  }

  async act(state) {
    if (!this.model || !Array.isArray(state)) {
      return ACTIONS.MAINTAIN; // Fallback action
    }

    try {
      return tf.tidy(() => {
        // Ensure state is properly formatted
        const cleanState = this.sanitizeState(state);

        // Convert to tensor with correct shape [1, 20]
        const stateTensor = tf.tensor2d([cleanState], [1, 20]);

        // Add validation
        if (stateTensor.shape[1] !== 20) {
          console.error('Tensor shape mismatch:', stateTensor.shape);
          return ACTIONS.MAINTAIN;
        }

        const qValues = this.model.predict(stateTensor);
        return tf.argMax(qValues, 1).dataSync()[0];
      });
    } catch (error) {
      console.error('Action selection failed:', error);
      return ACTIONS.MAINTAIN;
    }
  }

  async safePredict(model, input) {
    try {
      return await tf.tidy(() => {
        const inputTensor = tf.tensor2d(input, [input.length, input[0].length]);
        const prediction = model.predict(inputTensor);
        return prediction.array();
      });
    } catch (error) {
      console.error('Prediction failed:', error);
      // Return neutral Q-values
      return Array(input.length).fill(
        Array(Object.keys(ACTIONS).length).fill(0)
      );
    }
  }

  async train() {
    if (this.isTraining || this.memoryBuffer.length < this.batchSize) {
      return null;
    }
    console.log('training ...')

    this.isTraining = true;
    let lossValue = null;

    try {
      // Verify backend first
      if (!tf.backend()) {
        await this.resetBackend();
      }

      const batch = this.sampleFromMemory();
      const states = batch.map(exp => this.sanitizeState(exp.state));
      const nextStates = batch.map(exp => this.sanitizeState(exp.nextState));

      // Create tensors outside tidy since we need them async
      const statesTensor = tf.tensor2d(states, [batch.length, states[0].length]);
      const nextStatesTensor = tf.tensor2d(nextStates, [batch.length, nextStates[0].length]);

      try {
        // Calculate targets - separate async operations
        const nextQs = this.targetModel.predict(nextStatesTensor);
        const nextQsArray = await nextQs.array();
        nextQs.dispose();

        const targets = batch.map((exp, i) => {
          const maxNextQ = exp.done ? 0 : Math.max(...nextQsArray[i]);
          return exp.reward + this.gamma * maxNextQ;
        });

        // Get current predictions
        const currentQs = this.model.predict(statesTensor);
        const currentQsArray = await currentQs.array();
        currentQs.dispose();

        // Create target Qs
        const targetQs = currentQsArray.map((q, i) => {
          const updated = [...q];
          updated[batch[i].action] = targets[i];
          return updated;
        });

        const targetsTensor = tf.tensor2d(targetQs, [batch.length, targetQs[0].length]);

        // Train the model - this is async but we'll handle it separately
        const history = await this.model.fit(statesTensor, targetsTensor, {
          epochs: 1,
          verbose: 0,
          batchSize: this.batchSize,
          callbacks: {
            onBatchEnd: () => tf.nextFrame()
          }
        });

        lossValue = history.history.loss[0];
        targetsTensor.dispose();
      } finally {
        // Ensure tensors are disposed even if errors occur
        statesTensor.dispose();
        nextStatesTensor.dispose();
      }

      // Update exploration rate
      this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);

      // Update target network
      if (++this.stepCount % config.training.targetUpdateFreq === 0) {
        await this.updateTargetModel();
      }
      console.log('training done');
    } catch (error) {
      console.error('Training error:', error);
      await this.resetBackend();
    } finally {
      this.isTraining = false;
      return lossValue;
    }
  }

  // Add these helper methods to your class:
  async safeTensorToArray(tensor) {
    try {
      return await tensor.array();
    } catch (e) {
      console.error('Tensor to array conversion failed:', e.message);
      throw new Error(`Failed to convert tensor: ${e.message}`);
    }
  }

  async safeUpdateTargetModel() {
    try {
      await this.updateTargetModel();
    } catch (e) {
      console.error('Target network update failed:', e.message);
      await this.resetBackend();
    }
  }

  async protectedModelPredict(input) {
    while (this._modelLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this._modelLock = true;
    try {
      return await tf.tidy(() => {
        return this.model.predict(tf.tensor2d(input, [input.length, input[0].length]).array());
      });
    } finally {
      this._modelLock = false;
    }
  }

  async resetBackend() {
    console.log('Resetting TensorFlow backend...');
    await tf.ready();
    tf.setBackend('tensorflow');
    console.log('Backend reset complete');
  }

  disposeTensors(tensors) {
    tensors.forEach(t => {
      try {
        if (t && !t.isDisposed) t.dispose();
      } catch (e) {
        console.warn('Tensor disposal warning:', e.message);
      }
    });
  }
  async saveModel() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const path = `file://./saved_models/model-${timestamp}`;
      await this.model.save(path);
      console.log(`Model saved to ${path}`);
      return path;
    } catch (error) {
      console.error('Model save failed:', error);
      return null;
    }
  }
}

class EnhancedSimulation {
  constructor() {
    this.socket = io("http://localhost:3000");
    this.env = new EnhancedDataCenterEnvironment('data_center', this.socket);
    this.agent = new EnhancedDQNAgent(this.env);
    this.isRunning = false;
    this.speed = 1;
    this.intervalId = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.setupSocketListeners();
    this.intervalId = setInterval(
      () => this.step(),
      config.environment.actionInterval / this.speed
    );
    console.log('Simulation started');
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.intervalId);
    console.log('Simulation paused');
  }

  async step() {
    if (!this.isRunning) return;

    try {
      const oldState = this.env.getNormalizedState();
      const action = await this.agent.act(oldState);

      // Execute action
      this.env.executeAction(action);

      // Get new state and reward
      const newState = this.env.getNormalizedState();
      const reward = this.agent.calculateReward(oldState, newState, action);
      const done = (this.env.failureRisk > 0.8);

      // Train agent
      this.agent.remember(oldState, action, reward, newState, done);
      const loss = await this.agent.train();

      const ACTION_NAMES = Object.fromEntries(
        Object.entries(ACTIONS).map(([name, value]) => [value, name])
      );  

      console.log(`[Step ${this.agent.stepCount}] ` +
        `${ACTION_NAMES[action]} | ` +
        `Reward: ${reward.toFixed(2)} | ` +
        `Epsilon: ${this.agent.epsilon.toFixed(4)} | ` +
        `Loss: ${loss?.toFixed(4) || 'N/A'} | ` +
        `Risk: ${this.env.failureRisk.toFixed(4)}`);

      // Record and log
      const status = this.env.emitStatusUpdate(action);
      //console.log("status", status.data)

      
      
    } catch (error) {
      console.error('Simulation step error:', error);
    }
  }

  setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.socket.emit("register", { agentId: "data_center" });
    });

    this.socket.on('disconnect', () => {
      console.log("Disconnected from server");
      this.pause();
    });

    this.socket.on("message", (msg) => {
      if (msg.data?.value) {
        this.env.targetTemperature.value = msg.data.value;
      }
    });
  }
}

// Initialize and start simulation
const simulation = new EnhancedSimulation();
simulation.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down simulation...');
  simulation.pause();
  clearInterval(simulation.externalUpdateInterval);
  process.exit();
});