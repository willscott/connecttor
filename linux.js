/**
 * A set of functions for interacting with system supplied tor installations
 * on linux.
 */
var fs = require('fs');
var net = require('net');

var util = require('./util');

exports.openUnixSocket = function (success, failure) {
  var cookie;
  try {
    cookie = fs.readFileSync("/var/run/tor/control.authcookie");
  } catch (e) {
    failure(e);
    return;
  }
  var client = net.connect({path: "/var/run/tor/control"}, function () {
    client.removeListener('error', failure);
    util.attemptAuthentication(client, cookie, success, failure);
  });
  // Catch socket-open errors.
  client.on('error', failure);
};
