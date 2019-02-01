function (doc, req) {
  var createOrUpdateBaseContext = function (newDoc) {
    newDoc.baseContext = {
      uploadInfos: {
        target: req.headers.Host + '/' + req.path[ 0 ].replace(/webpackage-store(-)?/, ''),
        date: new Date().toISOString(),
        uploadInProgress: true,
        user: req.headers[ 'X-Auth-Couchdb-Username' ]
      }
    }
  };
  var newDoc = JSON.parse(req.body);
  createOrUpdateBaseContext(newDoc);
  var response = {
    ok: true,
    id: newDoc._id,
    baseContext: newDoc.baseContext
  };
  return [ newDoc, JSON.stringify(response) ];
}