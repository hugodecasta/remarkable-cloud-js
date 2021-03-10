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
  * [ ] data retrieval/push
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
  * [ ] cloud live notifications
    - [ ] main data feed (all updates)
    - [ ] subscription data feed (specific file/folder updates)

 ## Limitations

Cloud functionalities are not 100% reliable on the tablet and the application, it is thus recommended to use the cloud api with care and if possible with the tablet turned on and connected.