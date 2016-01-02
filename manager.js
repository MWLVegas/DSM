var connect = require('net');
var sleep = require('sleep');


var port = 8088;
var host = 'localhost';
var passwd = 'Alexander1';

var connected = false;

var client = connect.connect(port, host);
var line = "";

client.setKeepAlive(true,300);

console.log('Connection Success!\nSending password ...\n');
send(passwd,0);

client.on('data', function(data) {
  line = data.toString().trim().replace("\r",'');

  if ( line.length <= 1 ) {
     return;
  }

console.log('RCVD:' + line + '<<<');

if ( line.match("Press 'exit'" ) ) {
  connected = true;
  console.log("Logged in!");
  doLoginStuff();
}	

if ( online == -1 && contains("Total of") && contains("in the game") ) {
  var out = line.split(" ");
  online = parseInt(out[out.length-4]);
  info("Online Players: " + online);
}

if ( total == -1 && contains("Total of") && contains("known") ) {
  var out1 = line.split(" ");
  total = parseInt(out1[ out1.length-2]);
  info("Total Players: " + total);
}

}).on('connect', function() {
  // Manually write an HTTP request.
  //I'm assuming I could send data at this point here, on connect?
}).on('end', function() {
  console.log('Disconnected');
  connected = false;
});

function contains(data) {
  if ( line.match(data) ) {
    return true;
  }

  return false;
}


function send(data,timer) {
  sleep.usleep(timer * 1000);
  client.write(data.toString().trim() + "\n");
  //	console.log(">"+data.toString().trim()+"<");
}

var online =0;
var admins =0;
var zeds =0;
var total = 0;

function info( data ) {
  console.log(data);
}

function doLoginStuff() {
  info("Running initial commands..");
  getOnline();
  getTotal();
}

function getTotal() {
  total = -1;
  send("lkp --online",500);
  //suspend( send("lkp --online"), 500);
  //send("lkp --online");
}

function getOnline() {
  online = -1;
  info("bleh");
  send("lp", 500);
}

// Output

process.stdin.resume(); // Activate STDIN
process.stdin.setEncoding('utf8'); // Set it to string encoding
process.stdin.on('data',function(chunk){ // Pipe STDIN to Socket.out
  client.write(chunk);
  console.log("SEND:"+chunk.toString());
});

function suspend(time, func) {
  setTimeout(func,time);
}

