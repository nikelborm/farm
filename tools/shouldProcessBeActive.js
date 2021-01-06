const { calcMSfrom00_00 } = require("./calcMSfrom00_00");
const { universalMemorizer } = require("./universalMemorizer");

const getMSfrom00_00 = universalMemorizer( calcMSfrom00_00 );
function shouldProcessBeActive(process)
{
    const msfrom00_00 = Date.now() - (new Date((new Date).toDateString())).getTime();
    for (const [beginning, end] of process.timings)
    {
        if ( getMSfrom00_00(beginning) <= msfrom00_00 && msfrom00_00 <= getMSfrom00_00(end)) return true;
    }
    return false;
}
exports.shouldProcessBeActive = shouldProcessBeActive;
