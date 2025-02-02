import fetch from 'node-fetch';
import geoip from 'geoip-lite';

export default class OpenWeatherAPI {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
    this.defaultIP = '184.152.78.14'; // An IP address in New York as fallback
  }

  /**
   * Get weather data from IP address
   * @param {string} ip - IP address to get weather for
   * @returns {Promise<Object>} Weather data including current conditions and forecast
   */
  async getWeatherFromIP(ip) {
    let geo = geoip.lookup(ip);

    if (!geo || ip.startsWith('127.0.0.1') || ip.startsWith('::1')) {
      // If geo lookup fails or IP is localhost, use the default IP
      geo = geoip.lookup(this.defaultIP);
    }

    if (!geo) {
      throw new Error('Unable to determine location from IP');
    }

    const [current, forecast] = await Promise.all([
      this.getCurrentWeather(geo.ll[0], geo.ll[1]),
      this.getForecast(geo.ll[0], geo.ll[1])
    ]);

    return {
      location: {
        city: geo.city,
        country: geo.country,
        coordinates: geo.ll
      },
      current,
      forecast: forecast.list.slice(0, 8) // Get next 24 hours (3-hour intervals)
    };
  }

  /**
   * Get current weather for a location
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @returns {Promise<Object>} Current weather data
   */
  async getCurrentWeather(lat, lon) {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${this.options.units || 'metric'}&lang=${this.options.lang || 'en'}`
    );
    return response.json();
  }

  /**
   * Get 5 day weather forecast with 3-hour intervals
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lon - Longitude (-180 to 180)
   * @returns {Promise<Object>} 5 day / 3 hour forecast data
   */
  async getForecast(lat, lon) {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=${this.options.units || 'metric'}&lang=${this.options.lang || 'en'}`
    );
    return response.json();
  }
}
