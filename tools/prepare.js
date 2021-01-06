function prepare(input)
{
    console.log( "preparing ws input: ", input.toString());
    return JSON.parse(input.toString());
}
exports.prepare = prepare;
