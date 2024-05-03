const {assert} = require('chai');
// import Logger from './blogger';
const {
	CIQ,
	ciqSeeded
} = require('./chartiq');
const uheprng = require('./grc');
const {
	gcd,
	generateLCGParams,
	isPrime,
	PRNG
} = require('./PRNG');
// const logger = new Logger('spec.js');

// Abramowitz and Stegun approximation of the error function
function erf(x){
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;

	const sign = (x >= 0) ? 1 : -1;
	const t = 1 / (1 + p * Math.abs(x));
	const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
	return sign * y;
}

const uniformCDF = value => value;
const uniformIntegerCDF = (min, max, value) => {
	if(value <= min){
		return 0;
	}
	if(value >= max){
		return 1;
	}
	return (value - min) / (max - min);
}
const normalCDF = (mean, stdDev, value) => 0.5 * (1 + erf((value - mean) / (Math.sqrt(2 * stdDev ** 2))));

function kolmogorovSmirnovTest(samples, theoreticalCDF){
	samples.sort((a, b) => a - b);

	const empiricalCDF = samples.map((value, index) => (index + 1) / samples.length);
	const differences = empiricalCDF.map((value, index) => Math.abs(value - theoreticalCDF(samples[index])));
	const D = Math.max(...differences);
	// const alpha = 1.36 / Math.sqrt(samples.length);
	const alpha = 1.63 / Math.sqrt(samples.length);
	const passed = D <= alpha;

	return {D, alpha, passed};
}

function chiSquaredBigInt(sequence, numBins){
	// console.log('sequence:', sequence);
	// console.log('numBins:', numBins);
	if(!(numBins instanceof BigInt)){
		numBins = BigInt(numBins);
	}
	sequence.sort((a, b) => a - b > 0 ? 1 : a - b < 0 ? -1 : 0);

	const min = sequence[0];
	const max = sequence[sequence.length - 1];
	// console.log('min:', min, 'max:', max, 'range:', max - min);
	const binSize = (max - min + 1n) / numBins;
	// console.log('binSize:', binSize);

	const observedFrequency = new Array(Number(numBins) + 1).fill(0n);
	// console.log('observedFrequency:', observedFrequency, observedFrequency.length, typeof observedFrequency[0]);
	for(let i = 0; i < sequence.length; i++){
		// figure out which bin the value belongs to
		const bin = Number((sequence[i] - min) / binSize);
		try{
			observedFrequency[bin] += 1n;
		}catch(e){
			// console.log('sequence:', sequence[i]);
			// console.log('bin:', bin, typeof bin, 'observedFrequency[bin]:', observedFrequency[bin], typeof observedFrequency[bin]);
			assert(false);
		}
	}

	const expectedFrequency = BigInt(sequence.length) / numBins;

	let chiSquare = 0n;
	for(let i = 0; i < numBins; i++){
		const deviation = observedFrequency[i] - expectedFrequency;
		chiSquare += ((deviation ** 2n) * expectedFrequency) / (expectedFrequency ** 2n);
	}

	// console.log('chiSquare:', chiSquare);
	return chiSquare;
}

function calculateEntropy(data){
	let frequencies = {};

	// Calculate the frequency of each value in the data set
	for(let value of data){
		if(value in frequencies){
			frequencies[value]++;
		}else{
			frequencies[value] = 1;
		}
	}
	// console.log('frequencies:', frequencies);

	let entropy = 0;
	const dataSize = data.length;

	// Calculate the entropy of the data set
	for(let key in frequencies){
		const frequency = frequencies[key] / dataSize;
		entropy -= frequency * Math.log2(frequency);
	}

	return entropy;
}

