/* global module, require, process */
'use strict';
var fs = require('fs');
var path = require('path');
var urljoin = require('url-join');
var chalk = require('chalk');
chalk.enabled = true;
var _ = require('lodash');
var _root = process.cwd();
var HttpsProxyAgent = require('https-proxy-agent');
var HttpProxyAgent = require('http-proxy-agent');
var url = require('url');
/**
 * Expose the configProvider
 */
module.exports = ConfigProvider;

/**
 * Get the configuration object. If the configFile not exist, get the default configuration.
 * @alias module:init.getConfig
 * @returns  {object} the configuration object
 */
function ConfigProvider (providedConfig) {
  this.providedConfig = providedConfig;

  this.getProvidedConfigObject = function () {
    if (this.providedConfig && typeof this.providedConfig === 'object') {
      return this.providedConfig;
    } else {
      var configFile = _getConfigFile();
      console.log('Using config from file \'' + configFile + '\'');
      if (fs.existsSync(configFile)) {
        return JSON.parse(fs.readFileSync(configFile, 'utf8'));
      } else {
        throw new Error(configFile + ' not found.');
      }
    }
  };

  this.getConfig = function () {
    return _initConfig(this.getProvidedConfigObject);
  };
}

/**
 * Initialize the configObj
 * @param {object} providedConfig - content of configFileconfigFileData
 * @returns {{nano: Object, path: Object, db: string}}
 */
function _initConfig (providedConfig) {
  var defaultConfig = {
    source: '.',
    target: {
      url: 'https://www.cubbles.world/sandbox',
      path: '_api/upload',
      proxy: ''
    },
    debug: false,
    dryRun: false
  };

  var mergedConfig = _.merge(defaultConfig, providedConfig);
  // remove store-info from mergedConfig.target.url AND use it in nano.db property
  var store = mergedConfig.target.url.replace(/https?:\/\/[^/]+\/?/, '');
  mergedConfig.target.url = mergedConfig.target.url.replace(store, '');
  var tmpUrl = mergedConfig.target.url;
  mergedConfig.target.url = tmpUrl.endsWith('/') ? tmpUrl.substring(0, tmpUrl.length - 1) : tmpUrl;
  // create the config object
  return {
    nano: _initNanoConfig(mergedConfig),
    sourcePath: path.resolve(_root, mergedConfig.source),
    apiPath: urljoin(store, mergedConfig.target.path),
    store: store,
    debug: mergedConfig.debug,
    dryRun: mergedConfig.dryRun
  };
}

/**
 * Get the absolute path to the config file.
 * @returns {string | undefined} path to config file
 */
function _getConfigFile () {
  var configFileArg = (process.argv[ 2 ] && process.argv[ 2 ].indexOf('--') === -1 &&
  process.argv[ 2 ].indexOf('mochaTest') === -1) ? process.argv[ 2 ] : undefined;
  var configPath = configFileArg || process.env.npm_config_configPath || path.join('..', 'config.json');
  return (configPath) ? path.resolve(_root, configPath) : undefined;
}

/**
 * Get the nanoconfig. If not all values contains in ConfigFile, the default values will be initialize.
 * @returns {Object} nanaConfigObj
 * @param {Object} config
 */
function _initNanoConfig (config) {
  var agent;
  if (!config.target.proxy) {
    var httpProxy = process.env.http_proxy || process.env.HTTP_PROXY || null;
    var httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY || null;
    if (config.target.url.indexOf('https:') === 0 && httpsProxy && !isInNoProxyConfig(config.target.url)) {
      agent = new HttpsProxyAgent(httpsProxy);
      console.log('use proxy:', httpsProxy);
    }
    if (config.target.url.indexOf('http:') === 0 && httpProxy && !isInNoProxyConfig(config.target.url)) {
      agent = new HttpProxyAgent(httpProxy);
      console.log('use proxy:', httpProxy);
    }
  }
  if (config.target.proxy && config.target.proxy.length > 0) {
    if (config.target.url.indexOf('https:') === 0) {
      agent = new HttpsProxyAgent(config.target.proxy);
    } else if (config.target.url.indexOf('http:') === 0) {
      agent = new HttpProxyAgent(config.target.proxy);
    }
  }
  var nanoConfig = {};
  nanoConfig.url = config.target.url;
  if (agent) {
    nanoConfig.requestDefaults = agent;
  }
  nanoConfig.log = function (id, args) {
    if (config.debug) {
      console.log(chalk.gray('** Debug (uploader.nano): %s'), JSON.stringify(id, null, '\t'));
    }
  };
  return nanoConfig;
}
function isInNoProxyConfig (proxyUrl) {
  var noProxy = process.env.NO_PROXY || process.env.no_proxy || null;

  // easy case first - if NO_PROXY is '*'
  if (noProxy === '*') {
    return true;
  }

  // otherwise, parse the noProxy value to see if it applies to the URL
  if (noProxy !== null) {
    var uri = url.parse(proxyUrl);
    var parts = uri.hostname.split(':');
    var hostname = parts[ 0 ];
    var noProxyItem;
    var port;
    var noProxyItemParts;
    var noProxyHost;
    var noProxyPort;
    var noProxyList;

    // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
    hostname = hostname.replace(/^\.*/, '.').toLowerCase();
    noProxyList = noProxy.split(',');

    for (var i = 0, len = noProxyList.length; i < len; i++) {
      noProxyItem = noProxyList[ i ].trim().toLowerCase();

      // no_proxy can be granular at the port level, which complicates things a bit.
      if (noProxyItem.indexOf(':') > -1) {
        noProxyItemParts = noProxyItem.split(':', 2);
        noProxyHost = noProxyItemParts[ 0 ].replace(/^\.*/, '.');
        noProxyPort = noProxyItemParts[ 1 ];
        port = uri.port || (uri.protocol === 'https:' ? '443' : '80');

        // we've found a match - ports are same and host ends with no_proxy entry.
        if (port === noProxyPort && hostname.indexOf(noProxyHost) === hostname.length - noProxyHost.length) {
          return true;
        }
      } else {
        noProxyItem = noProxyItem.replace(/^\.*/, '.');
        var isMatchedAt = hostname.indexOf(noProxyItem);
        if (isMatchedAt > -1 && isMatchedAt === hostname.length - noProxyItem.length) {
          return true;
        }
      }
    }
  }
  return false;
}
