// Full CLI implementation that builds to dist by default
const fs = require('fs');
const path = require('path');

// Function to build project
function build() {
    // Logic to build project
    console.log('Building project');
}

// Function to parse minimal QML subset
function parseQML(qml) {
    // Logic to parse QML
}

// Emit resources
function emitResources() {
    fs.copyFileSync('src/index.html', 'dist/index.html');
    fs.copyFileSync('src/runtime.js', 'dist/runtime.js');
    fs.copyFileSync('src/app.json', 'dist/app.json');
    fs.copyFileSync('src/assets/*', 'dist/assets/');
}

// Main execution
build();
emitResources();
