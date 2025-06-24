const https = require('https');
const fs = require('fs');
const path = require('path');
const { v5: uuidv5 } = require('uuid');
const { URLSearchParams } = require('url');

const apiKey = process.env.HOLODEX_API_KEY;

const queryParams = {
  type: 'stream',
  org: 'Hololive',
  limit: 50,
  max_upcoming_hours: 18,
};

// Define the topics e.g. 'singing', 'asmr', 'Music_Cover', 'Original_Song', 'Musical_Instrument', 'Birthday', 'Anniversary', '3D_Stream'
const topics = ['singing', 'asmr', 'Original_Song', 'Musical_Instrument', 'Birthday', 'Anniversary', '3D_Stream'];

// Function to create an Atom feed from an array of video objects
function createAtomFeed(videos, feedUrl) {
  const feedId = uuidv5(feedUrl, uuidv5.URL);

  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:${feedId}</id>
  <title>Hololive Stream Feed</title>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
`;

  videos.forEach(video => {
    //skip missing, holostars video, no song live
    if (video.status === "missing" ||
        (!video.title.toLowerCase().includes("unarchive") && (video.songcount === undefined ||
          video.songcount <= 1) && (video.topic_id === "Birthday" ||
          video.topic_id === "Anniversary" || video.topic_id === "3D_Stream")
        ) || video.channel.name.toLowerCase().includes("holostar") ||
        (video.channel.suborg && video.channel.suborg.toLowerCase().includes("holostar"))
       )
    {
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
    const discordTimestamp = `&lt;t:${Math.floor(availableAt.getTime() / 1000)}:f&gt;`;
    const summary = `<![CDATA[${link} 【LIVE on ${discordTimestamp}】]]>`;

    feed += `
  <entry>
    <id>urn:uuid:${entryId}</id>
    <title>${title}</title>
    <link href="${shortlink}" rel="alternate" type="text/html"/>
    <published>${published}</published>
    <updated>${updated}</updated>
    <author>
      <name>${authorName}</name>
      <uri>${authorUrl}</uri>
    </author>
    <summary>${summary}</summary>
    <link rel="enclosure" type="image/jpeg" href="${thumbnail}"/>
  </entry>
`;
  });

  feed += `</feed>`;
  return feed;
}

// Function to make API request and return a promise
function fetchVideos(topic) {
  return new Promise((resolve, reject) => {
    const queryParamsWithTopic = { ...queryParams, topic };
    const queryString = new URLSearchParams(queryParamsWithTopic).toString();
    const apiUrl = `https://holodex.net/api/v2/videos?${queryString}`;
    const requestOptions = {
      headers: {
        'X-APIKEY': apiKey
      }
    };

  https.get(apiUrl, requestOptions, (response) => {
  let data = [];

  response.on('data', chunk => {
    data.push(chunk);
  });

  response.on('end', () => {
    if (response.statusCode === 200) {
      try {
        const completeData = Buffer.concat(data).toString(); 
        const videos = JSON.parse(completeData);
        resolve(videos);
      } catch (e) {
        reject('Error parsing JSON: ' + e);
      }
    } else {
      reject(`Error: ${response.statusCode} ${response.statusMessage}`);
    }
  });
}).on('error', (e) => {
  reject('Request error: ' + e.message);
});
    });
}

// Function to handle multiple API requests sequentially
async function fetchAllVideos(topics) {
  let allVideos = [];

  for (let topic of topics) {
    try {
      const videos = await fetchVideos(topic);
      Array.prototype.push.apply(allVideos, videos); 
      // Join arrays
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      // Wait for 5 second
    } catch (error) {
      console.error(error);
    }
  }
  
  // Sort videos by published date and then by ID 
  allVideos.sort((a, b) => 
  new Date(b.published_at) - new Date(a.published_at) || a.id.localeCompare(b.id)
);
  
  // Save the combined JSON response to a file
  const jsonOutputPath = path.join(__dirname, 'feeds', 'response.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(allVideos, null, 2), 'utf8');
  console.log('Combined JSON response saved successfully at', jsonOutputPath);

  // Generate the Atom feed
  const feedUrl = 'https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom';
  const feed = createAtomFeed(allVideos, feedUrl);

  const outputPath = path.join(__dirname, 'feeds', 'holodex.atom');
  fs.writeFileSync(outputPath, feed, 'utf8');
  console.log('Atom feed generated successfully at', outputPath);
}

// Fetch videos for all topics
fetchAllVideos(topics);
