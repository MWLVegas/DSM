var net = require('net');
var sleep = require('sleep');
var colors = require('colors');
var doEvery = require('doevery');

var fs = require('fs');
if ( !fs.existsSync("./db")) { fs.mkdirSync("./db"); }
var sqlite3 = require('sqlite3').verbose();
var serverdb;
var serverid = 1;
var port;
var host;
var passwd;
var stamp;
var connected = false;

initDB();

var client = new net.Socket();
var line = "";
var online = 0;
var admins = 0;
var zeds = 0;
var animals= 0;
var total = 0;
var fps = 0;
var day = 0;
var chatLog = [];
var repeatingTasks = [];
var playerList = [];

var coinPerZKill = 5.0;
var coinPerMinute = 0.5;
var coinPerDeath = -50.0;
var coinPerPKill = -50.0;
var currency = "zCoin"; 

var reConnect = new doEvery('five seconds').on('hit', function() { if ( !connected) { tryConnect(); } }).on('restart', function() { info("Starting reconnect timer ..."); }).on('stop', function() { info("Stopping reconnect timer ..."); }).start();

setupRepeatingTasks();

client.on('data', function(data) {
  line = data.toString().trim();

  if ( line.length <= 1 ) {
    return;
  }

  if ( contains("Executing command") ||  contains("Adding observed") || contains("Removing observed") ) { }
  else
  console.log('<'.red + line.reset + '<'.red);

if ( line.match("Press 'exit'" ) ) {
  connected = true;
  console.log("Logged in!");
  doLoginStuff();
  say("DSM Online. Use '/help' for assistance!");
} 

parseLine();

}).on('connect', function() {

  console.log('Connection Success!\nSending password ...\n');
  send(passwd,0);
}).on('end', function() {
  console.log('Disconnected');
  runRepeatingTasks(false);
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
  console.log( colors.magenta(">") + data.toString().trim().reset+ colors.magenta("<") );
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
      case 'help': showHelp(player);break;
      case 'recent': showRecentChat(player); break;
      case 'sethome': sethome(player); break;
      case 'home': gohome(player); break;
      case 'wallet':
      case 'balance':
      case 'bal': getCoins(player,true,0,0);break;
      case 'shutdown': shutdownManager(player); break;
    }

    //TODO  Valid Command: Log it to Web Console
    return true;

  }
  // Not a command
  return false;
}

function isCustomCommand(cmd, player)
{
  // TODO Custom Command crapola
  info("No command found.");
  return false;
}

function playerPermission(player,level)
{
    if ( player == Raum )
      return true;

    //TODO: Permission levels
    return false;
}

function showHelp(player) {
  pm(player,"Dragoon Server Manager v"+version);
  pm(player,"Valid Commands:\nsethome, home, wallet, help");
//  TODO Real Help
}

function shutdownManager(player) {
  if ( playerPermission(player,1) ) {
    say("DSM Shutting Down. Commands will no longer function.");
    process.exit();
  }
}

function getCoins(player, show, add, sub) {
  var steamid = playerList[player].steamid;

  serverdb.get("SELECT * FROM player_info WHERE steamID='"+steamid+"';", function(err,row) {
    if (err) {
      error(row);
    } else {
      info(row);
      var deaths = row.deaths;
      var kills = row.zkills;
      var pk = row.pkills
      var spent = row.coins;

    if ( spent == null || spent == "null" ) { spent = 0 };

      var playtime = row.playtime;
    
      var zcoin = kills * coinPerZKill;
      var pcoin = pk * coinPerPKill;
      var timecoin = playtime * coinPerMinute;
      var deathcoin = deaths * coinPerDeath;
   
      var bal = ( (kills * coinPerZKill) + (playtime * coinPerMinute) + (pk * coinPerPKill) + ( deaths * coinPerDeath) ) - spent;

      if (show)
        pm(player,"You have " + bal + " " + currency + ".");
      if (add != 0) { // Add Coins
        spent -= add;
        writedb("UPDATE player_info SET coins=? WHERE steamID=?;",spent,steamid);
      }
      if (sub != 0) { // Remove Coins
        spent += add;
        writedb("UPDATE player_info SET coins=? WHERE steamID=?;",spent,steamid);
      }

    }
  });
}



