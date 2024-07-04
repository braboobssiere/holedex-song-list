const https = require('https');
const fs = require('fs');
const path = require('path');

const queryParams = {
  type: 'stream',
  topic: 'singing',
  org: 'Hololive',
  limit: 50,
  max_upcoming_hours: 18,
};

// Function to create an RSS feed from an array of video objects
function createRSSFeed(videos) {
  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <atom:link href="https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.rss" rel="self" type="application/rss+xml"/>
    <title>Hololive Karaoke Stream</title>
    <link>https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.rss</link>
    <description>Hololive Karaoke Stream RSS Feed</description>
    <language>en-us</language>
    <ttl>55</ttl>
`;

  for (const video of videos) {
    const title = video.title;
    const link = `https://www.youtube.com/watch?v=${video.id}`;
    const pubDate = new Date(video.available_at).toUTCString();
    const creator = `@${video.channel.english_name}`;
    const description = `${title} - Watch on YouTube: ${link}`;

    feed += `
    <item>
      <title><![CDATA[${title}]]></title>
      <dc:creator>${creator}</dc:creator>
      <description><![CDATA[
        <p>${title} <a href="${link}">Watch on YouTube</a></p>
      ]]></description>
      <pubDate>${pubDate}</pubDate>
      <guid>${link}</guid>
      <link>${link}</link>
    </item>
`;
  }

  feed += `
  </channel>
</rss>`;
  
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
      const feed = createRSSFeed(videos);

      // Define the output path to the feeds directory
      const outputPath = path.join(__dirname, 'feeds', 'holodex.rss');

      // Write the feed to a file
      fs.writeFile(outputPath, feed, (err) => {
        if (err) {
          console.error('Error writing RSS feed:', err);
        } else {
          console.log('RSS feed generated successfully.');
        }
      });
    } else {
      console.error('Failed to fetch data:', response.statusCode);
    }
  });
}

// Make an HTTPS request to fetch data
const apiUrl = 'https://holodex.net/api/v2/videos';
const queryString = new URLSearchParams(queryParams).toString();
const apiKey = process.env.HOLODEX_API_KEY;
const url = `${apiUrl}?${queryString}`;

https.get(url, {
  headers: {
    'x-api-key': apiKey,
  }
}, handleResponse).on('error', (err) => {
  console.error('Error fetching data:', err.message);
});
