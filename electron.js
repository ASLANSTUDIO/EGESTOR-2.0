const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        icon: path.join(__dirname, 'favicon.svg'),
        webPreferences: {
            nodeIntegration: false
        },
        titleBarStyle: 'default',
        backgroundColor: '#0a1628'
    });

    win.loadFile('index.html');

    // Remove menu bar for cleaner look
    Menu.setApplicationMenu(null);

    win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (win === null) createWindow();
});
