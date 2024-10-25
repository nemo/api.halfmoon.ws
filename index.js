#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const config = require('./config')[process.env.NODE_ENV || 'development'];
const axios = require('axios');
const geoip = require('geoip-lite');
const OpenWeatherMap = require('openweathermap-node');
// Add this to your config file and replace with your actual API key
const openWeatherMap = new OpenWeatherMap({
  APPID: config.openWeatherMap.apiKey
});

// Add this near the top of the file, after other const declarations
const weatherCache = {};
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Add this near the top of the file, after other const declarations
const artCache = {};
const ART_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

function ensurePublicAPI(req, res, next) {
  res.header("Access-Control-Allow-Origin", '*');
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type, Accept, Authorization, Cookie");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Accept-Encoding", '');

  next();
}


/* Setup */
let app = express();
app.use(bodyParser.json({
  limit: '50mb'
}));

app.use(ensurePublicAPI);

/* Routes */

app.get('/users/auth/foursquare/callback', (req, res) => {

  res.json({
    url: `https://foursquare.com/oauth2/access_token?client_id=${config.foursquare.client_id}&client_secret=YOUR_CLIENT_SECRET&grant_type=authorization_code&redirect_uri=${config.foursquare.callback_url}&code=${req.query.code}`,
    instructions: 'Go to url and replace client secret!'
  });

});

app.get('/login', (req, res) => {
  res.redirect(
    `https://foursquare.com/oauth2/authenticate?client_id=${config.foursquare.client_id}&response_type=code&redirect_uri=${config.foursquare.callback_url}`
  );
});

app.get('/users/self/art', async (req, res) => {
  try {
    const currentTime = Date.now();

    // Check if we have a cached artwork and it's still valid
    if (artCache.artwork && (currentTime - artCache.timestamp) < ART_CACHE_DURATION) {
      return res.send(artCache.htmlString);
    }

    // Fetch artworks from API
    const request = await axios.get('https://api.artic.edu/api/v1/artworks/search', {
      params: {
        limit: 100,
        query: {
          term: {
            artist_id: 40482
          }
        },
        fields: ['description','title','artist_display','image_id']
      }
    });

    const response = request.data || {};
    const artworks = response.data.map(art => ({
      ...art,
      image_url: `${response.config.iiif_url}/${art.image_id}/full/,600/0/default.jpg`
    }));

    // Randomly pick an artwork
    const randomArtwork = artworks[Math.floor(Math.random() * artworks.length)];

    // Generate HTML string
    const htmlString = `
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;700&display=swap');
        body, html {
          margin: 0;
          padding: 0;
          font-family: Kanit, sans-serif;
          height: 100%;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .artwork-container {
          max-width: 100%;
          padding: 20px;
          box-sizing: border-box;
        }
        .artwork-image {
          width: auto;
          height: auto;
          max-height: 600px;
          max-width: 100%;
          display: block;
          margin: 0 auto;
        }
        h2 {
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .artist {
          font-style: italic;
          margin-top: 0;
          margin-bottom: 15px;
        }
      </style>
    </head>
    <body>
      <div class="artwork-container">
        <img src="${randomArtwork.image_url}" alt="${randomArtwork.title}" class="artwork-image">
        <h2>${randomArtwork.title}</h2>
        <p class="artist">${randomArtwork.artist_display}</p>
      </div>
    </body>
    </html>
    `;

    // Cache the artwork and HTML string
    artCache.artwork = randomArtwork;
    artCache.htmlString = htmlString;
    artCache.timestamp = currentTime;

    res.send(htmlString);
  } catch (error) {
    console.error('Error fetching artwork:', error);
    res.status(500).json({
      status: 'fail',
      error: 'Unable to fetch artwork data'
    });
  }
});

app.get('/weather', (req, res) => {
  const defaultIP = '184.152.78.14'; // An IP address in New York
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  const generateWeatherWidget = (weather, location) => {
    return `
      <div class="w-richtext" style="font-family: inherit; max-width: 100px; padding: 0; color: inherit;">
        <div style="display: flex; align-items: top;">
          <img src="https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png" alt="${weather.weather[0].description}" style="width: 100px; height: 100px;">
          </div>
        <div style="font-size: 0.8em; text-align: center; margin-top: -25px">
          <p>
            <span style="font-size: 1.1em;">${Number(weather.main.temp / 10.0).toFixed(2)}°C</span><br/>
            <em>${weather.weather[0].description}</em>
          </p>
        </div>
      </div>
    `.trim();
  };

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

  new Promise((resolve, reject) => {
    openWeatherMap.getCurrentWeatherByGeoCoordinates(geo.ll[0], geo.ll[1], (err, weather) => {
      if (err) {
        reject(err);
      } else {
        resolve(weather);
      }
    });
  })
  .then(weather => {
    const responseData = {
      location: {
        city: geo.city,
        country: geo.country
      },
      weather: {
        description: weather.weather[0].description,
        temperature: weather.main.temp,
        humidity: weather.main.humidity,
        windSpeed: weather.wind.speed
      },
      embed: generateWeatherWidget(weather, geo)
    };

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
  })
  .catch(err => {
    console.error(err);
    res.status(500).json({
      status: 'fail',
      error: 'Unable to fetch weather data'
    });
  });
});

app.get('/users/self/location', (req, res) => {
  let locationCacheKey = 'users/self/location';

  const defaultLocation = {
    "id": "561e76ee498eb5ed5f9f850b",
    "name": "BK",
    "contact": {},
    "location": {
      "address": "231 Front Street",
      "lat": 37.7726194545472,
      "lng": -122.43742447652257,
      "labeledLatLngs": [],
      "postalCode": "11205",
      "cc": "US",
      "city": "Brooklyn",
      "state": "CA",
      "country": "United States",
      "formattedAddress": []
    },
    "category": {
      "id": "4bf58dd8d48988d175941735",
      "name": "Office",
      "pluralName": "Office",
      "shortName": "Office",
      "icon": {
        "prefix": "https://ss3.4sqi.net/img/categories_v2/building/gym_",
        "suffix": ".png"
      },
      "primary": true
      }
  }

  if (cache[locationCacheKey]) {
    let lastCacheDiff = (new Date()).getTime() - cache[locationCacheKey].timestamp;

    // Only comfortable with a 5 minute lag.
    if (lastCacheDiff < (5 * 60 * 1000)) {
      return res.json({
        status: 'ok',
        data: cache[locationCacheKey].data
      });
    }
  }

  try {

    let data = axios.get(`https://api.foursquare.com/v2/users/self/checkins`, {
      params: {
        limit: 1,
        v: '20120609',
        sort: 'newestfirst',
        oauth_token: config.foursquare.access_token
      }
    });

    data.then((results) => {
      let checkins = (((results.data || {}).response || {}).checkins || {}).items || []
      let venue = (checkins[0] || {}).venue;

      if (!venue) {
        return defaultLocation
      }

      if (venue.categories && venue.categories.length) {
        venue.category = venue.categories[0];
      }

      cache[locationCacheKey] = {
        timestamp: (new Date()).getTime(),
        data: venue
      };

      res.json({
        status: 'ok',
        data: venue
      })
    });

    data.catch((err) => {
      console.error(err);

      res.status(500).json({
        status: 'fail',
        error: (err && err.message) || err
      })
    });

  } catch (e) {
    return res.status(500).json({
      status: 'fail',
      error: (e && e.message) || e
    })
  }

});

/* Server */
let port = parseInt(process.env.PORT, 10) || 3001;

app.set('port', port);
let server = http.createServer(app, process.env.PORT || 3001);


server.listen(port);
module.exports = server;
