const config = {
  development: {
    origin: 'http://localhost:3000',
    foursquare: {
      client_id: process.env.FOURSQUARE_CLIENT_ID,
      client_secret: process.env.FOURSQUARE_CLIENT_SECRET,
      access_token: process.env.FOURSQUARE_ACCESS_TOKEN,
      callback_url: 'http://localhost:3001/users/auth/foursquare/callback'
    },
    openWeatherMap: {
      apiKey: process.env.OPENWEATHERMAP_APIKEY
    },
    openai: {
      apiKey: process.env.OPEN_AI_ACCESS_TOKEN
    }
  },
  production: {
    origin: 'https://halfmoon.ws',
    foursquare: {
      client_id: process.env.FOURSQUARE_CLIENT_ID,
      client_secret: process.env.FOURSQUARE_CLIENT_SECRET,
      access_token: process.env.FOURSQUARE_ACCESS_TOKEN,
      callback_url: 'https://halfmoon.ws/users/auth/foursquare/callback'
    },
    openWeatherMap: {
      apiKey: process.env.OPENWEATHERMAP_APIKEY
    },
    openai: {
      apiKey: process.env.OPEN_AI_ACCESS_TOKEN
    }
  }
}

export default config[process.env.NODE_ENV || 'development'];