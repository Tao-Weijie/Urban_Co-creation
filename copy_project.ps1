$src = "c:\Users\Weijie.Tao\Documents\Urban_Co-creation"
$dest = "C:\Users\Weijie.Tao\Documents\Urban_Co-creation_TF"

if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force
}

$folders = @("components", "rules", "public", "app")
foreach ($folder in $folders) {
    if (Test-Path "$src\$folder") {
        Copy-Item -Path "$src\$folder" -Destination "$dest\$folder" -Recurse -Force
    }
}

$files = @("package.json", "tsconfig.json", "eslint.config.mjs", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "test.json")
foreach ($file in $files) {
    if (Test-Path "$src\$file") {
        Copy-Item -Path "$src\$file" -Destination "$dest\" -Force
    }
}

# Remove api routes from target app
if (Test-Path "$dest\app\api") {
    Remove-Item -Path "$dest\app\api" -Recurse -Force
}

Write-Host "Copy completed successfully."
