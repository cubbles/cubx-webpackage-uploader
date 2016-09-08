/* eslint-env node */
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
var WebpackageDocument = require('cubx-webpackage-document-api');
var cubxAuthenticationClient = require('cubx-authentication-client');

var nano;
var ConfigProvider = require('./../lib/configProvider');
var _providedConfigObject;

module.exports = Uploader;

function Uploader () {

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
  _providedConfigObject = configProvider.getConfig();
  // Request an access_token ... and run the upload.
  cubxAuthenticationClient(_providedConfigObject.nano.url, _providedConfigObject.store, user, password, function (err, access_token) {
    if (err) {
      done(err);
    } else {
      _providedConfigObject.nano.cookie = 'access_token=' + access_token;
      _useDB(_providedConfigObject, function (db, _config, done) {
        _insertOrUpdateSingleWebPackage(db, _config, done);
      }, done);
    }
  });
};

/**
 * Use the configured couchdb. If the db not exists, will be created.
 * @param {Object} config config object
 * @param {function} next process function using the couchdb.
 * @param {function} done to be called, if upload finished.
 */
function _useDB (config, next, done) {
  _getNano(config).db.get(config.apiPath, function (err, body, header) {
    if (err) {
      var localMessage = 'Upload to ' + urljoin(config.nano.url, config.apiPath) + ' failed.';
      done(new Error(localMessage + ' Error: [' + err.message + ']'));
      return;
    }
    var db = _getNano(config).use(config.apiPath);
    next(db, config, done);
  });
}

/**
 * Get the nano object.
 * @param {Object} config config object
 * @returns {Object} the nano object
 */
function _getNano (config) {
  if (!nano) {
    nano = nanoModul(config.nano);
  }
  return nano;
}

/**
 * Update a webpackage into a cubixx-base.
 * @param {Object} db  nano db object
 * @param {Object} config config object
 * @param {function} done to be called, if upload finished.
 */
function _insertOrUpdateSingleWebPackage (db, config, done) {
  var webpackageDocJsonPromise = _getWebpackageDocumentJson(config);
  webpackageDocJsonPromise.then(function (webpackageDocumentJson) {
    _debug('document to upload: ' + JSON.stringify(webpackageDocumentJson));
    return new Promise(
      function (resolve, reject) {
        var callback2Promise = function (err, success) {
          if (err) {
            // console.log('#######', err)
            reject(err);
          } else {
            resolve(success);
          }
        };
        _insertWebPackage(db, webpackageDocumentJson, config, callback2Promise);
      }
    );
  }).nodeify(done); // in case appDocPromise rejects
}

/**
 * Insert a webpackage into a cubixx-base.
 * @param {Object} db  nano db object
 * @param {Object} doc webpackageDocument
 * @param {Object} config config object
 * @param {function} done to be called, if upload finished.
 */
function _insertWebPackage (db, doc, config, done) {
  db.get(doc._id, { revs_info: false }, function (err, body) {
    if (!err && body._rev) {
      doc._rev = body._rev;
    }
    db.atomic('couchapp-webpackage-validator', 'startUpload', doc._id, doc, function (err, body) {
      if (err) {
        _debug(err);
        done(err);
      } else {
        db.get(doc._id, { revs_info: false }, function (err, body) {
          if (err) {
            done(err);
            return;
          }
          _insertAttachments(db, body._id, body._rev, config.sourcePath, function (err) {
            if (err) {
              done(err);
              return;
            }
            var uploaderInfo = require('../package.json');
            db.atomic('couchapp-webpackage-validator', 'finishUpload', body._id,
              { client: uploaderInfo.name + '-' + uploaderInfo.version }, function (err, response) {
                if (err) {
                  _debug(err);
                  done(err);
                } else {
                  done(undefined, JSON.stringify(response));
                }
              });
          });
        });
      }
    });
  });
}

/**
 * Returns the document for the webpackage intended to upload.
 * @param {Object} config config object
 * @returns {Promise}
 */
function _getWebpackageDocumentJson (config) {
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
}

/**
 * Insert the package1 subfolders as attachments
 * @param {Object} db nano couchdb object for
 * @param {string} docID document id  in couch
 * @param {string} rev revisionnumber of the document
 * @param {string} root
 * @param {function} done callback to be executed if all files have been attached
 */
function _insertAttachments (db, docID, rev, root, done) {
  var files = [];
  _collectFiles(files, root);
  _insertEachFileAsAttachment(files, root, db, docID, rev, done);
}

/**
 * collect all files in directory and add to  a files array.
 * @param {Array} files  array of paths
 * @param {string} folder folder
 * @returns {Array} completed array of paths
 */
function _collectFiles (files, folder) {
  var options = {
    listeners: {
      names: function (root, nodeNamesArray) {
        nodeNamesArray.sort(function (a, b) {
          if (a > b) {
            return 1;
          }
          if (a < b) {
            return -1;
          }
          return 0;
        });
      }, directories: function (root, dirStatsArray, next) {
        // dirStatsArray is an array of `stat` objects with the additional attributes
        // * type
        // * error
        // * name
        next();
      }, file: function (root, fileStats, next) {
        if (fileStats.error) {
          console.error('Error by collect attachments.');
          console.log(fileStats.error + ': ' + fileStats.name + ' (' + fileStats.type + ')');
        }
        files.push(path.join(root, fileStats.name));
        next();
      }, errors: function (root, nodeStatsArray, next, arg) {
        for (var stat in nodeStatsArray) {
          console.error('Error by collect attachments.');
          console.error(nodeStatsArray[ stat ].error + ': ' + nodeStatsArray[ stat ].name + ' (' +
            nodeStatsArray[ stat ].type + ')');
        }
        next();
      }
    }
  };
  walk.walkSync(folder, options);
  return files;
}

/**
 * Insert files as attachnment to couchdocment.
 * @param {Array} files array of paths to files
 * @param {string} root root path
 * @param {object} db nano db object
 * @param {string} docID document id
 * @param {string} rev revision number of the document
 * @param {function} done callback to be executed if all files have been attached
 */
function _insertEachFileAsAttachment (files, root, db, docID, rev, done) {
  assert(typeof files, 'object');
  assert(Array.isArray(files));
  var file = files.shift();
  if (file) {
    var item = path.relative(root, file);
    var fname = item.replace(path.sep, '/');
    var mimeType = mime.lookup(fname);
    _debug('Going to upload file: ' + fname);
    fs.createReadStream(file).pipe(db.attachment.insert(docID, fname, null, mimeType, {
      rev: rev
    }, function (err, body) {
      if (!err) {
        _debug(body);
        _insertEachFileAsAttachment(files, root, db, docID, body.rev, done);
      } else {
        console.log('### db');
        _debug(err);
        done(new Error('Uploading file \'' + fname + '\' failed. [' + err.message + ']'));
      }
    }));
  } else {
    done();
  }
}

/**
 * Logged messages if _config.debug
 * @param {object} payload object to log
 * @private
 */
function _debug (payload) {
  if (_providedConfigObject && _providedConfigObject.debug && _providedConfigObject.debug === true) {
    // @see https://nodejs.org/docs/latest/api/util.html#util_util_format_format
    if (typeof payload === 'number') {
      console.log(chalk.blue('** Debug (uploader): %d'), payload);
    } else if (typeof payload === 'object') {
      console.log(chalk.blue('** Debug (uploader): %j'), payload);
    } else {
      console.log(chalk.blue('** Debug (uploader): %s'), payload);
    }
  }
}
