const fs = require('fs');
const https = require('https');
const zlib = require('zlib');

let content = fs.readFileSync('build.json', 'utf16le');
let startIndex = content.indexOf('{');
if (startIndex !== -1) {
    content = content.substring(startIndex);
}
const buildJson = JSON.parse(content);
const url = buildJson.logFiles[0];

https.get(url, (res) => {
  let chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    let buffer = Buffer.concat(chunks);
    // Check if it's gzipped
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      buffer = zlib.gunzipSync(buffer);
    }
    const data = buffer.toString('utf8');
    const lines = data.split('\n').filter(Boolean);
    const msgs = lines.map(line => {
      try {
        return JSON.parse(line).msg;
      } catch (e) {
        return line;
      }
    }).filter(Boolean);
    
    console.log("--- LAST 100 LINES ---");
    msgs.slice(-100).forEach(m => console.log(m));
  });
});
