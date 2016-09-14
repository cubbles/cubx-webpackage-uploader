/* globals require, process, describe, beforeEach, it*/
'use strict';
var path = require('path');
var assert = require('assert');

describe('configProvider', function () {
  var init;
  describe('#getConfig()', function () {
    var root;

    beforeEach(function () {
      root = path.join(process.cwd(), 'test', 'testdata', 'configProviderSpec');
      process.env.npm_config_configPath = path.join(root, 'config1.json');
      var ConfigProvider = require('../lib/configProvider');
      init = new ConfigProvider();
    });

    it('should be an object', function () {
      assert(typeof init.getConfig() === 'object', 'not an object');
    });

    it('should be the specified format', function () {
      assert(typeof init.getConfig() === 'object', 'config is not an object');
      assert(init.getConfig().apiPath.indexOf('/_api/upload') > 0, 'unexpected value of config.db: ' + init.getConfig().db);
      assert(typeof init.getConfig().nano === 'object', 'config.nano is not an object');
      assert(typeof init.getConfig().nano.log === 'function', 'config.nano is not an object');
      assert(typeof init.getConfig().nano.requestDefaults === 'object', 'config.nano.log is not a function');
      assert.equal(init.getConfig().nano.requestDefaults.proxy.href, 'http:/proxy.de:80',
        'unexpected value of config.nano.requestDefaults.proxy');
      assert(typeof init.getConfig().sourcePath === 'string', 'config.path is not a string');
      assert(init.getConfig().sourcePath.indexOf('data\\packages\\package1') > -1,
        'unexpected value of config.sourcePath');
      assert(init.getConfig().debug === true);
    });
  });

  describe('#getConfig2()', function () {
    var root;

    beforeEach(function () {
      root = path.join(process.cwd(), 'test', 'testdata', 'configProviderSpec');
      process.env.npm_config_configPath = path.join(root, 'config2.json');
      var ConfigProvider = require('../lib/configProvider');
      init = new ConfigProvider();
    });

    it('should be the specified format', function () {
      assert.equal(init.getConfig().apiPath, 'sandbox/_api/upload', 'unexpected value of config.db: ' + init.getConfig().db);
      assert(typeof init.getConfig().nano === 'object', 'config.nano is not an object');
      assert.equal(init.getConfig().nano.url, 'http://localhost:5984',
        'unexpected value of nano.url: ' + init.getConfig().nano.url);
      assert(typeof init.getConfig().sourcePath === 'string', 'config.path is not a string');
    });
  });
});
