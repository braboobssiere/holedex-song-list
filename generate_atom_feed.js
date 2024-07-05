const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL, URLSearchParams } = require('url');

// Define the API endpoint URL
const apiUrl = 'https://holodex.net/api/v2/videos';

// Define the query parameters
const queryParams = {
  type: 'stream',
  topic: 'singing',
@@ -23,7 +19,7 @@ const apiKey = process.env.HOLODEX_API_KEY;
function createAtomFeed(videos) {
  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:${Math.floor(Math.random() * 0x100000000).toString(16)}</id>
  <title>Hololive Karaoke Stream</title>
  <link href="https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
@@ -40,7 +36,7 @@ function createAtomFeed(videos) {

    feed += `
  <entry>
    <id>urn:uuid:${video.id}</id>
    <title>${title}</title>
    <link href="${link}" rel="alternate" type="text/html"/>
    <published>${published}</published>
@@ -71,24 +67,36 @@ function handleResponse(response) {

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
const requestOptions = new URL(`${apiUrl}?${queryString}`);
const req = https.request(requestOptions, handleResponse);

// Set the X-APIKEY header if an API key is present
if (apiKey) {
  req.setHeader('X-APIKEY', apiKey);
}

// Send the request
req.end();
