const biMath = require('BigIntMath');
const {
	generateLCGParams,
	lcg,
	range
} = require('./lcg');
const {
	mwc
} = require('./mwc');

function uniform(){
	return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function gaussian(name, mean, stdDev){
	Object.defineProperty(gaussian, name, {
		value: function(){
			let u1, u2;
			do{
				u1 = Math.random();
				u2 = Math.random();
			}while(u1 === 0); // Constrain u1 to (0,1]

			const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
			return parseFloat((mean + stdDev * z0).toFixed(2));
		}
	});
}

function PRNG(seed, mean=50, std=15){
	if(!new.target){
		return new PRNG(...arguments);
	}
	if(PRNG.instance !== undefined){
		return PRNG.instance;
	}
	Object.defineProperty(PRNG, 'instance', {value: this});

	// const [a, c, m] = generateLCGParams(range(100, 1000), Number.THIRTY_TWO_BIT_MAX);
	// const [a, c, m] = generateLCGParams(123, 2 ** 8);
	const [a, c, m] = [1664525, 1013904223, 2 ** 32 - 1];
	lcg('random', a, c, m, seed ?? range(1, m));
	// mwc('random', a, c, m, seed ?? range(1, m));
	mwc('random', 4294957665, 362436, 123456789);
	// mwc('random', 4294967291, c, m);
	// mwc('random', 0xFFFFDA61, c, m);
	gaussian('random', 50, 15);

	Object.defineProperties(this, {
		biRandom: {
			value: function(min, max){
				if(max < Number.MAX_SAFE_INTEGER){
					return biMath.random(min, max);
				}else{
					return biMath.random_bytes(min, max);
				}
			}
		},
		integer: {
			value: range
		},
		normal: {
			value: gaussian.random.bind(gaussian)
		},
		lcg: {
			value: lcg.random.bind(lcg)
		},
		mwc: {
			value: mwc.random.bind(mwc)
		},
		uniform: {
			value: uniform
		}
	});
}
const prng = PRNG();

module.exports = {
	gaussian,
	generateLCGParams,
	lcg,
	mwc,
	PRNG: prng
};
