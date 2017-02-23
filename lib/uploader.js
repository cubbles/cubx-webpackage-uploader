'use strict';
var nanoModul = require('nano');
var path = require('path');
var assert = require('assert');
var walk = require('walk');
var fs = require('fs');
var mime = require('mime');
var urljoin = require('url-join');
var Promise = require('promise');
var chalk = require('chalk');
chalk.enabled = true;
var glob = require('multi-glob').glob;
var WebpackageDocument = require('cubx-webpackage-document-api');
var cubxAuthenticationClient = require('cubx-authentication-client');

var ConfigProvider = require('./../lib/configProvider');

module.exports = Uploader;

function Uploader () {
  this.providedConfigObject;
}

/**
 * Push one webpackage to couchdb.
 * @param {Object} passedConfig  configuration object
 * @param {function} done to be called, if upload finished. It receives two arguments: err, success
 */
Uploader.prototype.uploadSingleWebpackage = function (passedConfig, done) {
  // A passedConfig -object may contain access_credentials.
  var user, password, configProvider;
  if (passedConfig && typeof passedConfig === 'object') {
    user = passedConfig.access_credentials ? passedConfig.access_credentials.user : undefined;
    password = passedConfig.access_credentials ? passedConfig.access_credentials.password : undefined;
  }

  // Now create (-internal) configObject.
  configProvider = new ConfigProvider(passedConfig);
  this.providedConfigObject = configProvider.getConfig();
  // Set the env.http_proxy according to the passed upload configuration.
  if (passedConfig.target.proxy) {
    if (this.providedConfigObject.nano.url.indexOf('http:') === 0) {
      process.env.http_proxy = passedConfig.target.proxy;
    }
    if (this.providedConfigObject.nano.url.indexOf('https:') === 0) {
      process.env.https_proxy = passedConfig.target.proxy;
    }
  }

  // Request an access_token ... and run the upload.
  cubxAuthenticationClient(this.providedConfigObject.nano.url, this.providedConfigObject.store, user, password, function (err, accessToken) {
    if (err) {
      done(err);
    } else {
      this.providedConfigObject.nano.cookie = 'access_token=' + accessToken;
      this._useStore(this.providedConfigObject, function (store) {
        this._insertOrUpdateSingleWebpackage(store, this.providedConfigObject, done);
      }.bind(this), done);
    }
  }.bind(this));
};

/**
 * Use the configured couchdb. If the db not exists, will be created.
 * @param {Object} config config object
 * @param {function} next a callback function
 * @param {function} done to be called, if upload finished.
 * @returns {Object} the database object to be used further on
 */
Uploader.prototype._useStore = function (config, next, done) {
  var nano = nanoModul(config.nano);
  nano.db.get(config.apiPath, function (err, body, header) {
    if (err) {
      var localMessage = 'Upload to ' + urljoin(config.nano.url, config.apiPath) + ' failed.';
      done(new Error(localMessage + ' Error: [' + err.message + ']'));
      return;
    }
    var store = nano.use(config.apiPath);
    next(store);
  });
};

/**
 * Update a webpackage in a base.
 * @param {Object} store  nano db object
 * @param {Object} config config object
 * @param {function} done to be called, if upload finished.
 */
