const https = require('https');
const fs = require('fs');
const path = require('path');
const { URLSearchParams } = require('url');

// Define the API endpoint URL
const apiUrl = 'https://holodex.net/api/v2/videos';

// Define the query parameters
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

// Function to format date to [dd/mm/yyyy hh:mm] (GMT+7)
function formatDate(date) {
  const utcOffset = 7; // GMT+7 (Indochina Time)
  const utcDate = new Date(date.getTime() + utcOffset * 60 * 60 * 1000); // Adjusted UTC date
  const dd = String(utcDate.getDate()).padStart(2, '0');
  const mm = String(utcDate.getMonth() + 1).padStart(2, '0'); // January is 0
  const yyyy = utcDate.getFullYear();
  const hh = String(utcDate.getHours()).padStart(2, '0');
  const min = String(utcDate.getMinutes()).padStart(2, '0');
  return `[${dd}/${mm}/${yyyy} ${hh}:${min}]`;
}

// Function to create an Atom feed from an array of video objects
function createAtomFeed(videos) {
  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Hololive Karaoke Stream</title>
  <link href="https://holodex.net" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
`;

  for (const video of videos) {
    const title = video.title;
    const link = `https://www.youtube.com/watch?v=${video.id}`;
    const availableAt = new Date(video.available_at);
    const published = availableAt.toISOString();
    const authorName = video.channel.english_name;
    const authorUrl = `https://www.youtube.com/channel/${video.channel.id}`;
    const timestamp = formatDate(availableAt);

    feed += `
  <entry>
    <title>${timestamp} ${title}</title>
    <link href="${encodeURI(link)}" rel="alternate" type="text/html"/>
    <author>
      <name>${authorName}</name>
      <uri>${encodeURI(authorUrl)}</uri>
    </author>
    <published>${published}</published>
    <content type="text">${title} - ${timestamp} [${link}]</content>
  </entry>
`;
  }

  feed += `
  <id>urn:uuid:${Math.floor(Math.random() * 0x100000000).toString(16)}</id>
</feed>
`;

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
      
      // Save the Atom feed to the specified path
      fs.writeFileSync(outputPath, feed);
      console.log('Atom feed generated successfully at', outputPath);
    } else {
      console.log(`Error: ${response.statusCode} ${response.statusMessage}`);
    }
  });
}

// Create the request to the API endpoint
const requestOptions = {
  hostname: 'holodex.net',
  path: `/api/v2/videos?${queryString}`,
  headers: {
    'X-APIKEY': apiKey,
  },
};
const req = https.request(requestOptions, handleResponse);

// Send the request
req.end();
