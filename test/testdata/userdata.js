module.exports = {
  users: {
    user1: {
      _id: 'org.couchdb.user:base-api-upload-test-user',
      name: 'base-api-upload-test-user',
      logins: {
        local: {
          login: 'base-api-upload-test-user'
        }
      },
      roles: [],
      type: 'user',
      password: 'cubbles'
    }
  },
  groups: {
    group1: {
      _id: 'base-api-upload-test-group1',
      displayName: 'API Test: Group1',
      docType: 'group',
      users: [
        'base-api-upload-test-user'
      ]
    }
  },
  acls: {
    aclStore1: {
      _id: 'base-api-upload-test',
      docType: 'acl',
      store: 'base-api-upload-test',
      permissions: {
        'base-api-upload-test-group1': {
          upload: true
        }
      }
    }
  }
};
