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

const exampleForecast = [{"dt":1734814800,"main":{"temp":-1.48,"feels_like":-8.12,"temp_min":-1.52,"temp_max":-1.48,"pressure":1018,"sea_level":1018,"grnd_level":1018,"humidity":54,"temp_kf":0.04},"weather":[{"id":804,"main":"Clouds","description":"overcast clouds","icon":"04d"}],"clouds":{"all":88},"wind":{"speed":7.69,"deg":314,"gust":11.13},"visibility":10000,"pop":0,"sys":{"pod":"d"},"dt_txt":"2024-12-21 21:00:00"},{"dt":1734825600,"main":{"temp":-2.78,"feels_like":-9.75,"temp_min":-3.44,"temp_max":-2.78,"pressure":1020,"sea_level":1020,"grnd_level":1021,"humidity":53,"temp_kf":0.66},"weather":[{"id":803,"main":"Clouds","description":"broken clouds","icon":"04n"}],"clouds":{"all":64},"wind":{"speed":7.57,"deg":319,"gust":11.69},"visibility":10000,"pop":0,"sys":{"pod":"n"},"dt_txt":"2024-12-22 00:00:00"},{"dt":1734836400,"main":{"temp":-4.89,"feels_like":-11.89,"temp_min":-4.89,"temp_max":-4.89,"pressure":1024,"sea_level":1024,"grnd_level":1022,"humidity":53,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01n"}],"clouds":{"all":6},"wind":{"speed":7.93,"deg":322,"gust":11.66},"visibility":10000,"pop":0,"sys":{"pod":"n"},"dt_txt":"2024-12-22 03:00:00"},{"dt":1734847200,"main":{"temp":-5.65,"feels_like":-12.65,"temp_min":-5.65,"temp_max":-5.65,"pressure":1025,"sea_level":1025,"grnd_level":1023,"humidity":53,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01n"}],"clouds":{"all":4},"wind":{"speed":7.16,"deg":317,"gust":9.88},"visibility":10000,"pop":0,"sys":{"pod":"n"},"dt_txt":"2024-12-22 06:00:00"},{"dt":1734858000,"main":{"temp":-6.38,"feels_like":-13.38,"temp_min":-6.38,"temp_max":-6.38,"pressure":1026,"sea_level":1026,"grnd_level":1025,"humidity":54,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01n"}],"clouds":{"all":6},"wind":{"speed":6.97,"deg":314,"gust":10.26},"visibility":10000,"pop":0,"sys":{"pod":"n"},"dt_txt":"2024-12-22 09:00:00"},{"dt":1734868800,"main":{"temp":-7.35,"feels_like":-14.35,"temp_min":-7.35,"temp_max":-7.35,"pressure":1029,"sea_level":1029,"grnd_level":1027,"humidity":56,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01n"}],"clouds":{"all":3},"wind":{"speed":6.92,"deg":321,"gust":11.81},"visibility":10000,"pop":0,"sys":{"pod":"n"},"dt_txt":"2024-12-22 12:00:00"},{"dt":1734879600,"main":{"temp":-6.75,"feels_like":-13.75,"temp_min":-6.75,"temp_max":-6.75,"pressure":1031,"sea_level":1031,"grnd_level":1030,"humidity":45,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01d"}],"clouds":{"all":0},"wind":{"speed":6.36,"deg":332,"gust":7.8},"visibility":10000,"pop":0,"sys":{"pod":"d"},"dt_txt":"2024-12-22 15:00:00"},{"dt":1734890400,"main":{"temp":-4.63,"feels_like":-10.49,"temp_min":-4.63,"temp_max":-4.63,"pressure":1030,"sea_level":1030,"grnd_level":1029,"humidity":37,"temp_kf":0},"weather":[{"id":800,"main":"Clear","description":"clear sky","icon":"01d"}],"clouds":{"all":1},"wind":{"speed":4.69,"deg":329,"gust":5.84},"visibility":10000,"pop":0,"sys":{"pod":"d"},"dt_txt":"2024-12-22 18:00:00"}]

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
    left: 50, 
    right: 40,
    top: 40,
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
      forecast: weather.forecast,
      currentWidget: generateWeatherWidget(weather.current, req.query.size || 'large'),
      forecastWidget: generateThreeHourForecastWidget(exampleForecast),
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