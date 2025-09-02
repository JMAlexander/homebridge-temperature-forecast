const axios = require('axios');

class TemperatureForecastPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.sensors = [];
    this.pollingIntervals = {};
    
    this.log.info('TemperatureForecast platform constructor called');

    if (!config) {
      log.warn('No configuration found for TemperatureForecast');
      return;
    }

    this.log.info('Initializing TemperatureForecast platform...');
    this.log.debug('Configuration:', JSON.stringify(config, null, 2));

    if (api) {
      this.api.on('didFinishLaunching', () => {
        this.log.info('Homebridge finished launching, initializing sensors...');
        this.initializeSensors();
      });
    }
  }

  initializeSensors() {
    // Initialize temperature forecast sensors if configured
    if (this.config.temperature_forecast) {
      const tempConfig = this.config.temperature_forecast;
      this.log.debug('Initializing temperature forecast sensors with config:', JSON.stringify(tempConfig, null, 2));
      this.createTemperatureSensors(
        tempConfig.name || 'Temperature Forecast',
        tempConfig.station_id || 'PHI',
        tempConfig.high_temp_threshold || 80,
        tempConfig.low_temp_threshold || 32,
        (tempConfig.check_interval || 30) * 60 * 1000
      );
    } else {
      this.log.warn('No temperature_forecast configuration found, skipping temperature sensors');
    }
  }

  createTemperatureSensors(name, stationId, highTempThreshold, lowTempThreshold, checkInterval) {
    this.log.info(`Creating temperature forecast sensors: ${name}`);
    this.log.debug(`Station ID: ${stationId}, High temp threshold: ${highTempThreshold}°F, Low temp threshold: ${lowTempThreshold}°F, Check interval: ${checkInterval / 60000} minutes`);
    
    // Create high temperature sensor
    const highTempName = `${name} - High Temp`;
    const highTempAccessory = new this.api.platformAccessory(highTempName, this.api.hap.uuid.generate(highTempName));
    const highTempSensorService = new this.api.hap.Service.OccupancySensor(highTempName);
    highTempAccessory.addService(highTempSensorService);
    this.api.registerPlatformAccessories('homebridge-temperature-forecast', 'TemperatureForecast', [highTempAccessory]);
    this.log.info(`Successfully registered high temperature sensor accessory: ${highTempName}`);
    this.sensors.push(highTempAccessory);
    // Track current state for onGet
    this.currentHighTempState = 0;
    highTempSensorService.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.currentHighTempState);

    // Create low temperature sensor
    const lowTempName = `${name} - Low Temp`;
    const lowTempAccessory = new this.api.platformAccessory(lowTempName, this.api.hap.uuid.generate(lowTempName));
    const lowTempSensorService = new this.api.hap.Service.OccupancySensor(lowTempName);
    lowTempAccessory.addService(lowTempSensorService);
    this.api.registerPlatformAccessories('homebridge-temperature-forecast', 'TemperatureForecast', [lowTempAccessory]);
    this.log.info(`Successfully registered low temperature sensor accessory: ${lowTempName}`);
    this.sensors.push(lowTempAccessory);
    // Track current state for onGet
    this.currentLowTempState = 0;
    lowTempSensorService.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected)
      .onGet(() => this.currentLowTempState);

    // Start polling for temperature forecast
    this.startTemperaturePolling(highTempAccessory, lowTempAccessory, stationId, highTempThreshold, lowTempThreshold, checkInterval);
  }

  async checkTemperatureForecast(highTempAccessory, lowTempAccessory, stationId, highTempThreshold, lowTempThreshold, retryCount = 0) {
    this.log.debug(`Starting temperature forecast check for station ${stationId} (attempt ${retryCount + 1})`);
    
    try {
      // Get the forecast for today
      const forecastUrl = `https://api.weather.gov/gridpoints/${stationId}/31,80/forecast`;
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

      this.log.info(`Today's forecast - High: ${todayHighTemp}°F, Low: ${todayLowTemp}°F`);

      // Update high temperature sensor with enhanced debugging
      const highTempSensorService = highTempAccessory.getService(this.api.hap.Service.OccupancySensor);
      const highTempCurrentState = highTempSensorService.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).value;
      const highTempNewState = todayHighTemp !== null && todayHighTemp >= highTempThreshold ? 1 : 0;
      this.currentHighTempState = highTempNewState;
      
      this.log.info(`[DEBUG] High Temp Sensor - Current State: ${highTempCurrentState ? 'DETECTED' : 'NOT DETECTED'}, New State: ${highTempNewState ? 'DETECTED' : 'NOT DETECTED'}, Forecast: ${todayHighTemp}°F, Threshold: ${highTempThreshold}°F`);
      
      if (highTempCurrentState !== highTempNewState) {
        this.log.info(`[STATE CHANGE] High temperature condition ${highTempNewState ? 'detected' : 'not detected'}: ${todayHighTemp}°F >= ${highTempThreshold}°F`);
        this.log.info(`[HOMEBRIDGE] Updating high temp sensor from ${highTempCurrentState ? 'DETECTED' : 'NOT DETECTED'} to ${highTempNewState ? 'DETECTED' : 'NOT DETECTED'}`);
        
        try {
          highTempSensorService.updateCharacteristic(this.api.hap.Characteristic.OccupancyDetected, highTempNewState);
          this.log.info(`[HOMEBRIDGE] Successfully updated high temp sensor to ${highTempNewState ? 'DETECTED' : 'NOT DETECTED'}`);
        } catch (error) {
          this.log.error(`[HOMEBRIDGE] Failed to update high temp sensor: ${error.message}`);
        }
      } else {
        this.log.info(`[DEBUG] High temperature status unchanged: ${highTempNewState ? 'Still DETECTED (above threshold)' : 'Still NOT DETECTED (below threshold)'}`);
      }

      // Update low temperature sensor with enhanced debugging
      const lowTempSensorService = lowTempAccessory.getService(this.api.hap.Service.OccupancySensor);
      const lowTempCurrentState = lowTempSensorService.getCharacteristic(this.api.hap.Characteristic.OccupancyDetected).value;
      const lowTempNewState = todayLowTemp !== null && todayLowTemp < lowTempThreshold ? 1 : 0;
      this.currentLowTempState = lowTempNewState;
      
      this.log.info(`[DEBUG] Low Temp Sensor - Current State: ${lowTempCurrentState ? 'DETECTED' : 'NOT DETECTED'}, New State: ${lowTempNewState ? 'DETECTED' : 'NOT DETECTED'}, Forecast: ${todayLowTemp}°F, Threshold: ${lowTempThreshold}°F`);
      
      if (lowTempCurrentState !== lowTempNewState) {
        this.log.info(`[STATE CHANGE] Low temperature condition ${lowTempNewState ? 'detected' : 'not detected'}: ${todayLowTemp}°F < ${lowTempThreshold}°F`);
        this.log.info(`[HOMEBRIDGE] Updating low temp sensor from ${lowTempCurrentState ? 'DETECTED' : 'NOT DETECTED'} to ${lowTempNewState ? 'DETECTED' : 'NOT DETECTED'}`);
        
        try {
          lowTempSensorService.updateCharacteristic(this.api.hap.Characteristic.OccupancyDetected, lowTempNewState);
          this.log.info(`[HOMEBRIDGE] Successfully updated low temp sensor to ${lowTempNewState ? 'DETECTED' : 'NOT DETECTED'}`);
        } catch (error) {
          this.log.error(`[HOMEBRIDGE] Failed to update low temp sensor: ${error.message}`);
        }
      } else {
        this.log.info(`[DEBUG] Low temperature status unchanged: ${lowTempNewState ? 'Still DETECTED (below threshold)' : 'Still NOT DETECTED (above threshold)'}`);
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
        return this.checkTemperatureForecast(highTempAccessory, lowTempAccessory, stationId, highTempThreshold, lowTempThreshold, retryCount + 1);
      }
      this.log.error('Error checking temperature forecast after 3 retries:', error.message);
    }
  }

  startTemperaturePolling(highTempAccessory, lowTempAccessory, stationId, highTempThreshold, lowTempThreshold, checkInterval) {
    this.log.info(`Starting temperature forecast polling for station ${stationId}`);
    this.log.debug(`Polling interval: ${checkInterval / 60000} minutes, High temp threshold: ${highTempThreshold}°F, Low temp threshold: ${lowTempThreshold}°F`);
    
    const intervalId = setInterval(() => {
      this.log.info(`[POLLING] Polling interval triggered at ${new Date().toISOString()} - checking temperature forecast...`);
      this.checkTemperatureForecast(highTempAccessory, lowTempAccessory, stationId, highTempThreshold, lowTempThreshold).catch(error => {
        this.log.error(`[POLLING] Temperature forecast check failed: ${error.message}`);
      });
    }, checkInterval);

    // Store both accessories in the polling intervals
    this.pollingIntervals[highTempAccessory.UUID] = intervalId;
    this.pollingIntervals[lowTempAccessory.UUID] = intervalId;
    
    // Initial check
    this.log.info(`[INITIAL] Performing initial temperature forecast check at ${new Date().toISOString()}...`);
    this.checkTemperatureForecast(highTempAccessory, lowTempAccessory, stationId, highTempThreshold, lowTempThreshold).catch(error => {
      this.log.error(`[INITIAL] Initial temperature forecast check failed: ${error.message}`);
    });
  }

  unload() {
    this.log.info('Unloading TemperatureForecast platform...');
    // Clear all polling intervals
    Object.entries(this.pollingIntervals).forEach(([uuid, intervalId]) => {
      this.log.debug(`Clearing polling interval for accessory ${uuid}`);
      clearInterval(intervalId);
    });
    this.pollingIntervals = {};
    this.log.info('Stopped all polling intervals');
  }

  configureAccessory(accessory) {
    // Check if we've already configured this accessory to prevent duplicates
    const existingAccessory = this.sensors.find(sensor => sensor.UUID === accessory.UUID);
    if (existingAccessory) {
      this.log.debug(`Accessory ${accessory.displayName} (${accessory.UUID}) already configured, skipping duplicate`);
      return;
    }
    
    this.log.info(`Configuring existing accessory: ${accessory.displayName}`);
    this.log.debug(`Accessory UUID: ${accessory.UUID}`);
    this.sensors.push(accessory);
    
    // Log how many accessories we now have
    this.log.info(`Total accessories configured: ${this.sensors.length}`);
  }
}

module.exports = (api) => {
  api.registerPlatform('homebridge-temperature-forecast', 'TemperatureForecast', TemperatureForecastPlatform);
}; 
