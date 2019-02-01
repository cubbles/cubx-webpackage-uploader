function (newDoc, oldDoc, userCtx, secObj) {

  function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  }

  /*
   Take care:
   As we are attaching some files to the document after it's initial creation, we can't simply check for the version-number to be a SNAPSHOT-Version.

   What will work is modifying the upload process:
   1) Upload the document with a attribute "uploadInProgress"
   2) Upload all attachments
   3) Update the document and remove the attribute "uploadInProgress"

   */
  if (oldDoc) {
    if (oldDoc.version && endsWith(oldDoc.version, "-SNAPSHOT")) {
      return;
    }
    if (oldDoc.baseContext.uploadInfos.uploadInProgress) {
      return;
    }
    else {
      throw({
        forbidden: 'Final Webpackages are NOT allowed to be overwritten.'
      });
    }
  }
}