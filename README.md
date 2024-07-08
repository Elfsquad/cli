Elfsquad CLI
============

This CLI tool helps you manage authentication and extensions for Elfsquad. It provides commands for logging in and out, as well as for creating and publishing extensions.

Getting Started
---------------

### Installation

To install the CLI, you need to have `Node.js` installed on your machine. Then, you can install the CLI globally using npm:

```bash
npm i -g @elfsquad/cli
```

### Authentication

The CLI provides commands for logging in and out. Below are the steps for authentication:

#### Login

To login, use the following command:

```bash
elfsquad login
```

This will open a browser window where you can enter your credentials.

#### Logout

To logout, use the following command:

```bash
elfsquad logout
```

This will remove your authentication token from the local storage.

### Example
-------

Here is an example of how to create and publish a new extension:

```bash
npm i -g @elfsquad/cli
elfsquad login
elfsquad extension init myExtension --template dialog
cd myExtension
npm run build
elfsquad extension publish
```

This will create a new dialog extension named `myExtension`, build it, and publish it to your Elfsquad environment.

Contributing
------------

If you would like to contribute to this project, please fork the repository and create a pull request. We welcome all contributions!

License
-------

This project is licensed under the MIT License. See the `LICENSE` file for more information.
