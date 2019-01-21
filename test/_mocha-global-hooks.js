/**
 * Created by hrbu on 24.11.2015.
 * This file implements the global mocha root-level hooks 'before' and 'after'.
 * @see https://mochajs.org/#hooks >> Root-Level Hooks
 *
 * The test suite expects to have a boot2docker-instance running.
 */

/* globals before, after */
'use strict';
var opts = {
  couchUrl: 'http://admin:admin@cubbles-base-local:5984',
  dbNamePrefix: 'webpackage-store',
  storeName: 'base-api-upload-test',
  finallyRemoveTestData: process.env.REMOVE_TESTDATA ? JSON.parse(process.env.REMOVE_TESTDATA) : true
};
var request = require('superagent');
var testdata = require('./testdata/userdata.js');
const dbName = opts.dbNamePrefix + '-' + opts.storeName;
const Slouch = require('couch-slouch');
var slouch;

before(async () => {
  // function: create a test user
  console.log('before ....');
  slouch = new Slouch(opts.couchUrl);
  await initDb();
  console.log('test environment created...');
});

async function initDb () {
  await removeDb(dbName);
  await addDb(dbName);
  await replicateFromCore(dbName);
  await addTestWebpackageDocument(dbName);

  await addDocument('_users', testdata.users.user1);
  await addDocument('groups', testdata.groups.group1);
  await addDocument('acls', testdata.acls.aclStore1);
}

async function destroyDb() {
  await removeDocument('_users', testdata.users.user1._id);
  await removeDocument('groups', testdata.groups.group1._id);
  await removeDocument('acls', testdata.acls.aclStore1._id);
  await removeDb(dbName);
}
after(async () => {
  // remove testuser and test-database
  console.log('after ....');
  if (opts.finallyRemoveTestData) {
    await destroyDb();
    console.log('test environment deleted...');
  }
});

async function removeDb (databaseName) {
  if (await slouch.db.exists(databaseName)) {
    return slouch.db.destroy(databaseName);
  }
}

async function addDb (databaseName) {
  if (!await slouch.db.exists(databaseName)) {
    await slouch.db.create(databaseName);
  } else {
    console.log('Can not add db "' + databaseName + '": Database already exists.');
  }
}

async function replicateFromCore (databaseName) {
  try {
    await request.post(opts.couchUrl + '/_replicate')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send('{"source":"webpackage-store-core","target":"' + dbName + '", "doc_ids":["_design/couchapp-webpackage-validator"]}');
  } catch (err) {
    console.log('replication form core failed', err);
    throw err;
  }
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

async function removeDocument (databaseName, docId) {
  await slouch.doc.getAndDestroy(databaseName, docId);
}