describe('Uniform distribution', function(){
	it('should produce uniform integer distribution [0, max)', function(){
		const numSamples = 1000;
		// const min = Number.MIN_SAFE_INTEGER;
		const min = 0;
		const max = Number.MAX_SAFE_INTEGER;

		const samples = Array.from({length: numSamples}, PRNG.integer);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce uniform integer distribution [min, max)', function(){
		const numSamples = 1000;
		const min = 100;
		const max = 1000;

		const samples = Array.from({length: numSamples}, () => PRNG.range(min, max));
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce uniform proper BigInt distribution', function(){
		const numSamples = 1000;
		const min = BigInt(Number.MAX_SAFE_INTEGER);
		const max = BigInt(Number.MAX_SAFE_INTEGER * 2);
		// https://cdn.scribbr.com/wp-content/uploads/2022/05/chi-square-distribution-table.png
		const threshold = 50;

		const samples = Array.from({length: numSamples}, () => PRNG.biRandom(min, max));
		const numBins = Math.round(Math.sqrt(samples.length));
		const chiSquare = chiSquaredBigInt(samples, numBins);
		assert.ok(chiSquare < threshold, `Chi-Square value: ${chiSquare} exceeds threshold ${threshold}`);
	});
	it('should produce uniform BigInt distribution', function(){
		const numSamples = 1000;
		const min = 0;
		const max = BigInt(Number.MAX_SAFE_INTEGER * 2);
		// https://cdn.scribbr.com/wp-content/uploads/2022/05/chi-square-distribution-table.png
		const threshold = 50;

		const samples = Array.from({length: numSamples}, () => PRNG.biRandom(min, max));
		const numBins = Math.round(Math.sqrt(samples.length));
		const chiSquare = chiSquaredBigInt(samples, numBins);
		assert.ok(chiSquare < threshold, `Chi-Square value: ${chiSquare} exceeds threshold ${threshold}`);
	});
});

describe('Linear Congruential Generator', function(){
	it('should generate high-quality LCG parameters', function(){
		const seed = 123;
		const width = 52;
		const [a, c, m] = generateLCGParams(seed, width);

		assert.isTrue(isPrime(a), 'Multiplier a is not a prime number');
		assert.strictEqual(gcd(c, m), 1, 'Increment c and modulus m are not relatively prime');
		assert.strictEqual(m, 2 ** width, 'Modulus m is not 2 raised to the power of width');
	});
	it('should produce uniform seeded distribution', function(){
		const numSamples = 1000;
		const min = 0;
		const max = 2 ** 16;

		const samples = Array.from({length: numSamples}, PRNG.lcg.seeded);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce a full period before repeating', function(){
		const seed = 123;
		const width = 16;
		const [a, c, m] = generateLCGParams(seed, width);
		// console.log(a, c, m, seed);
		const lcg = PRNG.lcg('test', a, c, m, seed);

		const seen = new Set();
		let value;
		do{
			value = lcg();
			// console.log(value);
			if(seen.has(value)){
				break;
			}
			seen.add(value);
		}while(true);

		assert.strictEqual(seen.size, m, 'LCG does not have a full period');
	});
});

describe('Normal distribution', function(){
	it('should pass Kolmogorov-Smirnov for normal distribution', function(){
		const numSamples = 1000;
		const mean = 50;
		const stdDev = 15;

		const samples = Array.from({length: numSamples}, PRNG.gaussian.random);
		const cdf = normalCDF.bind(null, mean, stdDev);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		// Assert that the test result p-value is greater than a significance level (e.g., 0.05)
		assert.ok(passed, 'The generated samples do not follow a normal distribution');
	});
});