Uploader.prototype._insertOrUpdateSingleWebpackage = function (store, config, done) {
  var uploaderInstance = this;

  function dryRun (webpackageDocumentJson, config, done) {
    uploaderInstance._collectFiles(config.sourcePath, function (filesForUpload, filesIgnored) {
      var dryResponse = {
        id: webpackageDocumentJson._id,
        dryRun: true,
        filesForUpload: [],
        filesIgnored: []
      };
      filesForUpload.forEach(function (absoluteFileName) {
        dryResponse.filesForUpload.push(absoluteFileName.replace(config.sourcePath + path.sep, '').replace(/\\/g, '/'));
      });
      filesIgnored.forEach(function (absoluteFileName) {
        dryResponse.filesIgnored.push(absoluteFileName.replace(config.sourcePath + path.sep, '').replace(/\\/g, '/'));
      });
      done(undefined, dryResponse);
    });
  }

  function upload (db, doc, config, done) {
    db.get(doc._id, { revs_info: false }, function (err, body) {
      if (!err && body._rev) {
        doc._rev = body._rev;
      }
      db.atomic('couchapp-webpackage-validator', 'startUpload', doc._id, doc, function (err, body) {
        if (err) {
          uploaderInstance._debug(err);
          done(err);
        } else {
          db.get(doc._id, { revs_info: false }, function (err, body) {
            if (err) {
              done(err);
              return;
            }
            uploaderInstance._collectFiles(config.sourcePath, function (filesForUpload, ignoredFiles) {
              uploaderInstance._insertEachFileAsAttachment(filesForUpload, config.sourcePath, db, body._id, body._rev, function (err) {
                if (err) {
                  done(err);
                  return;
                }
                var uploaderInfo = require('../package.json');
                db.atomic('couchapp-webpackage-validator', 'finishUpload', body._id,
                  { client: uploaderInfo.name + '-' + uploaderInfo.version }, function (err, response) {
                    if (err) {
                      uploaderInstance._debug(err);
                      done(err);
                    } else {
                      done(undefined, response);
                    }
                  });
              });
            });
          });
        }
      });
    });
  }

  var webpackageDocJsonPromise = this._getWebpackageDocumentJson(config);
  webpackageDocJsonPromise.then(function (webpackageDocumentJson) {
    this._debug('document to upload: ' + JSON.stringify(webpackageDocumentJson));
    return new Promise(
      function (resolve, reject) {
        var uploadCallback = function (err, success) {
          if (err) {
            // console.log('#######', err)
            reject(err);
          } else {
            resolve(success);
          }
        };
        if (uploaderInstance.providedConfigObject.dryRun) {
          dryRun(webpackageDocumentJson, config, uploadCallback);
        } else {
          upload(store, webpackageDocumentJson, config, uploadCallback);
        }
      }
    );
  }.bind(this)).nodeify(done); // in case appDocPromise rejects
};

/**
 * Returns the document for the webpackage intended to upload.
 * @param {Object} config config object
 * @returns {Promise}
 */
Uploader.prototype._getWebpackageDocumentJson = function (config) {
  var readFile = Promise.denodeify(require('fs').readFile);
  var manifestFile = path.join(config.sourcePath, 'manifest.webpackage');

  var addDocumentId = function (manifest) {
    var onSuccess = function (documentId) {
      manifest._id = documentId;
    };
    var onUnsupportedModelVersionError = function (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(JSON.stringify(error));
      }
    };
    var onValidationError = function (errors) {
      var errorString = '';
      errors.forEach(function (error) {
        if (errorString.length > 0) {
          errorString += ' | ';
        }
        errorString += (error.dataPath) ? error.dataPath + ': ' + error.message : error.message;
      });
      throw new Error('Validation failed. [' + errorString + ']');
    };
    var webpackageDoc = new WebpackageDocument(manifest);
    webpackageDoc.generateId(onSuccess, onUnsupportedModelVersionError, onValidationError);
    return webpackageDoc.document;
  };
  return readFile(manifestFile, 'utf8').then(JSON.parse).then(addDocumentId);
};

/**
 * collect all files in directory and add them to a files array.
 * @param {string} webpackageRoot folder
 * @param {function} processCollectedFiles a callback function to process the files collected
 */
