/**
 * Attempt cookie authentication against a tor control socket.
 * The spec for tor control protocol is at:
 * https://gitweb.torproject.org/torspec.git/tree/control-spec.txt
 */
exports.attemptAuthentication = function (socket, cookie, success, failure) {
  socket.write("AUTHENTICATE " + cookie.toString("hex") + "\r\n");
  var onEvent = function (buf) {
    socket.removeListener('data', onEvent);
    socket.removeListener('close', onEvent);
    socket.removeListener('error', onEvent);

    if (buf.toString().indexOf('250') > 0) {
      success();
    } else {
      failure();
    }

  };
  socket.once('data', onEvent);
  socket.once('close', onEvent);
  socket.once('error', onEvent);
};
