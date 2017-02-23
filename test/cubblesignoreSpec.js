/* global require,describe,beforeEach,it */
'use strict';
var assert = require('assert');
var _ = require('lodash');
var testdata = require('./testdata/userdata.js');
var uploader;

describe('ignoreSpec', function () {
  var defaults;
  beforeEach(function () {
    var Uploader = require('../lib/uploader');
    uploader = new Uploader();
    defaults = {
      'access_credentials': {
        'user': testdata.users.user1.logins.local.login,
        'password': testdata.users.user1.password
      },
      'source': 'test/testdata/ignoreSpec/uploader-test-ignore1',
      'target': {
        'url': 'http://cubbles-base-local/base-api-upload-test',
        'path': '_api/upload',
        'proxy': ''
      },
      'debug': false
    };
  });

  it('should upload \'uploader-test-ignore1@0.1.0-SNAPSHOT\'', function (done) {
    var options = _.merge(defaults, {});

    uploader.uploadSingleWebpackage(options, function (err, successObject) {
      if (err) {
        console.log('err: ', err);
        done(err);
        return;
      } else {
        // console.log(successObject);
        assert(successObject.ok === true, 'returns \'ok\'.');
      }
      done();
    });
  });

  it('should dryRun \'uploader-test-ignore1@0.1.0-SNAPSHOT\'', function (done) {
    var options = _.merge(defaults, { dryRun: true });

    uploader.uploadSingleWebpackage(options, function (err, successObject) {
      if (err) {
        console.log('err: ', err);
        done(err);
        return;
      } else {
        console.log(successObject);
        assert.equal(successObject.dryRun, true);
        assert.equal(successObject.filesForUpload.length, 7);
        assert.equal(successObject.filesIgnored.length, 7);
      }
      done();
    });
  });
});
