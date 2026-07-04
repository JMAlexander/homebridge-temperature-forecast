# Homebridge Temperature Forecast Plugin

## Overview

This plugin was created by extracting the temperature functionality from the original `homebridge-rain-status` plugin. It provides dedicated temperature forecast monitoring using the National Weather Service (NWS) API.

## Features

- **High Temperature Monitoring**: Creates a sensor that detects when forecast high temperature exceeds a configurable threshold
- **Low Temperature Monitoring**: Creates a sensor that detects when the current hourly temperature falls below a configurable threshold
- **Extreme High Temperature Monitoring**: Creates a sensor that detects when forecast high temperature exceeds an extreme configurable threshold
- **Real-time Updates**: Uses NWS forecast API to get current temperature predictions
- **Configurable Thresholds**: Set custom high, low, and extreme high temperature thresholds
- **Polling Control**: Configurable check intervals (minimum 15 minutes)

## Files Created

1. **`package.json`** - Plugin metadata and dependencies
2. **`index.js`** - Main plugin code with temperature forecast functionality
3. **`config.schema.json`** - Configuration schema for Homebridge UI
4. **`README.md`** - Installation and usage documentation
5. **`.gitignore`** - Git ignore rules for Node.js/Homebridge projects

## Key Differences from Rain Plugin

- **Focused Scope**: Only handles temperature forecasting (no rain functionality)
- **Triple Sensors**: Creates high, low, and extreme high temperature sensors
- **NWS API Only**: Uses only the National Weather Service forecast API
- **Temperature Logic**: Implements temperature threshold checking logic

## Configuration Example

```json
{
  "platforms": [
    {
      "platform": "TemperatureForecast",
      "temperature_forecast": {
        "name": "Temperature Forecast",
        "station_id": "PHI",
        "high_temp_threshold": 80,
        "low_temp_threshold": 32,
        "extreme_high_temp_threshold": 90,
        "check_interval": 30
      }
    }
  ]
}
```

## Next Steps

1. **Test the Plugin**: Install and test in a Homebridge environment
2. **Publish to npm**: When ready, publish to npm registry
3. **Create Repository**: Set up GitHub repository for the plugin
4. **Documentation**: Add any additional documentation as needed

## Migration Notes

This plugin was created by:
1. Extracting temperature-related code from `homebridge-rain-status`
2. Adapting the code to be a standalone temperature plugin
3. Updating all references to use temperature-specific naming
4. Creating appropriate documentation and configuration 