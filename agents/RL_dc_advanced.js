import * as tf from '@tensorflow/tfjs-node';
import { io } from "socket.io-client";
import fs from 'fs';
import path from 'path';

const config = {
    environment: {
        updateInterval: 10000,
        updateExternalInterval: 30000,
        actionInterval: 1000,
        maxModelsToKeep: 5,
        rackCount: 10,
        maxRackPower: 20,         // kW per rack
        minRackPower: 5,          // kW per rack
        maxCoolingPower: 50,       // kW maximum cooling capacity
        baseCoolingPower: 30,      // kW baseline cooling
        coolingEffectPerFanPercent: 0.005, // °C reduction per 1% fan speed
        heatGainPerRackPower: 0.1,  // °C increase per 1 kW of rack power
        thermalStorageCapacity: 1000, // kWh
        initialThermalStorage: 300   // kWh,
    },
    model: {
        hiddenUnits: [256, 128],  // Array of layer sizes
        activation: 'relu',       // Activation function
        noiseScale: 0.1           // Noise scale factor
    },
    training: {
        gamma: 0.95,
        epsilon: 1.0,
        epsilonMin: 0.01,
        epsilonDecay: 0.995,
        learningRate: 0.001,
        batchSize: 32,
        memoryCapacity: 10000,
        targetUpdateFreq: 200,
        saveModelFreq: 1000,
        validationSplit: 0.2,
        gradClipValue: 1.0,
        nStepReturns: 3    }
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

class NoisyDense extends tf.layers.Layer {
    constructor(config) {
        super(config);

        // Validate required parameters
        if (config.units === undefined) {
            throw new Error('NoisyDense layer requires a units parameter');
        }

        // Layer configuration
        this.units = config.units;
        this.activation = this._getActivationFunction(config.activation || 'linear');
        this.useBias = config.useBias !== false;
        this.noiseScale = config.noiseScale || 0.1;

        // Regularizers
        this.kernelRegularizer = this._getRegularizer(config.kernelRegularizer);
        this.biasRegularizer = this._getRegularizer(config.biasRegularizer);
        this.activityRegularizer = this._getRegularizer(config.activityRegularizer);

        // Initializers
        this.kernelInitializer = this._getInitializer(config.kernelInitializer || 'glorotUniform');
        this.biasInitializer = this._getInitializer(config.biasInitializer || 'zeros');
        this.noiseKernelInitializer = this._getInitializer(config.noiseKernelInitializer || 'zeros');
        this.noiseBiasInitializer = this._getInitializer(config.noiseBiasInitializer || 'zeros');

        // Layer specification
        this.supportsMasking = true;
        this.inputSpec = [{ minNDim: 2 }];
    }

    _getRegularizer(regularizerConfig) {
        if (!regularizerConfig) return null;

        // If already a regularizer instance
        if (typeof regularizerConfig.apply === 'function') {
            return regularizerConfig;
        }

        // If string identifier
        if (typeof regularizerConfig === 'string') {
            return tf.regularizers.get(regularizerConfig);
        }

        // If config object
        if (regularizerConfig.className) {
            return tf.regularizers.get(regularizerConfig);
        }

        console.warn('Invalid regularizer configuration, skipping regularization');
        return null;
    }

    _getInitializer(initializerConfig) {
        if (typeof initializerConfig === 'string') {
            switch (initializerConfig.toLowerCase()) {
                case 'henormal': return tf.initializers.heNormal();
                case 'glorotuniform': return tf.initializers.glorotUniform();
                case 'zeros': return tf.initializers.zeros();
                case 'ones': return tf.initializers.ones();
                default: return tf.initializers.glorotUniform();
            }
        }

        if (initializerConfig && typeof initializerConfig.apply === 'function') {
            return initializerConfig;
        }

        console.warn('Invalid initializer, using glorotUniform');
        return tf.initializers.glorotUniform();
    }

    _getActivationFunction(name) {
        const activations = {
            'relu': tf.relu,
            'sigmoid': tf.sigmoid,
            'tanh': tf.tanh,
            'softmax': tf.softmax,
            'linear': tf.identity
        };
        return activations[name.toLowerCase()] || tf.identity;
    }

    build(inputShape) {
        if (!inputShape || inputShape.length < 2) {
            throw new Error('Input shape must have at least 2 dimensions');
        }

        const inputDim = inputShape[inputShape.length - 1];

        // Main weights
        this.kernel = this.addWeight(
            'kernel',
            [inputDim, this.units],
            'float32',
            this.kernelInitializer,
            this.kernelRegularizer,
            true
        );

        // Noise weights
        this.noiseKernel = this.addWeight(
            'noise_kernel',
            [inputDim, this.units],
            'float32',
            this.noiseKernelInitializer,
            null,  // No regularization for noise weights
            true
        );

        if (this.useBias) {
            this.bias = this.addWeight(
                'bias',
                [this.units],
                'float32',
                this.biasInitializer,
                this.biasRegularizer,
                true
            );

            this.noiseBias = this.addWeight(
                'noise_bias',
                [this.units],
                'float32',
                this.noiseBiasInitializer,
                null,  // No regularization for noise bias
                true
            );
        }

        this.built = true;
    }

    call(inputs, kwargs) {
        return tf.tidy(() => {
            const input = inputs[0];
            if (input.shape.length !== 2) {
                throw new Error('Input must be 2D');
            }

            // Generate noise samples
            const noiseInput = tf.randomNormal([input.shape[1], this.units], 0, this.noiseScale);
            const noiseOutput = tf.randomNormal([this.units], 0, this.noiseScale);

            // Create noisy weights
            const noisyWeights = tf.add(
                this.kernel.read(),
                tf.mul(this.noiseKernel.read(), noiseInput)
            );

            // Compute output
            let output = tf.matMul(input, noisyWeights);

            if (this.useBias) {
                const noisyBias = tf.add(
                    this.bias.read(),
                    tf.mul(this.noiseBias.read(), noiseOutput)
                );
                output = tf.add(output, noisyBias);
            }

            // Apply activation
            const activated = this.activation(output);

            // Apply activity regularizer if specified
            if (this.activityRegularizer) {
                this.addLoss(this.activityRegularizer.apply(activated));
            }

            return activated;
        });
    }

    getConfig() {
        const baseConfig = super.getConfig();
        return {
            ...baseConfig,
            units: this.units,
            activation: this.activation.name || 'linear',
            useBias: this.useBias,
            kernelInitializer: this.kernelInitializer.getClassName(),
            biasInitializer: this.biasInitializer.getClassName(),
            kernelRegularizer: this.kernelRegularizer ? this.kernelRegularizer.getClassName() : null,
            biasRegularizer: this.biasRegularizer ? this.biasRegularizer.getClassName() : null,
            activityRegularizer: this.activityRegularizer ? this.activityRegularizer.getClassName() : null,
            noiseScale: this.noiseScale
        };
    }

    static get className() {
        return 'NoisyDense';
    }
}

// Register the custom layer
tf.serialization.registerClass(NoisyDense);



class StateNormalizer {
    constructor(stateSize) {
        this.means = Array(stateSize).fill(0);
        this.stds = Array(stateSize).fill(1);
        this.count = 0;
        this.minValues = Array(stateSize).fill(Infinity);
        this.maxValues = Array(stateSize).fill(-Infinity);
    }

    update(state) {
        this.count++;

        // Update min/max
        state.forEach((val, i) => {
            this.minValues[i] = Math.min(this.minValues[i], val);
            this.maxValues[i] = Math.max(this.maxValues[i], val);
        });

        // Welford's algorithm for online mean/std calculation
        const delta = state.map((val, i) => val - this.means[i]);
        this.means = this.means.map((mean, i) => mean + delta[i] / this.count);
        this.stds = this.stds.map((std, i) => {
            if (this.count > 1) {
                return Math.sqrt(
                    ((this.count - 1) * std * std + delta[i] * (state[i] - this.means[i])) /
                    this.count
                );
            }
            return std;
        });
    }

    normalize(state) {
        // Use min-max normalization if std is near zero
        return state.map((val, i) => {
            if (this.stds[i] < 1e-7) {
                const range = this.maxValues[i] - this.minValues[i];
                return range > 0 ? (val - this.minValues[i]) / range : 0;
            }
            return (val - this.means[i]) / this.stds[i];
        });
    }

    save(filePath) {
        const data = {
            means: this.means,
            stds: this.stds,
            count: this.count,
            minValues: this.minValues,
            maxValues: this.maxValues
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    static load(filePath) {
        const data = JSON.parse(fs.readFileSync(filePath));
        const normalizer = new StateNormalizer(data.means.length);
        Object.assign(normalizer, data);
        return normalizer;
    }
}

class PrioritizedReplayMemory {
    constructor(capacity, alpha = 0.6, beta = 0.4, betaIncrement = 0.001) {
        this.capacity = capacity;
        this.alpha = alpha;
        this.beta = beta;
        this.betaIncrement = betaIncrement;
        this.prioritySum = 0;
        this.maxPriority = 1;
        this.memory = [];
        this.priorities = [];
        this.position = 0;
        this.size = 0;
    }

    add(experience, priority = null) {
        priority = priority !== null ? priority : this.maxPriority;

        if (this.size < this.capacity) {
            this.memory.push(experience);
            this.priorities.push(priority);
            this.size++;
        } else {
            this.prioritySum -= this.priorities[this.position];
            this.memory[this.position] = experience;
            this.priorities[this.position] = priority;
            this.position = (this.position + 1) % this.capacity;
        }

        this.prioritySum += priority;
        this.maxPriority = Math.max(this.maxPriority, priority);
    }

    sample(batchSize) {
        if (this.size === 0) return null;

        this.beta = Math.min(1, this.beta + this.betaIncrement);

        // Create sampling distribution
        const probabilities = this.priorities.slice(0, this.size).map(p => Math.pow(p, this.alpha));
        const sumProb = probabilities.reduce((sum, p) => sum + p, 0);
        const normalizedProbs = probabilities.map(p => p / sumProb);

        // Sample indices
        const indices = [];
        const weights = [];
        for (let i = 0; i < batchSize; i++) {
            let r = Math.random();
            let sum = 0;
            let idx = 0;

            while (idx < this.size - 1 && sum < r) {
                sum += normalizedProbs[idx];
                idx++;
            }

            indices.push(idx);

            // Importance sampling weights
            const prob = normalizedProbs[idx];
            const weight = Math.pow(this.size * prob, -this.beta);
            weights.push(weight);
        }

        // Normalize weights
        const maxWeight = Math.max(...weights);
        const normalizedWeights = weights.map(w => w / maxWeight);

        // Retrieve samples
        const samples = indices.map(idx => this.memory[idx]);

        return {
            samples,
            indices,
            weights: normalizedWeights
        };
    }

    updatePriorities(indices, priorities) {
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const oldPriority = this.priorities[idx];
            this.priorities[idx] = priorities[i];
            this.prioritySum += priorities[i] - oldPriority;
            this.maxPriority = Math.max(this.maxPriority, priorities[i]);
        }
    }

    get length() {
        return this.size;
    }
}

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

        this.consecutiveDangerSteps = 0;
        this.failureRiskHistory = [];

        this.rackPowerDraws = Array(config.environment.rackCount).fill(0).map((_, i) =>
            new Sensor(
                (config.environment.minRackPower + config.environment.maxRackPower) / 2, // initial
                config.environment.minRackPower,  // min
                config.environment.maxRackPower,  // max
                0.5, 
                `Rack ${i+1} Power`
            )
        );
        
        this.totalPower = new Sensor(150, 50, 500, 10, 'Total Power');
        this.coolingPower = new Sensor(
            config.environment.baseCoolingPower, 
            0, 
            config.environment.maxCoolingPower, 
            5, 
            'Cooling Power'
        );
        
        // Thermal storage using config values
        this.thermalStorage = {
            capacity: config.environment.thermalStorageCapacity,
            current: config.environment.initialThermalStorage,
            chargeRate: config.environment.maxCoolingPower * 0.5, // 50% of max cooling
            dischargeRate: config.environment.maxCoolingPower * 0.8, // 80% of max cooling
            efficiency: 0.85
        };

        // Sensors
        this.workload = new Sensor(0.5, 0, 1, 0.1, 'Workload');
        this.ambientTemperature = new Sensor(25, 15, 30, 1, 'Ambient Temp');
        this.humidity = new Sensor(50, 10, 90, 5, 'Humidity');
        this.targetTemperature = new Sensor(22, 18, 28, 0, 'Target Temp');
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

        // External data
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
                this.updateEnergyPrices();
            }
        });
    }

    updateEnergyPrices() {
        const weather = this.currentWeather;
        this.currentEnergyPrices = {
            current: weather.temperature < 5 || weather.temperature > 25 ? 0.2 : 0.08,
            forecast: Array(24).fill(weather.temperature < 5 || weather.temperature > 25 ? 0.2 : 0.08)
        };
    }

    calculatePUE() {
        const basePUE = 1.2;
        const coolingEfficiency = 1 - (this.fanSpeed.get() / 100) * 0.15;
        const ambientEffect = (this.ambientTemperature.get() - 20) * 0.01;
        return Math.min(2.0, Math.max(1.1, basePUE + ambientEffect + (1 - coolingEfficiency)));
    }

    updateTemperatures() {
        const ambientTemp = this.ambientTemperature.get();
        
        this.rackTemperatures.forEach((rack, i) => {
          // Server heat generation (always ≥0)
          const heatGain = this.rackPowerDraws[i].get() * 0.1; // 0.1°C per kW
          
          // Cooling effect (can't exceed heat gain + ambient)
          const maxCooling = heatGain + (rack.value - ambientTemp) * 0.1;
          const coolingEffect = Math.min(
            maxCooling,
            (this.fanSpeed.get() / 100) * config.environment.maxCoolingPower * 0.02
          );
      
          // Update temperature (never < ambient)
          rack.value = Math.max(
            ambientTemp,
            rack.value + (heatGain - coolingEffect)
          );
          console.log(
            `Rack ${i}: ${rack.value.toFixed(2)}°C | ` +
            `Ambient: ${ambientTemp.toFixed(2)}°C | ` +
            `Cooling: ${coolingEffect.toFixed(2)}°C`
          );
        });
      }

    updateMetrics() {
        this.workload.update();
        this.ambientTemperature.update();
        this.humidity.update();
      
        // Update rack power draws based on workload
        this.rackPowerDraws.forEach(rack => {
          rack.value = 5 + (this.workload.get() * (config.environment.maxRackPower - 5));
          rack.update();
        });
      
        this.updateTemperatures(); 
        
        this.fanSpeed.update();
        this.airflow.value = this.fanSpeed.get() * 5;
        this.coolingPower.value = (this.fanSpeed.get() / 100) * config.environment.maxCoolingPower;
        this.coolingPower.update();
      
        // Calculate PUE and total power
        this.pue.value = this.calculatePUE();
        const itPower = this.rackPowerDraws.reduce((sum, rack) => sum + rack.get(), 0);
        this.totalPower.value = itPower * this.pue.value;
        this.totalPower.update();
      
        // Update failure risk AFTER temperature updates
        this.updateFailureRisk();
    }

    getActionEffects(totalITPower) {
        return {
            [ACTIONS.COOL_INCREMENT_SMALL]: { 
                temp: -0.2, 
                fan: 5, 
                energy: 0.05 * totalITPower // +5% of IT load
            },
            [ACTIONS.COOL_DECREMENT_SMALL]: { 
                temp: 0.2, 
                fan: -5, 
                energy: -0.03 * totalITPower 
            },
            [ACTIONS.FAN_INCREMENT_SMALL]: { 
                temp: -0.1, 
                fan: 10, 
                energy: 0.07 * totalITPower 
            },
            [ACTIONS.COOL_INCREMENT_LARGE]: { 
                temp: -0.5, 
                fan: 10, 
                energy: 0.1 * totalITPower 
            },
            [ACTIONS.COOL_DECREMENT_LARGE]: { 
                temp: 0.5, 
                fan: -10, 
                energy: -0.07 * totalITPower 
            },
            [ACTIONS.FAN_INCREMENT_LARGE]: { 
                temp: -0.2, 
                fan: 20, 
                energy: 0.12 * totalITPower 
            },
            [ACTIONS.MAINTAIN]: { 
                temp: 0, 
                fan: 0, 
                energy: 0 
            },
            [ACTIONS.THERMAL_STORAGE_CHARGE]: { 
                temp: 0.5, 
                fan: 0, 
                energy: this.thermalStorage.chargeRate 
            },
            [ACTIONS.THERMAL_STORAGE_DISCHARGE]: { 
                temp: -0.5, 
                fan: 0, 
                energy: -this.thermalStorage.dischargeRate * 0.6 
            }
        };
    }

    updateExternalMetrics() {
        this.socket.emit("message", {
            from: this.agentId,
            to: "weather_agent",
            data: { request: "get_weather", city: "Brussels" }
        });
    }

    updateFailureRisk() {
        // 1. Temperature Analysis
        const rackTemps = this.rackTemperatures.map(r => r.get());
        const maxRackTemp = Math.max(...rackTemps);
        const avgRackTemp = rackTemps.reduce((s, t) => s + t, 0) / rackTemps.length;

        // Non-linear temperature penalty (more severe above 25°C)
        const tempPenalty = Math.min(1, Math.pow(Math.max(0, maxRackTemp - 25) / 10, 2));

        // 2. Thermal Gradient Penalty
        const tempGradient = Math.max(0, maxRackTemp - avgRackTemp - 5) * 0.02;

        // 3. Humidity Effect (worse at high temps)
        const humidityEffect = (this.humidity.get() > 70) ?
            Math.pow((this.humidity.get() - 70) / 30, 2) * (1 + (maxRackTemp - 25) / 10) :
            0;

        // 4. Fan Stress (cumulative + instantaneous)
        const fanStress = Math.min(1,
            (this.fanSpeed.history.filter(s => s > 80).length / 100 +  // Long-term
                Math.max(0, this.fanSpeed.get() - 90) * 0.01               // Immediate
            ));

        // 5. Workload Impact
        const workloadImpact = this.workload.get() * 0.3 *
            (1 + (this.workload.history.filter(w => w > 0.8).length / 50));

        // Composite Risk (weighted sum capped at 1)
        this.failureRisk = Math.min(1,
            0.4 * tempPenalty +
            0.2 * tempGradient +
            0.15 * humidityEffect +
            0.15 * fanStress +
            0.1 * workloadImpact
        );

        // Time-in-danger multiplier
        if (this.failureRisk > 0.7) {
            this.consecutiveDangerSteps = (this.consecutiveDangerSteps || 0) + 1;
            this.failureRisk = Math.min(1,
                this.failureRisk * (1 + this.consecutiveDangerSteps / 20)
            );
        } else {
            this.consecutiveDangerSteps = 0;
        }

        // Track history for diagnostics
        this.failureRiskHistory.push(this.failureRisk);
        if (this.failureRiskHistory.length > 1000) {
            this.failureRiskHistory.shift();
        }
    }

    getNormalizedState() {
        // Core metrics
        const coreState = [
            this.totalPower.getNormalized(),
            this.workload.getNormalized(),
            (this.ambientTemperature.get() - 15) / 15,
            (this.humidity.get() - 10) / 80,
            (this.targetTemperature.get() - 18) / 10,
            this.fanSpeed.getNormalized(),
            (this.airflow.get() - 100) / 400,
            (this.pue.get() - 1.0) / 2.0
        ];

        // Rack temperatures
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
        if (this.failureRisk > 0.9) {
            action = this.getEmergencyAction();
          }
        
          const totalITPower = this.rackPowerDraws.reduce((sum, rack) => sum + rack.get(), 0);
          const effects = this.getActionEffects(totalITPower)[action];
          
          if (!effects) return;
  
          // Handle thermal storage actions
          if (action === ACTIONS.THERMAL_STORAGE_CHARGE) {
              const chargeAmount = Math.min(
                  this.thermalStorage.capacity - this.thermalStorage.current,
                  this.thermalStorage.chargeRate
              );
              this.thermalStorage.current += chargeAmount * this.thermalStorage.efficiency;
          }
          else if (action === ACTIONS.THERMAL_STORAGE_DISCHARGE) {
              const dischargeAmount = Math.min(
                  this.thermalStorage.current,
                  this.thermalStorage.dischargeRate
              );
              this.thermalStorage.current -= dischargeAmount;
          }
  
          // Apply cooling/fan effects
          this.fanSpeed.value = Math.min(100, Math.max(0, this.fanSpeed.value + effects.fan));
          
          // Update temperatures
          this.ambientTemperature.value += effects.temp * 0.5;
          this.rackTemperatures.forEach(rack => {
              rack.value += effects.temp * 0.3;
          });
  

        const currentFanSpeed = this.fanSpeed.get();

        // Update airflow based on fan speed
        this.airflow.value = this.fanSpeed.value * 5;

        this.updateFailureRisk();
    }

    emitStatusUpdate(action) {
        let status = {
            from: this.agentId,
            data: {
                energy: this.totalPower.get().toFixed(2),
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
                outsideHumidity: this.currentWeather.humidity.toFixed(2)
            }
        };

        const ACTION_NAMES = Object.fromEntries(
            Object.entries(ACTIONS).map(([name, value]) => [value, name])
        );

        console.log(`[${this.agentId}] ${ACTION_NAMES[action]} | Energy:${this.totalPower.get().toFixed(2)}kW | Temp:${this.ambientTemperature.get().toFixed(2)}°C/${this.targetTemperature.get().toFixed(2)}°C | Fans:${this.fanSpeed.get().toFixed(2)}% | Risk:${(this.failureRisk * 100).toFixed(2)}% | Storage:${this.thermalStorage.current.toFixed(1)}kWh`);

        if (action && action !== "UPDATE")
            status.action = action;

        this.socket.emit('message', status);
        return status;
    }
}

