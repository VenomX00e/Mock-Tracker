const https = require('https');
https.get('https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f98a.svg', (res) => {
  console.log(res.statusCode);
});
