import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    console.log(`Fetching: ${targetUrl}`);
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type') || 'application/xml';
    res.setHeader('Content-Type', contentType);
    
    const text = await response.text();
    res.send(text);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).send(`Error fetching URL: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`CORS Proxy Server running at http://localhost:${PORT}`);
});
