/**
 * @name Grids
 * @description Adjust users volume and panning by dragging them around a 2D room, rather than through typical sliders.
 * @version 1.0.0
 * @author nnexsus
 * @authorId 266593763781115904
 * @authorLink https://nnexsus.net
 * @website https://nnexsus.net
 */
/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/

const config = {
    main: "index.js",
    id: "gridsaudio",
    name: "Grids",
    author: "nnexsus",
    authorId: "266593763781115904",
    authorLink: "https://nnexsus.net",
    version: "1.0.0",
    description: "Adjust users volume and panning by dragging them around a 2D room, rather than through typical sliders.",
    website: "https://nnexsus.net",
    source: "",
    patreon: "",
    donate: "",
    invite: "",
    changelog: [],
    defaultConfig: [
        {
            type: "category",
            id: "global",
            name: "Global Settings",
            collapsible: true,
            shown: false,
            settings: [
                {
                    type: "switch",
                    id: "panning",
                    name: "Disable panning.",
                    note: "Disables panning from the grid. The horizontal axis will instead be free area to move people around in.",
                    value: false
                },
                {
                    type: "value",
                    id: "max_connected",
                    name: "Maximum Users",
                    note: "Sets the maximum amount of users until the grid disables. (This is useful in community servers, or generally any call with over 12 or so people, as the grid gets crowded).",
                    value: 12
                }
            ]
        }
    ],
};
class Dummy {
    constructor() {this._config = config;}
    start() {}
    stop() {}
}
 