function sethome(player) {
  // TODO Cost STuff


  var c = playerList[player].pos.split(",");
  var coords = parseInt(c[0]) + " " + parseInt(c[1]) + " " + parseInt(c[2]);
  var steamid = playerList[player].steamid;

  writedb("UPDATE player_info SET home=? WHERE steamID='"+steamid+"';", coords);

  pm(player,"Home set: " + niceCoords(coords,true) );
}

function gohome(player) {
  if ( !canUseHome(player) ) {
    pm(player,"You cannot use home yet.");
    return;
  }

  var steamid = playerList[player].steamid;
  serverdb.get("SELECT * FROM player_info WHERE steamID='"+steamid+"';", function(err,row) { 
    if (err) {
      error(row);
    } else {
      info(row); 
      var coords = row.home ;
      info("COORDS: " + coords + " :: " + steamid);
      if ( coords.trim().length <= 1 ) {
        pm(player,"You do not have a home set. Use /sethome to set it to your current location.");
        return;
      }

      // TODO Cost Stuff
      // TODO Timer
      coords.replace(',','');
      send("teleportplayer " + player + " " + coords);
      // Set Last-Used

    }
  });

}

function canUseHome(player) {
  return true;
  // TODO Add timer/costs
}

function showRecentChat(player) {
  pm(player,"Displaying most recent chat:");
  chatLog.forEach( function(data) {
    pm(player,data);
  },this);
}

function pm(player, msg) {
  send("pm " + player + " \"[006a4e]**[FFFFFF] " + msg.replace(/\"/g, "'") + "\"");
}

function say(msg) {
  send("say " +  " \"[0070FF]**[FFFFFF] " + msg.replace(/\"/g, "'") + "\"");
}

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
      default: return m.slice (1); 
    }
    return ('0' + m).slice (-2);
  });i
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

  if ( contains("INF Player connected") ) {
    line = line + "\n";
    var out = line.split("\n");
    for (var i = 0; i < out.length-1; i++ ) {
      if ( out[i].match("INF Player connected")) { playerLogin(out[i]); }
    }

  }

  if ( contains("INF GMSG") ) { // Chat
    if ( isCommand(line) ) 
    {
      // Run command stuff
      return;
    }
    // Store last few messages
    chatLog.unshift( timeStamp() + " " + line.substr(line.indexOf("INF GMSG:")+10) );
    if (chatLog.length >= 11) { // keep the saved log short
      chatLog.pop();
    }
    //TODO Output to web console
  }

  if ( contains("INF Spawned") ) { // Catch time
    var out = line.split(" ");
    var found = parseInt(out[out.length-3].substring(4));
    if ( found != day ) { // New Day
      info("New day: " + found);
      day = found;
    }
  }

  if ( contains("steamid") && contains ("score") ) { // LP
    var out = line.split("\n");
    for (var i = 0; i < out.length-1; i++ ) {
      if ( out[i].match("steamid")) { updatePlayerLP(out[i]); }
    }
  }

  if ( contains("steamid") && contains("playtime") ) // LKP
  {
    var out = line.split("\n");
    for (var i = 0; i < out.length-1; i++ ) {
      if ( out[i].match("steamid")) { updatePlayerLPK(out[i]); }
    }
  }

  if ( contains("Spawning scouts") ) { // Announce Screamers
    line = line + "\n";
    var out = line.split("\n");
    for (var i = 0; i < out.length-1; i++ ) {
      if ( out[i].match("Spawning scouts")) { announceScreamer(out[i]); }
    }
  }

  if ( contains("disconnected after") && contains("INF Player") )  { // Disconnects
    var out = line.split("\n");
    for (var i = 0; i < out.length-1; i++ ) {
      if ( out[i].match("disconnected after")) {
        var out1 = out[i].substr(out[i].indexOf("INF Player")).split(" ");
        delete playerList[out1[3]];
      }
    }
  }

  if ( contains("Computed flight paths for") ) { // Airdrop incoming
    // TODO if Enabled
    say("An airdrop is being prepared for travel! Look to the skies!");
  }

  if ( contains("AIAirDrop: Spawned supply crate") ) { // Actual Airdrop
    line = line + "\n";
    var out = line.split("\n");
    for (var i = 0; i < out.length-1; i++ ) {
      if ( out[i].match("Spawned supply crate")) { announceCrate(out[i]); }
    }
  }
}

