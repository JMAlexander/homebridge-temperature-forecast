# Homebridge Temperature Forecast

This Homebridge plugin provides temperature forecast monitoring using the National Weather Service (NWS) API.

## Features

### Temperature Forecast Monitoring
- Creates two read-only switches that turn on based on temperature thresholds
- High temperature switch: turns on when forecast high temperature exceeds threshold
- Low temperature switch: turns on when forecast low temperature falls below threshold
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
      "temperature_forecast": {
        "name": "Temperature Forecast",
        "station_id": "PHI",
        "high_temp_threshold": 80,
        "low_temp_threshold": 32,
        "check_interval": 30
      }
    }
  ]
}
```

## Configuration

### Temperature Forecast
- `name`: The base name for the switches in HomeKit (default: "Temperature Forecast")
- `station_id`: The NWS weather station ID (default: "PHI" for Philadelphia)
- `high_temp_threshold`: Temperature above which the high temp switch will turn on (default: 80°F)
- `low_temp_threshold`: Temperature below which the low temp switch will turn on (default: 32°F)
- `check_interval`: How often to check temperature forecast in minutes (default: 30, minimum: 15)

## Finding Your Station ID

### NWS Station ID
1. Visit https://www.weather.gov/
2. Enter your location
3. Look for the "Observations" section
4. Find the nearest station ID

Common NWS station IDs:
- PHI: Philadelphia
- NYC: New York City
- LAX: Los Angeles
- ORD: Chicago O'Hare

## How It Works

The plugin creates two switches:
1. **High Temperature Switch**: Turns ON when the forecast high temperature exceeds your threshold
2. **Low Temperature Switch**: Turns ON when the forecast low temperature falls below your threshold

Both switches are read-only and automatically update based on the latest forecast data from the National Weather Service.

## Troubleshooting

If the switches aren't updating:
1. Check the Homebridge logs for any error messages
2. Verify your station ID is correct
3. Ensure your check intervals aren't too frequent
4. Check your internet connection
5. Verify the NWS API is accessible from your network

## License

MIT 