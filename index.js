#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const config = require('./config')[process.env.NODE_ENV || 'development'];
const axios = require('axios');

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

let cache = {};

app.get('/users/self/location', (req, res) => {
  let locationCacheKey = 'users/self/location';

  const defaultLocation = {
    "id": "561e76ee498eb5ed5f9f850b",
    "name": "SALT",
    "contact": {},
    "location": {
      "address": "327 Divisadero St",
      "lat": 37.7726194545472,
      "lng": -122.43742447652257,
      "labeledLatLngs": [],
      "postalCode": "94117",
      "cc": "US",
      "city": "San Francisco",
      "state": "CA",
      "country": "United States",
      "formattedAddress": []
    },
    "category": {
      "id": "4bf58dd8d48988d175941735",
      "name": "Gym / Fitness Center",
      "pluralName": "Gyms or Fitness Centers",
      "shortName": "Gym / Fitness",
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
