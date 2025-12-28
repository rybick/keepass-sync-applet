path=~/.local/share/cinnamon/applets/keepass-sync-applet@rybick.github.io
mkdir -p $path
rm -rf $path/*
cp metadata.json $path/
cp applet.js $path/
cp -r icons/ $path/