class EnhancedDQNAgent {
    constructor(env) {
        this.env = env;
        this.isTraining = false;
        this._modelLock = false;

        // State indices
        this.stateIndices = {
            ENERGY: 0,
            WORKLOAD: 1,
            AMBIENT_TEMP: 2,
            HUMIDITY: 3,
            TARGET_TEMP: 4,
            FAN_SPEED: 5,
            AIRFLOW: 6,
            PUE: 7,
            RACK_TEMPS: 8,
            STORAGE_LEVEL: 8 + config.environment.rackCount,
            STORAGE_EFFICIENCY: 9 + config.environment.rackCount
        };

        // Hyperparameters
        this.gamma = config.training.gamma;
        this.epsilon = config.training.epsilon;
        this.epsilonMin = config.training.epsilonMin;
        this.epsilonDecay = config.training.epsilonDecay;
        this.learningRate = config.training.learningRate;
        this.batchSize = config.training.batchSize;
        this.memoryCapacity = config.training.memoryCapacity;

        // Components
        this.stateNormalizer = new StateNormalizer(8 + config.environment.rackCount + 2);
        this.memory = new PrioritizedReplayMemory(this.memoryCapacity);
        this.rewardComponents = null;

        // Tracking
        this.stepCount = 0;
        this.lastLoss = null;
        this.bestValidationLoss = Infinity;

        // External factors
        this.weatherAdjustment = 0;
        this.currentEnergyPrice = 0.1;

        if (!tf.backend()) {
            console.log('Initializing TensorFlow backend...');
            tf.setBackend('tensorflow');
        }

        // Models
        try {
            this.model = this.buildModel(true);
            this.targetModel = this.buildModel(true);
            console.log("Main model layers:");
            this.model.layers.forEach((layer, i) => {
                console.log(`${i}. ${layer.name} - ${layer.getWeights().length} weights`);
            });

            console.log("Target model layers:");
            this.targetModel.layers.forEach((layer, i) => {
                console.log(`${i}. ${layer.name} - ${layer.getWeights().length} weights`);
            });
        } catch (error) {
            console.error('Model build failed:', error);
            throw error;
        }
        this.updateTargetModel();
    }

