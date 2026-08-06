{ self, ... }:
{
  perSystem =
    {
      self',
      pkgs,
      lib,
      ...
    }:
    {
      checks = {
        smoke-test = pkgs.runCommandLocal "smoke-test" { } ''
          ${lib.getExe self'.packages.smoke-test} ${self}
          touch $out
        '';
        lint = pkgs.runCommandLocal "lint" { } ''
          ${lib.getExe pkgs.deadnix} --fail ${self}
          ${lib.getExe pkgs.statix} check ${self}
          ${lib.getExe pkgs.validator-nu} \
          --skip-non-html \
          --also-check-css \
          --skip-info-messages ${self}
          touch $out
        '';
      };
    };
}
