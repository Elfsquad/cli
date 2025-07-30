import { Arguments, Argv } from 'yargs'
import chalk from 'chalk'
import fs from 'fs'
import { getAccessToken } from './auth.js'
import JSZip from 'jszip'
import { exec } from 'child_process'



export const register = (cli: Argv) => {
  cli.command("extension", "Manage extensions", (builder) => {
    builder.demandCommand(1, 'You need at least one command')
    builder.command<{ name: string, template: 'dialog' | 'action' }>("init <name>", "initialize a new extension", (yargs) => {
        return yargs
            .positional('name', {
                describe: 'Name of the extension',
                type: 'string'
            })
            .option('template', {
                describe: 'Template to use',
                alias: 't',
                type: 'string',
                choices: ['dialog', 'action', 'instant'],
                required: true
            })
    }, init);
    builder.command("publish", "publish the extension", () => {}, publish);
    builder.command("debug", "debug the extension in browser", () => {}, debug);

  });
}

const init = async (argv: Arguments<{ name: string, template: string }>) => {
  const templates: Record<string, Record<string, string>>  = {
    dialog: DIALOG_SAMPLE_FILES,
    action: ACTION_SAMPLE_FILES,
    instant: INSTANT_SAMPLE_FILES
  }

  const path = (suffix: string) => `${argv.name}/${suffix}`;

  // 1. Create a new directory with the name of the extension
  if (fs.existsSync(argv.name)) {
    console.error(chalk.red(`Directory ${argv.name} already exists. Please choose a different name.`));
    return;
  }
  await fs.promises.mkdir(argv.name)
  const srcDir = path('src')
  await fs.promises.mkdir(srcDir)

  // 2. Create sample files
  const files = templates[argv.template]
  for (const [filename, content] of Object.entries(files)) {
    const fileName = path(filename)
    await fs.promises.writeFile(fileName, content.replace('{{ EXTENSION_NAME }}', argv.name))
    console.log(chalk.green(`Created ${fileName}`))
  }

  // 3. Run npm install and wait for it to finish
  console.log(chalk.green('Running npm install...'))
  await new Promise<void>((resolve, reject) => {
    exec('npm install', { cwd: argv.name }, (error, stdout, stderr) => {
      if (error) {
        console.error(chalk.red(`Error running npm install: ${error.message}`));
        reject(error);
      } else {
        console.log(stdout);
        resolve();
      }
    });
  })

  console.log(chalk.green(`Extension ${argv.name} initialized successfully!`))
}

const publish = async () => {
  console.log(chalk.green('Publishing...'))

  // 1. Check if dist folder exists
  if (!fs.existsSync('dist')) {
    console.error(chalk.red('No dist folder found, nothing to publish...'))
    return
  }

  // 2. Copy elfsquadrc.yml to dist
  await fs.promises.copyFile('elfsquadrc.yml', 'dist/elfsquadrc.yml')

  // 3. Zip the dist folder
  if (fs.existsSync('dist/dist.zip')) {
    fs.unlinkSync('dist/dist.zip')
  }
  const zip = new JSZip()
  const files = fs.readdirSync('dist')
  for (const file of files) {
    zip.file(file, fs.readFileSync(`dist/${file}`).toString());
  }
  const zipContent = await zip.generateAsync({ type: 'nodebuffer' })

  // 4. Upload the zip file to the server
  const accessToken = await getAccessToken()
  const url = 'https://staging.api.elfsquad.io/api/2/extensions'
  const zipBlob = new Blob([zipContent], { type: 'application/zip' });

  const formData = new FormData()
  formData.append('file', zipBlob, 'dist.zip')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: formData
  })

  if (!response.ok) {
    console.error(chalk.red('Failed to publish extension'))
    console.error(await response.text())
    return
  }
  await response.json()
  console.log(chalk.green('Extension published successfully'))
}