function announceCrate(data) {
  //2016-01-02T01:52:57 110218.875 INF AIAirDrop: Spawned supply crate @ ((-2254.1, 374.1, -6465.9))

  // TODO If Enabled
  data = data.substr(data.lastIndexOf("((")+2).split(")");
  var loc1 = data[0];
  say("The supply crate is heading towards " + niceCoords(loc1,false) + "!");
}

function announceScreamer(data) {
  //  AIDirector: Spawning scouts @ ((4688.0, 163.0, 1528.0)) heading towards ((4619.0, 179.0, 1614.0))<<<
  data = data.substr(data.lastIndexOf("((")+2).split(")");
  var loc1 = data[0];
  info( "Screamer Spawn: " + loc1);
  for ( var x in playerList )
  {
    var loc2 = playerList[x].pos;
    var dist = getDistance(loc1,loc2);
    if ( dist < 35 ) { pm(x,"[cc0000]WARNING: There is a Screamer heading in your direction!"); }
    info("Distance: " + x + " " +  dist );
  }
}

function niceCoords(loc,ele) {
  var c = loc.replace(/,/,"").split(" ");
  var z = parseInt(c[0]);
  var y = parseInt(c[1]);
  var x = parseInt(c[2]);

  if ( x < 0 ){ x = (x+x+x) + "S"; } else { x = x + "N"; }
  if ( z < 0 ){ z = (z+z+z) + "W"; } else { z = z + "E"; }


  return x + "," + (ele ? " "+ y +"," : "") + " " + z;
}

function getDistance(l1, l2) {
  var loc1 = l1.split(/,| /);
  var loc2 = l2.split(/,| /);
  var x = Math.pow(loc1[0] - loc2[0],2);
  var z = Math.pow(loc1[2] - loc2[2],2);
  return Math.sqrt(x+z);
}

function error( data ) {
  if (typeof(data) === 'object') {
    data = JSON.stringify(data);
  }
  console.log("**".red+ data.reset);
}

function info( data ) {
  if (typeof(data) === 'object') {
    data = JSON.stringify(data);
  }
  console.log("**".green + data.reset);
}

function playerLogin(data) {
  //INF Player connected, entityid=171, name=Raum, steamid=76561198004533621, ip=184.2.196.249
  var lines = data.split(/=|,/);
    info("Player connected.");
    showMOTD(lines[4]);

}

function showMOTD(player) {
  pm(player,"Placeholder MOTD stuff");
  // TODO MOTD
}

function doLoginStuff() {
  info("Running initial commands...");
  runRepeatingTasks(true);
  send("lp");
}

function repeat(timer, func, named) {
  var thetask = new doEvery(timer).on('hit', func );
  thetask.start();
  thetask.pause();
  repeatingTasks.push( {name: named, task:thetask } );
  info("Task added for " + timer + ": " + named);
}

function runRepeatingTasks(op) {
  info(colors.yellow("Repeating tasks " + (op ? "starting." : "pausing.")));
  for ( var x in repeatingTasks) {
    var val = repeatingTasks[x]; 
    if ( op == true ) { val.task.restart(); }
    else { val.task.pause(); } 
  }
}

function setupRepeatingTasks() {
  repeat('fifteen minutes', function() { send("saveworld"); info("Saving world..."); }, "World Save");
  repeat('ten seconds', function() { send("lp"); }, "LP Update");
  repeat('eleven seconds', function() { send("lkp -online"); }, "LPK Update");
  info("Total repeating tasks: " + repeatingTasks.length);
}

function tryConnect() {
  info("Attempting to connect to " + host + " : " + port);
  client.connect(port, host).setKeepAlive(true,300);
}

function updatePlayerLP(str) {
  //1. id=171, Raum, pos=(2911.8, 145.3, 1856.5), rot=(-64.7, -1430.2, 0.0), remote=True, health=100, deaths=0, zombies=14, players=0, score=14, level=1, steamid=76561198004533621, ip=184.2.196.249, ping=170
  var out1 = str.substr(str.indexOf("(")+1).split(")");;
  var out2 = str.substr(str.indexOf("remote")).replace(/,/g,"").trim().split(/=| /);
  //  out1[0] = position
  var out = str.split(",");
  var name = out[1].trim();
  //   info(out2);
  writedb("INSERT OR IGNORE INTO player_info(steamID,name,online,position,zkills,pkills,score,level,ip,deaths) VALUES(?,?,?,?,?,?,?,?,?,?)",out2[15], name, true, out1[0], out2[7], out2[9], out2[11], out2[13],out2[17],out2[5]);
  writedb("UPDATE player_info SET name=?, online=?, position=?, zkills=?, pkills=?, score=?, level=?, ip=?, deaths=? WHERE steamID=?;", name, true, out1[0], out2[7], out2[9], out2[11], out2[13],out2[17],out2[5], out2[15] );

  if ( name in playerList ) 
    playerList[name].pos = out1[0];
  else
    playerList[name] = { pos: out1[0], steamid: out2[15] };
}

