// Quick script to find the project key for "90 Days"
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/jira/projects',
  method: 'GET',
  headers: {
    'Cookie': '' // Will use session from browser
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const projects = json.projects || [];
      
      console.log('\n=== ALL PROJECTS ===');
      projects.forEach(p => {
        console.log(`${p.key} - ${p.name}`);
      });
      
      console.log('\n=== SEARCHING FOR "90 Days" ===');
      const ninetyDays = projects.find(p => 
        p.name.toLowerCase().includes('90 days') || 
        p.name.toLowerCase().includes('90days')
      );
      
      if (ninetyDays) {
        console.log(`✅ FOUND: ${ninetyDays.key} - ${ninetyDays.name}`);
      } else {
        console.log('❌ NOT FOUND - showing first 3 projects:');
        projects.slice(0, 3).forEach(p => {
          console.log(`   ${p.key} - ${p.name}`);
        });
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
