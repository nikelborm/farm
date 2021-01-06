const procArgs = require("minimist")( process.argv.slice(2), {
    default: {
        serialAdress: "/dev/ttyUSB0",
        secret: "?Hji6|48H*AOnID%YK1r@WDgRYTFIyzTkThx6UApx|8?*Lr6y}oeST}6%$8~g%ia",
        WSSUrl: "wss://rapidfarm2team.herokuapp.com/",
        name: "Silver Farm"
    },
    alias: {
        a: "serialAdress",
        u: "WSSUrl",
        s: "secret",
        n: "name"
    }
});
exports.portName = process.env.SERIAL_PORT_ADRESS || procArgs.serialAdress;
exports.WSSUrl   = process.env.WSS_URL            || procArgs.WSSUrl;
exports.secret   = process.env.FARM_SECRET        || procArgs.secret;
exports.name     = process.env.NAME               || procArgs.name;

let config = {
    processes: [
        {
            short: "ww",
            long: "watering",
            title: "Поливной насос",
            isAvailable: true,
            timings: [
                [[7], [7, 15]],
                [[9, 15], [9, 30]],
                [[11, 30], [11, 45]],
                [[13, 45], [14]],
                [[16], [16, 15]],
                [[18, 15], [18, 30]],
                [[20, 30], [20, 45]],
                [[22, 45], [23]],
            ]
        },
        {
            short: "ll",
            long: "lighting",
            title: "Освещение",
            isAvailable: true,
            timings: [
                [[7], [23]],
            ]
        },
        {
            short: "oo",
            long: "oxidation",
            title: "Аэрация раствора",
            isAvailable: true,
            timings: [
                [[6,45], [7, 15]],
                [[9], [9, 30]],
                [[11, 15], [11, 45]],
                [[13, 30], [14]],
                [[15,45], [16, 15]],
                [[18], [18, 30]],
                [[20, 15], [20, 45]],
                [[22, 30], [23]],
            ]
        },
        {
            short: "gh",
            long: "groundHeating",
            title: "Подогрев почвы",
            isAvailable: false,
            timings: []
        },
        {
            short: "wh",
            long: "waterHeating",
            title: "Подогрев раствора",
            isAvailable: false,
            timings: []
        },
        {
            short: "ah",
            long: "airHeating",
            title: "Подогрев воздуха",
            isAvailable: false,
            timings: []
        },
    ],
    sensors: [
        {
            short: "gt",
            long: "groundTemperature",
            title: "Температура почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "wt",
            long: "waterTemperature",
            title: "Температура воды",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "at",
            long: "airTemperature",
            title: "Температура воздуха",
            isConnected: true,
            criticalBorders: {
                lower: 10,
                upper: 30,
            }
        },
        {
            short: "gh",
            long: "groundHumidity",
            title: "Влажность почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "ah",
            long: "airHumidity",
            title: "Влажность воздуха",
            isConnected: true,
            criticalBorders: {
                lower: 12,
                upper: 1000,
            }
        },
        {
            short: "go",
            long: "groundOxidation",
            title: "Кислотность почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "wo",
            long: "waterOxidation",
            title: "Кислотность воды",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "gs",
            long: "groundSalt",
            title: "Солёность почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "ws",
            long: "waterSalt",
            title: "Солёность воды",
            isConnected: false,
            criticalBorders: {}
        }
    ]
};
function setConfig( callback ) {
    // TODO: Добавить также сюда работу с серверным конфигом, подгрузкой и обновлением его
    // TODO: Добавить работу с файловой системой и сохранением конфига в json файл
    config = callback( config );
}
function getConfig() {
    return config;
}

exports.config = config;
exports.setConfig = setConfig;
exports.getConfig = getConfig;
