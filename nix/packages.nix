{
  perSystem = { pkgs, ... }: {
    packages = {
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
    };
  };
}
