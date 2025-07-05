export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { athleteId, apiKey, date, oldest, newest } = req.body;
    
    if (!athleteId || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Build API URL - handle both single date and date range
    let apiUrl;
    if (oldest && newest) {
      // Date range query for calendar
      apiUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`;
    } else if (date) {
      // Single date query
      apiUrl = `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${date}&newest=${date}`;
    } else {
      return res.status(400).json({ error: 'Either date or oldest/newest range required' });
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Intervals.icu API error: ${response.status}` 
      });
    }
    
    const events = await response.json();
    
    return res.status(200).json({ 
      events: events,
      total: events.length 
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
