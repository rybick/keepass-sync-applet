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

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("ksa-neutral");
        this.set_applet_tooltip(_("Everything synced-up"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        createMenuAsync(this, orientation, (menu) => {
            this.menuManager.addMenu(menu);
            this.menu = menu;
        });
    },

    on_applet_clicked: function() {
        this.menu.toggle();
    }
};

function createMenuAsync(launcher, orientation, callback) {
    runCommandAsync(["ssh", config.sshHost, `ls ${config.path}`], (stdout) => {
        let dirs = stdout.split('\n').filter(dir => dir);
        let menu = new Applet.AppletPopupMenu(launcher, orientation);
        dirs.forEach((dirName) => {
            let item = new PopupMenu.PopupMenuItem(dirName);
            item.connect('activate', () => {
                global.log(dirName + " clicked");
            });
            menu.addMenuItem(item);
        })
        callback(menu);
    });
}

function runCommandAsync(argv, callback) {
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
                callback(stdout);
            } catch (e) {
                global.logError(e);
            }
        });
    } catch (e) {
        global.logError(e);
    }
}

function loadConfig() {
    const appletDir = imports.ui.appletManager.appletMeta[appletId].path;
    let file = Gio.File.new_for_path(`${appletDir}/config.json`);
    let [, contents] = file.load_contents(null);
    let str = new TextDecoder("utf-8").decode(contents);
    return JSON.parse(str);
}

