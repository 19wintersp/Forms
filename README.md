# Forms

**A NodeJS survey system.**

Basic system for operating a survey system written in NodeJS and a web-based interface. Forms is desigend to be secure and minimal.

Licensed under the GNU GPL (3.0 or later). Full details can be found in the "license" file.

## Hosting

### Requirements

The program is expected to work on most modern operating systems (including NT), however has only been fully tested on Ubuntu.

* NodeJS (latest version) installed and added to PATH
* NPM (latest version) installed and added to PATH
* Internet access

### Installation

An archive of the program ([latest version](https://github.com/19wintersp/Forms/releases/latest)) should be extracted into the working directory before continuing.

Running:

```shell
npm test
```

should give the output:

```
forms
```

To start the server, you should simply run:

```shell
npm start
```

The server should start with the default options.

### Configuration

You can configure the server either through environment variables or with a configuration file. To use a configuration file, name it "config.json" or specify its name in the `CONFIG` environment variable. It should be formatted as JSON, with the environment variable name as the key for each pair. A full list of options are below:

| Name       | Default     | Description                                                        |
|------------|-------------|--------------------------------------------------------------------|
| CONFIG     | config.json | The configuration file name. Cannot be used in configuration file. |
| HTTP_PORT  | 8080        | The port to listen on.                                             |
| VIEWS_DIR  | views       | The directory containing the frontend templates.                   |
| STATIC_DIR | static      | The directory containing the static files.                         |
| DATA_DIR   | data        | The directory for storing the form data.                           |
| CUSTOM_DIR | custom      | The directory containing the custom page configurations.           |
| TITLE      | Forms       | The app title, such as the organisation.                           |

Most of these (such as the -_DIR options) should not be modified.

### Custom pages

Custom pages can be hosted in two ways.

The usage of the "custom" directory is suggested. This can be done by creating files for each of the desired pages, with the file name being the URL path - it should be relatively short and contain no URI special characters. The file is in JSON format, and should contain two fields. `title` is the display name of the file (as a string), and `content` should contain an array of strings, each containing a paragraph of content. The output is styled in the same fashion as the rest of the site. The page is served at "/pages/{ file name }", and the server must be restarted for changes to appear.

Alternatively, raw files can be hosted in the "static" directory. These are served at "/static/{ file name }", and update immediately.

## Using

The server should operate automatically without human input. Requests and errors are logged to stdout/err.

Form data - that is, the details of a form and its responses - are saved to files in the data directory. A form has a unique identifier, which is generated as six random bytes converted to Base64*, which is used as the file name. Forms are edited with a special secret key, the hash of which is stored in the file.

*Note: the Base64 used throughout has substituted certain characters to prevent issues with URI-encoding: *`+`* is replaced with *`-`*, *`/`* is replaced with *`_`*, and *`=`* is replaced with *`*`*. *
