function ciqGaussian(mean, stdev) {
	let y2; // since already have data, only update if the boundaries have changed
	let use_last = false;
	return function () {
		let y1;
		if (use_last) {
			y1 = y2;
			use_last = false;
		} else {
			let x1, x2, w;
			do {
				x1 = 2.0 * Math.random() - 1.0;
				x2 = 2.0 * Math.random() - 1.0;
				w = x1 * x1 + x2 * x2;
			} while (w >= 1.0);
			w = Math.sqrt((-2.0 * Math.log(w)) / w);
			y1 = x1 * w;
			y2 = x2 * w;
			use_last = true;
		}

		const retval = mean + stdev * y1;
		if (retval > 0) return retval;
		return -retval;
	};
}
function ciqSeeded(seed1, seed2){
	return function(){
		const mask = 0xffffffff;
		seed1 = (36969 * (seed1 & 65535) + (seed1 >> 16)) & mask;
		seed2 = (18000 * (seed2 & 65535) + (seed2 >> 16)) & mask;
		let result = ((seed1 << 16) + seed2) & mask;
		result /= 4294967296;
		return result + 0.5;
	}
}
function endBiased(){
	let n = Math.random();
	if(n > 0.95){
		n = 1;
	}else if(n < 0.05){
		n = 0;
	}
	return n;
}

const CIQ = {
	endBiased,
	gaussian: ciqGaussian(50, 15),
	random: ciqSeeded(Math.random() * 65535, Math.random() * 65535)
};

module.exports = {
	ciqGaussian,
	ciqSeeded,
	endBiased,
	CIQ
};
