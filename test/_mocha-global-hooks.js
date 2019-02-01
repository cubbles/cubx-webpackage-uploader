/**
 * Created by hrbu on 24.11.2015.
 * This file implements the global mocha root-level hooks 'before' and 'after'.
 * @see https://mochajs.org/#hooks >> Root-Level Hooks
 *
 * The test suite expects to have a boot2docker-instance running.
 */

/* globals before, after */
'use strict';
const vm = require('vm');
// const EventEmitter = require('events');
var opts = {
  // couchUrl: 'http://admin:admin@cubbles-base-local:5984',
  couchUrl: 'http://admin:admin@localhost:3000',
  // couchUrl: 'http://localhost:3000',
  dbNamePrefix: 'webpackage-store',
  storeName: 'base-api-upload-test',
  finallyRemoveTestData: process.env.REMOVE_TESTDATA ? JSON.parse(process.env.REMOVE_TESTDATA) : true
};
// var request = require('superagent');
var testdata = require('./testdata/userdata.js');
const dbName = opts.dbNamePrefix + '-' + opts.storeName;
const Slouch = require('couch-slouch');
const bootstrap = require('couchdb-bootstrap');
const path = require('path');

let slouch;
let contextVars;
before(async () => {
  console.log('before ....');
  contextVars = {
    require: require,
    setInterval: setInterval,
    clearInterval: clearInterval,
    state: 'idle',
    console: console
  };
  let context = vm.createContext(contextVars);

  let code = pouchServerCode();
  // let code = `console.log('############ Test ############')`;
  vm.runInContext(code, context);
  let listen = new Promise((resolve, reject) => {
    let maxTimeout = 5000;
    let currentTimeout = 0;
    let interval = setInterval(() => {
      if (contextVars.state === 'listen') {
        require('request')('http://localhost:3000/' + dbName, (err, res, body) => {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            console.log('PouchServer gestartet!');
            clearInterval(interval);
            resolve();
          }
        });
      } else if (currentTimeout >= maxTimeout) {
        console.log('Timout,  Server nicht gestartet');
        clearInterval(interval);
        reject(new Error('Server start timout'));
      }
    }, 50);
  });

  return listen.then(async () => {
    try {
      slouch = new Slouch(opts.couchUrl);
      await initDb();
      console.log('test environment created...');
    } catch (err) {
      Promise.reject(err);
    }
    return Promise.resolve();
  });
});

after(async () => {
  // remove testuser and test-database
  console.log('after ....');
  contextVars.state = 'stop';
});

async function initDb () {
  await uploadDesignDocs();
  await addTestWebpackageDocument(dbName);

  await addDocument('_users', testdata.users.user1);
  await addDocument('groups', testdata.groups.group1);
  await addDocument('acls', testdata.acls.aclStore1);
}
async function uploadDesignDocs () {
  let url = opts.couchUrl;
  let src = path.join(process.cwd(), 'test', 'bootstrap');
  bootstrap(url, src, (error, response) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Bootstrap ready', response);
    }
  });
}

async function addTestWebpackageDocument (databaseName) {
  var doc = { _id: 'pack@1.0.0', foo: 'bar' };
  console.log('Creating Webpackage: %s\n', doc._id);
  try {
    await slouch.doc.create(databaseName, doc);
  } catch (err) {
    console.log('document insert failed', err);
    throw err;
  }
}

async function addDocument (databaseName, document) {
  return slouch.doc.create(databaseName, document);
}

function pouchServerCode () {
  return `
  const express = require('express');
  const PouchDB = require('pouchdb');
  const fs = require('fs-extra');
  const path = require('path');
  let app = express();
  const InMemPouchDB = PouchDB.defaults({ db: require('memdown') });
  let databaseDir = path.resolve('.', '.db');
  let options = {
    configPath: path.resolve(databaseDir, 'config.json'),
    logPath: path.resolve(databaseDir, 'log', 'log.txt')
  };
  let expressPouchDB = require('express-pouchdb')(InMemPouchDB, options);
  app.use('/', expressPouchDB);
  let testStore = new InMemPouchDB('webpackage-store-base-api-upload-test');
  let groups = new InMemPouchDB('groups');
  let acls = new InMemPouchDB('acls');
 
  let stopTimeout = setInterval(() => {
    if (state === 'stop'){
      console.log('"stop" recived => close pouchdb-server'); 
      clearInterval(stopTimeout);
      server.close();
      state = 'idle';
    }
  },50);
  
  new Promise((resolve, reject) => {
    expressPouchDB.couchConfig.set(
      'admins',
      'admin',
      'admin',
      err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
  }).then(() => {
    let myPouch = new InMemPouchDB('webpackage-store-base-api-upload-test');
    server = app.listen(3000, function() {
      // console.log('PouchServer gestartet!');
      state = 'listen';
    });
  }).catch((err) => {
    console.error('PouchServer konnte nicht gestartet werden.', err);
    state = 'error';
  });
  `;
}
