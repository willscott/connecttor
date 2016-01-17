/**
 * Connect-tor. Platform help for interacting with tor.
 */

var chalk = require('chalk');
var child_process = require('child_process');
var fs = require('fs');
var net = require('net');
var path = require('path');

var util = require('./util');

// The PID of a started to process, if one has been started by node.
var runningChild;

process.on('exit', function () {
  if (runningChild) {
    runningChild.kill();
  }
});

/**
 * Create an authenticated net.socket connected to the control port of a
 * tor child process started by this process.
 */
var connectWithChild = function (success, failure) {
  var cookie = readChildAuthCookie();
  var port = readChildControlPort();
  var client = net.connect({host: '127.0.0.1', port: port}, function () {
    client.removeListener('error', failure);
    util.attemptAuthentication(client, cookie, success, failure);
  });
  // Catch socket-open errors.
  client.on('error', failure);
};

/**
 * write a torrc with known credentials & safety.
 * Command reference at
 * https://gitweb.torproject.org/tor.git/tree/src/config/torrc.sample.in
 * Largely modeled after the TorBrowser rc.
 */
var generateTorrc = function() {
  var template =
      "AvoidDiskWrites 1\n" +
      "Log notice stderr\n" +
      "SocksPort auto IPv6Traffic PreferIPv6 KeepAliveIsolateSOCKSAuth\n" +
      "ControlPort auto\n" +
      "ControlPortWriteToFile " + path.join(process.cwd(), ".tor", "control-port") + "\n" +
      "CookieAuthentication 1\n" +
      "DirReqStatistics 0\n" +
      "HiddenServiceStatistics 0\n";
  var base = path.join(process.cwd(), ".tor");
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base);
  }
  template += "DataDirectory " + base + "\n";

  var filename = path.join(base, "torrc");
  fs.writeFileSync(filename, template);
  return filename;
};

// Find the dir/.tor/control_auth_cookie file and read its contents.
var readChildAuthCookie = function () {
  var cookie = path.join(process.cwd(), ".tor", "control_auth_cookie");
  if (fs.existsSync(cookie)) {
    return fs.readFileSync(cookie);
  }
  return "";
};

var readChildControlPort = function () {
  var port = path.join(process.cwd(), ".tor", "control-port");
  if (fs.existsSync(port)) {
    var data = fs.readFileSync(port).toString();
    var port = Number(data.split(":")[1]);
    return port;
  }
  return -1;
};

/**
 * Given a tor binary path, start it running as a daemon with known
 * torrc so that we know where the control port is.
 */
var startTor = function (binary, success, failure) {
  var torrc = generateTorrc();
  //todo: ControlPort auto; ControlPortWriteToFile <file>
  //todo: __OwningControllerProcess <pid>
  var child = child_process.spawn(binary, ['-f', torrc], {
    env: process.env
  });
  child.on('error', function () {
    console.error(chalk.red("Tor not found. Please install tor for your platform."));
    failure();
  });
  runningChild = child;
  setTimeout(waitForTor.bind(this, 0, success, failure), 100);
};

var waitForTor = function (i, success, failure) {
  if (readChildControlPort() > 0) {
    // TODO: potentially should explicitly 'take-ownership' on first connect.
    console.log('ctrl port found');
    connectWithChild(success, failure);
  } else if (i < 50) { // 5 seconds.
    console.log('failed to find ctrl port.');
    setTimeout(waitForTor.bind(this, i + 1, success, failure), 100);
  }
};

/**
 * Connect to the control socket of a running tor process.
 * callback is called with a pre-authenticated net.socket on success, or null
 * on failure.
 */
exports.connect = function (options, callback) {
  if (!callback && typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (runningChild) {
    return connectWithChild(callback, function(err) {
      console.error(chalk.red("Failed to connect to existing child."), err);
      callback(null);
    });
  }
  // if a binary path is explicitly set, use that.
  if (process.env.tor || options.tor) {
    var tor = process.env.tor || options.tor;
    startTor(tor, callback, function () {
      console.error(chalk.red("Failed to start the binary defined in the tor environmental variable."));
      callback(null);
    });
  } else if (!options.useSystem) {
    require('./download').download(options, function (tor) {
      if (!tor) {
        console.error(chalk.red("Failed to acquire an appropriate version of tor."));
        callback(null);
        return;
      }
      startTor(tor, callback, function (err) {
        console.error(chalk.red("Failed to start bundled tor:") + err);
        callback(null);
      });
    });
  } else {
    require('./linux').openUnixSocket(callback, function (err) {
      console.error(chalk.red("Failed to connect to system tor:") + err);
      callback(null);
    });
  }
};
