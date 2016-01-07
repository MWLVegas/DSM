var net = require('net');
var sleep = require('sleep');
var colors = require('colors');
var doEvery = require('doevery');

var fs = require('fs');
if ( !fs.existsSync("./db")) { fs.mkdirSync("./db"); }
var sqlite3 = require('sqlite3').verbose();
var serverdb;

var serverid = 0;
var port;
var host;
var passwd;

var stamp;
var connected = false;

var client = new net.Socket();
var online = 0;
var admins = 0;
var zeds = 0;
var animals= 0;
var total = 0;
var fps = 0;
var day = 0;
var chatLog = [];
var repeatingTasks = [];
var playerList = {};
var input = [];
var coinPerZKill = 5.0;
var coinPerMinute = 0.5;
var coinPerDeath = -50.0;
var coinPerPKill = -50.0;
var currency = "zCoin"; 
var forced = false;

var reConnect = new doEvery('five seconds').on('hit', function() { if ( !connected) { tryConnect(); } }).on('restart', function() { info("Starting reconnect timer ..."); }).on('stop', function() { info("Stopping reconnect timer ..."); }).start();

var args = process.argv.slice(2);
args.forEach( function (val,index,array) {
//  console.log(index + ': ' + val);
  if ( val.startsWith("-h:") ) { host = val.substr(3); forced = true; }
  if ( val.startsWith("-p:") ) { port = val.substr(3); forced = true; }
  if ( val.startsWith("-pw:") ) { passwd = val.substr(4); forced = true; }
  if ( val.startsWith("-i:" )) { serverid = val.substr(3);}
});

if ( serverid == 0 ) {
  info("You must provide a serverid with -i:(id)");
  process.exit();
}


initDB();
setupRepeatingTasks();
var processInputTimer = setInterval( function() { processInput(); }, 100 );

