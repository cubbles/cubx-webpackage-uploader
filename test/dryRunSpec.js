/*global require,describe,beforeEach,it*/
'use strict';
var assert = require('assert');
var _ = require('lodash');
var testdata = require('./testdata/userdata.js');
var uploader;

describe('dryRunSpec', function () {
  var defaults;
  beforeEach(function () {
    var Uploader = require('../lib/uploader');
    uploader = new Uploader();
    defaults = {
      'access_credentials': {
        'user': testdata.users.user1.logins.local.login,
        'password': testdata.users.user1.password
      },
      'source': 'test/testdata/dryRunSpec/uploader-test-ignore1',
      'target': {
        'url': 'http://cubbles-base-local/base-api-upload-test',
        'path': '_api/upload',
        'proxy': ''
      },
      'debug': false
    };
  });

  it('should fail due to invalid credentials', function (done) {
    var options = _.merge(defaults, {
      'access_credentials': {
        'user': 'unknown',
        'password': 'invalid'
      },
      dryRun: true
    });

    uploader.uploadSingleWebpackage(options, function (err, successObject) {
      console.log('err: ', err);
      assert.equal(err.response.res.statusCode, 403);
      assert.equal(err.response.res.text, '{"error":"USER_NOT_FOUND"}');
      done();
    });
  });

  it('should fail due to invalid store', function (done) {
    var options = _.merge(defaults, {
      'target': {
        'url': 'http://cubbles-base-local/invalid'
      },
      dryRun: true
    });

    uploader.uploadSingleWebpackage(options, function (err, successObject) {
      // console.log('err: ', err);
      assert(JSON.stringify(err).indexOf('Error: [401 | reason: No upload permissions for the requested store') > -1);
      done();
    });
  });
});
