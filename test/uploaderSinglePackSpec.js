/* global require,describe,beforeEach,it */
'use strict';
var assert = require('assert');
var _ = require('lodash');
var testdata = require('./testdata/userdata.js');
var uploader;

describe('uploader', function () {
  var defaults;
  beforeEach(function () {
    var Uploader = require('../lib/uploader');
    uploader = new Uploader();
  });
  describe('without proxy', function () {
    beforeEach(function () {
      defaults = {
        'access_credentials': {
          'user': testdata.users.user1.logins.local.login,
          'password': testdata.users.user1.password
        },
        'source': 'test/testdata/packages/uploader-test-package1',
        'target': {
          'url': 'http://cubbles-base-local/base-api-upload-test',
          'path': '_api/upload',
          'proxy': ''
        },
        'debug': true
      };
    });

    it('should be defined', function () {
      // console.log(JSON.stringify(webpackageDocument));
      assert(uploader !== undefined, 'is defined');
    });

    it('should upload \'uploader-test-package1@0.1.0-SNAPSHOT\'', function (done) {
      var options = _.merge(defaults, { 'debug': false });

      function callback (err, success) {
        console.log('success', success);
        assert(err === null, 'err = ' + err);
        done();
      }

      uploader.uploadSingleWebpackage(options, function (err, successObject) {
        if (err) {
          console.log('err: ', err);
          done(err);
        } else {
          assert(successObject.ok === true, 'returns \'ok\'.');
          assert(successObject.id === 'uploader-test-package1@0.1.0-SNAPSHOT', 'returned ' + successObject.id);

          console.log('doc.baseContext: ', JSON.stringify(successObject.baseContext, null, '\t'));
          assert(successObject.baseContext.uploadInfos.client !== undefined, 'Is client defined?');
          assert(successObject.baseContext.uploadInfos.user !== undefined, 'Expected user to be defined.');
          assert(successObject.baseContext.uploadInfos.date !== undefined, 'Expected date to be defined.');

          // upload it the second time, now we are sure the package already exists
          uploader.uploadSingleWebpackage(options, callback);
        }
      });
    });

    it('should upload \'uploader-test-package1@1.0.0\'', function (done) {
      var localOptions = {
        'source': 'test/testdata/packages/uploader-test-package2',
        'debug': true
      };
      var options = _.merge(defaults, localOptions);

      function callback (err, success) {
        // console.log('success: ' + success)
        assert(err !== undefined, 'err = ' + undefined);
        assert(err.message === 'Final Webpackages are NOT allowed to be overwritten.',
          'err.message = ' + err.message);
        done();
      }

      // upload it the first time, in case the testcase runs the first time againt this database
      uploader.uploadSingleWebpackage(options, function (err, success) {
        if (err) {
          return done(err);
        }
        // upload it the second time, now we are sure the package already exists
        uploader.uploadSingleWebpackage(options, callback);
      });
    });

    it('should respond with error as the source does not exist', function (done) {
      var localOptions = {
        'source': 'test/testdata/packages/uploader-test-package2-unknown',
        'debug': true
      };
      var options = _.merge(defaults, localOptions);

      var callback = function (err, success) {
        assert(err !== undefined);
        assert(err.message.indexOf('ENOENT') > -1);
        done();
      };
      uploader.uploadSingleWebpackage(options, callback);
    });

    it('should respond with error because of invalid manifestFile', function (done) {
      var localOptions = {
        'source': 'test/testdata/packages/uploader-test-package3-invalidManifestFile',
        'debug': true
      };
      var options = _.merge(defaults, localOptions);

      var callback = function (err, success) {
        // console.log(err.message)
        assert(err !== undefined);
        assert(err.message.indexOf('Validation failed.') > -1);
        done();
      };
      uploader.uploadSingleWebpackage(options, callback);
    });

    it('should respond with error because of unsupported modelVersion', function (done) {
      var localOptions = {
        'source': 'test/testdata/packages/uploader-test-package4-unsupportedModelVersion',
        'debug': true
      };
      var options = _.merge(defaults, localOptions);

      var callback = function (err, success) {
        // console.log(err.message)
        assert(err !== undefined);
        assert(err.message.indexOf('is unknown or not supported') > -1);
        done();
      };
      uploader.uploadSingleWebpackage(options, callback);
    });

    it('should respond with error because of not exisiting manifestFile', function (done) {
      var localOptions = {
        'source': 'test/testdata/packages/uploader-test-package5-noManifestFile',
        'debug': true
      };
      var options = _.merge(defaults, localOptions);

      var callback = function (err, success) {
        assert(err !== undefined);
        assert(err.message.indexOf('ENOENT') > -1);
        done();
      };
      uploader.uploadSingleWebpackage(options, callback);
    });
  });
});
