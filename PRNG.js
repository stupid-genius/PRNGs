const biMath = require('BigIntMath');
const {
	generateLCGParams,
	lcg,
	range
} = require('./lcg');

function integer(){
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

function PRNG(){
	if(!new.target){
		return new PRNG(...arguments);
	}
	if(PRNG.instance !== undefined){
		return PRNG.instance;
	}
	Object.defineProperty(PRNG, 'instance', {value: this});

	// const [a, c, m] = generateLCGParams(range(100, 1000), Number.THIRTY_TWO_BIT_MAX);
	// const [a, c, m] = generateLCGParams(123, 2 ** 16);
	// lcg('random', a, c, m, range(1, m));
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
			value: integer
		},
		gaussian: {
			value: gaussian
		},
		lcg: {
			value: lcg
		},
		range: {
			value: range
		}
	});
}

module.exports = {
	integer,
	gaussian,
	generateLCGParams,
	lcg,
	normal: gaussian.random,
	range,
	seeded: lcg.random,
	PRNG: PRNG()
};
