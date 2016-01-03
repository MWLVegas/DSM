const Hapi = require('hapi');

// Create a server
const server = new Hapi.Server();
server.connection({
  host: '0.0.0.0',
  port: 7777
});

// Add the routes
server.route({
  method: 'GET',
  path: '/',
  handler: function(request, reply) {
    reply("Home of some future kickass stuff.");
  }
});

server.route({
  method: 'GET',
  path: '/hello',
  handler: function(request, reply) {
    return reply("Howdy, world.");
  }
});

// Start the server
// -- New ES6 syntax for functions.  The (args) => {} is equivalent to function something(args) { do function stuff; } 
server.start((err) => {
  // If it doesn't start, complain.
  if (err) {
    throw err;
  }

  console.log('Server running at: ', server.info.uri);
});
