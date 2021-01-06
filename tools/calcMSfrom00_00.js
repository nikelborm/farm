function calcMSfrom00_00([hours, minutes, seconds, milliseconds])
{
    return ((~~hours * 60 + ~~minutes) * 60 + ~~seconds) * 1000 + ~~milliseconds;
}
exports.calcMSfrom00_00 = calcMSfrom00_00;
