const biMath = require('BigIntMath');

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

function xgcd(a, b){
	let q;
	let [x, lastX] = [0, 1];
	let [y, lastY] = [1, 0];

	while(b){
		q = Math.floor(a / b);
		[a, b] = [b, a - q * b];
		[x, lastX] = [lastX - q * x, x];
		[y, lastY] = [lastY - q * y, y];
	}

	let res;
	if(a < 0){
		res = [-a, -lastX, lastY];
	}else{
		res = [a, a ? lastX : 0, lastY];
	}
	return res;
}
function gcd(a, b){
	return xgcd(a, b)[0];
}
function isPrime(candidate){
	if(candidate <= 1) {
		return false;
	}
	if(candidate <= 3) {
		return true;
	}
	if(candidate % 2 === 0 || candidate % 3 === 0) {
		return false;
	}

	return millerRabinTest(candidate, 20);
}

function millerRabinTest(n, k){
	if(n <= 1 || n % 2 === 0){
		return false;
	}

	// Write n as 2^r * d + 1
	let r = 0;
	let d = n - 1;
	while(d % 2 === 0){
		r++;
		d /= 2;
	}

	// Witness loop
	for(let i = 0; i < k; i++){
		let a = uniformRange(2, n-2); // Random witness in the range [2, n-2]
		let x = Math.pow(a, d) % n;

		if(x === 1 || x === n - 1){
			continue; // Test passed, try another witness
		}

		for(let j = 0; j < r - 1; j++){
			x = Math.pow(x, 2) % n;
			if(x === n - 1){
				break; // Test passed, try another witness
			}
		}

		if(x !== n - 1){
			return false; // Not prime
		}
	}

	return true; // Likely prime
}
function generateLCGParams(seed, width){
	if(width > 53){
		throw new Error('Width must be less than or equal to 53');
	}

	let a = seed | 1;
	while(!isPrime(a)){
		a += 2;
	}
	const m = 2**width;
	let c = 1;
	while(gcd(c, m) !== 1){
		c++;
	}

	return [a, c, m];
}
function lcg(name, a, c, m, seed){
	// console.log('creating lcg', name, a, c, m, seed);
	Object.defineProperty(lcg, name, {
		value: function(){
			// seed = newSeed | (a * seed + c) % m;
			seed = (a * seed + c) % m;
			return seed;
		}
	});
	// console.log('lcg:', lcg[name].toString());
	return lcg[name];
}

function uniformRange(min, max){
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function PRNG(){
	if(!new.target){
		return new PRNG(...arguments);
	}
	if(PRNG.instance !== undefined){
		return PRNG.instance;
	}
	Object.defineProperty(PRNG, 'instance', {value: this});

	const [a, c, m] = generateLCGParams(uniformRange(1000, 10000), 16);
	lcg('seeded', a, c, m, uniformRange(1, m));
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
			value: uniformRange
		}
	});
}

module.exports = {
	integer,
	gaussian,
	gcd,
	generateLCGParams,
	isPrime,
	lcg,
	normal: gaussian.random,
	seeded: lcg.seeded,
	uniformRange,
	PRNG: PRNG()
};
