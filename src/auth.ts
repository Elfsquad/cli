import { Arguments, Argv } from 'yargs'
import { createServer } from 'http'
import open from 'open'
import chalk from 'chalk'

export const register = (cli: Argv) => {
  cli.command("login", "login with your credentials", (_) => {}, login);
  cli.command("logout", "logout from your account", (_) => {}, logout);
}

export const getToken = () => {

}

const login = async (argv: Arguments) => {
  // 1. Open http server, listening for requests on localhost:8888
  const server = createServer((req, res) => {
    const code = req.url?.split('code=')[1]
    console.log(code)
    res.end('Logged in! You can close this tab now.')
  }).listen(8888)

  // 2. Open browser to the auth URL
  const baseUrl = "https://login.elfsquad.io/oauth2/auth"
  const clientId = "elfsquad-cli"
  const redirectUri = "http://localhost:8888"
  const scope = "openid profile email"
  const responseType = "code"
  const authUrl = `${baseUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}`
  open(authUrl)
  console.log(chalk.green("Opening browser to login..."))
}

const logout = async (argv: Arguments) => {

}

