const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;

const appletId = 'keepass-sync-applet@rybick.github.io'

const config = loadConfig();

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}

function loadConfig() {
    const appletDir = imports.ui.appletManager.appletMeta[appletId].path;
    let file = Gio.File.new_for_path(`${appletDir}/config.json`);
    let [, contents] = file.load_contents(null);
    let str = new TextDecoder("utf-8").decode(contents);
    return JSON.parse(str);
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: async function(orientation, panel_height, instance_id) {
        try {
            Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

            this._setStatus("loading", "Loading...");

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            const dirs = await this._getDirs();
            const menu = await this._createMenuAsync(this, orientation, dirs);
            this.menuManager.addMenu(menu);
            this.menu = menu;
            this.dirs = dirs;

            await this._refresh();
        } catch (e) {
            this._fail(e);
        }
    },

    on_applet_clicked: async function() {
        try {
            this.menu.toggle();
            await this._refresh();
        } catch (e) {
            this._fail(e);
        }
    },

    _refresh: async function() {
        const status = await this._checkStatus(this.dirs);
        if (!status.localDirSynced) {
            this._setStatus("high", "local db not uploaded!");
        } else if (Object.values(status.otherDirs).some((good) => !good)) {
            const badDirs = Object.entries(status.otherDirs)
                .filter(([dir, good]) => !good)
                .map(([dir]) => dir);
            this._setStatus("low", `${badDirs} seem to be newer than local backup`);
        } else {
            this._setStatus("neutral", "Everything synced-up");
        }
    },

    _setStatus: function(level, message) {
        this.set_applet_icon_symbolic_name("ksa-" + level);
        this.set_applet_tooltip(_(message));
    },

    _getDirs: async function() {
        const cmdOut = await runSshAsync(`ls ${config.remotePath}`);
        const dirs = cmdOut.split('\n').filter(dir => dir);
        const localName = config.localName
        const [localDir, otherDirs] = partitionSingle(dirs, dir => dir === config.localName)
        if (!localDir) {
            this._fail("localDir not present");
        }
        return {
            "localDir": localDir,
            "otherDirs": otherDirs
        }
    },

    _createMenuAsync: async function(launcher, orientation, dirs) {
        const menu = new Applet.AppletPopupMenu(launcher, orientation);
        menu.addMenuItem(this._createUploadLocalMenuItem(dirs.localDir));
        this._createDownloadRemoteMenuItem(dirs.otherDirs).forEach((it) => menu.addMenuItem(it));
        return menu;
    },

    _createUploadLocalMenuItem: function(localDir) {
        let item = new PopupMenu.PopupMenuItem(`Upload ${localDir}`);
        item.connect('activate', async () => { try {
            try {
                await runCommandAsync([
                    "scp",
                    `${config.localPath}/${config.fileName}`,
                    `${config.remoteHost}:${config.remotePath}/${localDir}/`
                ]);
            } catch (e) {
                global.logError(e);
                await Main.notify(`${localDir} - failed to upload`);
                return;
            }
            await Main.notify(`${localDir} uploaded`);
        } catch (e) { global.logError(e); } });
        return item;
    },

    _createDownloadRemoteMenuItem: function(otherDirs) {
        return otherDirs.map((dirName) => {
            let item = new PopupMenu.PopupMenuItem(`Download ${dirName}`);
            item.connect('activate', async () => { try {
                try {
                    await runCommandAsync([
                        "scp",
                        `${config.remoteHost}:${config.remotePath}/${dirName}/${config.fileName}`,
                        `${config.localPath}/${dirName}.${config.extension}`
                    ]);
                } catch (e) {
                    global.logError(e);
                    await Main.notify(`${dirName} - failed to download`);
                    return;
                }
                await Main.notify(`${dirName} downloaded`)
            } catch (e) { global.logError(e); } });
            return item;
        });
    },

    _checkStatus: async function(dirs) {
        const localDirSynced = await this._isLocalDirSynced(dirs.localDir)
        const backupOfLocalTs = await this._getLastPasswordsModifyTs(dirs.localDir)
        const otherDirsGood = await Promise.all(dirs.otherDirs.map(async (dir) => {
            const modifyTs = await this._getLastPasswordsModifyTs(dir);
            return [dir, backupOfLocalTs > modifyTs];
        }));
        return {
            "localDirSynced": localDirSynced,
            "otherDirs": Object.fromEntries(otherDirsGood)
        }
    },

    _isLocalDirSynced: async function(localDir) {
        const localSha = await runShellAsync(`shasum "${config.localPath}/${config.fileName}" | awk '{print $1}'`);
        const remoteSha = await runSshAsync(`shasum "${config.remotePath}/${localDir}/${config.fileName}" | awk '{print $1}'`);
        return localSha == remoteSha
    },

    _getLastPasswordsModifyTs: async function(dir) {
        return Number(await runSshAsync(`stat -c '%Y' ${config.remotePath}/${dir}/${config.fileName}`));
    },

    _fail: function(msg) {
        const decoratedMessage = "[FATAL ERROR]: " + msg;
        global.logError(decoratedMessage);
        this.set_applet_icon_symbolic_name("ksa-fatal");
        this.set_applet_tooltip(_(decoratedMessage));
        throw Error(decoratedMessage)
    }

};

async function runShellAsync(shCmd) {
    return await runCommandAsync(["sh", "-c", shCmd]);
}

async function runSshAsync(sshCmd) {
    return await runCommandAsync(["ssh", config.remoteHost, "LC_ALL=C " + sshCmd]);
}

async function runCommandAsync(argv) {
    return new Promise((resolve, reject) => {
        try {
            let proc = new Gio.Subprocess({
                argv: argv,
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });
            proc.init(null);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (stderr) {
                        global.logError("runCommandAsync - command failed: " + stderr);
                        reject(stderr);
                    } else {
                        resolve(stdout);
                    }
                } catch (e) {
                    global.logError(e);
                    reject(e);
                }
            });
        } catch (e) {
            global.logError(e);
            reject(e);
        }
    });
}

function partitionSingle(arr, predicate) {
  return arr.reduce(
    ([pass, fail], item) =>
      predicate(item) ? [item, fail] : [pass, [...fail, item]],
    [null, []]
  );
}

function dbg(msg) {
    global.log("[!!!!!!!]" + msg)
    global.log(msg)
}