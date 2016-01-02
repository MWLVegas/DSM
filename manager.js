var connect = require('net');
var sleep = require('sleep');
var colors = require('colors');

var port = 8098;
var host = 'web.stuzzcraft.org';
var passwd = 'RandomTestPassword';

var connected = false;

var client = connect.connect(port, host);
var line = "";

var online =0;
var admins =0;
var zeds =0;
var animals=0;
var total = 0;
var fps = 0;

client.setKeepAlive(true,300);

client.on('data', function(data) {
  line = data.toString().trim();//.replace("\r",'');

  if ( line.length <= 1 ) {
     return;
  }

info('<<<'.red + line.reset + '<<<'.red);

if ( line.match("Press 'exit'" ) ) {
  connected = true;
  console.log("Logged in!");
  doLoginStuff();
}	

parseLine();

}).on('connect', function() {

console.log('Connection Success!\nSending password ...\n');
send(passwd,0);
}).on('end', function() {
  console.log('Disconnected');
  connected = false;
}).on('error', function() {
  info("Connection refused.");
  connected = false;
});


// Send Output
  process.stdin.resume(); // Activate STDIN
  process.stdin.setEncoding('utf8'); // Set it to string encoding
  process.stdin.on('data',function(chunk){ // Pipe STDIN to Socket.out
  send(chunk.toString() );
});
function contains(data) {
  if ( line.match(data) ) {
    return true;
  }
  return false;
}

function send(data) {
  client.write(data.toString().trim() + "\n");
  console.log(">>>"+data.toString().trim()+"<");
}

function parseLine() {

if ( contains("INF Time" ) ) { // Mem 
  var out = line.split(" ");
  fps = parseInt(out[out.length-20]);
  online = parseInt(out[out.length-10]);
  zeds = parseInt(out[out.length-8]);
  animals = parseInt(out[out.length-6]) - zeds - online;
  info("FPS: " + fps + " Online: " + online + " Zombies: " + zeds + " Animals: " + animals);
}

if ( online == -1 && contains("'lp") && contains("in the game") ) {
  var out = line.split(" ");
  online = parseInt(out[out.length-4]);
  info("Online Players: " + online);
}

if ( total == -1 && contains("'lkp") && contains("known") ) {
  var out1 = line.split(" ");
  total = parseInt(out1[ out1.length-2]);
  info("Total Players: " + total);
}

if ( zeds == -1 && contains("'le") && contains("in the game") ) {
  var out = line.split(" ");
  zeds = parseInt(out[ out.length-2]);
  info("Zeds Found: " + zeds);
}


}

function info( data ) {
  console.log(data);
}

function doLoginStuff() {
  info("Running initial commands..");
  getOnline();
  getTotal();
  getZeds();
}

function getTotal() {
  total = -1;
  send("lkp -online");
}

function getZeds() {
  zeds = -1;
  send("le");
}

function getOnline() {
  online = -1;
  send("lp");
}





