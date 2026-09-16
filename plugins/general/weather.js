/**
 * NEXORA MD - Weather
 * Get current weather for any city
 * Usage:
 *   .weather Nairobi
 *   .weather London
 *   .weather (reply to a location message)
 */

const settings = require('../../settings');

// ─────────────────────────────────────────────
// WEATHER CODE → EMOJI / DESCRIPTION
// ─────────────────────────────────────────────
const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

const WEATHER_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️'
};

// ─────────────────────────────────────────────
// GEOCODE — city name → lat/lon
// ─────────────────────────────────────────────
async function geocode(city) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const r = data.results[0];
    return {
      name: r.name,
      country: r.country,
      admin: r.admin1,
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone
    };
  } catch (e) {
    console.log('[WEATHER] Geocode failed:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// FETCH WEATHER
// ─────────────────────────────────────────────
async function fetchWeather(lat, lon) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,weather_code,precipitation_sum` +
      `&timezone=auto&forecast_days=3`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.log('[WEATHER] Fetch failed:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// REVERSE GEOCODE — for location shares
// ─────────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NEXORA-MD-Bot/1.0' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.address) return null;
    const city =
      data.address.city ||
      data.address.town ||
      data.address.village ||
      data.address.county ||
      data.address.state;
    return city || null;
  } catch (e) {
    return null;
  }
}

function windDirection(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'weather',
  aliases: ['w', 'temp', 'forecast'],
  category: 'general',
  description: 'Get current weather for a city',
  usage: '.weather <city>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      let city = args.join(' ').trim();

      // If no city, check if replying to a location
      if (!city) {
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
        const loc = quoted?.locationMessage || quoted?.liveLocationMessage;

        if (loc && loc.degreesLatitude != null) {
          const resolved = await reverseGeocode(loc.degreesLatitude, loc.degreesLongitude);
          if (resolved) {
            city = resolved;
            console.log('[WEATHER] Using city from location reply:', city);
          } else {
            city = `${loc.degreesLatitude},${loc.degreesLongitude}`;
          }
        }
      }

      if (!city) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Get weather for any city\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}weather Nairobi\n` +
            `  ${settings.prefix || '.'}weather London\n` +
            `  ${settings.prefix || '.'}weather (reply to a location)\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Fetching weather for ${city}...` });

      // ─────────────────────────────────────────
      // Geocode
      // ─────────────────────────────────────────
      const geo = await geocode(city);
      if (!geo) {
        await conn.sendMessage(chatId, {
          text: `Could not find city: ${city}\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Fetch weather
      // ─────────────────────────────────────────
      const weather = await fetchWeather(geo.lat, geo.lon);
      if (!weather || !weather.current) {
        await conn.sendMessage(chatId, {
          text: `Could not fetch weather data.\n\n${settings.footer}`
        });
        return;
      }

      const cur = weather.current;
      const daily = weather.daily;

      const code = cur.weather_code;
      const emoji = WEATHER_EMOJI[code] || '🌡️';
      const desc = WEATHER_CODES[code] || 'Unknown';

      const temp = Math.round(cur.temperature_2m);
      const feels = Math.round(cur.apparent_temperature);
      const humidity = cur.relative_humidity_2m;
      const wind = Math.round(cur.wind_speed_10m);
      const windDir = windDirection(cur.wind_direction_10m);
      const precip = cur.precipitation;

      let text = `WEATHER\n\n`;
      text += `Location: ${geo.name}${geo.admin ? ', ' + geo.admin : ''}, ${geo.country}\n`;
      text += `Condition: ${desc}\n`;
      text += `Temperature: ${temp}°C (feels like ${feels}°C)\n`;
      text += `Humidity: ${humidity}%\n`;
      text += `Wind: ${wind} km/h ${windDir}\n`;
      if (precip > 0) text += `Precipitation: ${precip} mm\n`;

      // ─────────────────────────────────────────
      // Forecast (next 3 days)
      // ─────────────────────────────────────────
      if (daily && daily.time && daily.time.length > 0) {
        text += `\nFORECAST\n`;
        for (let i = 0; i < Math.min(3, daily.time.length); i++) {
          const date = new Date(daily.time[i]);
          const dayName = date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
          const min = Math.round(daily.temperature_2m_min[i]);
          const max = Math.round(daily.temperature_2m_max[i]);
          const dCode = daily.weather_code[i];
          const dDesc = WEATHER_CODES[dCode] || '';
          text += `${dayName}: ${min}°C — ${max}°C, ${dDesc}\n`;
        }
      }

      text += `\n${settings.footer}`;

      await conn.sendMessage(chatId, { text });

    } catch (error) {
      console.log('[WEATHER] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};