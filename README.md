# Docker Project Builder

🚀 A powerful CLI tool that generates production-ready Docker project scaffolds with battle-tested configurations.

## Features

- ✅ **Interactive CLI** - Easy-to-use prompts guide you through project setup
- ✅ **9 Service Plugins** - Next.js, Express.js, PostgreSQL, MySQL, Redis, Valkey, MailHog, Mailpit, Apache Proxy
- ✅ **Multi-Environment Support** - Local, staging, and production configurations
- ✅ **Multi-Stage Dockerfiles** - Optimized for development and production
- ✅ **Custom Bash CLI** - Each generated project includes a powerful CLI tool
- ✅ **Plugin Architecture** - Easy to extend with new services
- ✅ **Production-Ready** - Based on proven ArcFlowBoard patterns

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/docker-project-builder.git
cd docker-project-builder

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Generate Your First Project

```bash
# Create a new project
dpb create

# Or if not linked globally
node dist/index.js create
```

Follow the interactive prompts to configure your project:
1. Project name and domain
2. Select app frameworks (Next.js, Express.js)
3. Choose databases (PostgreSQL, MySQL)
4. Add caching (Redis, Valkey)
5. Pick mail service (MailHog, Mailpit)
6. Configure environments and proxy

### Use Your Generated Project

```bash
# Navigate to your project
cd my-awesome-app

# Start all services
./my-awesome-app up

# View logs
./my-awesome-app logs

# Open a shell in a service
./my-awesome-app shell nextjs

# Stop all services
./my-awesome-app down
```

## Web UI (NEW!)

A visual interface for creating and managing Docker projects.

### Start the Web UI

```bash
cd webui
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Features

- 🎨 **Visual Project Creator** - Create projects with an intuitive form
- 🐳 **Docker Viewer** - Monitor containers, view logs, control services
- 🧪 **Test Project** - Auto-generate and validate test projects with curl

The Web UI executes the same `dpb` CLI commands and generated bash scripts, providing a visual wrapper around the battle-tested CLI tools.

See [webui/README.md](webui/README.md) for detailed documentation.

## Available Services

### Application Frameworks
- **Next.js** - React framework with SSR/SSG
- **Express.js** - Fast, minimalist web framework

### Databases
- **PostgreSQL** - Advanced open-source database
- **MySQL** - Popular relational database

### Caching
- **Redis** - In-memory data structure store
- **Valkey** - Redis fork with enhanced features

### Mail Services (Development)
- **MailHog** - Email testing tool
- **Mailpit** - Modern MailHog alternative

### Proxy
- **Apache** - Reverse proxy with path/subdomain routing

## CLI Commands

### dpb create
Generate a new Docker project with interactive prompts.

```bash
dpb create
```

### dpb list
List all available service plugins.

```bash
dpb list
```

### dpb webui
Start the Web UI development server. Automatically installs dependencies if needed.

```bash
dpb webui
```

Options:
- `-p, --port <port>` - Port to run on (default: 3000)
- `--install-only` - Only install dependencies, don't start server

### dpb --help
Show help information.

```bash
dpb --help
```

## Generated Project Structure

```
my-app/
├── apps/                           # Your application code
│   ├── nextjs/                    # Next.js frontend
│   └── api/                       # Express.js API
├── docker/
│   ├── compose/
│   │   ├── docker-compose.yml      # Base configuration
│   │   ├── docker-compose.override.yml  # Dev overrides
│   │   └── docker-compose.prod.yml      # Production overrides
│   ├── images/                     # Custom Dockerfiles
│   ├── scripts/                    # Entrypoint scripts
│   └── proxy/                      # Apache configuration
├── bin/cli/                        # CLI tool internals
│   ├── common.sh                   # Shared utilities
│   └── commands/                   # CLI commands
├── .env                            # Environment variables
├── .env.example                    # Environment template
├── .env.production.example         # Production template
├── ./my-app                        # Main CLI tool (executable)
├── .gitignore
└── README.md
```

## Generated CLI Commands

Each generated project includes a powerful CLI tool:

```bash
./my-app up              # Start all services
./my-app down            # Stop all services
./my-app build [service] # Build/rebuild services
./my-app logs [service]  # View logs
./my-app exec <service> <command>  # Execute command
./my-app shell <service> # Open shell
./my-app status          # Show container status
./my-app restart [service]  # Restart services
```

Plus plugin-specific commands:
```bash
./my-app db-psql         # PostgreSQL shell
./my-app db-mysql        # MySQL shell
./my-app redis-cli       # Redis CLI
./my-app mailhog-open    # Open MailHog UI
```

## Architecture

### Plugin System
Each service is a plugin implementing the `IServicePlugin` interface:
- Compose service blocks (base, dev, production)
- Custom Dockerfiles and entrypoints
- Environment variables per environment
- Health checks
- Proxy routes
- Custom CLI commands

### Multi-Environment
- **Local**: Development with hot reload, exposed ports
- **Staging**: Test environment with production-like settings
- **Production**: Optimized builds, external services

### Generated Bash CLI
The generated `./my-app` CLI is the single source of truth for Docker operations. Future web UI will execute these commands.

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Add a New Plugin

1. Create plugin directory: `src/plugins/{category}/{name}/`
2. Implement `IServicePlugin` interface
3. Export default instance
4. Add templates if needed

See `docs/adding-plugins.md` for detailed guide.

## Documentation

- [Progress & Status](docs/PROGRESS.md)
- [Next Steps](docs/NEXT_STEPS.md)
- [Full Architecture](docs/designs/arch/architecture.md)
- [Adding Plugins](docs/adding-plugins.md) *(coming soon)*
- [Getting Started](docs/getting-started.md) *(coming soon)*

## Project Status

**Version:** 0.1.0 (MVP)

**Completed:**
- ✅ Core architecture (100%)
- ✅ All 9 plugins (100%)
- ✅ CLI commands (100%)
- ✅ Generators (100%)
- ✅ Web UI with Docker viewer (100%)
- ⏳ Tests (pending)
- ⏳ Documentation (in progress)

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

Built by the team behind ArcFlowBoard, leveraging battle-tested Docker patterns from production systems.

---

**Ready to build?** Run `dpb create` and get started in seconds! 🚀
