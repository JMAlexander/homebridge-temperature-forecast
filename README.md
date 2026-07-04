# Homebridge Temperature Forecast

This Homebridge plugin provides temperature forecast monitoring using the National Weather Service (NWS) API.

## Features

### Temperature Forecast Monitoring
- Creates three read-only **sensors** that turn on based on temperature thresholds
- High temperature sensor: detects when forecast high temperature exceeds threshold
- Low temperature sensor: detects when current hourly temperature falls below threshold
- Extreme high temperature sensor: detects when forecast high temperature exceeds extreme threshold
- Uses real-time forecast data from the National Weather Service
- Configurable check interval (minimum 15 minutes)

## Installation

1. Install Homebridge if you haven't already:
```bash
npm install -g homebridge
```

2. Install this plugin:
```bash
npm install -g homebridge-temperature-forecast
```

3. Add the platform to your Homebridge config.json:
```json
{
  "platforms": [
    {
      "platform": "TemperatureForecast",
      "name": "Temperature Forecast",
      "temperature_forecast": {
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

## Configuration

### Temperature Forecast
- `name`: The base name for the sensors in HomeKit (default: "Temperature Forecast")
- `station_id`: The NWS weather station ID (default: "PHI" for Philadelphia)
- `high_temp_threshold`: Temperature above which the high temp sensor will detect (default: 80°F)
- `low_temp_threshold`: Temperature below which the low temp sensor will detect based on the current hourly forecast temperature (default: 32°F)
- `extreme_high_temp_threshold`: Temperature above which the extreme high temp sensor will detect (default: 90°F)
- `check_interval`: How often to check temperature forecast in minutes (default: 30, minimum: 15)

## How It Works

The plugin creates three **ContactSensors**:
1. **High Temperature Sensor**: Detects when the forecast high temperature exceeds your threshold
2. **Low Temperature Sensor**: Detects when the forecast low temperature falls below your threshold
3. **Extreme High Temperature Sensor**: Detects when the forecast high temperature exceeds your extreme threshold

All sensors are read-only and automatically update based on the latest forecast data from the National Weather Service.

### Using Sensors in HomeKit Automations
- You can use these sensors as triggers in HomeKit automations (e.g., "If High Temperature Sensor detects, then ...").
- In the Home app or Eve app, look for the sensors named "Temperature Forecast - High Temp", "Temperature Forecast - Low Temp", and "Temperature Forecast - Extreme High Temp".

## Migration Note

**If you are upgrading from a version that used switches:**
- The plugin now uses sensors instead of switches for temperature triggers.
- You may need to remove the old switch accessories from HomeKit manually if they remain after upgrading.

## Troubleshooting

If the sensors aren't updating:
1. Check the Homebridge logs for any error messages
2. Verify your station ID is correct
3. Ensure your check intervals aren't too frequent
4. Check your internet connection
5. Verify the NWS API is accessible from your network

## License

MIT 