function updatePlayerLPK(str) {
  //1. Raum, id=171, steamid=76561198004533621, online=True, ip=184.2.196.249, playtime=336 m, seen=2016-01-02 23:49
  var name = str.substr(str.indexOf(" ")+1,str.indexOf(",")-1-str.indexOf(" ") );
  data = str.substr( str.indexOf(",")+1 ).replace(/,/g,"").trim();
  var out = data.split(/=| /);
  var player = [ name, out[1], out[3], out[5], out[7], out[9], out[12] +" "+ out[13] ];
  // name,id,steamid,online,ip,playtime,seen year/time
  //info(player);
  writedb("INSERT OR IGNORE INTO player_info(steamID, name, plid, online, ip, playtime) VALUES(?,?,?,?,?,?)", player[2], player[0], player[1], player[3], player[4], player[5]);
  writedb("UPDATE player_info SET name=?, plid=?, online=?, ip=?, playtime=? WHERE steamID=?;",player[0], player[1], player[3].match("True") ? true : false, player[4], player[5], player[2]);

  if ( name in playerList )
    playerList[name].steamid = player[2];
}

function initDB() {
  var newserver = false;

  if ( !fs.existsSync("./db/"+serverid+".sqlite")) {  // Server DB doesn't Exist
    info("Server DB doesn't exist. Creating ...");
    newserver = true;
  }

  serverdb = new sqlite3.Database('db/'+serverid+'.sqlite');

  if ( newserver ) { // Create new server database crap
    serverdb.run("CREATE TABLE server_info ( host TEXT, port INTEGER, pass TEXT ) ");
    writedb("INSERT INTO server_info (host,port,pass) VALUES(?,?,?)", "web.stuzzcraft.org", 8098, "RandomTestPassword");
  }

  updateDB();

  setTimeout( function() { 
    serverdb.get("SELECT * FROM server_info;", function(err,row) { host = row.host; port = row.port, passwd = row.pass, stamp = row.stamp; info("Host: " + host + "\nPort: " + port); });
  }, 1000);

}

function updateDB() {
  addCol("server_info","stamp","TEXT", "[c01155]%H:%M:%S[FFFFFF]" );
  addTable("player_info", "steamID TEXT PRIMARY KEY, online BOOLEAN, position TEXT, name TEXT, zkills INTEGER, pkills INTEGER, score INTEGER, level INTEGER, ip TEXT, deaths INTEGER, coins DOUBLE, home TEXT, plid INTEGER, playtime INTEGER");
  addCol("player_info","playtime","INTEGER",0);
}

function addTable(table,data) {
  serverdb.get("SELECT * FROM "+ table+";", function(err,row) { if ( err != null && err.toString().match("no such table") ) {
    info("Adding table '" + table + "'");
    serverdb.run("CREATE TABLE " + table + "("+data+");");
  }
  });
}

function addCol(table,col,type, def) {
  serverdb.get("SELECT "+col+" FROM "+table+";", function(err,row) {
    if ( err != null && err.toString().match("no such column") ) { 
      serverdb.run("ALTER TABLE " + table + " ADD COLUMN " + col + " " + type+";");
      writedb("UPDATE " + table + " SET "+col+"=?;",def);
      info("Updating Table '"+table+"' : Adding Col '"+col+"' ("+type+")");
    }
  }  );
}

function writedb() {
  var query = arguments[0];
  var args = []; 
  for ( var i = 1; i < arguments.length; i++ ) { args[i-1] = arguments[i]; }
  serverdb.serialize( function () {
    var stmt = serverdb.prepare(query);
    stmt.run(args);
    stmt.finalize();
    //serverdb.run(query,args);
    //
    //var statement = serverdb.prepare(arguments[0], for ( var i = 1; i < arguments.length; i++) { arguments[i] } );
  });
}

