const axios = require('axios');

let Service, Characteristic;

// Base class implementing the AccessoryPlugin interface (Homebridge 2 compatible)
class TemperatureForecastAccessory {
  constructor(log, name, accessoryType, platform, api) {
    this.log = log;
    this.name = name;
    this.accessoryType = accessoryType; // 'high', 'low', or 'extreme_high'
    this.platform = platform;
    this.api = api;
    this.services = [];
    this.boundCharacteristics = [];

    this.log.info(`Initializing ${accessoryType} temperature accessory: ${name}`);

    const infoService = new Service.AccessoryInformation();
    infoService
      .setCharacteristic(Characteristic.Manufacturer, 'Temperature Forecast Plugin')
      .setCharacteristic(Characteristic.Model, 'Temperature Sensor')
      .setCharacteristic(Characteristic.Name, name)
      .setCharacteristic(Characteristic.SerialNumber, accessoryType + '-' + Date.now());
    this.services.push(infoService);
  }
  
  // Google Nest pattern: getServices method
  getServices() {
    return this.services;
  }
  
  // Google Nest pattern: bindCharacteristic method
  bindCharacteristic(service, characteristic, desc, getFunc, setFunc, format) {
    const actual = service.getCharacteristic(characteristic)
      .on('get', function (callback) {
        const val = getFunc.bind(this)();
        if (callback) callback(null, val);
      }.bind(this))
      .on('change', function (change) {
        let disp = change.newValue;
        if (format && disp !== null) {
          disp = format(disp);
        }
        this.log.debug(`${desc} for ${this.name} changed to: ${disp}`);
      }.bind(this));
      
    if (setFunc) {
      actual.on('set', setFunc.bind(this));
    }
    
    // Track bound characteristics for updateData() calls
    this.boundCharacteristics.push([service, characteristic, getFunc]);
    
    return actual;
  }
  
  // Google Nest pattern: updateData method
  updateData() {
    this.boundCharacteristics.forEach(([service, characteristic, getFunc]) => {
      service.getCharacteristic(characteristic).updateValue(getFunc());
    });
  }
}

// High Temperature Accessory - extends base class
class HighTempAccessory extends TemperatureForecastAccessory {
  constructor(log, name, platform, api) {
    // Call parent constructor
    super(log, name, 'high', platform, api);
    
    const sensorService = new Service.ContactSensor(name);
    this.services.push(sensorService);
    
    // Bind the ContactSensorState characteristic
    this.bindCharacteristic(
      sensorService, 
      Characteristic.ContactSensorState, 
      'High Temperature Status',
      this.getHighTempState.bind(this),
      null,
      (value) => value === 1 ? 'High Temp Detected' : 'Normal Temp'
    );
    
    this.log.info(`High temperature sensor created: ${name}`);
    
    // Call updateData once at the end of constructor (Google Nest pattern)
    this.updateData();
  }
  
  // Getter method for high temperature state
  // ContactSensorState: 0 = contact detected (normal), 1 = no contact/open (threshold triggered)
  getHighTempState() {
    const state = this.platform.highTempState ? 1 : 0;
    return state;
  }
}

// Low Temperature Accessory - extends base class  
class LowTempAccessory extends TemperatureForecastAccessory {
  constructor(log, name, platform, api) {
    // Call parent constructor
    super(log, name, 'low', platform, api);
    
    const sensorService = new Service.ContactSensor(name);
    this.services.push(sensorService);
    
    // Bind the ContactSensorState characteristic
    this.bindCharacteristic(
      sensorService,
      Characteristic.ContactSensorState,
      'Low Temperature Status',
      this.getLowTempState.bind(this),
      null,
      (value) => value === 1 ? 'Low Temp Detected' : 'Normal Temp'
    );
    
    this.log.info(`Low temperature sensor created: ${name}`);
    
    // Call updateData once at the end of constructor (Google Nest pattern)
    this.updateData();
  }
  
  // Getter method for low temperature state
  // ContactSensorState: 0 = contact detected (normal), 1 = no contact/open (threshold triggered)
  getLowTempState() {
    const state = this.platform.lowTempState ? 1 : 0;
    return state;
  }
}

