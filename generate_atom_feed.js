const https = require('https');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const queryParams = {
  type: 'stream',
  topic: 'singing',
  org: 'Hololive',
  limit: 50,
  max_upcoming_hours: 18,
};

// Construct the query string
const queryString = new URLSearchParams(queryParams).toString();
const apiKey = process.env.HOLODEX_API_KEY;

// Function to create an Atom feed from an array of video objects
function createAtomFeed(videos) {
  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:${uuidv4()}</id>
  <title>Hololive Karaoke Stream</title>
  <link href="https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
`;

  for (const video of videos) {
    const title = video.title;
    const link = `https://www.youtube.com/watch?v=${video.id}`;
    const availableAt = new Date(video.available_at);
    const published = availableAt.toISOString();
    const authorName = video.channel.english_name;
    const authorUrl = `https://www.youtube.com/channel/${video.channel.id}`;
    const description = `<p>${title}</p><p><a href="${link}">Watch on YouTube</a></p>`;

    feed += `
  <entry>
    <id>urn:uuid:${uuidv4()}</id>
    <title>${title}</title>
    <link href="${link}" rel="alternate" type="text/html"/>
    <published>${published}</published>
    <author>
      <name>${authorName}</name>
      <uri>${authorUrl}</uri>
    </author>
    <content type="html">${description}</content>
  </entry>
`;
  }

  feed += `</feed>`;
  return feed;
}

// Define a callback function to handle the response
function handleResponse(response) {
  let data = '';
  response.on('data', chunk => {
    data += chunk;
  });
  response.on('end', () => {
    if (response.statusCode === 200) {
      const videos = JSON.parse(data);
      videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
      const feed = createAtomFeed(videos);

      // Define the output path to the feeds directory
      const outputPath = path.join(__dirname, 'feeds', 'holodex.atom');

      // Write the feed to a file
      fs.writeFile(outputPath, feed, 'utf8', (err) => {
        if (err) {
          console.error('Error writing feed file:', err);
        } else {
          console.log('Feed file written successfully:', outputPath);
        }
      });
    } else {
      console.error('Failed to fetch data:', response.statusCode, response.statusMessage);
    }
  });
  response.on('error', (err) => {
    console.error('Request error:', err);
  });
}

// Make the HTTPS request to the Holodex API
const options = {
  hostname: 'api.holodex.net',
  path: `/api/v2/videos?${queryString}`,
  method: 'GET',
  headers: {
    'X-APIKEY': apiKey
  }
};

const req = https.request(options, handleResponse);
req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
