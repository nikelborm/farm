// https://www.npmjs.com/package/raspi-serial
// https://www.npmjs.com/package/serialport
// https://www.npmjs.com/package/raspi
// const ByteLength = require("@serialport/parser-byte-length")
// const parser = port.pipe(new ByteLength({length: 8}))
// const Delimiter = require("@serialport/parser-delimiter")
// const parser = port.pipe(new Delimiter({ delimiter: "\n" }))
// const InterByteTimeout = require("@serialport/parser-inter-byte-timeout")
// const parser = port.pipe(new InterByteTimeout({interval: 30}))
// defaults for Arduino serial communication
// {
    // baudRate: 115200,
    // dataBits: 8,
    // parity: "none",
    // stopBits: 1,
    // xoff:true // flowControl: false
// }
function log( ...args ) {
    if( args.length ) {
        console.log( Date() + " - ", ...args );
    } else {
        console.log();
    }
}
function initializeUpdatechecker() {
    repeaterList.push( setInterval( () => {
        
    }, 20000));
}

const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");
const Ready = require("@serialport/parser-ready");
const WebSocket = require("ws");

const { prepare } = require("./tools/prepare");
const { shouldProcessBeActive } = require("./tools/shouldProcessBeActive");
const { createProcessesStatesPackage } = require("./tools/createProcessesStatesPackage");

// TODO: Вообще конфиг должен по факту с сервера прилетать, но это типа такая локальная базовая копия конфига
const {
    getConfig,
    setConfig,
    portName,
    WSSUrl,
    secret,
    name
} = require("./config");

let isPortSendedReady = false;
// @ts-ignore
let processesStates = Object.fromEntries(
    getConfig().processes.map(
        proc => [ proc.long, false ]
    )
);

const connection = new WebSocket( WSSUrl );
const port = new SerialPort(portName, {
    baudRate: 115200,
    // dataBits: 8,
    // parity: "none",
    // stopBits: 1,
    // xoff:true // flowControl: false
});
const readlineParser = new Readline({ delimiter: "\r\n" });
const readyParser = new Ready({ delimiter: "ready" });
const repeaterList = [];
port.pipe( readyParser );

