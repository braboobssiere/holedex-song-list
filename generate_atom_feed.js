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

// Track if the API has been refetched
let hasRefetched = false;

// Store the initial fetch data for comparison
let initialVideos = [];

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
    const title = `<![CDATA[${video.title}]]>`;
    const shortlink = `https://youtu.be/${video.id}`;
    const link = `https://www.youtube.com/watch?v=${video.id}`;
    const publishedAt = new Date(video.published_at);
    const availableAt = new Date(video.available_at);
    const published = publishedAt.toISOString();
    const updated = availableAt.toISOString();
    const timeZoneOptions = {
      timeZone: 'Asia/Jakarta', // Replace with your desired time zone
      day: 'numeric',
      month: 'long',
      hour12: false,
      hour: 'numeric',
      minute: 'numeric'
    };
    const authorName = video.channel.name;
    const englishName = video.channel.english_name;
    const authorUrl = `https://www.youtube.com/channel/${video.channel.id}`;
    const formattedAvailableTime = availableAt.toLocaleString('en-US', timeZoneOptions) + ' GMT+7';
    const summary = `<![CDATA[【LIVE on ${formattedAvailableTime}】${link}]]>`;
    
    feed += `
  <entry>
    <id>urn:uuid:${uuidv4()}</id>
    <title>${title}</title>
    <link href="${shortlink}" rel="alternate" type="text/html"/>
    <published>${published}</published>
    <updated>${updated}</updated>
    <author>
      <name>${authorName}</name>
      <uri>${authorUrl}</uri>
    </author>
    <summary>${summary}</summary>
  </entry>
`;
  });

  feed += `</feed>`;
  return feed;
}

// Function to replace '�' characters in a string
function replaceInvalidCharacters(str) {

  return str.replace(/�+/g, '');

}

// Function to count '�' characters in a string
function countInvalidCharacters(str) {

  return (str.match(/�/g) || []).length;
}

// Function to compare and clean video fields
function cleanVideoFields(video1, video2) {
  return {
    title: compareAndCleanField(video1.title, video2.title),
    id: compareAndCleanField(video1.id, video2.id),
    published_at: compareAndCleanField(video1.published_at, video2.published_at),
    available_at: compareAndCleanField(video1.available_at, video2.available_at),
    channel: {
      name: compareAndCleanField(video1.channel.name, video2.channel.name),
      english_name: compareAndCleanField(video1.channel.english_name, video2.channel.english_name),
      id: compareAndCleanField(video1.channel.id, video2.channel.id)
    }
  };
}

// Function to compare and clean a single field
function compareAndCleanField(field1, field2) {
  const invalidCount1 = countInvalidCharacters(field1);
  const invalidCount2 = countInvalidCharacters(field2);
  
  const cleanField = invalidCount1 <= invalidCount2 ? field1 : field2;
  return replaceInvalidCharacters(cleanField);

}

// Define a callback function to handle the API response
function handleResponse(response) {
  let data = '';

  response.on('data', chunk => {
    data += chunk;
  });

  response.on('end', () => {
    if (response.statusCode === 200) {
      let videos;
      try {
        videos = JSON.parse(data);
      } catch (error) {
        console.error('Error parsing JSON:', error.message);
        return;
      }

      // Check if any '�' characters are present in any video fields

      let hasInvalidCharacters = videos.some(video => hasInvalidCharacterInVideo(video));

      if (hasInvalidCharacters && !hasRefetched) {
        console.log("Invalid characters found in some fields. Refetching once...");

        // Store the initial fetch data for comparison
        initialVideos = videos;

        // Refetch logic
        hasRefetched = true;
        setTimeout(() => {
          const apiUrl = `https://holodex.net/api/v2/videos?${queryString}`;
          const requestOptions = {
            headers: {
              'X-APIKEY': apiKey
            }
          };

          const req = https.request(apiUrl, requestOptions, handleResponse);
          req.end();
        }, 1000); // 1-second delay
        return;
    }

      // If refetched, compare with initial videos and clean the fields
      if (hasRefetched) {
        videos = videos.map((video, index) => cleanVideoFields(video, initialVideos[index]));
      }


      // Replace '�' characters in the response data
      let cleanedVideos = videos.map(video => {
        return {
          ...video,
          title: replaceInvalidCharacters(video.title),
          id: replaceInvalidCharacters(video.id),
          published_at: replaceInvalidCharacters(video.published_at),
          available_at: replaceInvalidCharacters(video.available_at),
          channel: {
            ...video.channel,
            name: replaceInvalidCharacters(video.channel.name),
            english_name: replaceInvalidCharacters(video.channel.english_name),
            id: replaceInvalidCharacters(video.channel.id),
          },
          // Add other fields as needed
        };
      });


      // Process videos and generate Atom feed
      cleanedVideos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));

      const feedUrl = 'https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom'; // actual feed URL
      const feed = createAtomFeed(cleanedVideos, feedUrl);

      const outputPath = path.join(__dirname, 'feeds', 'holodex.atom');
      fs.writeFileSync(outputPath, feed, 'utf8');
      console.log('Atom feed generated successfully at', outputPath);
    } else {
      console.log(`Error: ${response.statusCode} ${response.statusMessage}`);
    }
  });
}

// Function to check if a video object has invalid characters in any field
function hasInvalidCharacterInVideo(video) {
  return (
    countInvalidCharacters(video.title) > 0 ||
    countInvalidCharacters(video.id) > 0 ||
    countInvalidCharacters(video.published_at) > 0 ||
    countInvalidCharacters(video.available_at) > 0 ||
    countInvalidCharacters(video.channel.name) > 0 ||
    countInvalidCharacters(video.channel.english_name) > 0 ||
    countInvalidCharacters(video.channel.id) > 0
    // Add other fields as needed
  );
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
