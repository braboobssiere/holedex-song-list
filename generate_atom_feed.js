const https = require('https');
const fs = require('fs');
const path = require('path');
const { v5: uuidv5 } = require('uuid');
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

// Function to create an Atom feed from an array of video objects
function createAtomFeed(videos, feedUrl) {
  const feedId = uuidv5(feedUrl, uuidv5.URL); 

  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:${feedId}</id>
  <title>Hololive Karaoke Stream</title>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
`;

  videos.forEach(video => {
    // Skip videos with status "missing"
    if (video.status === "missing") {
      return;
    }
    const title = `<![CDATA[${video.title}]]>`;
    const shortlink = `https://youtu.be/${video.id}`;
    const thumbnail = `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
    const link = `https://www.youtube.com/watch?v=${video.id}`;
    const publishedAt = new Date(video.published_at);
    const availableAt = new Date(video.available_at);
    const now = new Date();
    const entryId = uuidv5(link, uuidv5.URL);

    let published;
    let updated;

    if (now > availableAt) {
      published = publishedAt.toISOString();
      updated = availableAt.toISOString();
    } else {
      published = publishedAt.toISOString();
      updated = publishedAt.toISOString();
    }

    const timeZoneOptions = {
      // Replace with your desired time zone
      timeZone: 'Etc/GMT-9', 
      day: 'numeric',
      month: 'long',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric'
    };

    const authorName = video.channel.name;
    const englishName = video.channel.english_name;
    const authorUrl = `https://www.youtube.com/channel/${video.channel.id}`;
    const formattedAvailableTime = availableAt.toLocaleString('en-US', timeZoneOptions) + ' GMT+9';
    // const summary = `<![CDATA[【LIVE on ${formattedAvailableTime}】${link}]]>`;

    // Convert availableAt to Discord Dynamic Timestamp and use it instead
    const discordTimestamp = `&lt;t:${Math.floor(availableAt.getTime() / 1000)}:f&gt;`;
    const summary = `<![CDATA[【LIVE on ${discordTimestamp}】${link}]]>`;

    feed += `
  <entry>
    <id>urn:uuid:${entryId}</id>
    <title>${title}</title>
    <link href="${shortlink}" rel="alternate" type="text/html"/>
    <published>${published}</published>
    <updated>${published}</updated>
    <author>
      <name>${authorName}</name>
      <uri>${authorUrl}</uri>
    </author>
    <summary>${summary}</summary>
    <media:thumbnail url="${thumbnail}" width="1280" height="720"/>
  </entry>
`;
  });

  feed += `</feed>`;
  return feed;
}

// Define a callback function to handle the API response
function handleResponse(response) {
  let data = [];

  // Set the response encoding to utf8
  response.setEncoding('utf8');

  response.on('data', chunk => {
    data.push(chunk);
  });

  response.on('end', () => {
    if (response.statusCode === 200) {
      try {
        // Join the chunks into a single string
        const completeData = data.join('');
        // Parse the JSON data
        const videos = JSON.parse(completeData);

        // Save the JSON response to a file
        const jsonOutputPath = path.join(__dirname, 'feeds', 'response.json');
        fs.writeFileSync(jsonOutputPath, JSON.stringify(videos, null, 2), 'utf8');
        console.log('JSON response saved successfully at', jsonOutputPath);

        // Sort videos by published date
        videos.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

        // actual feed URL
        const feedUrl = 'https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom';
        const feed = createAtomFeed(videos, feedUrl);

        const outputPath = path.join(__dirname, 'feeds', 'holodex.atom');
        fs.writeFileSync(outputPath, feed, 'utf8');

        console.log('Atom feed generated successfully at', outputPath);
      } catch (e) {
        console.error('Error parsing JSON or writing files:', e);
      }
    } else {
      console.error(`Error: ${response.statusCode} ${response.statusMessage}`);
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

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
