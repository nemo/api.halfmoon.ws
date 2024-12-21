import fetch from 'node-fetch';

export default class OpenWeatherAPI {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
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