// Extreme High Temperature Accessory - extends base class
class ExtremeHighTempAccessory extends TemperatureForecastAccessory {
  constructor(log, name, platform, api) {
    // Call parent constructor
    super(log, name, 'extreme_high', platform, api);
    
    const sensorService = new Service.ContactSensor(name);
    this.services.push(sensorService);
    
    // Bind the ContactSensorState characteristic
    this.bindCharacteristic(
      sensorService,
      Characteristic.ContactSensorState,
      'Extreme High Temperature Status',
      this.getExtremeHighTempState.bind(this),
      null,
      (value) => value === 1 ? 'Extreme High Temp Detected' : 'Normal Temp'
    );
    
    this.log.info(`Extreme high temperature sensor created: ${name}`);
    
    // Call updateData once at the end of constructor (Google Nest pattern)
    this.updateData();
  }
  
  // Getter method for extreme high temperature state
  // ContactSensorState: 0 = contact detected (normal), 1 = no contact/open (threshold triggered)
  getExtremeHighTempState() {
    const state = this.platform.extremeHighTempState ? 1 : 0;
    return state;
  }
}

class TemperatureForecastPlatform {
  constructor(log, config, api) {
    // Safety check for log parameter - provide fallback if undefined
    if (!log) {
      console.log('WARNING: log parameter is undefined, using console.log as fallback');
      this.log = {
        info: (msg) => console.log(`[INFO] ${msg}`),
        debug: (msg) => console.log(`[DEBUG] ${msg}`),
        warn: (msg) => console.log(`[WARN] ${msg}`),
        error: (msg) => console.log(`[ERROR] ${msg}`)
      };
    } else {
      this.log = log;
    }
    
    this.config = config;
    this.api = api;
    
    // Google Nest pattern: Accessory lookup storage
    this.accessoryLookup = {};
    
    // Platform-level state management (centralized state)
    this.highTempState = false;
    this.lowTempState = false;
    this.extremeHighTempState = false;
    
    // Platform-level polling management
    this.pollingIntervals = {};
    this.isPolling = false;
    
    // Configuration
    this.stationId = this.config.temperature_forecast?.station_id || 'PHI';
    this.highTempThreshold = this.config.temperature_forecast?.high_temp_threshold || 80;
    this.lowTempThreshold = this.config.temperature_forecast?.low_temp_threshold || 32;
    this.extremeHighTempThreshold = this.config.temperature_forecast?.extreme_high_temp_threshold || 95;
    this.checkInterval = (this.config.temperature_forecast?.check_interval || 30) * 60 * 1000;
    
    this.log.info('TemperatureForecast platform initialized');
  }

  // Google Nest pattern: accessories method that returns accessory instances
  accessories(callback) {
    const foundAccessories = this.createAccessories();
    
    // Start polling after accessories are created
    this.startPlatformPolling();
    
    this.log.info(`Returning ${foundAccessories.length} accessories to Homebridge`);
    
    if (callback) {
      callback(foundAccessories);
    }
    
    return foundAccessories;
  }

  createAccessories() {
    const foundAccessories = [];
    
    // Create temperature forecast sensors if configured
    if (this.config.temperature_forecast) {
      const tempConfig = this.config.temperature_forecast;
      const baseName = tempConfig.name || 'Temperature Forecast';
      
      // Create high temperature sensor
      const highTempName = `${baseName} - High Temp`;
      const highTempAccessory = new HighTempAccessory(this.log, highTempName, this, this.api);
      this.accessoryLookup[highTempName] = highTempAccessory;
      foundAccessories.push(highTempAccessory);
      
      // Create low temperature sensor
      const lowTempName = `${baseName} - Low Temp`;
      const lowTempAccessory = new LowTempAccessory(this.log, lowTempName, this, this.api);
      this.accessoryLookup[lowTempName] = lowTempAccessory;
      foundAccessories.push(lowTempAccessory);
      
      // Create extreme high temperature sensor
      const extremeHighTempName = `${baseName} - Extreme High Temp`;
      const extremeHighTempAccessory = new ExtremeHighTempAccessory(this.log, extremeHighTempName, this, this.api);
      this.accessoryLookup[extremeHighTempName] = extremeHighTempAccessory;
      foundAccessories.push(extremeHighTempAccessory);
      
    } else {
      this.log.warn('No temperature_forecast configuration found, skipping temperature sensors');
    }
    
    this.log.info(`Created ${foundAccessories.length} accessory instances`);
    
    return foundAccessories;
  }

  startPlatformPolling() {
    if (this.isPolling) {
      this.log.warn('Platform polling already started');
      return;
    }

    this.isPolling = true;
    this.log.info('Starting temperature forecast polling...');

    // Start temperature polling
    if (this.config.temperature_forecast) {
      this.startTemperaturePolling();
    }
  }

