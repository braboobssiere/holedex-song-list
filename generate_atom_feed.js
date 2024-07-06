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
  // Replace '�' characters using a regular expression that matches any sequence of '�'
  return str.replace(/�+/g, '');  
}

// Function to check if the entire response has invalid characters
function hasInvalidCharacterInResponse(videos) {
  let hasInvalidCharacters = false;

  videos.forEach(video => {
    if (hasInvalidCharacterInVideo(video)) {
      hasInvalidCharacters = true;
    }
  });

  return hasInvalidCharacters;
}

// Function to check if a video object has invalid characters in any field
function hasInvalidCharacterInVideo(video) {
  // Convert video object to JSON string and check for '�' characters
  const jsonString = JSON.stringify(video);
  return jsonString.includes('�');
}

// Function to compare two videos and choose the one with fewer '�' characters
async function compareVideos(cleanedVideo, originalVideo) {
  // Example: Compare title fields
  const cleanedTitle = replaceInvalidCharacters(cleanedVideo.title);
  const originalTitle = replaceInvalidCharacters(originalVideo.title);

  // Compare and return the video with fewer '�' characters in each field
  if (countInvalidCharacters(cleanedTitle) < countInvalidCharacters(originalTitle)) {
    return cleanedVideo;
  } else {
    return originalVideo;
  }
}

// Function to count '�' characters in a string
function countInvalidCharacters(str) {
  return str.split('�').length - 1;
}

// Function to handle retrying the API request
function retryApiRequest(apiUrl, requestOptions, attemptNumber) {
  return new Promise((resolve, reject) => {
    console.log(`Attempt ${attemptNumber}: Retrying API request...`);

    const reqRetry = https.request(apiUrl, requestOptions, response => {
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
            reject(new Error(`Error parsing JSON: ${error.message}`));
            return;
          }

          // Check if any '�' characters are present in any video fields
          if (hasInvalidCharacterInResponse(videos)) {
            resolve(false); // Retry needed
          } else {
            resolve(videos); // No retry needed, proceed with videos
          }

        } else {
          reject(new Error(`Error: ${response.statusCode} ${response.statusMessage}`));
        }
      });
    });

    reqRetry.on('error', err => {
      reject(new Error(`Error making API request: ${err.message}`));
    });

    reqRetry.end();
  });
}

// Function to handle the API response
function handleResponse(response, attemptNumber) {
  let data = '';

  response.on('data', chunk => {
    data += chunk;
  });

  response.on('end', async () => {
    if (response.statusCode === 200) {
      let videos;
      try {
        videos = JSON.parse(data);
      } catch (error) {
        console.error('Error parsing JSON:', error.message);
        return;
      }

      // Retry logic (only retry once)
      if (hasInvalidCharacterInResponse(videos)) {
        console.log(`Attempt ${attemptNumber}: Invalid characters found in some fields. Retrying...`);
        const retrySuccessful = await retryApiRequest(apiUrl, requestOptions, attemptNumber + 1);
        if (!retrySuccessful) {
          console.log(`Attempt ${attemptNumber}: Maximum retries reached. Unable to fetch clean data.`);
          return;
        }
        // Retry succeeded, proceed with cleaned videos
      }

      // Process videos and generate Atom feed
      const cleanedVideos = await Promise.all(videos.map(video =>
        compareVideos(
          {
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
          },
          video
        )
      ));

      // Sort cleanedVideos as needed
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

// Log initial API request attempt
console.log("Initial API request...");

// Create the request to the Holodex API endpoint
const apiUrl = `https://holodex.net/api/v2/videos?${queryString}`;
const requestOptions = {
  headers: {
    'X-APIKEY': apiKey
  }
};

// Initial API request
const req = https.request(apiUrl, requestOptions, response => {
  handleResponse(response, 1); // Pass attempt number to handleResponse
});

req.end();
