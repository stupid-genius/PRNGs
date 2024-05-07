Number.THIRTY_TWO_BIT_MAX = 2 ** 31 - 1;

function range(min, max){
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function xgcd(a, b){
	let q;
	let [x, lastX] = [0, 1];
	let [y, lastY] = [1, 0];

	// console.log('a:', a, 'b:', b);
	while(b){
		q = Math.floor(a / b);
		[a, b] = [b, a - q * b];
		[x, lastX] = [lastX - q * x, x];
		[y, lastY] = [lastY - q * y, y];
		// console.log('a:', a, 'b:', b, 'q:', q, 'x:', x, 'lastX:', lastX, 'y:', y, 'lastY:', lastY);
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

function modPow(base, exponent, modulus){
	if(modulus === 1) return 0;
	let result = 1;
	base = base % modulus;
	while(exponent > 0){
		if(exponent % 2 === 1){
			result = (result * base) % modulus;
		}
		exponent = exponent >> 1;
		base = (base * base) % modulus;
	}
	return result;
}

function isPrime(candidate){
	if(candidate <= 1){
		return false;
	}
	if(candidate <= 3){
		return true;
	}
	if(candidate % 2 === 0 || candidate % 3 === 0){
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
		let a = range(2, n - 2); // Random witness in the range [2, n-2]
		// let x = Math.pow(a, d) % n;
		let x = modPow(a, d, n);

		if(x === 1 || x === n - 1){
			continue; // Test passed, try another witness
		}

		for(let j = 0; j < r - 1; j++){
			// x = Math.pow(x, 2) % n;
			x = modPow(x, 2, n);
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

function atkinsSieve(min, max){
	const isPrime = [];
	const sqrtMax = Math.sqrt(max);

	// Initialize the sieve array
	for(let i = 0; i <= max; i++){
		isPrime[i] = false;
	}

	// Manually set 2 and 3 as prime
	if(max >= 2) isPrime[2] = true;
	if(max >= 3) isPrime[3] = true;

	// Sieve of Atkin
	console.log('starting sieve of atkin');
	for(let x = 1; x <= sqrtMax; x++){
		for(let y = 1; y <= sqrtMax; y++){
			let n = (4 * x * x) + (y * y);
			if(n <= max && (n % 12 == 1 || n % 12 == 5)){
				isPrime[n] = !isPrime[n];
			}

			n = (3 * x * x) + (y * y);
			if(n <= max && n % 12 == 7){
				isPrime[n] = !isPrime[n];
			}

			n = (3 * x * x) - (y * y);
			if(x >= y && n <= max && n % 12 == 11){
				isPrime[n] = !isPrime[n];
			}
		}
	}

	// Mark all multiples of squares as non-prime
	for(let i = 5; i <= sqrtMax; i++){
		if(isPrime[i]){
			const squared = i * i;
			for(let j = squared; j <= max; j += squared){
				isPrime[j] = false;
			}
		}
	}

	// Add primes to result array
	const primes = [];
	for(let i = Math.max(2, min) - 1; i <= max; i++){
		if(isPrime[i]){
			primes.push(i);
		}
	}

	return primes;
}

// Euler's totient function which counts the number of positive integers less than n that are coprime to n
function phi(n){
	// Generate primes up to sqrt(n) using Sieve of Atkins
	const sqrtN = Math.ceil(Math.sqrt(n));
	const primes = atkinsSieve(2, sqrtN);
	// console.log('primes:', primes);

	// Initialize result as n
	let result = n;

	// Iterate through prime factors of n
	for(const prime of primes){
		if(n % prime === 0){
			// If prime divides n, update result
			result = result * (prime - 1) / prime;
			// Remove all occurrences of prime from n
			while(n % prime === 0){
				n /= prime;
			}
		}
	}

	// If n is still greater than 1, it must be a prime factor greater than sqrt(n)
	if(n > 1){
		result = result * (n - 1) / n;
	}

	return result;
}

function isPrimitiveRoot(g, n){
	// Check if g is a primitive root modulo n
	if(gcd(g, n) !== 1){
		return false; // g and n are not coprime
	}
	const phiN = phi(n);
	const residues = new Set();
	for(let i = 0; i < n; i++){
		residues.add(modPow(g, i, n));
	}
	return phiN === residues.size;
}

function generateLCGParams(seed, max){
	if(max > Number.THIRTY_TWO_BIT_MAX){
		throw new Error('max must be 32-bit integer');
	}
	if(max & (max - 1) !== 0){
		throw new Error('max must be power of two');
	}

	const phiN = phi(max);

	console.log('seed:', seed, 'max:', max);
	let a = seed | 1;
	while(a < max){
		while(!isPrime(a)){
			a += 2;
		}
		while(!isPrimitiveRoot(a, max)){
			a += 2;
			console.log('candidate a:', a);
		}
	}
	if(!isPrime(a) || !isPrimitiveRoot(a, max)){
		throw new Error('could not find suitable a value');
	}
	/*console.log('a:', a);
	let m = max;
	console.log('initial m:', m);
	let c = 3;
	// let c = Math.round(Math.sqrt(m)) | 1;
	console.log('initial c:', c);
	while(!isPrime(c) || gcd(c, m) !== 1){
		c += 2;
		console.log('c:', c);
	}*/
	// while(gcd(m, c) !== 1){
	// 	c++;
	// 	console.log('c:', c);
	// }
	// if(!isPrime(c)){
	// 	throw new Error('could not find prime c value');
	// }
	// console.log('preliminary c:', c);
	// while((a * m + c) > Number.THIRTY_TWO_BIT_MAX || m % c === 0){
	// 	console.log('a * m + c:', a * m + c, 'm % c:', m % c);
	// 	// --m;
	// }
	// while(!isPrime(--m)){
	// 	m -= 2;
	// }
	// console.log('candidate m:', m);
	// if(m < c){
	// 	throw new Error('could not find suitable m value');
	// }
	// console.log('m:', m);
	console.log('c:', c);

	return [a, c, m];
}

function lcg(name, a, c, m, seed){
	// console.log(`creating lcg "${name}" with (${a}, ${c}, ${m}, ${seed})`);
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

module.exports = {
	gcd,
	generateLCGParams,
	isPrime,
	lcg,
	range
};
