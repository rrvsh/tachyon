{
  description = "Tachyon dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [ pkgs.nodejs_24 pkgs.pnpm_10 pkgs.chromium ];
          PLAYWRIGHT_BROWSERS_PATH = "0";
          PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
        };
      });
    };
}
