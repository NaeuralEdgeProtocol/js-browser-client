export class Logger {
    log(message, context) {
        console.log({
            level: 'info',
            message,
            context,
        });
    }

    error(message, context) {
        this.log(message, context);
    }

    warn(message, context) {
        this.log(message, context);
    }
}

