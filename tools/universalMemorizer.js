function universalMemorizer( func )
{
    const cache = new Map();
    return arg =>
    {
        if ( cache.has( arg ) ) return cache.get( arg );
        const result = func( arg );
        cache.set( arg, result );
        return result;
    };
}
exports.universalMemorizer = universalMemorizer;
