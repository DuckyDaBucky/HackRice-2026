{
  description = "Presage API Python camera-debug environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      pythonFor = pkgs:
        pkgs.python312.withPackages (pythonPackages: with pythonPackages; [
          numpy
          opencv4
          pygame
          websockets
        ]);
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pythonFor pkgs;
        in
        {
          default = pkgs.mkShell {
            packages = [ python ];
            PYTHONNOUSERSITE = "1";

            shellHook = ''
              echo "Presage Python environment: $(python --version)"
              echo "Run: python examples/camera_debug.py --preview"
            '';
          };
        });

      # `nix run path:. -- path/to/script.py` runs any Python script with the same
      # pinned interpreter and packages as the development shell.
      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pythonFor pkgs;
        in
        {
          default = {
            type = "app";
            program = "${python}/bin/python";
            meta.description = "Run a script with the Presage Python environment";
          };
        });

      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pythonFor pkgs;
        });
    };
}
