# cubx-webpackage-uploader

[![NPM Version][npm-image]][npm-url] [![GitHub version](https://badge.fury.io/gh/cubbles%2Fcubx-webpackage-uploader.svg)](https://badge.fury.io/gh/cubbles%2Fcubx-webpackage-uploader)

This lib is part of the Cubbles platform. Use this lib to upload webpackages from Client to Base.

## Install

```sh
$ npm install -g cubx-webpackage-uploader
```

## API
```js
var uploader = require('cubx-webpackage-uploader')();
var uploaderConfig = {
    source: '/packages/my-package1',
    target: {
        url: 'http://boot2docker.me',
        proxy: ''
    },
    debug: false
};
}
uploader.uploadSingleWebpackage(uploaderConfig, function(err, success) {
    if (err) {
        console.error(err.message);
    } else {
        console.log(success);
    }
});
```

## CLI

### Configuration

You can pass the config via _config.json_ -File

Config structure:

```
# config.json
{
    source: '/packages/my-package1',
    target: {
        url: 'http://cubbles.url',
        proxy: ''
    },
    debug: false,
    dryRun: false
};
```

* **source:** {string-path} (default == '.') Points to the folder containing the webpackage.
* **target.url:** {string-url} (default == https://www.cubbles.world/sandbox) Url of the Base you want to upload your webpackage to.
* **target.proxy:** {string-url} (default == '') (optional) Proxy-Url, if your are behind a proxy.
* **debug:** {boolean} (default == false) (optional) logs debug information;
* **dryRun:** {boolean} (default == false) (optional) prevents uploader from doing the upload, responds a list of files 
  to be uploaded AND a list of file to be ignored from upload according to a (optional) '.cubblesignore' config file

## Ignore resources from upload '.cubblesignore'
At the root folder of a webpackage developers can (optionally) provide a file name _.cubblesignore_. As you know it from _.gitignore_, 
 developers can define the resources to be ignored from being uploaded using glob-patterns (@see https://github.com/isaacs/node-glob#glob-primer). 

### Run (standalone)

    cubx-webpackage-uploader <config path e.g. ./folder/config.json>
    
[npm-image]: https://img.shields.io/npm/v/cubx-webpackage-uploader.svg
[npm-url]: https://npmjs.org/package/cubx-webpackage-uploader
