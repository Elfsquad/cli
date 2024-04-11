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

  // 2. Create index.js
  const indexPath = path('index.js')
  await fs.promises.writeFile(indexPath, `console.log('Hello, ${argv.name}!')`)
  console.log(chalk.green(`Created ${indexPath}`))

  // 3. Create elfsquadrc.yml
  const rcPath = path('elfsquadrc.yml')
  const rcContent = `name: "${argv.name}"

buttons:
- name: "${argv.name}"
  actions:
  - type: "dialog"
    entrypoint: "index.js"
`;

  await fs.promises.writeFile(rcPath, rcContent)
  console.log(chalk.green(`Created ${rcPath}`))
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

