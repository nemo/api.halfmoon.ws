import geoip from 'geoip-lite';
import config from '../config.mjs';
import OpenWeatherAPI from '../utils/openweather.mjs';

const openWeatherMap = new OpenWeatherAPI(config.openWeatherMap.apiKey, {
  units: 'metric', // optional: standard, metric, or imperial
  lang: 'en'      // optional: language code
});

const weatherCache = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

const getCurrentWeather = async (geo) => {
  const [current, forecast] = await Promise.all([
    openWeatherMap.getCurrentWeather(geo.ll[0], geo.ll[1]),
    openWeatherMap.getForecast(geo.ll[0], geo.ll[1])
  ]);
  
  return {
    current,
    forecast: forecast.list.slice(0, 8) // Get next 24 hours (3-hour intervals)
  };
};

const generateWeatherWidget = (weather, size = 'large') => {
  // Base size is 100px for large
  const baseSize = size === 'large' ? 100 : 33;
  const fontSize = size === 'large' ? '0.8em' : '0.27em';
  const titleSize = size === 'large' ? '1.1em' : '1.1em';
  const marginTop = size === 'large' ? '-25px' : '-8px';

  return `
    <div class="w-richtext" style="font-family: inherit; max-width: ${baseSize}px; padding: 0; color: inherit;">
      <div style="display: flex; align-items: top;">
        <img src="https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png" 
             alt="${weather.weather[0].description}" 
             style="width: ${baseSize}px; height: ${baseSize}px;">
      </div>
      <div style="font-size: ${fontSize}; text-align: center; margin-top: ${marginTop}">
        <p>
          <span style="font-size: ${titleSize};">${Number(weather.main.temp).toFixed(1)}°C</span><br/>
          <em>${weather.weather[0].description}</em>
        </p>
      </div>
    </div>
  `.trim();
};

const generateThreeHourForecastWidget = (forecast) => {
  // Filter forecast to only include today's data
  const today = new Date().setHours(0, 0, 0, 0);
  const todaysForecast = forecast.filter(item => {
    const itemDate = new Date(item.dt * 1000).setHours(0, 0, 0, 0);
    return itemDate === today;
  });

  if (todaysForecast.length === 0) return ''; // Return empty if no forecast for today

  // Chart dimensions
  const width = 300;
  const height = 180;  // Reduced from 200
  const padding = {
    left: 50,    // Increased left padding for y-axis labels
    right: 40,
    top: 40,
    bottom: 40
  };
  const chartWidth = width - (padding.left + padding.right);
  const chartHeight = height - (padding.top + padding.bottom);

  // Get min and max temps for y-axis scaling
  const temps = todaysForecast.map(item => item.main.temp);
  const minTemp = Math.floor(Math.min(...temps));
  const maxTemp = Math.ceil(Math.max(...temps));
  const tempRange = maxTemp - minTemp;

  // Create points for temperature line
  const points = todaysForecast.map((item, index) => {
    const x = padding.left + (index * (chartWidth / (todaysForecast.length - 1)));
    const y = height - padding.bottom - ((item.main.temp - minTemp) / tempRange * chartHeight);
    return `${x},${y}`;
  }).join(' ');

  // Generate time labels and icons
  const timeAndIcons = todaysForecast.map((item, index) => {
    const x = padding.left + (index * (chartWidth / (todaysForecast.length - 1)));
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
      <text x="${padding.left - 15}" y="${y}" text-anchor="end" alignment-baseline="middle" style="font-size: 12px;">
        ${Math.round(temp)}°C
      </text>
    `;
  }).join('');

  // Generate SVG
  return `
    <svg width="${width}" height="${height}" style="font-family: Arial, sans-serif;">
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
    const defaultIP = '184.152.78.14'; // An IP address in New York
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    let geo = geoip.lookup(ip);
  
    if (!geo || ip.startsWith('127.0.0.1') || ip.startsWith('::1')) {
      // If geo lookup fails or IP is localhost, use the default IP
      geo = geoip.lookup(defaultIP);
    }
  
    if (!geo) {
      return res.status(400).json({
        status: 'fail',
        error: 'Unable to determine location from IP'
      });
    }

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

    const weather = await getCurrentWeather(geo);
  
    const responseData = {
      location: {
        city: geo.city,
        country: geo.country
      },
      weather: {
        description: weather.current.weather[0].description,
        temperature: weather.current.main.temp,
        humidity: weather.current.main.humidity,
        windSpeed: weather.current.wind.speed
      },
      currentWidget: generateWeatherWidget(weather.current, req.query.size || 'large'),
      forecastWidget: generateThreeHourForecastWidget(weather.forecast),
    };

    responseData.embed = `
        <style>
          .weather-container {
            display: flex;
            align-items: center;
            gap: 20px;
          }
          .current-weather {
            flex-shrink: 0;
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
      res.send(`<html><body>${responseData.embed}</body></html>`)
    } else {
      res.json({
        status: 'ok',
        data: responseData,
        cached: false
      });
    }
  });
};