    getEmergencyAction() {
        const maxRackTemp = Math.max(...this.rackTemperatures.map(r => r.get()));
        const currentFanSpeed = this.fanSpeed.get();

        // Priority 1: Cool hottest racks (if fans aren't maxed)
        if (maxRackTemp > 28 && currentFanSpeed < 100) {
            return ACTIONS.COOL_INCREMENT_LARGE;
        }

        // Priority 2: Discharge thermal storage if available
        if (this.thermalStorage.current > this.thermalStorage.dischargeRate &&
            maxRackTemp > 26) {
            return ACTIONS.THERMAL_STORAGE_DISCHARGE;
        }

        // Priority 3: Max fans (only if not already at max)
        if (currentFanSpeed < 95) {
            return ACTIONS.FAN_INCREMENT_LARGE;
        }

        // Last resort - try cooling if possible
        if (currentFanSpeed >= 100 && maxRackTemp > 27) {
            return ACTIONS.COOL_INCREMENT_LARGE;
        }

        return ACTIONS.MAINTAIN;
    }

    isValidAction(action, currentState) {
        const storageLevel = currentState[this.stateIndices.STORAGE_LEVEL] *
            this.env.thermalStorage.capacity;

        if (action === ACTIONS.THERMAL_STORAGE_DISCHARGE) {
            return storageLevel >= this.env.thermalStorage.dischargeRate;
        }

        if (action === ACTIONS.THERMAL_STORAGE_CHARGE) {
            const availableCapacity = this.env.thermalStorage.capacity - storageLevel;
            return availableCapacity >= this.env.thermalStorage.chargeRate;
        }
        const currentFanSpeed = this.env.fanSpeed.get();
        if ((action === ACTIONS.FAN_INCREMENT_SMALL ||
            action === ACTIONS.FAN_INCREMENT_LARGE) &&
            currentFanSpeed >= 100) {
            return false;
        }
        return true;
    }

