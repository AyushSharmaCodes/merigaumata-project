let installed = false;

function wrapHandler(fn) {
    if (typeof fn !== 'function' || fn.__asyncErrorWrapped) {
        return fn;
    }

    function wrappedHandler(...args) {
        const next = args[args.length - 1];

        try {
            const result = fn.apply(this, args);

            if (result && typeof result.then === 'function') {
                result.catch(next);
            }

            return result;
        } catch (error) {
            return next(error);
        }
    }

    Object.defineProperty(wrappedHandler, 'length', { value: fn.length });
    wrappedHandler.__asyncErrorWrapped = true;
    wrappedHandler.__originalHandler = fn;

    return wrappedHandler;
}

function installExpressAsyncErrors() {
    if (installed) {
        return;
    }

    const Layer = require('express/lib/router/layer');
    const handleDescriptor = Object.getOwnPropertyDescriptor(Layer.prototype, 'handle');

    if (handleDescriptor && handleDescriptor.set && handleDescriptor.get) {
        installed = true;
        return;
    }

    Object.defineProperty(Layer.prototype, 'handle', {
        configurable: true,
        enumerable: true,
        get() {
            return this.__handle;
        },
        set(fn) {
            this.__handle = wrapHandler(fn);
        }
    });

    installed = true;
}

module.exports = {
    installExpressAsyncErrors
};
