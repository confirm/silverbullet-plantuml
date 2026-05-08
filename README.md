# Silverbullet PlantUML plug

A [SilverBullet](https://silverbullet.md) plug that renders ` ```plantuml ` code blocks as inline SVG diagrams. 
Diagrams can be rendered either through a remote PlantUML server (default) or via a local PlantUML executable.

## Installation

Install via SilverBullet's Library Manager:

1. Open the command palette and run `Library: Install`.
2. Paste the URI of this plug's `PLUG.md`:

```
https://github.com/confirm/silverbullet-plantuml/blob/main/PLUG.md
```

The library page is installed at `Library/confirm/PlantUML` in your space.

## Usage

Check the [PLUG.md](PLUG.md) for the configuration & usage of the plug.

## Development

### Prepare development environment

Install Node.js dependencies via `make`:

```sh
make install
```

For local development, symlink the repo into your space's library so SilverBullet picks up changes:

```sh
mkdir -p ~/myspace/Library/development
ln -s "$PWD" ~/myspace/Library/development/plantuml
```

To clean the working tree:

```sh
make clean
```

### Build

Build the plug via `make`:

```sh
make build
```

> [!NOTE]
> This produces `plantuml.plug.js` & `plantuml.plug.js.map`.  
> SilverBullet syncs the file automatically — run `Plugs: Reload` in the command palette to reactivate after a rebuild.
