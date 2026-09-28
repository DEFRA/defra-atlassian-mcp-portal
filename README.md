# jira-mcp-portal

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_jira-mcp-portal&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_jira-mcp-portal)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_jira-mcp-portal&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_jira-mcp-portal)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_jira-mcp-portal&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_jira-mcp-portal)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Authentication](#authentication)
    - [Entra ID (default)](#entra-id-default)
    - [Local auth](#local-auth)
  - [Guidance API mock data](#guidance-api-mock-data)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd jira-mcp-portal
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Proxy

Proxying is handled at the infrastructure level via the `NODE_USE_ENV_PROXY` environment variable, rather than the
application setting up a global `undici` `ProxyAgent` dispatcher itself. When enabled, Node's built-in `fetch`
(and anything built on `undici`) will automatically pick up the standard `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`
environment variables.

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run start:dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Authentication

The application supports two authentication providers controlled by the `AUTH_PROVIDER` environment variable.

#### Entra ID (default)

**Entra ID** (Microsoft Azure AD) is the default authentication provider and is used for production environments.
Users authenticate through an OpenID Connect (OIDC) flow with Microsoft Entra ID. After initial authentication,
sessions are maintained using secure HTTP-only cookies to avoid repeated authentication prompts. A "Sign out" link
in the header navigation signs the user out of both the app and Entra.

##### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_PROVIDER` | No | `entra` | Set to `entra` to enable Entra ID authentication |
| `ENTRA_TENANT_ID` | Yes* | - | The GUID of your Azure tenant that issues tokens (e.g., `00000000-0000-0000-0000-000000000000`) |
| `ENTRA_CLIENT_ID` | Yes* | - | The application (client) ID of your app registration in Entra ID |
| `ENTRA_CLIENT_SECRET` | Yes* | - | The client secret generated for your app registration |
| `ENTRA_AUTHORITY_HOST` | No | `https://login.microsoftonline.com` | The Entra authority host used to build the authorize/token/JWKS endpoints |
| `ENTRA_REDIRECT_HOST` | Yes* | - | The base URL used to build the OIDC redirect URI (e.g., `http://localhost:3000` for development, `https://your-domain.gov.uk` for production) |
| `ENTRA_USE_REFRESH_TOKENS` | No | `false` | Refresh expired Entra ID tokens using the stored refresh token instead of forcing re-login |
| `ENTRA_REFRESH_TOKEN_ACQUISITION_TIMEOUT` | No | `5000` | Timeout in milliseconds for acquiring a new access token using the refresh token |

**\* Required when using Entra ID in production mode. No errors will be thrown if these variables are missing in
local development / test environments, but authentication will fail.**

The **Redirect URI** registered on your Entra app registration must be: `{ENTRA_REDIRECT_HOST}/login/callback`

The Entra app registration must include these scopes:
- `openid` — OpenID Connect
- `profile` — basic profile claims
- `email` — email address
- `offline_access` — refresh token

#### Local auth

**Local** authentication is available for development purposes only and should never be used in production.

To use local authentication for development, set:

```bash
AUTH_PROVIDER=local
ATLASSIAN_MCP_URL=http://localhost:8085   # atlassian-mcp base URL
```

When using local authentication:
- The Entra ID configuration variables (`ENTRA_*`) are not required
- All requests are authenticated as a fixed mock user (`dev@example.com`) — no login flow or OAuth round-trip is required
- Sessions still use the same cookie-based mechanism as Entra authentication
- Linking runs through a simulated consent screen at `GET /account/atlassian-linking/mock-consent`, which the
  mock's authorization URL points at, so no real Atlassian round-trip is needed

When using local auth, both `jira-mcp-portal` and `atlassian-mcp` must have `AUTH_PROVIDER=local` set together — see
the [atlassian-mcp README](../atlassian-mcp/README.md) for its equivalent configuration.

##### When to Use

- Local development without access to Entra ID credentials
- Running tests that don't require external authentication
- CI/CD environments where Entra configuration is not available

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag jira-mcp-portal`

Build:

```bash
docker build --target development --no-cache --tag jira-mcp-portal:development .
```

Run:

```bash
docker run -p 3000:3000 jira-mcp-portal:development
```

### Production image

Build:

```bash
docker build --no-cache --tag jira-mcp-portal .
```

Run:

```bash
docker run -p 3000:3000 jira-mcp-portal
```

### Docker Compose

A local environment with:

- Redis
- `atlassian-mcp-mock`, a [Mockoon](https://mockoon.com) stand-in for the real `atlassian-mcp`
  (see [mockoon/README.md](./mockoon/README.md))
- This service.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
