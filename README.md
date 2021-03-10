# reMarkable-cloud-js
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
 
## Specifications

### Device types

To use on registration

 - desktop
	- windows (`desktop-windows`)
	- macos (`desktop-macos`)
	- linux (`desktop-linux`)
 - mobile
	- android (`mobile-android`)
	- ios (`mobile-ios`)
 - browser
	- chrome (`browser-chrome`)

found here
```javascript
const RmCJS = require('remarkable-cloud-js')

RmCJS.device_desc

RmCJS.device_desc.desktop
	RmCJS.device_desc.desktop.windows
	RmCJS.device_desc.desktop.macos
	RmCJS.device_desc.desktop.linux

RmCJS.device_desc.mobile
	RmCJS.device_desc.mobile.android
	RmCJS.device_desc.mobile.ios
	
RmCJS.device_desc.browser
	RmCJS.device_desc.browser.chrome

```

### ZIP MAP data representation

In the reMarkable case, ZIP data contains the documents ID in its root. As it is often not possible to know this ID while writing zip data, we propose the following zip data representation to post in zip_map APIs:

 - the zip map is reprenseted by a flat JSON object.
 - each property is a path.
	- a path containing the ID uses the `{ID}` string to indicate the position of this ID
 - each value can be either a string, a buffer or a JSON object

ZIP MAP sample
```javascript
const fs = require('fs')

let pdf_zip_map = {
	'{ID}.content': {
		extraMetadata: {},
		fileType: file_type,
		lastOpenedPage: 0,
		lineHeight: -1,
		margins: 180,
		pageCount: 0,
		textScale: 1,
		transform: {}
	},
	'{ID}.pagedata': [],
	'{ID}.pdf': fs.readFileSync('< pdf file path >')
}

```

### Document path

The reMarkable document path are absolute and starts with the root folder `/`
 - Sample folder: `/My project/blueprint`
 - Sample document: `/My project/blueprint/project one`

Note that no extension are used in the reMarkable filesystem

### Document types

 - document type (`DocumentType`) represent a "file" (notebook, pdf, epub, etc.)
 - collection type (`CollectionType`) represent a "folder"

found here
```javascript
const RmCJS = require('remarkable-cloud-js')

RmCJS.type

RmCJS.type.document
RmCJS.type.collection

```

### Document representation

(extended from the standard reMarkable representation)

```javascript
{
    ID: '< document UUID >',
    Version: 1,
    Message: '',
    Success: true,
    BlobURLGet: '',
    BlobURLGetExpires: '0001-01-01T00:00:00Z',
    ModifiedClient: '< last modification date string >',
    Type: '< document type >',
    VissibleName: '< document name >',
    CurrentPage: 0,
    Bookmarked: false,
    Parent: '< document parent UUID >',
    _path: '< detected absolute path >'
}
```

### Notification events

 - document added (`DocAdded`) when a document is added, updated (its content) or moved (including to the trash)
 - document deleted (`DocDeleted`) when a document is removed from the cloud (not only trashed)

found here
```javascript
const RmCJS = require('remarkable-cloud-js')

RmCJS.notification.event

RmCJS.notification.event.document_added
RmCJS.notification.event.document_deleted

```

### Exceptions

 - `path_not_found` occurs if a required path cannot be found
 - `update_error` occurs if an error is thrown while updating a document
 - `upload_request_error` occurs if an error is thrown while uploading a document
 - `delete_error` occurs if an error is thrown while deleting a document
 - `path_already_exists_error` occurs if trying to create a path already existing

## API

Storage read / write api

Basic data manipulation
### `exists (path)`
 - **arguments**
	- *`path`* the [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path) to check
 - **output** Boolean value `true` or `false`

### `unlink (path)`
 - **arguments**
	- *`path`* the [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path) to trash
 - **output** Boolean value `true` or `false`

### `move (from_path, to_parent)`
 - **arguments**
	- *`from_path`* the moving document's [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path)
	- *`to_parent`* the parent folder's [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path)
 - **output** Document (the new document data)

### `rename (path, new_name)`
 - **arguments**
	- *`path`* the renaming document's [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path)
	- *`new_name`* the document's new name
 - **output** Document (the new document data)


File content
### `write_zip (path, zip_map, type)`
 - **arguments**
	- *`path`* the document's [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path) for data writing (can be existing or not)
	- *`zip_map`* the [ZIP MAP](https://github.com/hugodecasta/remarkable-cloud-js#zip-map-data-representation) data
	- *`type`* the [document type](https://github.com/hugodecasta/remarkable-cloud-js#document-types)
 - **output** Boolean value `true` or `false`

### `read_zip (path)`
 - **arguments**
	- *`path`* the [path](https://github.com/hugodecasta/remarkable-cloud-js#document-path) to check
 - **output** Boolean value `true` or `false`


### `mkdir (path)`
 - **arguments**
	- *`path`* the path to check
 - **output** Boolean value `true` or `false`

### `copy (path)`
 - **arguments**
	- *`path`* the path to check
 - **output** Boolean value `true` or `false`


Specific file content
### `write_pdf* (path)`
 - **arguments**
	- *`path`* the path to check
 - **output** Boolean value `true` or `false`

### `read_pdf (path)`
 - **arguments**
	- *`path`* the path to check
 - **output** Boolean value `true` or `false`

### `write_epub (path)`
 - **arguments**
	- *`path`* the path to check
 - **output** Boolean value `true` or `false`

### `read_epub (path)`
 - **arguments**
	- *`path`* the path to check
 - **output** Boolean value `true` or `false`


### utils API

## Limitations

Cloud functionalities are not 100% reliable on the tablet and the application, it is thus recommended to use the cloud api with care and if possible with the tablet turned on and connected.