  startTemperaturePolling() {
    this.log.info(`Starting temperature forecast polling for station ${this.stationId} (${this.checkInterval / 60000} min intervals)`);
    
    const intervalId = setInterval(() => {
      this.log.info(`[POLLING] Polling interval triggered at ${new Date().toISOString()} - checking temperature forecast...`);
      this.checkTemperatureForecast().catch(error => {
        this.log.error(`[POLLING] Temperature forecast check failed: ${error.message}`);
      });
    }, this.checkInterval);

    this.pollingIntervals['temperature_forecast'] = intervalId;
    
    // Initial check
    this.log.info(`[INITIAL] Performing initial temperature forecast check at ${new Date().toISOString()}...`);
    this.checkTemperatureForecast().catch(error => {
      this.log.error(`[INITIAL] Initial temperature forecast check failed: ${error.message}`);
    });
  }

  // Google Nest pattern: Platform calls updateData() on all accessories
  updateAllAccessories() {
    Object.values(this.accessoryLookup).forEach(accessory => {
      accessory.updateData();
    });
  }

  async checkTemperatureForecast(retryCount = 0) {
    this.log.debug(`Starting temperature forecast check for station ${this.stationId} (attempt ${retryCount + 1})`);
    
    try {
      // Get the forecast for today
      const forecastUrl = `https://api.weather.gov/gridpoints/${this.stationId}/31,80/forecast`;
      this.log.debug(`Making API request to: ${forecastUrl}`);
      
      const forecastResponse = await axios.get(forecastUrl, {
        headers: {
          'User-Agent': 'Homebridge-Temperature-Forecast/1.0.0 (https://github.com/jeffalexander/homebridge-temperature-forecast)',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      this.log.debug('Forecast API response received:', JSON.stringify(forecastResponse.data, null, 2));

      if (!forecastResponse?.data?.properties?.periods) {
        throw new Error('Invalid forecast API response structure');
      }

      const periods = forecastResponse.data.properties.periods;
      let todayHighTemp = null;
      let todayLowTemp = null;
      let currentTemp = null;

      // Find today's forecast periods
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      for (const period of periods) {
        const periodDate = new Date(period.startTime);
        const periodDateString = periodDate.toISOString().split('T')[0];
        
        if (periodDateString === todayString) {
          if (period.isDaytime) {
            todayHighTemp = period.temperature;
          } else {
            todayLowTemp = period.temperature;
          }
        }
      }

      // If we don't have today's data, try to get the first available forecast
      if (todayHighTemp === null && todayLowTemp === null && periods.length > 0) {
        const firstPeriod = periods[0];
        if (firstPeriod.isDaytime) {
          todayHighTemp = firstPeriod.temperature;
        } else {
          todayLowTemp = firstPeriod.temperature;
        }
      }

      // Fetch hourly forecast to determine current temperature
      const hourlyUrl = `https://api.weather.gov/gridpoints/${this.stationId}/31,80/forecast/hourly`;
      this.log.debug(`Making API request to: ${hourlyUrl}`);

      const hourlyResponse = await axios.get(hourlyUrl, {
        headers: {
          'User-Agent': 'Homebridge-Temperature-Forecast/1.0.0 (https://github.com/jeffalexander/homebridge-temperature-forecast)',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      this.log.debug('Hourly forecast API response received:', JSON.stringify(hourlyResponse.data, null, 2));

      if (!hourlyResponse?.data?.properties?.periods) {
        throw new Error('Invalid hourly forecast API response structure');
      }

      const hourlyPeriods = hourlyResponse.data.properties.periods;
      const now = new Date();
      for (const period of hourlyPeriods) {
        const startTime = new Date(period.startTime);
        const endTime = new Date(period.endTime);
        if (now >= startTime && now < endTime) {
          currentTemp = period.temperature;
          break;
        }
      }

      if (currentTemp === null && hourlyPeriods.length > 0) {
        currentTemp = hourlyPeriods[0].temperature;
      }

      this.log.info(`Temperature summary - Forecast High: ${todayHighTemp}°F, Forecast Low: ${todayLowTemp}°F, Current: ${currentTemp}°F`);

      // Update platform state (centralized state management)
      const previousHighState = this.highTempState;
      const previousLowState = this.lowTempState;
      const previousExtremeHighState = this.extremeHighTempState;
      
      this.highTempState = todayHighTemp !== null && todayHighTemp >= this.highTempThreshold;
      this.lowTempState = currentTemp !== null && currentTemp < this.lowTempThreshold;
      this.extremeHighTempState = todayHighTemp !== null && todayHighTemp >= this.extremeHighTempThreshold;
      
      this.log.info(`[DEBUG] High Temp State - Previous: ${previousHighState ? 'DETECTED' : 'NOT DETECTED'}, New: ${this.highTempState ? 'DETECTED' : 'NOT DETECTED'}, Forecast: ${todayHighTemp}°F, Threshold: ${this.highTempThreshold}°F`);
      this.log.info(`[DEBUG] Low Temp State - Previous: ${previousLowState ? 'DETECTED' : 'NOT DETECTED'}, New: ${this.lowTempState ? 'DETECTED' : 'NOT DETECTED'}, Current: ${currentTemp}°F, Threshold: ${this.lowTempThreshold}°F`);
      this.log.info(`[DEBUG] Extreme High Temp State - Previous: ${previousExtremeHighState ? 'DETECTED' : 'NOT DETECTED'}, New: ${this.extremeHighTempState ? 'DETECTED' : 'NOT DETECTED'}, Forecast: ${todayHighTemp}°F, Threshold: ${this.extremeHighTempThreshold}°F`);
      
      // Check if states changed and update accessories
      if (previousHighState !== this.highTempState || previousLowState !== this.lowTempState || previousExtremeHighState !== this.extremeHighTempState) {
        if (previousHighState !== this.highTempState) {
          this.log.info(`🔔 High temperature condition ${this.highTempState ? 'detected' : 'not detected'}: ${todayHighTemp}°F >= ${this.highTempThreshold}°F`);
        }
        if (previousLowState !== this.lowTempState) {
          this.log.info(`🔔 Low temperature condition ${this.lowTempState ? 'detected' : 'not detected'}: ${currentTemp}°F < ${this.lowTempThreshold}°F`);
        }
        if (previousExtremeHighState !== this.extremeHighTempState) {
          this.log.info(`🔔 Extreme high temperature condition ${this.extremeHighTempState ? 'detected' : 'not detected'}: ${todayHighTemp}°F >= ${this.extremeHighTempThreshold}°F`);
        }
        
        // Trigger HomeKit updates using Google Nest pattern
        this.updateAllAccessories();
      } else {
        this.log.info(`[DEBUG] Temperature status unchanged - High: ${this.highTempState ? 'Still DETECTED' : 'Still NOT DETECTED'}, Low: ${this.lowTempState ? 'Still DETECTED' : 'Still NOT DETECTED'}, Extreme High: ${this.extremeHighTempState ? 'Still DETECTED' : 'Still NOT DETECTED'}`);
      }

      this.log.debug('Temperature forecast check completed successfully');

    } catch (error) {
      if (error.response) {
        this.log.error(`API responded with error status: ${error.response.status}`);
        this.log.debug('Error response:', JSON.stringify(error.response.data, null, 2));
        
        if (error.response.status === 429) {
          this.log.warn('Rate limit exceeded, will retry with backoff');
        } else if (error.response.status >= 500) {
          this.log.warn('Server error, will retry with backoff');
        }
      } else if (error.request) {
        this.log.error('No response received from API');
        this.log.debug('Request details:', error.request);
      } else {
        this.log.error(`Request setup error: ${error.message}`);
      }

      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        this.log.warn(`Error checking temperature forecast, retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.checkTemperatureForecast(retryCount + 1);
      }
      this.log.error('Error checking temperature forecast after 3 retries:', error.message);
    }
  }

  // Manual trigger method for testing - set temperature states
  setTemperatureStates(highTemp, lowTemp, extremeHighTemp) {
    this.log.info(`Manual update: Setting temperature states - High: ${highTemp}, Low: ${lowTemp}, Extreme High: ${extremeHighTemp}`);
    this.highTempState = highTemp;
    this.lowTempState = lowTemp;
    this.extremeHighTempState = extremeHighTemp;
    this.updateAllAccessories();
  }

  unload() {
    this.log.info('Unloading TemperatureForecast platform...');
    // Clear all polling intervals
    Object.entries(this.pollingIntervals).forEach(([key, intervalId]) => {
      clearInterval(intervalId);
    });
    this.pollingIntervals = {};
    this.isPolling = false;
    this.log.info('Stopped all polling intervals');
  }
}

module.exports = (api) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;

  api.registerPlatform('homebridge-temperature-forecast', 'TemperatureForecast', TemperatureForecastPlatform);
};