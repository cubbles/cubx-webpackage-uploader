#!/usr/bin/env node
/* eslint-env node */
'use strict';
var argv = require('yargs')
  .usage('Usage: [uploadConfigFile]')
  .demand(1)
  .locale('en')
  .argv;

var Uploader = require('./../lib/uploader');
(new Uploader()).uploadSingleWebpackage(argv[1], function (err, success) {
  if (err) {
    console.error(err);
  } else {
    console.log(success);
  }
});
