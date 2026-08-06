{
  perSystem = { self', pkgs, ... }: {
    devShells.default = pkgs.mkShellNoCC {
      packages = [
        self'.packages.run
        self'.packages.smoke-test
      ];
    };
  };
}
