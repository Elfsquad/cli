import { Arguments, Argv } from 'yargs'
import chalk from 'chalk'
import fs from 'fs'
import { getAccessToken } from './auth.js'
import JSZip from 'jszip'


export const register = (cli: Argv) => {
  cli.command("extension", "Manage extensions", (builder) => {
    builder.demandCommand(1, 'You need at least one command')
    builder.command<{ name: string }>("init <name>", "initialize a new extension", () => {}, init)
    builder.command("publish", "publish the extension", () => {}, publish)
  });
}

const init = async (argv: Arguments<{ name: string }>) => {
  const path = (suffix: string) => `${argv.name}/${suffix}`;

  // 1. Create a new directory with the name of the extension
  await fs.promises.mkdir(argv.name)
  const srcDir = path('src')
  await fs.promises.mkdir(srcDir)

  // 2. Create sample files
  for (const [filename, content] of Object.entries(SAMPLE_FILES)) {
    const fileName = path(filename)
    await fs.promises.writeFile(fileName, content)
    console.log(chalk.green(`Created ${fileName}`))
  }
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
    zip.file(file, fs.readFileSync(`dist/${file}`))
  }
  const zipContent = await zip.generateAsync({ type: 'nodebuffer' })

  // 4. Upload the zip file to the server
  const accessToken = await getAccessToken()
  const url = 'http://localhost:5101/api/2/extensions'
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

const SAMPLE_FILES = {
  'package.json': `{
  "name": "test-extension",
  "scripts": {
    "build": "tsc -noEmit && esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js && cp src/index.html dist/index.html"
  },
  "devDependencies": {
    "esbuild": "^0.12.0",
    "typescript": "^4.3.5"
  },
  "dependencies": {
    "@elfsquad/custom-scripting": "^0.0.4"
  }
}`,
  'elfsquadrc.yml': `name: "test-extension"

page_extensions:
  quotation:
    actions:
    - identifier: "dialog"
      name: "Open dialog"
      executable: 
        type: "dialog"
        entrypoint: "index.html"
`,
  'src/index.ts': `import { ui, dialog } from '@elfsquad/custom-scripting';

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

