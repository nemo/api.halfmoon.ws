module.exports = {
  development: {
    origin: 'http://localhost:3000',
    foursquare: {
      client_id: process.env.FOURSQUARE_CLIENT_ID,
      client_secret: process.env.FOURSQUARE_CLIENT_SECRET,
      access_token: process.env.FOURSQUARE_ACCESS_TOKEN,
      callback_url: 'http://localhost:3001/users/auth/foursquare/callback'
    }
  },
  production: {
    origin: 'https://halfmoon.ws',
    foursquare: {
      client_id: process.env.FOURSQUARE_CLIENT_ID,
      client_secret: process.env.FOURSQUARE_CLIENT_SECRET,
      access_token: process.env.FOURSQUARE_ACCESS_TOKEN,
      callback_url: 'https://halfmoon.ws/users/auth/foursquare/callback'
    }
  }
}
