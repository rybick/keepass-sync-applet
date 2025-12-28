const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

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
        this.menu = createMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
    },

    on_applet_clicked: function() {
        global.log("Applet clicked");
        this.menu.toggle();
    }
};

function createMenu(launcher, orientation) {
    let menu = new Applet.AppletPopupMenu(launcher, orientation);
    let item1 = new PopupMenu.PopupMenuItem("Option #1");
    item1.connect('activate', () => {
        //Util.spawnCommandLine('xkill');
    });
    menu.addMenuItem(item1);

    let item2 = new PopupMenu.PopupMenuItem("Option #2");
    item2.connect('activate', () => {
        //global.log("Settings clicked!");
    });
    menu.addMenuItem(item2);

    return menu;
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}

