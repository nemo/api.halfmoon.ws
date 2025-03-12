import config from '../config.mjs';
import OpenWeatherAPI from '../utils/openweather.mjs';

const openWeatherMap = new OpenWeatherAPI(config.openWeatherMap.apiKey, {
  units: 'metric',
  lang: 'en'
});

const weatherCache = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

const generateWeatherWidget = (weather, size = 'large') => {
  // Base size is 100px for large
  const baseSize = size === 'large' ? 90 : 33;
  const iconSize = baseSize;
  const tempSize = size === 'large' ? '5em' : '0.8em';
  const descSize = size === 'large' ? '0.9em' : '0.3em';

  return `
    <div class="w-richtext" style="font-family: 'Folio Bold Condensed', sans-serif; padding: 0; color: inherit;">
      <div style="display: flex; gap: 20px; align-items: flex-end; margin-bottom: 5px;">
        <div style="font-size: ${tempSize}; line-height: 0.7; font-weight: bold; letter-spacing: -1px; margin-bottom: -5px;">
          ${Number(weather.main.temp).toFixed(1)}°
        </div>
        <div style="text-align: center;">
          <img src="https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png" 
               alt="${weather.weather[0].description}" 
               style="width: ${iconSize}px; height: ${iconSize}px; display: block; margin-bottom: -15px;">
          <div style="font-size: ${descSize}; letter-spacing: 0.5px; text-transform: uppercase; color: #666;">
            ${weather.weather[0].description}
          </div>
        </div>
      </div>
    </div>
  `.trim();
};

const generateThreeHourForecastWidget = (forecast) => {
  if (!forecast || forecast.length === 0) return '';

  // Get timezone offset from the first forecast item
  const firstForecastTime = forecast[0].dt * 1000;
  const localTime = new Date(firstForecastTime);
  
  // Filter forecast to only include next 12 hours based on local time
  const next12HoursForecast = forecast.filter(item => {
    const itemLocalTime = new Date(item.dt * 1000);
    return itemLocalTime >= localTime && 
           itemLocalTime <= new Date(localTime.getTime() + (12 * 60 * 60 * 1000));
  });

  if (next12HoursForecast.length === 0) return '';

  // Chart dimensions
  const width = 300;
  const height = 180;  
  const padding = {
    left: 35, // Reduced from 50 to bring y-axis closer to edge
    right: 40,
    top: 50,
    bottom: 40
  };
  const chartWidth = width - (padding.left + padding.right);
  const chartHeight = height - (padding.top + padding.bottom);

  // Get min and max temps for y-axis scaling
  const temps = next12HoursForecast.map(item => item.main.temp);
  const minTemp = Math.floor(Math.min(...temps));
  const maxTemp = Math.ceil(Math.max(...temps));
  const tempRange = maxTemp - minTemp;

  // Create points for temperature line
  const points = next12HoursForecast.map((item, index) => {
    const x = padding.left + (index * (chartWidth / (next12HoursForecast.length - 1)));
    const y = height - padding.bottom - ((item.main.temp - minTemp) / tempRange * chartHeight);
    return `${x},${y}`;
  }).join(' ');

  // Generate time labels and icons
  const timeAndIcons = next12HoursForecast.map((item, index) => {
    const x = padding.left + (index * (chartWidth / (next12HoursForecast.length - 1)));
    const y = height - padding.bottom - ((item.main.temp - minTemp) / tempRange * chartHeight);
    const time = new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit' });
    const temp = Math.round(item.main.temp);
    const icon = item.weather[0].icon;
    
    return `
      <g>
        <image 
          x="${x - 15}" 
          y="${y - 45}" 
          width="30" 
          height="30" 
          href="https://openweathermap.org/img/wn/${icon}@2x.png"
        />
        <text x="${x}" y="${height - padding.bottom/2}" text-anchor="middle" style="font-size: 12px;">
          ${time}
        </text>
        <text x="${x}" y="${y - 5}" text-anchor="middle" style="font-size: 12px;">
          ${temp}°C
        </text>
      </g>
    `;
  }).join('');

  // Y-axis temperature labels
  const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
    const temp = minTemp + (tempRange * (i / 4));
    const y = height - padding.bottom - (i * chartHeight / 4);
    return `
      <text x="${padding.left - 5}" y="${y}" text-anchor="end" alignment-baseline="middle" style="font-size: 12px;">
        ${Math.round(temp)}°C
      </text>
    `;
  }).join('');

  // Generate SVG
  return `
    <svg width="${width}" height="${height}" style="font-family: 'Folio Bold Condensed', sans-serif;">
      <!-- Temperature line -->
      <polyline
        points="${points}"
        fill="none"
        stroke="#2196F3"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Time and temperature labels with icons -->
      ${timeAndIcons}
      
      <!-- Y-axis labels -->
      ${yAxisLabels}
    </svg>
  `;
};

export default (app) => {
  app.get('/weather', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    try {
      // Check if we have cached data for this IP
      if (weatherCache[ip] && (Date.now() - weatherCache[ip].timestamp) < CACHE_DURATION) {
        if (req.query.iframe) {
          return res.send(`<html><body>${weatherCache[ip].data.embed}</body></html>`);
        }
        return res.json({
          status: 'ok',
          data: weatherCache[ip].data,
          cached: true
        });
      }

      const weather = await openWeatherMap.getWeatherFromIP(ip);
  
    const responseData = {
      location: weather.location,
      weather: {
        description: weather.current.weather[0].description,
        temperature: weather.current.main.temp,
        humidity: weather.current.main.humidity,
        windSpeed: weather.current.wind.speed
      },
      forecast: weather.forecast,
      currentWidget: generateWeatherWidget(weather.current, req.query.size || 'large'),
      forecastWidget: generateThreeHourForecastWidget(weather.forecast),
    };

    responseData.embed = `
        <style>
          @font-face {
            font-family: 'Folio Bold Condensed';
            src: url('/public/Folio-Std-Bold-Condensed.woff') format('woff');
            font-weight: bold;
            font-style: normal;
          }
          
          .weather-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            font-family: 'Folio Bold Condensed', sans-serif;
          }
          .current-weather {
            text-align: left;
          }
          .forecast {
            margin-top: -20px;  /* Adjust overlap with current weather */
          }
        </style>
        <div class="weather-container">
          <div class="current-weather">
            ${responseData.currentWidget}
          </div>
          <div class="forecast">
            ${responseData.forecastWidget}
          </div>
        </div>
    `;

      // Cache the weather data
      weatherCache[ip] = {
        timestamp: Date.now(),
        data: responseData
      };

      if (req.query.iframe) {
        res.send(`<html><body style="margin: 0; padding: 0;">${responseData.embed}</body></html>`)
      } else {
        res.json({
          status: 'ok',
          data: responseData,
          cached: false
        });
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      res.status(500).json({
        status: 'fail',
        error: error.message || 'Unable to fetch weather data'
      });
    }
  });
};