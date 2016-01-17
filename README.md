Connect-tor
===========

Connect to a local tor binary on the system. Do path discovery and provide
a common interface to remove platform-specific clumsiness when dealing with the
external process.

Usage
------

```javascript
var connecttor = require('connecttor');
connecttor.connect(function (socket) {
  // returns a net.socket connected to Tor's control port.
});
```

Design
------------
Connecttor uses a platform-dependent mechanism to connect with tor. Sorry.

By default, and as part of an `npm install`, Connecttor will download a platform
dependent copy of the Tor Browser Bundle, and will use the tor packaged in that
distribution as a daemon to connect with.

If you wish to use connecttor with an external instance of tor, you can either
do this by passing a `tor` option or setting the `tor` environmental variable
to point to where the tor binary is on your system.

Example:
```javascript
require('connecttor').connect({tor: "/usr/bin/tor"}, function (socket) {...});
```

If you wish to have connecttor interact with the control port of an already
running tor distribution, you can specify the `useSystem` option.

Example:
```javascript
require('connecttor').connect({useSystem: true}, function (socket) {...});
```

Several Caveats apply to working with a system-tor installation to get the
additional security properties it provides. They are documented below.

System Tor Configuration
------------------------

This is tested on a current version of ubuntu, using the tor project's debian
repository. Note that the system repositories as of 2016 use a 0.2.6 version of
Tor, which can't easily do things like create hidden services from the control
port. For configuration, you will need to add the
[tor repository](https://www.torproject.org/docs/debian.html.en), and
update tor. In addition, the user running node will need to be
in the `debian-tor` unix group in order to connect to the control socket.
