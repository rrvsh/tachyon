{
  perSystem = { pkgs, lib, ... }: {
    devShells.default =
      let
        run = pkgs.writeShellApplication {
          name = "run";
          runtimeInputs = [
            pkgs.git
            pkgs.live-server
          ];
          text = builtins.readFile ../scripts/run.sh;
        };
        smoke-test = pkgs.writeShellApplication {
          name = "smoke-test";
          runtimeInputs = [
            pkgs.git
            pkgs.gnugrep
          ];
          text = builtins.readFile ../scripts/smoke-test.sh;
        };
      in
      pkgs.mkShellNoCC {
        packages = [
          run
          smoke-test
        ];
      };
  };
}
