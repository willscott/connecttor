Connect-tor
===========

Connect to a local tor binary on the system. Do path discovery and provide
a common interface to remove platform-specific clumsiness when dealing with the
external process.

Usage
------

```javascript
var connecttor = require('connecttor');
connecttor.getControlSocket(function (socket) {
  // returns a net.socket connected to Tor's control port.
});
```

Design
------------
Connecttor uses a platform-dependent mechanism to connect with tor. Sorry.

On known linux distributions (currently debian variants), connecttor expects to
use the system-bundled tor distribution. These implementations compartmentalize
security, by running the tor process as a different user, so that even if the
node process is compromised, it will not be able to read the private keys to
subsequently impersonate onion addresses. Several Caveats apply. The first is
that `apt-get install tor` does not set up an installation which can be
controlled by other users. In addition, the user running node will need to be
in the `debian-tor` unix group in order to connect to the tor control socket.

On Mac and Windows distributions where tor does not attempt to user-isolate its
keys, connecttor will attempt to find an installation of tor browser bundle or
tor binary in standard locations, and will download a local copy if one is not
found. It will then run its own instance of tor with a custom torrc
configuration.

Debian installation
-------------------

1. Make sure tor is installed:
```bash
apt-get install tor
```

2. Add the user running node to the `debian-tor` group:
```bash
usermod -a -G debian-tor `whoami`
```
