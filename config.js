const fs = require("fs");
const procArgs = require("minimist")( process.argv.slice(2), {
    default: {
        serialAdress: "/dev/ttyUSB0",
        secret: "?Hji6|48H*AOnID%YK1r@WDgRYTFIyzTkThx6UApx|8?*Lr6y}oeST}6%$8~g%ia",
        WSSUrl: "wss://rapidfarm2team.herokuapp.com/",
        name: "Silver Farm",
        configFileName: "localFarmConfig.json"
    },
    alias: {
        a: "serialAdress",
        u: "WSSUrl",
        s: "secret",
        n: "name",
        c: "configFileName"
    }
});
exports.portName = process.env.SERIAL_PORT_ADRESS || procArgs.serialAdress;
exports.WSSUrl   = process.env.WSS_URL            || procArgs.WSSUrl;
exports.secret   = process.env.FARM_SECRET        || procArgs.secret;
exports.name     = process.env.NAME               || procArgs.name;

const configFileName = process.env.CONFIG_FILE_NAME || procArgs.configFileName;
let isFileLocked = false;
const waitForUnlockingFile = cb => {
    const interval = setInterval( () => {
        if ( !isFileLocked ) {
            isFileLocked = true;
            cb();
            clearInterval( interval );
        }
    }, 3000 );
};

let config = JSON.parse( fs.readFileSync( configFileName, "utf8" ) );
function setConfig( callback ) {
    // TODO: Добавить также сюда работу с серверным конфигом, подгрузкой и обновлением его
    // TODO: Добавить работу с файловой системой и сохранением конфига в json файл
    config = callback( config );
    waitForUnlockingFile( () => {
        fs.writeFile( configFileName, JSON.stringify( config ), error => {
            if( error ) console.log( error );
            isFileLocked = false;
        } )
    } );

}
function getConfig() {
    return config;
}

exports.config = config;
exports.setConfig = setConfig;
exports.getConfig = getConfig;
