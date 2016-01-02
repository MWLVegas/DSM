var Console = console.Console;
console.log("Attempting connection...");

var telnet = require('telnet-client');
var connection = new telnet();

var params = {
  host: 'localhost',
  port: 8088,
//  shellPrompt: '/ # ',
  timeout: 60000,
  // removeEcho: 4
};


connection.on('connect', function(prompt) {
	console.log("Connected!");
	connection.exec("Alexander1");
	connection.exec("lp", function(err,response) {
		console.log("Sending ...");
		console.log(response);
		console.log(err);
	});
});


connection.on('writedone', function(prompt) {
console.log("Write done.");
});
connection.on('ready', function(prompt) {
  connection.exec(cmd, function(err, response) {
    console.log(response);
console.log("Ready!");
  });
});

connection.on('timeout', function() {
  console.log('Socket Timeout');
  connection.exec('exit');

  connection.end();
  process.exit();;
});

connection.on('close', function() {
  console.log('connection closed');
});

connection.connect(params);