Uploader.prototype._collectFiles = function (webpackageRoot, processCollectedFiles) {
  // find '.cubblesignore' and extract ignore patterns
  var globsArray = [];
  var ignoreFile = path.join(webpackageRoot, '.cubblesignore');
  if (fs.existsSync(ignoreFile) && fs.statSync(ignoreFile).isFile()) {
    var ignoreContent = fs.readFileSync(ignoreFile).toString();
    var linesArray = ignoreContent.split(/\r?\n/);
    globsArray = linesArray.filter(function (item) {
      if (item.trim().length < 1 || item.trim().startsWith('#')) {
        return false;
      }
      return true;
    });
  }
  // find matching files in the given folder (== files to be ignored from upload)

  glob(globsArray, { cwd: webpackageRoot, root: webpackageRoot }, function (err, arrayOfFilesToBeIgnored) {
    if (err) {
      console.log(err);
      return [];
    }
    var ignoreConfiguration = arrayOfFilesToBeIgnored;
    var filesToBeUploaded = [];
    var filesToBeIgnored = [];



    walk.walkSync(webpackageRoot, {
      listeners: {
        names: function (root, nodeNamesArray) {
          nodeNamesArray.sort(function (a, b) {
            if (a > b) {
              return -1;
            }
            return 1;
          });
        },
        directories: function (root, dirStatsArray, next) {
          // dirStatsArray is an array of `stat` objects with the additional attributes
          // * type
          // * error
          // * name
          next();
        },
        file: function (root, fileStats, next) {
          if (fileStats.error) {
            console.error('Error by collect attachments.');
            console.log(fileStats.error + ': ' + fileStats.name + ' (' + fileStats.type + ')');
          }
          var absoluteFileName = path.join(root, fileStats.name);
          var relativePosixFilename = absoluteFileName.replace(webpackageRoot + path.sep, '').replace(/\\/g, '/');
          var relativePosixDirName = path.dirname(relativePosixFilename);
          if (ignoreConfiguration.indexOf(relativePosixFilename) === -1 && ignoreConfiguration.indexOf(relativePosixDirName) === -1) {
            filesToBeUploaded.push(absoluteFileName);
          } else {
            filesToBeIgnored.push(absoluteFileName);
          }
          next();
        },
        errors: function (root, nodeStatsArray, next, arg) {
          for (var stat in nodeStatsArray) {
            console.error('Error by collect attachments.');
            console.error(nodeStatsArray[ stat ].error + ': ' + nodeStatsArray[ stat ].name + ' (' +
              nodeStatsArray[ stat ].type + ')');
          }
          next();
        }
      }
    });
    processCollectedFiles(filesToBeUploaded, filesToBeIgnored);
  });
};

/**
 * Insert files as attachnment to couchdocment.
 * @param {Array} files array of paths to files
 * @param {string} root root path
 * @param {object} db nano db object
 * @param {string} docID document id
 * @param {string} rev revision number of the document
 * @param {function} done callback to be executed if all files have been attached
 */
Uploader.prototype._insertEachFileAsAttachment = function (files, root, db, docID, rev, done) {
  assert(typeof files, 'object');
  assert(Array.isArray(files));
  var uploaderInstance = this;
  var file = files.shift();
  if (file) {
    var item = path.relative(root, file);
    var fname = item.replace(path.sep, '/');
    var mimeType = mime.lookup(fname);
    this._debug('Going to upload file: ' + fname);
    fs.createReadStream(file).pipe(db.attachment.insert(docID, fname, null, mimeType, {
      rev: rev
    }, function (err, body) {
      if (!err) {
        uploaderInstance._debug(body);
        uploaderInstance._insertEachFileAsAttachment(files, root, db, docID, body.rev, done);
      } else {
        console.log('### db');
        uploaderInstance._debug(err);
        done(new Error('Uploading file \'' + fname + '\' failed. [' + err.message + ']'));
      }
    }));
  } else {
    done();
  }
};

/**
 * Logged messages if _config.debug
 * @param {object} payload object to log
 * @private
 */
Uploader.prototype._debug = function (payload) {
  if (this.providedConfigObject && this.providedConfigObject.debug && this.providedConfigObject.debug === true) {
    // @see https://nodejs.org/docs/latest/api/util.html#util_util_format_format
    if (typeof payload === 'number') {
      console.log(chalk.blue('** Debug (uploader): %d'), payload);
    } else if (typeof payload === 'object') {
      console.log(chalk.blue('** Debug (uploader): %j'), payload);
    } else {
      console.log(chalk.blue('** Debug (uploader): %s'), payload);
    }
  }
};
