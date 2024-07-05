import { Arguments, Argv } from 'yargs'
import { createServer } from 'http'
import open from 'open'
import chalk from 'chalk'
import fs from 'fs'

export const register = (cli: Argv) => {
  cli.command("login", "login with your credentials", (_) => {}, login);
  cli.command("logout", "logout from your account", (_) => {}, logout);
}

export const getAccessToken = async () => {
  const home = process.env.HOME || process.env.USERPROFILE
  const authPath = `${home}/.elfsquad/auth.json`
  try {
    const content = fs.readFileSync(authPath, 'utf8')
    const token = JSON.parse(content)
    const expiresAt = token.created_at + token.expires_in

    if (Date.now() > expiresAt) {
      return await refreshAccessTokenAsync(token.refresh_token)
    }

    return token.access_token
  } catch (err) {
    return null
  }
}

const login = async (argv: Arguments) => {
  // 1. Open http server, listening for requests on localhost:8888
  const server = createServer(async (req, res) => {
    const code = req.url?.split('code=')[1]
    if (!code) {
      res.end('No code found in URL. Please try again.')
      return
    }
    const response = await exchangeCodeForTokenAsync(code)
    await saveTokenAsync(response)
    res.end(`<body>
    <p>Logged in! You can close this tab now.</p>
</body>`);
    console.log(chalk.green("Logged in!"))
    server.close()
  }).listen(8888)

  // 2. Open browser to the auth URL
  const baseUrl = "https://login.elfsquad.io/oauth2/auth"
  const clientId = "elfsquad-cli"
  const redirectUri = "http://localhost:8888"
  const scope = "openid profile Elfskot.Api"
  const state = "12345678"
  const responseType = "code"
  const authUrl = `${baseUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}&state=${state}`
  console.log(chalk.green("Opening browser to login..."))
  await open(authUrl)
}

const exchangeCodeForTokenAsync = async (code: string) => {
  const baseUrl = "https://login.elfsquad.io/oauth2/token"
  const clientId = "elfsquad-cli"
  const grantType = "authorization_code"
  const redirectUri = "http://localhost:8888"

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `client_id=${clientId}&code=${code}&grant_type=${grantType}&redirect_uri=${redirectUri}`,
  });

  const json = await response.json();
  return json;
}

const saveTokenAsync = async (token: any) => {
  const home = process.env.HOME || process.env.USERPROFILE
  const elfsquadDirPath = `${home}/.elfsquad`
  const authPath = `${elfsquadDirPath}/auth.json`
  await fs.promises.mkdir(elfsquadDirPath, { recursive: true })
  await fs.promises.writeFile(authPath, JSON.stringify(token, null, 2))
}

const refreshAccessTokenAsync = async (refreshToken: string) => {
  try {
    const baseUrl = "https://login.elfsquad.io/oauth2/token"
    const clientId = "elfsquad-cli"
    const grantType = "refresh_token"

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `client_id=${clientId}&refresh_token=${refreshToken}&grant_type=${grantType}`,
    });

    const json = await response.json();
    if (json.error) {
      console.log(chalk.red("Error refreshing token: " + json.error))
      process.exit(1)
    }

    await saveTokenAsync(json)
    return json.access_token
  } catch (err) {
    console.log(chalk.red("Error refreshing token: " + err))
    process.exit(1)
  }
}

const logout = async (argv: Arguments) => {
  const home = process.env.HOME || process.env.USERPROFILE
  const authPath = `${home}/.elfsquad/auth.json`
  await fs.promises.unlink(authPath)
  console.log(chalk.green("Logged out!"))
}

