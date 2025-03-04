const path = require("path");

module.exports = {
  entry: "./src/index.js",
  target: "webworker", // Workers runtime
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "worker.js",
  },
  resolve: {
    fallback: {
      "http": false, // ytdl-core uses fetch internally, no need for http polyfill
      "https": false,
      "stream": false, // We handle streams manually
      "zlib": false,
      "url": false,
    },
  },
};
