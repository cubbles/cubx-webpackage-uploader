## Test Enviroment

You must have a local installed base, to run the tests.

Adjust the enviroment in local base, before run tests:

* create database `webpackage-store-base-api-upload-test` (delete it if existing and create again)
* add design document

  * _design/couchapp-webpackage-validator 

       {
          "_id": "_design/couchapp-webpackage-validator",
          "language": "javascript",
          "updates": {
              "finishUpload": "function (doc, req) {\n  if (!doc) {\n    // change nothing in database\n    return [ null, 'Document not found.' ]\n  }\n  // if there is an existing doc\n  if (doc.baseContext.uploadInfos.uploadInProgress) {\n    var updateBaseContext = function (doc) {\n      var body = JSON.parse(req.body);\n      doc.baseContext.uploadInfos.client = body.client ? body.client : undefined;\n      delete doc.baseContext.uploadInfos.uploadInProgress;\n    };\n\n    updateBaseContext(doc);\n\n    var response = {\n      ok: true,\n      id: doc._id,\n      baseContext: doc.baseContext\n    };\n    return [ doc, JSON.stringify(response) ];\n  }\n\n  //otherwise\n  return [ doc, {\n    ok: false,\n    id: doc.id,\n    cause: 'Did not change the document, as it was not \"uploadInProgress\".'\n  } ];\n}",
              "startUpload": "function (doc, req) {\n  var createOrUpdateBaseContext = function (newDoc) {\n    newDoc.baseContext = {\n      uploadInfos: {\n        target: req.headers.Host + '/' + req.path[ 0 ].replace(/webpackage-store(-)?/, ''),\n        date: new Date().toISOString(),\n        uploadInProgress: true,\n        user: req.headers[ 'X-Auth-Couchdb-Username' ]\n      }\n    }\n  };\n  var newDoc = JSON.parse(req.body);\n  createOrUpdateBaseContext(newDoc);\n  var response = {\n    ok: true,\n    id: newDoc._id,\n    baseContext: newDoc.baseContext\n  };\n  return [ newDoc, JSON.stringify(response) ];\n}"
          },
          "validate_doc_update": "function(newDoc, oldDoc, userCtx, secObj) {\n\n    function endsWith(str, suffix) {\n        return str.indexOf(suffix, str.length - suffix.length) !== -1;\n    }\n\n    /*\n     Take care:\n     As we are attaching some files to the document after it's initial creation, we can't simply check for the version-number to be a SNAPSHOT-Version.\n\n     What will work is modifying the upload process:\n     1) Upload the document with a attribute \"uploadInProgress\"\n     2) Upload all attachments\n     3) Update the document and remove the attribute \"uploadInProgress\"\n\n     */\n    if (oldDoc) {\n        if (oldDoc.version && endsWith(oldDoc.version, \"-SNAPSHOT\")) {\n            return;\n        }\n        if (oldDoc.baseContext.uploadInfos.uploadInProgress) {\n            return;\n        }\n        else {\n            throw({\n                forbidden: 'Final Webpackages are NOT allowed to be overwritten.'\n            });\n        }\n    }\n}"
       }

* add user if not exists 
  
      {
        "_id": "org.couchdb.user:base-api-upload-test-user",
        "name": "base-api-upload-test-user",
          "logins": {
            "local": {
              "login": "base-api-upload-test-user"
            }
          },
          "roles": [],
          "type": "user",
          "password": "cubbles"
      }

* add group if not exists

      {
        "_id": "base-api-upload-test-group1",
        "displayName": "API Test: Group1",
        "docType": "group",
        "users": [
            "base-api-upload-test-user"
        ]
      }
      
* add acl if not exists

      {
        "_id": "base-api-upload-test",
        "docType": "acl",
        "store": "base-api-upload-test",
        "permissions": {
          "base-api-upload-test-group1": {
            "upload": true
           }
        }
      }  
