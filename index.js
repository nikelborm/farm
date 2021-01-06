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
try {
    var result = require("child_process").execSync( "git pull", { cwd: "/home/ubuntu/farm" } ).toString();
    console.log( "git pull: ", result );
} catch( err ) {
    console.log( "err.output.toString(): ", err.output.toString() );
    console.log( "err.stderr.toString(): ", err.stderr.toString() );
    console.log( "err.stdout.toString(): ", err.stdout.toString() );
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
    console.log( "sendCmdToFarmForSetProcState send to port:", ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    console.log("proc: ", proc);
    if (!proc?.long) console.log("proc: ", proc);
    port.write( ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    console.log( "sendCmdToFarmForSetProcState finished" );
    console.log();
}

function requestSensorValue( sensor ) {
    console.log( "requestSensorValue: ", "g" + sensor.short );
    console.log('sensor: ', sensor);
    port.write( "g" + sensor.short );
    console.log( "requestSensorValue finished" );
    console.log();
}

function sendToWSServer( data ) {
    console.log( "sendToWSServer: ", data );
    if ( connection.readyState === connection.OPEN ) connection.send( JSON.stringify( data ) );
    else console.log( "connection.readyState: ", connection.readyState );
    console.log( "sendToWSServer finished" );
}

function serialLineHandler( line ) {
    console.log( "serialLineHandler got: ", line );
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
    console.log( "serialLineHandler finished" );
}

function protectCallback( unsafeCallback ) {
    console.log("protectCallback started");
    return function() {
        console.log("protectCallback function started");
        console.log( "call: ", unsafeCallback.name, ", when: ", Date() );
        console.log('isPortSendedReady: ', isPortSendedReady);
        console.log('port.isOpen: ', port.isOpen);
        console.log('arguments: ', [...arguments]);
        if( port.isOpen && isPortSendedReady ) unsafeCallback( ...arguments );
        else console.log( "was unsuccesful, because port closed or not send ready yet" );
        console.log("protectCallback function finished");
        console.log();
    };
}

async function portSafeRepeater( unsafeCB, milliseconds, ...args ) {
    console.log("portSafeRepeater started ");
    console.log('args: ', args);
    console.log('milliseconds: ', milliseconds);
    console.log('unsafeCB: ', unsafeCB);
    console.log('unsafeCB.name: ', unsafeCB.name);
    const safeCallback = () => protectCallback( unsafeCB )( ...args );
    console.log('safeCallback: ', safeCallback);
    try {
        await( new Promise( function ( resolve, reject ) {
            console.log('Promise initialized portSafeRepeater on', unsafeCB.name);
            const timer = setTimeout( () => {
                console.log('rejected portSafeRepeater on', unsafeCB.name);
                reject();
            }, 60000 );
            console.log("TimeOut setted");
            const interval = setInterval( () => {
                console.log('setInterval portSafeRepeater on', unsafeCB.name);
                if ( isPortSendedReady ) {
                    console.log('resolved portSafeRepeater on', unsafeCB.name);
                    clearTimeout( timer );
                    clearInterval( interval );
                    console.log('cleared Interval portSafeRepeater on', unsafeCB.name);
                    resolve();
                }
            }, 3000 );
            console.log('Promise finished portSafeRepeater on', unsafeCB.name);
        } ) );
        console.log("Promise competed");
        safeCallback();
        console.log("callback executed");
        repeaterList.push(
            setInterval(
                safeCallback,
                milliseconds
            )
        );
        console.log("try ended");
    } catch ( error ) {
        console.log( "error: ", error );
        shutdown();
        console.log("catch ended");
    }
    console.log("try catch ended");
}

function updateProcessState( proc ) {
    console.log('updateProcessState started ');
    sendCmdToFarmForSetProcState( proc );
    if( processesStates[ proc.long ] === shouldProcessBeActive( proc ) ) return;
    console.log('shouldProcessBeActive( proc ): ', shouldProcessBeActive( proc ));
    console.log('processesStates[ proc.long ]: ', processesStates[ proc.long ]);
    processesStates[ proc.long ] = shouldProcessBeActive( proc );
    sendToWSServer( {
        class: "event",
        process: proc.long,
        isActive: processesStates[ proc.long ]
    } );
    console.log('updateProcessState finished ');
}

function onSuccessAuth() {
    console.log('onSuccessAuth started ');
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
    console.log('onSuccessAuth finished ');
}

function waitForAuthHandler( input ) {
    console.log( "waitForAuthHandler started" );
    const data = prepare( input );
    console.log('data: ', data);
    if( data.class !== "loginAsFarm" || data.report.isError ) return;
    console.log("if not returned");
    onSuccessAuth();
    console.log( "waitForAuthHandler finished" );
}

function afterAuthHandler( input ) {
    console.log( "afterAuthHandler started" );
    const data = prepare( input );
    switch ( data.class ) {
        case "set":
            switch ( data.what ) {
                case "timings":
                    setConfig( prevConfig => {
                        for ( const proc of prevConfig.processes ) {
                            if ( proc.long === data.process ) {
                                proc.timings = data.timings;
                                // TODO: updateLocalFarmConfigFile();
                                break;
                            }
                        }
                        return prevConfig;
                    } );
                    break;
                case "config":
                    setConfig( () => data.config );
                    // TODO: updateLocalFarmConfigFile();
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
                case "updateArduino":
                    // TODO: updateArduino();
                    break;
            }
            break;
        default:
            break;
    }
    console.log( "afterAuthHandler finished" );
}

connection.addListener( "open", () => {
    console.log( "Connection opened " );
    sendToWSServer( {
        class: "loginAsFarm",
        secret,
        name
    } );
} );

port.addListener( "open", () => {
    console.log( "Port opened" );
} );

readyParser.addListener( "ready", () => {
    console.log("readyParser got: ready ");
    port.pipe( readlineParser );
    isPortSendedReady = true;
    port.unpipe( readyParser );
} );

readlineParser.addListener( "data", serialLineHandler );

connection.addListener( "message", waitForAuthHandler );

connection.addListener( "error", wsError => {
    console.log( "WebSocket error: " );
    port.close( portError => {
        if ( portError ) console.log( portError );
        throw wsError;
    });
} );

port.addListener( "error", error => {
    console.log( "Error on port: " );
    console.log("shutdown date:", new Date());
    throw error;
} );

connection.addListener( "close", ( code, msg ) => {
    console.log( "WebSocket closed: ", code, msg );
    port.close( portError => {
        if ( portError ) throw portError;
        process.exit( ~~(msg !== "shutdown farm") );
    });
} );

port.addListener( "close", () => {
    console.log( "Port closed" );
    connection.close( 1000, "Port closed");
} );

function shutdown() {
    console.log("Exiting...\n\nClosing Serial port...");
    port.close(err => {
        if (err) throw err;
        console.log("Serial port closed.\n\nClosing Websocket connection...");
        connection.close( 1000, "shutdown farm");
        repeaterList.forEach( v => clearInterval( v ) );
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
