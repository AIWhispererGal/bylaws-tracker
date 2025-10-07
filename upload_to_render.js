const https = require('https');
const fs = require('fs');

// Load parsed sections
const sections = JSON.parse(fs.readFileSync('parsed_sections.json', 'utf8'));

console.log(`Uploading ${sections.length} sections to Render...`);

const payload = JSON.stringify({
  docId: '1LdE2NGMOJ7BgV19V3Qb-hnN5VTmB5C_Hh6heemqxviA',
  sections: sections
});

const options = {
  hostname: 'bylaws-amendment-tracker.onrender.com',
  port: 443,
  path: '/bylaws/api/initialize',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);

    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log(`\n✅ SUCCESS! Uploaded ${sections.length} sections`);
        console.log(`Inserted: ${result.inserted}`);
        console.log(`Updated: ${result.updated}`);
      } else {
        console.log('❌ Error:', result.error);
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(payload);
req.end();
