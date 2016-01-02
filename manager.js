var connect = require('net');
var sleep = require('sleep');
var colors = require('colors');
var doEvery = require('doevery');

var port = 8098;
var host = 'web.stuzzcraft.org';
var passwd = 'RandomTestPassword';

var connected = false;

var client = connect.connect(port, host);
var line = "";

var online = 0;
var admins = 0;
var zeds = 0;
var animals= 0;
var total = 0;
var fps = 0;
var chatLog = [];
var repeatingTasks = [];

var reConnect = new doEvery('five seconds').on('hit', function() { tryConnect(); }).on('restart', function() { info("Starting reconnect timer ..."); }).on('stop', function() { info("Stopping reconnect timer ..."); });

client.setKeepAlive(true,300);
setupRepeatingTasks();

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
  reConnect.pause();
}).on('end', function() {
  console.log('Disconnected');
  runRepeatingTasks(false);
  connected = false;
  reConnect.restart();
}).on('error', function() {
  info("Connection refused.");
  connected = false;
  reConnect.restart();
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

function isCommand()
{
  var input = line.substr(line.indexOf("INF GMSG:")+10).split(" ");
  if ( input[1].startsWith("/") )
  {
    info("Attempted Command: " + input[1] + " from " + input[0] );
    var cmd = input[1].substring(1);
    var player = input[0].substring(0,input[0].length-1);

    switch(cmd) {
      default: if ( isCustomCommand(cmd,player) ) { return true; } else { return false; }
                 //info("No command found."); return false;
      case 'recent': showRecentChat(player); break;
    }

    //TODO  Valid Command: Log it to Web Console
    return true;

  }

  return false;
}

function isCustomCommand(cmd, player)
{

  // TODO Custom Command crapola
  info("No command found.");
  return false;
}

function showRecentChat(player) {
  pm(player,"Displaying most recent chat:");
  chatLog.forEach( function(data) {
    pm(player,data);
  },this);
}

function pm(player, msg) {
  send("pm " + player + " \"" + msg.replace(/\"/g, "'") + "\"");
}

var stamp = "%H:%M:%S";
function timeStamp() {
  var date = new Date();
  return stamp.replace (/%[YmdHMS]/g, function (m) {
    switch (m) {
      case '%Y': return date.getFullYear();
      case '%m': m = 1 + date.getMonth(); break;
      case '%d': m = date.getDay(); break;
      case '%H': m = date.getHours(); break;
      case '%M': m = date.getMinutes(); break;
      case '%S': m = date.getSeconds(); break;
      default: return m.slice (1); // unknown code, remove %
    }
    // add leading zero if required
    return ('0' + m).slice (-2);
  });
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
  if ( contains("INF GMSG") ) { // Chat
    if ( isCommand(line) ) 
    {
      // Run command stuff
      return;
    }
    // Store last few messages
    chatLog.unshift( timeStamp() + line.substr(line.indexOf("INF GMSG:")+10) );
    if (chatLog.length >= 11) { // keep the saved log short
      chatLog.pop();
    }


    //TODO Output to web console
  }

  if ( total == -1 && contains("Total of") && contains("known") ) {
    var out1 = line.split(" ");
    total = parseInt(out1[ out1.length-2]);
    info("Total Players: " + total);
  }

}

function info( data ) {
  console.log(data);
}

function doLoginStuff() {
  info("Running initial commands..");
  runRepeatingTasks(true);
  getTotal();
}

function getTotal() {
  total = -1;
  send("lkp -online");
}

function repeat(timer, func, name) {
  var task = new doEvery(timer).on('hit', func );
  task.start();
  task.pause();
  repeatingTasks.push( task );
  info("Task added for " + timer + ": " + name);
}

function runRepeatingTasks(op) {

  repeatingTasks.forEach( function(task) {
    if ( op == true ) { task.restart(); info("Tasks starting.");  }
    else { task.pause(); info("Tasks pausing."); }
  },this);
}



function setupRepeatingTasks() {
  //  repeat('fifteen seconds', function() { send("saveworld"); info("Saving world..."); }, "World Save");
  repeat('fifteen minutes', function() { send("saveworld"); info("Saving world..."); }, "World Save");
  info("Total repeating tasks: " + repeatingTasks.length);
}

function tryConnect() {
  info("Attempting to connect ...");
  client = connect.connect(port, host);
}



