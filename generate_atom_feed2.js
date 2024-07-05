const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { HolodexApiClient } = require('@holores/holodex');

const apiKey = process.env.HOLODEX_API_KEY;
const holodex = new HolodexApiClient({ apiKey });

// Function to create an Atom feed from an array of video objects
function createAtomFeed(videos, feedUrl) {
  let feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:uuid:${uuidv4()}</id>
  <title>Hololive Karaoke Stream</title>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <updated>${new Date().toISOString()}</updated>
  <ttl>60</ttl>
`;

  videos.forEach(video => {
    const title = video.title;
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
    const authorUrl = `https://www.youtube.com/channel/${video.channel.id}`;
    const formattedAvailableTime = availableAt.toLocaleString('en-US', timeZoneOptions) + ' GMT+7';
    const summary = `<![CDATA[【LIVE at ${formattedAvailableTime}】 Watch on YouTube: ${link}]]>`;
    
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

// Fetch videos from Holodex API and create the Atom feed
async function generateAtomFeed() {
  try {
    const videos = await holodex.videos.getVideosUnpaginated({
      type: 'stream',
      topic: 'singing',
      org: 'Hololive',
      limit: 50,
      maxUpcomingHours: 18,
    });

    videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));

    const feedUrl = 'https://raw.githubusercontent.com/braboobssiere/holedex-song-list/main/feeds/holodex.atom'; // actual feed URL
    const feed = createAtomFeed(videos, feedUrl);

    const outputPath = path.join(__dirname, 'feeds', 'holodex2.atom');
    fs.writeFileSync(outputPath, feed);
    console.log('Atom feed generated successfully at', outputPath);
  } catch (error) {
    console.error('Error generating Atom feed:', error);
  }
}

generateAtomFeed();
