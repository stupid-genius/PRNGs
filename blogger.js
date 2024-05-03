const levels = ['noop', 'error', 'warn', 'info', 'debug', 'trace'];
// const dateFmt = {
// 	year: '2-digit',
// 	month: 'numeric',
// 	day: 'numeric',
// 	hour: '2-digit',
// 	minute: '2-digit',
// 	second: '2-digit',
// 	fractionalSecondDigits: 3
// };

/**
 * Represents a simple logger for use in a browser with different log levels and transport options.
 *
 * @param {string} filename - The filename or category for the logger.
 * @throws {Error} Throws an error if the filename is undefined.
 * @constructor
 */
export default function Logger(filename){
	if(filename === undefined){
		throw new Error('Logger requires the file name of where it\'s being used.');
	}
	if(!new.target){
		return new Logger(arguments);
	}

	/**
	 * Log a message with the specified log level.
	 *
	 * @param {string} level - The log level ('noop', 'error', 'warn', 'info', 'debug', 'trace').
	 * @param {string} msg - The main message to be logged.
	 * @param {...any} args - Additional arguments to be included in the log message.
	 */
	Object.defineProperties(this, {
		log: {
			value: function(level, msg, ...args){
				if(levels.indexOf(level) <= levels.indexOf(Logger.state.currentLevel)){
					Object.values(Logger.state.transports).forEach((transport) => {
						queueMicrotask(() => transport.log({
							level,
							msg,
							category: filename,
							args
						}));
					});
				}
			}
		}
	});
	levels.forEach((level) => {
		let logFn;
		if(level === 'noop'){
			logFn = () => {};
		}else{
			logFn = this.log.bind(this, level);
		}
		Object.defineProperty(this, level, {
			value: logFn
		});
	});
}

Object.defineProperties(Logger, {
	/**
	 * Add a new transport to the logger.
	 *
	 * @param {string} name - The name of the transport.
	 * @param {Object} newTransport - The transport object.
	 */
	addTransport: {
		value: (name, newTransport) => {
			Logger.state.transports[name] = newTransport;
		}
	},
	state: {
		value: {
			currentLevel: 'noop',
			transports: {}
		}
	},
	level: {
		get: () => Logger.state.currentLevel
	},
	/**
	 * Remove a transport from the logger.
	 *
	 * @function
	 * @name removeTransport
	 * @memberof Logger
	 * @param {string} transportToRemove - The name of the transport to be removed.
	 */
	removeTransport: {
		value: (transportToRemove) => {
			delete Logger.state.transports[transportToRemove];
		}
	},
	/**
	 * Set the log level for the logger.
	 *
	 * @function
	 * @name setLogLevel
	 * @memberof Logger
	 * @param {string} newLevel - The new log level to be set.
	 * @throws {Error} Throws an error if the provided log level is not valid.
	 */
	setLogLevel: {
		value: (newLevel) => {
			if(levels.some(level => level === newLevel)){
				Logger.state.currentLevel = newLevel;
			}else{
				throw new Error(`${newLevel} is not a valid logger level`);
			}
		}
	}
});
Logger.addTransport('default', ConsoleTransport());

levels.reduce((acc, cur) => {
	Object.defineProperty(acc, cur.toUpperCase(), {
		enumerable: true,
		get: () => cur
	});
	return acc;
}, Logger);

function ConsoleTransport(config){
	if(!new.target){
		return new ConsoleTransport(...arguments);
	}
	Object.defineProperty(this, 'log', {
		/**
		 * Log a message to the console with optional styling, grouping, or table formatting.
		 *
		 * @param {string} message - The main message to be logged.
		 * @param {Object} params - The parameters for logging.
		 * @param {string} [params.level='log'] - The log level ('log', 'warn', 'error', etc.).
		 * @param {string} [params.category] - The category or context of the log message (typically the filename).
		 * @param {boolean} [params.isTable=false] - Whether to format the log message as a table.
		 * @param {string} [params.group=null] - The console group method ('group', 'groupCollapsed', 'groupEnd').
		 * @param {string} [params.style=''] - The CSS style string for formatting the log message.
		 * @param {number} [params.timestamp] - The timestamp to include in the log message.
		 * @param {Array} [params.args=[]] - Additional arguments to be included in the log message.
		 *
		 * @example
		 * {
		 *   msg: 'Log message',
		 *   level: 'info',
		 *   category: 'file.js',
		 *   isTable: false,
		 *   group: 'group',
		 *   style: 'color: blue;',
		 *   timestamp: Date.now(),
		 *   args: [42, 'additional argument'],
		 * };
		 */
		value: function(params){
			const merged = Object.assign({}, config, params);
			if(merged.isTable){
				console.table(merged.msg);
			}else{
				if(merged.group){
					console[merged.group](merged.msg);
				}else{
					const consoleArgs = merged.style ? [merged.style, ...merged.args] : merged.args;
					console[merged.level](`${merged.style ? '%c' : ''}${merged.timestamp || new Date().toLocaleTimeString('en-US', merged.dateFmt)} [${merged.category}] ${merged.msg}`, ...consoleArgs);
				}
			}
		}
	});
}

/*
function FileTransport(){
	if(!new.target){
		return new FileTransport();
	}
	Object.defineProperty(this, {
		log: {
			value: function(){
			}
		}
	});
}

function APITransport(){
	if(!new.target){
		return new APITransport();
	}
	Object.defineProperty(this, {
		log: {
			value: function(){
			}
		}
	});
}
*/
