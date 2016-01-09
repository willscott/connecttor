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

/**
 * Create an authenticated net.socket connected to the control port of a
 * tor child process started by this process.
 */
var connectWithChild = function (success, failure) {
  var cookie = readChildAuthCookie();
  var client = net.connect({host: '127.0.0.1', port: 9151}, function () {
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
      "SocksPort 9150 IPv6Traffic PreferIPv6 KeepAliveIsolateSOCKSAuth\n" +
      "ControlPort 9151\n" +
      "CookieAuthentication 1\n" +
      "DirReqStatistics 0\n" +
      "HiddenServiceStatistics 0\n";
  var base = path.join(process.cwd(), ".tor");
  if (!fs.fileExistsSync(base)) {
    fs.mkdirSync(base);
  }
  template += "DataDirectory " + base + "\n";

  var filename = path.join(base, "torrc");
  fs.writeFileSync(filename, template);
  return filename;
};

// Find the dir/.tor/control_auth_cookie file and read its contents.
var readChildAuthCookie = function () {
  var base = path.join(process.cwd(), ".tor");
  var file = path.join(base, "control_auth_cookie");
  if (fs.fileExistsSync(file)) {
    return fs.readFileSync(file);
  }
  return "";
};

/**
 * Given a tor binary path, start it running as a daemon with known
 * torrc so that we know where the control port is.
 */
var startTor = function (binary, success, failure) {
  var torrc = generateTorrc();
  var child = child_process.spawn(binary, ['-f', torrc], {
    env: process.env
  });
  child.on('error', function () {
    console.error(chalk.red("Tor not found. Please install tor for your platform."));
    failure();
  });
  child.once('data', waitForTor.bind(this, 0, success, failure));
};

var waitForTor = function (i, success, failure) {
  if (readChildAuthCookie().length) {
    runningChild = true;
    // TODO: potentially should explicitly 'take-ownership' on first connect.
    connectWithChild(success, failure);
  } else if (i < 50) { // 5 seconds.
    setTimeout(waitForTor.bind(this, i + 1, success, failure), 100);
  }
};

/**
 * Connect to the control socket of a running tor process.
 * callback is called with a pre-authenticated net.socket on success, or null
 * on failure.
 */
exports.connect = function (callback) {
  if (runningChild) {
    return authWithChild(callback);
  }
  // if binary path is explicitly set, use that.
  if (process.env.tor) {
    var tor = process.env.tor;
    startTor(tor, callback, function () {
      console.error(chalk.red("Failed to start the binary defined in the tor environmental variable."));
      callback(null);
    });
  } else if (process.platform === 'darwin' || process.platform === 'win32') {
    require('./download').download(function (tor) {
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
