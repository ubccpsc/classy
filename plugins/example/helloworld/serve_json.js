const http = require('http');

console.log('Starting serve_json.js...');

//create a server object:
http.createServer(function (req, res) {
  console.log('Request made');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(
      [
        'This data',
        'from the',
        'HelloWorld! service',
        'should appear on the front-end'
      ]
      ));
}).listen(3000); //the server object listens on port 3000
