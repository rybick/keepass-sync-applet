const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

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
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("ksa-low");
        this.set_applet_tooltip(_("Everything synced-up"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        const menu = await this._createMenuAsync(this, orientation);
        this.menuManager.addMenu(menu);
        this.menu = menu;
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    },

    _createMenuAsync: async function(launcher, orientation) {
        const stdout = await runCommandAsync(["ssh", config.remoteHost, `ls ${config.remotePath}`]);
        const dirs = stdout.split('\n').filter(dir => dir);
        const localName = config.localName
        const [localDir, otherDirs] = partitionSingle(dirs, dir => dir === config.localName)
        if (!localDir) {
            this._fail("localDir not present");
        }
        const menu = new Applet.AppletPopupMenu(launcher, orientation);
        [localDir].concat(otherDirs).forEach((dirName) => {
            let item = new PopupMenu.PopupMenuItem(dirName);
            item.connect('activate', () => {
                global.log(dirName + " clicked");
            });
            menu.addMenuItem(item);
        })
        return menu;
    },

    _checkStatus: async function(localDir, otherDirs) {

    },

    _isLocalDirSynced: async function(localDir) {

    },

    _fail: function(msg) {
        const decoratedMessage = "[FATAL ERRROR]: " + msg;
        global.logError(decoratedMessage);
        this.set_applet_icon_symbolic_name("ksa-fatal");
        this.set_applet_tooltip(_(decoratedMessage));
        throw Error(decoratedMessage)
    }
};

async function runCommandAsync(argv, callback) {
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
                        global.log("stderr: " + stderr);
                    }
                    resolve(stdout);
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