    async updateTargetModel() {
        while (this._modelLock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this._modelLock = true;

        try {
            console.log("Main model weights count:", this.model.getWeights().length);
            console.log("Target model weights count:", this.targetModel.getWeights().length);

            // Verify model architectures match
            if (this.model.getWeights().length !== this.targetModel.getWeights().length) {
                throw new Error(`Model architecture mismatch: Main has ${this.model.getWeights().length} weights, Target has ${this.targetModel.getWeights().length}`);
            }

            const modelWeights = this.model.getWeights();
            await this.targetModel.setWeights(modelWeights);
        } catch (error) {
            console.error('Target update failed:', error);
            // Reinitialize target model if there's a mismatch
            this.targetModel = this.buildModel(true);
            await this.targetModel.setWeights(this.model.getWeights());
        } finally {
            this._modelLock = false;
        }
    }

    buildModel(useNoisyLayers = true) {
        const inputSize = 8 + config.environment.rackCount + 2;
        const numActions = Object.keys(ACTIONS).length;

        const model = tf.sequential();

        // Input layer with explicit initializer
        model.add(tf.layers.dense({
            units: 256,
            inputShape: [inputSize],
            activation: config.model.activation,
            kernelInitializer: 'glorotUniform',
            biasInitializer: 'zeros',
            name: 'input_layer'
        }));

        if (useNoisyLayers) {
            model.add(new NoisyDense({
                units: 256,
                activation: config.model.activation,
                noiseScale: config.model.noiseScale,
                kernelInitializer: 'glorotUniform',
                biasInitializer: 'zeros',
                kernelRegularizer: tf.regularizers.l1l2({ l1: 0.01, l2: 0.01 }),
                biasRegularizer: tf.regularizers.l2({ l2: 0.01 }),
                name: 'noisy_layer'
            }));
        }

        // Output layer
        model.add(tf.layers.dense({
            units: numActions,
            activation: 'linear',
            kernelInitializer: 'glorotUniform',
            biasInitializer: 'zeros',
            name: 'output_layer'
        }));

        model.compile({
            optimizer: tf.train.adam(config.training.learningRate),
            loss: tf.losses.huberLoss
        });

        return model;
    }

    sanitizeState(state) {
        const expectedLength = 8 + config.environment.rackCount + 2;

        if (!Array.isArray(state) || state.length !== expectedLength) {
            console.error(`Invalid state format. Expected length ${expectedLength}, got ${state.length}`);
            return Array(expectedLength).fill(0);
        }

        return state.map((val, idx) => {
            const num = Number(val);

            if (idx === this.stateIndices.ENERGY) {
                return Math.max(0, Math.min(500, num));
            }
            if (idx === this.stateIndices.AMBIENT_TEMP) {
                return Math.max(15, Math.min(35, num));
            }

            return Number.isFinite(num) ? num : 0;
        });
    }

    remember(state, action, reward, nextState, done) {
        const cleanState = this.sanitizeState(state);
        const cleanNextState = this.sanitizeState(nextState);

        // Update state normalizer
        this.stateNormalizer.update(cleanState);
        this.stateNormalizer.update(cleanNextState);

        // Calculate initial priority (use max priority for new experiences)
        const priority = this.memory.maxPriority;
        this.memory.add({
            state: cleanState,
            action,
            reward,
            nextState: cleanNextState,
            done
        }, priority);
    }

    async calculateReward(oldState, newState, action) {
        // Weather and energy price adjustments
        this.weatherAdjustment = Math.min(5, Math.max(-5,
            (this.env.currentWeather.temperature - this.env.ambientTemperature.value) * 0.1
        ));
        this.currentEnergyPrice = this.env.currentEnergyPrices.current;
        const cleanNewState = this.sanitizeState(newState);

        // Action magnitude mapping
        const ACTION_MAGNITUDE = {
            [ACTIONS.COOL_INCREMENT_SMALL]: 0.5,
            [ACTIONS.COOL_DECREMENT_SMALL]: 0.5,
            [ACTIONS.FAN_INCREMENT_SMALL]: 0.5,
            [ACTIONS.COOL_INCREMENT_LARGE]: 1.0,
            [ACTIONS.COOL_DECREMENT_LARGE]: 1.0,
            [ACTIONS.FAN_INCREMENT_LARGE]: 1.0,
            [ACTIONS.MAINTAIN]: 0.1,
            [ACTIONS.THERMAL_STORAGE_CHARGE]: 0.8,
            [ACTIONS.THERMAL_STORAGE_DISCHARGE]: 0.8
        };

        // Extract normalized values
        const {
            [this.stateIndices.ENERGY]: energyNorm,
            [this.stateIndices.AMBIENT_TEMP]: ambientTempNorm,
            [this.stateIndices.TARGET_TEMP]: targetTempNorm,
            [this.stateIndices.FAN_SPEED]: fanSpeedNorm,
            [this.stateIndices.PUE]: pueNorm,
            [this.stateIndices.STORAGE_LEVEL]: storageNorm,
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

        // Energy price factor
        const energyPriceFactor = 1 + (this.currentEnergyPrice / 0.20);

        // Initialize reward components tracking
        if (!this.rewardComponents) {
            this.rewardComponents = {
                energyCost: { sum: 0, count: 0 },
                temperatureControl: { sum: 0, count: 0 },
                rackSafety: { sum: 0, count: 0 },
                tempUniformity: { sum: 0, count: 0 },
                pueEfficiency: { sum: 0, count: 0 },
                fanWear: { sum: 0, count: 0 },
                storageValue: { sum: 0, count: 0 },
                workloadBalance: { sum: 0, count: 0 },
                failurePenalty: { sum: 0, count: 0 },
                actionPenalty: { sum: 0, count: 0 },
                storageBonus: { sum: 0, count: 0 }
            };
        }

        // Calculate reward components
        const components = {
            energyCost: -Math.min(3, Math.pow(energyNorm * energyPriceFactor, 1.5)),
            temperatureControl: -Math.min(1,
                (Math.abs(ambientTempNorm - targetTempNorm) * 0.7 +
                    Math.abs(maxRackTempNorm - 0.5) * 0.3
                ) * (1 + workloadNorm)),
            rackSafety: -Math.min(3, Math.pow(Math.max(0, maxRackTempNorm - 0.55), 3)),
            tempUniformity: -Math.min(1, rackTempGradient * 3),
            pueEfficiency: -Math.min(1, Math.abs(pueNorm - 0.25)),
            fanWear: -Math.min(1.5, Math.pow(fanSpeedNorm, 3)),
            storageValue: (storageNorm > 0.8 && energyPriceFactor > 1.5) ? 0.2 :
                (storageNorm < 0.2 && maxRackTempNorm > 0.5) ? -0.2 : 0,
            workloadBalance: -Math.min(1, Math.abs(workloadNorm - 0.5)),
            actionPenalty: -0.02 * (ACTION_MAGNITUDE[action] || 1),
            storageBonus: 0
        };

        const failurePenalty = -Math.min(5,
            Math.pow(this.env.failureRisk, 3) * 5 *
            (1 + (this.env.consecutiveDangerSteps / 10))
        );

        // Add to components
        components.failurePenalty = failurePenalty;

        // Increase penalty for actions that worsen failure risk
        if (this.env.failureRisk > 0.6 &&
            this.env.failureRisk > this.prevFailureRisk) {
            components.riskIncreasePenalty = -2 * (this.env.failureRisk - this.prevFailureRisk);
        }
        this.prevFailureRisk = this.env.failureRisk;

        // Action-specific bonuses
        if (action === ACTIONS.THERMAL_STORAGE_DISCHARGE && maxRackTempNorm > 0.7) {
            components.storageBonus = 0.5 * (1 - storageNorm);
        }
        else if (action === ACTIONS.THERMAL_STORAGE_CHARGE && energyPriceFactor < 1.2) {
            components.storageBonus = 0.3 * storageNorm;
        }

        // Dynamic weights
        const weights = {
            energyCost: 1.0,
            temperatureControl: maxRackTempNorm > 0.67 ? 3.0 : 1.5,
            rackSafety: maxRackTempNorm > 0.7 ? 4.0 : 2.0,
            tempUniformity: 0.8,
            pueEfficiency: 0.7,
            fanWear: 0.5,
            storageValue: 0.7,
            workloadBalance: 0.5,
            failurePenalty: 3.5,
            actionPenalty: 1.0,
            storageBonus: 1.0
        };

        // Update component tracking
        Object.keys(components).forEach(key => {
            if (this.rewardComponents[key]) {
                this.rewardComponents[key].sum += components[key] * (weights[key] || 1);
                this.rewardComponents[key].count++;
            }
        });

        // Log statistics periodically
        if (this.stepCount % 100 === 0) {
            console.log('Reward component averages:');
            Object.entries(this.rewardComponents).forEach(([key, stats]) => {
                if (stats.count > 0) {
                    console.log(`  ${key.padEnd(16)}: ${(stats.sum / stats.count).toFixed(3)} (n=${stats.count})`);
                }
            });
        }

        // Calculate total reward
        const totalReward = Object.entries(components).reduce((total, [key, value]) => {
            return total + (value * (weights[key] || 1));
        }, 0);

        return totalReward;
    }

    async act(state, training = true) {
        if (!this.model || !Array.isArray(state)) {
            return ACTIONS.MAINTAIN;
        }

        while (this._modelLock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this._modelLock = true;

        try {
            // Epsilon-greedy with temperature-based exploration
            if (training && Math.random() < this.epsilon) {
                const possibleActions = Object.values(ACTIONS).filter(action =>
                    this.isValidAction(action, state)
                );
                return possibleActions[Math.floor(Math.random() * possibleActions.length)];
            }

            const cleanState = this.sanitizeState(state);
            const normalizedState = this.stateNormalizer.normalize(cleanState);

            const stateTensor = tf.tensor2d([normalizedState], [1, normalizedState.length]);
            const qValues = await this.model.predict(stateTensor).array();
            stateTensor.dispose();

            // Filter out invalid actions by setting their Q-values to -Infinity
            const validQValues = qValues[0].map((q, action) =>
                this.isValidAction(action, state) ? q : -Infinity
            );

            // Temperature-based action selection
            const temperature = Math.max(0.1, 1 - (this.stepCount / 10000));
            const scaledQ = validQValues.map(q => q / temperature);
            const maxQ = Math.max(...scaledQ);
            const expQ = scaledQ.map(q => Math.exp(q - maxQ));
            const sumExpQ = expQ.reduce((sum, q) => sum + q, 0);
            const probs = expQ.map(q => q / sumExpQ);

            let cumulative = 0;
            const rand = Math.random();
            for (let i = 0; i < probs.length; i++) {
                cumulative += probs[i];
                if (rand <= cumulative) return i;
            }

            return ACTIONS.MAINTAIN; // Fallback
        } catch (error) {
            console.error('Action selection failed:', error);
            return ACTIONS.MAINTAIN;
        } finally {
            this._modelLock = false;
        }
    }

    async train() {
        if (this.isTraining || this.memory.length < this.batchSize) {
            return null;
        }

        this.isTraining = true;
        let lossValue = null;

        try {
            // Sample from prioritized memory
            const batchData = this.memory.sample(this.batchSize);
            if (!batchData) return null;

            const { samples, indices, weights } = batchData;
            const states = samples.map(exp => this.stateNormalizer.normalize(exp.state));
            const nextStates = samples.map(exp => this.stateNormalizer.normalize(exp.nextState));

            // Convert to tensors
            const statesTensor = tf.tensor2d(states, [samples.length, states[0].length]);
            const nextStatesTensor = tf.tensor2d(nextStates, [samples.length, nextStates[0].length]);
            const weightsTensor = tf.tensor1d(weights);

            try {
                // Calculate target Q-values using Double DQN
                const currentQNext = await this.model.predict(nextStatesTensor).array();
                const maxActions = currentQNext.map(qValues =>
                    qValues.reduce((iMax, q, i) => q > currentQNext[iMax] ? i : iMax, 0)
                );

                const targetQNext = await this.targetModel.predict(nextStatesTensor).array();
                const targets = samples.map((exp, i) => {
                    const maxNextQ = exp.done ? 0 : targetQNext[i][maxActions[i]];
                    return exp.reward + Math.pow(this.gamma, config.training.nStepReturns) * maxNextQ;
                });

                // Get current predictions
                const currentQs = await this.model.predict(statesTensor).array();

                // Update priorities based on TD error
                const tdErrors = samples.map((exp, i) =>
                    Math.abs(targets[i] - currentQs[i][exp.action])
                );
                this.memory.updatePriorities(indices, tdErrors);

                // Create target Qs
                const targetQs = currentQs.map((q, i) => {
                    const updated = [...q];
                    updated[samples[i].action] = targets[i];
                    return updated;
                });

                const targetsTensor = tf.tensor2d(targetQs, [samples.length, targetQs[0].length]);

                // Train with early stopping
                const history = await this.model.fit(statesTensor, targetsTensor, {
                    epochs: 1,
                    verbose: 0,
                    batchSize: this.batchSize,
                    //sampleWeight: weightsTensor,
                    validationSplit: config.training.validationSplit,
                    callbacks: {
                        onBatchEnd: () => tf.nextFrame(),
                        onEpochEnd: (epoch, logs) => {
                            if (logs.val_loss > 2 * logs.loss) {
                                this.model.stopTraining = true;
                            }
                            this.bestValidationLoss = Math.min(this.bestValidationLoss, logs.val_loss || Infinity);
                        }
                    }
                });

                lossValue = history.history.loss[0];
                this.lastLoss = lossValue;

                targetsTensor.dispose();
                weightsTensor.dispose();
            } finally {
                statesTensor.dispose();
                nextStatesTensor.dispose();
            }

            // Update exploration rate
            this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);

            // Update target network
            if (++this.stepCount % config.training.targetUpdateFreq === 0) {
                await this.updateTargetModel();
            }

            // Save model periodically
            if (this.stepCount % config.training.saveModelFreq === 0) {
                await this.saveModelWithMetadata();
            }
        } catch (error) {
            console.error('Training error:', error);
            await this.resetBackend();
        } finally {
            this.isTraining = false;
            return lossValue;
        }
    }

    async saveModelWithMetadata() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dirPath = path.join('./saved_models', `model-${timestamp}`);

        try {
            // Create directory if it doesn't exist
            if (!fs.existsSync('./saved_models')) {
                fs.mkdirSync('./saved_models');
            }

            // Save TensorFlow model
            await this.model.save(`file://${dirPath}`);

            // Save metadata
            const metadata = {
                timestamp,
                trainingSteps: this.stepCount,
                epsilon: this.epsilon,
                lastLoss: this.lastLoss,
                bestValidationLoss: this.bestValidationLoss,
                rewardStats: this.rewardComponents,
                hyperparameters: {
                    gamma: this.gamma,
                    learningRate: this.learningRate,
                    batchSize: this.batchSize,
                    memoryCapacity: this.memoryCapacity
                },
                environmentConfig: config.environment,
                modelConfig: config.model
            };

            fs.writeFileSync(path.join(dirPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

            // Save state normalizer
            this.stateNormalizer.save(path.join(dirPath, 'normalizer.json'));

            console.log(`Model saved to ${dirPath}`);
            return dirPath;
        } catch (error) {
            console.error('Failed to save model:', error);
            return null;
        }
    }

    async resetBackend() {
        console.log('Resetting TensorFlow backend...');
        await tf.ready();
        tf.setBackend('tensorflow');
        console.log('Backend reset complete');
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
        this.trainingLog = [];
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
            const action = await this.agent.act(oldState, true);

            // Execute action
            this.env.executeAction(action);

            // Get new state and reward
            const newState = this.env.getNormalizedState();
            const reward = await this.agent.calculateReward(oldState, newState, action);
            const done = (this.env.failureRisk > 0.8);

            // Train agent
            this.agent.remember(oldState, action, reward, newState, done);
            const loss = await this.agent.train();

            // Log training progress
            const logEntry = {
                step: this.agent.stepCount,
                action,
                reward,
                loss,
                epsilon: this.agent.epsilon,
                risk: this.env.failureRisk,
                energy: this.env.totalPower.get(),
                avgRackTemp: this.env.rackTemperatures.reduce((sum, rack) => sum + rack.get(), 0) / this.env.rackTemperatures.length
            };
            this.trainingLog.push(logEntry);

            // Print summary
            const ACTION_NAMES = Object.fromEntries(
                Object.entries(ACTIONS).map(([name, value]) => [value, name])
            );

            console.log(`[Step ${this.agent.stepCount}] ` +
                `${ACTION_NAMES[action]} | ` +
                `Reward: ${reward.toFixed(2)} | ` +
                `Epsilon: ${this.agent.epsilon?.toFixed(4)} | ` +
                `Loss: ${loss?.toFixed(4) || 'N/A'} | ` +
                `Risk: ${this.env.failureRisk.toFixed(4)}`);

            // Emit status update
            this.env.emitStatusUpdate(action);

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

    saveTrainingLog() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = `training_log_${timestamp}.json`;
        fs.writeFileSync(filePath, JSON.stringify(this.trainingLog, null, 2));
        console.log(`Training log saved to ${filePath}`);
    }
}

// Initialize and start simulation
const simulation = new EnhancedSimulation();
simulation.start();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down simulation...');
    simulation.pause();
    await simulation.agent.saveModelWithMetadata();
    simulation.saveTrainingLog();
    process.exit();
});