# remarkable-cloud-js
reMarkable Cloud API for NodeJS

Inspired by
 - Alexander Keil's [unofficial reMarkable Cloud API documentation](https://akeil.de/posts/remarkable-cloud-api/)
 - jmptable's [ReMarkable Tablet Cloud API](https://www.npmjs.com/package/remarkable-tablet-api)
 - ogdentrod's [reMarkable-typescript](https://www.npmjs.com/package/remarkable-typescript)

 ## Features

  * [X] Authentication
    - [X] device registration
    - [X] user connection
  * [X] data retrieval/push
    - [X] files metadata retrieval
    - [X] folders tree retrieval
    - [X] path exists
    - [X] unlink path
    - [X] create directory
    - [X] move path
    - [X] rename path
    - [X] read/write zip
    - [X] copy path
    - [X] read/write pdf
    - [X] read/write ePub
  * [X] cloud live notifications
    - [X] main data feed (all updates)
    - [X] subscription data feed (specific file/folder updates)

 ## Main usage

First time authentication

 ```javascript
const RmCJS = require('remarkable-cloud-js')

let rm_api = new RmCJS()

let device_token = await rm_api.register_device('< one time code >', RmCJS.device_desc.desktop.linux)

// save the device_token to be reused later

await rm_api.refresh_token() // auto authentication once registration is done 

 ```

Common connection

 ```javascript
const RmCJS = require('remarkable-cloud-js')

// using the saved device token + refreshing the user token
let rm_api = new RmCJS('< device token >')
await rm_api.refresh_token()
```

Sample storage usage

 ```javascript
const RmCJS = require('remarkable-cloud-js')

let rm_api = new RmCJS('< device token >')
await rm_api.refresh_token()

if(!(await rm_api.exists('/My projects/blueprints'))) {
  await rm_api.mkdir('/My projects/blueprints')
}

let blueprints = await rm_api.get_path_content('/My projects/Articles')

for(let blueprint of blueprints) {
  if(blueprint.VissibleName.includes('to delete')) {
    await rm_api.delete(blueprint._path)
  }
}

await rm.write_pdf('/My projects/Articles/a really cool pdf', './pdfs/article.pdf')

```

Sample notifications usage

 ```javascript
const RmCJS = require('remarkable-cloud-js')

let rm_api = new RmCJS('< device token >')
await rm_api.refresh_token()

function notification_handler(event) {
  console.log('update on', event.document.VissibleName)
}

// ---- event matcher making sure all recieved event come from the remarkable tablet
let notification_matcher = {
  sourceDeviceDesc: 'remarkable'
}

await rm_api.subscribe_to_notifications(notification_handler, notification_matcher)

```

 
 ## API

 ### utils API

 ## Limitations

Cloud functionalities are not 100% reliable on the tablet and the application, it is thus recommended to use the cloud api with care and if possible with the tablet turned on and connected.