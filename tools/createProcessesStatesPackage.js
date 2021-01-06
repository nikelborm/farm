const { shouldProcessBeActive } = require("./shouldProcessBeActive");
function createProcessesStatesPackage( processes, base ) {
    let processStates = {};
    for ( const process of processes ) {
        if ( !process.isAvailable ) continue;
        processStates[ process.long ] = shouldProcessBeActive( process );
    }
    return processStates;
}
exports.createProcessesStatesPackage = createProcessesStatesPackage;