client.on('data', function(data) {
  var lines = data.toString().trim().split(/\n\r|\r\n|\n|\r/);

  for ( var x in lines )  {
    var line = lines[x];

    if ( line.length <= 1 ) {
      continue;
    }

    input.push(line);

    if ( line.match("Executing command") ||  line.match("Adding observed") || line.match("Removing observed") ) { }
    else
  console.log('<'.red + line.reset + '<'.red);

if ( line.match("Press 'exit'" ) ) {
  connected = true;
  console.log("Logged in!");
  doLoginStuff();
  //  say("DSM Online. Use '/help' for assistance!");
} 

}
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

function send(data) {
  client.write(data.toString().trim() + "\n");
  console.log( colors.magenta(">") + data.toString().trim().reset+ colors.magenta("<") );
}

function showPlayerList(player) {
  if ( !playerPermission(player,1) )
    return;

  for ( var x in playerList )
  {
    pm(player,"Key: " + x);
    var value = playerList[x];
    for (var y in value ) {
      pm(player,"-- " + y + ": "+value[y]);
    }
  }
}

function isCommand(line)
{
  var inp = line.substr(line.indexOf("INF GMSG:")).split(":");
  if ( !inp[2] )
    return false;
  var player = inp[1].trim();

  //  .split(" ");
  if ( inp[2].trim().startsWith("/") )
  {
    var cmd = inp[2].trim().substr(1);

    info("Attempted Command: " + cmd + " from " + player );
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
      case 'plist': showPlayerList(player);
      case 'coords': coords = playerList[player].pos; pm(player,"Coords: " + coords + " : Nice Coords: " + niceCoords(coords,true)); break;
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
  if ( player == 'Raum' )
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
      var coords = row.home;
      info("COORDS: " + coords + " :: " + steamid);
      if ( !coords || coords == null || coords.trim().length <= 1 ) {
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

function processInput() {

  if ( input.length == 0 )
    return;

  var line = input[0];
  input.splice(0,1);
  parseLine(line);

}

function parseLine(line) {

  if ( line.match("INF Time" ) ) { // Mem 
    var out = line.split(" ");
    fps = parseInt(out[out.length-20]);
    online = parseInt(out[out.length-10]);
    zeds = parseInt(out[out.length-8]);
    animals = parseInt(out[out.length-6]) - zeds - online;
    info("FPS: " + fps + " Online: " + online + " Zombies: " + zeds + " Animals: " + animals);
  }

  if ( line.match("INF Player connected") ) {
    playerLogin(line);
  }

  if ( line.match("INF GMSG") ) { // Chat
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

  if ( line.match("INF Spawned") ) { // Catch time
    var out = line.split(" ");
    var found = parseInt(out[out.length-3].substring(4));
    if ( found != day ) { // New Day
      info("New day: " + found);
      day = found;
    }
  }

  if ( line.match("steamid") && line.match("score") ) { // LP
    updatePlayerLP(line);
  }

  if ( line.match("steamid") && line.match("playtime") ) // LKP
  {
    updatePlayerLPK(line);
  }

  if ( line.match("Spawning scouts") ) { // Announce Screamers
    announceScreamer(line);
  }

  if ( line.match("disconnected after") && line.match("INF Player") )  { // Disconnects
    var out1 = line.substr(line.indexOf("INF Player")).split(" ");
    delete playerList[out1[3]];
  }

  if ( line.match("Computed flight paths for") ) { // Airdrop incoming
    // TODO if Enabled
    say("An airdrop is being prepared for travel! Look to the skies!");
  }

  if ( line.match("AIAirDrop: Spawned supply crate") ) { // Actual Airdrop
    announceCrate(line);
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
  info(c);

  if ( x < 0 ){ x = Math.abs(x) + "S"; } else { x = x + "N"; }
  if ( z < 0 ){ z = Math.abs(z) + "W"; } else { z = z + "E"; }


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
    if ( !host || !passwd || !port )     {
      info("You must use all arguments for the first run.");
      process.exit();
    }

    info("Server DB doesn't exist. Creating ...");
    newserver = true;
  }

  serverdb = new sqlite3.Database('db/'+serverid+'.sqlite');

  if ( newserver ) { // Create new server database crap
    serverdb.run("CREATE TABLE server_info ( host TEXT, port INTEGER, pass TEXT ) ");
    writedb("INSERT INTO server_info (host,port,pass) VALUES(?,?,?)", host,port,passwd); //"web.stuzzcraft.org", 8098, "RandomTestPassword");
  }

  updateDB();

  setTimeout( function() { 
    if ( newserver ) { // New Server - Restart to get rid of args
    info("New server set up.");
    }

    if ( !forced ) {
    serverdb.get("SELECT * FROM server_info;", function(err,row) { if ( err ) { info("No valid host, port and password found."); process.exit(); } host = row.host; port = row.port, passwd = row.pass, stamp = row.stamp; info("Host: " + host + "\nPort: " + port); });
    }
    else {
      writedb("UPDATE server_info SET host=?,port=?,pass=?",host,port,passwd);
      info("Updating DB with New Info. Restarting");
    }
  }, 1000);

}

function updateDB() {
  addCol("server_info","stamp","TEXT", "[c01155]%H:%M:%S[FFFFFF]" );
  addTable("player_info", "steamID TEXT PRIMARY KEY, online BOOLEAN, position TEXT, name TEXT, zkills INTEGER, pkills INTEGER, score INTEGER, level INTEGER, ip TEXT, deaths INTEGER, coins DOUBLE, home TEXT, plid INTEGER, playtime INTEGER");
  addCol("player_info","playtime","INTEGER",0);
  addTable("gate_info", "owner TEXT, coords TEXT, public BOOLEAN, label TEXT");
}

function addTable(table,data) {
  serverdb.get("SELECT * FROM "+ table+";", function(err,row) { if ( err != null && err.toString().match("no such table") ) {
    info("Adding table '" + table + "'");
    serverdb.run("CREATE TABLE " + table + "("+data+");");
  }
  });
}

function addCol(table,col,type, def) {
  setTimeout( function() {
    serverdb.get("SELECT "+col+" FROM "+table+";", function(err,row) {
      if ( err != null && err.toString().match("no such column") ) { 
        serverdb.run("ALTER TABLE " + table + " ADD COLUMN " + col + " " + type+";");
        writedb("UPDATE " + table + " SET "+col+"=?;",def);
        info("Updating Table '"+table+"' : Adding Col '"+col+"' ("+type+")");
      }
    }  );
  }, 500);


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

