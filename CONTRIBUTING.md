# Shell Scripts/Common Commands

Prerequisites:
- [Nix](https://lix.systems/install/)

Enter the Nix development shell with `nix develop`, or use `direnv` for automatic setup.

Available scripts:
- `run` -> spins up a web server with live reload on the repository root.
- `smoke-test` -> checks that the `index.html` document has the necessary metadata.

You can also directly run the scripts from `scripts/` - see `nix/scripts.nix` for the required installations.