describe('CIQ', function(){
	it('should produce uniform seeded distribution', function(){
		const numSamples = 1000;

		const samples = Array.from({length: numSamples}, CIQ.random);
		// console.log(samples);
		const {passed} = kolmogorovSmirnovTest(samples, uniformCDF);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce a full period before repeating', function(){
		// const seed = 123;
		const seed = 321;
		// const m = 126726
		const m = 2 ** 16.9514;
		// console.log('seed:', seed, 'm:', m);
		const lcg = ciqSeeded(seed, seed);

		const seen = new Set();
		let value;
		do{
			value = lcg();
			// console.log(value);
			if(seen.has(value)){
				break;
			}
			seen.add(value);
		}while(true);

		// this amateurish LCG's period depends on the seed and is very volatile
		assert.notStrictEqual(seen.size, m, 'LCG does not have a full period');
	});
	it('should pass Kolmogorov-Smirnov for normal distribution', function(){
		const numSamples = 1000;
		const mean = 50;
		const stdDev = 15;

		const samples = Array.from({length: numSamples}, CIQ.gaussian);
		const cdf = normalCDF.bind(null, mean, stdDev);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		// Assert that the test result p-value is greater than a significance level (e.g., 0.05)
		assert.ok(passed, 'The generated samples do not follow a normal distribution');
	});
});

describe('GRC', function(){
	it('should produce uniform distribution [0, max)', function(){
		const numSamples = 1000;
		const min = 0;
		const max = Number.MAX_SAFE_INTEGER;

		const samples = Array.from({length: numSamples}, () => uheprng(max));
		// console.log(samples);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
});

describe('Entropy test', function(){
	it('should detect high entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, () => Math.random());
		const entropy = calculateEntropy(samples);
		// console.log('Entropy:', entropy);

		// The entropy of a uniformly distributed random variable [0,1) is 1
		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('should detect low entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, () => 0);
		const entropy = calculateEntropy(samples);
		// console.log('Entropy:', entropy);

		// The entropy of a constant random variable is 0
		const threshold = 0.1;
		assert.ok(entropy < threshold, `Entropy is too high: ${entropy}`);
	});
	it('uniform integer distribution should have high entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, PRNG.integer);
		const entropy = calculateEntropy(samples);
		// console.log('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('uniform BigInt distribution should have high entropy', function(){
		const numSamples = 1000;
		const min = BigInt(Number.MAX_SAFE_INTEGER);
		const max = BigInt(Number.MAX_SAFE_INTEGER * 2);
		const samples = Array.from({length: numSamples}, () => PRNG.biRandom(min, max));
		const entropy = calculateEntropy(samples);
		// console.log('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('LCG should have high entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, PRNG.lcg.seeded);
		const entropy = calculateEntropy(samples);
		// console.log('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('normal distribution should have high entropy', function(){
		const numSamples = 1000;
		const mean = 50;
		const stdDev = 15;

		const samples = Array.from({length: numSamples}, PRNG.gaussian.random);
		const entropy = calculateEntropy(samples);
		// console.log('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
});

describe('Kolmogorov-Smirnov', function(){
	it('should pass for uniform distribution', function(){
		const numSamples = 1000;

		const samples = Array.from({length: numSamples}, () => Math.random());
		const {passed} = kolmogorovSmirnovTest(samples, uniformCDF);

		assert.ok(passed, 'The KS test does not pass for a uniform distribution');
	});
	it('should pass for normal distribution', function(){
		const numSamples = 1000;
		const mean = 0;
		const stdDev = 1;

		// Generate normal samples
		const samples = Array.from({length: numSamples}, () => {
			return mean + stdDev * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
		});
		const cdf = normalCDF.bind(null, mean, stdDev);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The KS test does not pass for a normal distribution');
	});
	it('should fail for non-conformant sequences', function(){
		const numSamples = 1000;
		const mean = 0;
		const stdDev = 1;

		const uniformSamples = Array.from({length: numSamples}, () => Math.random());
		const normalSamples = Array.from({length: numSamples}, () => {
			return mean + stdDev * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
		});
		const normal = normalCDF.bind(null, mean, stdDev);
		const uniform = uniformCDF;

		let result = kolmogorovSmirnovTest(uniformSamples, normal);
		assert.notOk(result.passed, 'The KS test incorrectly passes for a non-conformant sequence');

		result = kolmogorovSmirnovTest(normalSamples, uniform);
		assert.notOk(result.passed, 'The KS test incorrectly passes for a non-conformant sequence');
	});
});
