function (doc, req) {
  if (!doc) {
    // change nothing in database
    return [ null, 'Document not found.' ]
  }
  // if there is an existing doc
  if (doc.baseContext.uploadInfos.uploadInProgress) {
    var updateBaseContext = function (doc) {
      var body = JSON.parse(req.body);
      doc.baseContext.uploadInfos.client = body.client ? body.client : undefined;
      delete doc.baseContext.uploadInfos.uploadInProgress;
    };

    updateBaseContext(doc);

    var response = {
      ok: true,
      id: doc._id,
      baseContext: doc.baseContext
    };
    return [ doc, JSON.stringify(response) ];
  }

  //otherwise
  return [ doc, {
    ok: false,
    id: doc.id,
    cause: 'Did not change the document, as it was not \"uploadInProgress\".'
  } ];
}