if (!global.ZeresPluginLibrary) {
    BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.name ?? config.info.name} is missing. Please click Download Now to install it.`, {
        confirmText: "Download Now",
        cancelText: "Cancel",
        onConfirm: () => {
            require("request").get("https://betterdiscord.app/gh-redirect?id=9", async (err, resp, body) => {
                if (err) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                if (resp.statusCode === 302) {
                    require("request").get(resp.headers.location, async (error, response, content) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, r));
                    });
                }
                else {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                }
            });
        }
    });
}

const gridCss = `
.grid-room-div {
    width: 100%;
    aspect-ratio: 1/1;
    margin: 5px 0px;
    background-image: radial-gradient(circle, #000000 2px, rgba(0, 0, 0, 0) 1px);
    background-size: 9px 9px;
    border: solid white 1px;
    border-radius: 8px;
    backdrop-filter: brightness(6.5);
    cursor: pointer;
}

.userava {
    border-radius: 50%;
    border-style: solid;
    background: black;
    width: 32px;
    height: 32px;
    position: absolute;
    cursor: grab;
    box-shadow: black 0 0 3px 0px;
    transition: 0.2s ease;
}

.userava:hover {
    scale: 1.1;
    brightness: 1.1;
    box-shadow: black 0 0 5px 2px;
}

.userava:active {
    cursor: grabbing;
    animation: grabhold 2s linear ease forwards;
}

@keyframes grabhold {
    0% {
        scale: 1.2;
    } 50% {
        scale: 0.9;
    } 100% {
        scale: 1.2;
    }
}
`;
 
module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
    const plugin = (Plugin, Library) => {

    const { DiscordConstants, Utilities } = Api;

    const { DiscordModules, Patcher, WebpackModules, PluginUtilities, Settings, PluginUpdater, DOMTools } = Library;

    const { React, UserStore, MediaInfo, ReactDOM, SelectedChannelStore } = DiscordModules;

    const VoiceUser = WebpackModules.getByPrototypes("renderName");
    const VoiceChannelStore = WebpackModules.getByProps("getVoiceStatesForChannel");
    const AudioControls = WebpackModules.getByProps(["setLocalVolume"])

    const localUser = UserStore.getCurrentUser()

    return class extends Plugin {

        onStart() {
            try {
                DOMTools.addStyle('grid-room-div', gridCss)
            } catch {
                console.error('Could not add css!')
            }

            this.patchJoinCall()
            this.startGrid(); //draws the grid
            this.patchVoiceUser(); //inits the listener to add people to le gride
        }

        patchJoinCall() {
            Patcher.after(VoiceChannelStore, "isCurrentClientInVoiceChannel", (_, [props], ret) => {
                if(document.querySelector('.grid-room-div') === null) this.startGrid();
            });
        }

        patchVoiceUser() { 
            Patcher.after(VoiceUser.prototype, "renderName", (thisObject, _, returnValue) => {
                if (document.querySelector('.grid-room-div') === null) this.startGrid();
                thisObject.props?.speaking ? document.getElementById(`${thisObject.props?.user?.id}`).style.borderColor = 'green' 
                : thisObject.props?.mute ? document.getElementById(`${thisObject.props?.user?.id}`).style.borderColor = 'red' :
                document.getElementById(`${thisObject.props?.user?.id}`).style.borderColor = 'white' 
                if(thisObject.props?.user?.id == localUser.id) return;
                this.updateGrid()
            });
        }

        updateGrid = () => {
            var userlist = VoiceChannelStore?.getVoiceStatesForChannel(SelectedChannelStore.getVoiceChannelId())
            if (userlist.length >= 12) return;
            document.getElementById("gridroomdiv").childNodes.forEach((li) => {
                li.firstChild.classList.remove('alive')
            })
            for(var key in userlist) {
                var user = userlist[key];
                if (user.userId == localUser.id) return;
                const gridContainer = document.querySelector('.grid-room-div')
                var pan = MediaInfo.getLocalPan(user.userId)
                var vol = MediaInfo.getLocalVolume(user.userId)
                if (document.getElementById(`${user.userId}`) !== null) {
                    const ava = document.getElementById(`${user.userId}`)
                    ava.style.top = `${vol}px`
                    ava.classList.add('alive')
                } else {
                    var quickdiv = document.createElement("div")
                    gridContainer ? (ReactDOM.render(this.renderButton(user, vol, pan, UserStore.getUser(user.userId).avatar), quickdiv)) : console.log('No active container. Skipping.')
                    gridContainer.appendChild(quickdiv)
                }
            }
            document.getElementById("gridroomdiv")?.childNodes?.forEach((li) => {
                if (!li?.firstChild?.classList.contains('alive')) {
                    li.remove()
                }
            })
        }

        renderButton = (user, uservol, userpan, avatar) => {
            return React.createElement("img", {
                width: "32",
                height: "32",
                src: `https://cdn.discordapp.com/avatars/${user.userId}/${avatar}.webp?size=32`,
                onClick: e => console.log(`Click: ${user.userId}`), //get user popout menu here
                onDrag: e => (this.setVolY(Math.min(200, Math.max(0, (e.pageY) - 570)), e.target.classList[0]), this.setPanX(e.pageX, user.userId), document.getElementById(`${user.userId}`).style.top = `${e.pageY - 580}px`, document.getElementById(`${user.userId}`).style.left = `${Math.max(0, e.pageX - 80)}px`),
                onDragStart: e => document.getElementById(`${user.userId}`).style.borderColor = 'orange',
                onDragEnd: e => document.getElementById(`${user.userId}`).style.borderColor = `${user.selfMute ||  user.mute ? 'red' : 'white'}`,
                draggable: true,
                id: `${user.userId}`,
                className: Utilities.className(`${user.userId}`, "userava", "alive"),
                style: {left: `${(userpan.right * 100)}px`, top: `${uservol}px`, borderColor: `${user.selfMute ||  user.mute ? 'red' : 'white'}`, borderType: 'solid', borderWidth: '2px'},
            });
        }

        renderGrid = () => {
            return React.createElement("div", {
                onClick: e => this.updateGrid(),
                onDragOver: e => (e.preventDefault(), e.stopPropagation()),
                onDrop: e => this.updateGrid(),
                className: Utilities.className("grid-room-div"),
                id: "gridroomdiv"
            });
        }

        renderAvatar = () => {
            return React.createElement("img", {
                onClick: e => this.resetAllUsers(),
                className: Utilities.className(`${localUser.id}`, "userava"),
                id: `${localUser.id}`,
                width: '50px',
                height: '50px',
                src: `https://cdn.discordapp.com/avatars/${localUser.id}/${localUser.avatar}.webp?size=32`,
                style: {left: "100px", top: "90%", cursor: "pointer", borderColor: "white", borderWidth: "2px", borderStyle: "solid"}
            });
        }

        startGrid = () => {
            var divtwo = document.createElement("div")
            var quickdiv = document.createElement("div")
            var gridContainer = document.querySelector('.container-1zzFcN') 
            gridContainer ? ReactDOM.render(this.renderGrid(), divtwo) : console.log('No active container. Skipping.')
            gridContainer ? ReactDOM.render(this.renderAvatar(), quickdiv) : console.log('No active container. Skipping')
            gridContainer.appendChild(divtwo)
            gridContainer.appendChild(quickdiv)
        }

        setVolY = (volume, id) => {
            AudioControls.setLocalVolume(id, parseFloat(volume))
        }

        setPanX = (pageX, id) => {
            var newpan = [Math.max(0, Math.min(1, (280 - pageX) / 100)), Math.max(0, Math.min(1, ((pageX - 80) / 100)))]
            AudioControls.setLocalPan(id, newpan[0], newpan[1])
        }

        resetAllUsers = () => {
            var userlist = VoiceChannelStore?.getVoiceStatesForChannel(SelectedChannelStore.getVoiceChannelId())
            for(var key in userlist) {
                var user = userlist[key];
                if (user.userId == localUser.id) return;
                AudioControls.setLocalVolume(user.userId, 100)
                AudioControls.setLocalPan(user.userId, 1, 1)
                if (document.getElementById(`${user.userId}`) !== null) {
                    const ava = document.getElementById(`${user.userId}`)
                    ava.style.top = `100px`
                    ava.classList.add('alive')
                    ava.style.left = `100px`
                }
            }
            this.updateGrid()
        }

        onStop() {
            DOMTools.removeStyle('grid-room-div');
            DOMTools.removeStyle('userava');
            Patcher.unpatchAll();
        }
    };

};
     return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
/*@end@*/