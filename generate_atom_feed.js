const https = require('https');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { URLSearchParams } = require('url');

const queryParams = {
  type: 'stream',
  topic: 'singing',
  org: 'Hololive',
  limit: 50,
  max_upcoming_hours: 18,
};

const queryString = new URLSearchParams(queryParams).toString();
const apiKey = process.env.HOLODEX_API_KEY;

// Function to format date to [dd/mm/yyyy hh:mm (GMT+7)]
function formatDateToGMT7(date) {
  const options = {
    timeZone: 'Etc/GMT-7',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('en-GB', options).format(date) + ' (GMT+7)';
}

// Function to create an Atom feed from an array of video objects
function createAtomFeed(videos, feedUrl) {
  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:${uuidv4()}</id>
  <title>Hololive Karaoke Stream</title>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
`;

  videos.forEach(video => {
    const title = video.title;
    const link = `https://www.youtube.com/watch?v=${video.id}`;
    const publishedAt = new Date(video.published_at);
    const availableAt = new Date(video.available_at);
    const published = publishedAt.toISOString();
    const updated = availableAt.toISOString();
    const authorName = video.channel.english_name;
    const authorUrl = `https://www.youtube.com/channel/${video.channel.id}`;
    const formattedAvailableAt = formatDateToGMT7(availableAt);
    const summary = `[${formattedAvailableAt}] ${title} / ${authorName}`;

    feed += `
  <entry>
    <id>urn:uuid:${uuidv4()}</id>
    <title>${title}</title>
    <link href="${link}" rel="alternate" type="text/html"/>
    <published>${published}</published>
    <updated>${updated}</updated>
    <author>
      <name>${authorName}</name>
      <uri>${authorUrl}</uri>
    </author>
    <summary type="text">${summary}</summary>
  </entry>
`;
  });

  feed += `</feed>`;
  return feed;
}

// Define a callback function to handle the API response
function handleResponse(response) {
  let data = '';

  response.on('data', chunk => {
    data += chunk;
  });

  response.on('end', () => {
    if (response.statusCode === 200) {
      const videos = JSON.parse(data);
      videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));

      const feedUrl = 'https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom'; // Replace with your actual feed URL
      const feed = createAtomFeed(videos, feedUrl);

      const outputPath = path.join(__dirname, 'feeds', 'holodex.atom');
      fs.writeFileSync(outputPath, feed);
      console.log('Atom feed generated successfully at', outputPath);
    } else {
      console.log(`Error: ${response.statusCode} ${response.statusMessage}`);
    }
  });
}

// Create the request to the Holodex API endpoint
const apiUrl = `https://holodex.net/api/v2/videos?${queryString}`;
const requestOptions = {
  headers: {
    'X-APIKEY': apiKey
  }
};

const req = https.request(apiUrl, requestOptions, handleResponse);
req.end();
