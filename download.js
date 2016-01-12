/**
 * Maintain a current directory-local tor.exe based on current version of
 * the tor browser bundle. Used for mac/windows.
 */
var chalk = require('chalk');
var child_process = require('child_process');
var fs = require('fs');
var ncp = require('ncp');
var path = require('path');
var request = require('request');
var resolveurl = require('url').resolve;

var TORURL = "https://www.torproject.org/projects/torbrowser.html.en";

var getDownloadLink = function (callback) {
  request({uri: TORURL}, function (err, resp, body) {
    if (!err && resp.statusCode === 200) {
      var stableStart = body.indexOf("Stable Tor Browser");
      body = body.substr(stableStart);
      var english = body.indexOf("<td>English");
      body = body.substr(english);
      var rowEnd = body.indexOf("</tr>");
      body = body.substr(0, rowEnd);
      var urlMatch = /<a href="([^"]+)">/g;
      var urls = [], url;
      while ((url = urlMatch.exec(body)) !== null) {
        if (url[1][0] == ".") {
          url[1] = resolveurl(path.dirname(TORURL), url[1]);
        }
        urls.push(url[1]);
      }
      for (url = 0; url < urls.length; url += 1) {
        var suffix = urls[url].substr(urls[url].lastIndexOf(".") + 1);
        if (process.platform === 'win32' && suffix == "exe") {
          return callback(urls[url]);
        } else if (process.platform === 'darwin' && suffix == "dmg") {
          return callback(urls[url]);
        } else if (suffix == "xz") {
          return callback(urls[url]);
        }
      }
      callback(false);
    } else {
      callback(false);
    }
  });
};

//TODO: pin expected cert: https://github.com/request/request#tlsssl-protocol
var downloadVerify = function (url, file, callback) {
  var writeStream = fs.createWriteStream(file);
  console.log('Downloading Tor...');
  request(url).on('error', function (err) {
    console.error(chalk.red('Error: '), err);
    callback(false);
  }).on('end', function () {
    console.log(chalk.green('Done.'));
    callback(url);
  }).pipe(writeStream);
};

var winPath = function () {
  return path.join(__dirname, "$_OUTDIR", "Browser", "TorBrowser", "Tor", "tor.exe");
};

var unpackWin = function (callback) {
  // The TBB exe can be unarchived with 7zip.
  var sevenzip = require('7zip')['7z'];
  var extractor = child_process.spawn(sevenzip, ['x', path.join(__dirname, ".tbb.exe")]);
  extractor.on('close', function (code) {
    // Tor now at: $_OUTDIR/Browser/TorBrowser/Tor/tor.exe
    if (code >= 0) {
      callback(winPath());
    } else {
      callback(false);
    }
  });
};

var macPath = function () {
  return path.join(__dirname, ".tbb.app", "TorBrowser", "Tor", "tor");
};

var unpackMac = function (callback) {
  // The TBB dmg can be mounted with hdutil.
  // Rather than attach, copy, remove and keeping track of state we instead
  // "internet-enable" the image, and then 'unpack' it by attaching with the
  // idme option, causing the archive to be replaced by its contents.
  console.log('Unpacking...');
  var extractor = child_process.spawn("hdiutil", ["attach", "-mountpoint", path.join(__dirname, ".tbb"), path.join(__dirname, ".tbb.dmg")]);
  extractor.on('close', function (code) {
    if (code < 0) {
      console.error(chalk.red("Failed to mount image."));
      return callback(false);
    }
    ncp.ncp(
        path.join(__dirname, ".tbb", "TorBrowser.app"),
        path.join(__dirname, ".tbb.app"),
        function (err) {
          if (err) {
            console.error(chalk.red("Unexpected download contents."));
            return callback(false);
          }
          extractor = child_process.spawn("hdiutil", ["detach", path.join(__dirname, ".tbb")]);
          extractor.on('close', function (code) {
            if (code < 0) {
              console.warn(chalk.yellow("Warning: Cleaning up after download failed."));
            }
            console.log(chalk.green("Done."));
            callback(macPath());
          });
        });
  });
};

var downloadVerifyUnpack = function (url, callback) {
  if (process.platform === "win32") {
    downloadVerify(url, path.join(__dirname, ".tbb.exe"), function (res) {
      if (res) {
        saveCurrentVersion(url);
        unpackWin(callback);
      } else {
        callback(false);
      }
    });
  } else if (process.platform === "darwin") {
    downloadVerify(url, path.join(__dirname, ".tbb.dmg"), function (res) {
      if (res) {
        saveCurrentVersion(url);
        unpackMac(callback);
      } else {
        callback(false);
      }
    });
  } else {
    console.error(chalk.red("Browser Bundle only used for Mac / Windows."));
    callback(false);
  }
};

var getCurrentVersion = function () {
  var version = 0;
  var tagFile = path.join(__dirname, '.tbb.url');
  if (fs.existsSync(tagFile)) {
    version = fs.readFileSync(tagFile).toString();
  }
  return version;
};

var saveCurrentVersion = function (url) {
  var tagFile = path.join(__dirname, '.tbb.url');
  fs.writeFileSync(tagFile, url);
};

exports.download = function (callback) {
  getDownloadLink(function (url) {
    if (url && url !== getCurrentVersion()) {
      downloadVerifyUnpack(url, callback);
    } else if (url) { // == current version
      if (process.platform === "win32") {
        callback(winPath());
      } else if (process.platform === "darwin") {
        callback(macPath());
      } else {
        console.warn(chalk.yellow("Not Mac/Windows. Skipping Tor Browser Download."));
        callback(false);
      }
    } else {
      callback(url);
    }
  });
};

if (!module.parent) {
  exports.download(function () {
    process.exit(0);
  });
}