function sendCmdToFarmForSetProcState( proc ) {
    log( "sendCmdToFarmForSetProcState send to port:", ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    port.write( ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    log( "sendCmdToFarmForSetProcState finished" );
    log();
}

function requestSensorValue( sensor ) {
    log( "requestSensorValue: ", "g" + sensor.short );
    port.write( "g" + sensor.short );
    log( "requestSensorValue finished" );
    log();
}

function sendToWSServer( data ) {
    log( "sendToWSServer: ", data );
    if ( connection.readyState === connection.OPEN ) connection.send( JSON.stringify( data ) );
    else log( "connection.readyState: ", connection.readyState );
    log( "sendToWSServer finished" );
}

function serialLineHandler( line ) {
    log( "serialLineHandler got: ", line );
    const { sensor, value } = JSON.parse( line );
    // Пока ферма присылает нам только показания с датчиков
    // Но возможно потом ещё что-то добавим
    if( false /* Выходит за рамки? */ ) {
        // отправить criticalevent если выходит за рамки
    } else {
        sendToWSServer( {
            class: "records",
            sensor,
            value
        } );
    }
    log( "serialLineHandler finished" );
}

function protectCallback( unsafeCallback ) {
    log("protectCallback started");
    return function() {
        log("protectCallback function started");
        log( "call: ", unsafeCallback.name, ", when: ", Date() );
        log("isPortSendedReady: ", isPortSendedReady);
        log("port.isOpen: ", port.isOpen);
        log("arguments: ", [...arguments]);
        if( port.isOpen && isPortSendedReady ) unsafeCallback( ...arguments );
        else log( "was unsuccesful, because port closed or not send ready yet" );
        log("protectCallback function finished");
        log();
    };
}

async function portSafeRepeater( unsafeCB, milliseconds, ...args ) {
    log("portSafeRepeater started ");
    log("args: ", args);
    log("milliseconds: ", milliseconds);
    log("unsafeCB: ", unsafeCB);
    log("unsafeCB.name: ", unsafeCB.name);
    const safeCallback = () => protectCallback( unsafeCB )( ...args );
    log("safeCallback: ", safeCallback);
    try {
        await( new Promise( function ( resolve, reject ) {
            log("Promise initialized portSafeRepeater on", unsafeCB.name);
            const timer = setTimeout( () => {
                log("rejected portSafeRepeater on", unsafeCB.name);
                reject();
            }, 60000 );
            log("TimeOut setted");
            const interval = setInterval( () => {
                log("setInterval portSafeRepeater on", unsafeCB.name);
                if ( isPortSendedReady ) {
                    log("resolved portSafeRepeater on", unsafeCB.name);
                    clearTimeout( timer );
                    clearInterval( interval );
                    log("cleared Interval portSafeRepeater on", unsafeCB.name);
                    resolve();
                }
            }, 3000 );
            log("Promise finished portSafeRepeater on", unsafeCB.name);
        } ) );
        log("Promise competed");
        safeCallback();
        log("callback executed");
        repeaterList.push(
            setInterval(
                safeCallback,
                milliseconds
            )
        );
        log("try ended");
    } catch ( error ) {
        log( "error: ", error );
        shutdown();
        log("catch ended");
    }
    log("try catch ended");
}

function updateProcessState( proc ) {
    log("updateProcessState started ");
    sendCmdToFarmForSetProcState( proc );
    if( processesStates[ proc.long ] === shouldProcessBeActive( proc ) ) return;
    log("shouldProcessBeActive( proc ): ", shouldProcessBeActive( proc ));
    log("processesStates[ proc.long ]: ", processesStates[ proc.long ]);
    processesStates[ proc.long ] = shouldProcessBeActive( proc );
    sendToWSServer( {
        class: "event",
        process: proc.long,
        isActive: processesStates[ proc.long ]
    } );
    log("updateProcessState finished ");
}

function onSuccessAuth() {
    log("onSuccessAuth started ");
    processesStates = createProcessesStatesPackage( getConfig().processes );
    sendToWSServer( {
        class: "activitySyncPackage",
        package: processesStates
    } );
    sendToWSServer( {
        class: "configPackage",
        package: getConfig()
    } );
    for( const proc of getConfig().processes ) {
        if( !proc.isAvailable ) continue;
        portSafeRepeater( updateProcessState, 5000, proc );
    }
    for( const sensor of getConfig().sensors ) {
        if( !sensor.isConnected ) continue;
        portSafeRepeater( requestSensorValue, 900000, sensor );
    }
    connection.removeListener( "message", waitForAuthHandler );
    connection.addListener( "message", afterAuthHandler );
    log("onSuccessAuth finished ");
}

function waitForAuthHandler( input ) {
    log( "waitForAuthHandler started" );
    const data = prepare( input );
    log("data: ", data);
    if( data.class !== "loginAsFarm" || data.report.isError ) return;
    log("if not returned");
    onSuccessAuth();
    log( "waitForAuthHandler finished" );
}

function afterAuthHandler( input ) {
    log( "afterAuthHandler started" );
    const data = prepare( input );
    switch ( data.class ) {
        case "set":
            switch ( data.what ) {
                case "timings":
                    setConfig( prevConfig => {
                        for ( const proc of prevConfig.processes ) {
                            if ( proc.long === data.process ) {
                                proc.timings = data.timings;
                                break;
                            }
                        }
                        return prevConfig;
                    } );
                    break;
                case "criticalBorders":
                    setConfig( prevConfig => {
                        for ( const sensor of prevConfig.sensors ) {
                            if ( sensor.long === data.sensor ) {
                                sensor.criticalBorders = data.criticalBorders;
                                break;
                            }
                        }
                        return prevConfig;
                    } );
                    break;
                case "config":
                    setConfig( () => data.config );
                    break;
            }
            break;
        case "get":
            switch ( data.what ) {
                case "activitySyncPackage":
                    sendToWSServer( {
                        class: "activitySyncPackage",
                        package: processesStates
                    } );
                    break;
                case "configPackage":
                    sendToWSServer( {
                        class: "configPackage",
                        package: getConfig()
                    } );
                    break;
            }
            break;
        case "execute":
            switch ( data.what ) {
                case "shutDownFarm":
                    // TODO: shutDownFarm();
                    break;
                case "update":
                    if(connection.readyState === connection.OPEN) {
                        log('update check started ');
                        var result = require("child_process").exec( "git pull", { cwd: "/home/ubuntu/farm" }, (error, stderr,stdout) => {
                            log( "err: ", error );
                            log( "err.stderr.toString(): ", stderr.toString() );
                            log( "err.stdout.toString(): ", stdout.toString() );
                            log('update check finished ');
                            sendToWSServer({
                                class: "updateReply",
                                error: error.message,
                                stderr: stderr.toString(),
                                stdout: stdout.toString()
                            });
                        } );
                    } else {
                        log('update check failed connection.readyState: ', connection.readyState, 'connection.OPEN: ', connection.OPEN);
                    }
                    break;
                case "updateArduino":
                    // TODO: updateArduino();
                    break;
            }
            break;
        default:
            break;
    }
    log( "afterAuthHandler finished" );
}

connection.addListener( "open", () => {
    log( "Connection opened " );
    initializeUpdatechecker();
    sendToWSServer( {
        class: "loginAsFarm",
        secret,
        name
    } );
} );

port.addListener( "open", () => {
    log( "Port opened" );
} );

readyParser.addListener( "ready", () => {
    log("readyParser got: ready ");
    port.pipe( readlineParser );
    isPortSendedReady = true;
    port.unpipe( readyParser );
} );

readlineParser.addListener( "data", serialLineHandler );

connection.addListener( "message", waitForAuthHandler );

connection.addListener( "error", wsError => {
    log( "WebSocket error: " );
    port.close( portError => {
        if ( portError ) log( portError );
        throw wsError;
    });
} );

port.addListener( "error", error => {
    log( "Error on port: " );
    log("shutdown date:", new Date());
    throw error;
} );

connection.addListener( "close", ( code, msg ) => {
    log( "WebSocket closed: ", code, msg );
    port.close( portError => {
        if ( portError ) throw portError;
        process.exit( ~~(msg !== "shutdown farm") );
    });
} );

port.addListener( "close", () => {
    log( "Port closed" );
    connection.close( 1000, "Port closed");
} );

function shutdown() {
    log("Exiting...\n\nClosing Serial port...");
    port.close(err => {
        if (err) throw err;
        log("Serial port closed.\n\nClosing Websocket connection...");
        connection.close( 1000, "shutdown farm");
        repeaterList.forEach( v => clearInterval( v ) );
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