const debug = async () => {
  const ws = await import('ws');
  const net = await import('net');
  const chokidar = await import('chokidar');
  let open;
  try {
    const openModule = await import('open');
    open = openModule.default || openModule;
  } catch (e) {
    console.error(chalk.red('Failed to import "open" package.'));
    return;
  }

  const getAvailablePort = () => new Promise<number>((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
  });

  const port = await getAvailablePort();
  const wss = new ws.WebSocketServer({ port });
  console.log(chalk.green(`WebSocket server started on port ${port}`));

  const emsUrl = `https://staging.ems.elfsquad.io?debugPort=${port}`;
  if (open && typeof open === 'function' && typeof emsUrl === 'string' && emsUrl.length > 0) {
    try {
      await open(String(emsUrl));
      console.log(chalk.green(`Opened EMS at ${emsUrl}`));
    } catch (e) {
      console.error(chalk.red('Failed to open browser with EMS URL:', e));
    }
  } else {
    console.error(chalk.red('EMS URL is invalid, cannot open browser.'));
  }

  // Watch dist folder for changes
  const watcher = chokidar.watch('dist', { ignoreInitial: false });

  // Send initial files
  const sendAllFiles = async (wsClient: any) => {
    const files = fs.readdirSync('dist');
    for (const file of files) {
      const filePath = `dist/${file}`;
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf8');
        wsClient.send(JSON.stringify({ type: 'update', filename: file, content }));
      }
    }
    // Also send elfsquadrc.yml
    if (fs.existsSync('elfsquadrc.yml')) {
      const content = fs.readFileSync('elfsquadrc.yml', 'utf8');
      wsClient.send(JSON.stringify({ type: 'update', filename: 'elfsquadrc.yml', content }));
    }
  };

  wss.on('connection', (wsClient: any) => {
    console.log(chalk.green('Browser connected'));
    sendAllFiles(wsClient);
  });

  watcher.on('change', (filePath: string) => {
    const filename = filePath.replace(/^dist\//, '');
    const content = fs.readFileSync(filePath, 'utf8');
    wss.clients.forEach((client: any) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', filename, content }));
      }
    });
    console.log(chalk.yellow(`Sent update for ${filename}`));
  });

  watcher.on('add', (filePath: string) => {
    const filename = filePath.replace(/^dist\//, '');
    const content = fs.readFileSync(filePath, 'utf8');
    wss.clients.forEach((client: any) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', filename, content }));
      }
    });
    console.log(chalk.yellow(`Sent new file ${filename}`));
  });

  watcher.on('unlink', (filePath: string) => {
    const filename = filePath.replace(/^dist\//, '');
    wss.clients.forEach((client: any) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'delete', filename }));
      }
    });
    console.log(chalk.yellow(`Sent delete for ${filename}`));
  });

  // Watch elfsquadrc.yml for changes
  const rcWatcher = chokidar.watch('elfsquadrc.yml', { ignoreInitial: true });
  rcWatcher.on('change', (filePath: string) => {
    const filename = 'elfsquadrc.yml';
    const content = fs.readFileSync(filePath, 'utf8');
    wss.clients.forEach((client: any) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', filename, content }));
      }
    });
    console.log(chalk.yellow(`Sent update for ${filename}`));
  });
  rcWatcher.on('add', (filePath: string) => {
    const filename = 'elfsquadrc.yml';
    const content = fs.readFileSync(filePath, 'utf8');
    wss.clients.forEach((client: any) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', filename, content }));
      }
    });
    console.log(chalk.yellow(`Sent new file ${filename}`));
  });
  rcWatcher.on('unlink', (filePath: string) => {
    const filename = 'elfsquadrc.yml';
    wss.clients.forEach((client: any) => {
      if (client.readyState === ws.WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'delete', filename }));
      }
    });
    console.log(chalk.yellow(`Sent delete for ${filename}`));
  });
}

const defaultPackageJson = `{
  "name": "{{ EXTENSION_NAME }}",
  "scripts": {
    "build": "{{ BUILD }}"
  },
  "devDependencies": {
    "esbuild": "^0.12.0",
    "typescript": "^4.3.5"
  },
  "dependencies": {
    "@elfsquad/custom-scripting": "^0.0.4"
  }
}`;

const DIALOG_SAMPLE_FILES = {
  'package.json': defaultPackageJson.replace('{{ BUILD }}', 'esbuild src/index.ts --bundle --platform=browser --target=es2015 --outfile=dist/index.js && cp src/index.html dist/index.html'),
  'elfsquadrc.yml': `identifier: "{{ EXTENSION_NAME }}"

page_extensions:
  quotation:
    actions:
    - position: right
      color: primary

      names:
        en: Open dialog

      executable: 
        type: "dialog"
        entrypoint: "index.html"
        parameters:
          width: 50vw
          height: 70vh
`,
  'src/index.ts': `import { ui, dialog, api } from '@elfsquad/custom-scripting';

const reloadButton = document.getElementById('reloadButton');
reloadButton!.addEventListener('click', async () => {
  ui.reload();
});

const closeButton = document.getElementById('closeButton');
closeButton!.addEventListener('click', async () => {
  dialog.close();
});
`,
  'src/index.html': `<html>
  <head>
    <title>Elfsquad Extension</title>
    <script src="index.js" type="module" defer></script>
  </head>
  <body>
    <button id="reloadButton">Reload data</button>
    <button id="closeButton">Close dialog</button>
  </body>
</html>`,
  'tsconfig.json': `{
  "compilerOptions": {
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "module": "nodenext"
  }
}`
}

const ACTION_SAMPLE_FILES = {
  'package.json': defaultPackageJson.replace('{{ BUILD }}', 'tsc src/*.ts -noEmit && esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js'),
  'elfsquadrc.yml': `identifier: "{{ EXTENSION_NAME }}"
page_extensions:
  quotation:
    actions:
    - position: right
      color: primary

      names:
        en: Execute action

      executable: 
        type: "action"
        entrypoint: "index.js"
`,
  'src/index.ts': `import { api } from '@elfsquad/custom-scripting';

console.log('Hello from my Elfsquad extension!');`
}

const INSTANT_SAMPLE_FILES = {
  'package.json': defaultPackageJson.replace('{{ BUILD }}', 'esbuild src/index.ts --bundle --platform=browser --target=es2015 --outfile=dist/index.js'),
  'elfsquadrc.yml': `identifier: "{{ EXTENSION_NAME }}"

page_extensions:
  quotation:
    actions:
    - executable: 
        type: "instant"
        entrypoint: "index.js"
`,
  'src/index.ts': `alert('Hello from my Elfsquad instant extension!');`
}



