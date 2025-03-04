addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// Polyfill fetch if needed (Workers already have it, but ensuring compatibility)
const fetch = globalThis.fetch;

// Import ytdl-core (assumes bundled version)
import ytdl from 'ytdl-core';

async function handleRequest(request) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const TELEGRAM_TOKEN = TELEGRAM_TOKEN || "your_default_token"; // Set via wrangler secret
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

  try {
    const update = await request.json();
    const chatId = update.message?.chat?.id;
    const messageText = update.message?.text;

    if (!chatId || !messageText) {
      return new Response("Invalid update", { status: 400 });
    }

    // Handle /start command
    if (messageText === "/start") {
      await sendMessage(chatId, "Welcome ConcatHubbers, enter a YouTube link to download your video!");
      return new Response("OK", { status: 200 });
    }

    // Check for YouTube link
    if (messageText.includes("youtube.com") || messageText.includes("youtu.be")) {
      await sendMessage(chatId, "Processing your video...");

      const videoId = ytdl.getURLVideoID(messageText);
      const downloadLink = `https://www.youtube.com/watch?v=${videoId}`;

      // Download video stream (highest quality mp4)
      const videoStream = ytdl(downloadLink, {
        filter: (format) => format.container === "mp4" && format.hasVideo && format.hasAudio,
        quality: "highest",
      });

      // Convert stream to Blob for Telegram
      const videoBlob = await streamToBlob(videoStream);

      // Check size (Telegram limit: 50MB for sendVideo)
      if (videoBlob.size > 50 * 1024 * 1024) {
        await sendMessage(chatId, "Video too large (>50MB). Try a shorter video or lower quality.");
        return new Response("File too large", { status: 400 });
      }

      // Send video to Telegram
      await sendVideo(chatId, videoBlob);
      return new Response("Video sent", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    await sendMessage(chatId, "An error occurred while processing your request.");
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Send a message to Telegram
async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

// Send a video to Telegram
async function sendVideo(chatId, videoBlob) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVideo`;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("video", videoBlob, `video_${Date.now()}.mp4`);
  formData.append("caption", "Enjoy your video :)");

  await fetch(url, {
    method: "POST",
    body: formData,
  });
}

// Convert stream to Blob (in-memory)
async function streamToBlob(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return new Blob(chunks, { type: "video/mp4" });
}
