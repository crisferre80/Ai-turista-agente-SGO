const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const querystring = require('querystring');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/gmail.send'
];

const authorizationUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  include_granted_scopes: true,
});

console.log('Authorize this app by visiting this url:', authorizationUrl);

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/oauth2callback')) {
    const qs = querystring.parse(url.parse(req.url).query);
    const { code } = qs;

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      console.log('Refresh token:', tokens.refresh_token);
      console.log('Access token:', tokens.access_token);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h1>Authorization successful!</h1>
        <p>Add this to your .env.local:</p>
        <pre>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
        <p>You can close this window.</p>
      `);

      server.close();
    } catch (error) {
      console.error('Error getting tokens:', error);
      res.writeHead(500);
      res.end('Error');
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});