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
var supercouch = require('supercouch');
var request = require('superagent');
var couch = supercouch(opts.couchUrl);
var testdata = require('./testdata/userdata.js');
var dbName = opts.dbNamePrefix + '-' + opts.storeName;

function removeDb (done, next) {
  couch
    .dbExists(dbName)
    .end(function (err, res) {
      if (err) {
        return done(err);
      }
      // db does exist
      if (res === true) {
        console.log('Removing database: %s', dbName);
        couch
          .dbDel(dbName)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            if (next) {
              next(done);
            } else {
              done();
            }
          });
      } else {
        if (next) {
          next(done);
        } else {
          done();
        }
      }
    });
}

function addDb (done) {
  console.log('Creating database: %s', dbName);
  couch
    .dbAdd(dbName)
    .end(function (err, res) {
      if (err) {
        console.log('dbAdd failed', err);
        return done(err);
      }
      replicateFromCore(done);
    });
}

function replicateFromCore (done) {
  request.post(opts.couchUrl + '/_replicate')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .send('{"source":"webpackage-store-core","target":"' + dbName + '", "doc_ids":["_design/couchapp-webpackage-validator"]}')
    .end(function (err, res) {
      if (err) {
        console.log('replication form core failed', err);
        return done(err);
      }
      addWebpackageDocument(done);
    });
}

function addWebpackageDocument (done) {
  var doc = { _id: 'pack@1.0.0', foo: 'bar' };
  console.log('Creating Webpackage: %s\n', doc._id);
  couch
    .db(dbName)
    .insert(doc)
    .end(function (err, res) {
      if (err) {
        console.log('document insert failed', err);
        return done(err);
      }
      done();
    });
}

function addDocument (db, doc, next) {
  doc.created = Date.now();
  couch
    .db(db)
    .insert(doc)
    .end(function (err, res) {
      if (err) {
        console.log('Document update for "%s" failed [%s]', doc._id, err.message);
      }
      console.log('%s "%s" available.', doc.docType ? doc.docType : 'user', doc._id);
      next();
    });
}

before(function (done) {
  // function: create a test user
  console.log('before ....');

  // add testuser and test-database
  addDocument('_users', testdata.users.user1, function () {
    addDocument('groups', testdata.groups.group1, function () {
      addDocument('acls', testdata.acls.aclStore1, function () {
        removeDb(done, addDb);
      });
    });
  });
});

after(function (done) {
  function removeDocument (db, docId, next) {
    couch
      .db(db)
      .get(docId)
      .end(function (err, res) {
        if (err) {
          console.log(err);
          return done(err);
        }
        couch
          .db(db)
          .remove(docId, res._rev)
          .end(function (err, res) {
            if (err) {
              console.log('Remove document "%s" failed!', docId);
              return done(err);
            } else {
              console.log('Removed document "%s"', docId);
              next();
            }
          });
      });
  }

  // remove testuser and test-database

  if (opts.finallyRemoveTestData) {
    removeDocument('_users', testdata.users.user1._id, function () {
      removeDocument('groups', testdata.groups.group1._id, function () {
        removeDocument('acls', testdata.acls.aclStore1._id, function () {
          removeDb(done);
        });
      });
    });
  } else {
    done();
  }
});

