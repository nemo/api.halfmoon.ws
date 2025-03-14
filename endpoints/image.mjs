import OpenAI from 'openai';
import config from '../config.mjs';
import axios from 'axios';
import OpenWeatherAPI from '../utils/openweather.mjs';

const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

const openWeatherMap = new OpenWeatherAPI(config.openWeatherMap.apiKey, {
  units: 'metric',
  lang: 'en'
});

const imageCache = {};
const IMAGE_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

export default (app) => {
  app.get('/daily-image.png', async (req, res) => {
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      // Check if we have a valid cached image for this IP
      if (imageCache[ip] && (Date.now() - imageCache[ip].timestamp) < IMAGE_CACHE_DURATION) {
        return res.send(imageCache[ip].data);
      }

      // Get weather data for the IP
      const weather = await openWeatherMap.getWeatherFromIP(ip);
      
      // Construct a detailed prompt based on current weather
      const prompt = `A view of ${weather.current.weather[0].description} weather in ${weather.location.city}. Do not have any text on the image. Absolutely NO TEXT on the image. Use colors and shapes that evoke the current weather conditions.`;

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url"
      });

      // Get the image URL from the response
      const imageUrl = response.data[0].url;

      // Fetch the image
      const imageResponse = await axios({
        url: imageUrl,
        responseType: 'arraybuffer'
      });

      // Cache the image data
      imageCache[ip] = {
        timestamp: Date.now(),
        data: imageResponse.data
      };

      // Set the appropriate headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      // Send the image data directly
      res.send(imageResponse.data);

    } catch (error) {
      console.error('Error generating image:', error);
      res.status(500).json({
        status: 'fail',
        error: 'Unable to generate image'
      });
    }
  });
};
