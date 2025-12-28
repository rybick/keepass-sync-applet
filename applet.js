const Applet = imports.ui.applet;
const Util = imports.misc.util;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_icon_name("force-exit");
        this.set_applet_tooltip(_("Click here to kill a window"));
    },

    on_applet_clicked: function() {
        global.log("Applet clicked");
        Util.trySpawnCommandLine('xed');
        //Util.trySpawnCommandLine('echo "x1" >> ~/doc/tmp/test.txt');
	    // Util.spawn(['xkill']);
        // alert('I was clicked');
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(orientation, panel_height, instance_id);
}

