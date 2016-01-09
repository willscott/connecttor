/**
 * Attempt cookie authentication against a tor control socket.
 * The spec for tor control protocol is at:
 * https://gitweb.torproject.org/torspec.git/tree/control-spec.txt
 */
exports.attemptAuthentication = function (socket, cookie, success, failure) {
  socket.write("AUTHENTICATE " + cookie.toString("hex") + "\r\n");
  var onData = function (buf) {
    socket.removeListener('close', onEvent);
    socket.removeListener('error', onEvent);

    if (buf.toString().indexOf('250') === 0) {
      success(socket);
    } else {
      failure(buf.toString());
    }
  };
  var onEvent = function (ev) {
    socket.removeListener('close', onEvent);
    socket.removeListener('error', onEvent);

    failure(ev);
  };
  socket.once('data', onData);
  socket.once('close', onEvent);
  socket.once('error', onEvent);
};
